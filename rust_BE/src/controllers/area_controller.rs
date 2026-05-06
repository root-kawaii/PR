use crate::application::{
    area_service as area_persistence, club_service as club_persistence,
    event_service as event_persistence, reservation_service as table_persistence,
};
use crate::middleware::auth::ClubOwnerUser;
use crate::models::{
    AppState, AreaResponse, AssignAreaRequest, CreateAreaRequest, CreateClubTableRequest,
    EventAreaAvailabilityResponse, TableResponse, UpdateAreaRequest, UpdateTableRequest,
};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use rust_decimal::Decimal;
use std::sync::Arc;
use uuid::Uuid;

// ============================================================================
// Public
// ============================================================================

/// GET /clubs/:club_id/areas — public list of areas for a club
pub async fn list_areas_by_club(
    State(state): State<Arc<AppState>>,
    Path(club_id): Path<String>,
) -> Result<Json<Vec<AreaResponse>>, StatusCode> {
    let club_uuid = Uuid::parse_str(&club_id).map_err(|_| StatusCode::BAD_REQUEST)?;
    let areas = area_persistence::get_areas_by_club(&state.read_db_pool, club_uuid)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(areas.into_iter().map(AreaResponse::from).collect()))
}

/// GET /events/:event_id/areas — public list of event-scoped areas with
/// live availability counters for booking flows.
pub async fn list_areas_by_event(
    State(state): State<Arc<AppState>>,
    Path(event_id): Path<String>,
) -> Result<Json<Vec<EventAreaAvailabilityResponse>>, StatusCode> {
    let event_uuid = Uuid::parse_str(&event_id).map_err(|_| StatusCode::BAD_REQUEST)?;

    event_persistence::get_event_by_id(&state.read_db_pool, event_uuid)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    let areas = area_persistence::get_event_area_availability(&state.read_db_pool, event_uuid)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(areas))
}

// ============================================================================
// Owner-only
// ============================================================================

