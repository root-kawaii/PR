use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use chrono::NaiveDateTime;

#[derive(Clone, Debug, Serialize, Deserialize, FromRow)]
pub struct EventEntity {
    pub id: Uuid,
    pub title: String,
    pub description: String,
    pub completed: bool,
    pub insert_date: chrono::NaiveDateTime,
    pub update_date: Option<chrono::NaiveDateTime>,
}

#[derive(Debug, Deserialize)]
pub struct EventRequest {
    pub title: String,
    pub description: String,
    pub video_url: Option<String>,
    pub insert_date: Option<chrono::NaiveDateTime>,
    pub update_date: Option<chrono::NaiveDateTime>,
}


#[derive(Debug, Serialize, Deserialize)]
pub struct EventResponse{
    pub id: Uuid,
    pub title: String,
    pub description: String,
    pub completed: bool,
    pub insert_date: NaiveDateTime,  
    pub update_date: Option<NaiveDateTime>,
}