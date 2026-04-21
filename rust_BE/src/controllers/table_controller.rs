use crate::application::{
    auth_service as user_persistence, outbox_service, reservation_service as table_persistence,
};
use crate::middleware::auth::ClubOwnerUser;
use crate::models::PaginationParams;
use crate::models::{
    AddPaymentToReservationRequest, AppState, CreateCheckoutRequest, CreateCheckoutResponse,
    CreatePaymentIntentResponse, CreateSplitPaymentIntentRequest, CreateSplitReservationRequest,
    CreateSplitReservationResponse, CreateTableRequest, CreateTableReservationRequest,
    EventSummary, LinkTicketToReservationRequest, PaymentCaptureMethod, PaymentLinkPreviewResponse,
    PaymentStatus, ReservationPaymentStatusResponse, TableReservationResponse,
    TableReservationWithDetailsResponse, TableReservationsResponse,
    TableReservationsWithDetailsResponse, TableResponse, TableSummary, TablesResponse,
    UpdateTableRequest, UpdateTableReservationRequest,
};
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use chrono::Utc;
use rust_decimal::prelude::ToPrimitive;
use rust_decimal::Decimal;
use std::sync::Arc;
use stripe::{
    CreateCheckoutSessionPaymentIntentData, CreateCheckoutSessionPaymentIntentDataTransferData,
    CreateCustomer, CreatePaymentIntent, Currency, Customer, PaymentIntent,
    PaymentIntentCaptureMethod, PaymentIntentSetupFutureUsage, PaymentIntentStatus,
};
use tracing::warn;
use uuid::Uuid;

#[derive(Clone, Debug, sqlx::FromRow)]
struct ClubStripeConnectConfig {
    stripe_connected_account_id: Option<String>,
    stripe_onboarding_complete: Option<bool>,
    stripe_charges_enabled: Option<bool>,
    stripe_payouts_enabled: Option<bool>,
    platform_commission_percent: Option<Decimal>,
    platform_commission_fixed_fee: Option<Decimal>,
}

fn compute_application_fee_cents(
    total_amount: Decimal,
    commission_percent: Option<Decimal>,
    commission_fixed_fee: Option<Decimal>,
) -> i64 {
    let percent = commission_percent.unwrap_or(Decimal::ZERO);
    let fixed_fee = commission_fixed_fee.unwrap_or(Decimal::ZERO);
    let percent_fee = (total_amount * percent / Decimal::new(100, 0)).round_dp(2);
    let fee = (percent_fee + fixed_fee).max(Decimal::ZERO).min(total_amount);
    ((fee.to_f64().unwrap_or(0.0) * 100.0).round()) as i64
}

async fn get_club_connect_config_for_event(
    pool: &sqlx::PgPool,
    event_id: Uuid,
) -> Result<Option<ClubStripeConnectConfig>, sqlx::Error> {
    sqlx::query_as::<_, ClubStripeConnectConfig>(
        r#"
        SELECT
            c.stripe_connected_account_id,
            c.stripe_onboarding_complete,
            c.stripe_charges_enabled,
            c.stripe_payouts_enabled,
            c.platform_commission_percent,
            c.platform_commission_fixed_fee
        FROM events e
        JOIN clubs c ON c.id = e.club_id
        WHERE e.id = $1
        "#,
    )
    .bind(event_id)
    .fetch_optional(pool)
    .await
}

fn can_route_funds_to_connected_account(config: &ClubStripeConnectConfig) -> bool {
    config.stripe_connected_account_id.is_some()
        && config.stripe_onboarding_complete.unwrap_or(false)
        && config.stripe_charges_enabled.unwrap_or(false)
        && config.stripe_payouts_enabled.unwrap_or(false)
}

// ============================================================================
// Tables endpoints
// ============================================================================

