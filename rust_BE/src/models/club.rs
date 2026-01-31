use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Clone, Debug, Serialize, Deserialize, FromRow)]
pub struct Club {
    pub id: Uuid,
    pub name: String,
    pub subtitle: Option<String>,
    pub image: String,
    pub address: Option<String>,
    pub phone_number: Option<String>,
    pub website: Option<String>,
    pub owner_id: Option<Uuid>,
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
    pub owner_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateClubRequest {
    pub name: Option<String>,
    pub subtitle: Option<String>,
    pub image: Option<String>,
    pub address: Option<String>,
    pub phone_number: Option<String>,
    pub website: Option<String>,
    pub owner_id: Option<Uuid>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ClubResponse {
    pub id: String,
    pub name: String,
    pub subtitle: String,
    pub image: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub owner_id: Option<String>,
}

impl From<Club> for ClubResponse {
    fn from(club: Club) -> Self {
        ClubResponse {
            id: club.id.to_string(),
            name: club.name,
            subtitle: club.subtitle.unwrap_or_default(),
            image: club.image,
            owner_id: club.owner_id.map(|id| id.to_string()),
        }
    }
}
