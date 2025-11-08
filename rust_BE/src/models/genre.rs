use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use chrono::{DateTime, Utc};

#[derive(Clone, Debug, Serialize, Deserialize, FromRow)]
pub struct Genre {
    pub id: Uuid,
    pub name: String,
    pub color: String, // Hex color code like #ec4899
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateGenreRequest {
    pub name: String,
    pub color: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateGenreRequest {
    pub name: Option<String>,
    pub color: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GenreResponse {
    pub id: String,
    pub name: String,
    pub color: String,
}

impl From<Genre> for GenreResponse {
    fn from(genre: Genre) -> Self {
        GenreResponse {
            id: genre.id.to_string(),
            name: genre.name,
            color: genre.color,
        }
    }
}