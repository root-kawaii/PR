use bytes::Bytes;
use uuid::Uuid;

const MAX_BYTES: usize = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES: &[&str] = &["image/jpeg", "image/png", "image/webp"];

#[derive(Debug)]
pub enum StorageError {
    InvalidContentType(String),
    FileTooLarge(usize),
    UploadFailed(String),
}

impl std::fmt::Display for StorageError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::InvalidContentType(ct) => write!(f, "Tipo di file non supportato: {ct}"),
            Self::FileTooLarge(size) => write!(f, "File troppo grande ({size} bytes, max 5 MB)"),
            Self::UploadFailed(msg) => write!(f, "Upload fallito: {msg}"),
        }
    }
}

fn ext_for(content_type: &str) -> &str {
    match content_type {
        "image/png" => "png",
        "image/webp" => "webp",
        _ => "jpg",
    }
}

/// Upload an image to Supabase Storage and return its public URL.
pub async fn upload_event_image(
    client: &reqwest::Client,
    supabase_url: &str,
    service_role_key: &str,
    bucket: &str,
    club_id: Uuid,
    bytes: Bytes,
    content_type: &str,
) -> Result<String, StorageError> {
    // Validate content type
    let content_type = content_type.split(';').next().unwrap_or("").trim();
    if !ALLOWED_TYPES.contains(&content_type) {
        return Err(StorageError::InvalidContentType(content_type.to_string()));
    }

    // Validate size
    if bytes.len() > MAX_BYTES {
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
