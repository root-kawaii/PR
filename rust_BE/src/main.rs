use serde::{Deserialize, Serialize};
use sqlx::{PgPool, FromRow};
use uuid::Uuid;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post, put, delete},
    Json, Router,
};

// Event struct - represents an event in our system
#[derive(Clone, Debug, Serialize, Deserialize, FromRow)]
struct Event {
    id: Uuid,
    title: String,
    description: String,
    completed: bool,
}

// CreateEvent - request payload for creating a new event
#[derive(Debug, Deserialize)]
struct CreateEvent {
    title: String,
    description: String,
}

// UpdateEvent - request payload for updating an event
#[derive(Debug, Deserialize)]
struct UpdateEvent {
    title: Option<String>,
    description: Option<String>,
    completed: Option<bool>,
}

// AppState - Uses Postgres connection pool
type AppState = PgPool;

// HANDLER 1: Get all events from Postgres
// GET /events
async fn get_all_events(State(pool): State<AppState>) -> Result<Json<Vec<Event>>, StatusCode> {
    println!("Ciao from the backend!");
    
    let events = sqlx::query_as::<_, Event>("SELECT id, title, description, completed FROM events")
        .fetch_all(&pool)
        .await
        .map_err(|e| {
            eprintln!("Database error: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    
    Ok(Json(events))
}

// HANDLER 2: Get a single event by ID from Postgres
// GET /events/:id
async fn get_event(
    Path(id): Path<Uuid>,
    State(pool): State<AppState>,
) -> Result<Json<Event>, StatusCode> {
    let event = sqlx::query_as::<_, Event>(
        "SELECT id, title, description, completed FROM events WHERE id = $1"
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

// HANDLER 3: Create a new event in Postgres
// POST /events
async fn create_event(
    State(pool): State<AppState>,
    Json(payload): Json<CreateEvent>,
) -> Result<(StatusCode, Json<Event>), StatusCode> {
    let id = Uuid::new_v4();
    
    let event = sqlx::query_as::<_, Event>(
        "INSERT INTO events (id, title, description, completed) 
         VALUES ($1, $2, $3, false) 
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

// HANDLER 4: Update an event in Postgres
// PUT /events/:id
async fn update_event(
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
async fn delete_event(
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

#[tokio::main]
async fn main() {
    let database_url = "postgresql://postgres:password@localhost:5432/events";
    
    let pool = PgPool::connect(database_url)
        .await
        .expect("Failed to connect to Postgres");
    
    println!("✅ Connected to PostgreSQL database");
    
    let app = Router::new()
        .route("/events", get(get_all_events).post(create_event))
        .route("/events/:id", get(get_event).put(update_event).delete(delete_event))
        .with_state(pool);
    
    let listener = tokio::net::TcpListener::bind("127.0.0.1:3000")
        .await
        .unwrap();
    
    println!("🚀 Server running on http://127.0.0.1:3000");
    println!("\nAvailable endpoints:");
    println!("  GET    /events        - Get all events");
    println!("  POST   /events        - Create an event");
    println!("  GET    /events/:id    - Get an event by ID");
    println!("  PUT    /events/:id    - Update an event");
    println!("  DELETE /events/:id    - Delete an event");
    
    axum::serve(listener, app).await.unwrap();
}

/* EXPLANATION OF RUST CONCEPTS:

1. #[derive(...)] - Auto-generates code:
   - Clone: Makes copies of the struct
   - Debug: Prints the struct for debugging
   - Serialize: Converts struct to JSON
   - Deserialize: Converts JSON to struct
   - FromRow: Maps database rows to this struct

2. Option<T> - Type-safe nullable values
   - Option<String> = either Some(String) or None
   - No null pointers!

3. PgPool - PostgreSQL connection pool:
   - Thread-safe by default
   - Manages multiple connections efficiently
   - Clone is cheap

4. SQLx queries:
   - $1, $2, $3 = positional parameters (prevents SQL injection!)
   - .bind() = binds values to parameters
   - .fetch_all() = gets all rows
   - .fetch_one() = gets exactly one row
   - .fetch_optional() = gets zero or one row

5. Result<T, E> - Rust's error handling:
   - .map_err() = transforms error types
   - ? operator = propagates errors up
*/