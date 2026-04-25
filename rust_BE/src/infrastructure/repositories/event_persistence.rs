use crate::models::{CreateEventRequest, Event, GenreResponse, UpdateEventRequest};
use chrono::NaiveDate;
use sqlx::{PgPool, QueryBuilder, Result};
use std::collections::HashMap;
use uuid::Uuid;

// ---------------------------------------------------------------------------
// Genre helpers
// ---------------------------------------------------------------------------

/// Row type for the batch-genres query
#[derive(sqlx::FromRow)]
struct EventGenreRow {
    event_id: Uuid,
    genre_id: Uuid,
    name: String,
    color: String,
}

/// Fetch all genres associated with a single event.
pub async fn get_event_genres(pool: &PgPool, event_id: Uuid) -> Result<Vec<GenreResponse>> {
    let rows = sqlx::query_as::<_, EventGenreRow>(
        r#"
        SELECT eg.event_id, g.id AS genre_id, g.name, g.color
        FROM genres g
        JOIN event_genres eg ON eg.genre_id = g.id
        WHERE eg.event_id = $1
        ORDER BY g.name
        "#,
    )
    .bind(event_id)
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|r| GenreResponse {
            id: r.genre_id.to_string(),
            name: r.name,
            color: r.color,
        })
        .collect())
}

/// Fetch genres for multiple events in one query, grouped by event_id.
pub async fn get_genres_for_events(
    pool: &PgPool,
    event_ids: &[Uuid],
) -> Result<HashMap<Uuid, Vec<GenreResponse>>> {
    if event_ids.is_empty() {
        return Ok(HashMap::new());
    }

    let rows = sqlx::query_as::<_, EventGenreRow>(
        r#"
        SELECT eg.event_id, g.id AS genre_id, g.name, g.color
        FROM genres g
        JOIN event_genres eg ON eg.genre_id = g.id
        WHERE eg.event_id = ANY($1)
        ORDER BY g.name
        "#,
    )
    .bind(event_ids)
    .fetch_all(pool)
    .await?;

    let mut map: HashMap<Uuid, Vec<GenreResponse>> = HashMap::new();
    for r in rows {
        map.entry(r.event_id).or_default().push(GenreResponse {
            id: r.genre_id.to_string(),
            name: r.name,
            color: r.color,
        });
    }
    Ok(map)
}

/// Replace the genre assignments for an event (delete-then-insert in the caller's transaction
/// or as two separate statements — safe because ON DELETE CASCADE handles orphans).
pub async fn set_event_genres(pool: &PgPool, event_id: Uuid, genre_ids: &[Uuid]) -> Result<()> {
    sqlx::query("DELETE FROM event_genres WHERE event_id = $1")
        .bind(event_id)
        .execute(pool)
        .await?;

    if !genre_ids.is_empty() {
        let mut qb: QueryBuilder<sqlx::Postgres> =
            QueryBuilder::new("INSERT INTO event_genres (event_id, genre_id) ");
        qb.push_values(genre_ids.iter(), |mut b, gid| {
            b.push_bind(event_id).push_bind(gid);
        });
        qb.push(" ON CONFLICT DO NOTHING");
        qb.build().execute(pool).await?;
    }

    Ok(())
}

/// Get all events with pagination (limit/offset)
pub async fn get_all_events(pool: &PgPool, limit: i64, offset: i64) -> Result<Vec<Event>> {
    let events = sqlx::query_as::<_, Event>(
        r#"
        SELECT id, title, venue, date, image, status, time, age_limit, end_time, price, description, club_id,
               tour_provider, marzipano_config, event_date, created_at, updated_at
        FROM events
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2
        "#,
    )
    .bind(limit)
    .bind(offset)
    .fetch_all(pool)
    .await?;

    Ok(events)
}

/// Get a single event by ID
pub async fn get_event_by_id(pool: &PgPool, event_id: Uuid) -> Result<Option<Event>> {
    let event = sqlx::query_as::<_, Event>(
        r#"
        SELECT id, title, venue, date, image, status, time, age_limit, end_time, price, description, club_id,
               tour_provider, marzipano_config, event_date, created_at, updated_at
        FROM events
        WHERE id = $1
        "#,
    )
    .bind(event_id)
    .fetch_optional(pool)
    .await?;

    Ok(event)
}

