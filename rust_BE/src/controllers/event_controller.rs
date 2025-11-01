// src/controllers/event_controller.rs (or wherever your handlers are)
use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use uuid::Uuid;
use std::sync::Arc;

use crate::persistences::event_persistence::{
    load_all_events_service,
    load_event_service,
    create_event_service,
    erase_event_service,
};
use crate::models::{EventEntity, EventRequest, AppState};

pub async fn get_all_events(
    State(app_state): State<Arc<AppState>>
) -> Result<Json<Vec<EventEntity>>, StatusCode> {
    let events = load_all_events_service(&app_state).await?;
    Ok(Json(events))
}

pub async fn get_events(
    Path(id): Path<Uuid>,
    State(app_state): State<Arc<AppState>>
) -> Result<Json<EventEntity>, StatusCode> {
    let event = load_event_service(id, &app_state).await?;
    Ok(Json(event))
}

pub async fn post_events(
    State(app_state): State<Arc<AppState>>,
    Json(payload): Json<EventRequest>
) -> Result<(StatusCode, Json<EventEntity>), StatusCode> {
    let event = create_event_service(payload, &app_state).await?;
    Ok((StatusCode::CREATED, Json(event)))
}

pub async fn delete_events(
    Path(id): Path<Uuid>,
    State(app_state): State<Arc<AppState>>
) -> StatusCode {
    match erase_event_service(id, &app_state).await {
        Ok(rows) if rows > 0 => StatusCode::NO_CONTENT,
        Ok(_) => StatusCode::NOT_FOUND,
        Err(e) => e,
    }
}