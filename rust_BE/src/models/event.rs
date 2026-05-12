use chrono::{DateTime, Utc};
use reqwest::Url;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use sqlx::FromRow;
use std::str::FromStr;
use uuid::Uuid;

use crate::models::genre::GenreResponse;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct EventPricingResponse {
    pub is_free: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub display_price: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize, FromRow)]
pub struct Event {
    pub id: Uuid,
    pub title: String,
    pub venue: String,
    pub date: String,
    pub image: String,
    pub status: Option<String>,
    pub time: Option<String>,
    pub age_limit: Option<String>,
    pub end_time: Option<String>,
    pub price: Option<String>,
    pub entry_type: Option<String>,
    pub ticketing_mode: Option<String>,
    pub has_reservable_areas: Option<bool>,
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
    pub entry_type: Option<String>,
    pub ticketing_mode: Option<String>,
    pub description: Option<String>,
    pub club_id: Option<Uuid>,
    pub tour_provider: Option<String>,
    pub marzipano_config: Option<JsonValue>,
    pub genre_ids: Option<Vec<Uuid>>,
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
    pub entry_type: Option<String>,
    pub ticketing_mode: Option<String>,
    pub description: Option<String>,
    pub club_id: Option<Uuid>,
    pub tour_provider: Option<String>,
    pub marzipano_config: Option<JsonValue>,
    pub genre_ids: Option<Vec<Uuid>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EventResponse {
    pub id: String,
    pub title: String,
    pub venue: String,
    #[serde(rename = "clubName")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub club_name: Option<String>,
    #[serde(rename = "clubAddress")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub club_address: Option<String>,
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
    #[serde(rename = "entryType")]
    pub entry_type: String,
    #[serde(rename = "ticketingMode")]
    pub ticketing_mode: String,
    #[serde(rename = "hasReservableAreas")]
    pub has_reservable_areas: bool,
    pub pricing: EventPricingResponse,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(rename = "tourProvider")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tour_provider: Option<String>,
    #[serde(rename = "marzipanoScenes")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub marzipano_scenes: Option<JsonValue>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub genres: Vec<GenreResponse>,
}

pub fn is_valid_event_image_url(url: &str) -> bool {
    let trimmed = url.trim();
    if trimmed.is_empty() {
        return true;
    }

    match Url::parse(trimmed) {
        Ok(parsed) => matches!(parsed.scheme(), "http" | "https") && parsed.host().is_some(),
        Err(_) => false,
    }
}

pub fn normalize_event_price(price: Option<String>) -> Option<String> {
    price.and_then(|p| {
        let trimmed = p.trim().to_string();
        if trimmed.is_empty() {
            None
        } else if is_zero_price(Some(trimmed.as_str())) {
            None
        } else {
            Some(trimmed)
        }
    })
}

fn parse_price_decimal(raw_price: &str) -> Option<Decimal> {
    let cleaned = raw_price
        .trim()
        .replace('€', "")
        .replace(' ', "")
        .replace(',', ".");
    if cleaned.is_empty() {
        return None;
    }

    Decimal::from_str(&cleaned).ok()
}

fn is_zero_price(price: Option<&str>) -> bool {
    price
        .and_then(parse_price_decimal)
        .is_some_and(|amount| amount.is_zero())
}

pub fn infer_entry_type(price: Option<&str>) -> String {
    if price.is_some_and(|p| !p.trim().is_empty()) && !is_zero_price(price) {
        "ticketed".to_string()
    } else {
        "free".to_string()
    }
}

pub fn normalize_entry_type(entry_type: Option<String>, price: Option<&str>) -> String {
    match entry_type
        .as_deref()
        .map(str::trim)
        .map(str::to_ascii_lowercase)
        .as_deref()
    {
        Some("free") => "free".to_string(),
        Some("ticketed") => "ticketed".to_string(),
        _ => infer_entry_type(price),
    }
}

pub fn infer_ticketing_mode(entry_type: Option<&str>, price: Option<&str>) -> String {
    if normalize_entry_type(entry_type.map(str::to_string), price) == "ticketed" {
        "paid".to_string()
    } else {
        "none".to_string()
    }
}

pub fn normalize_ticketing_mode(
    ticketing_mode: Option<String>,
    entry_type: Option<&str>,
    price: Option<&str>,
) -> String {
    match ticketing_mode
        .as_deref()
        .map(str::trim)
        .map(str::to_ascii_lowercase)
        .as_deref()
    {
        Some("none") => "none".to_string(),
        Some("free") => "free".to_string(),
        Some("paid") => "paid".to_string(),
        _ => infer_ticketing_mode(entry_type, price),
    }
}

impl From<Event> for EventResponse {
    fn from(event: Event) -> Self {
        // Derive time from ISO date if the time column is empty/null
        let time = match event.time.as_deref() {
            Some(t) if !t.is_empty() => Some(t.to_string()),
            _ => event
                .date
                .find('T')
                .map(|pos| event.date[pos + 1..].chars().take(5).collect()),
        };
        // Treat empty string as no-status (allows clearing via dashboard)
        let status = event.status.filter(|s| !s.is_empty());
        let price = normalize_event_price(event.price);
        let entry_type = normalize_entry_type(event.entry_type.clone(), price.as_deref());
        let ticketing_mode = normalize_ticketing_mode(
            event.ticketing_mode,
            Some(entry_type.as_str()),
            price.as_deref(),
        );
        EventResponse {
            id: event.id.to_string(),
            title: event.title,
            venue: event.venue,
            club_name: None,
            club_address: None,
            date: event.date,
            image: event.image,
            status,
            time,
            age_limit: event.age_limit.filter(|s| !s.is_empty()),
            end_time: event.end_time.filter(|s| !s.is_empty()),
            price: price.clone(),
            entry_type,
            ticketing_mode,
            has_reservable_areas: event.has_reservable_areas.unwrap_or(false),
            pricing: EventPricingResponse {
                is_free: price.is_none() || is_zero_price(price.as_deref()),
                display_price: if is_zero_price(price.as_deref()) {
                    None
                } else {
                    price
                },
            },
            description: event.description,
            tour_provider: event.tour_provider,
            marzipano_scenes: event.marzipano_config,
            genres: vec![],
        }
    }
}
