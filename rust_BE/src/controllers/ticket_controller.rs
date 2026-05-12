use crate::application::ticket_service as ticket_persistence;
use crate::middleware::auth::{AuthUser, ClubOwnerUser};
use crate::models::{
    normalize_ticketing_mode, AppState, ClaimFreeTicketRequest, ConfirmTicketPurchaseRequest,
    CreateTicketPurchaseIntentRequest, CreateTicketRequest, PaginationParams,
    TicketPurchaseIntentResponse, TicketResponse, TicketWithEventResponse, UpdateTicketRequest,
};
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use rust_decimal::prelude::ToPrimitive;
use rust_decimal::Decimal;
use serde::Serialize;
use std::sync::Arc;
use std::str::FromStr;
use stripe::{CreatePaymentIntent, Currency, PaymentIntent, PaymentIntentStatus};
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
    let fee = (percent_fee + fixed_fee)
        .max(Decimal::ZERO)
        .min(total_amount);
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

fn parse_ticket_price(raw_price: Option<&str>) -> Option<Decimal> {
    let cleaned = raw_price?
        .trim()
        .replace('€', "")
        .replace(' ', "")
        .replace(',', ".");
    if cleaned.is_empty() {
        return None;
    }

    Decimal::from_str(&cleaned).ok()
}

fn resolve_event_ticketing_mode(event: &crate::models::Event) -> String {
    normalize_ticketing_mode(
        event.ticketing_mode.clone(),
        event.entry_type.as_deref(),
        event.price.as_deref(),
    )
}

#[derive(Serialize)]
pub struct TicketsResponse {
    pub tickets: Vec<TicketResponse>,
}

#[derive(Serialize)]
pub struct TicketsWithEventsResponse {
    pub tickets: Vec<TicketWithEventResponse>,
}

/// Create a Stripe PaymentIntent for a consumer ticket purchase.
pub async fn create_ticket_purchase_intent(
    AuthUser(claims): AuthUser,
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateTicketPurchaseIntentRequest>,
) -> Result<Json<TicketPurchaseIntentResponse>, (StatusCode, String)> {
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| (StatusCode::UNAUTHORIZED, "Utente non autorizzato".to_string()))?;
    let event_id = Uuid::parse_str(&payload.event_id)
        .map_err(|_| (StatusCode::BAD_REQUEST, "ID evento non valido".to_string()))?;

    let event = crate::application::event_service::get_event_by_id(&state.read_db_pool, event_id)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Errore del database".to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Evento non trovato".to_string()))?;

    let ticketing_mode = resolve_event_ticketing_mode(&event);
    if ticketing_mode != "paid" {
        return Err((
            StatusCode::BAD_REQUEST,
            "Questo evento non prevede un ticket a pagamento".to_string(),
        ));
    }

    let ticket_price = parse_ticket_price(event.price.as_deref())
        .ok_or((StatusCode::BAD_REQUEST, "Prezzo ticket non configurato".to_string()))?;

    let has_active_ticket: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM tickets WHERE event_id = $1 AND user_id = $2 AND status = 'active')",
    )
    .bind(event_id)
    .bind(user_id)
    .fetch_one(&state.read_db_pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Errore del database".to_string()))?;

    if has_active_ticket {
        return Err((StatusCode::CONFLICT, "Hai gia un ticket attivo per questo evento".to_string()));
    }

    let amount_cents = ((ticket_price.to_f64().unwrap_or(0.0) * 100.0).round()) as i64;
    if amount_cents <= 0 {
        return Err((StatusCode::BAD_REQUEST, "Prezzo ticket non valido".to_string()));
    }

    let mut params = CreatePaymentIntent::new(amount_cents, Currency::EUR);
    params.payment_method_types = Some(vec!["card".to_string()]);
    params.metadata = Some(
        [
            ("event_id".to_string(), event_id.to_string()),
            ("user_id".to_string(), user_id.to_string()),
            ("purchase_type".to_string(), "ticket".to_string()),
        ]
        .into_iter()
        .collect(),
    );

    let club_connect_config = get_club_connect_config_for_event(&state.db_pool, event_id)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Errore del database".to_string()))?;
    let connect_destination_for_on_behalf_of = club_connect_config
        .as_ref()
        .filter(|cfg| can_route_funds_to_connected_account(cfg))
        .and_then(|cfg| cfg.stripe_connected_account_id.clone());

    if let Some(config) = club_connect_config
        .as_ref()
        .filter(|cfg| can_route_funds_to_connected_account(cfg))
    {
        let destination = config
            .stripe_connected_account_id
            .clone()
            .unwrap_or_default();
        params.application_fee_amount = Some(compute_application_fee_cents(
            ticket_price,
            config.platform_commission_percent,
            config.platform_commission_fixed_fee,
        ));
        params.on_behalf_of = connect_destination_for_on_behalf_of.as_deref();
        params.transfer_data = Some(stripe::CreatePaymentIntentTransferData {
            amount: None,
            destination,
        });
    }

    let payment_intent = PaymentIntent::create(&state.stripe_client, params)
        .await
        .map_err(|error| {
            warn!(error = ?error, %event_id, %user_id, "Failed to create ticket payment intent");
            (
                StatusCode::BAD_GATEWAY,
                "Errore del servizio di pagamento".to_string(),
            )
        })?;

    let client_secret = payment_intent.client_secret.ok_or((
        StatusCode::INTERNAL_SERVER_ERROR,
        "Risposta di pagamento non valida".to_string(),
    ))?;

    Ok(Json(TicketPurchaseIntentResponse {
        client_secret,
        payment_intent_id: payment_intent.id.to_string(),
        stripe_publishable_key: state.config.stripe.publishable_key.clone(),
        amount: format!("{:.2} €", ticket_price),
    }))
}

