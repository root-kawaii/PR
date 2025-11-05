// src/models.rs
pub mod event;
pub use event::EventEntity;
pub use event::EventRequest;

pub mod payment;
pub use payment::PaymentEntity;
pub use payment::PaymentRequest;
pub use payment::PaymentFilter;
pub use payment::PaymentStatus;

pub mod user;
pub use user::{User, UserResponse, RegisterRequest, LoginRequest, AuthResponse, Claims};

pub struct AppState {
    pub db_pool: sqlx::PgPool,
    pub stripe_client: stripe::Client,
    pub jwt_secret: String,
}