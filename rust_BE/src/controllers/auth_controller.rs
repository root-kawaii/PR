use crate::models::{AppState, AuthResponse, LoginRequest, RegisterRequest, UserResponse};
use crate::application::auth_service as user_persistence;
use crate::application::outbox_service;
use crate::utils::jwt;
use crate::services::sms_service;
use crate::middleware::auth::AuthUser;
use axum::{extract::State, http::StatusCode, Json};
use bcrypt::{hash, verify, DEFAULT_COST};
use std::sync::Arc;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use tracing::{info, warn, error};

/// Validate an email address — must contain @ and a dot after it
fn is_valid_email(email: &str) -> bool {
    let parts: Vec<&str> = email.splitn(2, '@').collect();
    if parts.len() != 2 { return false; }
    let domain = parts[1];
    !parts[0].is_empty() && domain.contains('.') && domain.len() > 2
}

/// Register a new user
pub async fn register(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<RegisterRequest>,
) -> Result<(StatusCode, Json<AuthResponse>), (StatusCode, axum::Json<crate::models::ApiError>)> {
    info!(email = %payload.email, "Registration attempt");

    if !is_valid_email(&payload.email) {
        warn!(email = %payload.email, "Registration rejected: invalid email format");
        return Err(crate::models::ApiError::new(StatusCode::BAD_REQUEST, "Formato email non valido"));
    }

    if payload.password.len() < 8 {
        warn!(email = %payload.email, "Registration rejected: password too short");
        return Err(crate::models::ApiError::new(StatusCode::BAD_REQUEST, "La password deve essere di almeno 8 caratteri"));
    }

    match user_persistence::find_user_by_email(&state.db_pool, &payload.email).await {
        Ok(Some(_)) => {
            warn!(email = %payload.email, "Registration rejected: email already exists");
            return Err(crate::models::ApiError::new(StatusCode::CONFLICT, "Esiste già un account con questa email"));
        }
        Ok(None) => {}
        Err(e) => {
            error!(error = %e, email = %payload.email, "DB error checking existing user");
            return Err(crate::models::ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Errore interno"));
        }
    }

    // Check phone uniqueness if provided
    if let Some(ref phone) = payload.phone_number {
        if !phone.is_empty() {
            match user_persistence::find_user_by_phone(&state.db_pool, phone).await {
                Ok(Some(_)) => {
                    warn!(phone = %phone, "Registration rejected: phone already in use");
                    return Err(crate::models::ApiError::new(StatusCode::CONFLICT, "Esiste già un account con questo numero di telefono"));
                }
                Ok(None) => {}
                Err(e) => {
                    error!(error = %e, "DB error checking phone uniqueness");
                    return Err(crate::models::ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Errore interno"));
                }
            }
        }
    }

    let password_hash = match hash(payload.password, DEFAULT_COST) {
        Ok(hash) => hash,
        Err(e) => {
            error!(error = %e, "Failed to hash password");
            return Err(crate::models::ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Errore interno"));
        }
    };

    let user = match user_persistence::create_user(
        &state.db_pool,
        payload.email.clone(),
        password_hash,
        payload.name,
        payload.phone_number,
        payload.date_of_birth,
    )
    .await
    {
        Ok(user) => user,
        Err(e) => {
            error!(error = %e, email = %payload.email, "Failed to create user");
            return Err(crate::models::ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Errore interno"));
        }
    };

    let token = match jwt::generate_token(user.id, user.email.clone(), "user".to_string(), &state.jwt_secret) {
        Ok(token) => token,
        Err(e) => {
            error!(error = %e, user_id = %user.id, "Failed to generate JWT after registration");
            return Err(crate::models::ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Errore interno"));
        }
    };

    info!(user_id = %user.id, email = %user.email, "User registered successfully");

    let response = AuthResponse {
        user: UserResponse::from(user),
        token,
    };

    Ok((StatusCode::CREATED, Json(response)))
}

/// Login an existing user
pub async fn login(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<LoginRequest>,
) -> Result<Json<AuthResponse>, (StatusCode, axum::Json<crate::models::ApiError>)> {
    info!(email = %payload.email, "Login attempt");

    let user = match user_persistence::find_user_by_email(&state.db_pool, &payload.email).await {
        Ok(Some(user)) => user,
        Ok(None) => {
            warn!(email = %payload.email, "Login failed: email not found");
            return Err(crate::models::ApiError::new(StatusCode::UNAUTHORIZED, "Email o password non corretti"));
        }
        Err(e) => {
            error!(error = %e, email = %payload.email, "DB error during login");
            return Err(crate::models::ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Errore interno"));
        }
    };

    let is_valid = match verify(payload.password, &user.password_hash) {
        Ok(valid) => valid,
        Err(e) => {
            error!(error = %e, user_id = %user.id, "bcrypt verify error");
            return Err(crate::models::ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Errore interno"));
        }
    };

    if !is_valid {
        warn!(email = %payload.email, "Login failed: wrong password");
        return Err(crate::models::ApiError::new(StatusCode::UNAUTHORIZED, "Email o password non corretti"));
    }

    let _ = user_persistence::update_last_login(&state.db_pool, user.id).await;

    let token = match jwt::generate_token(user.id, user.email.clone(), "user".to_string(), &state.jwt_secret) {
        Ok(token) => token,
        Err(e) => {
            error!(error = %e, user_id = %user.id, "Failed to generate JWT");
            return Err(crate::models::ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Errore durante la generazione del token"));
        }
    };

    info!(user_id = %user.id, email = %user.email, "Login successful");

    Ok(Json(AuthResponse {
        user: UserResponse::from(user),
        token,
    }))
}


#[derive(Debug, Deserialize)]
pub struct SendSmsRequest {
    user_id: String,
    phone_number: String,
}

#[derive(Debug, Serialize)]
pub struct SendSmsResponse {
    message: String,
}

#[derive(Debug, Deserialize)]
pub struct VerifySmsRequest {
    user_id: String,
    phone_number: String,
    verification_code: String,
}

#[derive(Debug, Serialize)]
pub struct VerifySmsResponse {
    message: String,
    verified: bool,
}

/// Register or update the Expo push token for the authenticated user.
///
/// Called by the frontend after login and whenever the token refreshes.
#[derive(Debug, Deserialize)]
pub struct RegisterPushTokenRequest {
    pub push_token: String,
}

pub async fn register_push_token(
    State(state): State<Arc<AppState>>,
    AuthUser(claims): AuthUser,
    Json(payload): Json<RegisterPushTokenRequest>,
) -> StatusCode {
    let user_id = match Uuid::parse_str(&claims.sub) {
        Ok(id) => id,
        Err(_) => return StatusCode::UNAUTHORIZED,
    };

    match sqlx::query(
        "UPDATE users SET expo_push_token = $1, updated_at = NOW() WHERE id = $2",
    )
    .bind(&payload.push_token)
    .bind(user_id)
    .execute(&state.db_pool)
    .await
    {
        Ok(_) => StatusCode::NO_CONTENT,
        Err(e) => {
            tracing::error!(error = %e, "Failed to save push token");
            StatusCode::INTERNAL_SERVER_ERROR
        }
    }
}

/// Send SMS verification code using Twilio Verify
pub async fn send_sms_verification(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<SendSmsRequest>,
) -> Result<Json<SendSmsResponse>, StatusCode> {
    let user_uuid = match Uuid::parse_str(&payload.user_id) {
        Ok(uuid) => uuid,
        Err(_) => return Err(StatusCode::BAD_REQUEST),
    };

    // Verify user exists
    match user_persistence::find_user_by_id(&state.db_pool, user_uuid).await {
        Ok(Some(_)) => {},
        Ok(None) => return Err(StatusCode::NOT_FOUND),
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    }

    // Send SMS using Twilio Verify API (Twilio generates and manages the code)
    match sms_service::send_verification_sms(&state.config, &payload.phone_number).await {
        Ok(_) => {
            let _ = outbox_service::enqueue_analytics_event(
                &state.db_pool,
                &state.config,
                "sms_verification_sent",
                Some(&payload.user_id),
                Some("user"),
                Some(user_uuid),
                serde_json::json!({
                    "user_id": user_uuid,
                    "outcome": "success",
                }),
            ).await;

            Ok(Json(SendSmsResponse {
                message: "Verification code sent successfully".to_string(),
            }))
        },
        Err(e) => {
            tracing::error!(error = %e, "SMS sending error");
            let _ = outbox_service::enqueue_analytics_error(
                &state.db_pool,
                &state.config,
                "sms_verification_send_failed",
                Some(&payload.user_id),
                Some("user"),
                Some(user_uuid),
                &e.to_string(),
                serde_json::json!({
                    "user_id": user_uuid,
                }),
            ).await;
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Verify SMS code using Twilio Verify API
pub async fn verify_sms_code(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<VerifySmsRequest>,
) -> Result<Json<VerifySmsResponse>, StatusCode> {
    let user_uuid = match Uuid::parse_str(&payload.user_id) {
        Ok(uuid) => uuid,
        Err(_) => return Err(StatusCode::BAD_REQUEST),
    };

    // Verify the code using Twilio Verify API
    let is_valid = match sms_service::verify_code(&state.config, &payload.phone_number, &payload.verification_code).await {
        Ok(valid) => valid,
        Err(e) => {
            tracing::error!(error = %e, "Twilio Verify error");
            let _ = outbox_service::enqueue_analytics_error(
                &state.db_pool,
                &state.config,
                "sms_verification_check_failed",
                Some(&payload.user_id),
                Some("user"),
                Some(user_uuid),
                &e.to_string(),
                serde_json::json!({
                    "user_id": user_uuid,
                }),
            ).await;
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    if !is_valid {
        let _ = outbox_service::enqueue_analytics_event(
            &state.db_pool,
            &state.config,
            "sms_verification_invalid",
            Some(&payload.user_id),
            Some("user"),
            Some(user_uuid),
            serde_json::json!({
                "user_id": user_uuid,
                "outcome": "invalid",
            }),
        ).await;
        return Ok(Json(VerifySmsResponse {
            message: "Invalid or expired verification code".to_string(),
            verified: false,
        }));
    }

    // Code is valid - update user's phone_verified status
    match sqlx::query(
        r#"
        UPDATE users
        SET phone_verified = TRUE, phone_number = $1, updated_at = NOW()
        WHERE id = $2
        "#
    )
    .bind(&payload.phone_number)
    .bind(user_uuid)
    .execute(&state.db_pool)
    .await
    {
        Ok(_) => {
            let _ = outbox_service::enqueue_analytics_event(
                &state.db_pool,
                &state.config,
                "sms_verification_verified",
                Some(&payload.user_id),
                Some("user"),
                Some(user_uuid),
                serde_json::json!({
                    "user_id": user_uuid,
                    "outcome": "success",
                }),
            ).await;
            Ok(Json(VerifySmsResponse {
                message: "Phone number verified successfully".to_string(),
                verified: true,
            }))
        },
        Err(e) => {
            tracing::error!(error = %e, "Database error updating user phone verification");
            let _ = outbox_service::enqueue_analytics_error(
                &state.db_pool,
                &state.config,
                "sms_verification_persist_failed",
                Some(&payload.user_id),
                Some("user"),
                Some(user_uuid),
                &e.to_string(),
                serde_json::json!({
                    "user_id": user_uuid,
                }),
            ).await;
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}
