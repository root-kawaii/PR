use sqlx::PgPool;
use uuid::Uuid;

use crate::infrastructure::repositories::club_owner_repository;
use crate::models::table::TableReservationResponse;

pub use crate::infrastructure::repositories::club_owner_repository::*;

pub async fn list_event_reservations(
    pool: &PgPool,
    event_id: Uuid,
) -> Result<Vec<TableReservationResponse>, sqlx::Error> {
    let reservations = club_owner_repository::get_event_reservations(pool, event_id).await?;
    Ok(reservations.into_iter().map(TableReservationResponse::from).collect())
}
