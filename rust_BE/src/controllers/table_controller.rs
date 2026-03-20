use crate::models::{
    AppState, CreateTableRequest, UpdateTableRequest, TableResponse, TablesResponse,
    CreateTableReservationRequest, UpdateTableReservationRequest,
    TableReservationResponse, TableReservationWithDetailsResponse,
    TableReservationsResponse, TableReservationsWithDetailsResponse,
    AddPaymentToReservationRequest, LinkTicketToReservationRequest,
    CreatePaymentIntentResponse,
    CreateSplitPaymentIntentRequest, CreateSplitReservationRequest, CreateSplitReservationResponse,
    PaymentShareResponse, PaymentLinkPreviewResponse,
    VerifyPaymentLinkRequest, VerifyPaymentLinkResponse,
    CreateCheckoutRequest, CreateCheckoutResponse,
    AddFreeGuestRequest, FreeGuestResponse, ReservationPaymentStatusResponse,
    TableSummary, PaymentStatus, PaymentCaptureMethod, EventSummary,
};
use crate::persistences::{table_persistence, user_persistence};
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
use stripe::{CreatePaymentIntent, CreateCustomer, Currency, Customer, PaymentIntent, PaymentIntentCaptureMethod, PaymentIntentSetupFutureUsage, PaymentIntentStatus};
use jsonwebtoken::{encode, decode, Header, Validation, EncodingKey, DecodingKey};

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
        req.marzipano_position,
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
        req.marzipano_position,
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

    // Fetch reservations with table details
    let reservation_results = match table_persistence::get_reservations_with_details_by_user_id(&state.db_pool, user_uuid).await {
        Ok(results) => results,
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };

    // Get all reservation IDs to fetch event details
    let reservation_ids: Vec<Uuid> = reservation_results.iter().map(|r| r.0).collect();

    // Fetch event details for all reservations
    let event_results = match table_persistence::get_event_details_by_reservation_ids(&state.db_pool, reservation_ids).await {
        Ok(results) => results,
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };

    // Create a hashmap for quick event lookup by reservation_id
    use std::collections::HashMap;
    let event_map: HashMap<Uuid, (Uuid, String, String, String, String)> = event_results
        .into_iter()
        .map(|(res_id, event_id, title, venue, date, image)| {
            (res_id, (event_id, title, venue, date, image))
        })
        .collect();

    // Combine reservation + table data with event data
    let reservations: Vec<TableReservationWithDetailsResponse> = reservation_results
        .into_iter()
        .map(|(
            res_id, res_code, status, num_people, total_amount, amount_paid,
            contact_name, contact_email, contact_phone, special_requests, created_at,
            table_id, table_name, table_zone, capacity, min_spend
        )| {
            let amount_remaining = total_amount - amount_paid;

            // Look up event data for this reservation
            let (event_id, event_title, event_venue, event_date, event_image) = event_map
                .get(&res_id)
                .cloned()
                .unwrap_or_else(|| (
                    Uuid::nil(),
                    String::from("Unknown Event"),
                    String::new(),
                    String::new(),
                    String::new(),
                ));

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
                    id: table_id.to_string(),
                    name: table_name,
                    zone: table_zone,
                    capacity,
                    min_spend: format!("{:.2} €", min_spend),
                    location_description: None,
                    features: None,
                },
                event: EventSummary {
                    id: event_id.to_string(),
                    title: event_title,
                    venue: event_venue,
                    date: event_date,
                    image: event_image,
                    status: None,
                },
            }
        })
        .collect();

    Ok(Json(TableReservationsWithDetailsResponse { reservations }))
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
                event: EventSummary {
                    id: event_id.to_string(),
                    title: event_title,
                    venue: event_venue,
                    date: event_date,
                    image: event_image,
                    status: None,
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

/// Create Stripe PaymentIntent for table reservation (split payment - owner's share only)
/// Uses the table's fixed total_cost, split among num_paying_guests.
/// The owner pays their share via this PaymentIntent.
pub async fn create_payment_intent(
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateSplitPaymentIntentRequest>,
) -> Result<Json<CreatePaymentIntentResponse>, (StatusCode, String)> {
    let table_id = Uuid::parse_str(&req.table_id).map_err(|_| (StatusCode::BAD_REQUEST, "ID tavolo non valido".to_string()))?;
    let event_id = Uuid::parse_str(&req.event_id).map_err(|_| (StatusCode::BAD_REQUEST, "ID evento non valido".to_string()))?;
    let owner_user_id = Uuid::parse_str(&req.owner_user_id).map_err(|_| (StatusCode::BAD_REQUEST, "ID utente non valido".to_string()))?;

    if req.num_paying_guests < 1 {
        return Err((StatusCode::BAD_REQUEST, "Almeno una persona deve pagare".to_string()));
    }

    // Validate paying guest phone numbers count matches num_paying_guests - 1 (owner is one of them)
    if req.paying_guest_phone_numbers.len() != (req.num_paying_guests - 1) as usize {
        return Err((StatusCode::BAD_REQUEST, "Il numero di telefoni degli ospiti paganti non corrisponde".to_string()));
    }

    // Get table to use fixed total_cost
    let table = match table_persistence::get_table_by_id(&state.db_pool, table_id).await {
        Ok(t) => t,
        Err(_) => return Err((StatusCode::NOT_FOUND, "Tavolo non trovato".to_string())),
    };

    let total_cost = table.total_cost;
    let num_paying = Decimal::from(req.num_paying_guests);

    // Calculate per-person share (floor to 2 decimal places)
    let per_person = (total_cost / num_paying).round_dp(2);
    // Owner pays the remainder to handle rounding
    let owner_share = total_cost - (per_person * Decimal::from(req.num_paying_guests - 1));

    // Get or create a Stripe Customer for this user (needed for off-session re-auth)
    let owner_user = match user_persistence::find_user_by_id(&state.db_pool, owner_user_id).await {
        Ok(Some(u)) => u,
        Ok(None) => return Err((StatusCode::NOT_FOUND, "Utente non trovato".to_string())),
        Err(_) => return Err((StatusCode::INTERNAL_SERVER_ERROR, "Errore del database".to_string())),
    };

    let mut customer_params = CreateCustomer::new();
    customer_params.email = Some(&owner_user.email);
    customer_params.metadata = Some(
        [("user_id".to_string(), owner_user_id.to_string())]
            .into_iter()
            .collect(),
    );
    let stripe_customer = Customer::create(&state.stripe_client, customer_params)
        .await
        .map_err(|e| {
            eprintln!("Stripe Customer create error: {:?}", e);
            (StatusCode::BAD_GATEWAY, "Errore creazione cliente".to_string())
        })?;

    // Create Stripe PaymentIntent for owner's share with manual capture + saved payment method
    let amount_in_cents = owner_share.to_f64()
        .ok_or_else(|| {
            eprintln!("Invalid amount: {}", owner_share);
            (StatusCode::INTERNAL_SERVER_ERROR, "Importo non valido".to_string())
        })? * 100.0;

    let mut params = CreatePaymentIntent::new(amount_in_cents as i64, Currency::EUR);

    // Manual capture: authorize now, charge the day before the event
    params.capture_method = Some(PaymentIntentCaptureMethod::Manual);

    // Save the payment method to the customer for future off-session re-authorization
    params.setup_future_usage = Some(PaymentIntentSetupFutureUsage::OffSession);

    // Attach the Stripe customer
    params.customer = Some(stripe_customer.id.clone());

    params.automatic_payment_methods = Some(
        stripe::CreatePaymentIntentAutomaticPaymentMethods {
            enabled: true,
            allow_redirects: None,
        },
    );

    params.metadata = Some(
        [
            ("table_id".to_string(), table_id.to_string()),
            ("event_id".to_string(), event_id.to_string()),
            ("owner_user_id".to_string(), owner_user_id.to_string()),
            ("split_payment".to_string(), "true".to_string()),
            ("num_paying_guests".to_string(), req.num_paying_guests.to_string()),
            ("total_cost".to_string(), total_cost.to_string()),
        ]
        .into_iter()
        .collect(),
    );

    let payment_intent = PaymentIntent::create(&state.stripe_client, params)
        .await
        .map_err(|e| {
            eprintln!("Stripe API error: {:?}", e);
            (StatusCode::BAD_GATEWAY, "Errore del servizio di pagamento".to_string())
        })?;

    println!("✅ Split Payment Intent created: {}", payment_intent.id);
    println!("   Owner share: {} cents (total: {}) | Customer: {}", amount_in_cents as i64, total_cost, stripe_customer.id);

    let client_secret = payment_intent.client_secret
        .ok_or_else(|| {
            eprintln!("No client_secret in PaymentIntent response");
            (StatusCode::INTERNAL_SERVER_ERROR, "Risposta di pagamento non valida".to_string())
        })?;

    Ok(Json(CreatePaymentIntentResponse {
        client_secret,
        payment_intent_id: payment_intent.id.to_string(),
        amount: format!("{:.2} €", owner_share),
        total_cost: Some(format!("{:.2} €", total_cost)),
        per_person_amount: Some(format!("{:.2} €", per_person)),
        owner_share: Some(format!("{:.2} €", owner_share)),
    }))
}

/// Create table reservation with split payment in a single transaction
/// This endpoint:
/// 1. Verifies the owner's PaymentIntent (for their share only)
/// 2. Creates payment record + reservation
/// 3. Creates owner's payment share (paid) + pending shares for other paying guests
/// 4. Creates ticket for owner only (guests get tickets when they pay)
/// 5. Optionally adds free guests
pub async fn create_reservation_with_payment(
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateSplitReservationRequest>,
) -> Result<Json<CreateSplitReservationResponse>, (StatusCode, String)> {
    let table_id = Uuid::parse_str(&req.table_id).map_err(|_| (StatusCode::BAD_REQUEST, "ID tavolo non valido".to_string()))?;
    let event_id = Uuid::parse_str(&req.event_id).map_err(|_| (StatusCode::BAD_REQUEST, "ID evento non valido".to_string()))?;
    let owner_user_id = Uuid::parse_str(&req.owner_user_id).map_err(|_| (StatusCode::BAD_REQUEST, "ID utente non valido".to_string()))?;

    // Get table
    let table = match table_persistence::get_table_by_id(&state.db_pool, table_id).await {
        Ok(t) => t,
        Err(_) => return Err((StatusCode::NOT_FOUND, "Tavolo non trovato".to_string())),
    };

    let total_cost = table.total_cost;
    let num_paying = (1 + req.paying_guest_phone_numbers.len()) as i32; // owner + paying guests
    let num_paying_dec = Decimal::from(num_paying);
    let per_person = (total_cost / num_paying_dec).round_dp(2);
    let owner_share = total_cost - (per_person * Decimal::from(num_paying - 1));

    // Verify owner's PaymentIntent with Stripe
    let pi_id: stripe::PaymentIntentId = req.stripe_payment_intent_id.parse()
        .map_err(|_| (StatusCode::BAD_REQUEST, "ID PaymentIntent non valido".to_string()))?;

    let payment_intent = PaymentIntent::retrieve(&state.stripe_client, &pi_id, &[])
        .await
        .map_err(|e| {
            eprintln!("Failed to retrieve PaymentIntent from Stripe: {:?}", e);
            (StatusCode::BAD_GATEWAY, "Errore del servizio di pagamento".to_string())
        })?;

    match payment_intent.status {
        PaymentIntentStatus::Succeeded | PaymentIntentStatus::RequiresCapture => {}
        ref other => {
            eprintln!("PaymentIntent {} has invalid status: {:?}", pi_id, other);
            return Err((StatusCode::BAD_REQUEST, "Pagamento non completato".to_string()));
        }
    }

    // Verify amount matches owner's share in cents
    let expected_cents = (owner_share.to_f64().unwrap_or(0.0) * 100.0) as i64;
    if payment_intent.amount != expected_cents {
        eprintln!("PaymentIntent amount mismatch: expected {} cents, got {}", expected_cents, payment_intent.amount);
        return Err((StatusCode::BAD_REQUEST, "Importo del pagamento non corrispondente".to_string()));
    }

    let num_free_guests = req.free_guest_phone_numbers.as_ref().map_or(0, |v| v.len());
    let total_people = num_paying as usize + num_free_guests;

    // Validate capacity
    if total_people as i32 > table.capacity {
        return Err((StatusCode::BAD_REQUEST, format!("Capacità massima del tavolo superata: {} persone", table.capacity)));
    }

    // Extract Stripe customer and payment method IDs for future off-session re-authorization
    let stripe_customer_id = payment_intent.customer.as_ref()
        .map(|c| c.id().to_string());
    let stripe_payment_method_id = payment_intent.payment_method.as_ref()
        .map(|pm| pm.id().to_string());

    // Prepare data
    let payment_id = Uuid::new_v4();
    let now = Utc::now().naive_utc();

    // Begin transaction
    let mut tx = state.db_pool.begin().await.map_err(|e| {
        eprintln!("Failed to begin transaction: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, "Errore del database".to_string())
    })?;

    // Step 1: Create payment record for owner
    sqlx::query(
        r#"
        INSERT INTO payments (id, sender_id, receiver_id, amount, status, insert_date, update_date, stripe_payment_intent_id, user_ids, capture_method, authorization_status, stripe_customer_id, stripe_payment_method_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        "#
    )
    .bind(payment_id)
    .bind(owner_user_id)
    .bind(owner_user_id)
    .bind(owner_share)
    .bind(PaymentStatus::Pending)
    .bind(now)
    .bind(now)
    .bind(&req.stripe_payment_intent_id)
    .bind(&vec![owner_user_id])
    .bind(PaymentCaptureMethod::Manual)
    .bind("authorized")
    .bind(&stripe_customer_id)
    .bind(&stripe_payment_method_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| {
        eprintln!("Failed to create payment: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, "Errore creazione pagamento".to_string())
    })?;

    // Step 2: Create reservation with total_cost as total_amount
    let reservation_code = generate_alphanumeric_code("RES-");
    let reservation_id: Uuid = sqlx::query_scalar(
        r#"
        INSERT INTO table_reservations (
            table_id, user_id, event_id, num_people, total_amount, amount_paid,
            contact_name, contact_email, contact_phone, special_requests, reservation_code
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id
        "#
    )
    .bind(table_id)
    .bind(owner_user_id)
    .bind(event_id)
    .bind(total_people as i32)
    .bind(total_cost)
    .bind(owner_share) // amount_paid = owner's share
    .bind(&req.contact_name)
    .bind(&req.contact_email)
    .bind(&req.contact_phone)
    .bind(&req.special_requests)
    .bind(&reservation_code)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| {
        eprintln!("Failed to create reservation: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, "Errore creazione prenotazione".to_string())
    })?;

    // Step 3: Link payment to reservation
    sqlx::query(
        "UPDATE table_reservations SET payment_ids = array_append(COALESCE(payment_ids, '{}'), $1) WHERE id = $2"
    )
    .bind(payment_id)
    .bind(reservation_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| {
        eprintln!("Failed to link payment: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, "Errore".to_string())
    })?;

    // Step 4: Create owner's payment share (status = paid)
    let owner_share_row = sqlx::query_as::<_, crate::models::ReservationPaymentShare>(
        r#"
        INSERT INTO reservation_payment_shares (
            reservation_id, user_id, phone_number, amount, status,
            stripe_payment_intent_id, is_owner, payment_id
        )
        VALUES ($1, $2, $3, $4, 'paid', $5, true, $6)
        RETURNING *
        "#
    )
    .bind(reservation_id)
    .bind(owner_user_id)
    .bind(&req.contact_phone)
    .bind(owner_share)
    .bind(&req.stripe_payment_intent_id)
    .bind(payment_id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| {
        eprintln!("Failed to create owner payment share: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, "Errore".to_string())
    })?;

    // Step 5: Create pending payment shares for each paying guest
    let mut all_shares: Vec<crate::models::ReservationPaymentShare> = vec![owner_share_row];
    for phone in &req.paying_guest_phone_numbers {
        let token = generate_payment_link_token();
        let share = sqlx::query_as::<_, crate::models::ReservationPaymentShare>(
            r#"
            INSERT INTO reservation_payment_shares (
                reservation_id, phone_number, amount, status, payment_link_token, is_owner
            )
            VALUES ($1, $2, $3, 'pending', $4, false)
            RETURNING *
            "#
        )
        .bind(reservation_id)
        .bind(phone)
        .bind(per_person)
        .bind(&token)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| {
            eprintln!("Failed to create guest payment share: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Errore".to_string())
        })?;
        all_shares.push(share);
    }

    // Step 6: Create owner's ticket
    let ticket_code = generate_alphanumeric_code("TKT-");
    let owner_ticket_id: Uuid = sqlx::query_scalar(
        r#"
        INSERT INTO tickets (id, event_id, user_id, ticket_code, ticket_type, price, status, purchase_date, qr_code, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NULL, NOW(), NOW())
        RETURNING id
        "#
    )
    .bind(Uuid::new_v4())
    .bind(event_id)
    .bind(owner_user_id)
    .bind(&ticket_code)
    .bind("table")
    .bind(owner_share)
    .bind("active")
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| {
        eprintln!("Failed to create owner ticket: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, "Errore".to_string())
    })?;

    // Link owner's ticket to reservation
    sqlx::query(
        "UPDATE table_reservations SET ticket_ids = array_append(COALESCE(ticket_ids, '{}'), $1) WHERE id = $2"
    )
    .bind(owner_ticket_id)
    .bind(reservation_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| {
        eprintln!("Failed to link ticket: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, "Errore".to_string())
    })?;

    // Step 7: Add free guests if any
    if let Some(ref free_phones) = req.free_guest_phone_numbers {
        for phone in free_phones {
            // Look up user by phone (optional - they may not have an account)
            let user_id = match user_persistence::find_user_by_phone(&state.db_pool, phone).await {
                Ok(Some(user)) => Some(user.id),
                _ => None,
            };

            // Create ticket for free guest
            let free_ticket_code = generate_alphanumeric_code("TKT-");
            let free_ticket_id: Uuid = sqlx::query_scalar(
                r#"
                INSERT INTO tickets (id, event_id, user_id, ticket_code, ticket_type, price, status, purchase_date, qr_code, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NULL, NOW(), NOW())
                RETURNING id
                "#
            )
            .bind(Uuid::new_v4())
            .bind(event_id)
            .bind(user_id)
            .bind(&free_ticket_code)
            .bind("table")
            .bind(Decimal::ZERO)
            .bind("active")
            .fetch_one(&mut *tx)
            .await
            .map_err(|e| {
                eprintln!("Failed to create free guest ticket: {}", e);
                (StatusCode::INTERNAL_SERVER_ERROR, "Errore".to_string())
            })?;

            // Add to reservation_guests
            sqlx::query(
                r#"
                INSERT INTO reservation_guests (reservation_id, user_id, phone_number, added_by, ticket_id)
                VALUES ($1, $2, $3, $4, $5)
                "#
            )
            .bind(reservation_id)
            .bind(user_id)
            .bind(phone)
            .bind(owner_user_id)
            .bind(free_ticket_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| {
                eprintln!("Failed to add free guest: {}", e);
                (StatusCode::INTERNAL_SERVER_ERROR, "Errore".to_string())
            })?;

            // Link ticket to reservation array
            sqlx::query(
                "UPDATE table_reservations SET ticket_ids = array_append(COALESCE(ticket_ids, '{}'), $1) WHERE id = $2"
            )
            .bind(free_ticket_id)
            .bind(reservation_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| {
                eprintln!("Failed to link free guest ticket: {}", e);
                (StatusCode::INTERNAL_SERVER_ERROR, "Errore".to_string())
            })?;

            // Add to guest_user_ids array if user exists
            if let Some(uid) = user_id {
                sqlx::query(
                    "UPDATE table_reservations SET guest_user_ids = array_append(COALESCE(guest_user_ids, '{}'), $1) WHERE id = $2"
                )
                .bind(uid)
                .bind(reservation_id)
                .execute(&mut *tx)
                .await
                .map_err(|e| {
                    eprintln!("Failed to add guest user id: {}", e);
                    (StatusCode::INTERNAL_SERVER_ERROR, "Errore".to_string())
                })?;
            }
        }
    }

    // Commit transaction
    tx.commit().await.map_err(|e| {
        eprintln!("Failed to commit transaction: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, "Errore del database".to_string())
    })?;

    // Fetch final reservation and return with payment shares
    let final_reservation = table_persistence::get_reservation_by_id(&state.db_pool, reservation_id)
        .await
        .map_err(|e| {
            eprintln!("Failed to fetch reservation: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Errore".to_string())
        })?;

    let share_responses: Vec<PaymentShareResponse> = all_shares.into_iter().map(|s| s.into()).collect();

    Ok(Json(CreateSplitReservationResponse {
        reservation: final_reservation.into(),
        payment_shares: share_responses,
    }))
}

fn generate_alphanumeric_code(prefix: &str) -> String {
    use rand::Rng;
    let mut rng = rand::thread_rng();
    let random_part: String = (0..8)
        .map(|_| {
            let idx = rng.gen_range(0..36);
            if idx < 26 { (b'A' + idx) as char } else { (b'0' + (idx - 26)) as char }
        })
        .collect();
    format!("{}{}", prefix, random_part)
}

fn generate_payment_link_token() -> String {
    use rand::Rng;
    let mut rng = rand::thread_rng();
    let random_part: String = (0..32)
        .map(|_| {
            let idx = rng.gen_range(0..36);
            if idx < 26 { (b'a' + idx) as char } else { (b'0' + (idx - 26)) as char }
        })
        .collect();
    format!("pay_{}", random_part)
}

// ============================================================================
// Payment Link Endpoints (Split Payment)
// ============================================================================

/// JWT claims for payment link verification
#[derive(Debug, serde::Serialize, serde::Deserialize)]
struct PaymentLinkClaims {
    pub share_id: String,
    pub token: String,
    pub exp: usize,
}

/// GET /payment-links/:token — Public preview of a payment share
pub async fn get_payment_link_preview(
    State(state): State<Arc<AppState>>,
    Path(token): Path<String>,
) -> Result<Json<PaymentLinkPreviewResponse>, StatusCode> {
    let share = table_persistence::get_payment_share_by_token(&state.db_pool, &token)
        .await
        .map_err(|_| StatusCode::NOT_FOUND)?;

    // Get reservation + table + event names
    let reservation = table_persistence::get_reservation_by_id(&state.db_pool, share.reservation_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let table = table_persistence::get_table_by_id(&state.db_pool, reservation.table_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let event_name: String = sqlx::query_scalar("SELECT title FROM events WHERE id = $1")
        .bind(reservation.event_id)
        .fetch_one(&state.db_pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(PaymentLinkPreviewResponse {
        amount: format!("{:.2} €", share.amount),
        event_name,
        table_name: table.name,
        status: share.status,
    }))
}

/// POST /payment-links/:token/verify — Verify identity before allowing payment
pub async fn verify_payment_link(
    State(state): State<Arc<AppState>>,
    Path(token): Path<String>,
    Json(req): Json<VerifyPaymentLinkRequest>,
) -> Result<Json<VerifyPaymentLinkResponse>, (StatusCode, String)> {
    let share = table_persistence::get_payment_share_by_token(&state.db_pool, &token)
        .await
        .map_err(|_| (StatusCode::NOT_FOUND, "Link di pagamento non trovato".to_string()))?;

    if share.status == "paid" {
        return Err((StatusCode::BAD_REQUEST, "Questo pagamento è già stato completato".to_string()));
    }

    // Check phone or email matches
    let verified = match (&req.phone_number, &req.email) {
        (Some(phone), _) => share.phone_number.as_deref() == Some(phone.as_str()),
        (_, Some(email)) => share.guest_email.as_deref() == Some(email.as_str()),
        _ => false,
    };

    if !verified {
        return Err((StatusCode::FORBIDDEN, "Verifica dell'identità fallita".to_string()));
    }

    // Get reservation + table + event details
    let reservation = table_persistence::get_reservation_by_id(&state.db_pool, share.reservation_id)
        .await
        .map_err(|e| {
            eprintln!("Failed to get reservation: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Errore".to_string())
        })?;

    let table = table_persistence::get_table_by_id(&state.db_pool, reservation.table_id)
        .await
        .map_err(|e| {
            eprintln!("Failed to get table: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Errore".to_string())
        })?;

    let event_name: String = sqlx::query_scalar("SELECT title FROM events WHERE id = $1")
        .bind(reservation.event_id)
        .fetch_one(&state.db_pool)
        .await
        .map_err(|e| {
            eprintln!("Failed to get event: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Errore".to_string())
        })?;

    // Create short-lived JWT (1 hour)
    let claims = PaymentLinkClaims {
        share_id: share.id.to_string(),
        token: token.clone(),
        exp: (chrono::Utc::now() + chrono::Duration::hours(1)).timestamp() as usize,
    };

    let jwt_token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(state.jwt_secret.as_bytes()),
    )
    .map_err(|e| {
        eprintln!("Failed to create JWT: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, "Errore".to_string())
    })?;

    Ok(Json(VerifyPaymentLinkResponse {
        token: jwt_token,
        amount: format!("{:.2} €", share.amount),
        event_name,
        table_name: table.name,
        reservation_code: reservation.reservation_code,
    }))
}

/// POST /payment-links/:token/checkout — Create Stripe Checkout Session (requires verification JWT)
pub async fn create_payment_link_checkout(
    State(state): State<Arc<AppState>>,
    Path(token): Path<String>,
    headers: axum::http::HeaderMap,
    Json(req): Json<CreateCheckoutRequest>,
) -> Result<Json<CreateCheckoutResponse>, (StatusCode, String)> {
    // Validate verification JWT from Authorization header
    let auth_header = headers.get("Authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .ok_or_else(|| (StatusCode::UNAUTHORIZED, "Token di verifica mancante".to_string()))?;

    let claims = decode::<PaymentLinkClaims>(
        auth_header,
        &DecodingKey::from_secret(state.jwt_secret.as_bytes()),
        &Validation::default(),
    )
    .map_err(|_| (StatusCode::UNAUTHORIZED, "Token di verifica non valido o scaduto".to_string()))?
    .claims;

    if claims.token != token {
        return Err((StatusCode::UNAUTHORIZED, "Token non corrisponde".to_string()));
    }

    let share = table_persistence::get_payment_share_by_token(&state.db_pool, &token)
        .await
        .map_err(|_| (StatusCode::NOT_FOUND, "Link di pagamento non trovato".to_string()))?;

    if share.status == "paid" {
        return Err((StatusCode::BAD_REQUEST, "Questo pagamento è già stato completato".to_string()));
    }

    // Get reservation for context
    let reservation = table_persistence::get_reservation_by_id(&state.db_pool, share.reservation_id)
        .await
        .map_err(|e| {
            eprintln!("Failed to get reservation: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Errore".to_string())
        })?;

    let event_name: String = sqlx::query_scalar("SELECT title FROM events WHERE id = $1")
        .bind(reservation.event_id)
        .fetch_one(&state.db_pool)
        .await
        .map_err(|e| {
            eprintln!("Failed to get event: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Errore".to_string())
        })?;

    // Create Stripe Checkout Session
    let amount_in_cents = share.amount.to_f64()
        .ok_or_else(|| (StatusCode::INTERNAL_SERVER_ERROR, "Importo non valido".to_string()))? * 100.0;

    let mut checkout_params = stripe::CreateCheckoutSession::new();
    checkout_params.mode = Some(stripe::CheckoutSessionMode::Payment);
    checkout_params.line_items = Some(vec![
        stripe::CreateCheckoutSessionLineItems {
            price_data: Some(stripe::CreateCheckoutSessionLineItemsPriceData {
                currency: Currency::EUR,
                product_data: Some(stripe::CreateCheckoutSessionLineItemsPriceDataProductData {
                    name: format!("Tavolo - {}", event_name),
                    ..Default::default()
                }),
                unit_amount: Some(amount_in_cents as i64),
                ..Default::default()
            }),
            quantity: Some(1),
            ..Default::default()
        }
    ]);

    // TODO: Configure success_url and cancel_url based on frontend deployment
    checkout_params.success_url = Some("https://app.example.com/payment/success?session_id={CHECKOUT_SESSION_ID}");
    checkout_params.cancel_url = Some("https://app.example.com/payment/cancel");

    if let Some(ref email) = req.email {
        checkout_params.customer_email = Some(email);
    }

    checkout_params.metadata = Some(
        [
            ("payment_share_id".to_string(), share.id.to_string()),
            ("reservation_id".to_string(), share.reservation_id.to_string()),
            ("payment_link_token".to_string(), token.clone()),
        ]
        .into_iter()
        .collect(),
    );

    let session = stripe::CheckoutSession::create(&state.stripe_client, checkout_params)
        .await
        .map_err(|e| {
            eprintln!("Stripe Checkout error: {:?}", e);
            (StatusCode::BAD_GATEWAY, "Errore del servizio di pagamento".to_string())
        })?;

    // Store checkout session ID and guest info on the share
    table_persistence::set_payment_share_checkout_session(
        &state.db_pool,
        share.id,
        &session.id.to_string(),
        req.name.clone(),
        req.email.clone(),
    )
    .await
    .map_err(|e| {
        eprintln!("Failed to update share: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, "Errore".to_string())
    })?;

    let checkout_url = session.url.ok_or_else(|| {
        (StatusCode::INTERNAL_SERVER_ERROR, "URL di checkout non disponibile".to_string())
    })?;

    println!("✅ Checkout Session created for share {}: {}", share.id, session.id);

    Ok(Json(CreateCheckoutResponse { checkout_url }))
}

// ============================================================================
// Reservation Guest Management Endpoints
// ============================================================================

/// POST /reservations/:id/add-guest — Add a free (non-paying) guest
pub async fn add_free_guest_to_reservation(
    State(state): State<Arc<AppState>>,
    Path(reservation_id): Path<String>,
    Json(req): Json<AddFreeGuestRequest>,
) -> Result<Json<FreeGuestResponse>, (StatusCode, String)> {
    let reservation_uuid = Uuid::parse_str(&reservation_id)
        .map_err(|_| (StatusCode::BAD_REQUEST, "ID prenotazione non valido".to_string()))?;
    let added_by = Uuid::parse_str(&req.added_by)
        .map_err(|_| (StatusCode::BAD_REQUEST, "ID utente non valido".to_string()))?;

    // Get reservation
    let reservation = table_persistence::get_reservation_by_id(&state.db_pool, reservation_uuid)
        .await
        .map_err(|_| (StatusCode::NOT_FOUND, "Prenotazione non trovata".to_string()))?;

    // Get table for capacity check
    let table = table_persistence::get_table_by_id(&state.db_pool, reservation.table_id)
        .await
        .map_err(|e| {
            eprintln!("Failed to get table: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Errore".to_string())
        })?;

    // Check capacity
    let current_count = table_persistence::get_total_people_count(&state.db_pool, reservation_uuid)
        .await
        .map_err(|e| {
            eprintln!("Failed to count people: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Errore".to_string())
        })?;

    if current_count + 1 > table.capacity as i64 {
        return Err((StatusCode::BAD_REQUEST, format!("Capacità massima del tavolo raggiunta: {}", table.capacity)));
    }

    // Look up user by phone (optional)
    let user_id = match user_persistence::find_user_by_phone(&state.db_pool, &req.phone_number).await {
        Ok(Some(user)) => Some(user.id),
        _ => None,
    };

    // Create ticket for free guest
    let ticket_code = generate_alphanumeric_code("TKT-");
    let ticket_id: Uuid = sqlx::query_scalar(
        r#"
        INSERT INTO tickets (id, event_id, user_id, ticket_code, ticket_type, price, status, purchase_date, qr_code, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NULL, NOW(), NOW())
        RETURNING id
        "#
    )
    .bind(Uuid::new_v4())
    .bind(reservation.event_id)
    .bind(user_id)
    .bind(&ticket_code)
    .bind("table")
    .bind(Decimal::ZERO)
    .bind("active")
    .fetch_one(&state.db_pool)
    .await
    .map_err(|e| {
        eprintln!("Failed to create ticket: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, "Errore creazione biglietto".to_string())
    })?;

    // Add to reservation_guests table
    let guest = table_persistence::add_free_guest(
        &state.db_pool,
        reservation_uuid,
        user_id,
        &req.phone_number,
        req.email.clone(),
        req.name.clone(),
        added_by,
        Some(ticket_id),
    )
    .await
    .map_err(|e| {
        eprintln!("Failed to add guest: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, "Errore aggiunta ospite".to_string())
    })?;

    // Update num_people and ticket_ids on reservation
    let new_count = (current_count + 1) as i32;
    table_persistence::update_reservation_num_people(&state.db_pool, reservation_uuid, new_count)
        .await
        .map_err(|e| {
            eprintln!("Failed to update num_people: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Errore".to_string())
        })?;

    table_persistence::add_ticket_to_reservation(&state.db_pool, reservation_uuid, ticket_id)
        .await
        .map_err(|e| {
            eprintln!("Failed to link ticket: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Errore".to_string())
        })?;

    // Add to guest_user_ids array if user exists
    if let Some(uid) = user_id {
        table_persistence::add_guest_to_reservation(&state.db_pool, reservation_uuid, uid)
            .await
            .map_err(|e| {
                eprintln!("Failed to add guest user id: {}", e);
                (StatusCode::INTERNAL_SERVER_ERROR, "Errore".to_string())
            })?;
    }

    Ok(Json(guest.into()))
}

/// GET /reservations/:id/payment-status — Get split payment status
pub async fn get_reservation_payment_status(
    State(state): State<Arc<AppState>>,
    Path(reservation_id): Path<String>,
) -> Result<Json<ReservationPaymentStatusResponse>, StatusCode> {
    let reservation_uuid = Uuid::parse_str(&reservation_id).map_err(|_| StatusCode::BAD_REQUEST)?;

    let reservation = table_persistence::get_reservation_by_id(&state.db_pool, reservation_uuid)
        .await
        .map_err(|_| StatusCode::NOT_FOUND)?;

    let shares = table_persistence::get_payment_shares_by_reservation(&state.db_pool, reservation_uuid)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let free_guests = table_persistence::get_free_guests_by_reservation(&state.db_pool, reservation_uuid)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let amount_remaining = reservation.total_amount - reservation.amount_paid;

    Ok(Json(ReservationPaymentStatusResponse {
        reservation_id: reservation.id.to_string(),
        total_cost: format!("{:.2} €", reservation.total_amount),
        amount_paid: format!("{:.2} €", reservation.amount_paid),
        amount_remaining: format!("{:.2} €", amount_remaining),
        payment_shares: shares.into_iter().map(|s| s.into()).collect(),
        free_guests: free_guests.into_iter().map(|g| g.into()).collect(),
    }))
}