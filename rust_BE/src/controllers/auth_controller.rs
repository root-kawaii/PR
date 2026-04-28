use crate::application::auth_service as user_persistence;
use crate::application::outbox_service;
use crate::middleware::auth::{AuthUser, SmsVerificationUser};
use crate::models::{
    ApiError, AppState, AuthResponse, LoginRequest, RegisterRequest, User, UserResponse,
};
use crate::services::sms_service;
use crate::utils::jwt;
use axum::{body::Bytes, extract::State, http::StatusCode, Json};
use bcrypt::{hash, verify, DEFAULT_COST};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tracing::{error, info, warn};
use uuid::Uuid;

/// Validate an email address — must contain @ and a dot after it
fn is_valid_email(email: &str) -> bool {
    let parts: Vec<&str> = email.splitn(2, '@').collect();
    if parts.len() != 2 {
        return false;
    }
    let domain = parts[1];
    !parts[0].is_empty() && domain.contains('.') && domain.len() > 2
}

fn normalize_phone_number(phone: &str) -> Option<String> {
    let compact: String = phone
        .trim()
        .chars()
        .filter(|c| c.is_ascii_digit() || *c == '+')
        .collect();

    if compact.is_empty() {
        return None;
    }

    let normalized = if let Some(stripped) = compact.strip_prefix('+') {
        let digits: String = stripped.chars().filter(|c| c.is_ascii_digit()).collect();
        if !(8..=15).contains(&digits.len()) {
            return None;
        }
        format!("+{}", digits)
    } else if let Some(stripped) = compact.strip_prefix("00") {
        let digits: String = stripped.chars().filter(|c| c.is_ascii_digit()).collect();
        if !(8..=15).contains(&digits.len()) {
            return None;
        }
        format!("+{}", digits)
    } else {
        let digits: String = compact.chars().filter(|c| c.is_ascii_digit()).collect();
        if !matches!(digits.len(), 9 | 10) || !digits.starts_with('3') {
            return None;
        }
        format!("+39{}", digits)
    };

    Some(normalized)
}

fn is_unique_violation(error: &sqlx::Error) -> bool {
    error
        .as_database_error()
        .and_then(|db_error| db_error.code())
        .is_some_and(|code| code == "23505")
}

