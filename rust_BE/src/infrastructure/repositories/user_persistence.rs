use crate::models::User;
use chrono::NaiveDate;
use sqlx::{PgPool, Result};
use uuid::Uuid;

/// Create a new user in the database
pub async fn create_user(
    pool: &PgPool,
    email: String,
    password_hash: String,
    name: String,
    phone_number: String,
    date_of_birth: NaiveDate,
) -> Result<User> {
    let user = sqlx::query_as::<_, User>(
        r#"
        INSERT INTO users (id, email, password_hash, name, phone_number, date_of_birth, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        RETURNING id, email, password_hash, name, phone_number, phone_verified, avatar_url, date_of_birth, created_at, updated_at
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(email)
    .bind(password_hash)
    .bind(name)
    .bind(phone_number)
    .bind(date_of_birth)
    .fetch_one(pool)
    .await?;

    Ok(user)
}

/// Find a user by email
pub async fn find_user_by_email(pool: &PgPool, email: &str) -> Result<Option<User>> {
    let user = sqlx::query_as::<_, User>(
        r#"
        SELECT id, email, password_hash, name, phone_number, phone_verified, avatar_url, date_of_birth, created_at, updated_at
        FROM users
        WHERE email = $1
          AND deleted_at IS NULL
        "#,
    )
    .bind(email)
    .fetch_optional(pool)
    .await?;

    Ok(user)
}

/// Find a user by ID
pub async fn find_user_by_id(pool: &PgPool, user_id: Uuid) -> Result<Option<User>> {
    let user = sqlx::query_as::<_, User>(
        r#"
        SELECT id, email, password_hash, name, phone_number, phone_verified, avatar_url, date_of_birth, created_at, updated_at
        FROM users
        WHERE id = $1
          AND deleted_at IS NULL
        "#,
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await?;

    Ok(user)
}

/// Find a user by phone number
pub async fn find_user_by_phone(pool: &PgPool, phone_number: &str) -> Result<Option<User>> {
    let user = sqlx::query_as::<_, User>(
        r#"
        SELECT id, email, password_hash, name, phone_number, phone_verified, avatar_url, date_of_birth, created_at, updated_at
        FROM users
        WHERE phone_number = $1
          AND deleted_at IS NULL
        "#,
    )
    .bind(phone_number)
    .fetch_optional(pool)
    .await?;

    Ok(user)
}

/// Update user's last login timestamp (optional feature)
pub async fn update_last_login(pool: &PgPool, user_id: Uuid) -> Result<()> {
    sqlx::query(
        r#"
        UPDATE users
        SET updated_at = NOW()
        WHERE id = $1
        "#,
    )
    .bind(user_id)
    .execute(pool)
    .await?;

    Ok(())
}

/// Update a user's password hash.
pub async fn update_user_password_hash(
    pool: &PgPool,
    user_id: Uuid,
    password_hash: &str,
) -> Result<()> {
    sqlx::query(
        r#"
        UPDATE users
        SET password_hash = $1,
            updated_at = NOW()
        WHERE id = $2
          AND deleted_at IS NULL
        "#,
    )
    .bind(password_hash)
    .bind(user_id)
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn user_is_active(pool: &PgPool, user_id: Uuid) -> Result<bool> {
    let is_active = sqlx::query_scalar::<_, bool>(
        r#"
        SELECT EXISTS(
            SELECT 1
            FROM users
            WHERE id = $1
              AND deleted_at IS NULL
        )
        "#,
    )
    .bind(user_id)
    .fetch_one(pool)
    .await?;

    Ok(is_active)
}

pub async fn anonymize_and_delete_user_account(
    pool: &PgPool,
    user_id: Uuid,
    replacement_email: &str,
    replacement_password_hash: &str,
) -> Result<()> {
    let mut tx = pool.begin().await?;
    let deleted_name = "Account deleted";
    let deleted_phone = format!("deleted-{}", &user_id.to_string()[..8]);

    sqlx::query("DELETE FROM user_sessions WHERE user_id = $1")
        .bind(user_id)
        .execute(&mut *tx)
        .await?;

    sqlx::query("DELETE FROM sms_verifications WHERE user_id = $1")
        .bind(user_id)
        .execute(&mut *tx)
        .await?;

    sqlx::query(
        r#"
        UPDATE table_reservations
        SET contact_name = $1,
            contact_email = $2,
            contact_phone = '',
            special_requests = NULL,
            updated_at = NOW()
        WHERE user_id = $3
        "#,
    )
    .bind(deleted_name)
    .bind(replacement_email)
    .bind(user_id)
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        r#"
        UPDATE reservation_payment_shares
        SET guest_name = $1,
            guest_email = NULL,
            phone_number = NULL,
            updated_at = NOW()
        WHERE user_id = $2
        "#,
    )
    .bind(deleted_name)
    .bind(user_id)
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        r#"
        UPDATE reservation_guests
        SET name = $1,
            email = NULL,
            phone_number = $2
        WHERE user_id = $3
        "#,
    )
    .bind(deleted_name)
    .bind(&deleted_phone)
    .bind(user_id)
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        r#"
        UPDATE users
        SET email = $1,
            password_hash = $2,
            name = $3,
            phone_number = NULL,
            avatar_url = NULL,
            date_of_birth = NULL,
            phone_verified = FALSE,
            expo_push_token = NULL,
            deleted_at = NOW(),
            updated_at = NOW()
        WHERE id = $4
        "#,
    )
    .bind(replacement_email)
    .bind(replacement_password_hash)
    .bind(deleted_name)
    .bind(user_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(())
}
