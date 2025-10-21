// src/models.rs

use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

// Mark structs as public so other modules can use them
#[derive(Clone, Debug, Serialize, Deserialize, FromRow)]
pub struct Event {
    pub id: Uuid,
    pub title: String,
    pub image_url: Option<String>,
    pub description: String,
    pub completed: bool,
}

#[derive(Debug, Deserialize)]
pub struct CreateEvent {
    pub title: String,
    pub description: String,
    pub image_url: Option<String>,
    pub video_url: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateEvent {
    pub title: Option<String>,
    pub description: Option<String>,
    pub completed: Option<bool>,
    pub image_url: Option<String>,
    pub video_url: Option<String>,
}

pub type AppState = sqlx::PgPool;