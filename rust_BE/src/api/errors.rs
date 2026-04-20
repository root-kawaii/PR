use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct ApiError {
    pub error: String,
    pub code: String,
}

#[derive(Debug, Clone)]
pub struct AppError {
    pub status: StatusCode,
    pub message: String,
    pub code: String,
}

pub type AppResult<T> = Result<T, AppError>;

impl AppError {
    pub fn new(status: StatusCode, message: impl Into<String>) -> Self {
        let code = status
            .canonical_reason()
            .unwrap_or("error")
            .to_lowercase()
            .replace(' ', "_");
        Self {
            status,
            message: message.into(),
            code,
        }
    }

    pub fn response(
        status: StatusCode,
        message: impl Into<String>,
    ) -> (StatusCode, Json<ApiError>) {
        let err = Self::new(status, message);
        (
            err.status,
            Json(ApiError {
                error: err.message,
                code: err.code,
            }),
        )
    }

    pub fn validation(message: impl Into<String>) -> Self {
        Self::new(StatusCode::BAD_REQUEST, message)
    }

    pub fn unauthorized(message: impl Into<String>) -> Self {
        Self::new(StatusCode::UNAUTHORIZED, message)
    }

    pub fn forbidden(message: impl Into<String>) -> Self {
        Self::new(StatusCode::FORBIDDEN, message)
    }

    pub fn not_found(message: impl Into<String>) -> Self {
        Self::new(StatusCode::NOT_FOUND, message)
    }

    pub fn conflict(message: impl Into<String>) -> Self {
        Self::new(StatusCode::CONFLICT, message)
    }

    pub fn external_dependency(message: impl Into<String>) -> Self {
        Self::new(StatusCode::BAD_GATEWAY, message)
    }

    pub fn internal(message: impl Into<String>) -> Self {
        Self::new(StatusCode::INTERNAL_SERVER_ERROR, message)
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        (
            self.status,
            Json(ApiError {
                error: self.message,
                code: self.code,
            }),
        )
            .into_response()
    }
}

impl From<StatusCode> for AppError {
    fn from(status: StatusCode) -> Self {
        Self::new(
            status,
            status.canonical_reason().unwrap_or("Request failed"),
        )
    }
}

impl From<sqlx::Error> for AppError {
    fn from(error: sqlx::Error) -> Self {
        match error {
            sqlx::Error::RowNotFound => Self::new(StatusCode::NOT_FOUND, "Risorsa non trovata"),
            other => {
                tracing::error!(error = %other, "Database error");
                Self::new(StatusCode::INTERNAL_SERVER_ERROR, "Errore interno")
            }
        }
    }
}

impl ApiError {
    pub fn new(status: StatusCode, message: impl Into<String>) -> (StatusCode, Json<ApiError>) {
        AppError::response(status, message)
    }
}
