use std::sync::Arc;

use axum::{routing::get, Router};

use crate::bootstrap::state::AppState;
use crate::controllers::club_controller::{
    create_club, delete_club, get_all_clubs, get_club, update_club,
};
use crate::controllers::genre_controller::{
    create_genre, delete_genre, get_all_genres, get_genre, update_genre,
};

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/genres", get(get_all_genres).post(create_genre))
        .route(
            "/genres/:id",
            get(get_genre).put(update_genre).delete(delete_genre),
        )
        .route("/clubs", get(get_all_clubs).post(create_club))
        .route(
            "/clubs/:id",
            get(get_club).put(update_club).delete(delete_club),
        )
}
