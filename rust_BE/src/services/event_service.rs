use crate::models::{EventEntity, EventRequest, AppState};
use uuid::Uuid;
use axum::http::StatusCode;
use axum::Json;

pub async fn load_all_events_service(pool: &AppState) -> Result<Vec<EventEntity>, StatusCode> {
    sqlx::query_as::<_, EventEntity>(
        "SELECT id, title, url, description, completed FROM events"
    )
    .fetch_all(pool)
    .await
    .map_err(|e| {
        eprintln!("Database error: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })
}

pub async fn load_event_service(id: Uuid, pool: &AppState) -> Result<EventEntity, StatusCode> {
    sqlx::query_as::<_, EventEntity>(
        "SELECT id, title, url, description, completed FROM events WHERE id = $1"
    )
    .bind(id)
    .fetch_optional(pool)
    .await
    .map_err(|e| {
        eprintln!("Database error: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?
    .ok_or(StatusCode::NOT_FOUND)
}

pub async fn create_event_service(payload: EventRequest, pool: &AppState) -> Result<EventEntity, StatusCode> {
    let id = Uuid::new_v4();
    sqlx::query_as::<_, EventEntity>(
        "INSERT INTO events (id, title, description, completed) VALUES ($1, $2, $3, false) RETURNING id, title, description, completed"
    )
    .bind(id)
    .bind(&payload.title)
    .bind(&payload.description)
    .fetch_one(pool)
    .await
    .map_err(|e| {
        eprintln!("Database error: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })
}

// pub async fn update_event_service(id: Uuid, payload: UpdateEvent, pool: &AppState) -> Result<Event, StatusCode> {
//     let mut query = String::from("UPDATE events SET ");
//     let mut updates = Vec::new();
//     let mut param_count = 1;
//     if payload.title.is_some() {
//         updates.push(format!("title = ${}", param_count));
//         param_count += 1;
//     }
//     if payload.description.is_some() {
//         updates.push(format!("description = ${}", param_count));
//         param_count += 1;
//     }
//     if payload.completed.is_some() {
//         updates.push(format!("completed = ${}", param_count));
//         param_count += 1;
//     }
//     if updates.is_empty() {
//         return get_event_service(id, pool).await;
//     }
//     query.push_str(&updates.join(", "));
//     query.push_str(&format!(" WHERE id = ${} RETURNING id, title, description, completed", param_count));
//     let mut query_builder = sqlx::query_as::<_, Event>(&query).bind(id);
//     if let Some(title) = payload.title {
//         query_builder = query_builder.bind(title);
//     }
//     if let Some(description) = payload.description {
//         query_builder = query_builder.bind(description);
//     }
//     if let Some(completed) = payload.completed {
//         query_builder = query_builder.bind(completed);
//     }
//     query_builder
//         .fetch_optional(pool)
//         .await
//         .map_err(|e| {
//             eprintln!("Database error: {}", e);
//             StatusCode::INTERNAL_SERVER_ERROR
//         })?
//         .ok_or(StatusCode::NOT_FOUND)
// }

pub async fn erase_event_service(id: Uuid, pool: &AppState) -> Result<u64, StatusCode> {
    let result = sqlx::query("DELETE FROM events WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await;
    match result {
        Ok(res) => Ok(res.rows_affected()),
        Err(e) => {
            eprintln!("Database error: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}
