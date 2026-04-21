use std::sync::Arc;

use axum::{routing::post, Router};

use crate::bootstrap::state::AppState;
use crate::controllers::webhook_controller::handle_stripe_webhook;

pub fn router() -> Router<Arc<AppState>> {
    Router::new().route("/stripe/webhooks", post(handle_stripe_webhook))
}