/// GET /owner/areas — list areas for the authenticated owner's club
pub async fn list_my_areas(
    State(state): State<Arc<AppState>>,
    ClubOwnerUser(claims): ClubOwnerUser,
) -> Result<Json<Vec<AreaResponse>>, StatusCode> {
    let owner_id = Uuid::parse_str(&claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;
    let club = club_persistence::get_club_by_owner_id(&state.db_pool, owner_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    let areas = area_persistence::get_areas_by_club(&state.db_pool, club.id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(areas.into_iter().map(AreaResponse::from).collect()))
}

/// POST /owner/areas — create a new area for the owner's club
pub async fn create_area(
    State(state): State<Arc<AppState>>,
    ClubOwnerUser(claims): ClubOwnerUser,
    Json(req): Json<CreateAreaRequest>,
) -> Result<(StatusCode, Json<AreaResponse>), StatusCode> {
    let owner_id = Uuid::parse_str(&claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;
    let club = club_persistence::get_club_by_owner_id(&state.db_pool, owner_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    let price = Decimal::from_f64_retain(req.price).ok_or(StatusCode::BAD_REQUEST)?;
    let area =
        area_persistence::create_area(&state.db_pool, club.id, req.name, price, req.description)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok((StatusCode::CREATED, Json(AreaResponse::from(area))))
}

/// PATCH /owner/areas/:area_id — update an area
pub async fn update_area(
    State(state): State<Arc<AppState>>,
    ClubOwnerUser(claims): ClubOwnerUser,
    Path(area_id): Path<String>,
    Json(req): Json<UpdateAreaRequest>,
) -> Result<Json<AreaResponse>, StatusCode> {
    let owner_id = Uuid::parse_str(&claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;
    let area_uuid = Uuid::parse_str(&area_id).map_err(|_| StatusCode::BAD_REQUEST)?;

    // Verify the area belongs to the owner's club
    let club = club_persistence::get_club_by_owner_id(&state.db_pool, owner_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    let existing = area_persistence::get_area_by_id(&state.db_pool, area_uuid)
        .await
        .map_err(|_| StatusCode::NOT_FOUND)?;
    if existing.club_id != club.id {
        return Err(StatusCode::FORBIDDEN);
    }

    let price = req
        .price
        .map(|p| Decimal::from_f64_retain(p).ok_or(StatusCode::BAD_REQUEST))
        .transpose()?;

    let area =
        area_persistence::update_area(&state.db_pool, area_uuid, req.name, price, req.description)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(AreaResponse::from(area)))
}

/// DELETE /owner/areas/:area_id — delete an area
pub async fn delete_area(
    State(state): State<Arc<AppState>>,
    ClubOwnerUser(claims): ClubOwnerUser,
    Path(area_id): Path<String>,
) -> StatusCode {
    let Ok(owner_id) = Uuid::parse_str(&claims.sub) else {
        return StatusCode::UNAUTHORIZED;
    };
    let Ok(area_uuid) = Uuid::parse_str(&area_id) else {
        return StatusCode::BAD_REQUEST;
    };

    let Ok(Some(club)) = club_persistence::get_club_by_owner_id(&state.db_pool, owner_id).await
    else {
        return StatusCode::NOT_FOUND;
    };

    let Ok(existing) = area_persistence::get_area_by_id(&state.db_pool, area_uuid).await else {
        return StatusCode::NOT_FOUND;
    };
    if existing.club_id != club.id {
        return StatusCode::FORBIDDEN;
    }
    if existing.name.trim().eq_ignore_ascii_case("A") {
        return StatusCode::CONFLICT;
    }

    let Ok(assigned_tables) =
        area_persistence::count_tables_by_area(&state.db_pool, area_uuid).await
    else {
        return StatusCode::INTERNAL_SERVER_ERROR;
    };
    if assigned_tables > 0 {
        return StatusCode::CONFLICT;
    }

    match area_persistence::delete_area(&state.db_pool, area_uuid).await {
        Ok(true) => StatusCode::NO_CONTENT,
        Ok(false) => StatusCode::NOT_FOUND,
        Err(_) => StatusCode::INTERNAL_SERVER_ERROR,
    }
}

/// PATCH /owner/tables/:table_id/area — assign an area to a table.
///
/// Body: `{ "area_id": "<uuid>" }` to assign a specific area.
/// Body: `{ "area_id": null }` to move the table to the default `"A"` area.
/// When assigning a specific area, the table's min_spend and total_cost are updated
/// to match the area price. The default `"A"` fallback preserves the current pricing.
pub async fn assign_table_area(
    State(state): State<Arc<AppState>>,
    ClubOwnerUser(claims): ClubOwnerUser,
    Path(table_id): Path<String>,
    Json(req): Json<AssignAreaRequest>,
) -> Result<Json<crate::models::TableResponse>, StatusCode> {
    let owner_id = Uuid::parse_str(&claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;
    let table_uuid = Uuid::parse_str(&table_id).map_err(|_| StatusCode::BAD_REQUEST)?;

    // Verify the table's event belongs to the owner's club
    let club = club_persistence::get_club_by_owner_id(&state.db_pool, owner_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    let table = table_persistence::get_table_by_id(&state.db_pool, table_uuid)
        .await
        .map_err(|_| StatusCode::NOT_FOUND)?;

    // Verify the table belongs to the owner's club. A table is club-scoped
    // either via its event (event_id) or directly via its area (club-level table).
    if let Some(event_id) = table.event_id {
        let event = event_persistence::get_event_by_id(&state.db_pool, event_id)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
            .ok_or(StatusCode::NOT_FOUND)?;
        if event.club_id != Some(club.id) {
            return Err(StatusCode::FORBIDDEN);
        }
    } else {
        let area_id = table.area_id.ok_or(StatusCode::FORBIDDEN)?;
        let area = area_persistence::get_area_by_id(&state.db_pool, area_id)
            .await
            .map_err(|_| StatusCode::NOT_FOUND)?;
        if area.club_id != club.id {
            return Err(StatusCode::FORBIDDEN);
        }
    }

    let updated = match req.area_id {
        Some(ref id) => {
            let area_uuid = Uuid::parse_str(id).map_err(|_| StatusCode::BAD_REQUEST)?;
            // Ensure the area belongs to the same club
            let area = area_persistence::get_area_by_id(&state.db_pool, area_uuid)
                .await
                .map_err(|_| StatusCode::NOT_FOUND)?;
            if area.club_id != club.id {
                return Err(StatusCode::FORBIDDEN);
            }
            area_persistence::assign_area_to_table(&state.db_pool, table_uuid, area_uuid).await
        }
        None => {
            let default_area = area_persistence::get_or_create_default_area(
                &state.db_pool,
                club.id,
                table.min_spend,
            )
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

            area_persistence::assign_default_area_to_table(
                &state.db_pool,
                table_uuid,
                default_area.id,
            )
            .await
        }
    }
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(crate::models::TableResponse::from(updated)))
}

// ============================================================================
// Owner-only — club-level tables
// ============================================================================

/// GET /owner/tables — list all club-level tables (event_id IS NULL) for the
/// authenticated owner's club.
pub async fn list_my_club_tables(
    State(state): State<Arc<AppState>>,
    ClubOwnerUser(claims): ClubOwnerUser,
) -> Result<Json<Vec<TableResponse>>, StatusCode> {
    let owner_id = Uuid::parse_str(&claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;
    let club = club_persistence::get_club_by_owner_id(&state.db_pool, owner_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    let tables = table_persistence::get_tables_by_club_id(&state.db_pool, club.id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(tables.into_iter().map(TableResponse::from).collect()))
}

/// POST /owner/tables — create a new club-level table inside one of the
/// owner's areas. The table is reusable across every event of the club.
pub async fn create_my_club_table(
    State(state): State<Arc<AppState>>,
    ClubOwnerUser(claims): ClubOwnerUser,
    Json(req): Json<CreateClubTableRequest>,
) -> Result<(StatusCode, Json<TableResponse>), StatusCode> {
    let owner_id = Uuid::parse_str(&claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;
    let area_uuid = Uuid::parse_str(&req.area_id).map_err(|_| StatusCode::BAD_REQUEST)?;

    let club = club_persistence::get_club_by_owner_id(&state.db_pool, owner_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    let area = area_persistence::get_area_by_id(&state.db_pool, area_uuid)
        .await
        .map_err(|_| StatusCode::NOT_FOUND)?;
    if area.club_id != club.id {
        return Err(StatusCode::FORBIDDEN);
    }

    let min_spend = match req.min_spend {
        Some(value) => Decimal::from_f64_retain(value).ok_or(StatusCode::BAD_REQUEST)?,
        None => area.price,
    };

    let table = table_persistence::create_club_table(
        &state.db_pool,
        area_uuid,
        req.name,
        req.zone,
        req.capacity,
        min_spend,
        req.location_description,
        req.features,
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok((StatusCode::CREATED, Json(TableResponse::from(table))))
}

async fn ensure_table_belongs_to_club(
    state: &Arc<AppState>,
    table: &crate::models::Table,
    club_id: Uuid,
) -> Result<(), StatusCode> {
    if let Some(event_id) = table.event_id {
        let event = event_persistence::get_event_by_id(&state.db_pool, event_id)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
            .ok_or(StatusCode::NOT_FOUND)?;
        if event.club_id != Some(club_id) {
            return Err(StatusCode::FORBIDDEN);
        }
        Ok(())
    } else {
        let area_id = table.area_id.ok_or(StatusCode::FORBIDDEN)?;
        let area = area_persistence::get_area_by_id(&state.db_pool, area_id)
            .await
            .map_err(|_| StatusCode::NOT_FOUND)?;
        if area.club_id != club_id {
            return Err(StatusCode::FORBIDDEN);
        }
        Ok(())
    }
}

/// PATCH /owner/tables/:table_id — update a club-level table.
pub async fn update_my_club_table(
    State(state): State<Arc<AppState>>,
    ClubOwnerUser(claims): ClubOwnerUser,
    Path(table_id): Path<String>,
    Json(req): Json<UpdateTableRequest>,
) -> Result<Json<TableResponse>, StatusCode> {
    let owner_id = Uuid::parse_str(&claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;
    let table_uuid = Uuid::parse_str(&table_id).map_err(|_| StatusCode::BAD_REQUEST)?;

    let club = club_persistence::get_club_by_owner_id(&state.db_pool, owner_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    let table = table_persistence::get_table_by_id(&state.db_pool, table_uuid)
        .await
        .map_err(|_| StatusCode::NOT_FOUND)?;
    ensure_table_belongs_to_club(&state, &table, club.id).await?;

    let min_spend = req
        .min_spend
        .map(|v| Decimal::from_f64_retain(v).ok_or(StatusCode::BAD_REQUEST))
        .transpose()?;

    let updated = table_persistence::update_table(
        &state.db_pool,
        table_uuid,
        req.name,
        req.zone,
        req.capacity,
        min_spend,
        req.available,
        req.location_description,
        req.features,
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(TableResponse::from(updated)))
}

/// DELETE /owner/tables/:table_id — delete a club-level table.
/// Refuses if any active reservation references it.
pub async fn delete_my_club_table(
    State(state): State<Arc<AppState>>,
    ClubOwnerUser(claims): ClubOwnerUser,
    Path(table_id): Path<String>,
) -> StatusCode {
    let Ok(owner_id) = Uuid::parse_str(&claims.sub) else {
        return StatusCode::UNAUTHORIZED;
    };
    let Ok(table_uuid) = Uuid::parse_str(&table_id) else {
        return StatusCode::BAD_REQUEST;
    };

    let Ok(Some(club)) = club_persistence::get_club_by_owner_id(&state.db_pool, owner_id).await
    else {
        return StatusCode::NOT_FOUND;
    };

    let Ok(table) = table_persistence::get_table_by_id(&state.db_pool, table_uuid).await else {
        return StatusCode::NOT_FOUND;
    };

    if let Err(status) = ensure_table_belongs_to_club(&state, &table, club.id).await {
        return status;
    }

    let active_count =
        match table_persistence::count_reservations_by_table(&state.db_pool, table_uuid).await {
            Ok(n) => n,
            Err(_) => return StatusCode::INTERNAL_SERVER_ERROR,
        };
    if active_count > 0 {
        return StatusCode::CONFLICT;
    }

    match table_persistence::delete_table(&state.db_pool, table_uuid).await {
        Ok(true) => StatusCode::NO_CONTENT,
        Ok(false) => StatusCode::NOT_FOUND,
        Err(_) => StatusCode::INTERNAL_SERVER_ERROR,
    }
}