/// Get all tables
pub async fn get_all_tables(
    State(state): State<Arc<AppState>>,
) -> Result<Json<TablesResponse>, StatusCode> {
    match table_persistence::get_all_tables(&state.db_pool).await {
        Ok(tables) => {
            let table_responses: Vec<TableResponse> =
                tables.into_iter().map(|t| t.into()).collect();

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
            let table_responses: Vec<TableResponse> =
                tables.into_iter().map(|t| t.into()).collect();

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
            let table_responses: Vec<TableResponse> =
                tables.into_iter().map(|t| t.into()).collect();

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

/// Create a new table (requires club_owner JWT)
pub async fn create_table(
    _: ClubOwnerUser,
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

/// Update a table (requires club_owner JWT)
pub async fn update_table(
    _: ClubOwnerUser,
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

/// Delete a table (requires club_owner JWT)
pub async fn delete_table(
    _: ClubOwnerUser,
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
    _: ClubOwnerUser,
    State(state): State<Arc<AppState>>,
    Query(pagination): Query<PaginationParams>,
) -> Result<Json<TableReservationsResponse>, StatusCode> {
    match table_persistence::get_all_reservations(
        &state.db_pool,
        pagination.limit,
        pagination.offset,
    )
    .await
    {
        Ok(reservations) => {
            let reservation_responses: Vec<TableReservationResponse> =
                reservations.into_iter().map(|r| r.into()).collect();

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

    let reservations =
        table_persistence::list_user_reservations_with_details(&state.read_db_pool, user_uuid)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if let Err(error) = outbox_service::enqueue_analytics_event(
        &state.db_pool,
        &state.config,
        "user_reservations_viewed",
        Some(&user_id),
        Some("reservation"),
        None,
        serde_json::json!({
            "user_id": user_uuid,
            "reservation_count": reservations.len(),
            "outcome": "success",
        }),
    )
    .await
    {
        warn!(error = %error, user_id = %user_uuid, "Failed to enqueue user reservations analytics event");
    }

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
            let reservation_responses: Vec<TableReservationResponse> =
                reservations.into_iter().map(|r| r.into()).collect();

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
            let _ = outbox_service::enqueue_analytics_event(
                &state.db_pool,
                &state.config,
                "reservation_lookup_succeeded",
                Some(&code),
                Some("reservation"),
                Some(reservation.id),
                serde_json::json!({
                    "reservation_id": reservation.id,
                    "event_id": event_id,
                    "table_id": table.id,
                    "outcome": "success",
                }),
            )
            .await;

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
        Err(sqlx::Error::RowNotFound) => {
            let _ = outbox_service::enqueue_analytics_event(
                &state.db_pool,
                &state.config,
                "reservation_lookup_failed",
                Some(&code),
                Some("reservation"),
                None,
                serde_json::json!({
                    "reservation_code": code,
                    "outcome": "not_found",
                }),
            )
            .await;
            Err(StatusCode::NOT_FOUND)
        }
        Err(error) => {
            let _ = outbox_service::enqueue_analytics_error(
                &state.db_pool,
                &state.config,
                "reservation_lookup_failed",
                Some(&code),
                Some("reservation"),
                None,
                &error.to_string(),
                serde_json::json!({
                    "reservation_code": code,
                }),
            )
            .await;
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
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

    tracing::info!(user_id = %user_uuid, table_id = %table_id, event_id = %event_id, num_people = ?req.num_people, "Creating reservation");

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
        Ok(reservation) => {
            tracing::info!(reservation_id = %reservation.id, user_id = %user_uuid, "Reservation created");
            Ok(Json(reservation.into()))
        }
        Err(e) => {
            tracing::error!(error = %e, user_id = %user_uuid, table_id = %table_id, "Failed to create reservation");
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
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

    match table_persistence::add_payment_to_reservation(
        &state.db_pool,
        reservation_uuid,
        payment_id,
        amount,
    )
    .await
    {
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

    match table_persistence::add_ticket_to_reservation(&state.db_pool, reservation_uuid, ticket_id)
        .await
    {
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
            let ticket_id_strings: Vec<String> = reservation
                .ticket_ids
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

/// Create Stripe PaymentIntent for table reservation (split payment - owner's share only).
/// Share = table.total_cost / table.capacity. Owner pays their share upfront.
pub async fn create_payment_intent(
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateSplitPaymentIntentRequest>,
) -> Result<Json<CreatePaymentIntentResponse>, (StatusCode, String)> {
    let table_id = Uuid::parse_str(&req.table_id)
        .map_err(|_| (StatusCode::BAD_REQUEST, "ID tavolo non valido".to_string()))?;
    let event_id = Uuid::parse_str(&req.event_id)
        .map_err(|_| (StatusCode::BAD_REQUEST, "ID evento non valido".to_string()))?;
    let owner_user_id = Uuid::parse_str(&req.owner_user_id)
        .map_err(|_| (StatusCode::BAD_REQUEST, "ID utente non valido".to_string()))?;

    // Get table — capacity drives the per-person split
    let table = match table_persistence::get_table_by_id(&state.db_pool, table_id).await {
        Ok(t) => t,
        Err(_) => return Err((StatusCode::NOT_FOUND, "Tavolo non trovato".to_string())),
    };

    let total_cost = table.total_cost;
    let capacity = Decimal::from(table.capacity);
    let club_connect_config = get_club_connect_config_for_event(&state.db_pool, event_id)
        .await
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Errore del database".to_string(),
            )
        })?;

    // Per-person share: total_cost / capacity, owner absorbs rounding remainder
    let per_person = (total_cost / capacity).round_dp(2);
    let owner_share = total_cost - (per_person * Decimal::from(table.capacity - 1));

    // Get or create a Stripe Customer for this user (needed for off-session re-auth)
    let owner_user = match user_persistence::find_user_by_id(&state.db_pool, owner_user_id).await {
        Ok(Some(u)) => u,
        Ok(None) => return Err((StatusCode::NOT_FOUND, "Utente non trovato".to_string())),
        Err(_) => {
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                "Errore del database".to_string(),
            ))
        }
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
            tracing::error!(error = ?e, "Stripe Customer create error");
            (
                StatusCode::BAD_GATEWAY,
                "Errore creazione cliente".to_string(),
            )
        })?;

    // Create Stripe PaymentIntent for owner's share with manual capture + saved payment method
    let amount_in_cents = owner_share.to_f64().ok_or_else(|| {
        tracing::error!(owner_share = %owner_share, "Invalid owner_share amount");
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Importo non valido".to_string(),
        )
    })? * 100.0;

    let mut params = CreatePaymentIntent::new(amount_in_cents as i64, Currency::EUR);

    // Manual capture: authorize now, charge the day before the event
    params.capture_method = Some(PaymentIntentCaptureMethod::Manual);

    // Save the payment method to the customer for future off-session re-authorization
    params.setup_future_usage = Some(PaymentIntentSetupFutureUsage::OffSession);

    // Attach the Stripe customer
    params.customer = Some(stripe_customer.id.clone());

    params.automatic_payment_methods = Some(stripe::CreatePaymentIntentAutomaticPaymentMethods {
        enabled: true,
        allow_redirects: None,
    });

    let connect_destination_for_on_behalf_of = club_connect_config
        .as_ref()
        .filter(|cfg| can_route_funds_to_connected_account(cfg))
        .and_then(|cfg| cfg.stripe_connected_account_id.clone());
    if let Some(config) = club_connect_config
        .as_ref()
        .filter(|cfg| can_route_funds_to_connected_account(cfg))
    {
        let destination = connect_destination_for_on_behalf_of
            .clone()
            .unwrap_or_default();
        let application_fee_amount = compute_application_fee_cents(
            owner_share,
            config.platform_commission_percent,
            config.platform_commission_fixed_fee,
        );
        params.application_fee_amount = Some(application_fee_amount);
        params.on_behalf_of = connect_destination_for_on_behalf_of.as_deref();
        params.transfer_data = Some(stripe::CreatePaymentIntentTransferData {
            amount: None,
            destination,
        });
    }

    params.metadata = Some(
        [
            ("table_id".to_string(), table_id.to_string()),
            ("event_id".to_string(), event_id.to_string()),
            ("owner_user_id".to_string(), owner_user_id.to_string()),
            ("split_payment".to_string(), "true".to_string()),
            ("capacity".to_string(), table.capacity.to_string()),
            ("total_cost".to_string(), total_cost.to_string()),
        ]
        .into_iter()
        .collect(),
    );

    let payment_intent = PaymentIntent::create(&state.stripe_client, params)
        .await
        .map_err(|e| {
            tracing::error!(error = ?e, "Stripe API error creating PaymentIntent");
            (
                StatusCode::BAD_GATEWAY,
                "Errore del servizio di pagamento".to_string(),
            )
        })?;

    tracing::info!(payment_intent_id = %payment_intent.id, owner_share_cents = amount_in_cents as i64, total_cost = %total_cost, stripe_customer_id = %stripe_customer.id, "Split PaymentIntent created");

    let client_secret = payment_intent.client_secret.ok_or_else(|| {
        tracing::error!("No client_secret in PaymentIntent response");
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Risposta di pagamento non valida".to_string(),
        )
    })?;

    let _ = outbox_service::enqueue_analytics_event(
        &state.db_pool,
        &state.config,
        "split_payment_intent_created",
        Some(&owner_user_id.to_string()),
        Some("payment"),
        None,
        serde_json::json!({
            "owner_user_id": owner_user_id,
            "table_id": table_id,
            "event_id": event_id,
            "owner_share": owner_share,
            "per_person": per_person,
            "outcome": "success",
        }),
    )
    .await;

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
/// 1. Verifies the owner's PaymentIntent (for their share: total_cost / capacity)
/// 2. Creates payment record + reservation with a single shared payment_link_token
/// 3. Creates owner's payment share (paid) and owner ticket
/// Guests pay later via the shared link — no phone numbers required upfront
pub async fn create_reservation_with_payment(
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateSplitReservationRequest>,
) -> Result<Json<CreateSplitReservationResponse>, (StatusCode, String)> {
    let table_id = Uuid::parse_str(&req.table_id)
        .map_err(|_| (StatusCode::BAD_REQUEST, "ID tavolo non valido".to_string()))?;
    let event_id = Uuid::parse_str(&req.event_id)
        .map_err(|_| (StatusCode::BAD_REQUEST, "ID evento non valido".to_string()))?;
    let owner_user_id = Uuid::parse_str(&req.owner_user_id)
        .map_err(|_| (StatusCode::BAD_REQUEST, "ID utente non valido".to_string()))?;

    tracing::info!(
        owner_user_id = %owner_user_id,
        table_id = %table_id,
        event_id = %event_id,
        payment_intent_id = %req.stripe_payment_intent_id,
        "Creating split reservation with payment"
    );

    // Get table
    let table = match table_persistence::get_table_by_id(&state.db_pool, table_id).await {
        Ok(t) => t,
        Err(_) => return Err((StatusCode::NOT_FOUND, "Tavolo non trovato".to_string())),
    };

    let total_cost = table.total_cost;
    let capacity = table.capacity;
    let per_person = (total_cost / Decimal::from(capacity)).round_dp(2);
    let owner_share = total_cost - (per_person * Decimal::from(capacity - 1));

    // Verify owner's PaymentIntent with Stripe
    let pi_id: stripe::PaymentIntentId = req.stripe_payment_intent_id.parse().map_err(|_| {
        (
            StatusCode::BAD_REQUEST,
            "ID PaymentIntent non valido".to_string(),
        )
    })?;

    // Run the rest; on any failure, cancel the Stripe authorization hold immediately.
    let result: Result<Json<CreateSplitReservationResponse>, (StatusCode, String)> = async {

    let payment_intent = PaymentIntent::retrieve(&state.stripe_client, &pi_id, &[])
        .await
        .map_err(|e| {
            tracing::error!(error = ?e, "Failed to retrieve PaymentIntent from Stripe");
            (StatusCode::BAD_GATEWAY, "Errore del servizio di pagamento".to_string())
        })?;

    match payment_intent.status {
        PaymentIntentStatus::Succeeded | PaymentIntentStatus::RequiresCapture => {}
        ref other => {
            tracing::error!(pi_id = %pi_id, status = ?other, "PaymentIntent has invalid status");
            return Err((StatusCode::BAD_REQUEST, "Pagamento non completato".to_string()));
        }
    }

    // Verify amount matches owner's share in cents
    let expected_cents = (owner_share.to_f64().unwrap_or(0.0) * 100.0) as i64;
    if payment_intent.amount != expected_cents {
        tracing::error!(expected_cents = %expected_cents, actual = %payment_intent.amount, "PaymentIntent amount mismatch");
        return Err((StatusCode::BAD_REQUEST, "Importo del pagamento non corrispondente".to_string()));
    }

    // Extract Stripe customer and payment method IDs for future off-session re-authorization
    let stripe_customer_id = payment_intent.customer.as_ref()
        .map(|c| c.id().to_string());
    let stripe_payment_method_id = payment_intent.payment_method.as_ref()
        .map(|pm| pm.id().to_string());

    // Prepare data
    let payment_id = Uuid::new_v4();
    let now = Utc::now().naive_utc();
    let payment_link_token = generate_payment_link_token();

    // Begin transaction
    let mut tx = state.db_pool.begin().await.map_err(|e| {
        tracing::error!(error = %e, "Failed to begin transaction");
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
        tracing::error!(error = %e, "Failed to create payment");
        (StatusCode::INTERNAL_SERVER_ERROR, "Errore creazione pagamento".to_string())
    })?;

    // Step 2: Create reservation — num_people starts at 1 (owner); guests increment as they pay
    let reservation_code = generate_alphanumeric_code("RES-");
    let reservation_id: Uuid = sqlx::query_scalar(
        r#"
        INSERT INTO table_reservations (
            table_id, user_id, event_id, num_people, total_amount, amount_paid,
            contact_name, contact_email, contact_phone, special_requests,
            reservation_code, payment_link_token
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id
        "#
    )
    .bind(table_id)
    .bind(owner_user_id)
    .bind(event_id)
    .bind(1_i32)
    .bind(total_cost)
    .bind(owner_share)
    .bind(&req.contact_name)
    .bind(&req.contact_email)
    .bind(&req.contact_phone)
    .bind(&req.special_requests)
    .bind(&reservation_code)
    .bind(&payment_link_token)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| {
        tracing::error!(error = %e, "Failed to create reservation");
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
        tracing::error!(error = %e, "Failed to link payment to reservation");
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
        tracing::error!(error = %e, "Failed to create owner payment share");
        (StatusCode::INTERNAL_SERVER_ERROR, "Errore".to_string())
    })?;

    // Step 5: Create owner's ticket
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
        tracing::error!(error = %e, "Failed to create owner ticket");
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
        tracing::error!(error = %e, "Failed to link ticket to reservation");
        (StatusCode::INTERNAL_SERVER_ERROR, "Errore".to_string())
    })?;

    // Commit transaction
    tx.commit().await.map_err(|e| {
        tracing::error!(error = %e, "Failed to commit transaction");
        (StatusCode::INTERNAL_SERVER_ERROR, "Errore del database".to_string())
    })?;

    // Fetch final reservation and return
    let final_reservation = table_persistence::get_reservation_by_id(&state.db_pool, reservation_id)
        .await
        .map_err(|e| {
            tracing::error!(error = %e, "Failed to fetch reservation");
            (StatusCode::INTERNAL_SERVER_ERROR, "Errore".to_string())
        })?;

    let app_base_url = state.config.app_base_url.clone();
    let share_link = format!("{}/pay/{}", app_base_url, payment_link_token);

    tracing::info!(
        reservation_id = %reservation_id,
        owner_user_id = %owner_user_id,
        payment_id = %payment_id,
        payment_intent_id = %req.stripe_payment_intent_id,
        payment_link_token = %payment_link_token,
        "Split reservation created successfully"
    );

    let _ = outbox_service::enqueue_analytics_event(
        &state.db_pool,
        &state.config,
        "split_reservation_created",
        Some(&owner_user_id.to_string()),
        Some("reservation"),
        Some(reservation_id),
        serde_json::json!({
            "reservation_id": reservation_id,
            "table_id": table_id,
            "event_id": event_id,
            "payment_id": payment_id,
            "owner_share": owner_share,
            "share_link_present": true,
            "outcome": "success",
        }),
    ).await;

    Ok(Json(CreateSplitReservationResponse {
        reservation: final_reservation.into(),
        payment_shares: vec![owner_share_row.into()],
        share_link,
    }))

    }.await; // end of cancellation-guarded block

    if let Err((status, error_message)) = &result {
        let _ = outbox_service::enqueue_analytics_error(
            &state.db_pool,
            &state.config,
            "split_reservation_create_failed",
            Some(&owner_user_id.to_string()),
            Some("reservation"),
            None,
            error_message,
            serde_json::json!({
                "owner_user_id": owner_user_id,
                "table_id": table_id,
                "event_id": event_id,
                "status_code": status.as_u16(),
            }),
        )
        .await;
    }

    if result.is_err() {
        tracing::error!(owner_user_id = %owner_user_id, table_id = %table_id, "Split reservation failed — cancelling Stripe authorization");
        let _ = PaymentIntent::cancel(
            &state.stripe_client,
            &pi_id,
            stripe::CancelPaymentIntent::default(),
        )
        .await;
    }

    result
}

fn generate_alphanumeric_code(prefix: &str) -> String {
    use rand::Rng;
    let mut rng = rand::thread_rng();
    let random_part: String = (0..8)
        .map(|_| {
            let idx = rng.gen_range(0..36);
            if idx < 26 {
                (b'A' + idx) as char
            } else {
                (b'0' + (idx - 26)) as char
            }
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
            if idx < 26 {
                (b'a' + idx) as char
            } else {
                (b'0' + (idx - 26)) as char
            }
        })
        .collect();
    format!("pay_{}", random_part)
}

// ============================================================================
// Payment Link Endpoints (Split Payment)
// ============================================================================

/// GET /payment-links/:token — Public preview for a shared reservation payment link
pub async fn get_payment_link_preview(
    State(state): State<Arc<AppState>>,
    Path(token): Path<String>,
) -> Result<Json<PaymentLinkPreviewResponse>, StatusCode> {
    let reservation =
        table_persistence::get_reservation_by_payment_link_token(&state.db_pool, &token)
            .await
            .map_err(|_| StatusCode::NOT_FOUND)?;

    let table = table_persistence::get_table_by_id(&state.db_pool, reservation.table_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let event_name: String = sqlx::query_scalar("SELECT title FROM events WHERE id = $1")
        .bind(reservation.event_id)
        .fetch_one(&state.db_pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Count slots already claimed (paid or in-flight checkout)
    let slots_filled: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM reservation_payment_shares WHERE reservation_id = $1 AND status IN ('paid', 'checkout_pending') AND is_owner = false"
    )
    .bind(reservation.id)
    .fetch_one(&state.db_pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let slots_total = table.capacity;
    let per_person = (table.total_cost / Decimal::from(table.capacity)).round_dp(2);
    let status = if slots_filled >= slots_total as i64 {
        "full"
    } else {
        "open"
    };

    let _ = outbox_service::enqueue_analytics_event(
        &state.db_pool,
        &state.config,
        "payment_link_preview_viewed",
        Some(&token),
        Some("reservation"),
        Some(reservation.id),
        serde_json::json!({
            "reservation_id": reservation.id,
            "table_id": table.id,
            "slots_filled": slots_filled,
            "slots_total": slots_total,
            "status": status,
            "outcome": "success",
        }),
    )
    .await;

    Ok(Json(PaymentLinkPreviewResponse {
        amount: format!("{:.2} €", per_person),
        event_name,
        table_name: table.name,
        status: status.to_string(),
        slots_filled: slots_filled as i32,
        slots_total,
    }))
}

/// POST /payment-links/:token/checkout — Guest claims a slot and starts Stripe Checkout
/// Race-safe: uses SELECT FOR UPDATE + checkout_pending status to prevent double-booking
pub async fn create_payment_link_checkout(
    State(state): State<Arc<AppState>>,
    Path(token): Path<String>,
    Json(req): Json<CreateCheckoutRequest>,
) -> Result<Json<CreateCheckoutResponse>, (StatusCode, String)> {
    // Begin transaction with row-level lock to prevent race conditions
    let mut tx = state.db_pool.begin().await.map_err(|e| {
        tracing::error!(error = %e, "Failed to begin transaction");
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Errore del database".to_string(),
        )
    })?;

    // Lock the reservation row
    let reservation_id: Option<Uuid> = sqlx::query_scalar(
        "SELECT id FROM table_reservations WHERE payment_link_token = $1 FOR UPDATE",
    )
    .bind(&token)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| {
        tracing::error!(error = %e, "Failed to lock reservation");
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Errore del database".to_string(),
        )
    })?;

    let reservation_id = reservation_id.ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            "Link di pagamento non trovato".to_string(),
        )
    })?;

    // Fetch reservation and table for capacity/amount
    let reservation_event_id: Uuid =
        sqlx::query_scalar("SELECT event_id FROM table_reservations WHERE id = $1")
            .bind(reservation_id)
            .fetch_one(&mut *tx)
            .await
            .map_err(|e| {
                tracing::error!(error = %e, "Failed to fetch reservation event_id");
                (StatusCode::INTERNAL_SERVER_ERROR, "Errore".to_string())
            })?;

    let reservation_table_id: Uuid =
        sqlx::query_scalar("SELECT table_id FROM table_reservations WHERE id = $1")
            .bind(reservation_id)
            .fetch_one(&mut *tx)
            .await
            .map_err(|e| {
                tracing::error!(error = %e, "Failed to fetch reservation table_id");
                (StatusCode::INTERNAL_SERVER_ERROR, "Errore".to_string())
            })?;

    let (table_capacity, table_total_cost): (i32, rust_decimal::Decimal) =
        sqlx::query_as("SELECT capacity, total_cost FROM tables WHERE id = $1")
            .bind(reservation_table_id)
            .fetch_one(&mut *tx)
            .await
            .map_err(|e| {
                tracing::error!(error = %e, "Failed to fetch table");
                (StatusCode::INTERNAL_SERVER_ERROR, "Errore".to_string())
            })?;

    // Count current non-owner slots already taken (paid or in-flight)
    let slots_filled: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM reservation_payment_shares WHERE reservation_id = $1 AND status IN ('paid', 'checkout_pending') AND is_owner = false"
    )
    .bind(reservation_id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| {
        tracing::error!(error = %e, "Failed to count slots");
        (StatusCode::INTERNAL_SERVER_ERROR, "Errore".to_string())
    })?;

    let guest_slots = (table_capacity - 1) as i64; // capacity minus owner
    if slots_filled >= guest_slots {
        let _ = tx.rollback().await;
        let _ = outbox_service::enqueue_analytics_event(
            &state.db_pool,
            &state.config,
            "payment_link_checkout_rejected",
            Some(&token),
            Some("reservation"),
            Some(reservation_id),
            serde_json::json!({
                "reservation_id": reservation_id,
                "reason": "table_full",
                "outcome": "rejected",
            }),
        )
        .await;
        return Err((StatusCode::CONFLICT, "Tavolo al completo".to_string()));
    }

    // Prevent the same phone number from paying twice for the same reservation
    let already_exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(
            SELECT 1 FROM reservation_payment_shares
            WHERE reservation_id = $1
              AND phone_number = $2
              AND is_owner = false
              AND status IN ('paid', 'checkout_pending')
        )",
    )
    .bind(reservation_id)
    .bind(&req.phone)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| {
        tracing::error!(error = %e, "Failed to check duplicate phone on reservation");
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Errore del database".to_string(),
        )
    })?;

    if already_exists {
        let _ = tx.rollback().await;
        let _ = outbox_service::enqueue_analytics_event(
            &state.db_pool,
            &state.config,
            "payment_link_checkout_rejected",
            Some(&token),
            Some("reservation"),
            Some(reservation_id),
            serde_json::json!({
                "reservation_id": reservation_id,
                "reason": "duplicate_phone",
                "outcome": "rejected",
            }),
        )
        .await;
        return Err((
            StatusCode::CONFLICT,
            "Hai già pagato per questo tavolo".to_string(),
        ));
    }

    let per_person = (table_total_cost / Decimal::from(table_capacity)).round_dp(2);

    // Insert guest share as checkout_pending to hold the slot
    let share_id: Uuid = sqlx::query_scalar(
        r#"
        INSERT INTO reservation_payment_shares (
            reservation_id, phone_number, guest_name, guest_email, amount, status, is_owner
        )
        VALUES ($1, $2, $3, $4, $5, 'checkout_pending', false)
        RETURNING id
        "#,
    )
    .bind(reservation_id)
    .bind(&req.phone)
    .bind(&req.name)
    .bind(&req.email)
    .bind(per_person)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| {
        tracing::error!(error = %e, "Failed to create guest payment share");
        (StatusCode::INTERNAL_SERVER_ERROR, "Errore".to_string())
    })?;

    tx.commit().await.map_err(|e| {
        tracing::error!(error = %e, "Failed to commit transaction");
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Errore del database".to_string(),
        )
    })?;

    // Fetch event name for Stripe product description
    let event_name: String = sqlx::query_scalar("SELECT title FROM events WHERE id = $1")
        .bind(reservation_event_id)
        .fetch_one(&state.db_pool)
        .await
        .unwrap_or_else(|_| "Evento".to_string());

    let amount_in_cents = (per_person.to_f64().unwrap_or(0.0) * 100.0) as i64;
    let club_connect_config = get_club_connect_config_for_event(&state.db_pool, reservation_event_id)
        .await
        .map_err(|e| {
            tracing::error!(error = %e, event_id = %reservation_event_id, "Failed to load club Connect config");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Errore del database".to_string(),
            )
        })?;

    let mut checkout_params = stripe::CreateCheckoutSession::new();
    checkout_params.mode = Some(stripe::CheckoutSessionMode::Payment);
    checkout_params.line_items = Some(vec![stripe::CreateCheckoutSessionLineItems {
        price_data: Some(stripe::CreateCheckoutSessionLineItemsPriceData {
            currency: Currency::EUR,
            product_data: Some(stripe::CreateCheckoutSessionLineItemsPriceDataProductData {
                name: format!("Tavolo - {}", event_name),
                ..Default::default()
            }),
            unit_amount: Some(amount_in_cents),
            ..Default::default()
        }),
        quantity: Some(1),
        ..Default::default()
    }]);

    let app_base_url = state.config.app_base_url.clone();
    let success_url = format!(
        "{}/payment/success?session_id={{CHECKOUT_SESSION_ID}}",
        app_base_url
    );
    let cancel_url = format!("{}/payment/cancel/{}", app_base_url, token);
    checkout_params.success_url = Some(&success_url);
    checkout_params.cancel_url = Some(&cancel_url);

    if let Some(ref email) = req.email {
        checkout_params.customer_email = Some(email);
    }

    checkout_params.metadata = Some(
        [
            ("payment_share_id".to_string(), share_id.to_string()),
            ("reservation_id".to_string(), reservation_id.to_string()),
        ]
        .into_iter()
        .collect(),
    );

    if let Some(config) = club_connect_config.as_ref().filter(|cfg| can_route_funds_to_connected_account(cfg)) {
        let destination = config
            .stripe_connected_account_id
            .clone()
            .unwrap_or_default();
        let application_fee_amount = compute_application_fee_cents(
            per_person,
            config.platform_commission_percent,
            config.platform_commission_fixed_fee,
        );
        checkout_params.payment_intent_data = Some(CreateCheckoutSessionPaymentIntentData {
            application_fee_amount: Some(application_fee_amount),
            on_behalf_of: Some(destination.clone()),
            transfer_data: Some(CreateCheckoutSessionPaymentIntentDataTransferData {
                amount: None,
                destination,
            }),
            metadata: Some(
                [
                    ("payment_share_id".to_string(), share_id.to_string()),
                    ("reservation_id".to_string(), reservation_id.to_string()),
                ]
                .into_iter()
                .collect(),
            ),
            receipt_email: req.email.clone(),
            ..Default::default()
        });
    }

    let session = stripe::CheckoutSession::create(&state.stripe_client, checkout_params)
        .await
        .map_err(|e| {
            tracing::error!(error = ?e, "Stripe Checkout session creation error");
            (
                StatusCode::BAD_GATEWAY,
                "Errore del servizio di pagamento".to_string(),
            )
        })?;

    // Store checkout session ID on the share
    table_persistence::set_payment_share_checkout_session(
        &state.db_pool,
        share_id,
        &session.id.to_string(),
        Some(req.name.clone()),
        req.email.clone(),
    )
    .await
    .map_err(|e| {
        tracing::error!(error = %e, "Failed to update payment share with checkout session");
        (StatusCode::INTERNAL_SERVER_ERROR, "Errore".to_string())
    })?;

    let checkout_url = session.url.ok_or_else(|| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "URL di checkout non disponibile".to_string(),
        )
    })?;

    tracing::info!(share_id = %share_id, checkout_session_id = %session.id, reservation_id = %reservation_id, "Stripe Checkout Session created for guest");

    let _ = outbox_service::enqueue_analytics_event(
        &state.db_pool,
        &state.config,
        "payment_link_checkout_started",
        Some(&token),
        Some("reservation"),
        Some(reservation_id),
        serde_json::json!({
            "reservation_id": reservation_id,
            "share_id": share_id,
            "event_id": reservation_event_id,
            "outcome": "success",
        }),
    )
    .await;

    Ok(Json(CreateCheckoutResponse { checkout_url }))
}

