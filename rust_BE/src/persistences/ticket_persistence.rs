use crate::models::{Ticket, CreateTicketRequest, UpdateTicketRequest};
use sqlx::{PgPool, Result};
use uuid::Uuid;

/// Get all tickets (admin view - returns all tickets)
pub async fn get_all_tickets(pool: &PgPool) -> Result<Vec<Ticket>> {
    let tickets = sqlx::query_as::<_, Ticket>(
        r#"
        SELECT id, event_id, user_id, ticket_code, ticket_type, price, status, purchase_date, qr_code, created_at, updated_at
        FROM tickets
        ORDER BY purchase_date DESC
        "#,
    )
    .fetch_all(pool)
    .await?;

    Ok(tickets)
}

/// Get tickets for a specific user
pub async fn get_tickets_by_user_id(pool: &PgPool, user_id: Uuid) -> Result<Vec<Ticket>> {
    let tickets = sqlx::query_as::<_, Ticket>(
        r#"
        SELECT id, event_id, user_id, ticket_code, ticket_type, price, status, purchase_date, qr_code, created_at, updated_at
        FROM tickets
        WHERE user_id = $1
        ORDER BY purchase_date DESC
        "#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    Ok(tickets)
}

/// Get a single ticket by ID
pub async fn get_ticket_by_id(pool: &PgPool, ticket_id: Uuid) -> Result<Option<Ticket>> {
    let ticket = sqlx::query_as::<_, Ticket>(
        r#"
        SELECT id, event_id, user_id, ticket_code, ticket_type, price, status, purchase_date, qr_code, created_at, updated_at
        FROM tickets
        WHERE id = $1
        "#,
    )
    .bind(ticket_id)
    .fetch_optional(pool)
    .await?;

    Ok(ticket)
}

/// Get a ticket by ticket code
pub async fn get_ticket_by_code(pool: &PgPool, ticket_code: &str) -> Result<Option<Ticket>> {
    let ticket = sqlx::query_as::<_, Ticket>(
        r#"
        SELECT id, event_id, user_id, ticket_code, ticket_type, price, status, purchase_date, qr_code, created_at, updated_at
        FROM tickets
        WHERE ticket_code = $1
        "#,
    )
    .bind(ticket_code)
    .fetch_optional(pool)
    .await?;

    Ok(ticket)
}

/// Get tickets with event details joined (for user ticket list)
pub async fn get_tickets_with_events_by_user_id(
    pool: &PgPool,
    user_id: Uuid,
) -> Result<Vec<(Uuid, Uuid, Uuid, String, String, rust_decimal::Decimal, String, chrono::DateTime<chrono::Utc>, Option<String>, chrono::DateTime<chrono::Utc>, chrono::DateTime<chrono::Utc>, String, String, String, String, Option<String>)>> {
    let results = sqlx::query_as::<_, (Uuid, Uuid, Uuid, String, String, rust_decimal::Decimal, String, chrono::DateTime<chrono::Utc>, Option<String>, chrono::DateTime<chrono::Utc>, chrono::DateTime<chrono::Utc>, String, String, String, String, Option<String>)>(
        r#"
        SELECT
            t.id, t.event_id, t.user_id, t.ticket_code, t.ticket_type, t.price, t.status, t.purchase_date, t.qr_code, t.created_at, t.updated_at,
            e.title, e.venue, e.date, e.image, e.status as event_status
        FROM tickets t
        INNER JOIN events e ON t.event_id = e.id
        WHERE t.user_id = $1
        ORDER BY t.purchase_date DESC
        "#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    Ok(results)
}

/// Generate a unique ticket code
fn generate_ticket_code() -> String {
    use rand::Rng;
    let mut rng = rand::thread_rng();
    let random_part: String = (0..8)
        .map(|_| {
            let idx = rng.gen_range(0..36);
            if idx < 26 {
                (b'A' + idx) as char
            } else {
                (b'0' + (idx - 26)) as char
            }
        })
        .collect();
    format!("TKT-{}", random_part)
}

/// Create a new ticket
pub async fn create_ticket(
    pool: &PgPool,
    request: CreateTicketRequest,
) -> Result<Ticket> {
    // Generate unique ticket code
    let mut ticket_code = generate_ticket_code();

    // Ensure uniqueness (in case of collision)
    while get_ticket_by_code(pool, &ticket_code).await?.is_some() {
        ticket_code = generate_ticket_code();
    }

    let ticket = sqlx::query_as::<_, Ticket>(
        r#"
        INSERT INTO tickets (id, event_id, user_id, ticket_code, ticket_type, price, status, purchase_date, qr_code, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, NOW(), NOW())
        RETURNING id, event_id, user_id, ticket_code, ticket_type, price, status, purchase_date, qr_code, created_at, updated_at
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(request.event_id)
    .bind(request.user_id)
    .bind(ticket_code)
    .bind(request.ticket_type)
    .bind(request.price)
    .bind(request.status.unwrap_or_else(|| "active".to_string()))
    .bind(request.qr_code)
    .fetch_one(pool)
    .await?;

    Ok(ticket)
}

/// Update a ticket
pub async fn update_ticket(
    pool: &PgPool,
    ticket_id: Uuid,
    request: UpdateTicketRequest,
) -> Result<Option<Ticket>> {
    let ticket = sqlx::query_as::<_, Ticket>(
        r#"
        UPDATE tickets
        SET
            ticket_type = COALESCE($1, ticket_type),
            price = COALESCE($2, price),
            status = COALESCE($3, status),
            qr_code = COALESCE($4, qr_code),
            updated_at = NOW()
        WHERE id = $5
        RETURNING id, event_id, user_id, ticket_code, ticket_type, price, status, purchase_date, qr_code, created_at, updated_at
        "#,
    )
    .bind(request.ticket_type)
    .bind(request.price)
    .bind(request.status)
    .bind(request.qr_code)
    .bind(ticket_id)
    .fetch_optional(pool)
    .await?;

    Ok(ticket)
}

/// Delete a ticket
pub async fn delete_ticket(pool: &PgPool, ticket_id: Uuid) -> Result<bool> {
    let result = sqlx::query(
        r#"
        DELETE FROM tickets
        WHERE id = $1
        "#,
    )
    .bind(ticket_id)
    .execute(pool)
    .await?;

    Ok(result.rows_affected() > 0)
}