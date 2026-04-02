use crate::models::Claims;
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use std::time::{SystemTime, UNIX_EPOCH};
use uuid::Uuid;

const TOKEN_EXPIRATION_HOURS: u64 = 24; // 24 hours

/// Generate a JWT token for a user or club owner
pub fn generate_token(user_id: Uuid, email: String, role: String, secret: &str) -> Result<String, jsonwebtoken::errors::Error> {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("Time went backwards")
        .as_secs() as usize;

    let expiration = now + (TOKEN_EXPIRATION_HOURS * 3600) as usize;

    let claims = Claims {
        sub: user_id.to_string(),
        email,
        role,
        exp: expiration,
        iat: now,
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_ref()),
    )
}

/// Validate and decode a JWT token
pub fn validate_token(token: &str, secret: &str) -> Result<Claims, jsonwebtoken::errors::Error> {
    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_ref()),
        &Validation::default(),
    )?;

    Ok(token_data.claims)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_and_validate_token() {
        let secret = "test_secret";
        let user_id = Uuid::new_v4();
        let email = "test@example.com".to_string();

        let token = generate_token(user_id, email.clone(), "user".to_string(), secret).unwrap();
        let claims = validate_token(&token, secret).unwrap();

        assert_eq!(claims.sub, user_id.to_string());
        assert_eq!(claims.email, email);
        assert_eq!(claims.role, "user");
    }

    #[test]
    fn test_club_owner_token() {
        let secret = "test_secret";
        let owner_id = Uuid::new_v4();
        let email = "owner@club.com".to_string();

        let token = generate_token(owner_id, email.clone(), "club_owner".to_string(), secret).unwrap();
        let claims = validate_token(&token, secret).unwrap();

        assert_eq!(claims.sub, owner_id.to_string());
        assert_eq!(claims.role, "club_owner");
    }
}
