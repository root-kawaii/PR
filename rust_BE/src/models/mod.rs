// src/models.rs
pub mod event;
pub use event::{
    is_valid_event_image_url, normalize_entry_type, normalize_event_price,
    normalize_ticketing_mode, CreateEventRequest, Event, EventResponse, UpdateEventRequest,
};

pub mod payment;
pub use payment::{
    CancelPaymentRequest, CancelPaymentResponse, CapturePaymentRequest, CapturePaymentResponse,
    PaymentCaptureMethod, PaymentEntity, PaymentFilter, PaymentRequest, PaymentStatus,
};

pub mod user;
pub use user::{AuthResponse, Claims, LoginRequest, RegisterRequest, User, UserResponse};

pub mod genre;
pub use genre::{CreateGenreRequest, Genre, GenreResponse, UpdateGenreRequest};

pub mod club;
pub use club::{Club, ClubResponse, CreateClubRequest, UpdateClubRequest};

pub mod club_owner;

pub mod reservation_status;
pub use reservation_status::{normalize_refusal_reason, ReservationStatus};

pub mod ticket;
pub use ticket::{
    ClaimFreeTicketRequest, ConfirmTicketPurchaseRequest, CreateTicketPurchaseIntentRequest,
    CreateTicketRequest, EventSummary, Ticket, TicketPurchaseIntentResponse, TicketResponse,
    TicketWithEventResponse, UpdateTicketRequest,
};

pub mod table;
pub use table::{
    AddPaymentToReservationRequest, CreateCheckoutRequest, CreateCheckoutResponse,
    CreateClubTableRequest, CreatePaymentIntentResponse, CreateSplitPaymentIntentRequest,
    CreateTableReservationRequest, LinkTicketToReservationRequest, PaymentLinkPreviewResponse,
    CreateSplitReservationRequest, CreateSplitReservationResponse, CreateTableRequest,
    PaymentShareResponse,
    ReservationGuest, ReservationPaymentShare, ReservationPaymentStatusResponse, Table,
    TableReservation, TableReservationResponse, TableReservationWithDetailsResponse,
    TableReservationsResponse, TableReservationsWithDetailsResponse, TableResponse, TableSummary,
    TablesResponse, UpdateTableRequest, UpdateTableReservationRequest,
};

pub mod area;
pub use area::{Area, AreaResponse, AssignAreaRequest, CreateAreaRequest, UpdateAreaRequest};

use serde::Deserialize;

#[allow(unused_imports)]
pub use crate::api::errors::{ApiError, AppError, AppResult};
#[allow(unused_imports)]
pub use crate::bootstrap::state::AppState;

/// Common pagination query params: ?limit=50&offset=0
#[derive(Debug, Deserialize)]
pub struct PaginationParams {
    #[serde(default = "default_limit")]
    pub limit: i64,
    #[serde(default)]
    pub offset: i64,
}

fn default_limit() -> i64 {
    50
}
