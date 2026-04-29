use crate::bootstrap::config::StorageConfig;
use bytes::Bytes;
use reqwest::Client;
use std::time::Duration;
use tracing::error;
use uuid::Uuid;

const EVENT_IMAGE_MAX_BYTES: usize = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES: &[&str] = &["image/jpeg", "image/png", "image/webp"];

#[derive(Debug)]
pub enum StorageError {
    NotConfigured,
    InvalidContentType(String),
    FileTooLarge(usize),
    UploadFailed(String),
    Upload(String),
    Http(reqwest::Error),
}

impl std::fmt::Display for StorageError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            StorageError::NotConfigured => write!(f, "storage service not configured"),
            StorageError::InvalidContentType(ct) => write!(f, "Tipo di file non supportato: {ct}"),
            StorageError::FileTooLarge(size) => {
                write!(f, "File troppo grande ({size} bytes, max 5 MB)")
            }
            StorageError::UploadFailed(msg) => write!(f, "Upload fallito: {msg}"),
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

// ─── Struct-based service for panorama uploads ────────────────────────────────

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
            Uuid::new_v4(),
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

// ─── Standalone function for event image uploads (used by event_image_controller) ─

fn ext_for(content_type: &str) -> &str {
    match content_type {
        "image/png" => "png",
        "image/webp" => "webp",
        _ => "jpg",
    }
}

pub async fn upload_event_image(
    client: &reqwest::Client,
    supabase_url: &str,
    service_role_key: &str,
    bucket: &str,
    club_id: Uuid,
    bytes: Bytes,
    content_type: &str,
) -> Result<String, StorageError> {
    let content_type = content_type.split(';').next().unwrap_or("").trim();
    if !ALLOWED_TYPES.contains(&content_type) {
        return Err(StorageError::InvalidContentType(content_type.to_string()));
    }

    if bytes.len() > EVENT_IMAGE_MAX_BYTES {
        return Err(StorageError::FileTooLarge(bytes.len()));
    }

    let file_name = format!("{}/{}.{}", club_id, Uuid::new_v4(), ext_for(content_type));
    let upload_url = format!(
        "{}/storage/v1/object/{}/{}",
        supabase_url, bucket, file_name
    );

    let response = client
        .put(&upload_url)
        .header("Authorization", format!("Bearer {}", service_role_key))
        .header("Content-Type", content_type)
        .header("x-upsert", "true")
        .body(bytes)
        .send()
        .await
        .map_err(|e| StorageError::UploadFailed(e.to_string()))?;

    if !response.status().is_success() {
        let status = response.status().as_u16();
        let body = response.text().await.unwrap_or_default();
        return Err(StorageError::UploadFailed(format!("HTTP {status}: {body}")));
    }

    let public_url = format!(
        "{}/storage/v1/object/public/{}/{}",
        supabase_url, bucket, file_name
    );

    Ok(public_url)
}
