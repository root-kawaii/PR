use axum::{
    extract::FromRequestParts,
    http::{request::Parts, StatusCode},
};
use crate::bootstrap::state::AppState;
use crate::models::Claims;
use crate::utils::jwt;
use std::sync::Arc;

/// Extractor that validates a JWT token from the Authorization header.
/// Accepts any valid token regardless of role.
pub struct AuthUser(pub Claims);

#[axum::async_trait]
impl FromRequestParts<Arc<AppState>> for AuthUser {
    type Rejection = StatusCode;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &Arc<AppState>,
    ) -> Result<Self, Self::Rejection> {
        let claims = extract_claims(parts, state)?;
        Ok(AuthUser(claims))
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
        let claims = extract_claims(parts, state)?;
        if claims.role != "club_owner" {
            return Err(StatusCode::FORBIDDEN);
        }
        Ok(ClubOwnerUser(claims))
    }
}

fn extract_claims(parts: &Parts, state: &Arc<AppState>) -> Result<Claims, StatusCode> {
    let auth_header = parts
        .headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .ok_or(StatusCode::UNAUTHORIZED)?;

    let token = auth_header
        .strip_prefix("Bearer ")
        .ok_or(StatusCode::UNAUTHORIZED)?;

    jwt::validate_token(token, &state.jwt_secret).map_err(|_| StatusCode::UNAUTHORIZED)
}