/// Register a new user
pub async fn register(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<RegisterRequest>,
) -> Result<(StatusCode, Json<AuthResponse>), (StatusCode, axum::Json<crate::models::ApiError>)> {
    info!(email = %payload.email, "Registration attempt");

    if !is_valid_email(&payload.email) {
        warn!(email = %payload.email, "Registration rejected: invalid email format");
        return Err(crate::models::ApiError::new(
            StatusCode::BAD_REQUEST,
            "Formato email non valido",
        ));
    }

    if payload.password.len() < 8 {
        warn!(email = %payload.email, "Registration rejected: password too short");
        return Err(crate::models::ApiError::new(
            StatusCode::BAD_REQUEST,
            "La password deve essere di almeno 8 caratteri",
        ));
    }

    let normalized_phone_number = match normalize_phone_number(&payload.phone_number) {
        Some(phone_number) => phone_number,
        None => {
            return Err(ApiError::new(
                StatusCode::BAD_REQUEST,
                "Inserisci un numero di cellulare valido in formato internazionale",
            ))
        }
    };

    match user_persistence::find_user_by_email(&state.db_pool, &payload.email).await {
        Ok(Some(_)) => {
            warn!(email = %payload.email, "Registration rejected: email already exists");
            return Err(ApiError::new(
                StatusCode::CONFLICT,
                "Esiste già un account con questa email",
            ));
        }
        Ok(None) => {}
        Err(e) => {
            error!(error = %e, email = %payload.email, "DB error checking existing user");
            return Err(ApiError::new(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Errore interno",
            ));
        }
    }

    match user_persistence::find_user_by_phone(&state.db_pool, &normalized_phone_number).await {
        Ok(Some(_)) => {
            warn!(phone = %normalized_phone_number, "Registration rejected: phone already in use");
            return Err(ApiError::new(
                StatusCode::CONFLICT,
                "Esiste già un account con questo numero di telefono",
            ));
        }
        Ok(None) => {}
        Err(e) => {
            error!(error = %e, "DB error checking phone uniqueness");
            return Err(ApiError::new(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Errore interno",
            ));
        }
    }

    let password_hash = match hash(payload.password, DEFAULT_COST) {
        Ok(hash) => hash,
        Err(e) => {
            error!(error = %e, "Failed to hash password");
            return Err(ApiError::new(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Errore interno",
            ));
        }
    };

    let user = match user_persistence::create_user(
        &state.db_pool,
        payload.email.clone(),
        password_hash,
        payload.name,
        normalized_phone_number.clone(),
        payload.date_of_birth,
    )
    .await
    {
        Ok(user) => user,
        Err(e) => {
            error!(error = %e, email = %payload.email, "Failed to create user");
            return Err(ApiError::new(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Errore interno",
            ));
        }
    };

    let token = match jwt::generate_token(
        user.id,
        user.email.clone(),
        "phone_verification".to_string(),
        &state.jwt_secret,
    ) {
        Ok(token) => token,
        Err(e) => {
            error!(error = %e, user_id = %user.id, "Failed to generate JWT after registration");
            return Err(ApiError::new(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Errore interno",
            ));
        }
    };

    info!(user_id = %user.id, email = %user.email, "User registered successfully");

    let user_id = user.id;
    let email_domain = payload.email.split('@').nth(1).map(str::to_string);
    let response = AuthResponse {
        user: UserResponse::from(user),
        token,
    };

    let _ = outbox_service::enqueue_analytics_event(
        &state.db_pool,
        &state.config,
        "user_registered",
        Some(&user_id.to_string()),
        Some("user"),
        Some(user_id),
        serde_json::json!({
            "user_id": user_id,
            "email_domain": email_domain,
            "phone_provided": true,
            "outcome": "success",
        }),
    )
    .await;

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
            return Err(ApiError::new(
                StatusCode::UNAUTHORIZED,
                "Email o password non corretti",
            ));
        }
        Err(e) => {
            error!(error = %e, email = %payload.email, "DB error during login");
            return Err(ApiError::new(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Errore interno",
            ));
        }
    };

    let is_valid = match verify(payload.password, &user.password_hash) {
        Ok(valid) => valid,
        Err(e) => {
            error!(error = %e, user_id = %user.id, "bcrypt verify error");
            return Err(ApiError::new(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Errore interno",
            ));
        }
    };

    if !is_valid {
        warn!(email = %payload.email, "Login failed: wrong password");
        return Err(ApiError::new(
            StatusCode::UNAUTHORIZED,
            "Email o password non corretti",
        ));
    }

    if user.phone_number.is_some() && !user.phone_verified {
        warn!(email = %payload.email, "Login blocked: phone number not verified");
        return Err(ApiError::new(
            StatusCode::FORBIDDEN,
            "Verifica il numero di telefono prima di accedere",
        ));
    }

    let _ = user_persistence::update_last_login(&state.db_pool, user.id).await;

    let token = match jwt::generate_token(
        user.id,
        user.email.clone(),
        "user".to_string(),
        &state.jwt_secret,
    ) {
        Ok(token) => token,
        Err(e) => {
            error!(error = %e, user_id = %user.id, "Failed to generate JWT");
            return Err(ApiError::new(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Errore durante la generazione del token",
            ));
        }
    };

    info!(user_id = %user.id, email = %user.email, "Login successful");

    let _ = outbox_service::enqueue_analytics_event(
        &state.db_pool,
        &state.config,
        "user_logged_in",
        Some(&user.id.to_string()),
        Some("user"),
        Some(user.id),
        serde_json::json!({
            "user_id": user.id,
            "email_domain": user.email.split('@').nth(1),
            "outcome": "success",
        }),
    )
    .await;

    Ok(Json(AuthResponse {
        user: UserResponse::from(user),
        token,
    }))
}

