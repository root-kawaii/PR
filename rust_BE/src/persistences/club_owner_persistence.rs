use crate::models::club_owner::ClubOwner;
use sqlx::{PgPool, Result};
use uuid::Uuid;

/// Create a new club owner
pub async fn create_club_owner(
    pool: &PgPool,
    email: String,
    password_hash: String,
    name: String,
    phone_number: Option<String>,
) -> Result<ClubOwner> {
    let owner = sqlx::query_as::<_, ClubOwner>(
        r#"
        INSERT INTO club_owners (id, email, password_hash, name, phone_number, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        RETURNING id, email, password_hash, name, phone_number, created_at, updated_at
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(email)
    .bind(password_hash)
    .bind(name)
    .bind(phone_number)
    .fetch_one(pool)
    .await?;

    Ok(owner)
}

/// Find a club owner by email
pub async fn find_club_owner_by_email(pool: &PgPool, email: &str) -> Result<Option<ClubOwner>> {
    let owner = sqlx::query_as::<_, ClubOwner>(
        r#"
        SELECT id, email, password_hash, name, phone_number, created_at, updated_at
        FROM club_owners
        WHERE email = $1
        "#,
    )
    .bind(email)
    .fetch_optional(pool)
    .await?;

    Ok(owner)
}

/// Find a club owner by ID
pub async fn find_club_owner_by_id(pool: &PgPool, owner_id: Uuid) -> Result<Option<ClubOwner>> {
    let owner = sqlx::query_as::<_, ClubOwner>(
        r#"
        SELECT id, email, password_hash, name, phone_number, created_at, updated_at
        FROM club_owners
        WHERE id = $1
        "#,
    )
    .bind(owner_id)
    .fetch_optional(pool)
    .await?;

    Ok(owner)
}
