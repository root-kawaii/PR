use crate::application::{
    club_owner_service as club_owner_persistence, club_service as club_persistence,
    event_service as event_persistence, outbox_service, reservation_service as table_persistence,
};
use crate::middleware::auth::ClubOwnerUser;
use crate::models::club_owner::{
    AddImageRequest, CheckinDecisionRequest, ClubImageRow, ClubOwnerAuthResponse,
    ClubOwnerLoginRequest, ClubOwnerRegisterRequest, ClubOwnerResponse,
    CreateManualReservationRequest, DuplicateTablesRequest, EventReservationStatsResponse,
    OwnerStats, OwnerUpdateClubRequest, OwnerUpdateReservationRequest, ScanResult,
    StripeConnectStatusResponse, StripeOnboardingLinkResponse, TableImageRow,
    UpdateReservationStatusRequest,
};
use crate::models::table::TableReservationResponse;
use crate::models::{
    ApiError, AppState, ClubResponse, CreateClubRequest, CreateEventRequest, CreateTableRequest,
    EventResponse, TableResponse, TablesResponse, UpdateClubRequest, UpdateEventRequest,
};
use crate::utils::jwt;
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use chrono::NaiveDate;
use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct EventFilterParams {
    pub from_date: Option<NaiveDate>,
}
use bcrypt::{hash, verify, DEFAULT_COST};
use rust_decimal::Decimal;
use std::sync::Arc;
use stripe::{
    Account, AccountLink, AccountLinkType, AccountType, CreateAccount, CreateAccountCapabilities,
    CreateAccountCapabilitiesCardPayments, CreateAccountCapabilitiesTransfers, CreateAccountLink,
};
use tracing::{error, warn};
use uuid::Uuid;

