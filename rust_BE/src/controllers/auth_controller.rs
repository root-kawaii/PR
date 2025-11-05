use crate::models::{AppState, AuthResponse, LoginRequest, RegisterRequest, UserResponse};
use crate::persistences::user_persistence;
use crate::utils::jwt;
use axum::{extract::State, http::StatusCode, Json};
use bcrypt::{hash, verify, DEFAULT_COST};
use std::sync::Arc;

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