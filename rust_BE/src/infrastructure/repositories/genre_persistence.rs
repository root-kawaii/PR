use crate::models::{Genre, CreateGenreRequest, UpdateGenreRequest};
use sqlx::{PgPool, Result};
use uuid::Uuid;

/// Get all genres
pub async fn get_all_genres(pool: &PgPool) -> Result<Vec<Genre>> {
    let genres = sqlx::query_as::<_, Genre>(
        r#"
        SELECT id, name, color, created_at, updated_at
        FROM genres
        ORDER BY name ASC
        "#,
    )
    .fetch_all(pool)
    .await?;

    Ok(genres)
}

/// Get a single genre by ID
pub async fn get_genre_by_id(pool: &PgPool, genre_id: Uuid) -> Result<Option<Genre>> {
    let genre = sqlx::query_as::<_, Genre>(
        r#"
        SELECT id, name, color, created_at, updated_at
        FROM genres
        WHERE id = $1
        "#,
    )
    .bind(genre_id)
    .fetch_optional(pool)
    .await?;

    Ok(genre)
}

/// Create a new genre
pub async fn create_genre(
    pool: &PgPool,
    request: CreateGenreRequest,
) -> Result<Genre> {
    let genre = sqlx::query_as::<_, Genre>(
        r#"
        INSERT INTO genres (id, name, color, created_at, updated_at)
        VALUES ($1, $2, $3, NOW(), NOW())
        RETURNING id, name, color, created_at, updated_at
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(request.name)
    .bind(request.color)
    .fetch_one(pool)
    .await?;

    Ok(genre)
}

/// Update an existing genre
pub async fn update_genre(
    pool: &PgPool,
    genre_id: Uuid,
    request: UpdateGenreRequest,
) -> Result<Option<Genre>> {
    // Build dynamic query based on provided fields
    let mut query = "UPDATE genres SET updated_at = NOW()".to_string();
    let mut bindings = Vec::new();
    let mut param_count = 1;

    if let Some(name) = &request.name {
        query.push_str(&format!(", name = ${}", param_count));
        bindings.push(name.clone());
        param_count += 1;
    }

    if let Some(color) = &request.color {
        query.push_str(&format!(", color = ${}", param_count));
        bindings.push(color.clone());
        param_count += 1;
    }

    query.push_str(&format!(" WHERE id = ${} RETURNING id, name, color, created_at, updated_at", param_count));

    let mut q = sqlx::query_as::<_, Genre>(&query);

    for binding in bindings {
        q = q.bind(binding);
    }

    let genre = q.bind(genre_id).fetch_optional(pool).await?;

    Ok(genre)
}

/// Delete a genre
pub async fn delete_genre(pool: &PgPool, genre_id: Uuid) -> Result<bool> {
    let result = sqlx::query(
        r#"
        DELETE FROM genres
        WHERE id = $1
        "#,
    )
    .bind(genre_id)
    .execute(pool)
    .await?;

    Ok(result.rows_affected() > 0)
}