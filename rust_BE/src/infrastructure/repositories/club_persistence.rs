use crate::models::{Club, CreateClubRequest, UpdateClubRequest};
use serde_json::Value as JsonValue;
use sqlx::{PgPool, Result};
use uuid::Uuid;

const CLUB_COLUMNS: &str = "id, name, subtitle, image, address, phone_number, website, owner_id, \
     stripe_connected_account_id, stripe_onboarding_complete, stripe_charges_enabled, \
     stripe_payouts_enabled, platform_commission_percent, platform_commission_fixed_fee, \
     marzipano_config, created_at, updated_at";

/// Get all clubs
pub async fn get_all_clubs(pool: &PgPool) -> Result<Vec<Club>> {
    let query = format!("SELECT {CLUB_COLUMNS} FROM clubs ORDER BY name ASC");
    let clubs = sqlx::query_as::<_, Club>(&query).fetch_all(pool).await?;

    Ok(clubs)
}

/// Get a single club by ID
pub async fn get_club_by_id(pool: &PgPool, club_id: Uuid) -> Result<Option<Club>> {
    let query = format!("SELECT {CLUB_COLUMNS} FROM clubs WHERE id = $1");
    let club = sqlx::query_as::<_, Club>(&query)
        .bind(club_id)
        .fetch_optional(pool)
        .await?;

    Ok(club)
}

/// Get a club by owner ID
pub async fn get_club_by_owner_id(pool: &PgPool, owner_id: Uuid) -> Result<Option<Club>> {
    let query = format!("SELECT {CLUB_COLUMNS} FROM clubs WHERE owner_id = $1");
    let club = sqlx::query_as::<_, Club>(&query)
        .bind(owner_id)
        .fetch_optional(pool)
        .await?;

    Ok(club)
}

/// Create a new club
pub async fn create_club(pool: &PgPool, request: CreateClubRequest) -> Result<Club> {
    let query = format!(
        r#"
        INSERT INTO clubs (
            id, name, subtitle, image, address, phone_number, website, owner_id,
            stripe_connected_account_id, stripe_onboarding_complete, stripe_charges_enabled,
            stripe_payouts_enabled, platform_commission_percent, platform_commission_fixed_fee,
            created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
        RETURNING {CLUB_COLUMNS}
        "#
    );
    let club = sqlx::query_as::<_, Club>(&query)
        .bind(Uuid::new_v4())
        .bind(request.name)
        .bind(request.subtitle)
        .bind(request.image)
        .bind(request.address)
        .bind(request.phone_number)
        .bind(request.website)
        .bind(request.owner_id)
        .bind(request.stripe_connected_account_id)
        .bind(request.stripe_onboarding_complete)
        .bind(request.stripe_charges_enabled)
        .bind(request.stripe_payouts_enabled)
        .bind(request.platform_commission_percent)
        .bind(request.platform_commission_fixed_fee)
        .fetch_one(pool)
        .await?;

    Ok(club)
}

/// Update an existing club
pub async fn update_club(
    pool: &PgPool,
    club_id: Uuid,
    request: UpdateClubRequest,
) -> Result<Option<Club>> {
    let query = format!(
        r#"
        UPDATE clubs
        SET
            name = COALESCE($1, name),
            subtitle = COALESCE($2, subtitle),
            image = COALESCE($3, image),
            address = COALESCE($4, address),
            phone_number = COALESCE($5, phone_number),
            website = COALESCE($6, website),
            owner_id = COALESCE($7, owner_id),
            stripe_connected_account_id = COALESCE($8, stripe_connected_account_id),
            stripe_onboarding_complete = COALESCE($9, stripe_onboarding_complete),
            stripe_charges_enabled = COALESCE($10, stripe_charges_enabled),
            stripe_payouts_enabled = COALESCE($11, stripe_payouts_enabled),
            platform_commission_percent = COALESCE($12, platform_commission_percent),
            platform_commission_fixed_fee = COALESCE($13, platform_commission_fixed_fee),
            updated_at = NOW()
        WHERE id = $14
        RETURNING {CLUB_COLUMNS}
        "#
    );
    let club = sqlx::query_as::<_, Club>(&query)
        .bind(request.name)
        .bind(request.subtitle)
        .bind(request.image)
        .bind(request.address)
        .bind(request.phone_number)
        .bind(request.website)
        .bind(request.owner_id)
        .bind(request.stripe_connected_account_id)
        .bind(request.stripe_onboarding_complete)
        .bind(request.stripe_charges_enabled)
        .bind(request.stripe_payouts_enabled)
        .bind(request.platform_commission_percent)
        .bind(request.platform_commission_fixed_fee)
        .bind(club_id)
        .fetch_optional(pool)
        .await?;

    Ok(club)
}

/// Overwrite the club's `marzipano_config`.
/// Pass `None` to clear it (restore default / unconfigured state).
pub async fn update_marzipano_config(
    pool: &PgPool,
    club_id: Uuid,
    scenes: Option<JsonValue>,
) -> Result<Option<Club>> {
    let query = format!(
        r#"
        UPDATE clubs
        SET marzipano_config = $1,
            updated_at = NOW()
        WHERE id = $2
        RETURNING {CLUB_COLUMNS}
        "#
    );
    let club = sqlx::query_as::<_, Club>(&query)
        .bind(scenes)
        .bind(club_id)
        .fetch_optional(pool)
        .await?;

    Ok(club)
}

/// Delete a club
pub async fn delete_club(pool: &PgPool, club_id: Uuid) -> Result<bool> {
    let result = sqlx::query(
        r#"
        DELETE FROM clubs
        WHERE id = $1
        "#,
    )
    .bind(club_id)
    .execute(pool)
    .await?;

    Ok(result.rows_affected() > 0)
}
