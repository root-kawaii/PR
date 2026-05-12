use sqlx::PgPool;
use uuid::Uuid;

use crate::infrastructure::repositories::ticket_repository;
use crate::models::{EventSummary, TicketWithEventResponse};

pub use crate::infrastructure::repositories::ticket_repository::*;

pub async fn list_user_tickets_with_event_details(
    pool: &PgPool,
    user_id: Uuid,
) -> Result<Vec<TicketWithEventResponse>, sqlx::Error> {
    let results = ticket_repository::get_tickets_with_events_by_user_id(pool, user_id).await?;

    Ok(results
        .into_iter()
        .map(|row| TicketWithEventResponse {
            id: row.id.to_string(),
            ticket_code: row.ticket_code,
            ticket_type: row.ticket_type,
            price: format!("{:.2} €", row.price),
            status: row.status,
            purchase_date: row.purchase_date.to_rfc3339(),
            qr_code: row.qr_code,
            event: EventSummary {
                id: row.event_id.to_string(),
                title: row.event_title,
                venue: row.event_venue,
                club_name: row.club_name,
                club_address: row.club_address,
                date: row.event_date,
                image: row.event_image,
                status: row.event_status,
            },
        })
        .collect())
}
