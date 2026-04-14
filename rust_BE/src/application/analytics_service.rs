use chrono::Utc;
use serde_json::{json, Map, Value};
use uuid::Uuid;

use crate::bootstrap::config::AppConfig;

pub fn build_properties(
    config: &AppConfig,
    aggregate_type: Option<&str>,
    aggregate_id: Option<Uuid>,
    extra: Value,
) -> Value {
    let mut props = match extra {
        Value::Object(map) => map,
        _ => Map::new(),
    };

    props.insert("source".to_string(), json!("backend"));
    props.insert("service_name".to_string(), json!(config.analytics.service_name));
    props.insert("environment".to_string(), json!(config.analytics.environment));
    props.insert("emitted_at".to_string(), json!(Utc::now().to_rfc3339()));
    if let Some(kind) = aggregate_type {
        props.insert("aggregate_type".to_string(), json!(kind));
    }
    if let Some(id) = aggregate_id {
        props.insert("aggregate_id".to_string(), json!(id.to_string()));
    }

    Value::Object(props)
}
