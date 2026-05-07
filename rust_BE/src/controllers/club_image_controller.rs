use crate::application::club_service as club_persistence;
use crate::middleware::auth::ClubOwnerUser;
use crate::models::AppState;
use crate::services::storage_service;
use axum::{
    extract::{Multipart, State},
    http::StatusCode,
    Json,
};
use std::sync::Arc;
use uuid::Uuid;

/// Upload a logo image for a club.
/// Accepts multipart/form-data with a field named "file".
/// Returns { "url": "<public_url>" } on success.
pub async fn upload_club_image(
    ClubOwnerUser(claims): ClubOwnerUser,
    State(state): State<Arc<AppState>>,
    mut multipart: Multipart,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let (supabase_url, service_role_key) = match (
        state.config.storage.supabase_url.as_deref(),
        state.config.storage.supabase_service_role_key.as_deref(),
    ) {
        (Some(url), Some(key)) => (url.to_string(), key.to_string()),
        _ => {
            tracing::warn!("Supabase Storage non configurato (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY mancanti)");
            return Err(StatusCode::SERVICE_UNAVAILABLE);
        }
    };

    let owner_id = Uuid::parse_str(&claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;
    let club = club_persistence::get_club_by_owner_id(&state.db_pool, owner_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|_| StatusCode::BAD_REQUEST)?
    {
        let field_name = field.name().unwrap_or("").to_string();
        if field_name != "file" {
            continue;
        }

        let content_type = field.content_type().unwrap_or("image/jpeg").to_string();

        let bytes = field.bytes().await.map_err(|_| StatusCode::BAD_REQUEST)?;

        let url = storage_service::upload_image_to_bucket(
            &state.http_client,
            &supabase_url,
            &service_role_key,
            &state.config.storage.club_images_bucket,
            club.id,
            bytes,
            &content_type,
        )
        .await
        .map_err(|e| {
            tracing::warn!(error = %e, "Club image upload fallito");
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

        return Ok(Json(serde_json::json!({ "url": url })));
    }

    Err(StatusCode::BAD_REQUEST)
}
