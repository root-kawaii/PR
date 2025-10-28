// src/handlers.rs

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use uuid::Uuid;

use crate::services::event_service::{
    load_all_events_service,
    load_event_service,
    create_event_service,
    erase_event_service,
};

// Import from your own modules
use crate::models::{EventEntity, EventRequest, AppState};

// Mark functions as public
pub async fn get_all_events(State(pool): State<AppState>) -> Result<Json<Vec<EventEntity>>, StatusCode> {
    let events = load_all_events_service(&pool).await?;
    Ok(Json(events))
}

pub async fn get_events(Path(id): Path<Uuid>, State(pool): State<AppState>) -> Result<Json<EventEntity>, StatusCode> {
    let event = load_event_service(id, &pool).await?;
    Ok(Json(event))
}

pub async fn post_events(State(pool): State<AppState>, Json(payload): Json<EventRequest>) -> Result<(StatusCode, Json<EventEntity>), StatusCode> {
    let event = create_event_service(payload, &pool).await?;
    Ok((StatusCode::CREATED, Json(event)))
}

pub async fn delete_events(Path(id): Path<Uuid>, State(pool): State<AppState>) -> StatusCode {
    match erase_event_service(id, &pool).await {
        Ok(rows) if rows > 0 => StatusCode::NO_CONTENT,
        Ok(_) => StatusCode::NOT_FOUND,
        Err(e) => e,
    }
}
