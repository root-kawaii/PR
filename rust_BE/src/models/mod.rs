// src/models.rs
pub mod event;
pub use event::{Event, CreateEventRequest, UpdateEventRequest, EventResponse};

pub mod payment;
pub use payment::{PaymentEntity, PaymentRequest, PaymentFilter, PaymentStatus, PaymentCaptureMethod, CapturePaymentRequest, CapturePaymentResponse, CancelPaymentRequest, CancelPaymentResponse};

pub mod user;
pub use user::{User, UserResponse, RegisterRequest, LoginRequest, AuthResponse, Claims};

pub mod genre;
pub use genre::{Genre, CreateGenreRequest, UpdateGenreRequest, GenreResponse};

pub mod club;
pub use club::{Club, CreateClubRequest, UpdateClubRequest, ClubResponse};

pub mod club_owner;

pub mod ticket;
pub use ticket::{Ticket, CreateTicketRequest, UpdateTicketRequest, TicketResponse, TicketWithEventResponse, EventSummary};

pub mod table;
pub use table::{
    Table, CreateTableRequest, UpdateTableRequest, TableResponse, TablesResponse,
    TableReservation, CreateTableReservationRequest, UpdateTableReservationRequest,
    TableReservationResponse, TableReservationWithDetailsResponse, TableReservationsResponse, TableReservationsWithDetailsResponse,
    TableSummary,
    AddPaymentToReservationRequest, LinkTicketToReservationRequest,
    CreateReservationWithPaymentRequest, CreatePaymentIntentRequest, CreatePaymentIntentResponse,
    ReservationPaymentShare, ReservationGuest,
    CreateSplitPaymentIntentRequest, CreateSplitReservationRequest, CreateSplitReservationResponse,
    PaymentShareResponse, PaymentLinkPreviewResponse,
    VerifyPaymentLinkRequest, VerifyPaymentLinkResponse,
    CreateCheckoutRequest, CreateCheckoutResponse,
    AddFreeGuestRequest, FreeGuestResponse, ReservationPaymentStatusResponse
};

pub mod area;
pub use area::{Area, CreateAreaRequest, UpdateAreaRequest, AreaResponse, AssignAreaRequest};

use crate::idempotency::IdempotencyService;
use serde::{Deserialize, Serialize};
use axum::{response::{IntoResponse, Response}, http::StatusCode, Json as AxumJson};

/// Common pagination query params: ?limit=50&offset=0
#[derive(Debug, Deserialize)]
pub struct PaginationParams {
    #[serde(default = "default_limit")]
    pub limit: i64,
    #[serde(default)]
    pub offset: i64,
}

fn default_limit() -> i64 { 50 }

/// Standard JSON error envelope used by all API responses.
/// Frontend can always parse `{ "error": "...", "code": "..." }` on non-2xx.
#[derive(Debug, Serialize)]
pub struct ApiError {
    pub error: String,
    pub code: String,
}

impl ApiError {
    pub fn new(status: StatusCode, message: impl Into<String>) -> (StatusCode, AxumJson<ApiError>) {
        let code = status.canonical_reason().unwrap_or("error").to_lowercase().replace(' ', "_");
        (status, AxumJson(ApiError { error: message.into(), code }))
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (StatusCode::BAD_REQUEST, AxumJson(self)).into_response()
    }
}

pub struct AppState {
    pub db_pool: sqlx::PgPool,
    pub stripe_client: stripe::Client,
    pub jwt_secret: String,
    pub idempotency_service: IdempotencyService,
    pub stripe_webhook_secret: String,
    /// Optional Discord/Slack webhook URL for failure alerts
    pub alert_webhook_url: Option<String>,
    /// Hours before a pending payment share expires (default: 48)
    pub payment_share_ttl_hours: i64,
}