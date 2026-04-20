// src/models.rs
pub mod event;
pub use event::{CreateEventRequest, Event, EventResponse, UpdateEventRequest};

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

pub mod ticket;
pub use ticket::{
    CreateTicketRequest, EventSummary, Ticket, TicketResponse, TicketWithEventResponse,
    UpdateTicketRequest,
};

pub mod table;
pub use table::{
    AddPaymentToReservationRequest, CreateCheckoutRequest, CreateCheckoutResponse,
    CreatePaymentIntentResponse, CreateSplitPaymentIntentRequest, CreateSplitReservationRequest,
    CreateSplitReservationResponse, CreateTableRequest, CreateTableReservationRequest,
    LinkTicketToReservationRequest, PaymentLinkPreviewResponse, PaymentShareResponse,
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
