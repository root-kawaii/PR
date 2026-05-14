use axum::{http::StatusCode, Json};
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct ApiError {
    pub error: String,
    pub code: String,
}

impl ApiError {
    pub fn new(status: StatusCode, message: impl Into<String>) -> (StatusCode, Json<ApiError>) {
        let code = status
            .canonical_reason()
            .unwrap_or("error")
            .to_lowercase()
            .replace(' ', "_");
        (
            status,
            Json(ApiError {
                error: message.into(),
                code,
            }),
        )
    }
}
