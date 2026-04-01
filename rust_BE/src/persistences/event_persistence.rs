use crate::models::{CreateEventRequest, Event, UpdateEventRequest};
use sqlx::{PgPool, Result};
use uuid::Uuid;

/// Get all events
pub async fn get_all_events(pool: &PgPool) -> Result<Vec<Event>> {
    let events = sqlx::query_as::<_, Event>(
        r#"
        SELECT id, title, venue, date, image, status, time, age_limit, end_time, price, description, club_id,
               matterport_id, tour_provider, tour_id, marzipano_config, event_date, created_at, updated_at
        FROM events
        ORDER BY created_at DESC
        "#,
    )
    .fetch_all(pool)
    .await?;

    Ok(events)
}

/// Get a single event by ID
pub async fn get_event_by_id(pool: &PgPool, event_id: Uuid) -> Result<Option<Event>> {
    let event = sqlx::query_as::<_, Event>(
        r#"
        SELECT id, title, venue, date, image, status, time, age_limit, end_time, price, description, club_id,
               matterport_id, tour_provider, tour_id, marzipano_config, event_date, created_at, updated_at
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
                           matterport_id, tour_provider, tour_id, marzipano_config, event_date, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), NOW())
        RETURNING id, title, venue, date, image, status, time, age_limit, end_time, price, description, club_id,
                  matterport_id, tour_provider, tour_id, marzipano_config, event_date, created_at, updated_at
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
    .bind(request.tour_id)
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
            matterport_id = COALESCE($12, matterport_id),
            tour_provider = COALESCE($13, tour_provider),
            tour_id = COALESCE($14, tour_id),
            marzipano_config = COALESCE($15, marzipano_config),
            event_date = COALESCE($16, event_date),
            updated_at = NOW()
        WHERE id = $17
        RETURNING id, title, venue, date, image, status, time, age_limit, end_time, price, description, club_id,
                  matterport_id, tour_provider, tour_id, marzipano_config, event_date, created_at, updated_at
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
    .bind(request.tour_id)
    .bind(request.marzipano_config)
    .bind(request.event_date)
    .bind(event_id)
    .fetch_optional(pool)
    .await?;

    Ok(event)
}

/// Get events by club ID
pub async fn get_events_by_club_id(pool: &PgPool, club_id: Uuid) -> Result<Vec<Event>> {
    let events = sqlx::query_as::<_, Event>(
        r#"
        SELECT id, title, venue, date, image, status, time, age_limit, end_time, price, description, club_id,
               matterport_id, tour_provider, tour_id, marzipano_config, event_date, created_at, updated_at
        FROM events
        WHERE club_id = $1
        ORDER BY created_at DESC
        "#,
    )
    .bind(club_id)
    .fetch_all(pool)
    .await?;

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
