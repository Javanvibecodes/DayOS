use std::fs;
use std::io::Write;
use std::path::PathBuf;
use std::ptr;

use windows_sys::Win32::Foundation::{LocalFree, HLOCAL};
use windows_sys::Win32::Security::Cryptography::{
    CryptProtectData, CryptUnprotectData, CRYPT_INTEGER_BLOB, CRYPTPROTECT_UI_FORBIDDEN,
};

use super::{CredentialStore, TokenSet};
use crate::integrations::types::{ApiError, ApiResult};

const ENTROPY: &[u8] = b"DayOS.Integration.Credentials.v1";

/// Token storage encrypted with the Windows Data Protection API.
///
/// Ciphertext is written to the DayOS app-data directory and can only be
/// decrypted by the same Windows user profile. Plaintext token material is
/// never written to disk or to the database.
pub struct DpapiCredentialStore {
    directory: PathBuf,
}

impl DpapiCredentialStore {
    pub fn new(directory: PathBuf) -> Self {
        Self { directory }
    }

    fn path_for(&self, provider: &str) -> PathBuf {
        let safe_name: String = provider
            .chars()
            .map(|character| {
                if character.is_ascii_alphanumeric() || character == '-' || character == '_' {
                    character
                } else {
                    '_'
                }
            })
            .collect();

        self.directory.join(format!("{}.bin", safe_name))
    }
}

impl CredentialStore for DpapiCredentialStore {
    fn load(&self, provider: &str) -> ApiResult<Option<TokenSet>> {
        let path = self.path_for(provider);
        let encrypted = match fs::read(&path) {
            Ok(bytes) => bytes,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
            Err(error) => return Err(ApiError::storage(error)),
        };

        let plaintext = unprotect(&encrypted)?;
        let token = serde_json::from_slice(&plaintext).map_err(|_| {
            ApiError::new(
                "credential_error",
                "DayOS could not read the stored provider credentials.",
                false,
            )
        })?;

        Ok(Some(token))
    }

    fn save(&self, provider: &str, token: &TokenSet) -> ApiResult<()> {
        fs::create_dir_all(&self.directory).map_err(ApiError::storage)?;

        let plaintext = serde_json::to_vec(token).map_err(|_| {
            ApiError::new(
                "credential_error",
                "DayOS could not serialize the provider credentials.",
                false,
            )
        })?;
        let encrypted = protect(&plaintext)?;

        let path = self.path_for(provider);
        let temporary = path.with_extension("tmp");

        {
            let mut file = fs::File::create(&temporary).map_err(ApiError::storage)?;
            file.write_all(&encrypted).map_err(ApiError::storage)?;
            file.sync_all().map_err(ApiError::storage)?;
        }

        fs::rename(&temporary, &path).map_err(|error| {
            let _ = fs::remove_file(&temporary);
            ApiError::storage(error)
        })?;

        Ok(())
    }

    fn delete(&self, provider: &str) -> ApiResult<()> {
        match fs::remove_file(self.path_for(provider)) {
            Ok(()) => Ok(()),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(error) => Err(ApiError::storage(error)),
        }
    }
}

fn protect(plaintext: &[u8]) -> ApiResult<Vec<u8>> {
    if plaintext.is_empty() {
        return Err(ApiError::new(
            "credential_error",
            "Refusing to encrypt empty provider credentials.",
            false,
        ));
    }

    unsafe {
        let input = CRYPT_INTEGER_BLOB {
            cbData: plaintext.len() as u32,
            pbData: plaintext.as_ptr() as *mut u8,
        };
        let entropy = CRYPT_INTEGER_BLOB {
            cbData: ENTROPY.len() as u32,
            pbData: ENTROPY.as_ptr() as *mut u8,
        };
        let mut output = CRYPT_INTEGER_BLOB {
            cbData: 0,
            pbData: ptr::null_mut(),
        };

        let succeeded = CryptProtectData(
            &input,
            ptr::null(),
            &entropy,
            ptr::null(),
            ptr::null(),
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut output,
        );

        if succeeded == 0 {
            return Err(os_error(
                "Windows could not encrypt the integration credentials",
            ));
        }

        copy_and_free(&output)
    }
}

fn unprotect(ciphertext: &[u8]) -> ApiResult<Vec<u8>> {
    if ciphertext.is_empty() {
        return Err(ApiError::new(
            "credential_error",
            "The stored provider credentials are empty.",
            false,
        ));
    }

    unsafe {
        let input = CRYPT_INTEGER_BLOB {
            cbData: ciphertext.len() as u32,
            pbData: ciphertext.as_ptr() as *mut u8,
        };
        let entropy = CRYPT_INTEGER_BLOB {
            cbData: ENTROPY.len() as u32,
            pbData: ENTROPY.as_ptr() as *mut u8,
        };
        let mut output = CRYPT_INTEGER_BLOB {
            cbData: 0,
            pbData: ptr::null_mut(),
        };

        let succeeded = CryptUnprotectData(
            &input,
            ptr::null_mut(),
            &entropy,
            ptr::null(),
            ptr::null(),
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut output,
        );

        if succeeded == 0 {
            return Err(os_error(
                "Windows could not decrypt the stored integration credentials",
            ));
        }

        copy_and_free(&output)
    }
}

unsafe fn copy_and_free(blob: &CRYPT_INTEGER_BLOB) -> ApiResult<Vec<u8>> {
    let bytes = if blob.pbData.is_null() {
        Vec::new()
    } else {
        std::slice::from_raw_parts(blob.pbData, blob.cbData as usize).to_vec()
    };

    LocalFree(blob.pbData as HLOCAL);

    if bytes.is_empty() {
        return Err(ApiError::new(
            "credential_error",
            "Windows returned empty integration credential data.",
            false,
        ));
    }

    Ok(bytes)
}

fn os_error(context: &str) -> ApiError {
    ApiError::new(
        "credential_error",
        format!("{}: {}", context, std::io::Error::last_os_error()),
        false,
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    fn test_token() -> TokenSet {
        TokenSet {
            access_token: "access-token".to_string(),
            refresh_token: Some("refresh-token".to_string()),
            token_type: "Bearer".to_string(),
            scope: "openid email".to_string(),
            expires_at: chrono::Utc::now().timestamp() + 3600,
        }
    }

    #[test]
    fn dpapi_roundtrip_preserves_token() {
        let plaintext = b"dayos credential roundtrip";
        let encrypted = protect(plaintext).expect("protect should succeed");
        assert_ne!(encrypted, plaintext);

        let decrypted = unprotect(&encrypted).expect("unprotect should succeed");
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn store_save_load_and_delete() {
        let directory = std::env::temp_dir().join(format!("dayos-dpapi-test-{}", Uuid::new_v4()));
        let store = DpapiCredentialStore::new(directory.clone());

        store.save("google", &test_token()).expect("save should succeed");
        let loaded = store
            .load("google")
            .expect("load should succeed")
            .expect("token should exist");
        assert_eq!(loaded.access_token, "access-token");
        assert_eq!(loaded.refresh_token.as_deref(), Some("refresh-token"));

        store.delete("google").expect("delete should succeed");
        assert!(store.load("google").expect("load should succeed").is_none());

        let _ = fs::remove_dir_all(directory);
    }
}
