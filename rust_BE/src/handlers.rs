// src/handlers.rs

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use uuid::Uuid;

// Import from your own modules
use crate::models::{Event, CreateEvent, UpdateEvent, AppState};

// Mark functions as public
pub async fn get_all_events(
    State(pool): State<AppState>
) -> Result<Json<Vec<Event>>, StatusCode> {
    
    let events = sqlx::query_as::<_, Event>(
        "SELECT id, title, url, description, completed FROM events"
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| {
        eprintln!("Database error: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;
    
    Ok(Json(events))
}

pub async fn get_event(
    Path(id): Path<Uuid>,
    State(pool): State<AppState>,
) -> Result<Json<Event>, StatusCode> {
    let event = sqlx::query_as::<_, Event>(
        "SELECT id, title, url, description, completed FROM events WHERE id = $1"
    )
    .bind(id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        eprintln!("Database error: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?
    .ok_or(StatusCode::NOT_FOUND)?;
    
    Ok(Json(event))
}

pub async fn create_event(
    State(pool): State<AppState>,
    Json(payload): Json<CreateEvent>,
) -> Result<(StatusCode, Json<Event>), StatusCode> {
    let id = Uuid::new_v4();
    
    let event = sqlx::query_as::<_, Event>(
        "INSERT INTO events (id, title, description, completed) 
         VALUES ($1, $2, $3, false, $4, $5) 
         RETURNING id, title, description, completed"
    )
    .bind(id)
    .bind(&payload.title)
    .bind(&payload.description)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        eprintln!("Database error: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;
    
    Ok((StatusCode::CREATED, Json(event)))
}



pub async fn update_event(
    Path(id): Path<Uuid>,
    State(pool): State<AppState>,
    Json(payload): Json<UpdateEvent>,
) -> Result<Json<Event>, StatusCode> {
    let mut query = String::from("UPDATE events SET ");
    let mut updates = Vec::new();
    let mut param_count = 1;
    
    if payload.title.is_some() {
        updates.push(format!("title = ${}", param_count));
        param_count += 1;
    }
    if payload.description.is_some() {
        updates.push(format!("description = ${}", param_count));
        param_count += 1;
    }
    if payload.completed.is_some() {
        updates.push(format!("completed = ${}", param_count));
        param_count += 1;
    }
    
    if updates.is_empty() {
        return get_event(Path(id), State(pool)).await;
    }
    
    query.push_str(&updates.join(", "));
    query.push_str(&format!(" WHERE id = ${} RETURNING id, title, description, completed", param_count));
    
    let mut query_builder = sqlx::query_as::<_, Event>(&query).bind(id);
    
    if let Some(title) = payload.title {
        query_builder = query_builder.bind(title);
    }
    if let Some(description) = payload.description {
        query_builder = query_builder.bind(description);
    }
    if let Some(completed) = payload.completed {
        query_builder = query_builder.bind(completed);
    }
    
    let event = query_builder
        .fetch_optional(&pool)
        .await
        .map_err(|e| {
            eprintln!("Database error: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or(StatusCode::NOT_FOUND)?;
    
    Ok(Json(event))
}

// HANDLER 5: Delete an event from Postgres
// DELETE /events/:id
pub async fn delete_event(
    Path(id): Path<Uuid>,
    State(pool): State<AppState>,
) -> StatusCode {
    let result = sqlx::query("DELETE FROM events WHERE id = $1")
        .bind(id)
        .execute(&pool)
        .await;
    
    match result {
        Ok(res) if res.rows_affected() > 0 => StatusCode::NO_CONTENT,
        Ok(_) => StatusCode::NOT_FOUND,
        Err(e) => {
            eprintln!("Database error: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        }
    }
}
// ... other handlers (update_event, delete_event)