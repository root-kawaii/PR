use reqwest::Client;
use tracing::{error, info, warn};

use crate::bootstrap::config::AppConfig;

/// Sends a plain SMS via the Twilio Messages API.
///
/// Requires:
///   - `TWILIO_ACCOUNT_SID`
///   - `TWILIO_AUTH_TOKEN`
///   - `TWILIO_PHONE_NUMBER` (your Twilio "from" number, e.g. +15005550006 for test)
///
/// Fire-and-forget — logs errors but never panics or blocks the caller.
pub async fn send_sms(
    config: &AppConfig,
    to: &str,
    body: &str,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let Some(account_sid) = config.notifications.twilio_account_sid.as_deref() else {
        info!(to = %to, "SMS skipped (TWILIO_ACCOUNT_SID not set)");
        return Ok(());
    };
    let Some(auth_token) = config.notifications.twilio_auth_token.as_deref() else {
        warn!("SMS skipped: TWILIO_AUTH_TOKEN not set");
        return Ok(());
    };
    let Some(from) = config.notifications.twilio_phone_number.as_deref() else {
        warn!("SMS skipped: TWILIO_PHONE_NUMBER not set");
        return Ok(());
    };

    let url = format!(
        "https://api.twilio.com/2010-04-01/Accounts/{}/Messages.json",
        account_sid
    );

    let client = Client::new();
    match client
        .post(&url)
        .basic_auth(&account_sid, Some(&auth_token))
        .form(&[("To", to), ("From", from), ("Body", body)])
        .send()
        .await
    {
        Ok(resp) if resp.status().is_success() => {
            info!(to = %to, "SMS sent successfully");
            Ok(())
        }
        Ok(resp) => {
            warn!(to = %to, status = %resp.status(), "SMS returned non-success status");
            Err(format!("SMS returned non-success status {}", resp.status()).into())
        }
        Err(e) => {
            error!(to = %to, error = %e, "Failed to send SMS");
            Err(Box::new(e))
        }
    }
}

/// Sends a push notification via the Expo Push API.
///
/// `token` must be a valid Expo push token, e.g. "ExponentPushToken[...]".
/// No API key required for Expo's free push service.
///
/// Fire-and-forget — logs errors but never panics or blocks the caller.
pub async fn send_push_notification(
    _config: &AppConfig,
    token: &str,
    title: &str,
    body: &str,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    if token.is_empty() {
        return Ok(());
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
            Ok(())
        }
        Ok(resp) => {
            warn!(status = %resp.status(), "Push notification returned non-success status");
            Err(format!(
                "Push notification returned non-success status {}",
                resp.status()
            )
            .into())
        }
        Err(e) => {
            error!(error = %e, "Failed to send push notification");
            Err(Box::new(e))
        }
    }
}
