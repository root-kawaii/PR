use std::sync::Arc;

use axum::{routing::get, Router};

use crate::bootstrap::state::AppState;
use crate::controllers::payment_controller::{
    cancel_payment, capture_payment, delete_payment, get_all_payments, get_payment,
    post_authorized_payment, post_payment,
};

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/payments", get(get_all_payments).post(post_payment))
        .route(
            "/payments/authorize",
            axum::routing::post(post_authorized_payment),
        )
        .route("/payments/:id", get(get_payment).delete(delete_payment))
        .route(
            "/payments/:id/capture",
            axum::routing::post(capture_payment),
        )
        .route("/payments/:id/cancel", axum::routing::post(cancel_payment))
}
