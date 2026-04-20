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
        .map(
            |(
                ticket_id,
                event_id,
                _user_id,
                ticket_code,
                ticket_type,
                price,
                status,
                purchase_date,
                qr_code,
                _created_at,
                _updated_at,
                event_title,
                event_venue,
                event_date,
                event_image,
                event_status,
            )| {
                TicketWithEventResponse {
                    id: ticket_id.to_string(),
                    ticket_code,
                    ticket_type,
                    price: format!("{:.2} €", price),
                    status,
                    purchase_date: purchase_date.to_rfc3339(),
                    qr_code,
                    event: EventSummary {
                        id: event_id.to_string(),
                        title: event_title,
                        venue: event_venue,
                        date: event_date,
                        image: event_image,
                        status: event_status,
                    },
                }
            },
        )
        .collect())
}
