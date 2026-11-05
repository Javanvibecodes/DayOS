use std::path::PathBuf;

use super::{CredentialStore, TokenSet};
use crate::integrations::types::{ApiError, ApiResult};

pub struct UnsupportedCredentialStore {
    #[allow(dead_code)]
    directory: PathBuf,
}

impl UnsupportedCredentialStore {
    pub fn new(directory: PathBuf) -> Self {
        Self { directory }
    }

    fn unsupported() -> ApiError {
        ApiError::not_configured(
            "Secure integration credential storage requires Windows Data Protection API support.",
        )
    }
}

impl CredentialStore for UnsupportedCredentialStore {
    fn load(&self, _provider: &str) -> ApiResult<Option<TokenSet>> {
        Err(Self::unsupported())
    }

    fn save(&self, _provider: &str, _token: &TokenSet) -> ApiResult<()> {
        Err(Self::unsupported())
    }

    fn delete(&self, _provider: &str) -> ApiResult<()> {
        Err(Self::unsupported())
    }
}
