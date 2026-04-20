use crate::application::ticket_service as ticket_persistence;
use crate::middleware::auth::ClubOwnerUser;
use crate::models::{
    AppState, CreateTicketRequest, PaginationParams, TicketResponse, TicketWithEventResponse,
    UpdateTicketRequest,
};
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::Serialize;
use std::sync::Arc;
use uuid::Uuid;

#[derive(Serialize)]
pub struct TicketsResponse {
    pub tickets: Vec<TicketResponse>,
}

#[derive(Serialize)]
pub struct TicketsWithEventsResponse {
    pub tickets: Vec<TicketWithEventResponse>,
}

/// Get all tickets (admin endpoint - paginated, default limit=50)
pub async fn get_all_tickets(
    _: ClubOwnerUser,
    State(state): State<Arc<AppState>>,
    Query(pagination): Query<PaginationParams>,
) -> Result<Json<TicketsResponse>, StatusCode> {
    match ticket_persistence::get_all_tickets(
        &state.read_db_pool,
        pagination.limit,
        pagination.offset,
    )
    .await
    {
        Ok(tickets) => {
            let responses: Vec<TicketResponse> = tickets.into_iter().map(|t| t.into()).collect();
            Ok(Json(TicketsResponse { tickets: responses }))
        }
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

/// Get tickets for a specific user with event details
pub async fn get_user_tickets_with_events(
    State(state): State<Arc<AppState>>,
    Path(user_id): Path<String>,
) -> Result<Json<TicketsWithEventsResponse>, StatusCode> {
    let user_uuid = Uuid::parse_str(&user_id).map_err(|_| StatusCode::BAD_REQUEST)?;

    let tickets =
        ticket_persistence::list_user_tickets_with_event_details(&state.read_db_pool, user_uuid)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(TicketsWithEventsResponse { tickets }))
}

/// Get a single ticket by ID
pub async fn get_ticket(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<TicketResponse>, StatusCode> {
    let ticket_id = Uuid::parse_str(&id).map_err(|_| StatusCode::BAD_REQUEST)?;

    match ticket_persistence::get_ticket_by_id(&state.read_db_pool, ticket_id).await {
        Ok(Some(ticket)) => Ok(Json(ticket.into())),
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

/// Get a ticket by ticket code
pub async fn get_ticket_by_code(
    State(state): State<Arc<AppState>>,
    Path(code): Path<String>,
) -> Result<Json<TicketResponse>, StatusCode> {
    match ticket_persistence::get_ticket_by_code(&state.read_db_pool, &code).await {
        Ok(Some(ticket)) => Ok(Json(ticket.into())),
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

/// Create a new ticket (requires club_owner JWT)
pub async fn create_ticket(
    _: ClubOwnerUser,
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateTicketRequest>,
) -> Result<(StatusCode, Json<TicketResponse>), StatusCode> {
    match ticket_persistence::create_ticket(&state.db_pool, payload).await {
        Ok(ticket) => Ok((StatusCode::CREATED, Json(ticket.into()))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

/// Update a ticket (requires club_owner JWT)
pub async fn update_ticket(
    _: ClubOwnerUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(payload): Json<UpdateTicketRequest>,
) -> Result<Json<TicketResponse>, StatusCode> {
    let ticket_id = Uuid::parse_str(&id).map_err(|_| StatusCode::BAD_REQUEST)?;

    match ticket_persistence::update_ticket(&state.db_pool, ticket_id, payload).await {
        Ok(Some(ticket)) => Ok(Json(ticket.into())),
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

/// Delete a ticket (requires club_owner JWT)
pub async fn delete_ticket(
    _: ClubOwnerUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<StatusCode, StatusCode> {
    let ticket_id = Uuid::parse_str(&id).map_err(|_| StatusCode::BAD_REQUEST)?;

    match ticket_persistence::delete_ticket(&state.db_pool, ticket_id).await {
        Ok(true) => Ok(StatusCode::NO_CONTENT),
        Ok(false) => Err(StatusCode::NOT_FOUND),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}
