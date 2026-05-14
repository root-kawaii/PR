use std::sync::Arc;

use axum::{routing::get, Router};

use crate::bootstrap::state::AppState;
use crate::controllers::ticket_controller::{
    claim_free_ticket, confirm_ticket_purchase, create_ticket, create_ticket_purchase_intent,
    delete_ticket, get_all_tickets, get_ticket, get_ticket_by_code, get_user_tickets_with_events,
    update_ticket,
};

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route(
            "/tickets/purchase/payment-intent",
            axum::routing::post(create_ticket_purchase_intent),
        )
        .route(
            "/tickets/purchase/confirm",
            axum::routing::post(confirm_ticket_purchase),
        )
        .route(
            "/tickets/claim-free",
            axum::routing::post(claim_free_ticket),
        )
        .route("/tickets", get(get_all_tickets).post(create_ticket))
        .route(
            "/tickets/:id",
            get(get_ticket).put(update_ticket).delete(delete_ticket),
        )
        .route("/tickets/code/:code", get(get_ticket_by_code))
        .route("/tickets/user/:user_id", get(get_user_tickets_with_events))
}
