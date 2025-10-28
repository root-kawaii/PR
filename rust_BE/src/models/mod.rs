// src/models.rs

pub mod event;

pub use event::EventEntity;
pub use event::EventRequest;

pub type AppState = sqlx::PgPool;