#[derive(Debug, Deserialize)]
pub struct SendSmsRequest {
    phone_number: String,
}

#[derive(Debug, Serialize)]
pub struct SendSmsResponse {
    message: String,
}

#[derive(Debug, Deserialize)]
pub struct VerifySmsRequest {
    phone_number: String,
    verification_code: String,
}

#[derive(Debug, Serialize)]
pub struct VerifySmsResponse {
    message: String,
    verified: bool,
    user: Option<UserResponse>,
}

/// Register or update the Expo push token for the authenticated user.
///
/// Called by the frontend after login and whenever the token refreshes.
#[derive(Debug, Deserialize)]
pub struct RegisterPushTokenRequest {
    pub push_token: String,
}

#[derive(Debug, Deserialize)]
pub struct ChangePasswordRequest {
    pub current_password: String,
    pub new_password: String,
}

#[derive(Debug, Serialize)]
pub struct ChangePasswordResponse {
    pub message: String,
}

#[derive(Debug, Deserialize)]
pub struct DeleteAccountRequest {
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct DeleteAccountResponse {
    pub message: String,
}

pub async fn register_push_token(
    State(state): State<Arc<AppState>>,
    AuthUser(claims): AuthUser,
    body: Bytes,
) -> StatusCode {
    let user_id = match Uuid::parse_str(&claims.sub) {
        Ok(id) => id,
        Err(_) => return StatusCode::UNAUTHORIZED,
    };

    let payload = match parse_push_token_request(&body) {
        Ok(payload) => payload,
        Err(status) => return status,
    };

    match sqlx::query("UPDATE users SET expo_push_token = $1, updated_at = NOW() WHERE id = $2")
        .bind(&payload.push_token)
        .bind(user_id)
        .execute(&state.db_pool)
        .await
    {
        Ok(_) => {
            let _ = outbox_service::enqueue_analytics_event(
                &state.db_pool,
                &state.config,
                "push_token_registered",
                Some(&claims.sub),
                Some("user"),
                Some(user_id),
                serde_json::json!({
                    "user_id": user_id,
                    "push_token_length": payload.push_token.len(),
                    "outcome": "success",
                }),
            )
            .await;
            StatusCode::NO_CONTENT
        }
        Err(e) => {
            tracing::error!(error = %e, "Failed to save push token");
            StatusCode::INTERNAL_SERVER_ERROR
        }
    }
}

fn parse_push_token_request(body: &Bytes) -> Result<RegisterPushTokenRequest, StatusCode> {
    if body.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    if let Ok(payload) = serde_json::from_slice::<RegisterPushTokenRequest>(body) {
        return Ok(payload);
    }

    let raw_body = std::str::from_utf8(body)
        .map(str::trim)
        .map_err(|_| StatusCode::BAD_REQUEST)?;

    if raw_body.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    // Accept a raw Expo push token body as a fallback for clients that miss JSON headers.
    if raw_body.starts_with("ExponentPushToken[") || raw_body.starts_with("ExpoPushToken[") {
        return Ok(RegisterPushTokenRequest {
            push_token: raw_body.to_string(),
        });
    }

    Err(StatusCode::BAD_REQUEST)
}

pub async fn change_password(
    State(state): State<Arc<AppState>>,
    AuthUser(claims): AuthUser,
    Json(payload): Json<ChangePasswordRequest>,
) -> Result<Json<ChangePasswordResponse>, (StatusCode, axum::Json<crate::models::ApiError>)> {
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| ApiError::new(StatusCode::UNAUTHORIZED, "Sessione non valida"))?;

    if payload.current_password.trim().is_empty() {
        return Err(ApiError::new(
            StatusCode::BAD_REQUEST,
            "Inserisci la password attuale",
        ));
    }

    if payload.new_password.len() < 8 {
        return Err(ApiError::new(
            StatusCode::BAD_REQUEST,
            "La nuova password deve essere di almeno 8 caratteri",
        ));
    }

