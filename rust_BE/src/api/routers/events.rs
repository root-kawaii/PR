use std::sync::Arc;

use axum::{routing::get, Router};

use crate::bootstrap::state::AppState;
use crate::controllers::event_controller::{create_event, delete_event, get_all_events, get_event, update_event};

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/events", get(get_all_events).post(create_event))
        .route("/events/:id", get(get_event).put(update_event).delete(delete_event))
}