/// Register a new club owner and create their club
pub async fn register_club_owner(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<ClubOwnerRegisterRequest>,
) -> Result<(StatusCode, Json<ClubOwnerAuthResponse>), StatusCode> {
    // Validate email format
    if !payload.email.contains('@') {
        return Err(StatusCode::BAD_REQUEST);
    }

    // Validate password strength
    if payload.password.len() < 6 {
        return Err(StatusCode::BAD_REQUEST);
    }

    // Check if club owner already exists
    match club_owner_persistence::find_club_owner_by_email(&state.db_pool, &payload.email).await {
        Ok(Some(_)) => return Err(StatusCode::CONFLICT),
        Ok(None) => {}
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    }

    // Hash the password
    let password_hash =
        hash(payload.password, DEFAULT_COST).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Create the club owner
    let owner = club_owner_persistence::create_club_owner(
        &state.db_pool,
        payload.email.clone(),
        password_hash,
        payload.name,
        payload.phone_number,
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Create the club associated with this owner
    let club_request = CreateClubRequest {
        name: payload.club_name,
        subtitle: payload.club_subtitle,
        image: payload.club_image,
        address: payload.club_address,
        phone_number: None,
        website: None,
        owner_id: Some(owner.id),
        stripe_connected_account_id: None,
        stripe_onboarding_complete: Some(false),
        stripe_charges_enabled: Some(false),
        stripe_payouts_enabled: Some(false),
        platform_commission_percent: Some(Decimal::ZERO),
        platform_commission_fixed_fee: Some(Decimal::ZERO),
    };

    let club = club_persistence::create_club(&state.db_pool, club_request)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Generate JWT token with club_owner role
    let token = jwt::generate_token(
        owner.id,
        owner.email.clone(),
        "club_owner".to_string(),
        &state.jwt_secret,
    )
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let response = ClubOwnerAuthResponse {
        owner: ClubOwnerResponse::from(owner),
        club: Some(ClubResponse::from(club)),
        token,
    };

    Ok((StatusCode::CREATED, Json(response)))
}

/// Login as a club owner
pub async fn login_club_owner(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<ClubOwnerLoginRequest>,
) -> Result<Json<ClubOwnerAuthResponse>, StatusCode> {
    // Find club owner by email
    let owner = match club_owner_persistence::find_club_owner_by_email(
        &state.db_pool,
        &payload.email,
    )
    .await
    {
        Ok(Some(owner)) => owner,
        Ok(None) => return Err(StatusCode::UNAUTHORIZED),
        Err(e) => {
            tracing::error!("login_club_owner: DB error: {:?}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    // Verify password
    let is_valid = verify(payload.password, &owner.password_hash).map_err(|e| {
        tracing::error!("login_club_owner: bcrypt error: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    if !is_valid {
        return Err(StatusCode::UNAUTHORIZED);
    }

    // Look up the owner's club
    let club = club_persistence::get_club_by_owner_id(&state.db_pool, owner.id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Generate JWT token
    let token = jwt::generate_token(
        owner.id,
        owner.email.clone(),
        "club_owner".to_string(),
        &state.jwt_secret,
    )
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let owner_id = owner.id;
    let club_id = club.as_ref().map(|club| club.id);
    let response = ClubOwnerAuthResponse {
        owner: ClubOwnerResponse::from(owner),
        club: club.map(ClubResponse::from),
        token,
    };

    let _ = outbox_service::enqueue_analytics_event(
        &state.db_pool,
        &state.config,
        "owner_logged_in",
        Some(&owner_id.to_string()),
        Some("club_owner"),
        Some(owner_id),
        serde_json::json!({
            "owner_id": owner_id,
            "club_id": club_id,
            "outcome": "success",
        }),
    )
    .await;

    Ok(Json(response))
}

#[derive(Debug, serde::Deserialize)]
pub struct ChangeClubOwnerPasswordRequest {
    pub current_password: String,
    pub new_password: String,
}

#[derive(Debug, serde::Serialize)]
pub struct ChangeClubOwnerPasswordResponse {
    pub message: String,
}

/// Change the authenticated club owner's password.
pub async fn change_club_owner_password(
    State(state): State<Arc<AppState>>,
    ClubOwnerUser(claims): ClubOwnerUser,
    Json(payload): Json<ChangeClubOwnerPasswordRequest>,
) -> Result<Json<ChangeClubOwnerPasswordResponse>, StatusCode> {
    let owner_id = Uuid::parse_str(&claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;

    if payload.current_password.trim().is_empty() || payload.new_password.len() < 8 {
        return Err(StatusCode::BAD_REQUEST);
    }

    if payload.current_password == payload.new_password {
        return Err(StatusCode::BAD_REQUEST);
    }

    let owner = club_owner_persistence::find_club_owner_by_id(&state.db_pool, owner_id)
        .await
        .map_err(|error| {
            error!(%error, %owner_id, "Failed to load club owner for password change");
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or(StatusCode::NOT_FOUND)?;

    let is_valid = verify(&payload.current_password, &owner.password_hash).map_err(|error| {
        error!(%error, %owner_id, "bcrypt verify error during club owner password change");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    if !is_valid {
        return Err(StatusCode::UNAUTHORIZED);
    }

    let new_password_hash = hash(payload.new_password, DEFAULT_COST).map_err(|error| {
        error!(%error, %owner_id, "Failed to hash new club owner password");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    club_owner_persistence::update_club_owner_password_hash(
        &state.db_pool,
        owner_id,
        &new_password_hash,
    )
    .await
    .map_err(|error| {
        error!(%error, %owner_id, "Failed to update club owner password hash");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let _ = outbox_service::enqueue_analytics_event(
        &state.db_pool,
        &state.config,
        "password_changed",
        Some(&owner_id.to_string()),
        Some("club_owner"),
        Some(owner_id),
        serde_json::json!({
            "owner_id": owner_id,
            "outcome": "success",
        }),
    )
    .await;

    Ok(Json(ChangeClubOwnerPasswordResponse {
        message: "Password aggiornata correttamente.".to_string(),
    }))
}

/// Get the authenticated club owner's club
pub async fn get_my_club(
    State(state): State<Arc<AppState>>,
    ClubOwnerUser(claims): ClubOwnerUser,
) -> Result<Json<ClubResponse>, StatusCode> {
    let owner_id = Uuid::parse_str(&claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;

    let club = club_persistence::get_club_by_owner_id(&state.db_pool, owner_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(ClubResponse::from(club)))
}

/// Get all events for the authenticated club owner's club.
/// Accepts optional `?from_date=YYYY-MM-DD` to filter server-side.
pub async fn get_my_club_events(
    State(state): State<Arc<AppState>>,
    ClubOwnerUser(claims): ClubOwnerUser,
    Query(params): Query<EventFilterParams>,
) -> Result<Json<Vec<EventResponse>>, StatusCode> {
    let owner_id = Uuid::parse_str(&claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;

    let club = club_persistence::get_club_by_owner_id(&state.db_pool, owner_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    let events =
        event_persistence::get_events_by_club_id(&state.db_pool, club.id, params.from_date)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let event_ids: Vec<uuid::Uuid> = events.iter().map(|e| e.id).collect();
    let genres_map = event_persistence::get_genres_for_events(&state.db_pool, &event_ids)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let responses: Vec<EventResponse> = events
        .into_iter()
        .map(|e| {
            let id = e.id;
            let mut r = EventResponse::from(e);
            r.genres = genres_map.get(&id).cloned().unwrap_or_default();
            r
        })
        .collect();
    Ok(Json(responses))
}

/// Create an event for the authenticated club owner's club
pub async fn create_club_event(
    State(state): State<Arc<AppState>>,
    ClubOwnerUser(claims): ClubOwnerUser,
    Json(mut payload): Json<CreateEventRequest>,
) -> Result<(StatusCode, Json<EventResponse>), StatusCode> {
    let owner_id = Uuid::parse_str(&claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;
    if !crate::models::is_valid_event_image_url(&payload.image) {
        return Err(StatusCode::BAD_REQUEST);
    }

    let club = club_persistence::get_club_by_owner_id(&state.db_pool, owner_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    // Force club_id to the owner's club
    payload.club_id = Some(club.id);
    let genre_ids = payload.genre_ids.clone().unwrap_or_default();

    let event = event_persistence::create_event(&state.db_pool, payload)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if !genre_ids.is_empty() {
        event_persistence::set_event_genres(&state.db_pool, event.id, &genre_ids)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    }

    let genres = event_persistence::get_event_genres(&state.db_pool, event.id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let _ = outbox_service::enqueue_analytics_event(
        &state.db_pool,
        &state.config,
        "owner_event_created",
        Some(&claims.sub),
        Some("event"),
        Some(event.id),
        serde_json::json!({
            "owner_id": claims.sub,
            "club_id": club.id,
            "event_id": event.id,
            "outcome": "success",
        }),
    )
    .await;

    let mut response = EventResponse::from(event);
    response.genres = genres;
    Ok((StatusCode::CREATED, Json(response)))
}

/// Get tables for a specific event owned by the club owner
pub async fn get_my_club_tables(
    State(state): State<Arc<AppState>>,
    ClubOwnerUser(claims): ClubOwnerUser,
    Path(event_id): Path<String>,
) -> Result<Json<TablesResponse>, StatusCode> {
    let owner_id = Uuid::parse_str(&claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;
    let event_uuid = Uuid::parse_str(&event_id).map_err(|_| StatusCode::BAD_REQUEST)?;

    // Verify the event belongs to the owner's club
    let club = club_persistence::get_club_by_owner_id(&state.db_pool, owner_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    let event = event_persistence::get_event_by_id(&state.db_pool, event_uuid)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    if event.club_id != Some(club.id) {
        return Err(StatusCode::FORBIDDEN);
    }

    let tables = table_persistence::get_tables_by_event_id(&state.db_pool, event_uuid)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let table_responses: Vec<TableResponse> = tables.into_iter().map(|t| t.into()).collect();
    Ok(Json(TablesResponse {
        tables: table_responses,
    }))
}

/// Create a table for an event owned by the club owner
pub async fn create_club_table(
    State(state): State<Arc<AppState>>,
    ClubOwnerUser(claims): ClubOwnerUser,
    Path(event_id): Path<String>,
    Json(req): Json<CreateTableRequest>,
) -> Result<(StatusCode, Json<TableResponse>), StatusCode> {
    let owner_id = Uuid::parse_str(&claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;
    let event_uuid = Uuid::parse_str(&event_id).map_err(|_| StatusCode::BAD_REQUEST)?;

    // Verify the event belongs to the owner's club
    let club = club_persistence::get_club_by_owner_id(&state.db_pool, owner_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    let event = event_persistence::get_event_by_id(&state.db_pool, event_uuid)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    if event.club_id != Some(club.id) {
        return Err(StatusCode::FORBIDDEN);
    }

    let min_spend = Decimal::from_f64_retain(req.min_spend).ok_or(StatusCode::BAD_REQUEST)?;

    let table = table_persistence::create_table(
        &state.db_pool,
        event_uuid,
        req.name,
        req.zone,
        req.capacity,
        min_spend,
        req.location_description,
        req.features,
        req.marzipano_position,
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let _ = outbox_service::enqueue_analytics_event(
        &state.db_pool,
        &state.config,
        "owner_table_created",
        Some(&claims.sub),
        Some("table"),
        Some(table.id),
        serde_json::json!({
            "owner_id": claims.sub,
            "event_id": event_uuid,
            "table_id": table.id,
            "capacity": table.capacity,
            "outcome": "success",
        }),
    )
    .await;

    Ok((StatusCode::CREATED, Json(TableResponse::from(table))))
}

/// Update the authenticated club owner's club settings
pub async fn update_my_club(
    State(state): State<Arc<AppState>>,
    ClubOwnerUser(claims): ClubOwnerUser,
    Json(payload): Json<OwnerUpdateClubRequest>,
) -> Result<Json<ClubResponse>, StatusCode> {
    let owner_id = Uuid::parse_str(&claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;

    let club = club_persistence::get_club_by_owner_id(&state.db_pool, owner_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    let update_req = UpdateClubRequest {
        name: payload.name,
        subtitle: payload.subtitle,
        image: None,
        address: payload.address,
        phone_number: payload.phone_number,
        website: payload.website,
        owner_id: None,
        stripe_connected_account_id: None,
        stripe_onboarding_complete: None,
        stripe_charges_enabled: None,
        stripe_payouts_enabled: None,
        platform_commission_percent: None,
        platform_commission_fixed_fee: None,
    };

    let updated = club_persistence::update_club(&state.db_pool, club.id, update_req)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    let _ = outbox_service::enqueue_analytics_event(
        &state.db_pool,
        &state.config,
        "owner_club_updated",
        Some(&claims.sub),
        Some("club"),
        Some(updated.id),
        serde_json::json!({
            "owner_id": claims.sub,
            "club_id": updated.id,
            "outcome": "success",
        }),
    )
    .await;

    Ok(Json(ClubResponse::from(updated)))
}

/// Get the authenticated club owner's current Stripe Connect status.
pub async fn get_my_club_stripe_status(
    State(state): State<Arc<AppState>>,
    ClubOwnerUser(claims): ClubOwnerUser,
) -> Result<Json<StripeConnectStatusResponse>, StatusCode> {
    let owner_id = Uuid::parse_str(&claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;

    let club = club_persistence::get_club_by_owner_id(&state.db_pool, owner_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    let connected_account_id = club.stripe_connected_account_id.clone();
    if let Some(ref account_id) = connected_account_id {
        let account_id = account_id
            .parse()
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        let account = Account::retrieve(&state.stripe_client, &account_id, &[])
            .await
            .map_err(|_| StatusCode::BAD_GATEWAY)?;

        let updated = club_persistence::update_club(
            &state.db_pool,
            club.id,
            UpdateClubRequest {
                name: None,
                subtitle: None,
                image: None,
                address: None,
                phone_number: None,
                website: None,
                owner_id: None,
                stripe_connected_account_id: Some(account.id.to_string()),
                stripe_onboarding_complete: Some(account.details_submitted.unwrap_or(false)),
                stripe_charges_enabled: Some(account.charges_enabled.unwrap_or(false)),
                stripe_payouts_enabled: Some(account.payouts_enabled.unwrap_or(false)),
                platform_commission_percent: None,
                platform_commission_fixed_fee: None,
            },
        )
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

        return Ok(Json(StripeConnectStatusResponse {
            connected_account_id: updated.stripe_connected_account_id,
            onboarding_complete: updated.stripe_onboarding_complete.unwrap_or(false),
            charges_enabled: updated.stripe_charges_enabled.unwrap_or(false),
            payouts_enabled: updated.stripe_payouts_enabled.unwrap_or(false),
            details_submitted: updated.stripe_onboarding_complete.unwrap_or(false),
            platform_commission_percent: updated.platform_commission_percent,
            platform_commission_fixed_fee: updated.platform_commission_fixed_fee,
        }));
    }

    Ok(Json(StripeConnectStatusResponse {
        connected_account_id,
        onboarding_complete: club.stripe_onboarding_complete.unwrap_or(false),
        charges_enabled: club.stripe_charges_enabled.unwrap_or(false),
        payouts_enabled: club.stripe_payouts_enabled.unwrap_or(false),
        details_submitted: club.stripe_onboarding_complete.unwrap_or(false),
        platform_commission_percent: club.platform_commission_percent,
        platform_commission_fixed_fee: club.platform_commission_fixed_fee,
    }))
}

/// Create or reuse a Stripe Connect Express account and return an onboarding link.
pub async fn create_my_club_stripe_onboarding_link(
    State(state): State<Arc<AppState>>,
    ClubOwnerUser(claims): ClubOwnerUser,
) -> Result<Json<StripeOnboardingLinkResponse>, (StatusCode, Json<ApiError>)> {
    let owner_id = Uuid::parse_str(&claims.sub).map_err(|_| {
        ApiError::new(
            StatusCode::UNAUTHORIZED,
            "Sessione non valida. Ricarica la pagina ed effettua di nuovo l'accesso.",
        )
    })?;

    let owner = club_owner_persistence::find_club_owner_by_id(&state.db_pool, owner_id)
        .await
        .map_err(|error| {
            error!(owner_id = %owner_id, ?error, "Failed to load club owner for Stripe onboarding");
            ApiError::new(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Non sono riuscito a recuperare il profilo del proprietario.",
            )
        })?
        .ok_or_else(|| {
            ApiError::new(StatusCode::NOT_FOUND, "Proprietario del club non trovato.")
        })?;

    let club = club_persistence::get_club_by_owner_id(&state.db_pool, owner_id)
        .await
        .map_err(|error| {
            error!(owner_id = %owner_id, ?error, "Failed to load club for Stripe onboarding");
            ApiError::new(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Non sono riuscito a recuperare il club collegato a questo account.",
            )
        })?
        .ok_or_else(|| {
            ApiError::new(
                StatusCode::NOT_FOUND,
                "Nessun club trovato per questo account proprietario.",
            )
        })?;

    let account = if let Some(existing_id) = &club.stripe_connected_account_id {
        let parsed = existing_id
            .parse()
            .map_err(|error| {
                error!(
                    owner_id = %owner_id,
                    club_id = %club.id,
                    stripe_connected_account_id = %existing_id,
                    ?error,
                    "Failed to parse stored Stripe connected account id"
                );
                ApiError::new(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "L'account Stripe salvato per questo club non e valido. Serve correggere il collegamento Stripe nel database.",
                )
            })?;
        Account::retrieve(&state.stripe_client, &parsed, &[])
            .await
            .map_err(|error| {
                error!(
                    owner_id = %owner_id,
                    club_id = %club.id,
                    stripe_connected_account_id = %existing_id,
                    ?error,
                    "Failed to retrieve Stripe connected account"
                );
                ApiError::new(
                    StatusCode::BAD_GATEWAY,
                    "Stripe non ha accettato il recupero dell'account collegato. Controlla che le chiavi Stripe siano corrette e che l'account esista ancora.",
                )
            })?
    } else {
        let mut params = CreateAccount::new();
        params.type_ = Some(AccountType::Express);
        params.country = Some("IT");
        params.default_currency = Some(stripe::Currency::EUR);
        params.email = Some(&owner.email);
        params.capabilities = Some(CreateAccountCapabilities {
            card_payments: Some(CreateAccountCapabilitiesCardPayments {
                requested: Some(true),
            }),
            transfers: Some(CreateAccountCapabilitiesTransfers {
                requested: Some(true),
            }),
            ..Default::default()
        });

        let mut metadata = std::collections::HashMap::new();
        metadata.insert("club_id".to_string(), club.id.to_string());
        metadata.insert("owner_id".to_string(), owner.id.to_string());
        params.metadata = Some(metadata);

        Account::create(&state.stripe_client, params)
            .await
            .map_err(|error| {
                error!(
                    owner_id = %owner_id,
                    club_id = %club.id,
                    owner_email = %owner.email,
                    ?error,
                    "Failed to create Stripe connected account"
                );
                ApiError::new(
                    StatusCode::BAD_GATEWAY,
                    "Stripe ha rifiutato la creazione dell'account Express. Verifica le chiavi Stripe del backend e la configurazione Stripe Connect.",
                )
            })?
    };

    let updated = club_persistence::update_club(
        &state.db_pool,
        club.id,
        UpdateClubRequest {
            name: None,
            subtitle: None,
            image: None,
            address: None,
            phone_number: None,
            website: None,
            owner_id: None,
            stripe_connected_account_id: Some(account.id.to_string()),
            stripe_onboarding_complete: Some(account.details_submitted.unwrap_or(false)),
            stripe_charges_enabled: Some(account.charges_enabled.unwrap_or(false)),
            stripe_payouts_enabled: Some(account.payouts_enabled.unwrap_or(false)),
            platform_commission_percent: None,
            platform_commission_fixed_fee: None,
        },
    )
    .await
    .map_err(|error| {
        error!(
            owner_id = %owner_id,
            club_id = %club.id,
            stripe_connected_account_id = %account.id,
            ?error,
            "Failed to persist Stripe connected account on club"
        );
        ApiError::new(
            StatusCode::INTERNAL_SERVER_ERROR,
            "L'account Stripe e stato creato, ma non sono riuscito a salvarlo sul club nel database.",
        )
    })?
    .ok_or_else(|| ApiError::new(StatusCode::NOT_FOUND, "Club non trovato durante il salvataggio dell'account Stripe."))?;

    let mut link_params =
        CreateAccountLink::new(account.id.clone(), AccountLinkType::AccountOnboarding);
    let refresh_url = format!(
        "{}/dashboard/club?stripe=refresh",
        state.config.owner_app_base_url
    );
    let return_url = format!(
        "{}/dashboard/club?stripe=connected",
        state.config.owner_app_base_url
    );
    link_params.refresh_url = Some(&refresh_url);
    link_params.return_url = Some(&return_url);

    let onboarding_link = AccountLink::create(&state.stripe_client, link_params)
        .await
        .map_err(|error| {
            error!(
                owner_id = %owner_id,
                club_id = %club.id,
                stripe_connected_account_id = %account.id,
                refresh_url = %refresh_url,
                return_url = %return_url,
                ?error,
                "Failed to create Stripe onboarding link"
            );
            ApiError::new(
                StatusCode::BAD_GATEWAY,
                "Stripe non ha generato il link di onboarding. Controlla OWNER_APP_BASE_URL e la configurazione dell'account Connect.",
            )
        })?;

    Ok(Json(StripeOnboardingLinkResponse {
        connected_account_id: updated
            .stripe_connected_account_id
            .unwrap_or_else(|| account.id.to_string()),
        onboarding_url: onboarding_link.url,
        onboarding_complete: updated.stripe_onboarding_complete.unwrap_or(false),
        charges_enabled: updated.stripe_charges_enabled.unwrap_or(false),
        payouts_enabled: updated.stripe_payouts_enabled.unwrap_or(false),
    }))
}

/// Get images for the authenticated club owner's club
pub async fn get_my_club_images(
    State(state): State<Arc<AppState>>,
    ClubOwnerUser(claims): ClubOwnerUser,
) -> Result<Json<Vec<ClubImageRow>>, StatusCode> {
    let owner_id = Uuid::parse_str(&claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;

    let club = club_persistence::get_club_by_owner_id(&state.db_pool, owner_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    let images = club_owner_persistence::get_club_images(&state.db_pool, club.id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(images))
}

/// Add an image to the authenticated club owner's club
pub async fn add_my_club_image(
    State(state): State<Arc<AppState>>,
    ClubOwnerUser(claims): ClubOwnerUser,
    Json(payload): Json<AddImageRequest>,
) -> Result<(StatusCode, Json<ClubImageRow>), StatusCode> {
    let owner_id = Uuid::parse_str(&claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;

    let club = club_persistence::get_club_by_owner_id(&state.db_pool, owner_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    let image = club_owner_persistence::add_club_image(
        &state.db_pool,
        club.id,
        payload.url,
        payload.display_order,
        payload.alt_text,
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok((StatusCode::CREATED, Json(image)))
}

/// Delete a club image (ownership checked)
pub async fn delete_my_club_image(
    State(state): State<Arc<AppState>>,
    ClubOwnerUser(claims): ClubOwnerUser,
    Path(image_id): Path<String>,
) -> Result<StatusCode, StatusCode> {
    let owner_id = Uuid::parse_str(&claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;
    let image_uuid = Uuid::parse_str(&image_id).map_err(|_| StatusCode::BAD_REQUEST)?;

    let club = club_persistence::get_club_by_owner_id(&state.db_pool, owner_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    let deleted = club_owner_persistence::delete_club_image(&state.db_pool, image_uuid, club.id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if deleted {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

/// Get images for a specific table (verifies table belongs to owner's club)
pub async fn get_table_images_handler(
    State(state): State<Arc<AppState>>,
    ClubOwnerUser(claims): ClubOwnerUser,
    Path(table_id): Path<String>,
) -> Result<Json<Vec<TableImageRow>>, StatusCode> {
    let owner_id = Uuid::parse_str(&claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;
    let table_uuid = Uuid::parse_str(&table_id).map_err(|_| StatusCode::BAD_REQUEST)?;

    let club = club_persistence::get_club_by_owner_id(&state.db_pool, owner_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    // Verify table belongs to owner's club via event
    let table = table_persistence::get_table_by_id(&state.db_pool, table_uuid)
        .await
        .map_err(|_| StatusCode::NOT_FOUND)?;

    let event = event_persistence::get_event_by_id(&state.db_pool, table.event_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    if event.club_id != Some(club.id) {
        return Err(StatusCode::FORBIDDEN);
    }

    let images = club_owner_persistence::get_table_images(&state.db_pool, table_uuid)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(images))
}

/// Add an image to a table (verifies ownership)
pub async fn add_table_image_handler(
    State(state): State<Arc<AppState>>,
    ClubOwnerUser(claims): ClubOwnerUser,
    Path(table_id): Path<String>,
    Json(payload): Json<AddImageRequest>,
) -> Result<(StatusCode, Json<TableImageRow>), StatusCode> {
    let owner_id = Uuid::parse_str(&claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;
    let table_uuid = Uuid::parse_str(&table_id).map_err(|_| StatusCode::BAD_REQUEST)?;

    let club = club_persistence::get_club_by_owner_id(&state.db_pool, owner_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    let table = table_persistence::get_table_by_id(&state.db_pool, table_uuid)
        .await
        .map_err(|_| StatusCode::NOT_FOUND)?;

    let event = event_persistence::get_event_by_id(&state.db_pool, table.event_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    if event.club_id != Some(club.id) {
        return Err(StatusCode::FORBIDDEN);
    }

    let image = club_owner_persistence::add_table_image(
        &state.db_pool,
        table_uuid,
        payload.url,
        payload.display_order,
        payload.alt_text,
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok((StatusCode::CREATED, Json(image)))
}

/// Delete a table image (ownership check: image must belong to owner's club)
pub async fn delete_table_image_handler(
    State(state): State<Arc<AppState>>,
    ClubOwnerUser(claims): ClubOwnerUser,
    Path(image_id): Path<String>,
) -> Result<StatusCode, StatusCode> {
    let owner_id = Uuid::parse_str(&claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;
    let image_uuid = Uuid::parse_str(&image_id).map_err(|_| StatusCode::BAD_REQUEST)?;

    let club = club_persistence::get_club_by_owner_id(&state.db_pool, owner_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    let deleted =
        club_owner_persistence::delete_table_image_for_club(&state.db_pool, image_uuid, club.id)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if deleted {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

/// Get all reservations for a specific event owned by the club owner
pub async fn get_event_reservations_handler(
    State(state): State<Arc<AppState>>,
    ClubOwnerUser(claims): ClubOwnerUser,
    Path(event_id): Path<String>,
) -> Result<Json<Vec<TableReservationResponse>>, StatusCode> {
    let owner_id = Uuid::parse_str(&claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;
    let event_uuid = Uuid::parse_str(&event_id).map_err(|_| StatusCode::BAD_REQUEST)?;

    let club = club_persistence::get_club_by_owner_id(&state.db_pool, owner_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    let event = event_persistence::get_event_by_id(&state.db_pool, event_uuid)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    if event.club_id != Some(club.id) {
        return Err(StatusCode::FORBIDDEN);
    }

    let reservations =
        club_owner_persistence::list_event_reservations(&state.read_db_pool, event_uuid)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(reservations))
}

/// Create a manual reservation (no Stripe, no user account needed)
pub async fn create_manual_reservation_handler(
    State(state): State<Arc<AppState>>,
    ClubOwnerUser(claims): ClubOwnerUser,
    Path(event_id): Path<String>,
    Json(payload): Json<CreateManualReservationRequest>,
) -> Result<(StatusCode, Json<TableReservationResponse>), StatusCode> {
    let owner_id = Uuid::parse_str(&claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;
    let event_uuid = Uuid::parse_str(&event_id).map_err(|_| StatusCode::BAD_REQUEST)?;
    let table_uuid = Uuid::parse_str(&payload.table_id).map_err(|_| StatusCode::BAD_REQUEST)?;

    let club = club_persistence::get_club_by_owner_id(&state.db_pool, owner_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    let event = event_persistence::get_event_by_id(&state.db_pool, event_uuid)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    if event.club_id != Some(club.id) {
        return Err(StatusCode::FORBIDDEN);
    }

    let reservation = club_owner_persistence::create_manual_reservation(
        &state.db_pool,
        event_uuid,
        table_uuid,
        payload.contact_name,
        payload.contact_phone,
        payload.contact_email,
        payload.num_people,
        payload.manual_notes,
        payload.male_guest_count.unwrap_or(0),
        payload.female_guest_count.unwrap_or(0),
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if let Err(error) = outbox_service::enqueue_analytics_event(
        &state.db_pool,
        &state.config,
        "owner_manual_reservation_created",
        Some(&claims.sub),
        Some("reservation"),
        Some(reservation.id),
        serde_json::json!({
            "event_id": event_uuid,
            "table_id": table_uuid,
            "owner_id": claims.sub,
            "reservation_id": reservation.id,
            "outcome": "success",
        }),
    )
    .await
    {
        warn!(error = %error, reservation_id = %reservation.id, "Failed to enqueue manual reservation analytics event");
    }

    Ok((
        StatusCode::CREATED,
        Json(TableReservationResponse::from(reservation)),
    ))
}

/// Update the status of a reservation
pub async fn update_reservation_status_handler(
    State(state): State<Arc<AppState>>,
    ClubOwnerUser(claims): ClubOwnerUser,
    Path(reservation_id): Path<String>,
    Json(payload): Json<UpdateReservationStatusRequest>,
) -> Result<Json<TableReservationResponse>, StatusCode> {
    let _owner_id = Uuid::parse_str(&claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;
    let reservation_uuid = Uuid::parse_str(&reservation_id).map_err(|_| StatusCode::BAD_REQUEST)?;
    let previous_reservation =
        table_persistence::get_reservation_by_id(&state.db_pool, reservation_uuid)
            .await
            .map_err(|_| StatusCode::NOT_FOUND)?;

    let reservation = club_owner_persistence::update_reservation_status(
        &state.db_pool,
        reservation_uuid,
        payload.status,
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .ok_or(StatusCode::NOT_FOUND)?;

    if let Err(error) = outbox_service::enqueue_analytics_event(
        &state.db_pool,
        &state.config,
        "reservation_status_updated",
        Some(&claims.sub),
        Some("reservation"),
        Some(reservation.id),
        serde_json::json!({
            "reservation_id": reservation.id,
            "status": reservation.status,
            "owner_id": claims.sub,
            "outcome": "success",
        }),
    )
    .await
    {
        warn!(error = %error, reservation_id = %reservation.id, "Failed to enqueue reservation status analytics event");
    }

    if previous_reservation.status != reservation.status {
        let table = table_persistence::get_table_by_id(&state.db_pool, reservation.table_id)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        let event = event_persistence::get_event_by_id(&state.db_pool, reservation.event_id)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
            .ok_or(StatusCode::NOT_FOUND)?;
        let (title, body) =
            build_reservation_status_notification(&reservation.status, &event.title, &table.name);

        if let Err(error) = outbox_service::enqueue_push_notification_for_user(
            &state.db_pool,
            reservation.user_id,
            &title,
            &body,
            Some("reservation"),
            Some(reservation.id),
        )
        .await
        {
            warn!(error = %error, reservation_id = %reservation.id, "Failed to enqueue reservation status push notification");
        }
    }

    Ok(Json(TableReservationResponse::from(reservation)))
}

fn build_reservation_status_notification(
    status: &str,
    event_title: &str,
    table_name: &str,
) -> (String, String) {
    match status {
        "confirmed" => (
            "Prenotazione tavolo".to_string(),
            format!(
                "Il tuo tavolo {} per {} ora e' prenotato.",
                table_name, event_title
            ),
        ),
        "cancelled" => (
            "Prenotazione rifiutata".to_string(),
            format!(
                "La tua prenotazione per {} ({}) e' stata rifiutata dal locale.",
                event_title, table_name
            ),
        ),
        "completed" => (
            "Accesso effettuato".to_string(),
            format!(
                "La tua prenotazione per {} ({}) e' stata segnata come accesso effettuato.",
                event_title, table_name
            ),
        ),
        "pending" => (
            "Prenotazione aggiornata".to_string(),
            format!(
                "La tua prenotazione per {} ({}) e' in attesa del numero minimo di partecipanti.",
                event_title, table_name
            ),
        ),
        _ => (
            "Stato prenotazione aggiornato".to_string(),
            format!(
                "La tua prenotazione per {} ({}) ora e' {}.",
                event_title, table_name, status
            ),
        ),
    }
}

/// Scan a QR code (ticket or reservation) — read-only lookup
pub async fn scan_code_handler(
    State(state): State<Arc<AppState>>,
    ClubOwnerUser(claims): ClubOwnerUser,
    Path(code): Path<String>,
) -> Result<Json<ScanResult>, StatusCode> {
    let _owner_id = Uuid::parse_str(&claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;

    let result = club_owner_persistence::scan_code(&state.db_pool, &code)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    match result {
        Some(scan) => {
            let _ = outbox_service::enqueue_analytics_event(
                &state.db_pool,
                &state.config,
                "owner_code_scan_resolved",
                Some(&claims.sub),
                Some("checkin"),
                None,
                serde_json::json!({
                    "owner_id": claims.sub,
                    "code": code,
                    "scan_type": scan.scan_type,
                    "event_title": scan.event_title,
                    "valid": scan.valid,
                    "already_used": scan.already_used,
                    "outcome": "success",
                }),
            )
            .await;
            Ok(Json(scan))
        }
        None => {
            let _ = outbox_service::enqueue_analytics_event(
                &state.db_pool,
                &state.config,
                "owner_code_scan_resolved",
                Some(&claims.sub),
                Some("checkin"),
                None,
                serde_json::json!({
                    "owner_id": claims.sub,
                    "code": code,
                    "scan_type": "unknown",
                    "valid": false,
                    "already_used": false,
                    "outcome": "not_found",
                }),
            )
            .await;

            Ok(Json(ScanResult {
                valid: false,
                already_used: false,
                scan_type: "unknown".to_string(),
                guest_name: None,
                num_people: None,
                event_title: None,
                table_name: None,
                code,
            }))
        }
    }
}

pub async fn update_reservation_handler(
    State(state): State<Arc<AppState>>,
    ClubOwnerUser(claims): ClubOwnerUser,
    Path(reservation_id): Path<String>,
    Json(payload): Json<OwnerUpdateReservationRequest>,
) -> Result<Json<TableReservationResponse>, StatusCode> {
    let owner_id = Uuid::parse_str(&claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;
    let reservation_uuid = Uuid::parse_str(&reservation_id).map_err(|_| StatusCode::BAD_REQUEST)?;
    let previous_reservation =
        table_persistence::get_reservation_by_id(&state.db_pool, reservation_uuid)
            .await
            .map_err(|_| StatusCode::NOT_FOUND)?;

    let club = club_persistence::get_club_by_owner_id(&state.db_pool, owner_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;
    let event = event_persistence::get_event_by_id(&state.db_pool, previous_reservation.event_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;
    if event.club_id != Some(club.id) {
        return Err(StatusCode::FORBIDDEN);
    }

    let table_id = payload
        .table_id
        .as_deref()
        .map(Uuid::parse_str)
        .transpose()
        .map_err(|_| StatusCode::BAD_REQUEST)?;

    if let Some(target_table_id) = table_id {
        let target_table = table_persistence::get_table_by_id(&state.db_pool, target_table_id)
            .await
            .map_err(|_| StatusCode::NOT_FOUND)?;
        if target_table.event_id != previous_reservation.event_id {
            return Err(StatusCode::BAD_REQUEST);
        }
    }

    let reservation = table_persistence::update_reservation(
        &state.db_pool,
        reservation_uuid,
        payload.status,
        table_id,
        payload.num_people,
        payload.contact_name,
        payload.contact_email,
        payload.contact_phone,
        payload.special_requests,
        payload.manual_notes,
        payload.male_guest_count,
        payload.female_guest_count,
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if previous_reservation.status != reservation.status {
        let table = table_persistence::get_table_by_id(&state.db_pool, reservation.table_id)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        let (title, body) =
            build_reservation_status_notification(&reservation.status, &event.title, &table.name);

        if let Err(error) = outbox_service::enqueue_push_notification_for_user(
            &state.db_pool,
            reservation.user_id,
            &title,
            &body,
            Some("reservation"),
            Some(reservation.id),
        )
        .await
        {
            warn!(error = %error, reservation_id = %reservation.id, "Failed to enqueue reservation update push notification");
        }
    }

    Ok(Json(TableReservationResponse::from(reservation)))
}

pub async fn delete_reservation_handler(
    State(state): State<Arc<AppState>>,
    ClubOwnerUser(claims): ClubOwnerUser,
    Path(reservation_id): Path<String>,
) -> Result<StatusCode, StatusCode> {
    let owner_id = Uuid::parse_str(&claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;
    let reservation_uuid = Uuid::parse_str(&reservation_id).map_err(|_| StatusCode::BAD_REQUEST)?;
    let reservation = table_persistence::get_reservation_by_id(&state.db_pool, reservation_uuid)
        .await
        .map_err(|_| StatusCode::NOT_FOUND)?;
    let club = club_persistence::get_club_by_owner_id(&state.db_pool, owner_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;
    let event = event_persistence::get_event_by_id(&state.db_pool, reservation.event_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;
    if event.club_id != Some(club.id) {
        return Err(StatusCode::FORBIDDEN);
    }

    match table_persistence::delete_reservation(&state.db_pool, reservation_uuid).await {
        Ok(true) => Ok(StatusCode::NO_CONTENT),
        Ok(false) => Err(StatusCode::NOT_FOUND),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

pub async fn duplicate_event_tables_handler(
    State(state): State<Arc<AppState>>,
    ClubOwnerUser(claims): ClubOwnerUser,
    Path(event_id): Path<String>,
    Json(payload): Json<DuplicateTablesRequest>,
) -> Result<Json<TablesResponse>, StatusCode> {
    let owner_id = Uuid::parse_str(&claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;
    let target_event_uuid = Uuid::parse_str(&event_id).map_err(|_| StatusCode::BAD_REQUEST)?;
    let source_event_uuid =
        Uuid::parse_str(&payload.source_event_id).map_err(|_| StatusCode::BAD_REQUEST)?;

    let club = club_persistence::get_club_by_owner_id(&state.db_pool, owner_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    let target_event = event_persistence::get_event_by_id(&state.db_pool, target_event_uuid)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;
    let source_event = event_persistence::get_event_by_id(&state.db_pool, source_event_uuid)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    if target_event.club_id != Some(club.id) || source_event.club_id != Some(club.id) {
        return Err(StatusCode::FORBIDDEN);
    }

    let duplicated = table_persistence::duplicate_tables_between_events(
        &state.db_pool,
        source_event_uuid,
        target_event_uuid,
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(TablesResponse {
        tables: duplicated.into_iter().map(TableResponse::from).collect(),
    }))
}

pub async fn get_event_reservation_stats_handler(
    State(state): State<Arc<AppState>>,
    ClubOwnerUser(claims): ClubOwnerUser,
    Path(event_id): Path<String>,
) -> Result<Json<EventReservationStatsResponse>, StatusCode> {
    let owner_id = Uuid::parse_str(&claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;
    let event_uuid = Uuid::parse_str(&event_id).map_err(|_| StatusCode::BAD_REQUEST)?;
    let club = club_persistence::get_club_by_owner_id(&state.db_pool, owner_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;
    let event = event_persistence::get_event_by_id(&state.db_pool, event_uuid)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;
    if event.club_id != Some(club.id) {
        return Err(StatusCode::FORBIDDEN);
    }

    let stats = table_persistence::get_event_reservation_stats(&state.db_pool, event_uuid)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(stats))
}

/// Check in a ticket or reservation by code — marks it as used/completed
pub async fn checkin_handler(
    State(state): State<Arc<AppState>>,
    ClubOwnerUser(claims): ClubOwnerUser,
    Path(code): Path<String>,
    maybe_payload: Option<Json<CheckinDecisionRequest>>,
) -> Result<Json<ScanResult>, StatusCode> {
    let _owner_id = Uuid::parse_str(&claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;
    let decision = maybe_payload
        .and_then(|Json(payload)| payload.decision)
        .unwrap_or_else(|| "confirm".to_string());

    let result = match decision.as_str() {
        "confirm" => club_owner_persistence::checkin_by_code(&state.db_pool, &code)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
        "reject" => club_owner_persistence::reject_reservation_by_code(&state.db_pool, &code)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
        _ => return Err(StatusCode::BAD_REQUEST),
    };

    match result {
        Some(scan) => {
            let event_name = if decision == "reject" {
                "owner_checkin_rejected"
            } else {
                "owner_checkin_completed"
            };
            let _ = outbox_service::enqueue_analytics_event(
                &state.db_pool,
                &state.config,
                event_name,
                Some(&claims.sub),
                Some("checkin"),
                None,
                serde_json::json!({
                    "owner_id": claims.sub,
                    "code": code,
                    "scan_type": scan.scan_type,
                    "event_title": scan.event_title,
                    "decision": decision,
                    "outcome": "success",
                }),
            )
            .await;
            Ok(Json(scan))
        }
        None => {
            let event_name = if decision == "reject" {
                "owner_checkin_rejection_failed"
            } else {
                "owner_checkin_failed"
            };
            let _ = outbox_service::enqueue_analytics_event(
                &state.db_pool,
                &state.config,
                event_name,
                Some(&claims.sub),
                Some("checkin"),
                None,
                serde_json::json!({
                    "owner_id": claims.sub,
                    "code": code,
                    "decision": decision,
                    "outcome": "not_found",
                }),
            )
            .await;

            Ok(Json(ScanResult {
                valid: false,
                already_used: false,
                scan_type: "unknown".to_string(),
                guest_name: None,
                num_people: None,
                event_title: None,
                table_name: None,
                code,
            }))
        }
    }
}

/// Update an event owned by the club owner (with ownership check)
pub async fn update_club_event(
    State(state): State<Arc<AppState>>,
    ClubOwnerUser(claims): ClubOwnerUser,
    Path(event_id): Path<String>,
    Json(mut payload): Json<UpdateEventRequest>,
) -> Result<Json<EventResponse>, StatusCode> {
    let owner_id = Uuid::parse_str(&claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;
    let event_uuid = Uuid::parse_str(&event_id).map_err(|_| StatusCode::BAD_REQUEST)?;
    if let Some(image) = payload.image.as_deref() {
        if !crate::models::is_valid_event_image_url(image) {
            return Err(StatusCode::BAD_REQUEST);
        }
    }

    let club = club_persistence::get_club_by_owner_id(&state.db_pool, owner_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    let event = event_persistence::get_event_by_id(&state.db_pool, event_uuid)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    if event.club_id != Some(club.id) {
        return Err(StatusCode::FORBIDDEN);
    }

    // Prevent changing the event's club association
    payload.club_id = None;
    let genre_ids = payload.genre_ids.clone();

    let updated = event_persistence::update_event(&state.db_pool, event_uuid, payload)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    if let Some(ids) = genre_ids {
        event_persistence::set_event_genres(&state.db_pool, event_uuid, &ids)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    }

    let genres = event_persistence::get_event_genres(&state.db_pool, event_uuid)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut response = EventResponse::from(updated);
    response.genres = genres;
    Ok(Json(response))
}

/// Delete an event owned by the club owner (with ownership check)
pub async fn delete_club_event(
    State(state): State<Arc<AppState>>,
    ClubOwnerUser(claims): ClubOwnerUser,
    Path(event_id): Path<String>,
) -> Result<StatusCode, StatusCode> {
    let owner_id = Uuid::parse_str(&claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;
    let event_uuid = Uuid::parse_str(&event_id).map_err(|_| StatusCode::BAD_REQUEST)?;

    let club = club_persistence::get_club_by_owner_id(&state.db_pool, owner_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    let event = event_persistence::get_event_by_id(&state.db_pool, event_uuid)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    if event.club_id != Some(club.id) {
        return Err(StatusCode::FORBIDDEN);
    }

    let deleted = event_persistence::delete_event(&state.db_pool, event_uuid)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if deleted {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

/// Get aggregated stats for the authenticated club owner
pub async fn get_owner_stats_handler(
    State(state): State<Arc<AppState>>,
    ClubOwnerUser(claims): ClubOwnerUser,
) -> Result<Json<OwnerStats>, StatusCode> {
    let owner_id = Uuid::parse_str(&claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;

    let club = club_persistence::get_club_by_owner_id(&state.db_pool, owner_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    let stats = club_owner_persistence::get_owner_stats(&state.db_pool, club.id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(stats))
}
