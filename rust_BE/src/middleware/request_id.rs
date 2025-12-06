use axum::{
    extract::Request,
    middleware::Next,
    response::Response,
};
use tower_http::request_id::{MakeRequestUuid, PropagateRequestIdLayer, SetRequestIdLayer};
use uuid::Uuid;

/// Middleware that generates a unique request ID for each HTTP request
/// and adds it to the tracing span for log correlation.
///
/// The request ID is:
/// - Generated as a UUID v4 if not provided by the client
/// - Added to the response headers as `x-request-id`
/// - Included in all log messages within the request's span
pub fn request_id_layer() -> (SetRequestIdLayer<MakeRequestUuid>, PropagateRequestIdLayer) {
    let set_request_id = SetRequestIdLayer::new(
        "x-request-id".parse().unwrap(),
        MakeRequestUuid,
    );

    let propagate_request_id = PropagateRequestIdLayer::new(
        "x-request-id".parse().unwrap(),
    );

    (set_request_id, propagate_request_id)
}

/// Middleware function that creates a tracing span for each request
/// including request_id, HTTP method, and URI path.
pub async fn trace_request(request: Request, next: Next) -> Response {
    let request_id = request
        .headers()
        .get("x-request-id")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.parse::<Uuid>().ok())
        .map(|uuid| uuid.to_string())
        .unwrap_or_else(|| "unknown".to_string());

    let method = request.method().clone();
    let uri = request.uri().clone();

    // Create a span that will be attached to all logs within this request
    let span = tracing::info_span!(
        "http_request",
        request_id = %request_id,
        method = %method,
        uri = %uri.path(),
    );

    let _guard = span.enter();

    next.run(request).await
}
