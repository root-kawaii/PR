use std::sync::Arc;

use axum::{routing::get, Router};

use crate::bootstrap::state::AppState;
use crate::controllers::club_controller::{
    create_club, delete_club, get_all_clubs, get_club, update_club,
};
pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/clubs", get(get_all_clubs).post(create_club))
        .route(
            "/clubs/:id",
            get(get_club).put(update_club).delete(delete_club),
        )
}
