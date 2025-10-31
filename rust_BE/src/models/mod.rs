// src/models.rs

pub mod event;

pub use event::EventEntity;
pub use event::EventRequest;

pub type AppState = sqlx::PgPool;


pub mod payment;
pub use payment::PaymentEntity;
pub use payment::PaymentRequest;
pub use payment::PaymentFilter;
pub use payment::PaymentStatus;