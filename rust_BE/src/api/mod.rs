pub mod errors;
pub mod routers;

use std::sync::Arc;

use axum::{
    extract::State,
    http::{header, HeaderValue, Method, StatusCode},
    middleware::from_fn,
    routing::get,
    Json, Router,
};
use tower_http::cors::CorsLayer;

use crate::bootstrap::config::AppConfig;
use crate::bootstrap::state::AppState;

async fn health_check(
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    sqlx::query_scalar::<_, i32>("SELECT 1")
        .fetch_one(&state.db_pool)
        .await
        .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)?;
    Ok(Json(serde_json::json!({ "status": "ok" })))
}

fn cors_layer(config: &AppConfig) -> CorsLayer {
    let mut allowed_origins: Vec<HeaderValue> = vec![
        "http://localhost:3000".parse().unwrap(),
        "http://localhost:8081".parse().unwrap(),
        "https://pierre-two-backend.fly.dev".parse().unwrap(),
    ];
    if let Ok(origin) = config.app_base_url.parse::<HeaderValue>() {
        allowed_origins.push(origin);
    }

    CorsLayer::new()
        .allow_origin(allowed_origins)
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::PATCH,
            Method::DELETE,
        ])
        .allow_headers([header::CONTENT_TYPE, header::AUTHORIZATION])
}

pub fn build_router(app_state: Arc<AppState>) -> Router {
    let cors = cors_layer(app_state.config.as_ref());
    let (set_request_id, propagate_request_id) = crate::middleware::request_id::request_id_layer();

    Router::new()
        .route("/health", get(health_check))
        .merge(crate::api::routers::auth::router())
        .merge(crate::api::routers::events::router())
        .merge(crate::api::routers::clubs::router())
        .merge(crate::api::routers::tickets::router())
        .merge(crate::api::routers::reservations::router())
        .merge(crate::api::routers::owner::router())
        .merge(crate::api::routers::payments::router())
        .merge(crate::api::routers::areas::router())
        .merge(crate::api::routers::webhooks::router())
        .with_state(app_state)
        .layer(from_fn(crate::middleware::request_id::trace_request))
        .layer(set_request_id)
        .layer(propagate_request_id)
        .layer(cors)
}
