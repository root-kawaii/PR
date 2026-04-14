use crate::models::{AppState, CreateEventRequest, UpdateEventRequest, EventResponse, PaginationParams};
use crate::application::event_service as event_persistence;
use crate::middleware::auth::ClubOwnerUser;
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::Serialize;
use std::sync::Arc;
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
    match event_persistence::get_all_events(&state.db_pool, pagination.limit, pagination.offset).await {
        Ok(events) => {
            let responses: Vec<EventResponse> = events.into_iter().map(|e| e.into()).collect();
            Ok(Json(EventsResponse { events: responses }))
        }
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

/// Get a single event by ID
pub async fn get_event(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<EventResponse>, StatusCode> {
    let event_id = Uuid::parse_str(&id).map_err(|_| StatusCode::BAD_REQUEST)?;

    match event_persistence::get_event_by_id(&state.db_pool, event_id).await {
        Ok(Some(event)) => Ok(Json(event.into())),
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
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
