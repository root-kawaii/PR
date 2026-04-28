use std::sync::Arc;

use axum::{routing::get, Router};

use crate::bootstrap::state::AppState;
use crate::controllers::ticket_controller::{
    create_ticket, delete_ticket, get_all_tickets, get_ticket, get_ticket_by_code,
    get_user_tickets_with_events, update_ticket,
};

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/tickets", get(get_all_tickets).post(create_ticket))
        .route(
            "/tickets/:id",
            get(get_ticket).put(update_ticket).delete(delete_ticket),
        )
        .route("/tickets/code/:code", get(get_ticket_by_code))
        .route("/tickets/user/:user_id", get(get_user_tickets_with_events))
}