/// Create a new event
pub async fn create_event(pool: &PgPool, request: CreateEventRequest) -> Result<Event> {
    let event = sqlx::query_as::<_, Event>(
        r#"
        INSERT INTO events (id, title, venue, date, image, status, time, age_limit, end_time, price, description, club_id,
                           tour_provider, marzipano_config, event_date, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())
        RETURNING id, title, venue, date, image, status, time, age_limit, end_time, price, description, club_id,
                  tour_provider, marzipano_config, event_date, created_at, updated_at
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(request.title)
    .bind(request.venue)
    .bind(request.date)
    .bind(request.image)
    .bind(request.status)
    .bind(request.time)
    .bind(request.age_limit)
    .bind(request.end_time)
    .bind(request.price)
    .bind(request.description)
    .bind(request.club_id)
    .bind(request.tour_provider)
    .bind(request.marzipano_config)
    .bind(request.event_date)
    .fetch_one(pool)
    .await?;

    Ok(event)
}

/// Update an existing event
pub async fn update_event(
    pool: &PgPool,
    event_id: Uuid,
    request: UpdateEventRequest,
) -> Result<Option<Event>> {
    let event = sqlx::query_as::<_, Event>(
        r#"
        UPDATE events
        SET
            title = COALESCE($1, title),
            venue = COALESCE($2, venue),
            date = COALESCE($3, date),
            image = COALESCE($4, image),
            status = COALESCE($5, status),
            time = COALESCE($6, time),
            age_limit = COALESCE($7, age_limit),
            end_time = COALESCE($8, end_time),
            price = COALESCE($9, price),
            description = COALESCE($10, description),
            club_id = COALESCE($11, club_id),
            tour_provider = COALESCE($12, tour_provider),
            marzipano_config = COALESCE($13, marzipano_config),
            event_date = COALESCE($14, event_date),
            updated_at = NOW()
        WHERE id = $15
        RETURNING id, title, venue, date, image, status, time, age_limit, end_time, price, description, club_id,
                  tour_provider, marzipano_config, event_date, created_at, updated_at
        "#,
    )
    .bind(request.title)
    .bind(request.venue)
    .bind(request.date)
    .bind(request.image)
    .bind(request.status)
    .bind(request.time)
    .bind(request.age_limit)
    .bind(request.end_time)
    .bind(request.price)
    .bind(request.description)
    .bind(request.club_id)
    .bind(request.tour_provider)
    .bind(request.marzipano_config)
    .bind(request.event_date)
    .bind(event_id)
    .fetch_optional(pool)
    .await?;

    Ok(event)
}

/// Get events by club ID, optionally filtered to events on or after `from_date`.
pub async fn get_events_by_club_id(
    pool: &PgPool,
    club_id: Uuid,
    from_date: Option<NaiveDate>,
) -> Result<Vec<Event>> {
    let events = if let Some(date) = from_date {
        sqlx::query_as::<_, Event>(
            r#"
            SELECT id, title, venue, date, image, status, time, age_limit, end_time, price, description, club_id,
                   tour_provider, marzipano_config, event_date, created_at, updated_at
            FROM events
            WHERE club_id = $1
              AND (event_date IS NULL OR event_date >= $2)
            ORDER BY event_date ASC NULLS LAST, created_at DESC
            "#,
        )
        .bind(club_id)
        .bind(date)
        .fetch_all(pool)
        .await?
    } else {
        sqlx::query_as::<_, Event>(
            r#"
            SELECT id, title, venue, date, image, status, time, age_limit, end_time, price, description, club_id,
                   tour_provider, marzipano_config, event_date, created_at, updated_at
            FROM events
            WHERE club_id = $1
            ORDER BY event_date ASC NULLS LAST, created_at DESC
            "#,
        )
        .bind(club_id)
        .fetch_all(pool)
        .await?
    };

    Ok(events)
}

/// Delete an event
pub async fn delete_event(pool: &PgPool, event_id: Uuid) -> Result<bool> {
    let result = sqlx::query(
        r#"
        DELETE FROM events
        WHERE id = $1
        "#,
    )
    .bind(event_id)
    .execute(pool)
    .await?;

    Ok(result.rows_affected() > 0)
}
