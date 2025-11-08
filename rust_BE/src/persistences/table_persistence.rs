use crate::models::{Table, TableReservation, TableReservationPayment, TableReservationTicket};
use sqlx::PgPool;
use uuid::Uuid;
use rust_decimal::Decimal;
use chrono::Utc;

// ============================================================================
// Tables CRUD
// ============================================================================

/// Get all tables
pub async fn get_all_tables(pool: &PgPool) -> Result<Vec<Table>, sqlx::Error> {
    let tables = sqlx::query_as::<_, Table>(
        r#"
        SELECT * FROM tables
        ORDER BY created_at DESC
        "#,
    )
    .fetch_all(pool)
    .await?;

    Ok(tables)
}

/// Get all tables for a specific event
pub async fn get_tables_by_event_id(pool: &PgPool, event_id: Uuid) -> Result<Vec<Table>, sqlx::Error> {
    let tables = sqlx::query_as::<_, Table>(
        r#"
        SELECT * FROM tables
        WHERE event_id = $1
        ORDER BY name ASC
        "#,
    )
    .bind(event_id)
    .fetch_all(pool)
    .await?;

    Ok(tables)
}

/// Get available tables for an event
pub async fn get_available_tables_by_event_id(pool: &PgPool, event_id: Uuid) -> Result<Vec<Table>, sqlx::Error> {
    let tables = sqlx::query_as::<_, Table>(
        r#"
        SELECT * FROM tables
        WHERE event_id = $1 AND available = true
        ORDER BY name ASC
        "#,
    )
    .bind(event_id)
    .fetch_all(pool)
    .await?;

    Ok(tables)
}

/// Get a single table by ID
pub async fn get_table_by_id(pool: &PgPool, table_id: Uuid) -> Result<Table, sqlx::Error> {
    let table = sqlx::query_as::<_, Table>(
        r#"
        SELECT * FROM tables
        WHERE id = $1
        "#,
    )
    .bind(table_id)
    .fetch_one(pool)
    .await?;

    Ok(table)
}

/// Create a new table
pub async fn create_table(
    pool: &PgPool,
    event_id: Uuid,
    name: String,
    zone: Option<String>,
    capacity: i32,
    min_spend: Decimal,
    location_description: Option<String>,
    features: Option<Vec<String>>,
) -> Result<Table, sqlx::Error> {
    let total_cost = min_spend * Decimal::from(capacity);

    let table = sqlx::query_as::<_, Table>(
        r#"
        INSERT INTO tables (event_id, name, zone, capacity, min_spend, total_cost, location_description, features)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
        "#,
    )
    .bind(event_id)
    .bind(name)
    .bind(zone)
    .bind(capacity)
    .bind(min_spend)
    .bind(total_cost)
    .bind(location_description)
    .bind(features)
    .fetch_one(pool)
    .await?;

    Ok(table)
}

/// Update a table
pub async fn update_table(
    pool: &PgPool,
    table_id: Uuid,
    name: Option<String>,
    zone: Option<String>,
    capacity: Option<i32>,
    min_spend: Option<Decimal>,
    available: Option<bool>,
    location_description: Option<String>,
    features: Option<Vec<String>>,
) -> Result<Table, sqlx::Error> {
    // Get the current table to calculate new total_cost if needed
    let current_table = get_table_by_id(pool, table_id).await?;

    let final_capacity = capacity.unwrap_or(current_table.capacity);
    let final_min_spend = min_spend.unwrap_or(current_table.min_spend);
    let total_cost = final_min_spend * Decimal::from(final_capacity);

    let table = sqlx::query_as::<_, Table>(
        r#"
        UPDATE tables
        SET name = COALESCE($1, name),
            zone = COALESCE($2, zone),
            capacity = COALESCE($3, capacity),
            min_spend = COALESCE($4, min_spend),
            total_cost = $5,
            available = COALESCE($6, available),
            location_description = COALESCE($7, location_description),
            features = COALESCE($8, features),
            updated_at = NOW()
        WHERE id = $9
        RETURNING *
        "#,
    )
    .bind(name)
    .bind(zone)
    .bind(capacity)
    .bind(min_spend)
    .bind(total_cost)
    .bind(available)
    .bind(location_description)
    .bind(features)
    .bind(table_id)
    .fetch_one(pool)
    .await?;

    Ok(table)
}

