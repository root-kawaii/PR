use crate::application::club_service as club_persistence;
use crate::application::event_service as event_persistence;
use crate::application::outbox_service;
use crate::middleware::auth::ClubOwnerUser;
use crate::models::{
    is_valid_event_image_url, normalize_entry_type, normalize_event_price,
    normalize_ticketing_mode, AppState, CreateEventRequest, Event, EventResponse,
    UpdateEventRequest,
};
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use chrono::NaiveDate;
use serde::Deserialize;
use serde::Serialize;
use std::sync::Arc;
use tracing::warn;
use uuid::Uuid;

fn apply_club_fallback(
    mut response: EventResponse,
    club: Option<&club_persistence::ClubEventFallbackData>,
    has_reservable_areas: Option<bool>,
) -> EventResponse {
    if let Some(club) = club {
        if response.venue.trim().is_empty() {
            response.venue = club.name.clone();
        }

        if response.marzipano_scenes.is_none() {
            response.marzipano_scenes = club.marzipano_config.clone();
        }

        response.club_name = Some(club.name.clone());
        response.club_address = club.address.as_ref().and_then(|address| {
            let trimmed = address.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed.to_string())
            }
        });
    }

    if let Some(has_reservable_areas) = has_reservable_areas {
        response.has_reservable_areas = has_reservable_areas;
    }

    response
}

#[derive(Serialize)]
pub struct EventsResponse {
    pub events: Vec<EventResponse>,
}

#[derive(Debug, Deserialize)]
pub struct PublicEventQueryParams {
    #[serde(default = "default_limit")]
    pub limit: i64,
    #[serde(default)]
    pub offset: i64,
    pub from_date: Option<NaiveDate>,
}

fn default_limit() -> i64 {
    50
}

