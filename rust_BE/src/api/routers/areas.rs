use std::sync::Arc;

use axum::{routing::get, Router};

use crate::bootstrap::state::AppState;
use crate::controllers::area_controller::{
    assign_table_area, create_area, delete_area, list_areas_by_club, list_my_areas, update_area,
};

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/clubs/:club_id/areas", get(list_areas_by_club))
        .route("/owner/areas", get(list_my_areas).post(create_area))
        .route("/owner/areas/:area_id", axum::routing::patch(update_area).delete(delete_area))
        .route("/owner/tables/:table_id/area", axum::routing::patch(assign_table_area))
}
