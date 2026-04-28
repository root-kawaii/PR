use std::sync::Arc;

use axum::{
    routing::{delete, post},
    Router,
};
use tower_governor::{
    governor::GovernorConfigBuilder, key_extractor::SmartIpKeyExtractor, GovernorLayer,
};

use crate::bootstrap::state::AppState;
use crate::controllers::auth_controller::{
    change_password, delete_account, login, register, register_push_token, send_sms_verification,
    verify_sms_code,
};
use crate::controllers::club_owner_controller::{
    change_club_owner_password, login_club_owner, register_club_owner,
};

pub fn router() -> Router<Arc<AppState>> {
    let auth_governor_conf = Arc::new(
        GovernorConfigBuilder::default()
            .key_extractor(SmartIpKeyExtractor)
            .per_second(6)
            .burst_size(10)
            .finish()
            .unwrap(),
    );

    Router::new()
        .route("/auth/register", post(register))
        .route("/auth/login", post(login))
        .route("/auth/change-password", post(change_password))
        .route("/auth/account", delete(delete_account))
        .route("/auth/send-sms-verification", post(send_sms_verification))
        .route("/auth/verify-sms-code", post(verify_sms_code))
        .route("/auth/push-token", post(register_push_token))
        .route("/auth/club-owner/register", post(register_club_owner))
        .route("/auth/club-owner/login", post(login_club_owner))
        .route(
            "/auth/club-owner/change-password",
            post(change_club_owner_password),
        )
        .layer(GovernorLayer {
            config: auth_governor_conf,
        })
}
