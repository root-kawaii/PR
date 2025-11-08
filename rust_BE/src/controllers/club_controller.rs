use crate::models::{AppState, CreateClubRequest, UpdateClubRequest, ClubResponse};
use crate::persistences::club_persistence;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use std::sync::Arc;
use uuid::Uuid;

/// Get all clubs
pub async fn get_all_clubs(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<ClubResponse>>, StatusCode> {
    match club_persistence::get_all_clubs(&state.db_pool).await {
        Ok(clubs) => {
            let responses: Vec<ClubResponse> = clubs.into_iter().map(|c| c.into()).collect();
            Ok(Json(responses))
        }
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

/// Get a single club by ID
pub async fn get_club(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<ClubResponse>, StatusCode> {
    let club_id = Uuid::parse_str(&id).map_err(|_| StatusCode::BAD_REQUEST)?;

    match club_persistence::get_club_by_id(&state.db_pool, club_id).await {
        Ok(Some(club)) => Ok(Json(club.into())),
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

/// Create a new club
pub async fn create_club(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateClubRequest>,
) -> Result<(StatusCode, Json<ClubResponse>), StatusCode> {
    match club_persistence::create_club(&state.db_pool, payload).await {
        Ok(club) => Ok((StatusCode::CREATED, Json(club.into()))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

/// Update a club
pub async fn update_club(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(payload): Json<UpdateClubRequest>,
) -> Result<Json<ClubResponse>, StatusCode> {
    let club_id = Uuid::parse_str(&id).map_err(|_| StatusCode::BAD_REQUEST)?;

    match club_persistence::update_club(&state.db_pool, club_id, payload).await {
        Ok(Some(club)) => Ok(Json(club.into())),
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

/// Delete a club
pub async fn delete_club(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<StatusCode, StatusCode> {
    let club_id = Uuid::parse_str(&id).map_err(|_| StatusCode::BAD_REQUEST)?;

    match club_persistence::delete_club(&state.db_pool, club_id).await {
        Ok(true) => Ok(StatusCode::NO_CONTENT),
        Ok(false) => Err(StatusCode::NOT_FOUND),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}