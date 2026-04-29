use std::sync::Arc;

use axum::{routing::get, Router};

use crate::bootstrap::state::AppState;
use crate::controllers::club_owner_controller::{
    add_my_club_image, add_table_image_handler, checkin_handler, create_club_event,
    create_club_table, create_manual_reservation_handler, create_my_club_stripe_onboarding_link,
    delete_club_event, delete_my_club_image, delete_table_image_handler,
    get_event_reservations_handler, get_my_club, get_my_club_events, get_my_club_images,
    get_my_club_stripe_status, get_my_club_tables, get_owner_stats_handler,
    get_table_images_handler, scan_code_handler, update_club_event, update_club_marzipano_config_handler,
    update_event_marzipano_config_handler, update_my_club, update_reservation_status_handler,
    upload_panorama_handler,
};
use crate::controllers::event_image_controller::upload_event_image;

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/owner/club", get(get_my_club).put(update_my_club))
        .route("/owner/club/stripe/status", get(get_my_club_stripe_status))
        .route(
            "/owner/club/stripe/connect",
            axum::routing::post(create_my_club_stripe_onboarding_link),
        )
        .route(
            "/owner/club/images",
            get(get_my_club_images).post(add_my_club_image),
        )
        .route(
            "/owner/club/images/:id",
            axum::routing::delete(delete_my_club_image),
        )
        .route(
            "/owner/club/marzipano-config",
            axum::routing::put(update_club_marzipano_config_handler),
        )
        .route(
            "/owner/events",
            get(get_my_club_events).post(create_club_event),
        )
        .route(
            "/owner/events/image",
            axum::routing::post(upload_event_image),
        )
        .route(
            "/owner/events/:event_id",
            axum::routing::put(update_club_event).delete(delete_club_event),
        )
        .route(
            "/owner/events/:event_id/tables",
            get(get_my_club_tables).post(create_club_table),
        )
        .route(
            "/owner/events/:event_id/marzipano-config",
            axum::routing::put(update_event_marzipano_config_handler),
        )
        .route(
            "/owner/events/:event_id/reservations",
            get(get_event_reservations_handler),
        )
        .route(
            "/owner/events/:event_id/reservations/manual",
            axum::routing::post(create_manual_reservation_handler),
        )
        .route(
            "/owner/reservations/:id/status",
            axum::routing::patch(update_reservation_status_handler),
        )
        .route(
            "/owner/tables/:id/images",
            get(get_table_images_handler).post(add_table_image_handler),
        )
        .route(
            "/owner/table-images/:id",
            axum::routing::delete(delete_table_image_handler),
        )
        .merge(
            Router::new()
                .route(
                    "/owner/uploads/panorama",
                    axum::routing::post(upload_panorama_handler),
                )
                .layer(axum::extract::DefaultBodyLimit::max(50 * 1024 * 1024)),
        )
        .route("/owner/scan/:code", get(scan_code_handler))
        .route("/owner/checkin/:code", axum::routing::post(checkin_handler))
        .route("/owner/stats", get(get_owner_stats_handler))
}
