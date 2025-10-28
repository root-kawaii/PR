use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Clone, Debug, Serialize, Deserialize, FromRow)]
pub struct EventEntity {
    pub id: Uuid,
    pub title: String,
    pub image_url: Option<String>,
    pub description: String,
    pub completed: bool,
}

#[derive(Debug, Deserialize)]
pub struct EventRequest {
    pub title: String,
    pub description: String,
    pub image_url: Option<String>,
    pub video_url: Option<String>,
}
