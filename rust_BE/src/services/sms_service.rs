use reqwest::Client;
use serde::Deserialize;
use tracing::{info, warn};

use crate::bootstrap::config::AppConfig;

#[derive(Debug, Deserialize)]
struct TwilioVerifyResponse {
    sid: String,
    status: String,
}

#[derive(Debug, Deserialize)]
struct TwilioVerifyCheckResponse {
    status: String,
    valid: bool,
}

fn is_app_review_bypass_target(config: &AppConfig, phone_number: &str) -> bool {
    config.notifications.app_review_bypass_enabled
        && config
            .notifications
            .app_review_bypass_phone_numbers
            .iter()
            .any(|allowed| allowed == phone_number)
}

/// Send verification SMS using Twilio Verify API
/// This function initiates the verification - Twilio generates and sends the code
pub async fn send_verification_sms(
    config: &AppConfig,
    phone_number: &str,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    if is_app_review_bypass_target(config, phone_number) {
        info!(%phone_number, "App Review SMS bypass active; skipping Twilio send");
        return Ok(());
    }

    let account_sid = config.notifications.twilio_account_sid.clone();
    let auth_token = config.notifications.twilio_auth_token.clone();
    let verify_service_sid = config.notifications.twilio_verify_service_sid.clone();

    // If Twilio is not configured, just log (for development)
    if account_sid.is_none() || auth_token.is_none() || verify_service_sid.is_none() {
        println!(
            "⚠️  Twilio Verify not configured. Would send verification to: {}",
            phone_number
        );
        println!("   To enable SMS, set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_VERIFY_SERVICE_SID");
        println!("   📱 Development mode: Use code '123456' for testing");
        return Ok(());
    }

    let account_sid = account_sid.unwrap();
    let auth_token = auth_token.unwrap();
    let verify_service_sid = verify_service_sid.unwrap();

    let client = Client::new();
    let url = format!(
        "https://verify.twilio.com/v2/Services/{}/Verifications",
        verify_service_sid
    );

    let params = [("To", phone_number), ("Channel", "sms")];

    let response = client
        .post(&url)
        .basic_auth(&account_sid, Some(&auth_token))
        .form(&params)
        .send()
        .await?;

    if response.status().is_success() {
        let twilio_response: TwilioVerifyResponse = response.json().await?;
        tracing::info!(sid = %twilio_response.sid, status = %twilio_response.status, "Verification SMS sent");
        Ok(())
    } else {
        let error_text = response.text().await?;
        tracing::error!(error = %error_text, "Failed to send verification SMS via Twilio");
        Err(format!("Twilio Verify API error: {}", error_text).into())
    }
}

/// Verify the code using Twilio Verify API
pub async fn verify_code(
    config: &AppConfig,
    phone_number: &str,
    code: &str,
) -> Result<bool, Box<dyn std::error::Error + Send + Sync>> {
    if is_app_review_bypass_target(config, phone_number) {
        let Some(expected_code) = config.notifications.app_review_bypass_code.as_deref() else {
            warn!(%phone_number, "App Review SMS bypass matched but APP_REVIEW_BYPASS_CODE is missing");
            return Ok(false);
        };

        info!(%phone_number, "App Review SMS bypass verification attempted");
        return Ok(code == expected_code);
    }

    let account_sid = config.notifications.twilio_account_sid.clone();
    let auth_token = config.notifications.twilio_auth_token.clone();
    let verify_service_sid = config.notifications.twilio_verify_service_sid.clone();

    // If Twilio is not configured, accept '123456' for development
    if account_sid.is_none() || auth_token.is_none() || verify_service_sid.is_none() {
        println!("⚠️  Twilio Verify not configured. Development mode active.");
        println!("   Accepting code '123456' for testing");
        return Ok(code == "123456");
    }

    let account_sid = account_sid.unwrap();
    let auth_token = auth_token.unwrap();
    let verify_service_sid = verify_service_sid.unwrap();

    let client = Client::new();
    let url = format!(
        "https://verify.twilio.com/v2/Services/{}/VerificationCheck",
        verify_service_sid
    );

    let params = [("To", phone_number), ("Code", code)];

    let response = client
        .post(&url)
        .basic_auth(&account_sid, Some(&auth_token))
        .form(&params)
        .send()
        .await?;

    if response.status().is_success() {
        let twilio_response: TwilioVerifyCheckResponse = response.json().await?;
        tracing::info!(status = %twilio_response.status, valid = %twilio_response.valid, "Verification check completed");
        Ok(twilio_response.valid && twilio_response.status == "approved")
    } else {
        let error_text = response.text().await?;
        tracing::error!(error = %error_text, "Failed to verify code via Twilio");
        Ok(false) // Return false instead of error for invalid codes
    }
}
