use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, PartialEq)]
#[sqlx(type_name = "VARCHAR", rename_all = "lowercase")]
pub enum IdempotencyStatus {
    Pending,
    InProgress,
    Completed,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct IdempotencyRecord {
    pub id: Uuid,
    pub idempotency_key: Uuid,
    pub request_hash: String,
    pub status: IdempotencyStatus,
    pub payment_id: Option<Uuid>,
    pub error_message: Option<String>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
    pub expires_at: NaiveDateTime,
}

#[derive(Debug, Clone)]
pub struct IdempotencyConfig {
    pub ttl_seconds: i64,    // Default: 24 hours
    pub max_retries: u32,    // Maximum retry attempts for in_progress state
    pub retry_delay_ms: u64, // Delay between retries
}

impl Default for IdempotencyConfig {
    fn default() -> Self {
        Self {
            ttl_seconds: 86400, // 24 hours
            max_retries: 10,
            retry_delay_ms: 100,
        }
    }
}

/// Result of idempotency check
#[derive(Debug)]
pub enum IdempotencyCheckResult {
    /// First request - proceed with operation
    Proceed,

    /// Duplicate request - payment already exists
    AlreadyCompleted(Uuid), // payment_id

    /// Another request is in progress - wait and retry
    InProgress,

    /// Previous request failed - can retry
    PreviouslyFailed(String),

    /// Request hash mismatch - same key, different payload
    HashMismatch,
}