/// Get all events (paginated, default limit=50)
pub async fn get_all_events(
    State(state): State<Arc<AppState>>,
    Query(query): Query<PublicEventQueryParams>,
) -> Result<Json<EventsResponse>, StatusCode> {
    match event_persistence::get_all_events(
        &state.read_db_pool,
        query.limit,
        query.offset,
        query.from_date,
    )
    .await
    {
        Ok(events) => {
            if let Err(error) = outbox_service::enqueue_analytics_event(
                &state.db_pool,
                &state.config,
                "events_list_viewed",
                None,
                Some("event"),
                None,
                serde_json::json!({
                    "limit": query.limit,
                    "offset": query.offset,
                    "from_date": query.from_date,
                    "result_count": events.len(),
                    "outcome": "success",
                }),
            )
            .await
            {
                warn!(error = %error, "Failed to enqueue events list analytics event");
            }

            let event_ids: Vec<Uuid> = events.iter().map(|e| e.id).collect();
            let genres_map =
                event_persistence::get_genres_for_events(&state.read_db_pool, &event_ids)
                    .await
                    .unwrap_or_default();

            let mut responses =
                event_responses_with_club_fallback(&state, events).await;
            for r in responses.iter_mut() {
                if let Ok(id) = Uuid::parse_str(&r.id) {
                    r.genres = genres_map.get(&id).cloned().unwrap_or_default();
                }
            }

            Ok(Json(EventsResponse { events: responses }))
        }
        Err(error) => {
            warn!(error = %error, "Failed to load events list");
            let _ = outbox_service::enqueue_analytics_error(
                &state.db_pool,
                &state.config,
                "events_list_view_failed",
                None,
                Some("event"),
                None,
                &error.to_string(),
                serde_json::json!({
                    "limit": query.limit,
                    "offset": query.offset,
                    "from_date": query.from_date,
                }),
            )
            .await;
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Get a single event by ID
pub async fn get_event(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<EventResponse>, StatusCode> {
    let event_id = Uuid::parse_str(&id).map_err(|_| StatusCode::BAD_REQUEST)?;

    match event_persistence::get_event_by_id(&state.read_db_pool, event_id).await {
        Ok(Some(event)) => {
            if let Err(error) = outbox_service::enqueue_analytics_event(
                &state.db_pool,
                &state.config,
                "event_detail_viewed",
                None,
                Some("event"),
                Some(event_id),
                serde_json::json!({
                    "event_id": event_id,
                    "outcome": "success",
                }),
            )
            .await
            {
                warn!(error = %error, event_id = %event_id, "Failed to enqueue event detail analytics event");
            }

            let genres = event_persistence::get_event_genres(&state.read_db_pool, event_id)
                .await
                .unwrap_or_default();

            let mut response = event_response_with_club_fallback(&state, event).await;
            response.genres = genres;
            Ok(Json(response))
        }
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(error) => {
            warn!(error = %error, event_id = %event_id, "Failed to load event detail");
            let _ = outbox_service::enqueue_analytics_error(
                &state.db_pool,
                &state.config,
                "event_detail_view_failed",
                None,
                Some("event"),
                Some(event_id),
                &error.to_string(),
                serde_json::json!({
                    "event_id": event_id,
                }),
            )
            .await;
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Create a new event (requires club_owner JWT)
pub async fn create_event(
    _: ClubOwnerUser,
    State(state): State<Arc<AppState>>,
    Json(mut payload): Json<CreateEventRequest>,
) -> Result<(StatusCode, Json<EventResponse>), StatusCode> {
    if !is_valid_event_image_url(&payload.image) {
        return Err(StatusCode::BAD_REQUEST);
    }

    payload.price = normalize_event_price(payload.price);
    payload.entry_type = Some(normalize_entry_type(
        payload.entry_type.clone(),
        payload.price.as_deref(),
    ));
    payload.ticketing_mode = Some(normalize_ticketing_mode(
        payload.ticketing_mode.clone(),
        payload.entry_type.as_deref(),
        payload.price.as_deref(),
    ));

    let genre_ids = payload.genre_ids.clone().unwrap_or_default();

    match event_persistence::create_event(&state.db_pool, payload).await {
        Ok(event) => {
            let event = if event_persistence::refresh_event_has_reservable_areas(&state.db_pool, event.id)
                .await
                .is_ok()
            {
                event_persistence::get_event_by_id(&state.db_pool, event.id)
                    .await
                    .ok()
                    .flatten()
                    .unwrap_or(event)
            } else {
                event
            };
            if !genre_ids.is_empty() {
                let _ =
                    event_persistence::set_event_genres(&state.db_pool, event.id, &genre_ids).await;
            }
            let genres = event_persistence::get_event_genres(&state.db_pool, event.id)
                .await
                .unwrap_or_default();
            let mut response = event_response_with_club_fallback(&state, event).await;
            response.genres = genres;
            Ok((StatusCode::CREATED, Json(response)))
        }
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

/// Update an event (requires club_owner JWT)
pub async fn update_event(
    _: ClubOwnerUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(mut payload): Json<UpdateEventRequest>,
) -> Result<Json<EventResponse>, StatusCode> {
    let event_id = Uuid::parse_str(&id).map_err(|_| StatusCode::BAD_REQUEST)?;
    if let Some(image) = payload.image.as_deref() {
        if !is_valid_event_image_url(image) {
            return Err(StatusCode::BAD_REQUEST);
        }
    }
    payload.price = normalize_event_price(payload.price);
    if payload.price.is_some() || payload.entry_type.is_some() {
        payload.entry_type = Some(normalize_entry_type(
            payload.entry_type.clone(),
            payload.price.as_deref(),
        ));
    }
    if payload.price.is_some() || payload.entry_type.is_some() || payload.ticketing_mode.is_some() {
        payload.ticketing_mode = Some(normalize_ticketing_mode(
            payload.ticketing_mode.clone(),
            payload.entry_type.as_deref(),
            payload.price.as_deref(),
        ));
    }
    let genre_ids = payload.genre_ids.clone();

    match event_persistence::update_event(&state.db_pool, event_id, payload).await {
        Ok(Some(event)) => {
            let event = if event_persistence::refresh_event_has_reservable_areas(&state.db_pool, event.id)
                .await
                .is_ok()
            {
                event_persistence::get_event_by_id(&state.db_pool, event.id)
                    .await
                    .ok()
                    .flatten()
                    .unwrap_or(event)
            } else {
                event
            };
            if let Some(ids) = genre_ids {
                let _ = event_persistence::set_event_genres(&state.db_pool, event_id, &ids).await;
            }
            let genres = event_persistence::get_event_genres(&state.db_pool, event_id)
                .await
                .unwrap_or_default();
            let mut response = event_response_with_club_fallback(&state, event).await;
            response.genres = genres;
            Ok(Json(response))
        }
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

/// Build an `EventResponse`, filling `marzipano_scenes` from the club's
/// tour config when the event itself has none (event override > club default).
pub(crate) async fn event_response_with_club_fallback(
    state: &AppState,
    event: Event,
) -> EventResponse {
    let fallback_reservable = if event.has_reservable_areas.is_none() {
        event_persistence::get_public_reservable_flags_for_events(&state.read_db_pool, &[event.id])
            .await
            .ok()
            .and_then(|map| map.get(&event.id).copied())
    } else {
        event.has_reservable_areas
    };

    if let Some(club_id) = event.club_id {
        if let Ok(Some(club)) = club_persistence::get_club_by_id(&state.read_db_pool, club_id).await
        {
            return apply_club_fallback(
                EventResponse::from(event),
                Some(&club_persistence::ClubEventFallbackData {
                    name: club.name,
                    address: club.address,
                    marzipano_config: club.marzipano_config,
                }),
                fallback_reservable,
            );
        }
    }
    apply_club_fallback(EventResponse::from(event), None, fallback_reservable)
}

/// Build a batch of `EventResponse`s, filling club-derived venue/details and
/// `marzipano_scenes` in a single query to avoid N+1.
///
/// On batch lookup failure responses are returned without fallback applied —
/// this enrichment is non-essential, not worth a 500.
pub(crate) async fn event_responses_with_club_fallback(
    state: &AppState,
    events: Vec<Event>,
) -> Vec<EventResponse> {
    let club_ids: Vec<Uuid> = events
        .iter()
        .filter_map(|e| e.club_id)
        .collect::<std::collections::HashSet<_>>()
        .into_iter()
        .collect();

    let club_data = if club_ids.is_empty() {
        std::collections::HashMap::new()
    } else {
        match club_persistence::get_event_fallback_data_for_clubs(
            &state.read_db_pool,
            &club_ids,
        )
        .await
        {
            Ok(map) => map,
            Err(error) => {
                warn!(error = %error, "Failed to load club fallback data for events");
                std::collections::HashMap::new()
            }
        }
    };

    let fallback_event_ids: Vec<Uuid> = events
        .iter()
        .filter(|event| event.has_reservable_areas.is_none())
        .map(|event| event.id)
        .collect();

    let reservable_flags = if fallback_event_ids.is_empty() {
        std::collections::HashMap::new()
    } else {
        match event_persistence::get_public_reservable_flags_for_events(
            &state.read_db_pool,
            &fallback_event_ids,
        )
        .await
        {
            Ok(map) => map,
            Err(error) => {
                warn!(error = %error, "Failed to load public reservable flags for events");
                std::collections::HashMap::new()
            }
        }
    };

    events
        .into_iter()
        .map(|event| {
            let club_id = event.club_id;
            let club = club_id.and_then(|cid| club_data.get(&cid));
            let has_reservable_areas = event
                .has_reservable_areas
                .or_else(|| reservable_flags.get(&event.id).copied());
            apply_club_fallback(EventResponse::from(event), club, has_reservable_areas)
        })
        .collect()
}

/// Delete an event (requires club_owner JWT)
pub async fn delete_event(
    _: ClubOwnerUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<StatusCode, StatusCode> {
    let event_id = Uuid::parse_str(&id).map_err(|_| StatusCode::BAD_REQUEST)?;

    match event_persistence::delete_event(&state.db_pool, event_id).await {
        Ok(true) => Ok(StatusCode::NO_CONTENT),
        Ok(false) => Err(StatusCode::NOT_FOUND),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}
