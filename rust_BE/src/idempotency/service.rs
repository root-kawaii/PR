use super::models::{IdempotencyCheckResult, IdempotencyConfig, IdempotencyRecord, IdempotencyStatus};
use axum::http::StatusCode;
use serde::Serialize;
use sha2::{Digest, Sha256};
use sqlx::PgPool;
use uuid::Uuid;
use tracing::{info, warn, error, debug};

pub struct IdempotencyService {
    pool: PgPool,
    config: IdempotencyConfig,
}

impl IdempotencyService {
    pub fn new(pool: PgPool, config: IdempotencyConfig) -> Self {
        Self { pool, config }
    }

    /// Check if an operation with this idempotency key already exists
    pub async fn check_idempotency(
        &self,
        idempotency_key: Uuid,
        request_hash: &str,
    ) -> Result<IdempotencyCheckResult, StatusCode> {
        let record = sqlx::query_as::<_, IdempotencyRecord>(
            "SELECT * FROM idempotency_keys WHERE idempotency_key = $1"
        )
        .bind(&idempotency_key)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| {
            error!(error = %e, idempotency_key = %idempotency_key, "Database error checking idempotency");
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

        match record {
            None => Ok(IdempotencyCheckResult::Proceed),

            Some(rec) => {
                // Validate request hash matches
                if rec.request_hash != request_hash {
                    error!(
                        idempotency_key = %idempotency_key,
                        expected_hash = %rec.request_hash,
                        received_hash = %request_hash,
                        "Idempotency key reused with different payload"
                    );
                    return Ok(IdempotencyCheckResult::HashMismatch);
                }

                match rec.status {
                    IdempotencyStatus::Completed => {
                        if let Some(payment_id) = rec.payment_id {
                            debug!(idempotency_key = %idempotency_key, payment_id = %payment_id, "Returning cached completed payment");
                            Ok(IdempotencyCheckResult::AlreadyCompleted(payment_id))
                        } else {
                            error!(idempotency_key = %idempotency_key, "Completed idempotency record missing payment_id");
                            Err(StatusCode::INTERNAL_SERVER_ERROR)
                        }
                    }

                    IdempotencyStatus::InProgress | IdempotencyStatus::Pending => {
                        Ok(IdempotencyCheckResult::InProgress)
                    }

                    IdempotencyStatus::Failed => {
                        let error = rec
                            .error_message
                            .unwrap_or_else(|| "Unknown error".to_string());
                        Ok(IdempotencyCheckResult::PreviouslyFailed(error))
                    }
                }
            }
        }
    }

    /// Create a new idempotency record (acts as distributed lock)
    /// Returns true if successfully created, false if another request won the race
    pub async fn create_idempotency_record(
        &self,
        idempotency_key: Uuid,
        request_hash: String,
    ) -> Result<bool, StatusCode> {
        let expires_at =
            chrono::Utc::now().naive_utc() + chrono::Duration::seconds(self.config.ttl_seconds);

        let result = sqlx::query(
            r#"
            INSERT INTO idempotency_keys
            (idempotency_key, request_hash, status, expires_at)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (idempotency_key) DO NOTHING
            "#,
        )
        .bind(&idempotency_key)
        .bind(&request_hash)
        .bind(IdempotencyStatus::InProgress)
        .bind(expires_at)
        .execute(&self.pool)
        .await
        .map_err(|e| {
            error!(error = %e, idempotency_key = %idempotency_key, "Failed to create idempotency record");
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

        // rows_affected == 1 means we won the race
        let won_race = result.rows_affected() == 1;
        if won_race {
            debug!(idempotency_key = %idempotency_key, "Won idempotency race - executing operation");
        } else {
            debug!(idempotency_key = %idempotency_key, "Lost idempotency race - will wait for winner");
        }
        Ok(won_race)
    }

    /// Mark idempotency record as completed with payment_id
    pub async fn mark_completed(
        &self,
        idempotency_key: Uuid,
        payment_id: Uuid,
    ) -> Result<(), StatusCode> {
        sqlx::query(
            r#"
            UPDATE idempotency_keys
            SET status = $1, payment_id = $2
            WHERE idempotency_key = $3
            "#,
        )
        .bind(IdempotencyStatus::Completed)
        .bind(payment_id)
        .bind(&idempotency_key)
        .execute(&self.pool)
        .await
        .map_err(|e| {
            error!(error = %e, idempotency_key = %idempotency_key, "Failed to mark idempotency as completed");
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

        debug!(idempotency_key = %idempotency_key, payment_id = %payment_id, "Idempotency record marked as completed");
        Ok(())
    }

    /// Mark idempotency record as failed with error message
    pub async fn mark_failed(
        &self,
        idempotency_key: Uuid,
        error_message: String,
    ) -> Result<(), StatusCode> {
        sqlx::query(
            r#"
            UPDATE idempotency_keys
            SET status = $1, error_message = $2
            WHERE idempotency_key = $3
            "#,
        )
        .bind(IdempotencyStatus::Failed)
        .bind(&error_message)
        .bind(&idempotency_key)
        .execute(&self.pool)
        .await
        .map_err(|e| {
            error!(error = %e, idempotency_key = %idempotency_key, "Failed to mark idempotency as failed");
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

        warn!(idempotency_key = %idempotency_key, error_message = %error_message, "Idempotency record marked as failed");
        Ok(())
    }

    /// Wait for an in-progress operation to complete and return the payment_id
    pub async fn wait_for_completion(
        &self,
        idempotency_key: Uuid,
    ) -> Result<Uuid, StatusCode> {
        for attempt in 0..self.config.max_retries {
            tokio::time::sleep(tokio::time::Duration::from_millis(
                self.config.retry_delay_ms,
            ))
            .await;

            let record = sqlx::query_as::<_, IdempotencyRecord>(
                "SELECT * FROM idempotency_keys WHERE idempotency_key = $1",
            )
            .bind(&idempotency_key)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| {
                error!(error = %e, idempotency_key = %idempotency_key, "Database error while waiting for completion");
                StatusCode::INTERNAL_SERVER_ERROR
            })?;

            match record {
                Some(rec) if rec.status == IdempotencyStatus::Completed => {
                    if let Some(payment_id) = rec.payment_id {
                        info!(idempotency_key = %idempotency_key, payment_id = %payment_id, attempt = attempt + 1, "Operation completed - returning result");
                        return Ok(payment_id);
                    } else {
                        error!(idempotency_key = %idempotency_key, "Completed record missing payment_id");
                        return Err(StatusCode::INTERNAL_SERVER_ERROR);
                    }
                }

                Some(rec) if rec.status == IdempotencyStatus::Failed => {
                    error!(idempotency_key = %idempotency_key, error_message = ?rec.error_message, "Operation failed");
                    return Err(StatusCode::BAD_GATEWAY);
                }

                _ => {
                    if attempt == self.config.max_retries - 1 {
                        error!(idempotency_key = %idempotency_key, max_retries = self.config.max_retries, "Timeout waiting for operation to complete");
                        return Err(StatusCode::REQUEST_TIMEOUT);
                    }
                    debug!(idempotency_key = %idempotency_key, attempt = attempt + 1, "Waiting for operation to complete");
                    continue;
                }
            }
        }

        Err(StatusCode::REQUEST_TIMEOUT)
    }

    /// Calculate SHA256 hash of request payload
    pub fn calculate_hash(&self, payload: &impl Serialize) -> String {
        let json = serde_json::to_string(payload).unwrap_or_default();
        let mut hasher = Sha256::new();
        hasher.update(json.as_bytes());
        format!("{:x}", hasher.finalize())
    }
}
