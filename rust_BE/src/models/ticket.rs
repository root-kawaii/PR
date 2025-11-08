use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;

#[derive(Clone, Debug, Serialize, Deserialize, FromRow)]
pub struct Ticket {
    pub id: Uuid,
    pub event_id: Uuid,
    pub user_id: Uuid,
    pub ticket_code: String,
    pub ticket_type: String,
    pub price: Decimal,
    pub status: String,
    pub purchase_date: DateTime<Utc>,
    pub qr_code: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateTicketRequest {
    pub event_id: Uuid,
    pub user_id: Uuid,
    pub ticket_type: String,
    pub price: Decimal,
    pub status: Option<String>,
    pub qr_code: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTicketRequest {
    pub ticket_type: Option<String>,
    pub price: Option<Decimal>,
    pub status: Option<String>,
    pub qr_code: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TicketResponse {
    pub id: String,
    pub event_id: String,
    pub user_id: String,
    #[serde(rename = "ticketCode")]
    pub ticket_code: String,
    #[serde(rename = "ticketType")]
    pub ticket_type: String,
    pub price: String, // Send as string for consistent formatting
    pub status: String,
    #[serde(rename = "purchaseDate")]
    pub purchase_date: String,
    #[serde(rename = "qrCode")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub qr_code: Option<String>,
}

impl From<Ticket> for TicketResponse {
    fn from(ticket: Ticket) -> Self {
        TicketResponse {
            id: ticket.id.to_string(),
            event_id: ticket.event_id.to_string(),
            user_id: ticket.user_id.to_string(),
            ticket_code: ticket.ticket_code,
            ticket_type: ticket.ticket_type,
            price: format!("{:.2} €", ticket.price),
            status: ticket.status,
            purchase_date: ticket.purchase_date.to_rfc3339(),
            qr_code: ticket.qr_code,
        }
    }
}

// Extended response with event details
#[derive(Debug, Serialize, Deserialize)]
pub struct TicketWithEventResponse {
    pub id: String,
    #[serde(rename = "ticketCode")]
    pub ticket_code: String,
    #[serde(rename = "ticketType")]
    pub ticket_type: String,
    pub price: String,
    pub status: String,
    #[serde(rename = "purchaseDate")]
    pub purchase_date: String,
    #[serde(rename = "qrCode")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub qr_code: Option<String>,
    // Event details
    pub event: EventSummary,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EventSummary {
    pub id: String,
    pub title: String,
    pub venue: String,
    pub date: String,
    pub image: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
}