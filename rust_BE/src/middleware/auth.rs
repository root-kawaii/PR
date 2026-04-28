use crate::bootstrap::state::AppState;
use crate::models::Claims;
use crate::utils::jwt;
use axum::{
    extract::FromRequestParts,
    http::{request::Parts, StatusCode},
};
use std::sync::Arc;
use uuid::Uuid;

/// Extractor that validates a JWT token from the Authorization header.
/// Accepts only fully authenticated user tokens.
pub struct AuthUser(pub Claims);

#[axum::async_trait]
impl FromRequestParts<Arc<AppState>> for AuthUser {
    type Rejection = StatusCode;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &Arc<AppState>,
    ) -> Result<Self, Self::Rejection> {
        let claims = extract_claims(parts, state).await?;
        if claims.role != "user" {
            return Err(StatusCode::FORBIDDEN);
        }
        Ok(AuthUser(claims))
    }
}

/// Extractor for SMS verification flows.
/// Accepts either a fully authenticated user token or a pending phone verification token.
pub struct SmsVerificationUser(pub Claims);

#[axum::async_trait]
impl FromRequestParts<Arc<AppState>> for SmsVerificationUser {
    type Rejection = StatusCode;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &Arc<AppState>,
    ) -> Result<Self, Self::Rejection> {
        let claims = extract_claims(parts, state).await?;
        if !matches!(claims.role.as_str(), "user" | "phone_verification") {
            return Err(StatusCode::FORBIDDEN);
        }
        Ok(SmsVerificationUser(claims))
    }
}

/// Extractor that validates a JWT token and requires role == "club_owner".
pub struct ClubOwnerUser(pub Claims);

#[axum::async_trait]
impl FromRequestParts<Arc<AppState>> for ClubOwnerUser {
    type Rejection = StatusCode;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &Arc<AppState>,
    ) -> Result<Self, Self::Rejection> {
        let claims = extract_claims(parts, state).await?;
        if claims.role != "club_owner" {
            return Err(StatusCode::FORBIDDEN);
        }
        Ok(ClubOwnerUser(claims))
    }
}

async fn extract_claims(parts: &Parts, state: &Arc<AppState>) -> Result<Claims, StatusCode> {
    let auth_header = parts
        .headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .ok_or(StatusCode::UNAUTHORIZED)?;

    let token = auth_header
        .strip_prefix("Bearer ")
        .ok_or(StatusCode::UNAUTHORIZED)?;

    let claims =
        jwt::validate_token(token, &state.jwt_secret).map_err(|_| StatusCode::UNAUTHORIZED)?;

    if matches!(claims.role.as_str(), "user" | "phone_verification") {
        let user_id = Uuid::parse_str(&claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;
        let is_active = crate::application::auth_service::user_is_active(&state.db_pool, user_id)
            .await
            .map_err(|_| StatusCode::UNAUTHORIZED)?;

        if !is_active {
            return Err(StatusCode::UNAUTHORIZED);
        }
    }

    Ok(claims)
}
