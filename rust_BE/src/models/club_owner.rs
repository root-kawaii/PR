use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use super::club::ClubResponse;

#[derive(Debug, Serialize, Deserialize, FromRow, Clone)]
pub struct ClubOwner {
    pub id: Uuid,
    pub email: String,
    #[serde(skip_serializing)]
    pub password_hash: String,
    pub name: String,
    pub phone_number: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct ClubOwnerResponse {
    pub id: Uuid,
    pub email: String,
    pub name: String,
    pub phone_number: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<ClubOwner> for ClubOwnerResponse {
    fn from(owner: ClubOwner) -> Self {
        ClubOwnerResponse {
            id: owner.id,
            email: owner.email,
            name: owner.name,
            phone_number: owner.phone_number,
            created_at: owner.created_at,
            updated_at: owner.updated_at,
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct ClubOwnerRegisterRequest {
    pub email: String,
    pub password: String,
    pub name: String,
    pub phone_number: Option<String>,
    pub club_name: String,
    pub club_image: String,
    pub club_address: Option<String>,
    pub club_subtitle: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ClubOwnerLoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct ClubOwnerAuthResponse {
    pub owner: ClubOwnerResponse,
    pub club: Option<ClubResponse>,
    pub token: String,
}
