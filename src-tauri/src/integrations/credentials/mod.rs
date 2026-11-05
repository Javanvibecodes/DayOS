use serde::{Deserialize, Serialize};

use crate::integrations::types::ApiResult;

#[cfg(windows)]
mod dpapi;
#[cfg(not(windows))]
mod unsupported;

/// OAuth token material. This type must never cross the Tauri boundary or be
/// written to SQLite, settings, logs, or renderer state.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenSet {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub token_type: String,
    pub scope: String,
    /// Unix timestamp (seconds) after which the access token should be refreshed.
    pub expires_at: i64,
}

impl TokenSet {
    pub fn is_expiring(&self) -> bool {
        chrono::Utc::now().timestamp() + 60 >= self.expires_at
    }

    pub fn scopes(&self) -> Vec<String> {
        self.scope
            .split_whitespace()
            .filter(|scope| !scope.is_empty())
            .map(|scope| scope.to_string())
            .collect()
    }
}

pub trait CredentialStore: Send + Sync {
    fn load(&self, provider: &str) -> ApiResult<Option<TokenSet>>;
    fn save(&self, provider: &str, token: &TokenSet) -> ApiResult<()>;
    fn delete(&self, provider: &str) -> ApiResult<()>;
}

/// Build the platform credential store beside the DayOS database.
pub fn create_store(db_path: &std::path::Path) -> Box<dyn CredentialStore> {
    let directory = db_path
        .parent()
        .map(|parent| parent.join("credentials"))
        .unwrap_or_else(|| std::path::PathBuf::from("credentials"));

    #[cfg(windows)]
    {
        Box::new(dpapi::DpapiCredentialStore::new(directory))
    }

    #[cfg(not(windows))]
    {
        Box::new(unsupported::UnsupportedCredentialStore::new(directory))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn expiry_uses_a_refresh_margin() {
        let fresh = TokenSet {
            access_token: "a".to_string(),
            refresh_token: None,
            token_type: "Bearer".to_string(),
            scope: "openid".to_string(),
            expires_at: chrono::Utc::now().timestamp() + 3600,
        };
        let expiring = TokenSet {
            expires_at: chrono::Utc::now().timestamp() + 30,
            ..fresh.clone()
        };

        assert!(!fresh.is_expiring());
        assert!(expiring.is_expiring());
        assert_eq!(fresh.scopes(), vec!["openid".to_string()]);
    }
}
