use super::club::ClubResponse;
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

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

// ── Club update ──────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct OwnerUpdateClubRequest {
    pub name: Option<String>,
    pub subtitle: Option<String>,
    pub address: Option<String>,
    pub phone_number: Option<String>,
    pub website: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StripeConnectStatusResponse {
    pub connected_account_id: Option<String>,
    pub onboarding_complete: bool,
    pub charges_enabled: bool,
    pub payouts_enabled: bool,
    pub details_submitted: bool,
    pub platform_commission_percent: Option<Decimal>,
    pub platform_commission_fixed_fee: Option<Decimal>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StripeOnboardingLinkResponse {
    pub connected_account_id: String,
    pub onboarding_url: String,
    pub onboarding_complete: bool,
    pub charges_enabled: bool,
    pub payouts_enabled: bool,
}

// ── Club / Table images ──────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct ClubImageRow {
    pub id: Uuid,
    pub club_id: Uuid,
    pub url: String,
    pub display_order: i32,
    pub alt_text: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct AddImageRequest {
    pub url: String,
    pub display_order: Option<i32>,
    pub alt_text: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct TableImageRow {
    pub id: Uuid,
    pub table_id: Uuid,
    pub url: String,
    pub display_order: i32,
    pub alt_text: Option<String>,
    pub created_at: DateTime<Utc>,
}

// ── Manual reservation ───────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CreateManualReservationRequest {
    pub table_id: String,
    pub contact_name: String,
    pub contact_phone: String,
    pub contact_email: Option<String>,
    pub num_people: i32,
    pub manual_notes: Option<String>,
}

// ── Reservation status update ────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct UpdateReservationStatusRequest {
    pub status: String,
}

// ── QR scan result ───────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanResult {
    pub valid: bool,
    pub already_used: bool,
    pub scan_type: String, // "ticket" | "reservation"
    pub guest_name: Option<String>,
    pub num_people: Option<i32>,
    pub event_title: Option<String>,
    pub table_name: Option<String>,
    pub code: String,
}

// ── Owner stats ──────────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EventStatRow {
    pub event_id: String,
    pub title: String,
    pub date: String,
    pub reserved_tables: i64,
    pub total_tables: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OwnerStats {
    pub active_reservations: i64,
    pub total_revenue: Decimal,
    pub events: Vec<EventStatRow>,
}