    if payload.current_password == payload.new_password {
        return Err(ApiError::new(
            StatusCode::BAD_REQUEST,
            "La nuova password deve essere diversa da quella attuale",
        ));
    }

    let user = match user_persistence::find_user_by_id(&state.db_pool, user_id).await {
        Ok(Some(user)) => user,
        Ok(None) => return Err(ApiError::new(StatusCode::NOT_FOUND, "Account non trovato")),
        Err(e) => {
            error!(error = %e, %user_id, "Failed to load user for password change");
            return Err(ApiError::new(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Errore interno",
            ));
        }
    };

    let is_valid = match verify(&payload.current_password, &user.password_hash) {
        Ok(valid) => valid,
        Err(e) => {
            error!(error = %e, %user_id, "bcrypt verify error during password change");
            return Err(ApiError::new(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Errore interno",
            ));
        }
    };

    if !is_valid {
        return Err(ApiError::new(
            StatusCode::UNAUTHORIZED,
            "Password attuale non corretta",
        ));
    }

    let new_password_hash = hash(payload.new_password, DEFAULT_COST).map_err(|e| {
        error!(error = %e, %user_id, "Failed to hash new password");
        ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Errore interno")
    })?;

    user_persistence::update_user_password_hash(&state.db_pool, user_id, &new_password_hash)
        .await
        .map_err(|e| {
            error!(error = %e, %user_id, "Failed to update password hash");
            ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Errore interno")
        })?;

    let _ = outbox_service::enqueue_analytics_event(
        &state.db_pool,
        &state.config,
        "password_changed",
        Some(&user_id.to_string()),
        Some("user"),
        Some(user_id),
        serde_json::json!({
            "user_id": user_id,
            "outcome": "success",
        }),
    )
    .await;

    info!(%user_id, "User password changed");

    Ok(Json(ChangePasswordResponse {
        message: "Password aggiornata correttamente.".to_string(),
    }))
}

pub async fn delete_account(
    State(state): State<Arc<AppState>>,
    AuthUser(claims): AuthUser,
    Json(payload): Json<DeleteAccountRequest>,
) -> Result<Json<DeleteAccountResponse>, (StatusCode, axum::Json<crate::models::ApiError>)> {
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| {
        crate::models::ApiError::new(StatusCode::UNAUTHORIZED, "Sessione non valida")
    })?;

    if payload.password.trim().is_empty() {
        return Err(crate::models::ApiError::new(
            StatusCode::BAD_REQUEST,
            "Inserisci la password per confermare l'eliminazione",
        ));
    }

    let user = match user_persistence::find_user_by_id(&state.db_pool, user_id).await {
        Ok(Some(user)) => user,
        Ok(None) => {
            return Err(crate::models::ApiError::new(
                StatusCode::NOT_FOUND,
                "Account non trovato",
            ))
        }
        Err(e) => {
            error!(error = %e, %user_id, "Failed to load user for account deletion");
            return Err(crate::models::ApiError::new(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Errore interno",
            ));
        }
    };

    let is_valid = match verify(payload.password.trim(), &user.password_hash) {
        Ok(valid) => valid,
        Err(e) => {
            error!(error = %e, %user_id, "bcrypt verify error during account deletion");
            return Err(crate::models::ApiError::new(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Errore interno",
            ));
        }
    };

    if !is_valid {
        return Err(crate::models::ApiError::new(
            StatusCode::UNAUTHORIZED,
            "Password non corretta",
        ));
    }

    let replacement_email = format!("deleted+{}@deleted.pierre.app", user_id.simple());
    let replacement_password_hash = hash(Uuid::new_v4().to_string(), DEFAULT_COST).map_err(|e| {
        error!(error = %e, %user_id, "Failed to hash replacement password for account deletion");
        crate::models::ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Errore interno")
    })?;

    user_persistence::anonymize_and_delete_user_account(
        &state.db_pool,
        user_id,
        &replacement_email,
        &replacement_password_hash,
    )
    .await
    .map_err(|e| {
        error!(error = %e, %user_id, "Failed to anonymize deleted account");
        crate::models::ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Errore interno")
    })?;

    let _ = outbox_service::enqueue_analytics_event(
        &state.db_pool,
        &state.config,
        "account_deleted",
        Some(&user_id.to_string()),
        Some("user"),
        Some(user_id),
        serde_json::json!({
            "user_id": user_id,
        }),
    )
    .await;

    info!(%user_id, "User account deleted and anonymized");

    Ok(Json(DeleteAccountResponse {
        message: "Il tuo account e i dati personali associati sono stati eliminati.".to_string(),
    }))
}

