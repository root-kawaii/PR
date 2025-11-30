use crate::models::{AppState, AuthResponse, LoginRequest, RegisterRequest, UserResponse};
use crate::persistences::user_persistence;
use crate::utils::jwt;
use crate::services::sms_service;
use axum::{extract::State, http::StatusCode, Json};
use bcrypt::{hash, verify, DEFAULT_COST};
use std::sync::Arc;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Register a new user
pub async fn register(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<RegisterRequest>,
) -> Result<(StatusCode, Json<AuthResponse>), StatusCode> {
    // Validate email format
    if !payload.email.contains('@') {
        return Err(StatusCode::BAD_REQUEST);
    }

    // Validate password strength (minimum 6 characters)
    if payload.password.len() < 6 {
        return Err(StatusCode::BAD_REQUEST);
    }

    // Check if user already exists
    match user_persistence::find_user_by_email(&state.db_pool, &payload.email).await {
        Ok(Some(_)) => {
            // User already exists
            return Err(StatusCode::CONFLICT);
        }
        Ok(None) => {
            // User doesn't exist, proceed with registration
        }
        Err(_) => {
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    }

    // Hash the password
    let password_hash = match hash(payload.password, DEFAULT_COST) {
        Ok(hash) => hash,
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };

    // Create the user
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
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };

    // Generate JWT token
    let token = match jwt::generate_token(user.id, user.email.clone(), &state.jwt_secret) {
        Ok(token) => token,
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };

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
) -> Result<Json<AuthResponse>, StatusCode> {
    // Find user by email
    let user = match user_persistence::find_user_by_email(&state.db_pool, &payload.email).await {
        Ok(Some(user)) => user,
        Ok(None) => {
            // User not found
            return Err(StatusCode::UNAUTHORIZED);
        }
        Err(_) => {
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    // Verify password
    let is_valid = match verify(payload.password, &user.password_hash) {
        Ok(valid) => valid,
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };

    if !is_valid {
        return Err(StatusCode::UNAUTHORIZED);
    }

    // Update last login (optional)
    let _ = user_persistence::update_last_login(&state.db_pool, user.id).await;

    // Generate JWT token
    let token = match jwt::generate_token(user.id, user.email.clone(), &state.jwt_secret) {
        Ok(token) => token,
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };

    let response = AuthResponse {
        user: UserResponse::from(user),
        token,
    };

    Ok(Json(response))
}

/// Get current user info (requires authentication)
pub async fn me(
    State(state): State<AppState>,
    user_id: String, // This will come from auth middleware
) -> Result<Json<UserResponse>, StatusCode> {
    let user_uuid = match uuid::Uuid::parse_str(&user_id) {
        Ok(uuid) => uuid,
        Err(_) => return Err(StatusCode::BAD_REQUEST),
    };

    let user = match user_persistence::find_user_by_id(&state.db_pool, user_uuid).await {
        Ok(Some(user)) => user,
        Ok(None) => return Err(StatusCode::NOT_FOUND),
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };

    Ok(Json(UserResponse::from(user)))
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
    match sms_service::send_verification_sms(&payload.phone_number).await {
        Ok(_) => {
            // Log the verification attempt in our database for audit trail
            // Skipping database logging for now to simplify

            Ok(Json(SendSmsResponse {
                message: "Verification code sent successfully".to_string(),
            }))
        },
        Err(e) => {
            eprintln!("SMS sending error: {}", e);
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
    let is_valid = match sms_service::verify_code(&payload.phone_number, &payload.verification_code).await {
        Ok(valid) => valid,
        Err(e) => {
            eprintln!("Twilio Verify error: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    if !is_valid {
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
            Ok(Json(VerifySmsResponse {
                message: "Phone number verified successfully".to_string(),
                verified: true,
            }))
        },
        Err(e) => {
            eprintln!("Database error updating user: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}