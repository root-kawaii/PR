use crate::models::{
    AppState, CreateTableRequest, UpdateTableRequest, TableResponse, TablesResponse,
    CreateTableReservationRequest, UpdateTableReservationRequest,
    TableReservationResponse, TableReservationWithDetailsResponse,
    TableReservationsResponse, TableReservationsWithDetailsResponse,
    AddPaymentToReservationRequest, LinkTicketToReservationRequest,
    TableSummary,
};
use crate::models::table::EventSummary as TableEventSummary;
use crate::persistences::table_persistence;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use std::sync::Arc;
use uuid::Uuid;
use rust_decimal::Decimal;

// ============================================================================
// Tables endpoints
// ============================================================================

/// Get all tables
pub async fn get_all_tables(
    State(state): State<Arc<AppState>>,
) -> Result<Json<TablesResponse>, StatusCode> {
    match table_persistence::get_all_tables(&state.db_pool).await {
        Ok(tables) => {
            let table_responses: Vec<TableResponse> = tables
                .into_iter()
                .map(|t| t.into())
                .collect();

            Ok(Json(TablesResponse {
                tables: table_responses,
            }))
        }
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

/// Get tables for an event
pub async fn get_tables_by_event(
    State(state): State<Arc<AppState>>,
    Path(event_id): Path<String>,
) -> Result<Json<TablesResponse>, StatusCode> {
    let event_uuid = Uuid::parse_str(&event_id).map_err(|_| StatusCode::BAD_REQUEST)?;

    match table_persistence::get_tables_by_event_id(&state.db_pool, event_uuid).await {
        Ok(tables) => {
            let table_responses: Vec<TableResponse> = tables
                .into_iter()
                .map(|t| t.into())
                .collect();

            Ok(Json(TablesResponse {
                tables: table_responses,
            }))
        }
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

/// Get available tables for an event
pub async fn get_available_tables_by_event(
    State(state): State<Arc<AppState>>,
    Path(event_id): Path<String>,
) -> Result<Json<TablesResponse>, StatusCode> {
    let event_uuid = Uuid::parse_str(&event_id).map_err(|_| StatusCode::BAD_REQUEST)?;

    match table_persistence::get_available_tables_by_event_id(&state.db_pool, event_uuid).await {
        Ok(tables) => {
            let table_responses: Vec<TableResponse> = tables
                .into_iter()
                .map(|t| t.into())
                .collect();

            Ok(Json(TablesResponse {
                tables: table_responses,
            }))
        }
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

/// Get a single table by ID
pub async fn get_table(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<TableResponse>, StatusCode> {
    let table_id = Uuid::parse_str(&id).map_err(|_| StatusCode::BAD_REQUEST)?;

    match table_persistence::get_table_by_id(&state.db_pool, table_id).await {
        Ok(table) => Ok(Json(table.into())),
        Err(sqlx::Error::RowNotFound) => Err(StatusCode::NOT_FOUND),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

/// Create a new table
pub async fn create_table(
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateTableRequest>,
) -> Result<Json<TableResponse>, StatusCode> {
    let event_id = Uuid::parse_str(&req.event_id).map_err(|_| StatusCode::BAD_REQUEST)?;
    let min_spend = Decimal::from_f64_retain(req.min_spend).ok_or(StatusCode::BAD_REQUEST)?;

    match table_persistence::create_table(
        &state.db_pool,
        event_id,
        req.name,
        req.zone,
        req.capacity,
        min_spend,
        req.location_description,
        req.features,
    )
    .await
    {
        Ok(table) => Ok(Json(table.into())),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

/// Update a table
pub async fn update_table(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(req): Json<UpdateTableRequest>,
) -> Result<Json<TableResponse>, StatusCode> {
    let table_id = Uuid::parse_str(&id).map_err(|_| StatusCode::BAD_REQUEST)?;

    let min_spend = if let Some(ms) = req.min_spend {
        Some(Decimal::from_f64_retain(ms).ok_or(StatusCode::BAD_REQUEST)?)
    } else {
        None
    };

    match table_persistence::update_table(
        &state.db_pool,
        table_id,
        req.name,
        req.zone,
        req.capacity,
        min_spend,
        req.available,
        req.location_description,
        req.features,
    )
    .await
    {
        Ok(table) => Ok(Json(table.into())),
        Err(sqlx::Error::RowNotFound) => Err(StatusCode::NOT_FOUND),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

/// Delete a table
pub async fn delete_table(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<StatusCode, StatusCode> {
    let table_id = Uuid::parse_str(&id).map_err(|_| StatusCode::BAD_REQUEST)?;

    match table_persistence::delete_table(&state.db_pool, table_id).await {
        Ok(true) => Ok(StatusCode::NO_CONTENT),
        Ok(false) => Err(StatusCode::NOT_FOUND),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

// ============================================================================
// Table Reservations endpoints
// ============================================================================

/// Get all reservations (admin)
pub async fn get_all_reservations(
    State(state): State<Arc<AppState>>,
) -> Result<Json<TableReservationsResponse>, StatusCode> {
    match table_persistence::get_all_reservations(&state.db_pool).await {
        Ok(reservations) => {
            let reservation_responses: Vec<TableReservationResponse> = reservations
                .into_iter()
                .map(|r| r.into())
                .collect();

            Ok(Json(TableReservationsResponse {
                reservations: reservation_responses,
            }))
        }
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

/// Get reservations for a user (with full details)
pub async fn get_user_reservations_with_details(
    State(state): State<Arc<AppState>>,
    Path(user_id): Path<String>,
) -> Result<Json<TableReservationsWithDetailsResponse>, StatusCode> {
    let user_uuid = Uuid::parse_str(&user_id).map_err(|_| StatusCode::BAD_REQUEST)?;

    match table_persistence::get_reservations_with_details_by_user_id(&state.db_pool, user_uuid).await {
        Ok(results) => {
            let reservations: Vec<TableReservationWithDetailsResponse> = results
                .into_iter()
                .map(|(
                    res_id, res_code, status, num_people, total_amount, amount_paid,
                    contact_name, contact_email, contact_phone, special_requests, created_at,
                    table_name, capacity, min_spend,
                    event_title, event_image
                )| {
                    let amount_remaining = total_amount - amount_paid;

                    TableReservationWithDetailsResponse {
                        id: res_id.to_string(),
                        reservation_code: res_code,
                        status,
                        num_people,
                        total_amount: format!("{:.2} €", total_amount),
                        amount_paid: format!("{:.2} €", amount_paid),
                        amount_remaining: format!("{:.2} €", amount_remaining),
                        contact_name,
                        contact_email,
                        contact_phone,
                        special_requests,
                        created_at: created_at.to_rfc3339(),
                        table: TableSummary {
                            id: String::new(),
                            name: table_name,
                            zone: None,
                            capacity,
                            min_spend: format!("{:.2} €", min_spend),
                            location_description: None,
                            features: None,
                        },
                        event: TableEventSummary {
                            id: String::new(),
                            title: event_title,
                            venue: String::new(),
                            date: String::new(),
                            image: event_image,
                        },
                    }
                })
                .collect();

            Ok(Json(TableReservationsWithDetailsResponse { reservations }))
        }
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

/// Get reservations by table ID
pub async fn get_reservations_by_table(
    State(state): State<Arc<AppState>>,
    Path(table_id): Path<String>,
) -> Result<Json<TableReservationsResponse>, StatusCode> {
    let table_uuid = Uuid::parse_str(&table_id).map_err(|_| StatusCode::BAD_REQUEST)?;

    match table_persistence::get_reservations_by_table_id(&state.db_pool, table_uuid).await {
        Ok(reservations) => {
            let reservation_responses: Vec<TableReservationResponse> = reservations
                .into_iter()
                .map(|r| r.into())
                .collect();

            Ok(Json(TableReservationsResponse {
                reservations: reservation_responses,
            }))
        }
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

/// Get a single reservation by ID
pub async fn get_reservation(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<TableReservationResponse>, StatusCode> {
    let reservation_id = Uuid::parse_str(&id).map_err(|_| StatusCode::BAD_REQUEST)?;

    match table_persistence::get_reservation_by_id(&state.db_pool, reservation_id).await {
        Ok(reservation) => Ok(Json(reservation.into())),
        Err(sqlx::Error::RowNotFound) => Err(StatusCode::NOT_FOUND),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

/// Get a reservation by code (with full details)
pub async fn get_reservation_by_code(
    State(state): State<Arc<AppState>>,
    Path(code): Path<String>,
) -> Result<Json<TableReservationWithDetailsResponse>, StatusCode> {
    match table_persistence::get_reservation_with_details_by_code(&state.db_pool, &code).await {
        Ok((reservation, table, (event_id, event_title, event_venue, event_date, event_image))) => {
            let amount_remaining = reservation.total_amount - reservation.amount_paid;

            Ok(Json(TableReservationWithDetailsResponse {
                id: reservation.id.to_string(),
                reservation_code: reservation.reservation_code,
                status: reservation.status,
                num_people: reservation.num_people,
                total_amount: format!("{:.2} €", reservation.total_amount),
                amount_paid: format!("{:.2} €", reservation.amount_paid),
                amount_remaining: format!("{:.2} €", amount_remaining),
                contact_name: reservation.contact_name,
                contact_email: reservation.contact_email,
                contact_phone: reservation.contact_phone,
                special_requests: reservation.special_requests,
                created_at: reservation.created_at.to_rfc3339(),
                table: TableSummary {
                    id: table.id.to_string(),
                    name: table.name,
                    zone: table.zone,
                    capacity: table.capacity,
                    min_spend: format!("{:.2} €", table.min_spend),
                    location_description: table.location_description,
                    features: table.features,
                },
                event: TableEventSummary {
                    id: event_id.to_string(),
                    title: event_title,
                    venue: event_venue,
                    date: event_date,
                    image: event_image,
                },
            }))
        }
        Err(sqlx::Error::RowNotFound) => Err(StatusCode::NOT_FOUND),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

/// Create a new reservation
pub async fn create_reservation(
    State(state): State<Arc<AppState>>,
    Path(user_id): Path<String>,
    Json(req): Json<CreateTableReservationRequest>,
) -> Result<Json<TableReservationResponse>, StatusCode> {
    let user_uuid = Uuid::parse_str(&user_id).map_err(|_| StatusCode::BAD_REQUEST)?;
    let table_id = Uuid::parse_str(&req.table_id).map_err(|_| StatusCode::BAD_REQUEST)?;
    let event_id = Uuid::parse_str(&req.event_id).map_err(|_| StatusCode::BAD_REQUEST)?;

    match table_persistence::create_reservation(
        &state.db_pool,
        table_id,
        user_uuid,
        event_id,
        req.num_people,
        req.contact_name,
        req.contact_email,
        req.contact_phone,
        req.special_requests,
    )
    .await
    {
        Ok(reservation) => Ok(Json(reservation.into())),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

/// Update a reservation
pub async fn update_reservation(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(req): Json<UpdateTableReservationRequest>,
) -> Result<Json<TableReservationResponse>, StatusCode> {
    let reservation_id = Uuid::parse_str(&id).map_err(|_| StatusCode::BAD_REQUEST)?;

    match table_persistence::update_reservation(
        &state.db_pool,
        reservation_id,
        req.status,
        req.num_people,
        req.contact_name,
        req.contact_email,
        req.contact_phone,
        req.special_requests,
    )
    .await
    {
        Ok(reservation) => Ok(Json(reservation.into())),
        Err(sqlx::Error::RowNotFound) => Err(StatusCode::NOT_FOUND),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

/// Delete a reservation
pub async fn delete_reservation(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<StatusCode, StatusCode> {
    let reservation_id = Uuid::parse_str(&id).map_err(|_| StatusCode::BAD_REQUEST)?;

    match table_persistence::delete_reservation(&state.db_pool, reservation_id).await {
        Ok(true) => Ok(StatusCode::NO_CONTENT),
        Ok(false) => Err(StatusCode::NOT_FOUND),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

// ============================================================================
// Payment and ticket linking endpoints
// ============================================================================

/// Add a payment to a reservation
pub async fn add_payment_to_reservation(
    State(state): State<Arc<AppState>>,
    Path(reservation_id): Path<String>,
    Json(req): Json<AddPaymentToReservationRequest>,
) -> Result<StatusCode, StatusCode> {
    let reservation_uuid = Uuid::parse_str(&reservation_id).map_err(|_| StatusCode::BAD_REQUEST)?;
    let payment_id = Uuid::parse_str(&req.payment_id).map_err(|_| StatusCode::BAD_REQUEST)?;
    let amount = Decimal::from_f64_retain(req.amount).ok_or(StatusCode::BAD_REQUEST)?;

    match table_persistence::add_payment_to_reservation(&state.db_pool, reservation_uuid, payment_id, amount).await {
        Ok(_) => Ok(StatusCode::OK),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

/// Link a ticket to a reservation
pub async fn link_ticket_to_reservation(
    State(state): State<Arc<AppState>>,
    Path(reservation_id): Path<String>,
    Json(req): Json<LinkTicketToReservationRequest>,
) -> Result<StatusCode, StatusCode> {
    let reservation_uuid = Uuid::parse_str(&reservation_id).map_err(|_| StatusCode::BAD_REQUEST)?;
    let ticket_id = Uuid::parse_str(&req.ticket_id).map_err(|_| StatusCode::BAD_REQUEST)?;

    match table_persistence::link_ticket_to_reservation(&state.db_pool, reservation_uuid, ticket_id).await {
        Ok(_) => Ok(StatusCode::OK),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

/// Get tickets for a reservation
pub async fn get_tickets_for_reservation(
    State(state): State<Arc<AppState>>,
    Path(reservation_id): Path<String>,
) -> Result<Json<Vec<String>>, StatusCode> {
    let reservation_uuid = Uuid::parse_str(&reservation_id).map_err(|_| StatusCode::BAD_REQUEST)?;

    match table_persistence::get_tickets_for_reservation(&state.db_pool, reservation_uuid).await {
        Ok(ticket_ids) => {
            let ticket_id_strings: Vec<String> = ticket_ids.iter().map(|id| id.to_string()).collect();
            Ok(Json(ticket_id_strings))
        }
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}