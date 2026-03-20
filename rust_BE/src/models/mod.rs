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

use crate::idempotency::IdempotencyService;

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