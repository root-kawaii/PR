use crate::models::{Table, TableReservation, ReservationPaymentShare, ReservationGuest};
use sqlx::PgPool;
use uuid::Uuid;
use rust_decimal::Decimal;
use serde_json::Value as JsonValue;

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
    marzipano_position: Option<JsonValue>,
) -> Result<Table, sqlx::Error> {
    let total_cost = min_spend * Decimal::from(capacity);

    let table = sqlx::query_as::<_, Table>(
        r#"
        INSERT INTO tables (event_id, name, zone, capacity, min_spend, total_cost, location_description, features, marzipano_position)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
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
    .bind(marzipano_position)
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
    marzipano_position: Option<JsonValue>,
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
            marzipano_position = COALESCE($9, marzipano_position),
            updated_at = NOW()
        WHERE id = $10
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
    .bind(marzipano_position)
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
/// Returns in two 16-field queries to work around SQLx tuple limit
pub async fn get_reservations_with_details_by_user_id(
    pool: &PgPool,
    user_id: Uuid,
) -> Result<Vec<(Uuid, String, String, i32, Decimal, Decimal, String, String, String, Option<String>, chrono::DateTime<chrono::Utc>, Uuid, String, Option<String>, i32, Decimal)>, sqlx::Error> {
    // Query part 1: reservation + table details (16 fields)
    let results = sqlx::query_as::<_, (Uuid, String, String, i32, Decimal, Decimal, String, String, String, Option<String>, chrono::DateTime<chrono::Utc>, Uuid, String, Option<String>, i32, Decimal)>(
        r#"
        SELECT
            r.id, r.reservation_code, r.status, r.num_people, r.total_amount, r.amount_paid,
            r.contact_name, r.contact_email, r.contact_phone, r.special_requests, r.created_at,
            t.id as table_id, t.name as table_name, t.zone as table_zone, t.capacity, t.min_spend
        FROM table_reservations r
        INNER JOIN tables t ON r.table_id = t.id
        WHERE r.user_id = $1
        ORDER BY r.created_at DESC
        "#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    Ok(results)
}

/// Get event details by reservation IDs
pub async fn get_event_details_by_reservation_ids(
    pool: &PgPool,
    reservation_ids: Vec<Uuid>,
) -> Result<Vec<(Uuid, Uuid, String, String, String, String)>, sqlx::Error> {
    // Query: reservation_id, event details (6 fields)
    let results = sqlx::query_as::<_, (Uuid, Uuid, String, String, String, String)>(
        r#"
        SELECT
            r.id as reservation_id,
            e.id as event_id, e.title as event_title, e.venue as event_venue,
            e.date as event_date, e.image as event_image
        FROM table_reservations r
        INNER JOIN events e ON r.event_id = e.id
        WHERE r.id = ANY($1)
        "#,
    )
    .bind(&reservation_ids)
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
// Array-based operations (replacing junction tables)
// ============================================================================

/// Add a payment to a reservation's payment_ids array
pub async fn add_payment_to_reservation(
    pool: &PgPool,
    reservation_id: Uuid,
    payment_id: Uuid,
    amount: Decimal,
) -> Result<(), sqlx::Error> {
    // Append payment_id to payment_ids array and update amount_paid
    sqlx::query(
        r#"
        UPDATE table_reservations
        SET payment_ids = array_append(COALESCE(payment_ids, '{}'), $1),
            amount_paid = amount_paid + $2,
            updated_at = NOW()
        WHERE id = $3
        "#,
    )
    .bind(payment_id)
    .bind(amount)
    .bind(reservation_id)
    .execute(pool)
    .await?;

    Ok(())
}

/// Add a ticket to a reservation's ticket_ids array
pub async fn add_ticket_to_reservation(
    pool: &PgPool,
    reservation_id: Uuid,
    ticket_id: Uuid,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        UPDATE table_reservations
        SET ticket_ids = array_append(COALESCE(ticket_ids, '{}'), $1),
            updated_at = NOW()
        WHERE id = $2
        "#,
    )
    .bind(ticket_id)
    .bind(reservation_id)
    .execute(pool)
    .await?;

    Ok(())
}

/// Add a guest user to a reservation's guest_user_ids array
pub async fn add_guest_to_reservation(
    pool: &PgPool,
    reservation_id: Uuid,
    guest_user_id: Uuid,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        UPDATE table_reservations
        SET guest_user_ids = array_append(COALESCE(guest_user_ids, '{}'), $1),
            updated_at = NOW()
        WHERE id = $2
        "#,
    )
    .bind(guest_user_id)
    .bind(reservation_id)
    .execute(pool)
    .await?;

    Ok(())
}

// ============================================================================
// Payment Shares (Split Payment)
// ============================================================================

/// Generate unique payment link token
fn generate_payment_link_token() -> String {
    use rand::Rng;
    let mut rng = rand::thread_rng();
    let token: String = (0..32)
        .map(|_| {
            let idx = rng.gen_range(0..36);
            if idx < 26 {
                (b'a' + idx) as char
            } else {
                (b'0' + (idx - 26)) as char
            }
        })
        .collect();
    format!("pay_{}", token)
}

/// Create a payment share for a reservation
pub async fn create_payment_share(
    pool: &PgPool,
    reservation_id: Uuid,
    user_id: Option<Uuid>,
    phone_number: Option<String>,
    amount: Decimal,
    is_owner: bool,
    status: &str,
    stripe_payment_intent_id: Option<String>,
) -> Result<ReservationPaymentShare, sqlx::Error> {
    let payment_link_token = if !is_owner {
        // Generate unique token, retry on collision
        let mut token = generate_payment_link_token();
        let mut attempts = 0;
        while attempts < 10 {
            let existing = sqlx::query_scalar::<_, i64>(
                "SELECT COUNT(*) FROM reservation_payment_shares WHERE payment_link_token = $1"
            )
            .bind(&token)
            .fetch_one(pool)
            .await?;
            if existing == 0 {
                break;
            }
            token = generate_payment_link_token();
            attempts += 1;
        }
        Some(token)
    } else {
        None
    };

    let share = sqlx::query_as::<_, ReservationPaymentShare>(
        r#"
        INSERT INTO reservation_payment_shares (
            reservation_id, user_id, phone_number, amount, status,
            stripe_payment_intent_id, payment_link_token, is_owner
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
        "#,
    )
    .bind(reservation_id)
    .bind(user_id)
    .bind(phone_number)
    .bind(amount)
    .bind(status)
    .bind(stripe_payment_intent_id)
    .bind(payment_link_token)
    .bind(is_owner)
    .fetch_one(pool)
    .await?;

    Ok(share)
}

/// Get payment share by token
pub async fn get_payment_share_by_token(
    pool: &PgPool,
    token: &str,
) -> Result<ReservationPaymentShare, sqlx::Error> {
    sqlx::query_as::<_, ReservationPaymentShare>(
        "SELECT * FROM reservation_payment_shares WHERE payment_link_token = $1"
    )
    .bind(token)
    .fetch_one(pool)
    .await
}

/// Get payment share by Stripe checkout session ID
pub async fn get_payment_share_by_checkout_session(
    pool: &PgPool,
    session_id: &str,
) -> Result<ReservationPaymentShare, sqlx::Error> {
    sqlx::query_as::<_, ReservationPaymentShare>(
        "SELECT * FROM reservation_payment_shares WHERE stripe_checkout_session_id = $1"
    )
    .bind(session_id)
    .fetch_one(pool)
    .await
}

/// Get all payment shares for a reservation
pub async fn get_payment_shares_by_reservation(
    pool: &PgPool,
    reservation_id: Uuid,
) -> Result<Vec<ReservationPaymentShare>, sqlx::Error> {
    sqlx::query_as::<_, ReservationPaymentShare>(
        "SELECT * FROM reservation_payment_shares WHERE reservation_id = $1 ORDER BY is_owner DESC, created_at ASC"
    )
    .bind(reservation_id)
    .fetch_all(pool)
    .await
}

/// Update payment share status and link Stripe IDs
pub async fn update_payment_share_paid(
    pool: &PgPool,
    share_id: Uuid,
    payment_id: Uuid,
    stripe_payment_intent_id: Option<String>,
) -> Result<ReservationPaymentShare, sqlx::Error> {
    sqlx::query_as::<_, ReservationPaymentShare>(
        r#"
        UPDATE reservation_payment_shares
        SET status = 'paid', payment_id = $1, stripe_payment_intent_id = COALESCE($2, stripe_payment_intent_id),
            updated_at = NOW()
        WHERE id = $3
        RETURNING *
        "#,
    )
    .bind(payment_id)
    .bind(stripe_payment_intent_id)
    .bind(share_id)
    .fetch_one(pool)
    .await
}

/// Set Stripe checkout session ID on a payment share
pub async fn set_payment_share_checkout_session(
    pool: &PgPool,
    share_id: Uuid,
    checkout_session_id: &str,
    guest_name: Option<String>,
    guest_email: Option<String>,
) -> Result<ReservationPaymentShare, sqlx::Error> {
    sqlx::query_as::<_, ReservationPaymentShare>(
        r#"
        UPDATE reservation_payment_shares
        SET stripe_checkout_session_id = $1, guest_name = $2, guest_email = $3, updated_at = NOW()
        WHERE id = $4
        RETURNING *
        "#,
    )
    .bind(checkout_session_id)
    .bind(guest_name)
    .bind(guest_email)
    .bind(share_id)
    .fetch_one(pool)
    .await
}

// ============================================================================
// Reservation Guests (Free / Non-paying)
// ============================================================================

/// Add a free guest to a reservation
pub async fn add_free_guest(
    pool: &PgPool,
    reservation_id: Uuid,
    user_id: Option<Uuid>,
    phone_number: &str,
    email: Option<String>,
    name: Option<String>,
    added_by: Uuid,
    ticket_id: Option<Uuid>,
) -> Result<ReservationGuest, sqlx::Error> {
    sqlx::query_as::<_, ReservationGuest>(
        r#"
        INSERT INTO reservation_guests (reservation_id, user_id, phone_number, email, name, added_by, ticket_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
        "#,
    )
    .bind(reservation_id)
    .bind(user_id)
    .bind(phone_number)
    .bind(email)
    .bind(name)
    .bind(added_by)
    .bind(ticket_id)
    .fetch_one(pool)
    .await
}

/// Get all free guests for a reservation
pub async fn get_free_guests_by_reservation(
    pool: &PgPool,
    reservation_id: Uuid,
) -> Result<Vec<ReservationGuest>, sqlx::Error> {
    sqlx::query_as::<_, ReservationGuest>(
        "SELECT * FROM reservation_guests WHERE reservation_id = $1 ORDER BY created_at ASC"
    )
    .bind(reservation_id)
    .fetch_all(pool)
    .await
}

/// Count total people in a reservation (paying shares + free guests)
pub async fn get_total_people_count(
    pool: &PgPool,
    reservation_id: Uuid,
) -> Result<i64, sqlx::Error> {
    let shares_count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM reservation_payment_shares WHERE reservation_id = $1"
    )
    .bind(reservation_id)
    .fetch_one(pool)
    .await?;

    let guests_count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM reservation_guests WHERE reservation_id = $1"
    )
    .bind(reservation_id)
    .fetch_one(pool)
    .await?;

    Ok(shares_count + guests_count)
}

/// Update reservation amount_paid by adding a share amount
pub async fn increment_reservation_amount_paid(
    pool: &PgPool,
    reservation_id: Uuid,
    amount: Decimal,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        UPDATE table_reservations
        SET amount_paid = amount_paid + $1, updated_at = NOW()
        WHERE id = $2
        "#,
    )
    .bind(amount)
    .bind(reservation_id)
    .execute(pool)
    .await?;

    Ok(())
}

/// Update reservation num_people
pub async fn update_reservation_num_people(
    pool: &PgPool,
    reservation_id: Uuid,
    num_people: i32,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        UPDATE table_reservations
        SET num_people = $1, updated_at = NOW()
        WHERE id = $2
        "#,
    )
    .bind(num_people)
    .bind(reservation_id)
    .execute(pool)
    .await?;

    Ok(())
}

/// Check if all payment shares are paid and update reservation status if so
pub async fn check_and_confirm_reservation(
    pool: &PgPool,
    reservation_id: Uuid,
) -> Result<(), sqlx::Error> {
    let pending_count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM reservation_payment_shares WHERE reservation_id = $1 AND status != 'paid'"
    )
    .bind(reservation_id)
    .fetch_one(pool)
    .await?;

    if pending_count == 0 {
        sqlx::query(
            "UPDATE table_reservations SET status = 'confirmed', updated_at = NOW() WHERE id = $1"
        )
        .bind(reservation_id)
        .execute(pool)
        .await?;
    }

    Ok(())
}