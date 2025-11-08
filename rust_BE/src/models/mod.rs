// src/models.rs
pub mod event;
pub use event::{EventEntity, EventRequest};

pub mod event_new;
pub use event_new::{Event, CreateEventRequest, UpdateEventRequest, EventResponse};

pub mod payment;
pub use payment::{PaymentEntity, PaymentRequest, PaymentFilter, PaymentStatus};

pub mod user;
pub use user::{User, UserResponse, RegisterRequest, LoginRequest, AuthResponse, Claims};

pub mod genre;
pub use genre::{Genre, CreateGenreRequest, UpdateGenreRequest, GenreResponse};

pub mod club;
pub use club::{Club, CreateClubRequest, UpdateClubRequest, ClubResponse};

pub mod ticket;
pub use ticket::{Ticket, CreateTicketRequest, UpdateTicketRequest, TicketResponse, TicketWithEventResponse, EventSummary};

pub mod table;
pub use table::{
    Table, CreateTableRequest, UpdateTableRequest, TableResponse, TablesResponse,
    TableReservation, CreateTableReservationRequest, UpdateTableReservationRequest,
    TableReservationResponse, TableReservationWithDetailsResponse, TableReservationsResponse, TableReservationsWithDetailsResponse,
    TableSummary, TableReservationPayment, TableReservationTicket,
    AddPaymentToReservationRequest, LinkTicketToReservationRequest
};

pub struct AppState {
    pub db_pool: sqlx::PgPool,
    pub stripe_client: stripe::Client,
    pub jwt_secret: String,
}