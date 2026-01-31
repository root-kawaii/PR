use crate::middleware::auth::ClubOwnerUser;
use crate::models::{
    AppState, ClubResponse, CreateClubRequest, CreateEventRequest, CreateTableRequest,
    EventResponse, TableResponse, TablesResponse,
};
use crate::models::club_owner::{
    ClubOwnerAuthResponse, ClubOwnerLoginRequest, ClubOwnerRegisterRequest, ClubOwnerResponse,
};
use crate::persistences::{club_owner_persistence, club_persistence, event_persistence, table_persistence};
use crate::utils::jwt;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use bcrypt::{hash, verify, DEFAULT_COST};
use rust_decimal::Decimal;
use std::sync::Arc;
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
    let password_hash = hash(payload.password, DEFAULT_COST)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

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
    };

    let club = club_persistence::create_club(&state.db_pool, club_request)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Generate JWT token with club_owner role
    let token = jwt::generate_token(owner.id, owner.email.clone(), "club_owner".to_string(), &state.jwt_secret)
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
    let owner = match club_owner_persistence::find_club_owner_by_email(&state.db_pool, &payload.email).await {
        Ok(Some(owner)) => owner,
        Ok(None) => return Err(StatusCode::UNAUTHORIZED),
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };

    // Verify password
    let is_valid = verify(payload.password, &owner.password_hash)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if !is_valid {
        return Err(StatusCode::UNAUTHORIZED);
    }

    // Look up the owner's club
    let club = club_persistence::get_club_by_owner_id(&state.db_pool, owner.id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Generate JWT token
    let token = jwt::generate_token(owner.id, owner.email.clone(), "club_owner".to_string(), &state.jwt_secret)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let response = ClubOwnerAuthResponse {
        owner: ClubOwnerResponse::from(owner),
        club: club.map(ClubResponse::from),
        token,
    };

    Ok(Json(response))
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

/// Get all events for the authenticated club owner's club
pub async fn get_my_club_events(
    State(state): State<Arc<AppState>>,
    ClubOwnerUser(claims): ClubOwnerUser,
) -> Result<Json<Vec<EventResponse>>, StatusCode> {
    let owner_id = Uuid::parse_str(&claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;

    let club = club_persistence::get_club_by_owner_id(&state.db_pool, owner_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    let events = event_persistence::get_events_by_club_id(&state.db_pool, club.id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let responses: Vec<EventResponse> = events.into_iter().map(EventResponse::from).collect();
    Ok(Json(responses))
}

/// Create an event for the authenticated club owner's club
pub async fn create_club_event(
    State(state): State<Arc<AppState>>,
    ClubOwnerUser(claims): ClubOwnerUser,
    Json(mut payload): Json<CreateEventRequest>,
) -> Result<(StatusCode, Json<EventResponse>), StatusCode> {
    let owner_id = Uuid::parse_str(&claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;

    let club = club_persistence::get_club_by_owner_id(&state.db_pool, owner_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    // Force club_id to the owner's club
    payload.club_id = Some(club.id);

    let event = event_persistence::create_event(&state.db_pool, payload)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok((StatusCode::CREATED, Json(EventResponse::from(event))))
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
    Ok(Json(TablesResponse { tables: table_responses }))
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

    Ok((StatusCode::CREATED, Json(TableResponse::from(table))))
}