/// Claim a free consumer ticket without payment.
pub async fn claim_free_ticket(
    AuthUser(claims): AuthUser,
    State(state): State<Arc<AppState>>,
    Json(payload): Json<ClaimFreeTicketRequest>,
) -> Result<(StatusCode, Json<TicketResponse>), (StatusCode, String)> {
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| (StatusCode::UNAUTHORIZED, "Utente non autorizzato".to_string()))?;
    let event_id = Uuid::parse_str(&payload.event_id)
        .map_err(|_| (StatusCode::BAD_REQUEST, "ID evento non valido".to_string()))?;

    let event = crate::application::event_service::get_event_by_id(&state.read_db_pool, event_id)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Errore del database".to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Evento non trovato".to_string()))?;

    let ticketing_mode = resolve_event_ticketing_mode(&event);
    if ticketing_mode != "free" {
        return Err((
            StatusCode::BAD_REQUEST,
            "Questo evento non prevede ticket gratuiti".to_string(),
        ));
    }

    let has_active_ticket: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM tickets WHERE event_id = $1 AND user_id = $2 AND status = 'active')",
    )
    .bind(event_id)
    .bind(user_id)
    .fetch_one(&state.read_db_pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Errore del database".to_string()))?;

    if has_active_ticket {
        return Err((
            StatusCode::CONFLICT,
            "Hai gia un ticket attivo per questo evento".to_string(),
        ));
    }

    let ticket = ticket_persistence::create_ticket(
        &state.db_pool,
        CreateTicketRequest {
            event_id,
            user_id,
            ticket_type: "event".to_string(),
            price: Decimal::ZERO,
            status: Some("active".to_string()),
            qr_code: None,
        },
    )
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Errore creazione ticket".to_string()))?;

    Ok((StatusCode::CREATED, Json(ticket.into())))
}

/// Confirm a paid consumer ticket purchase and persist the ticket.
pub async fn confirm_ticket_purchase(
    AuthUser(claims): AuthUser,
    State(state): State<Arc<AppState>>,
    Json(payload): Json<ConfirmTicketPurchaseRequest>,
) -> Result<(StatusCode, Json<TicketResponse>), (StatusCode, String)> {
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| (StatusCode::UNAUTHORIZED, "Utente non autorizzato".to_string()))?;
    let event_id = Uuid::parse_str(&payload.event_id)
        .map_err(|_| (StatusCode::BAD_REQUEST, "ID evento non valido".to_string()))?;

    let event = crate::application::event_service::get_event_by_id(&state.read_db_pool, event_id)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Errore del database".to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Evento non trovato".to_string()))?;

    let ticketing_mode = resolve_event_ticketing_mode(&event);
    if ticketing_mode != "paid" {
        return Err((
            StatusCode::BAD_REQUEST,
            "Questo evento non prevede un ticket a pagamento".to_string(),
        ));
    }

    let ticket_price = parse_ticket_price(event.price.as_deref())
        .ok_or((StatusCode::BAD_REQUEST, "Prezzo ticket non configurato".to_string()))?;

    let expected_amount = ((ticket_price.to_f64().unwrap_or(0.0) * 100.0).round()) as i64;
    let payment_intent_id: stripe::PaymentIntentId = payload
        .stripe_payment_intent_id
        .parse()
        .map_err(|_| (StatusCode::BAD_REQUEST, "PaymentIntent non valido".to_string()))?;

    let payment_intent = PaymentIntent::retrieve(&state.stripe_client, &payment_intent_id, &[])
        .await
        .map_err(|_| (StatusCode::BAD_GATEWAY, "Errore del servizio di pagamento".to_string()))?;

    if payment_intent.status != PaymentIntentStatus::Succeeded {
        return Err((StatusCode::BAD_REQUEST, "Pagamento non completato".to_string()));
    }

    if payment_intent.amount != expected_amount {
        return Err((StatusCode::BAD_REQUEST, "Importo ticket non corrispondente".to_string()));
    }

    let has_active_ticket: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM tickets WHERE event_id = $1 AND user_id = $2 AND status = 'active')",
    )
    .bind(event_id)
    .bind(user_id)
    .fetch_one(&state.read_db_pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Errore del database".to_string()))?;

    if has_active_ticket {
        return Err((StatusCode::CONFLICT, "Hai gia un ticket attivo per questo evento".to_string()));
    }

    let ticket = ticket_persistence::create_ticket(
        &state.db_pool,
        CreateTicketRequest {
            event_id,
            user_id,
            ticket_type: "event".to_string(),
            price: ticket_price,
            status: Some("active".to_string()),
            qr_code: None,
        },
    )
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Errore creazione ticket".to_string()))?;

    Ok((StatusCode::CREATED, Json(ticket.into())))
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
