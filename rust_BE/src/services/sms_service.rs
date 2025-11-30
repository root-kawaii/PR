use reqwest::Client;
use serde::Deserialize;
use std::env;

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

/// Send verification SMS using Twilio Verify API
/// This function initiates the verification - Twilio generates and sends the code
pub async fn send_verification_sms(phone_number: &str) -> Result<(), Box<dyn std::error::Error>> {
    // Get Twilio credentials from environment
    let account_sid = env::var("TWILIO_ACCOUNT_SID").ok();
    let auth_token = env::var("TWILIO_AUTH_TOKEN").ok();
    let verify_service_sid = env::var("TWILIO_VERIFY_SERVICE_SID").ok();

    // If Twilio is not configured, just log (for development)
    if account_sid.is_none() || auth_token.is_none() || verify_service_sid.is_none() {
        println!("⚠️  Twilio Verify not configured. Would send verification to: {}", phone_number);
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

    let params = [
        ("To", phone_number),
        ("Channel", "sms"),
    ];

    let response = client
        .post(&url)
        .basic_auth(&account_sid, Some(&auth_token))
        .form(&params)
        .send()
        .await?;

    if response.status().is_success() {
        let twilio_response: TwilioVerifyResponse = response.json().await?;
        println!("✅ Verification SMS sent successfully. SID: {}, Status: {}", twilio_response.sid, twilio_response.status);
        Ok(())
    } else {
        let error_text = response.text().await?;
        eprintln!("❌ Failed to send verification SMS: {}", error_text);
        Err(format!("Twilio Verify API error: {}", error_text).into())
    }
}

/// Verify the code using Twilio Verify API
pub async fn verify_code(phone_number: &str, code: &str) -> Result<bool, Box<dyn std::error::Error>> {
    // Get Twilio credentials from environment
    let account_sid = env::var("TWILIO_ACCOUNT_SID").ok();
    let auth_token = env::var("TWILIO_AUTH_TOKEN").ok();
    let verify_service_sid = env::var("TWILIO_VERIFY_SERVICE_SID").ok();

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

    let params = [
        ("To", phone_number),
        ("Code", code),
    ];

    let response = client
        .post(&url)
        .basic_auth(&account_sid, Some(&auth_token))
        .form(&params)
        .send()
        .await?;

    if response.status().is_success() {
        let twilio_response: TwilioVerifyCheckResponse = response.json().await?;
        println!("✅ Verification check: Status: {}, Valid: {}", twilio_response.status, twilio_response.valid);
        Ok(twilio_response.valid && twilio_response.status == "approved")
    } else {
        let error_text = response.text().await?;
        eprintln!("❌ Failed to verify code: {}", error_text);
        Ok(false) // Return false instead of error for invalid codes
    }
}
