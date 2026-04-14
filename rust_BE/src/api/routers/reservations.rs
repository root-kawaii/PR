use std::sync::Arc;

use axum::{routing::get, Router};

use crate::bootstrap::state::AppState;
use crate::controllers::table_controller::{
    add_payment_to_reservation, create_payment_intent,
    create_payment_link_checkout, create_reservation, create_reservation_with_payment,
    delete_reservation, get_all_reservations, get_available_tables_by_event,
    get_payment_link_preview, get_reservation, get_reservation_by_code,
    get_reservation_payment_status, get_reservations_by_table, get_tables_by_event,
    get_tickets_for_reservation, get_user_reservations_with_details, get_all_tables, get_table,
    create_table, update_table, delete_table, link_ticket_to_reservation, payment_cancel_page,
    payment_success_page, guest_payment_page, update_reservation,
};

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/tables", get(get_all_tables).post(create_table))
        .route("/tables/:id", get(get_table).put(update_table).delete(delete_table))
        .route("/tables/event/:event_id", get(get_tables_by_event))
        .route("/tables/event/:event_id/available", get(get_available_tables_by_event))
        .route("/reservations", get(get_all_reservations))
        .route("/reservations/:id", get(get_reservation).put(update_reservation).delete(delete_reservation))
        .route("/reservations/code/:code", get(get_reservation_by_code))
        .route("/reservations/user/:user_id", get(get_user_reservations_with_details).post(create_reservation))
        .route("/reservations/table/:table_id", get(get_reservations_by_table))
        .route("/reservations/:reservation_id/payments", axum::routing::post(add_payment_to_reservation))
        .route("/reservations/:reservation_id/tickets", axum::routing::post(link_ticket_to_reservation).get(get_tickets_for_reservation))
        .route("/reservations/create-payment-intent", axum::routing::post(create_payment_intent))
        .route("/reservations/create-with-payment", axum::routing::post(create_reservation_with_payment))
        .route("/reservations/:reservation_id/payment-status", get(get_reservation_payment_status))
        .route("/pay/:token", get(guest_payment_page))
        .route("/payment/success", get(payment_success_page))
        .route("/payment/cancel/:token", get(payment_cancel_page))
        .route("/payment-links/:token", get(get_payment_link_preview))
        .route("/payment-links/:token/checkout", axum::routing::post(create_payment_link_checkout))
}
