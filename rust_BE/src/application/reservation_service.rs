use std::collections::HashMap;

use sqlx::PgPool;
use uuid::Uuid;

use crate::infrastructure::repositories::table_repository;
use crate::models::{EventSummary, TableReservationWithDetailsResponse, TableSummary};

pub use crate::infrastructure::repositories::table_repository::*;

pub async fn list_user_reservations_with_details(
    pool: &PgPool,
    user_id: Uuid,
) -> Result<Vec<TableReservationWithDetailsResponse>, sqlx::Error> {
    let reservation_results = table_repository::get_reservations_with_details_by_user_id(pool, user_id).await?;
    let reservation_ids: Vec<Uuid> = reservation_results.iter().map(|r| r.0).collect();
    let event_results = table_repository::get_event_details_by_reservation_ids(pool, reservation_ids).await?;

    let event_map: HashMap<Uuid, (Uuid, String, String, String, String)> = event_results
        .into_iter()
        .map(|(res_id, event_id, title, venue, date, image)| {
            (res_id, (event_id, title, venue, date, image))
        })
        .collect();

    Ok(reservation_results
        .into_iter()
        .map(|(
            res_id, res_code, status, num_people, total_amount, amount_paid,
            contact_name, contact_email, contact_phone, special_requests, created_at,
            table_id, table_name, table_zone, capacity, min_spend
        )| {
            let amount_remaining = total_amount - amount_paid;
            let (event_id, event_title, event_venue, event_date, event_image) = event_map
                .get(&res_id)
                .cloned()
                .unwrap_or_else(|| (
                    Uuid::nil(),
                    String::from("Unknown Event"),
                    String::new(),
                    String::new(),
                    String::new(),
                ));

            TableReservationWithDetailsResponse {
                id: res_id.to_string(),
                reservation_code: res_code,
                status,
                num_people,
                total_amount: format!("{:.2} €", total_amount),
                amount_paid: format!("{:.2} €", amount_paid),
                amount_remaining: format!("{:.2} €", amount_remaining),
                contact_name,
                contact_email,
                contact_phone,
                special_requests,
                created_at: created_at.to_rfc3339(),
                table: TableSummary {
                    id: table_id.to_string(),
                    name: table_name,
                    zone: table_zone,
                    capacity,
                    min_spend: format!("{:.2} €", min_spend),
                    location_description: None,
                    features: None,
                },
                event: EventSummary {
                    id: event_id.to_string(),
                    title: event_title,
                    venue: event_venue,
                    date: event_date,
                    image: event_image,
                    status: None,
                },
            }
        })
        .collect())
}
