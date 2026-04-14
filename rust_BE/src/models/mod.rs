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
    CreatePaymentIntentResponse,
    ReservationPaymentShare, ReservationGuest,
    CreateSplitPaymentIntentRequest, CreateSplitReservationRequest, CreateSplitReservationResponse,
    PaymentShareResponse, PaymentLinkPreviewResponse,
    CreateCheckoutRequest, CreateCheckoutResponse,
    ReservationPaymentStatusResponse
};

pub mod area;
pub use area::{Area, CreateAreaRequest, UpdateAreaRequest, AreaResponse, AssignAreaRequest};

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

fn default_limit() -> i64 { 50 }
