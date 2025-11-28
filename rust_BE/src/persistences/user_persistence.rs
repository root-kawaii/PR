use crate::models::User;
use sqlx::{PgPool, Result};
use uuid::Uuid;

/// Create a new user in the database
pub async fn create_user(
    pool: &PgPool,
    email: String,
    password_hash: String,
    name: String,
    phone_number: Option<String>,
) -> Result<User> {
    let user = sqlx::query_as::<_, User>(
        r#"
        INSERT INTO users (id, email, password_hash, name, phone_number, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        RETURNING id, email, password_hash, name, phone_number, avatar_url, created_at, updated_at
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(email)
    .bind(password_hash)
    .bind(name)
    .bind(phone_number)
    .fetch_one(pool)
    .await?;

    Ok(user)
}

/// Find a user by email
pub async fn find_user_by_email(pool: &PgPool, email: &str) -> Result<Option<User>> {
    let user = sqlx::query_as::<_, User>(
        r#"
        SELECT id, email, password_hash, name, phone_number, avatar_url, created_at, updated_at
        FROM users
        WHERE email = $1
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
        SELECT id, email, password_hash, name, phone_number, avatar_url, created_at, updated_at
        FROM users
        WHERE id = $1
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
        SELECT id, email, password_hash, name, phone_number, avatar_url, created_at, updated_at
        FROM users
        WHERE phone_number = $1
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

/// Get all users (admin function)
pub async fn get_all_users(pool: &PgPool) -> Result<Vec<User>> {
    let users = sqlx::query_as::<_, User>(
        r#"
        SELECT id, email, password_hash, name, phone_number, avatar_url, created_at, updated_at
        FROM users
        ORDER BY created_at DESC
        "#,
    )
    .fetch_all(pool)
    .await?;

    Ok(users)
}

/// Delete a user by ID
pub async fn delete_user(pool: &PgPool, user_id: Uuid) -> Result<()> {
    sqlx::query(
        r#"
        DELETE FROM users
        WHERE id = $1
        "#,
    )
    .bind(user_id)
    .execute(pool)
    .await?;

    Ok(())
}