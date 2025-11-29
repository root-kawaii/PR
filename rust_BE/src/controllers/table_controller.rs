use crate::models::{
    AppState, CreateTableRequest, UpdateTableRequest, TableResponse, TablesResponse,
    CreateTableReservationRequest, UpdateTableReservationRequest, CreateReservationWithPaymentRequest,
    TableReservationResponse, TableReservationWithDetailsResponse,
    TableReservationsResponse, TableReservationsWithDetailsResponse,
    AddPaymentToReservationRequest, LinkTicketToReservationRequest,
    CreatePaymentIntentRequest, CreatePaymentIntentResponse,
    TableSummary, PaymentStatus, CreateTicketRequest,
};
use crate::models::table::EventSummary as TableEventSummary;
use crate::persistences::{table_persistence, user_persistence, ticket_persistence};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use std::sync::Arc;
use uuid::Uuid;
use rust_decimal::Decimal;
use rust_decimal::prelude::ToPrimitive;
use chrono::Utc;
use stripe::{CreatePaymentIntent, Currency, PaymentIntent};

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

    match table_persistence::add_ticket_to_reservation(&state.db_pool, reservation_uuid, ticket_id).await {
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

    // Get the reservation which contains ticket_ids array
    match table_persistence::get_reservation_by_id(&state.db_pool, reservation_uuid).await {
        Ok(reservation) => {
            let ticket_id_strings: Vec<String> = reservation.ticket_ids
                .unwrap_or_default()
                .iter()
                .map(|id| id.to_string())
                .collect();
            Ok(Json(ticket_id_strings))
        }
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

// ============================================================================
// Combined Stripe Payment + Reservation + Tickets Creation
// ============================================================================

/// Create Stripe PaymentIntent for table reservation
/// This endpoint:
/// 1. Looks up guest users by phone numbers
/// 2. Gets table and calculates total amount
/// 3. Creates PaymentIntent on Stripe
/// 4. Returns client_secret for frontend to complete payment
pub async fn create_payment_intent(
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreatePaymentIntentRequest>,
) -> Result<Json<CreatePaymentIntentResponse>, (StatusCode, String)> {
    // Parse UUIDs
    let table_id = Uuid::parse_str(&req.table_id).map_err(|_| (StatusCode::BAD_REQUEST, "ID tavolo non valido".to_string()))?;
    let event_id = Uuid::parse_str(&req.event_id).map_err(|_| (StatusCode::BAD_REQUEST, "ID evento non valido".to_string()))?;
    let owner_user_id = Uuid::parse_str(&req.owner_user_id).map_err(|_| (StatusCode::BAD_REQUEST, "ID utente non valido".to_string()))?;

    // Step 1: Look up guest users by phone numbers to validate they exist
    let mut guest_user_ids: Vec<Uuid> = Vec::new();
    for phone in &req.guest_phone_numbers {
        match user_persistence::find_user_by_phone(&state.db_pool, phone).await {
            Ok(Some(user)) => guest_user_ids.push(user.id),
            Ok(None) => {
                let error_msg = format!("Utente non trovato per il numero di telefono: {}", phone);
                eprintln!("{}", error_msg);
                return Err((StatusCode::BAD_REQUEST, error_msg));
            }
            Err(e) => {
                eprintln!("Database error looking up user: {}", e);
                return Err((StatusCode::INTERNAL_SERVER_ERROR, "Errore del database".to_string()));
            }
        }
    }

    // Step 2: Get table to calculate payment amount
    let table = match table_persistence::get_table_by_id(&state.db_pool, table_id).await {
        Ok(t) => t,
        Err(_) => return Err((StatusCode::NOT_FOUND, "Tavolo non trovato".to_string())),
    };

    // Calculate total amount: min_spend × (owner + guests)
    let total_users = 1 + guest_user_ids.len();
    let total_amount = table.min_spend * Decimal::from(total_users as i32);

    // Step 3: Create PaymentIntent on Stripe
    // Convert amount from euros to cents (Stripe expects cents)
    let amount_in_cents = total_amount.to_f64()
        .ok_or_else(|| {
            eprintln!("Invalid amount: {}", total_amount);
            (StatusCode::INTERNAL_SERVER_ERROR, "Importo non valido".to_string())
        })? * 100.0;

    let mut params = CreatePaymentIntent::new(amount_in_cents as i64, Currency::EUR);
    params.automatic_payment_methods = Some(
        stripe::CreatePaymentIntentAutomaticPaymentMethods {
            enabled: true,
            allow_redirects: None,
        },
    );

    // Add metadata to track the reservation details in Stripe
    params.metadata = Some(
        [
            ("table_id".to_string(), table_id.to_string()),
            ("event_id".to_string(), event_id.to_string()),
            ("owner_user_id".to_string(), owner_user_id.to_string()),
            ("num_guests".to_string(), guest_user_ids.len().to_string()),
        ]
        .into_iter()
        .collect(),
    );

    // Create the payment intent on Stripe
    let payment_intent = PaymentIntent::create(&state.stripe_client, params)
        .await
        .map_err(|e| {
            eprintln!("Stripe API error: {:?}", e);
            (StatusCode::BAD_GATEWAY, "Errore del servizio di pagamento".to_string())
        })?;

    println!("✅ Stripe Payment Intent created: {}", payment_intent.id);
    println!("   Amount: {} cents", amount_in_cents as i64);

    // Step 4: Return client_secret to frontend
    let client_secret = payment_intent.client_secret
        .ok_or_else(|| {
            eprintln!("No client_secret in PaymentIntent response");
            (StatusCode::INTERNAL_SERVER_ERROR, "Risposta di pagamento non valida".to_string())
        })?;

    Ok(Json(CreatePaymentIntentResponse {
        client_secret,
        payment_intent_id: payment_intent.id.to_string(),
        amount: format!("{:.2} €", total_amount),
    }))
}

/// Create table reservation with payment and tickets in a single transaction
/// This endpoint:
/// 1. Looks up guest users by phone numbers
/// 2. Validates payment amount
/// 3. Creates payment record with Stripe payment intent ID
/// 4. Creates table reservation with all users
/// 5. Creates tickets for all users (owner + guests)
/// 6. Links everything together using array fields
pub async fn create_reservation_with_payment(
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateReservationWithPaymentRequest>,
) -> Result<Json<TableReservationResponse>, StatusCode> {
    // Parse UUIDs
    let table_id = Uuid::parse_str(&req.table_id).map_err(|_| StatusCode::BAD_REQUEST)?;
    let event_id = Uuid::parse_str(&req.event_id).map_err(|_| StatusCode::BAD_REQUEST)?;
    let owner_user_id = Uuid::parse_str(&req.owner_user_id).map_err(|_| StatusCode::BAD_REQUEST)?;

    // Step 1: Look up guest users by phone numbers
    let mut guest_user_ids: Vec<Uuid> = Vec::new();
    for phone in &req.guest_phone_numbers {
        match user_persistence::find_user_by_phone(&state.db_pool, phone).await {
            Ok(Some(user)) => guest_user_ids.push(user.id),
            Ok(None) => {
                eprintln!("User not found for phone: {}", phone);
                return Err(StatusCode::BAD_REQUEST); // User not found
            }
            Err(e) => {
                eprintln!("Database error looking up user: {}", e);
                return Err(StatusCode::INTERNAL_SERVER_ERROR);
            }
        }
    }

    // Step 2: Get table to validate payment amount
    let table = match table_persistence::get_table_by_id(&state.db_pool, table_id).await {
        Ok(t) => t,
        Err(_) => return Err(StatusCode::NOT_FOUND),
    };

    let total_users = 1 + guest_user_ids.len(); // owner + guests
    let expected_amount = table.min_spend * Decimal::from(total_users as i32);
    let payment_amount = Decimal::from_f64_retain(req.payment_amount).ok_or(StatusCode::BAD_REQUEST)?;

    if payment_amount != expected_amount {
        eprintln!("Payment amount mismatch: expected {}, got {}", expected_amount, payment_amount);
        return Err(StatusCode::BAD_REQUEST);
    }

    // Step 3: Create payment record
    let payment_id = Uuid::new_v4();
    let mut all_user_ids = vec![owner_user_id];
    all_user_ids.extend(&guest_user_ids);

    let payment_result = sqlx::query(
        r#"
        INSERT INTO payments (id, sender_id, receiver_id, amount, status, insert_date, update_date, stripe_payment_intent_id, user_ids)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        "#
    )
    .bind(payment_id)
    .bind(owner_user_id)
    .bind(owner_user_id) // receiver_id (same as sender for now)
    .bind(payment_amount)
    .bind(PaymentStatus::Pending)
    .bind(Utc::now().naive_utc())
    .bind(Utc::now().naive_utc())
    .bind(&req.stripe_payment_intent_id)
    .bind(&all_user_ids)
    .execute(&state.db_pool)
    .await;

    if let Err(e) = payment_result {
        eprintln!("Failed to create payment: {}", e);
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    // Step 4: Create table reservation
    let reservation = match table_persistence::create_reservation(
        &state.db_pool,
        table_id,
        owner_user_id,
        event_id,
        total_users as i32,
        req.contact_name,
        req.contact_email,
        req.contact_phone,
        req.special_requests,
    ).await {
        Ok(r) => r,
        Err(e) => {
            eprintln!("Failed to create reservation: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    // Step 5: Add payment to reservation and update amount_paid
    if let Err(e) = table_persistence::add_payment_to_reservation(
        &state.db_pool,
        reservation.id,
        payment_id,
        payment_amount,
    ).await {
        eprintln!("Failed to add payment to reservation: {}", e);
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    // Step 6: Add guest users to reservation
    for guest_id in &guest_user_ids {
        if let Err(e) = table_persistence::add_guest_to_reservation(
            &state.db_pool,
            reservation.id,
            *guest_id,
        ).await {
            eprintln!("Failed to add guest to reservation: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    }

    // Step 7: Create tickets for all users (owner + guests)
    let mut ticket_ids: Vec<Uuid> = Vec::new();
    for user_id in &all_user_ids {
        let ticket_request = CreateTicketRequest {
            event_id,
            user_id: *user_id,
            ticket_type: "table".to_string(),
            price: table.min_spend,
            status: Some("active".to_string()),
            qr_code: None,
        };

        match ticket_persistence::create_ticket(&state.db_pool, ticket_request).await {
            Ok(ticket) => ticket_ids.push(ticket.id),
            Err(e) => {
                eprintln!("Failed to create ticket: {}", e);
                return Err(StatusCode::INTERNAL_SERVER_ERROR);
            }
        }
    }

    // Step 8: Link tickets to reservation
    for ticket_id in &ticket_ids {
        if let Err(e) = table_persistence::add_ticket_to_reservation(
            &state.db_pool,
            reservation.id,
            *ticket_id,
        ).await {
            eprintln!("Failed to link ticket to reservation: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    }

    // Step 9: Update payment status to completed (after Stripe confirmation)
    // In production, this should be done via Stripe webhook
    if let Err(e) = sqlx::query(
        r#"
        UPDATE payments
        SET status = $1, update_date = $2
        WHERE id = $3
        "#
    )
    .bind(PaymentStatus::Completed)
    .bind(Utc::now().naive_utc())
    .bind(payment_id)
    .execute(&state.db_pool)
    .await {
        eprintln!("Failed to update payment status: {}", e);
        // Don't fail the whole request, just log the error
    }

    // Step 10: Fetch the updated reservation and return
    match table_persistence::get_reservation_by_id(&state.db_pool, reservation.id).await {
        Ok(final_reservation) => Ok(Json(final_reservation.into())),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}