// ============================================================================
// Reservation Guest Management Endpoints
// ============================================================================

/// GET /reservations/:id/payment-status — Get split payment status
pub async fn get_reservation_payment_status(
    State(state): State<Arc<AppState>>,
    Path(reservation_id): Path<String>,
) -> Result<Json<ReservationPaymentStatusResponse>, StatusCode> {
    let reservation_uuid = Uuid::parse_str(&reservation_id).map_err(|_| StatusCode::BAD_REQUEST)?;

    let reservation = table_persistence::get_reservation_by_id(&state.db_pool, reservation_uuid)
        .await
        .map_err(|_| StatusCode::NOT_FOUND)?;

    let table = table_persistence::get_table_by_id(&state.db_pool, reservation.table_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let shares =
        table_persistence::get_payment_shares_by_reservation(&state.db_pool, reservation_uuid)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let slots_filled = shares
        .iter()
        .filter(|s| !s.is_owner && (s.status == "paid" || s.status == "checkout_pending"))
        .count() as i32;
    let slots_total = table.capacity;

    let amount_remaining = reservation.total_amount - reservation.amount_paid;

    let app_base_url = state.config.app_base_url.clone();
    let share_link = reservation
        .payment_link_token
        .as_ref()
        .map(|token| format!("{}/pay/{}", app_base_url, token));

    let _ = outbox_service::enqueue_analytics_event(
        &state.db_pool,
        &state.config,
        "reservation_payment_status_viewed",
        Some(&reservation_uuid.to_string()),
        Some("reservation"),
        Some(reservation_uuid),
        serde_json::json!({
            "reservation_id": reservation_uuid,
            "slots_filled": slots_filled,
            "slots_total": slots_total,
            "share_count": shares.len(),
            "outcome": "success",
        }),
    )
    .await;

    Ok(Json(ReservationPaymentStatusResponse {
        reservation_id: reservation.id.to_string(),
        total_cost: format!("{:.2} €", reservation.total_amount),
        amount_paid: format!("{:.2} €", reservation.amount_paid),
        amount_remaining: format!("{:.2} €", amount_remaining),
        payment_shares: shares.into_iter().map(|s| s.into()).collect(),
        share_link,
        slots_filled,
        slots_total,
    }))
}

// ============================================================================
// Guest payment web pages
// ============================================================================

/// Serves the guest payment landing page.
/// - If the Pierre app is installed, the deep link opens it automatically.
/// - Otherwise the page falls back to a full web payment flow.
pub async fn guest_payment_page(
    State(state): State<Arc<AppState>>,
    Path(token): Path<String>,
) -> axum::response::Response {
    let base_url = state.config.app_base_url.clone();
    let api_base = base_url.clone();

    let html = format!(
        r#"<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Pierre — Pagamento</title>
  <style>
    *{{box-sizing:border-box;margin:0;padding:0}}
    body{{background:#0f0f0f;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}}
    .card{{background:#1a1a1a;border-radius:16px;padding:32px;max-width:400px;width:100%;box-shadow:0 8px 32px rgba(0,0,0,.5)}}
    h1{{font-size:22px;font-weight:700;margin-bottom:4px}}
    .sub{{color:#9ca3af;font-size:14px;margin-bottom:24px}}
    .detail{{background:#262626;border-radius:10px;padding:16px;margin-bottom:20px}}
    .detail-row{{display:flex;justify-content:space-between;align-items:center;padding:6px 0}}
    .detail-row:not(:last-child){{border-bottom:1px solid #333}}
    .label{{color:#9ca3af;font-size:13px}}
    .value{{font-weight:600;font-size:15px}}
    .amount{{color:#ec4899;font-size:20px;font-weight:700}}
    label{{display:block;font-size:13px;color:#9ca3af;margin-bottom:6px}}
    input{{width:100%;background:#262626;border:1px solid #333;border-radius:8px;padding:12px;color:#fff;font-size:15px;margin-bottom:12px;outline:none}}
    input:focus{{border-color:#ec4899}}
    button{{width:100%;background:#ec4899;color:#fff;border:none;border-radius:10px;padding:14px;font-size:16px;font-weight:600;cursor:pointer;margin-top:4px}}
    button:disabled{{opacity:.5;cursor:not-allowed}}
    .error{{color:#f87171;font-size:13px;margin-top:8px;display:none}}
    .success-icon{{font-size:48px;text-align:center;margin-bottom:16px}}
    #loading{{text-align:center;color:#9ca3af}}
    .spinner{{width:32px;height:32px;border:3px solid #333;border-top-color:#ec4899;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 16px}}
    @keyframes spin{{to{{transform:rotate(360deg)}}}}
    #app-redirect{{text-align:center;display:none}}
    .app-btn{{display:inline-block;background:#ec4899;color:#fff;border-radius:10px;padding:12px 24px;text-decoration:none;font-weight:600;margin-top:12px}}
    .divider{{color:#555;font-size:12px;text-align:center;margin:16px 0;position:relative}}
    .divider::before,.divider::after{{content:'';position:absolute;top:50%;width:42%;height:1px;background:#333}}
    .divider::before{{left:0}}.divider::after{{right:0}}
  </style>
</head>
<body>
<div class="card">
  <!-- Loading state -->
  <div id="loading">
    <div class="spinner"></div>
    <p>Caricamento...</p>
  </div>

  <!-- App redirect banner (shown if app is installed) -->
  <div id="app-redirect">
    <div class="success-icon">📱</div>
    <h1>Apri l'app Pierre</h1>
    <p class="sub">Completa il pagamento direttamente nell'app.</p>
    <a href="pierretwo://pay/{token}" class="app-btn">Apri app Pierre</a>
    <div class="divider">o paga qui sotto</div>
  </div>

  <!-- Preview (hidden until loaded) -->
  <div id="preview" style="display:none">
    <h1>Pagamento tavolo</h1>
    <p class="sub" id="event-sub"></p>
    <div class="detail">
      <div class="detail-row"><span class="label">Evento</span><span class="value" id="ev-name"></span></div>
      <div class="detail-row"><span class="label">Tavolo</span><span class="value" id="tbl-name"></span></div>
      <div class="detail-row"><span class="label">La tua quota</span><span class="amount" id="amount"></span></div>
      <div class="detail-row"><span class="label">Posti</span><span class="value" id="slots"></span></div>
    </div>

    <!-- Table full -->
    <div id="full-msg" style="display:none;text-align:center">
      <div class="success-icon">🚫</div>
      <p style="color:#f87171;font-weight:600">Tavolo al completo</p>
      <p class="sub" style="margin-top:8px">Tutti i posti sono stati occupati.</p>
    </div>

    <!-- Checkout form -->
    <div id="checkout-form">
      <label>Nome *</label>
      <input id="name-input" type="text" placeholder="Il tuo nome" required/>
      <label>Telefono *</label>
      <input id="phone-input" type="tel" placeholder="+39 333 123 4567" required/>
      <label>Email per ricevuta (opzionale)</label>
      <input id="checkout-email" type="email" placeholder="La tua email"/>
      <button id="pay-btn" onclick="doPay()">Paga ora</button>
      <div class="error" id="pay-error"></div>
    </div>
  </div>
</div>

<script>
  const TOKEN = "{token}";
  const API = "{api_base}";

  // 1. Try deep link immediately
  const deepLink = "pierretwo://pay/" + TOKEN;
  const appAttemptTime = Date.now();
  window.location.href = deepLink;

  // 2. After 1.5s if still here, app not installed — show web UI
  setTimeout(function() {{
    if (Date.now() - appAttemptTime < 3000) {{
      fetchPreview();
    }}
  }}, 1500);

  fetchPreview();

  async function fetchPreview() {{
    if (document.getElementById('preview').style.display === 'block') return;
    try {{
      const res = await fetch(API + "/payment-links/" + TOKEN);
      if (!res.ok) {{ showError("Link non valido o scaduto."); return; }}
      const data = await res.json();

      document.getElementById('loading').style.display = 'none';
      document.getElementById('preview').style.display = 'block';
      document.getElementById('ev-name').textContent = data.eventName || data.event_name || '';
      document.getElementById('tbl-name').textContent = data.tableName || data.table_name || '';
      document.getElementById('amount').textContent = data.amount || '';
      document.getElementById('event-sub').textContent = (data.tableName || data.table_name || '') + ' · ' + (data.amount || '');
      const sf = data.slotsFilled ?? data.slots_filled ?? 0;
      const st = data.slotsTotal ?? data.slots_total ?? 0;
      document.getElementById('slots').textContent = sf + '/' + st + ' occupati';

      if ((data.status || '') === 'full') {{
        document.getElementById('full-msg').style.display = 'block';
        document.getElementById('checkout-form').style.display = 'none';
      }}
    }} catch(e) {{
      showError("Errore di rete. Riprova.");
    }}
  }}

  async function doPay() {{
    const name = document.getElementById('name-input').value.trim();
    const phone = document.getElementById('phone-input').value.trim();
    const email = document.getElementById('checkout-email').value.trim();
    if (!name) {{ showPayError("Il nome è obbligatorio."); return; }}
    if (!phone) {{ showPayError("Il numero di telefono è obbligatorio."); return; }}
    const btn = document.getElementById('pay-btn');
    btn.disabled = true; btn.textContent = "Reindirizzamento a Stripe...";
    try {{
      const res = await fetch(API + "/payment-links/" + TOKEN + "/checkout", {{
        method: "POST",
        headers: {{"Content-Type": "application/json"}},
        body: JSON.stringify({{ name, phone, email: email || null }})
      }});
      if (res.status === 409) {{
        document.getElementById('checkout-form').style.display = 'none';
        document.getElementById('full-msg').style.display = 'block';
        return;
      }}
      if (!res.ok) {{
        showPayError("Impossibile avviare il pagamento. Riprova.");
        btn.disabled = false; btn.textContent = "Paga ora";
        return;
      }}
      const data = await res.json();
      const url = data.checkoutUrl || data.checkout_url;
      if (url) {{ window.location.href = url; }}
      else {{ showPayError("URL di pagamento non ricevuto."); btn.disabled = false; btn.textContent = "Paga ora"; }}
    }} catch(e) {{
      showPayError("Errore di rete. Riprova.");
      btn.disabled = false; btn.textContent = "Paga ora";
    }}
  }}

  function showError(msg) {{
    document.getElementById('loading').innerHTML = '<p style="color:#f87171">' + msg + '</p>';
  }}
  function showPayError(msg) {{
    const el = document.getElementById('pay-error');
    el.textContent = msg; el.style.display = 'block';
  }}
</script>
</body>
</html>"#,
        token = token,
        api_base = api_base
    );

    axum::response::Response::builder()
        .status(200)
        .header("Content-Type", "text/html; charset=utf-8")
        .body(axum::body::Body::from(html))
        .unwrap()
}

/// Simple success page shown after Stripe Checkout completes.
pub async fn payment_success_page() -> axum::response::Response {
    let html = r#"<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Pagamento completato</title>
  <style>
    body{background:#0f0f0f;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center}
    .card{background:#1a1a1a;border-radius:16px;padding:40px 32px;max-width:360px;width:100%}
    .icon{font-size:56px;margin-bottom:20px}
    h1{font-size:22px;font-weight:700;color:#4ade80;margin-bottom:8px}
    p{color:#9ca3af;font-size:15px;line-height:1.5}
    a{display:inline-block;margin-top:24px;background:#ec4899;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:600}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✅</div>
    <h1>Pagamento completato!</h1>
    <p>Il tuo pagamento è stato ricevuto. Riceverai una conferma a breve.<br/><br/>Puoi chiudere questa pagina.</p>
    <a href="pierretwo://">Apri l'app Pierre</a>
  </div>
</body>
</html>"#;

    axum::response::Response::builder()
        .status(200)
        .header("Content-Type", "text/html; charset=utf-8")
        .body(axum::body::Body::from(html))
        .unwrap()
}

/// Simple cancel page shown if the guest exits Stripe Checkout without paying.
pub async fn payment_cancel_page(
    State(state): State<Arc<AppState>>,
    Path(token): Path<String>,
) -> axum::response::Response {
    let base_url = state.config.app_base_url.clone();
    let pay_url = format!("{}/pay/{}", base_url, token);

    let html = format!(
        r#"<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Pagamento annullato</title>
  <style>
    body{{background:#0f0f0f;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center}}
    .card{{background:#1a1a1a;border-radius:16px;padding:40px 32px;max-width:360px;width:100%}}
    .icon{{font-size:56px;margin-bottom:20px}}
    h1{{font-size:22px;font-weight:700;margin-bottom:8px}}
    p{{color:#9ca3af;font-size:15px;line-height:1.5}}
    a{{display:inline-block;margin-top:24px;background:#ec4899;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:600}}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">↩️</div>
    <h1>Pagamento annullato</h1>
    <p>Non è stato addebitato nulla. Il link rimane valido, puoi riprovare quando vuoi.</p>
    <a href="{pay_url}">Riprova</a>
  </div>
</body>
</html>"#,
        pay_url = pay_url
    );

    axum::response::Response::builder()
        .status(200)
        .header("Content-Type", "text/html; charset=utf-8")
        .body(axum::body::Body::from(html))
        .unwrap()
}
