use reqwest::Client;
use tracing::{error, info, warn};

/// Sends a plain SMS via the Twilio Messages API.
///
/// Requires:
///   - `TWILIO_ACCOUNT_SID`
///   - `TWILIO_AUTH_TOKEN`
///   - `TWILIO_PHONE_NUMBER` (your Twilio "from" number, e.g. +15005550006 for test)
///
/// Fire-and-forget — logs errors but never panics or blocks the caller.
pub async fn send_sms(to: &str, body: &str) {
    let account_sid = match std::env::var("TWILIO_ACCOUNT_SID")
        .ok()
        .filter(|s| !s.is_empty())
    {
        Some(s) => s,
        None => {
            info!(to = %to, "SMS skipped (TWILIO_ACCOUNT_SID not set)");
            return;
        }
    };
    let auth_token = match std::env::var("TWILIO_AUTH_TOKEN")
        .ok()
        .filter(|s| !s.is_empty())
    {
        Some(s) => s,
        None => return,
    };
    let from = match std::env::var("TWILIO_PHONE_NUMBER")
        .ok()
        .filter(|s| !s.is_empty())
    {
        Some(s) => s,
        None => {
            warn!("SMS skipped: TWILIO_PHONE_NUMBER not set");
            return;
        }
    };

    let url = format!(
        "https://api.twilio.com/2010-04-01/Accounts/{}/Messages.json",
        account_sid
    );

    let client = Client::new();
    match client
        .post(&url)
        .basic_auth(&account_sid, Some(&auth_token))
        .form(&[("To", to), ("From", from.as_str()), ("Body", body)])
        .send()
        .await
    {
        Ok(resp) if resp.status().is_success() => {
            info!(to = %to, "SMS sent successfully");
        }
        Ok(resp) => {
            warn!(to = %to, status = %resp.status(), "SMS returned non-success status");
        }
        Err(e) => {
            error!(to = %to, error = %e, "Failed to send SMS");
        }
    }
}

/// Sends a push notification via the Expo Push API.
///
/// `token` must be a valid Expo push token, e.g. "ExponentPushToken[...]".
/// No API key required for Expo's free push service.
///
/// Fire-and-forget — logs errors but never panics or blocks the caller.
pub async fn send_push_notification(token: &str, title: &str, body: &str) {
    if token.is_empty() {
        return;
    }

    let payload = serde_json::json!({
        "to": token,
        "title": title,
        "body": body,
        "sound": "default",
    });

    let client = Client::new();
    match client
        .post("https://exp.host/--/api/v2/push/send")
        .json(&payload)
        .send()
        .await
    {
        Ok(resp) if resp.status().is_success() => {
            info!("Push notification sent");
        }
        Ok(resp) => {
            warn!(status = %resp.status(), "Push notification returned non-success status");
        }
        Err(e) => {
            error!(error = %e, "Failed to send push notification");
        }
    }
}
