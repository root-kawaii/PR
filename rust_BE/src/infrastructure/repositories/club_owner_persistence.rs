use crate::models::club_owner::{
    ClubImageRow, ClubOwner, EventStatRow, OwnerStats, ScanResult, TableImageRow,
};
use crate::models::table::TableReservation;
use rust_decimal::Decimal;
use sqlx::{PgPool, Result};
use uuid::Uuid;

/// Create a new club owner
pub async fn create_club_owner(
    pool: &PgPool,
    email: String,
    password_hash: String,
    name: String,
    phone_number: Option<String>,
) -> Result<ClubOwner> {
    let owner = sqlx::query_as::<_, ClubOwner>(
        r#"
        INSERT INTO club_owners (id, email, password_hash, name, phone_number, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        RETURNING id, email, password_hash, name, phone_number, created_at, updated_at
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(email)
    .bind(password_hash)
    .bind(name)
    .bind(phone_number)
    .fetch_one(pool)
    .await?;

    Ok(owner)
}

/// Find a club owner by email
pub async fn find_club_owner_by_email(pool: &PgPool, email: &str) -> Result<Option<ClubOwner>> {
    let owner = sqlx::query_as::<_, ClubOwner>(
        r#"
        SELECT id, email, password_hash, name, phone_number, created_at, updated_at
        FROM club_owners
        WHERE email = $1
        "#,
    )
    .bind(email)
    .fetch_optional(pool)
    .await?;

    Ok(owner)
}

/// Find a club owner by ID
pub async fn find_club_owner_by_id(pool: &PgPool, owner_id: Uuid) -> Result<Option<ClubOwner>> {
    let owner = sqlx::query_as::<_, ClubOwner>(
        r#"
        SELECT id, email, password_hash, name, phone_number, created_at, updated_at
        FROM club_owners
        WHERE id = $1
        "#,
    )
    .bind(owner_id)
    .fetch_optional(pool)
    .await?;

    Ok(owner)
}

// ============================================================================
// Club images
// ============================================================================

pub async fn get_club_images(pool: &PgPool, club_id: Uuid) -> Result<Vec<ClubImageRow>> {
    let rows = sqlx::query_as::<_, ClubImageRow>(
        r#"
        SELECT id, club_id, url, display_order, alt_text, created_at
        FROM club_images
        WHERE club_id = $1
        ORDER BY display_order ASC, created_at ASC
        "#,
    )
    .bind(club_id)
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn add_club_image(
    pool: &PgPool,
    club_id: Uuid,
    url: String,
    display_order: Option<i32>,
    alt_text: Option<String>,
) -> Result<ClubImageRow> {
    let order = display_order.unwrap_or(0);
    let row = sqlx::query_as::<_, ClubImageRow>(
        r#"
        INSERT INTO club_images (id, club_id, url, display_order, alt_text, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING id, club_id, url, display_order, alt_text, created_at
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(club_id)
    .bind(url)
    .bind(order)
    .bind(alt_text)
    .fetch_one(pool)
    .await?;
    Ok(row)
}

pub async fn delete_club_image(pool: &PgPool, image_id: Uuid, club_id: Uuid) -> Result<bool> {
    let result = sqlx::query(r#"DELETE FROM club_images WHERE id = $1 AND club_id = $2"#)
        .bind(image_id)
        .bind(club_id)
        .execute(pool)
        .await?;
    Ok(result.rows_affected() > 0)
}

// ============================================================================
// Table images
// ============================================================================

pub async fn get_table_images(pool: &PgPool, table_id: Uuid) -> Result<Vec<TableImageRow>> {
    let rows = sqlx::query_as::<_, TableImageRow>(
        r#"
        SELECT id, table_id, url, display_order, alt_text, created_at
        FROM table_images
        WHERE table_id = $1
        ORDER BY display_order ASC, created_at ASC
        "#,
    )
    .bind(table_id)
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn add_table_image(
    pool: &PgPool,
    table_id: Uuid,
    url: String,
    display_order: Option<i32>,
    alt_text: Option<String>,
) -> Result<TableImageRow> {
    let order = display_order.unwrap_or(0);
    let row = sqlx::query_as::<_, TableImageRow>(
        r#"
        INSERT INTO table_images (id, table_id, url, display_order, alt_text, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING id, table_id, url, display_order, alt_text, created_at
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(table_id)
    .bind(url)
    .bind(order)
    .bind(alt_text)
    .fetch_one(pool)
    .await?;
    Ok(row)
}

pub async fn delete_table_image(pool: &PgPool, image_id: Uuid) -> Result<bool> {
    let result = sqlx::query(r#"DELETE FROM table_images WHERE id = $1"#)
        .bind(image_id)
        .execute(pool)
        .await?;
    Ok(result.rows_affected() > 0)
}

/// Delete a table image only if it belongs to a table whose event belongs to `club_id`.
pub async fn delete_table_image_for_club(pool: &PgPool, image_id: Uuid, club_id: Uuid) -> Result<bool> {
    let result = sqlx::query(
        r#"
        DELETE FROM table_images
        WHERE id = $1
          AND table_id IN (
              SELECT t.id FROM tables t
              JOIN events e ON e.id = t.event_id
              WHERE e.club_id = $2
          )
        "#,
    )
    .bind(image_id)
    .bind(club_id)
    .execute(pool)
    .await?;
    Ok(result.rows_affected() > 0)
}

// ============================================================================
// Event reservations
// ============================================================================

pub async fn get_event_reservations(
    pool: &PgPool,
    event_id: Uuid,
) -> Result<Vec<TableReservation>> {
    let rows = sqlx::query_as::<_, TableReservation>(
        r#"
        SELECT tr.id, tr.table_id, tr.user_id, tr.event_id, tr.status, tr.num_people,
               tr.total_amount, tr.amount_paid, tr.contact_name, tr.contact_email,
               tr.contact_phone, tr.special_requests, tr.reservation_code,
               tr.created_at, tr.updated_at,
               tr.guest_user_ids, tr.payment_ids, tr.ticket_ids,
               tr.is_manual, tr.manual_notes, tr.payment_link_token
        FROM table_reservations tr
        WHERE tr.event_id = $1
        ORDER BY tr.created_at DESC
        "#,
    )
    .bind(event_id)
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

// ============================================================================
// Manual reservation
// ============================================================================

pub async fn create_manual_reservation(
    pool: &PgPool,
    event_id: Uuid,
    table_id: Uuid,
    contact_name: String,
    contact_phone: String,
    contact_email: Option<String>,
    num_people: i32,
    manual_notes: Option<String>,
) -> Result<TableReservation> {
    let total_amount: Decimal = sqlx::query_scalar("SELECT total_cost FROM tables WHERE id = $1")
        .bind(table_id)
        .fetch_one(pool)
        .await?;

    let reservation_code = format!(
        "RES-{}",
        &uuid::Uuid::new_v4()
            .to_string()
            .replace('-', "")
            .to_uppercase()[..8]
    );

    let email = contact_email.unwrap_or_default();
    let placeholder_user_id = Uuid::nil();

    let row = sqlx::query_as::<_, TableReservation>(
        r#"
        INSERT INTO table_reservations (
            id, table_id, user_id, event_id, status, num_people,
            total_amount, amount_paid, contact_name, contact_email, contact_phone,
            special_requests, reservation_code, is_manual, manual_notes,
            created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, 'confirmed', $5, $6, 0, $7, $8, $9, NULL, $10, true, $11, NOW(), NOW())
        RETURNING id, table_id, user_id, event_id, status, num_people,
                  total_amount, amount_paid, contact_name, contact_email, contact_phone,
                  special_requests, reservation_code, created_at, updated_at,
                  guest_user_ids, payment_ids, ticket_ids, is_manual, manual_notes,
                  payment_link_token
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(table_id)
    .bind(placeholder_user_id)
    .bind(event_id)
    .bind(num_people)
    .bind(total_amount)
    .bind(contact_name)
    .bind(email)
    .bind(contact_phone)
    .bind(reservation_code)
    .bind(manual_notes)
    .fetch_one(pool)
    .await?;
    Ok(row)
}

// ============================================================================
// Reservation status
// ============================================================================

pub async fn update_reservation_status(
    pool: &PgPool,
    reservation_id: Uuid,
    status: String,
) -> Result<Option<TableReservation>> {
    let row = sqlx::query_as::<_, TableReservation>(
        r#"
        UPDATE table_reservations
        SET status = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING id, table_id, user_id, event_id, status, num_people,
                  total_amount, amount_paid, contact_name, contact_email, contact_phone,
                  special_requests, reservation_code, created_at, updated_at,
                  guest_user_ids, payment_ids, ticket_ids, is_manual, manual_notes,
                  payment_link_token
        "#,
    )
    .bind(status)
    .bind(reservation_id)
    .fetch_optional(pool)
    .await?;
    Ok(row)
}

// ============================================================================
// QR scan / checkin
// ============================================================================

pub async fn scan_code(pool: &PgPool, code: &str) -> Result<Option<ScanResult>> {
    // Try ticket first
    let ticket_row = sqlx::query(
        r#"
        SELECT t.ticket_code, t.status, u.name as guest_name, e.title as event_title
        FROM tickets t
        JOIN users u ON u.id = t.user_id
        JOIN events e ON e.id = t.event_id
        WHERE t.ticket_code = $1
        "#,
    )
    .bind(code)
    .fetch_optional(pool)
    .await?;

    if let Some(row) = ticket_row {
        use sqlx::Row;
        let status: String = row.get("status");
        return Ok(Some(ScanResult {
            valid: true,
            already_used: status == "used",
            scan_type: "ticket".to_string(),
            guest_name: row.try_get("guest_name").ok(),
            num_people: None,
            event_title: row.try_get("event_title").ok(),
            table_name: None,
            code: code.to_string(),
        }));
    }

    // Try reservation
    let res_row = sqlx::query(
        r#"
        SELECT tr.reservation_code, tr.status, tr.contact_name, tr.num_people,
               e.title as event_title, tbl.name as table_name
        FROM table_reservations tr
        JOIN events e ON e.id = tr.event_id
        JOIN tables tbl ON tbl.id = tr.table_id
        WHERE tr.reservation_code = $1
        "#,
    )
    .bind(code)
    .fetch_optional(pool)
    .await?;

    if let Some(row) = res_row {
        use sqlx::Row;
        let status: String = row.get("status");
        return Ok(Some(ScanResult {
            valid: true,
            already_used: status == "completed",
            scan_type: "reservation".to_string(),
            guest_name: row.try_get("contact_name").ok(),
            num_people: row.try_get("num_people").ok(),
            event_title: row.try_get("event_title").ok(),
            table_name: row.try_get("table_name").ok(),
            code: code.to_string(),
        }));
    }

    Ok(None)
}

pub async fn checkin_by_code(pool: &PgPool, code: &str) -> Result<Option<ScanResult>> {
    // Try ticket checkin
    let ticket_updated = sqlx::query(
        r#"UPDATE tickets SET status = 'used', updated_at = NOW() WHERE ticket_code = $1 AND status != 'used'"#,
    )
    .bind(code)
    .execute(pool)
    .await?;

    if ticket_updated.rows_affected() > 0 {
        let row = sqlx::query(
            r#"
            SELECT t.ticket_code, u.name as guest_name, e.title as event_title
            FROM tickets t
            JOIN users u ON u.id = t.user_id
            JOIN events e ON e.id = t.event_id
            WHERE t.ticket_code = $1
            "#,
        )
        .bind(code)
        .fetch_optional(pool)
        .await?;

        if let Some(r) = row {
            use sqlx::Row;
            return Ok(Some(ScanResult {
                valid: true,
                already_used: false,
                scan_type: "ticket".to_string(),
                guest_name: r.try_get("guest_name").ok(),
                num_people: None,
                event_title: r.try_get("event_title").ok(),
                table_name: None,
                code: code.to_string(),
            }));
        }
    }

    // Try reservation checkin
    let res_updated = sqlx::query(
        r#"UPDATE table_reservations SET status = 'completed', updated_at = NOW() WHERE reservation_code = $1 AND status != 'completed'"#,
    )
    .bind(code)
    .execute(pool)
    .await?;

    if res_updated.rows_affected() > 0 {
        let row = sqlx::query(
            r#"
            SELECT tr.contact_name, tr.num_people, e.title as event_title, tbl.name as table_name
            FROM table_reservations tr
            JOIN events e ON e.id = tr.event_id
            JOIN tables tbl ON tbl.id = tr.table_id
            WHERE tr.reservation_code = $1
            "#,
        )
        .bind(code)
        .fetch_optional(pool)
        .await?;

        if let Some(r) = row {
            use sqlx::Row;
            return Ok(Some(ScanResult {
                valid: true,
                already_used: false,
                scan_type: "reservation".to_string(),
                guest_name: r.try_get("contact_name").ok(),
                num_people: r.try_get("num_people").ok(),
                event_title: r.try_get("event_title").ok(),
                table_name: r.try_get("table_name").ok(),
                code: code.to_string(),
            }));
        }
    }

    // Code was valid but already used
    let existing = scan_code(pool, code).await?;
    Ok(existing.map(|mut r| {
        r.already_used = true;
        r
    }))
}

// ============================================================================
// Owner stats
// ============================================================================

pub async fn get_owner_stats(pool: &PgPool, club_id: Uuid) -> Result<OwnerStats> {
    let active_reservations: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(tr.id)
        FROM table_reservations tr
        JOIN events e ON e.id = tr.event_id
        WHERE e.club_id = $1
          AND tr.status IN ('confirmed', 'pending')
        "#,
    )
    .bind(club_id)
    .fetch_one(pool)
    .await?;

    let total_revenue: Option<Decimal> = sqlx::query_scalar(
        r#"
        SELECT SUM(tr.amount_paid)
        FROM table_reservations tr
        JOIN events e ON e.id = tr.event_id
        WHERE e.club_id = $1
        "#,
    )
    .bind(club_id)
    .fetch_one(pool)
    .await?;

    let event_rows = sqlx::query(
        r#"
        SELECT
            e.id::text as event_id,
            e.title,
            e.date,
            COUNT(tr.id) FILTER (WHERE tr.status IN ('confirmed', 'pending', 'completed')) as reserved_tables,
            COUNT(t.id) as total_tables
        FROM events e
        LEFT JOIN tables t ON t.event_id = e.id
        LEFT JOIN table_reservations tr ON tr.event_id = e.id
        WHERE e.club_id = $1
        GROUP BY e.id, e.title, e.date
        ORDER BY e.created_at DESC
        "#,
    )
    .bind(club_id)
    .fetch_all(pool)
    .await?;

    use sqlx::Row;
    let events: Vec<EventStatRow> = event_rows
        .iter()
        .map(|r| EventStatRow {
            event_id: r.get("event_id"),
            title: r.get("title"),
            date: r.get("date"),
            reserved_tables: r.get("reserved_tables"),
            total_tables: r.get("total_tables"),
        })
        .collect();

    Ok(OwnerStats {
        active_reservations,
        total_revenue: total_revenue.unwrap_or(Decimal::ZERO),
        events,
    })
}
