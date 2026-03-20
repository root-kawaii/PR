use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use sqlx::FromRow;
use uuid::Uuid;
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use super::ticket::EventSummary;

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
    pub marzipano_position: Option<JsonValue>, // NEW: {sceneId, yaw, pitch}
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
    pub marzipano_position: Option<JsonValue>,
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
    pub marzipano_position: Option<JsonValue>,
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
    pub marzipano_position: Option<JsonValue>,
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
            marzipano_position: table.marzipano_position,
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
    pub guest_user_ids: Option<Vec<Uuid>>,
    pub payment_ids: Option<Vec<Uuid>>,
    pub ticket_ids: Option<Vec<Uuid>>,
    pub is_manual: bool,
    pub manual_notes: Option<String>,
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

#[derive(Debug, Deserialize, Clone, Serialize)]
pub struct CreateReservationWithPaymentRequest {
    pub table_id: String,
    pub event_id: String,
    pub owner_user_id: String,
    pub guest_phone_numbers: Vec<String>,
    pub payment_amount: f64,
    pub stripe_payment_intent_id: String,
    pub contact_name: String,
    pub contact_email: String,
    pub contact_phone: String,
    pub special_requests: Option<String>,
    pub idempotency_key: Option<Uuid>,
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
    pub is_manual: bool,
    pub manual_notes: Option<String>,
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
            is_manual: reservation.is_manual,
            manual_notes: reservation.manual_notes,
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

// ============================================================================
// Payment Intent Creation (for Stripe)
// ============================================================================

#[derive(Debug, Deserialize, Clone, Serialize)]
pub struct CreatePaymentIntentRequest {
    pub table_id: String,
    pub event_id: String,
    pub owner_user_id: String,
    pub guest_phone_numbers: Vec<String>,
    pub idempotency_key: Option<Uuid>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePaymentIntentResponse {
    pub client_secret: String,
    pub payment_intent_id: String,
    pub amount: String, // Formatted as "X.XX €"
    pub total_cost: Option<String>,
    pub per_person_amount: Option<String>,
    pub owner_share: Option<String>,
}

// ============================================================================
// Split Payment Models
// ============================================================================

#[derive(Clone, Debug, Serialize, Deserialize, FromRow)]
pub struct ReservationPaymentShare {
    pub id: Uuid,
    pub reservation_id: Uuid,
    pub user_id: Option<Uuid>,
    pub phone_number: Option<String>,
    pub amount: Decimal,
    pub status: String,
    pub stripe_payment_intent_id: Option<String>,
    pub payment_link_token: Option<String>,
    pub payment_id: Option<Uuid>,
    pub is_owner: bool,
    pub guest_name: Option<String>,
    pub guest_email: Option<String>,
    pub stripe_checkout_session_id: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Clone, Debug, Serialize, Deserialize, FromRow)]
pub struct ReservationGuest {
    pub id: Uuid,
    pub reservation_id: Uuid,
    pub user_id: Option<Uuid>,
    pub phone_number: String,
    pub email: Option<String>,
    pub name: Option<String>,
    pub added_by: Uuid,
    pub ticket_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

// ============================================================================
// Split Payment Request/Response Types
// ============================================================================

#[derive(Debug, Deserialize, Clone, Serialize)]
pub struct CreateSplitPaymentIntentRequest {
    pub table_id: String,
    pub event_id: String,
    pub owner_user_id: String,
    pub num_paying_guests: i32,
    pub paying_guest_phone_numbers: Vec<String>,
    pub contact_name: String,
    pub contact_email: String,
    pub contact_phone: String,
    pub special_requests: Option<String>,
    pub idempotency_key: Option<Uuid>,
}

#[derive(Debug, Deserialize, Clone, Serialize)]
pub struct CreateSplitReservationRequest {
    pub table_id: String,
    pub event_id: String,
    pub owner_user_id: String,
    pub paying_guest_phone_numbers: Vec<String>,
    pub free_guest_phone_numbers: Option<Vec<String>>,
    pub stripe_payment_intent_id: String,
    pub contact_name: String,
    pub contact_email: String,
    pub contact_phone: String,
    pub special_requests: Option<String>,
    pub idempotency_key: Option<Uuid>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PaymentShareResponse {
    pub id: String,
    pub phone_number: Option<String>,
    pub amount: String,
    pub status: String,
    pub payment_link_token: Option<String>,
    pub is_owner: bool,
    pub guest_name: Option<String>,
    pub guest_email: Option<String>,
}

impl From<ReservationPaymentShare> for PaymentShareResponse {
    fn from(share: ReservationPaymentShare) -> Self {
        PaymentShareResponse {
            id: share.id.to_string(),
            phone_number: share.phone_number,
            amount: format!("{:.2} €", share.amount),
            status: share.status,
            payment_link_token: share.payment_link_token,
            is_owner: share.is_owner,
            guest_name: share.guest_name,
            guest_email: share.guest_email,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSplitReservationResponse {
    pub reservation: TableReservationResponse,
    pub payment_shares: Vec<PaymentShareResponse>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PaymentLinkPreviewResponse {
    pub amount: String,
    pub event_name: String,
    pub table_name: String,
    pub status: String,
}

#[derive(Debug, Deserialize)]
pub struct VerifyPaymentLinkRequest {
    pub phone_number: Option<String>,
    pub email: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VerifyPaymentLinkResponse {
    pub token: String,
    pub amount: String,
    pub event_name: String,
    pub table_name: String,
    pub reservation_code: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateCheckoutRequest {
    pub name: Option<String>,
    pub email: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCheckoutResponse {
    pub checkout_url: String,
}

#[derive(Debug, Deserialize)]
pub struct AddFreeGuestRequest {
    pub phone_number: String,
    pub email: Option<String>,
    pub name: Option<String>,
    pub added_by: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FreeGuestResponse {
    pub id: String,
    pub phone_number: String,
    pub email: Option<String>,
    pub name: Option<String>,
    pub ticket_id: Option<String>,
    pub created_at: String,
}

impl From<ReservationGuest> for FreeGuestResponse {
    fn from(guest: ReservationGuest) -> Self {
        FreeGuestResponse {
            id: guest.id.to_string(),
            phone_number: guest.phone_number,
            email: guest.email,
            name: guest.name,
            ticket_id: guest.ticket_id.map(|id| id.to_string()),
            created_at: guest.created_at.to_rfc3339(),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReservationPaymentStatusResponse {
    pub reservation_id: String,
    pub total_cost: String,
    pub amount_paid: String,
    pub amount_remaining: String,
    pub payment_shares: Vec<PaymentShareResponse>,
    pub free_guests: Vec<FreeGuestResponse>,
}