use crate::models::{AppState, CreateTicketRequest, UpdateTicketRequest, TicketResponse, TicketWithEventResponse, EventSummary};
use crate::persistences::ticket_persistence;
use axum::{
    extract::{Path, State},
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

/// Get all tickets (admin endpoint - returns all tickets from all users)
pub async fn get_all_tickets(
    State(state): State<Arc<AppState>>,
) -> Result<Json<TicketsResponse>, StatusCode> {
    match ticket_persistence::get_all_tickets(&state.db_pool).await {
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

    match ticket_persistence::get_tickets_with_events_by_user_id(&state.db_pool, user_uuid).await {
        Ok(results) => {
            let tickets: Vec<TicketWithEventResponse> = results
                .into_iter()
                .map(|(ticket_id, event_id, _user_id, ticket_code, ticket_type, price, status, purchase_date, qr_code, _created_at, _updated_at, event_title, event_venue, event_date, event_image, event_status)| {
                    TicketWithEventResponse {
                        id: ticket_id.to_string(),
                        ticket_code,
                        ticket_type,
                        price: format!("{:.2} €", price),
                        status,
                        purchase_date: purchase_date.to_rfc3339(),
                        qr_code,
                        event: EventSummary {
                            id: event_id.to_string(),
                            title: event_title,
                            venue: event_venue,
                            date: event_date,
                            image: event_image,
                            status: event_status,
                        },
                    }
                })
                .collect();

            Ok(Json(TicketsWithEventsResponse { tickets }))
        }
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

/// Get a single ticket by ID
pub async fn get_ticket(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<TicketResponse>, StatusCode> {
    let ticket_id = Uuid::parse_str(&id).map_err(|_| StatusCode::BAD_REQUEST)?;

    match ticket_persistence::get_ticket_by_id(&state.db_pool, ticket_id).await {
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
    match ticket_persistence::get_ticket_by_code(&state.db_pool, &code).await {
        Ok(Some(ticket)) => Ok(Json(ticket.into())),
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

/// Create a new ticket
pub async fn create_ticket(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateTicketRequest>,
) -> Result<(StatusCode, Json<TicketResponse>), StatusCode> {
    match ticket_persistence::create_ticket(&state.db_pool, payload).await {
        Ok(ticket) => Ok((StatusCode::CREATED, Json(ticket.into()))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

/// Update a ticket
pub async fn update_ticket(
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

/// Delete a ticket
pub async fn delete_ticket(
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