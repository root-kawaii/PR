use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
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
    pub stripe_connected_account_id: Option<String>,
    pub stripe_onboarding_complete: Option<bool>,
    pub stripe_charges_enabled: Option<bool>,
    pub stripe_payouts_enabled: Option<bool>,
    pub platform_commission_percent: Option<Decimal>,
    pub platform_commission_fixed_fee: Option<Decimal>,
    pub marzipano_config: Option<JsonValue>,
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
    pub stripe_connected_account_id: Option<String>,
    pub stripe_onboarding_complete: Option<bool>,
    pub stripe_charges_enabled: Option<bool>,
    pub stripe_payouts_enabled: Option<bool>,
    pub platform_commission_percent: Option<Decimal>,
    pub platform_commission_fixed_fee: Option<Decimal>,
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
    pub stripe_connected_account_id: Option<String>,
    pub stripe_onboarding_complete: Option<bool>,
    pub stripe_charges_enabled: Option<bool>,
    pub stripe_payouts_enabled: Option<bool>,
    pub platform_commission_percent: Option<Decimal>,
    pub platform_commission_fixed_fee: Option<Decimal>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ClubResponse {
    pub id: String,
    pub name: String,
    pub subtitle: String,
    pub image: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub owner_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stripe_connected_account_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stripe_onboarding_complete: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stripe_charges_enabled: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stripe_payouts_enabled: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub platform_commission_percent: Option<Decimal>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub platform_commission_fixed_fee: Option<Decimal>,
    #[serde(rename = "marzipanoScenes")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub marzipano_scenes: Option<JsonValue>,
}

impl From<Club> for ClubResponse {
    fn from(club: Club) -> Self {
        ClubResponse {
            id: club.id.to_string(),
            name: club.name,
            subtitle: club.subtitle.unwrap_or_default(),
            image: club.image,
            owner_id: club.owner_id.map(|id| id.to_string()),
            stripe_connected_account_id: club.stripe_connected_account_id,
            stripe_onboarding_complete: club.stripe_onboarding_complete,
            stripe_charges_enabled: club.stripe_charges_enabled,
            stripe_payouts_enabled: club.stripe_payouts_enabled,
            platform_commission_percent: club.platform_commission_percent,
            platform_commission_fixed_fee: club.platform_commission_fixed_fee,
            marzipano_scenes: club.marzipano_config,
        }
    }
}
