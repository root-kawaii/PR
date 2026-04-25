//! Thin Supabase Storage client used to persist user-uploaded assets
//! (e.g. 360° panorama images) and return their public URLs.
//!
//! The backend holds the `SUPABASE_SERVICE_ROLE_KEY` and uploads on behalf of
//! authenticated owners. The target bucket must exist and be public-read so
//! the mobile WebView can load the image directly.

use crate::bootstrap::config::StorageConfig;
use reqwest::Client;
use std::time::Duration;
use tracing::error;

#[derive(Debug)]
pub enum StorageError {
    NotConfigured,
    Upload(String),
    Http(reqwest::Error),
}

impl std::fmt::Display for StorageError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            StorageError::NotConfigured => write!(f, "storage service not configured"),
            StorageError::Upload(msg) => write!(f, "upload rejected: {}", msg),
            StorageError::Http(err) => write!(f, "network error: {}", err),
        }
    }
}

impl std::error::Error for StorageError {}

impl From<reqwest::Error> for StorageError {
    fn from(err: reqwest::Error) -> Self {
        StorageError::Http(err)
    }
}

pub struct StorageService {
    client: Client,
    cfg: StorageConfig,
}

pub struct UploadResult {
    pub object_key: String,
    pub public_url: String,
}

impl StorageService {
    pub fn new(cfg: StorageConfig) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(60))
            .build()
            .expect("failed to build storage http client");
        Self { client, cfg }
    }

    pub fn is_configured(&self) -> bool {
        self.cfg.supabase_url.is_some() && self.cfg.supabase_service_role_key.is_some()
    }

    pub fn max_bytes(&self) -> usize {
        self.cfg.max_panorama_bytes
    }

    /// Upload a panorama image into the configured bucket under
    /// `clubs/{club_id}/panoramas/{unique_name}` and return its public URL.
    pub async fn upload_panorama(
        &self,
        club_id: &str,
        filename: &str,
        content_type: &str,
        body: Vec<u8>,
    ) -> Result<UploadResult, StorageError> {
        let base_url = self.cfg.supabase_url.as_ref().ok_or(StorageError::NotConfigured)?;
        let service_key = self
            .cfg
            .supabase_service_role_key
            .as_ref()
            .ok_or(StorageError::NotConfigured)?;

        let safe_name = sanitize_filename(filename);
        let object_key = format!(
            "clubs/{}/panoramas/{}-{}",
            club_id,
            uuid::Uuid::new_v4(),
            safe_name
        );
        let upload_url = format!(
            "{}/storage/v1/object/{}/{}",
            base_url, self.cfg.panoramas_bucket, object_key
        );

        let response = self
            .client
            .post(&upload_url)
            .header("Authorization", format!("Bearer {}", service_key))
            .header("apikey", service_key)
            .header("Content-Type", content_type)
            .header("x-upsert", "true")
            .body(body)
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            error!(%status, %text, "Supabase upload failed");
            return Err(StorageError::Upload(format!("{}: {}", status, text)));
        }

        let public_url = format!(
            "{}/storage/v1/object/public/{}/{}",
            base_url, self.cfg.panoramas_bucket, object_key
        );

        Ok(UploadResult {
            object_key,
            public_url,
        })
    }
}

fn sanitize_filename(name: &str) -> String {
    let trimmed = name.trim();
    let base: String = trimmed
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '.' || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect();
    if base.is_empty() {
        "panorama.jpg".to_string()
    } else {
        base
    }
}