/// Delete a table
pub async fn delete_table(pool: &PgPool, table_id: Uuid) -> Result<bool, sqlx::Error> {
    let result = sqlx::query(
        r#"
        DELETE FROM tables
        WHERE id = $1
        "#,
    )
    .bind(table_id)
    .execute(pool)
    .await?;

    Ok(result.rows_affected() > 0)
}

// ============================================================================
// Table Reservations CRUD
// ============================================================================

/// Generate unique reservation code
fn generate_reservation_code() -> String {
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
    format!("RES-{}", random_part)
}

/// Get all reservations
pub async fn get_all_reservations(pool: &PgPool) -> Result<Vec<TableReservation>, sqlx::Error> {
    let reservations = sqlx::query_as::<_, TableReservation>(
        r#"
        SELECT * FROM table_reservations
        ORDER BY created_at DESC
        "#,
    )
    .fetch_all(pool)
    .await?;

    Ok(reservations)
}

/// Get reservations for a user
pub async fn get_reservations_by_user_id(pool: &PgPool, user_id: Uuid) -> Result<Vec<TableReservation>, sqlx::Error> {
    let reservations = sqlx::query_as::<_, TableReservation>(
        r#"
        SELECT * FROM table_reservations
        WHERE user_id = $1
        ORDER BY created_at DESC
        "#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    Ok(reservations)
}

/// Get reservations by table ID
pub async fn get_reservations_by_table_id(pool: &PgPool, table_id: Uuid) -> Result<Vec<TableReservation>, sqlx::Error> {
    let reservations = sqlx::query_as::<_, TableReservation>(
        r#"
        SELECT * FROM table_reservations
        WHERE table_id = $1
        ORDER BY created_at DESC
        "#,
    )
    .bind(table_id)
    .fetch_all(pool)
    .await?;

    Ok(reservations)
}

/// Get reservation by ID
pub async fn get_reservation_by_id(pool: &PgPool, reservation_id: Uuid) -> Result<TableReservation, sqlx::Error> {
    let reservation = sqlx::query_as::<_, TableReservation>(
        r#"
        SELECT * FROM table_reservations
        WHERE id = $1
        "#,
    )
    .bind(reservation_id)
    .fetch_one(pool)
    .await?;

    Ok(reservation)
}

/// Get reservation by code
pub async fn get_reservation_by_code(pool: &PgPool, code: &str) -> Result<TableReservation, sqlx::Error> {
    let reservation = sqlx::query_as::<_, TableReservation>(
        r#"
        SELECT * FROM table_reservations
        WHERE reservation_code = $1
        "#,
    )
    .bind(code)
    .fetch_one(pool)
    .await?;

    Ok(reservation)
}

/// Get reservation with table and event details by code
/// Returns three separate tuples to avoid SQLx 16-field limit
pub async fn get_reservation_with_details_by_code(
    pool: &PgPool,
    code: &str,
) -> Result<(TableReservation, Table, (Uuid, String, String, String, String)), sqlx::Error> {
    // First, get the reservation
    let reservation = get_reservation_by_code(pool, code).await?;

    // Then get table details
    let table = get_table_by_id(pool, reservation.table_id).await?;

    // Finally get event details
    let event = sqlx::query_as::<_, (Uuid, String, String, String, String)>(
        r#"
        SELECT id, title, venue, date, image
        FROM events
        WHERE id = $1
        "#,
    )
    .bind(reservation.event_id)
    .fetch_one(pool)
    .await?;

    Ok((reservation, table, event))
}

/// Get reservations with table and event details joined (for user view)
/// Split into 16 fields to fit SQLx tuple limit
pub async fn get_reservations_with_details_by_user_id(
    pool: &PgPool,
    user_id: Uuid,
) -> Result<Vec<(Uuid, String, String, i32, Decimal, Decimal, String, String, String, Option<String>, chrono::DateTime<chrono::Utc>, String, i32, Decimal, String, String)>, sqlx::Error> {
    let results = sqlx::query_as::<_, (Uuid, String, String, i32, Decimal, Decimal, String, String, String, Option<String>, chrono::DateTime<chrono::Utc>, String, i32, Decimal, String, String)>(
        r#"
        SELECT
            r.id, r.reservation_code, r.status, r.num_people, r.total_amount, r.amount_paid,
            r.contact_name, r.contact_email, r.contact_phone, r.special_requests, r.created_at,
            t.name as table_name, t.capacity, t.min_spend,
            e.title as event_title, e.image
        FROM table_reservations r
        INNER JOIN tables t ON r.table_id = t.id
        INNER JOIN events e ON r.event_id = e.id
        WHERE r.user_id = $1
        ORDER BY r.created_at DESC
        "#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    Ok(results)
}

/// Create a table reservation
pub async fn create_reservation(
    pool: &PgPool,
    table_id: Uuid,
    user_id: Uuid,
    event_id: Uuid,
    num_people: i32,
    contact_name: String,
    contact_email: String,
    contact_phone: String,
    special_requests: Option<String>,
) -> Result<TableReservation, sqlx::Error> {
    // Get the table to calculate total amount
    let table = get_table_by_id(pool, table_id).await?;
    let total_amount = table.min_spend * Decimal::from(num_people);

    // Generate unique reservation code
    let mut reservation_code = generate_reservation_code();
    let mut attempts = 0;
    while attempts < 10 {
        if get_reservation_by_code(pool, &reservation_code).await.is_err() {
            break;
        }
        reservation_code = generate_reservation_code();
        attempts += 1;
    }

    let reservation = sqlx::query_as::<_, TableReservation>(
        r#"
        INSERT INTO table_reservations (
            table_id, user_id, event_id, num_people, total_amount,
            contact_name, contact_email, contact_phone, special_requests, reservation_code
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
        "#,
    )
    .bind(table_id)
    .bind(user_id)
    .bind(event_id)
    .bind(num_people)
    .bind(total_amount)
    .bind(contact_name)
    .bind(contact_email)
    .bind(contact_phone)
    .bind(special_requests)
    .bind(reservation_code)
    .fetch_one(pool)
    .await?;

    Ok(reservation)
}

/// Update a reservation
pub async fn update_reservation(
    pool: &PgPool,
    reservation_id: Uuid,
    status: Option<String>,
    num_people: Option<i32>,
    contact_name: Option<String>,
    contact_email: Option<String>,
    contact_phone: Option<String>,
    special_requests: Option<String>,
) -> Result<TableReservation, sqlx::Error> {
    // If num_people is updated, we need to recalculate total_amount
    let current_reservation = get_reservation_by_id(pool, reservation_id).await?;

    let final_num_people = num_people.unwrap_or(current_reservation.num_people);

    // Get the table to recalculate if num_people changed
    let new_total_amount = if num_people.is_some() && num_people.unwrap() != current_reservation.num_people {
        let table = get_table_by_id(pool, current_reservation.table_id).await?;
        table.min_spend * Decimal::from(final_num_people)
    } else {
        current_reservation.total_amount
    };

    let reservation = sqlx::query_as::<_, TableReservation>(
        r#"
        UPDATE table_reservations
        SET status = COALESCE($1, status),
            num_people = COALESCE($2, num_people),
            total_amount = $3,
            contact_name = COALESCE($4, contact_name),
            contact_email = COALESCE($5, contact_email),
            contact_phone = COALESCE($6, contact_phone),
            special_requests = COALESCE($7, special_requests),
            updated_at = NOW()
        WHERE id = $8
        RETURNING *
        "#,
    )
    .bind(status)
    .bind(num_people)
    .bind(new_total_amount)
    .bind(contact_name)
    .bind(contact_email)
    .bind(contact_phone)
    .bind(special_requests)
    .bind(reservation_id)
    .fetch_one(pool)
    .await?;

    Ok(reservation)
}

/// Delete a reservation
pub async fn delete_reservation(pool: &PgPool, reservation_id: Uuid) -> Result<bool, sqlx::Error> {
    let result = sqlx::query(
        r#"
        DELETE FROM table_reservations
        WHERE id = $1
        "#,
    )
    .bind(reservation_id)
    .execute(pool)
    .await?;

    Ok(result.rows_affected() > 0)
}

// ============================================================================
// Payment tracking
// ============================================================================

/// Add a payment to a reservation
pub async fn add_payment_to_reservation(
    pool: &PgPool,
    reservation_id: Uuid,
    payment_id: Uuid,
    amount: Decimal,
) -> Result<(), sqlx::Error> {
    // Insert into junction table
    sqlx::query(
        r#"
        INSERT INTO table_reservation_payments (reservation_id, payment_id, amount)
        VALUES ($1, $2, $3)
        "#,
    )
    .bind(reservation_id)
    .bind(payment_id)
    .bind(amount)
    .execute(pool)
    .await?;

    // Update the amount_paid in the reservation
    sqlx::query(
        r#"
        UPDATE table_reservations
        SET amount_paid = amount_paid + $1,
            updated_at = NOW()
        WHERE id = $2
        "#,
    )
    .bind(amount)
    .bind(reservation_id)
    .execute(pool)
    .await?;

    Ok(())
}

/// Get payments for a reservation
pub async fn get_payments_for_reservation(
    pool: &PgPool,
    reservation_id: Uuid,
) -> Result<Vec<TableReservationPayment>, sqlx::Error> {
    let payments = sqlx::query_as::<_, TableReservationPayment>(
        r#"
        SELECT * FROM table_reservation_payments
        WHERE reservation_id = $1
        ORDER BY created_at DESC
        "#,
    )
    .bind(reservation_id)
    .fetch_all(pool)
    .await?;

    Ok(payments)
}

// ============================================================================
// Ticket linking
// ============================================================================

/// Link a ticket to a reservation
pub async fn link_ticket_to_reservation(
    pool: &PgPool,
    reservation_id: Uuid,
    ticket_id: Uuid,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        INSERT INTO table_reservation_tickets (reservation_id, ticket_id)
        VALUES ($1, $2)
        "#,
    )
    .bind(reservation_id)
    .bind(ticket_id)
    .execute(pool)
    .await?;

    Ok(())
}

/// Get tickets for a reservation
pub async fn get_tickets_for_reservation(
    pool: &PgPool,
    reservation_id: Uuid,
) -> Result<Vec<Uuid>, sqlx::Error> {
    let ticket_ids = sqlx::query_scalar::<_, Uuid>(
        r#"
        SELECT ticket_id FROM table_reservation_tickets
        WHERE reservation_id = $1
        ORDER BY created_at DESC
        "#,
    )
    .bind(reservation_id)
    .fetch_all(pool)
    .await?;

    Ok(ticket_ids)
}

/// Unlink a ticket from a reservation
pub async fn unlink_ticket_from_reservation(
    pool: &PgPool,
    reservation_id: Uuid,
    ticket_id: Uuid,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query(
        r#"
        DELETE FROM table_reservation_tickets
        WHERE reservation_id = $1 AND ticket_id = $2
        "#,
    )
    .bind(reservation_id)
    .bind(ticket_id)
    .execute(pool)
    .await?;

    Ok(result.rows_affected() > 0)
}