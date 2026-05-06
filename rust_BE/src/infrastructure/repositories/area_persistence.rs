use crate::models::{Area, EventAreaAvailabilityResponse};
use rust_decimal::Decimal;
use sqlx::PgPool;
use uuid::Uuid;

pub async fn get_areas_by_club(pool: &PgPool, club_id: Uuid) -> Result<Vec<Area>, sqlx::Error> {
    sqlx::query_as::<_, Area>("SELECT * FROM areas WHERE club_id = $1 ORDER BY name ASC")
        .bind(club_id)
        .fetch_all(pool)
        .await
}

pub async fn get_area_by_id(pool: &PgPool, area_id: Uuid) -> Result<Area, sqlx::Error> {
    sqlx::query_as::<_, Area>("SELECT * FROM areas WHERE id = $1")
        .bind(area_id)
        .fetch_one(pool)
        .await
}

pub async fn get_event_area_availability(
    pool: &PgPool,
    event_id: Uuid,
) -> Result<Vec<EventAreaAvailabilityResponse>, sqlx::Error> {
    sqlx::query_as::<_, EventAreaAvailabilityResponse>(
        r#"
        SELECT
            a.id::text AS id,
            a.club_id::text AS club_id,
            a.name,
            format('%.2f €', a.price) AS min_spend_per_person,
            a.description,
            COUNT(t.id) FILTER (WHERE t.available = true)::bigint AS available_table_count,
            COUNT(t.id)::bigint AS total_table_count,
            COALESCE(SUM(CASE WHEN t.available = true THEN t.capacity ELSE 0 END), 0)::bigint AS available_people,
            COALESCE(SUM(t.capacity), 0)::bigint AS total_people_capacity
        FROM events e
        JOIN areas a ON a.club_id = e.club_id
        LEFT JOIN tables t
          ON t.area_id = a.id
         AND (t.event_id = e.id OR t.event_id IS NULL)
        WHERE e.id = $1
        GROUP BY a.id, a.club_id, a.name, a.price, a.description
        ORDER BY a.name ASC
        "#,
    )
    .bind(event_id)
    .fetch_all(pool)
    .await
}

pub async fn create_area(
    pool: &PgPool,
    club_id: Uuid,
    name: String,
    price: Decimal,
    description: Option<String>,
) -> Result<Area, sqlx::Error> {
    sqlx::query_as::<_, Area>(
        r#"
        INSERT INTO areas (club_id, name, price, description)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        "#,
    )
    .bind(club_id)
    .bind(name)
    .bind(price)
    .bind(description)
    .fetch_one(pool)
    .await
}

pub async fn get_default_area_by_club(
    pool: &PgPool,
    club_id: Uuid,
) -> Result<Option<Area>, sqlx::Error> {
    sqlx::query_as::<_, Area>(
        r#"
        SELECT *
        FROM areas
        WHERE club_id = $1
          AND UPPER(TRIM(name)) = 'A'
        ORDER BY created_at ASC
        LIMIT 1
        "#,
    )
    .bind(club_id)
    .fetch_optional(pool)
    .await
}

pub async fn get_or_create_default_area(
    pool: &PgPool,
    club_id: Uuid,
    default_price: Decimal,
) -> Result<Area, sqlx::Error> {
    if let Some(area) = get_default_area_by_club(pool, club_id).await? {
        return Ok(area);
    }

    create_area(
        pool,
        club_id,
        "A".to_string(),
        default_price,
        Some("Default area created automatically".to_string()),
    )
    .await
}

pub async fn update_area(
    pool: &PgPool,
    area_id: Uuid,
    name: Option<String>,
    price: Option<Decimal>,
    description: Option<String>,
) -> Result<Area, sqlx::Error> {
    sqlx::query_as::<_, Area>(
        r#"
        UPDATE areas
        SET name        = COALESCE($1, name),
            price       = COALESCE($2, price),
            description = COALESCE($3, description),
            updated_at  = NOW()
        WHERE id = $4
        RETURNING *
        "#,
    )
    .bind(name)
    .bind(price)
    .bind(description)
    .bind(area_id)
    .fetch_one(pool)
    .await
}

pub async fn delete_area(pool: &PgPool, area_id: Uuid) -> Result<bool, sqlx::Error> {
    let result = sqlx::query("DELETE FROM areas WHERE id = $1")
        .bind(area_id)
        .execute(pool)
        .await?;
    Ok(result.rows_affected() > 0)
}

pub async fn count_tables_by_area(pool: &PgPool, area_id: Uuid) -> Result<i64, sqlx::Error> {
    sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COUNT(*)
        FROM tables
        WHERE area_id = $1
        "#,
    )
    .bind(area_id)
    .fetch_one(pool)
    .await
}

/// Assign an area to a table.
/// Updates the table's area_id, min_spend (from area price), and recalculates total_cost.
pub async fn assign_area_to_table(
    pool: &PgPool,
    table_id: Uuid,
    area_id: Uuid,
) -> Result<crate::models::table::Table, sqlx::Error> {
    let updated_table_id = sqlx::query_scalar::<_, Uuid>(
        r#"
        UPDATE tables t
        SET area_id    = a.id,
            min_spend  = a.price,
            total_cost = a.price * t.capacity,
            updated_at = NOW()
        FROM areas a
        WHERE a.id = $1
          AND t.id   = $2
        RETURNING t.id
        "#,
    )
    .bind(area_id)
    .bind(table_id)
    .fetch_one(pool)
    .await?;

    crate::infrastructure::repositories::table_repository::get_table_by_id(pool, updated_table_id)
        .await
}

/// Assign the default "A" area to a table without changing its current pricing.
pub async fn assign_default_area_to_table(
    pool: &PgPool,
    table_id: Uuid,
    area_id: Uuid,
) -> Result<crate::models::table::Table, sqlx::Error> {
    let updated_table_id = sqlx::query_scalar::<_, Uuid>(
        r#"
        UPDATE tables
        SET area_id    = $1,
            updated_at = NOW()
        WHERE id = $2
        RETURNING id
        "#,
    )
    .bind(area_id)
    .bind(table_id)
    .fetch_one(pool)
    .await?;

    crate::infrastructure::repositories::table_repository::get_table_by_id(pool, updated_table_id)
        .await
}
