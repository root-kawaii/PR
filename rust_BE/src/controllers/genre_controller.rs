use crate::models::{AppState, CreateGenreRequest, UpdateGenreRequest, GenreResponse};
use crate::persistences::genre_persistence;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use std::sync::Arc;
use uuid::Uuid;

/// Get all genres
pub async fn get_all_genres(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<GenreResponse>>, StatusCode> {
    match genre_persistence::get_all_genres(&state.db_pool).await {
        Ok(genres) => {
            let responses: Vec<GenreResponse> = genres.into_iter().map(|g| g.into()).collect();
            Ok(Json(responses))
        }
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

/// Get a single genre by ID
pub async fn get_genre(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<GenreResponse>, StatusCode> {
    let genre_id = Uuid::parse_str(&id).map_err(|_| StatusCode::BAD_REQUEST)?;

    match genre_persistence::get_genre_by_id(&state.db_pool, genre_id).await {
        Ok(Some(genre)) => Ok(Json(genre.into())),
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

/// Create a new genre
pub async fn create_genre(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateGenreRequest>,
) -> Result<(StatusCode, Json<GenreResponse>), StatusCode> {
    // Validate color format (should be hex color like #ec4899)
    if !payload.color.starts_with('#') || payload.color.len() != 7 {
        return Err(StatusCode::BAD_REQUEST);
    }

    match genre_persistence::create_genre(&state.db_pool, payload).await {
        Ok(genre) => Ok((StatusCode::CREATED, Json(genre.into()))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

/// Update a genre
pub async fn update_genre(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(payload): Json<UpdateGenreRequest>,
) -> Result<Json<GenreResponse>, StatusCode> {
    let genre_id = Uuid::parse_str(&id).map_err(|_| StatusCode::BAD_REQUEST)?;

    // Validate color format if provided
    if let Some(ref color) = payload.color {
        if !color.starts_with('#') || color.len() != 7 {
            return Err(StatusCode::BAD_REQUEST);
        }
    }

    match genre_persistence::update_genre(&state.db_pool, genre_id, payload).await {
        Ok(Some(genre)) => Ok(Json(genre.into())),
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

/// Delete a genre
pub async fn delete_genre(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<StatusCode, StatusCode> {
    let genre_id = Uuid::parse_str(&id).map_err(|_| StatusCode::BAD_REQUEST)?;

    match genre_persistence::delete_genre(&state.db_pool, genre_id).await {
        Ok(true) => Ok(StatusCode::NO_CONTENT),
        Ok(false) => Err(StatusCode::NOT_FOUND),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}