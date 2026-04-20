use crate::application::event_service as event_persistence;
use crate::application::outbox_service;
use crate::middleware::auth::ClubOwnerUser;
use crate::models::{
    AppState, CreateEventRequest, EventResponse, PaginationParams, UpdateEventRequest,
};
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::Serialize;
use std::sync::Arc;
use tracing::warn;
use uuid::Uuid;

#[derive(Serialize)]
pub struct EventsResponse {
    pub events: Vec<EventResponse>,
}

/// Get all events (paginated, default limit=50)
pub async fn get_all_events(
    State(state): State<Arc<AppState>>,
    Query(pagination): Query<PaginationParams>,
) -> Result<Json<EventsResponse>, StatusCode> {
    match event_persistence::get_all_events(
        &state.read_db_pool,
        pagination.limit,
        pagination.offset,
    )
    .await
    {
        Ok(events) => {
            if let Err(error) = outbox_service::enqueue_analytics_event(
                &state.db_pool,
                &state.config,
                "events_list_viewed",
                None,
                Some("event"),
                None,
                serde_json::json!({
                    "limit": pagination.limit,
                    "offset": pagination.offset,
                    "result_count": events.len(),
                    "outcome": "success",
                }),
            )
            .await
            {
                warn!(error = %error, "Failed to enqueue events list analytics event");
            }
            let responses: Vec<EventResponse> = events.into_iter().map(|e| e.into()).collect();
            Ok(Json(EventsResponse { events: responses }))
        }
        Err(error) => {
            let _ = outbox_service::enqueue_analytics_error(
                &state.db_pool,
                &state.config,
                "events_list_view_failed",
                None,
                Some("event"),
                None,
                &error.to_string(),
                serde_json::json!({
                    "limit": pagination.limit,
                    "offset": pagination.offset,
                }),
            )
            .await;
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Get a single event by ID
pub async fn get_event(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<EventResponse>, StatusCode> {
    let event_id = Uuid::parse_str(&id).map_err(|_| StatusCode::BAD_REQUEST)?;

    match event_persistence::get_event_by_id(&state.read_db_pool, event_id).await {
        Ok(Some(event)) => {
            if let Err(error) = outbox_service::enqueue_analytics_event(
                &state.db_pool,
                &state.config,
                "event_detail_viewed",
                None,
                Some("event"),
                Some(event_id),
                serde_json::json!({
                    "event_id": event_id,
                    "outcome": "success",
                }),
            )
            .await
            {
                warn!(error = %error, event_id = %event_id, "Failed to enqueue event detail analytics event");
            }
            Ok(Json(event.into()))
        }
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(error) => {
            let _ = outbox_service::enqueue_analytics_error(
                &state.db_pool,
                &state.config,
                "event_detail_view_failed",
                None,
                Some("event"),
                Some(event_id),
                &error.to_string(),
                serde_json::json!({
                    "event_id": event_id,
                }),
            )
            .await;
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Create a new event (requires club_owner JWT)
pub async fn create_event(
    _: ClubOwnerUser,
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateEventRequest>,
) -> Result<(StatusCode, Json<EventResponse>), StatusCode> {
    match event_persistence::create_event(&state.db_pool, payload).await {
        Ok(event) => Ok((StatusCode::CREATED, Json(event.into()))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

/// Update an event (requires club_owner JWT)
pub async fn update_event(
    _: ClubOwnerUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(payload): Json<UpdateEventRequest>,
) -> Result<Json<EventResponse>, StatusCode> {
    let event_id = Uuid::parse_str(&id).map_err(|_| StatusCode::BAD_REQUEST)?;

    match event_persistence::update_event(&state.db_pool, event_id, payload).await {
        Ok(Some(event)) => Ok(Json(event.into())),
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

/// Delete an event (requires club_owner JWT)
pub async fn delete_event(
    _: ClubOwnerUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<StatusCode, StatusCode> {
    let event_id = Uuid::parse_str(&id).map_err(|_| StatusCode::BAD_REQUEST)?;

    match event_persistence::delete_event(&state.db_pool, event_id).await {
        Ok(true) => Ok(StatusCode::NO_CONTENT),
        Ok(false) => Err(StatusCode::NOT_FOUND),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}