/// Send SMS verification code using Twilio Verify
pub async fn send_sms_verification(
    State(state): State<Arc<AppState>>,
    SmsVerificationUser(claims): SmsVerificationUser,
    Json(payload): Json<SendSmsRequest>,
) -> Result<Json<SendSmsResponse>, (StatusCode, Json<ApiError>)> {
    let user_uuid = Uuid::parse_str(&claims.sub)
        .map_err(|_| ApiError::new(StatusCode::UNAUTHORIZED, "Sessione non valida"))?;
    let normalized_phone_number =
        normalize_phone_number(&payload.phone_number).ok_or_else(|| {
            ApiError::new(
                StatusCode::BAD_REQUEST,
                "Inserisci un numero di cellulare valido in formato internazionale",
            )
        })?;

    match user_persistence::find_user_by_id(&state.db_pool, user_uuid).await {
        Ok(Some(existing_user)) => {
            if existing_user.phone_number.as_deref() != Some(normalized_phone_number.as_str()) {
                match user_persistence::find_user_by_phone(&state.db_pool, &normalized_phone_number)
                    .await
                {
                    Ok(Some(other_user)) if other_user.id != user_uuid => {
                        return Err(ApiError::new(
                            StatusCode::CONFLICT,
                            "Esiste già un account con questo numero di telefono",
                        ));
                    }
                    Ok(_) => {}
                    Err(error) => {
                        tracing::error!(error = %error, "DB error checking phone uniqueness before SMS send");
                        return Err(ApiError::new(
                            StatusCode::INTERNAL_SERVER_ERROR,
                            "Errore interno",
                        ));
                    }
                }
            }
        }
        Ok(None) => return Err(ApiError::new(StatusCode::NOT_FOUND, "Account non trovato")),
        Err(error) => {
            tracing::error!(error = %error, "DB error loading user before SMS send");
            return Err(ApiError::new(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Errore interno",
            ));
        }
    }

    // Send SMS using Twilio Verify API (Twilio generates and manages the code)
    match sms_service::send_verification_sms(&state.config, &normalized_phone_number).await {
        Ok(_) => {
            let _ = outbox_service::enqueue_analytics_event(
                &state.db_pool,
                &state.config,
                "sms_verification_sent",
                Some(&claims.sub),
                Some("user"),
                Some(user_uuid),
                serde_json::json!({
                    "user_id": user_uuid,
                    "phone_number": normalized_phone_number,
                    "outcome": "success",
                }),
            )
            .await;

            Ok(Json(SendSmsResponse {
                message: "Verification code sent successfully".to_string(),
            }))
        }
        Err(e) => {
            tracing::error!(error = %e, "SMS sending error");
            let _ = outbox_service::enqueue_analytics_error(
                &state.db_pool,
                &state.config,
                "sms_verification_send_failed",
                Some(&claims.sub),
                Some("user"),
                Some(user_uuid),
                &e.to_string(),
                serde_json::json!({
                    "user_id": user_uuid,
                }),
            )
            .await;
            Err(ApiError::new(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Impossibile inviare il codice di verifica",
            ))
        }
    }
}

