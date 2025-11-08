use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;

// ============================================================================
// Table Model (represents physical tables at events)
// ============================================================================

#[derive(Clone, Debug, Serialize, Deserialize, FromRow)]
pub struct Table {
    pub id: Uuid,
    pub event_id: Uuid,
    pub name: String,
    pub zone: Option<String>,
    pub capacity: i32,
    pub min_spend: Decimal,
    pub total_cost: Decimal,
    pub available: bool,
    pub location_description: Option<String>,
    pub features: Option<Vec<String>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateTableRequest {
    pub event_id: String,
    pub name: String,
    pub zone: Option<String>,
    pub capacity: i32,
    pub min_spend: f64, // Frontend sends as number
    pub location_description: Option<String>,
    pub features: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTableRequest {
    pub name: Option<String>,
    pub zone: Option<String>,
    pub capacity: Option<i32>,
    pub min_spend: Option<f64>,
    pub available: Option<bool>,
    pub location_description: Option<String>,
    pub features: Option<Vec<String>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TableResponse {
    pub id: String,
    pub event_id: String,
    pub name: String,
    pub zone: Option<String>,
    pub capacity: i32,
    pub min_spend: String, // Formatted as "X.XX €"
    pub total_cost: String, // Formatted as "X.XX €"
    pub available: bool,
    pub location_description: Option<String>,
    pub features: Option<Vec<String>>,
}

impl From<Table> for TableResponse {
    fn from(table: Table) -> Self {
        TableResponse {
            id: table.id.to_string(),
            event_id: table.event_id.to_string(),
            name: table.name,
            zone: table.zone,
            capacity: table.capacity,
            min_spend: format!("{:.2} €", table.min_spend),
            total_cost: format!("{:.2} €", table.total_cost),
            available: table.available,
            location_description: table.location_description,
            features: table.features,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct TablesResponse {
    pub tables: Vec<TableResponse>,
}

// ============================================================================
// Table Reservation Model (represents bookings of tables)
// ============================================================================

#[derive(Clone, Debug, Serialize, Deserialize, FromRow)]
pub struct TableReservation {
    pub id: Uuid,
    pub table_id: Uuid,
    pub user_id: Uuid,
    pub event_id: Uuid,
    pub status: String,
    pub num_people: i32,
    pub total_amount: Decimal,
    pub amount_paid: Decimal,
    pub contact_name: String,
    pub contact_email: String,
    pub contact_phone: String,
    pub special_requests: Option<String>,
    pub reservation_code: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateTableReservationRequest {
    pub table_id: String,
    pub event_id: String,
    pub num_people: i32,
    pub contact_name: String,
    pub contact_email: String,
    pub contact_phone: String,
    pub special_requests: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTableReservationRequest {
    pub status: Option<String>,
    pub num_people: Option<i32>,
    pub contact_name: Option<String>,
    pub contact_email: Option<String>,
    pub contact_phone: Option<String>,
    pub special_requests: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TableReservationResponse {
    pub id: String,
    pub table_id: String,
    pub user_id: String,
    pub event_id: String,
    pub status: String,
    pub num_people: i32,
    pub total_amount: String, // Formatted as "X.XX €"
    pub amount_paid: String, // Formatted as "X.XX €"
    pub amount_remaining: String, // Calculated
    pub contact_name: String,
    pub contact_email: String,
    pub contact_phone: String,
    pub special_requests: Option<String>,
    pub reservation_code: String,
    pub created_at: String,
}

impl From<TableReservation> for TableReservationResponse {
    fn from(reservation: TableReservation) -> Self {
        let amount_remaining = reservation.total_amount - reservation.amount_paid;

        TableReservationResponse {
            id: reservation.id.to_string(),
            table_id: reservation.table_id.to_string(),
            user_id: reservation.user_id.to_string(),
            event_id: reservation.event_id.to_string(),
            status: reservation.status,
            num_people: reservation.num_people,
            total_amount: format!("{:.2} €", reservation.total_amount),
            amount_paid: format!("{:.2} €", reservation.amount_paid),
            amount_remaining: format!("{:.2} €", amount_remaining),
            contact_name: reservation.contact_name,
            contact_email: reservation.contact_email,
            contact_phone: reservation.contact_phone,
            special_requests: reservation.special_requests,
            reservation_code: reservation.reservation_code,
            created_at: reservation.created_at.to_rfc3339(),
        }
    }
}

// Response with table and event details joined
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TableReservationWithDetailsResponse {
    pub id: String,
    pub reservation_code: String,
    pub status: String,
    pub num_people: i32,
    pub total_amount: String,
    pub amount_paid: String,
    pub amount_remaining: String,
    pub contact_name: String,
    pub contact_email: String,
    pub contact_phone: String,
    pub special_requests: Option<String>,
    pub created_at: String,
    pub table: TableSummary,
    pub event: EventSummary,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TableSummary {
    pub id: String,
    pub name: String,
    pub zone: Option<String>,
    pub capacity: i32,
    pub min_spend: String,
    pub location_description: Option<String>,
    pub features: Option<Vec<String>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EventSummary {
    pub id: String,
    pub title: String,
    pub venue: String,
    pub date: String,
    pub image: String,
}

#[derive(Debug, Serialize)]
pub struct TableReservationsResponse {
    pub reservations: Vec<TableReservationResponse>,
}

#[derive(Debug, Serialize)]
pub struct TableReservationsWithDetailsResponse {
    pub reservations: Vec<TableReservationWithDetailsResponse>,
}

// ============================================================================
// Payment tracking
// ============================================================================

#[derive(Clone, Debug, Serialize, Deserialize, FromRow)]
pub struct TableReservationPayment {
    pub id: Uuid,
    pub reservation_id: Uuid,
    pub payment_id: Uuid,
    pub amount: Decimal,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct AddPaymentToReservationRequest {
    pub payment_id: String,
    pub amount: f64,
}

// ============================================================================
// Ticket linking
// ============================================================================

#[derive(Clone, Debug, Serialize, Deserialize, FromRow)]
pub struct TableReservationTicket {
    pub id: Uuid,
    pub reservation_id: Uuid,
    pub ticket_id: Uuid,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct LinkTicketToReservationRequest {
    pub ticket_id: String,
}