use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Clone, Debug, Serialize, Deserialize, FromRow)]
pub struct Area {
    pub id: Uuid,
    pub club_id: Uuid,
    pub name: String,
    pub price: Decimal,
    pub description: Option<String>,
    pub marzipano_position: Option<JsonValue>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateAreaRequest {
    pub name: String,
    pub price: f64,
    pub description: Option<String>,
    pub marzipano_position: Option<JsonValue>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateAreaRequest {
    pub name: Option<String>,
    pub price: Option<f64>,
    pub description: Option<String>,
    pub marzipano_position: Option<JsonValue>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AreaResponse {
    pub id: String,
    pub club_id: String,
    pub name: String,
    pub price: String,
    pub description: Option<String>,
    pub marzipano_position: Option<JsonValue>,
}

impl From<Area> for AreaResponse {
    fn from(a: Area) -> Self {
        AreaResponse {
            id: a.id.to_string(),
            club_id: a.club_id.to_string(),
            name: a.name,
            price: format!("{:.2} €", a.price),
            description: a.description,
            marzipano_position: a.marzipano_position,
        }
    }
}

/// Body for PATCH /owner/tables/:table_id/area
#[derive(Debug, Deserialize)]
pub struct AssignAreaRequest {
    /// Pass null to unlink the table from its area (keeps current min_spend)
    pub area_id: Option<String>,
}