/// Verify SMS code using Twilio Verify API
pub async fn verify_sms_code(
    State(state): State<Arc<AppState>>,
    SmsVerificationUser(claims): SmsVerificationUser,
    Json(payload): Json<VerifySmsRequest>,
) -> Result<Json<VerifySmsResponse>, (StatusCode, Json<ApiError>)> {
    let user_uuid = Uuid::parse_str(&claims.sub)
        .map_err(|_| ApiError::new(StatusCode::UNAUTHORIZED, "Sessione non valida"))?;
    let normalized_phone_number =
        normalize_phone_number(&payload.phone_number).ok_or_else(|| {
            ApiError::new(
                StatusCode::BAD_REQUEST,
                "Inserisci un numero di cellulare valido in formato internazionale",
            )
        })?;

    match user_persistence::find_user_by_phone(&state.db_pool, &normalized_phone_number).await {
        Ok(Some(other_user)) if other_user.id != user_uuid => {
            return Err(ApiError::new(
                StatusCode::CONFLICT,
                "Esiste già un account con questo numero di telefono",
            ));
        }
        Ok(_) => {}
        Err(error) => {
            tracing::error!(error = %error, "DB error checking phone uniqueness before SMS verify");
            return Err(ApiError::new(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Errore interno",
            ));
        }
    }

    // Verify the code using Twilio Verify API
    let is_valid = match sms_service::verify_code(
        &state.config,
        &normalized_phone_number,
        &payload.verification_code,
    )
    .await
    {
        Ok(valid) => valid,
        Err(e) => {
            tracing::error!(error = %e, "Twilio Verify error");
            let _ = outbox_service::enqueue_analytics_error(
                &state.db_pool,
                &state.config,
                "sms_verification_check_failed",
                Some(&claims.sub),
                Some("user"),
                Some(user_uuid),
                &e.to_string(),
                serde_json::json!({
                    "user_id": user_uuid,
                }),
            )
            .await;
            return Err(ApiError::new(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Errore durante la verifica del codice",
            ));
        }
    };

    if !is_valid {
        let _ = outbox_service::enqueue_analytics_event(
            &state.db_pool,
            &state.config,
            "sms_verification_invalid",
            Some(&claims.sub),
            Some("user"),
            Some(user_uuid),
            serde_json::json!({
                "user_id": user_uuid,
                "outcome": "invalid",
            }),
        )
        .await;
        return Ok(Json(VerifySmsResponse {
            message: "Invalid or expired verification code".to_string(),
            verified: false,
            user: None,
        }));
    }

    // Code is valid - update user's phone_verified status
    match sqlx::query_as::<_, User>(
        r#"
        UPDATE users
        SET phone_verified = TRUE, phone_number = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING id, email, password_hash, name, phone_number, phone_verified, avatar_url, date_of_birth, created_at, updated_at
        "#,
    )
    .bind(&normalized_phone_number)
    .bind(user_uuid)
    .fetch_one(&state.db_pool)
    .await
    {
        Ok(updated_user) => {
            let _ = outbox_service::enqueue_analytics_event(
                &state.db_pool,
                &state.config,
                "sms_verification_verified",
                Some(&claims.sub),
                Some("user"),
                Some(user_uuid),
                serde_json::json!({
                    "user_id": user_uuid,
                    "phone_number": normalized_phone_number,
                    "outcome": "success",
                }),
            )
            .await;
            Ok(Json(VerifySmsResponse {
                message: "Phone number verified successfully".to_string(),
                verified: true,
                user: Some(UserResponse::from(updated_user)),
            }))
        }
        Err(e) => {
            tracing::error!(error = %e, "Database error updating user phone verification");
            let _ = outbox_service::enqueue_analytics_error(
                &state.db_pool,
                &state.config,
                "sms_verification_persist_failed",
                Some(&claims.sub),
                Some("user"),
                Some(user_uuid),
                &e.to_string(),
                serde_json::json!({
                    "user_id": user_uuid,
                }),
            )
            .await;
            if is_unique_violation(&e) {
                Err(ApiError::new(
                    StatusCode::CONFLICT,
                    "Esiste già un account con questo numero di telefono",
                ))
            } else {
                Err(ApiError::new(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Errore interno",
                ))
            }
        }
    }
}
