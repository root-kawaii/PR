use crate::models::Area;
use rust_decimal::Decimal;
use serde_json::Value as JsonValue;
use sqlx::PgPool;
use uuid::Uuid;

pub async fn get_areas_by_club(pool: &PgPool, club_id: Uuid) -> Result<Vec<Area>, sqlx::Error> {
    sqlx::query_as::<_, Area>(
        "SELECT * FROM areas WHERE club_id = $1 ORDER BY name ASC",
    )
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

pub async fn create_area(
    pool: &PgPool,
    club_id: Uuid,
    name: String,
    price: Decimal,
    description: Option<String>,
    marzipano_position: Option<JsonValue>,
) -> Result<Area, sqlx::Error> {
    sqlx::query_as::<_, Area>(
        r#"
        INSERT INTO areas (club_id, name, price, description, marzipano_position)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        "#,
    )
    .bind(club_id)
    .bind(name)
    .bind(price)
    .bind(description)
    .bind(marzipano_position)
    .fetch_one(pool)
    .await
}

pub async fn update_area(
    pool: &PgPool,
    area_id: Uuid,
    name: Option<String>,
    price: Option<Decimal>,
    description: Option<String>,
    marzipano_position: Option<JsonValue>,
) -> Result<Area, sqlx::Error> {
    sqlx::query_as::<_, Area>(
        r#"
        UPDATE areas
        SET name               = COALESCE($1, name),
            price              = COALESCE($2, price),
            description        = COALESCE($3, description),
            marzipano_position = COALESCE($4, marzipano_position),
            updated_at         = NOW()
        WHERE id = $5
        RETURNING *
        "#,
    )
    .bind(name)
    .bind(price)
    .bind(description)
    .bind(marzipano_position)
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

/// Assign an area to a table.
/// Updates the table's area_id, min_spend (from area price), and recalculates total_cost.
pub async fn assign_area_to_table(
    pool: &PgPool,
    table_id: Uuid,
    area_id: Uuid,
) -> Result<crate::models::table::Table, sqlx::Error> {
    sqlx::query_as::<_, crate::models::table::Table>(
        r#"
        UPDATE tables t
        SET area_id    = a.id,
            min_spend  = a.price,
            total_cost = a.price * t.capacity,
            updated_at = NOW()
        FROM areas a
        WHERE a.id = $1
          AND t.id   = $2
        RETURNING t.*
        "#,
    )
    .bind(area_id)
    .bind(table_id)
    .fetch_one(pool)
    .await
}

/// Unlink a table from its area (keeps current pricing).
pub async fn unassign_area_from_table(
    pool: &PgPool,
    table_id: Uuid,
) -> Result<crate::models::table::Table, sqlx::Error> {
    sqlx::query_as::<_, crate::models::table::Table>(
        r#"
        UPDATE tables
        SET area_id    = NULL,
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
        "#,
    )
    .bind(table_id)
    .fetch_one(pool)
    .await
}
