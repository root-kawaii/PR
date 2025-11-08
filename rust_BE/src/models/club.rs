use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use chrono::{DateTime, Utc};

#[derive(Clone, Debug, Serialize, Deserialize, FromRow)]
pub struct Club {
    pub id: Uuid,
    pub name: String,
    pub subtitle: Option<String>,
    pub image: String,
    pub address: Option<String>,
    pub phone_number: Option<String>,
    pub website: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateClubRequest {
    pub name: String,
    pub subtitle: Option<String>,
    pub image: String,
    pub address: Option<String>,
    pub phone_number: Option<String>,
    pub website: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateClubRequest {
    pub name: Option<String>,
    pub subtitle: Option<String>,
    pub image: Option<String>,
    pub address: Option<String>,
    pub phone_number: Option<String>,
    pub website: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ClubResponse {
    pub id: String,
    pub name: String,
    pub subtitle: String,
    pub image: String,
}

impl From<Club> for ClubResponse {
    fn from(club: Club) -> Self {
        ClubResponse {
            id: club.id.to_string(),
            name: club.name,
            subtitle: club.subtitle.unwrap_or_default(),
            image: club.image,
        }
    }
}