use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Clone, Debug, Serialize, Deserialize, FromRow)]
pub struct Event {
    pub id: Uuid,
    pub title: String,
    pub venue: String,
    pub date: String, // Format: "10 MAG | 23:00"
    pub image: String,
    pub status: Option<String>,
    pub time: Option<String>,
    pub age_limit: Option<String>,
    pub end_time: Option<String>,
    pub price: Option<String>,
    pub description: Option<String>,
    pub club_id: Option<Uuid>,
    pub tour_provider: Option<String>, // 'marzipano', 'kuula', 'cloudpano'
    pub marzipano_config: Option<JsonValue>, // JSON array of MarzipanoScene objects
    pub event_date: Option<chrono::NaiveDate>, // Machine-readable date for scheduler
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateEventRequest {
    pub title: String,
    pub venue: String,
    pub date: String,
    pub event_date: Option<chrono::NaiveDate>, // Machine-readable date (YYYY-MM-DD) for scheduler
    pub image: String,
    pub status: Option<String>,
    pub time: Option<String>,
    pub age_limit: Option<String>,
    pub end_time: Option<String>,
    pub price: Option<String>,
    pub description: Option<String>,
    pub club_id: Option<Uuid>,
    pub tour_provider: Option<String>,
    pub marzipano_config: Option<JsonValue>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateEventRequest {
    pub title: Option<String>,
    pub venue: Option<String>,
    pub date: Option<String>,
    pub event_date: Option<chrono::NaiveDate>, // Machine-readable date (YYYY-MM-DD) for scheduler
    pub image: Option<String>,
    pub status: Option<String>,
    pub time: Option<String>,
    pub age_limit: Option<String>,
    pub end_time: Option<String>,
    pub price: Option<String>,
    pub description: Option<String>,
    pub club_id: Option<Uuid>,
    pub tour_provider: Option<String>,
    pub marzipano_config: Option<JsonValue>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EventResponse {
    pub id: String,
    pub title: String,
    pub venue: String,
    pub date: String,
    pub image: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub time: Option<String>,
    #[serde(rename = "ageLimit")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub age_limit: Option<String>,
    #[serde(rename = "endTime")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub end_time: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub price: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(rename = "tourProvider")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tour_provider: Option<String>,
    #[serde(rename = "marzipanoScenes")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub marzipano_scenes: Option<JsonValue>,
}

impl From<Event> for EventResponse {
    fn from(event: Event) -> Self {
        EventResponse {
            id: event.id.to_string(),
            title: event.title,
            venue: event.venue,
            date: event.date,
            image: event.image,
            status: event.status,
            time: event.time,
            age_limit: event.age_limit,
            end_time: event.end_time,
            price: event.price,
            description: event.description,
            tour_provider: event.tour_provider,
            marzipano_scenes: event.marzipano_config,
        }
    }
}
