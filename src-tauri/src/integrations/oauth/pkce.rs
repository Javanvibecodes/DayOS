use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use rand::RngCore;
use sha2::{Digest, Sha256};

/// A fresh PKCE verifier, its S256 challenge, and an unguessable OAuth state.
#[derive(Debug, Clone)]
pub struct Pkce {
    pub verifier: String,
    pub challenge: String,
    pub state: String,
}

impl Pkce {
    pub fn generate() -> Self {
        let verifier = random_urlsafe(64);
        let challenge = challenge_for(&verifier);
        let state = random_urlsafe(32);

        Self {
            verifier,
            challenge,
            state,
        }
    }
}

pub fn challenge_for(verifier: &str) -> String {
    let digest = Sha256::digest(verifier.as_bytes());
    URL_SAFE_NO_PAD.encode(digest)
}

fn random_urlsafe(byte_count: usize) -> String {
    let mut bytes = vec![0u8; byte_count];
    rand::rngs::OsRng.fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}

/// Compare two secrets without leaking length-dependent timing information.
pub fn constant_time_eq(left: &str, right: &str) -> bool {
    let left = left.as_bytes();
    let right = right.as_bytes();
    let mut difference = left.len() ^ right.len();

    let max_len = left.len().max(right.len());
    for index in 0..max_len {
        let a = left.get(index).copied().unwrap_or(0);
        let b = right.get(index).copied().unwrap_or(0);
        difference |= (a ^ b) as usize;
    }

    difference == 0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn matches_rfc7636_example_challenge() {
        let verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
        assert_eq!(
            challenge_for(verifier),
            "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
        );
    }

    #[test]
    fn generated_values_are_url_safe_and_unique() {
        let first = Pkce::generate();
        let second = Pkce::generate();

        assert_ne!(first.verifier, second.verifier);
        assert_ne!(first.state, second.state);
        assert!(first
            .verifier
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_'));
        assert!(first
            .state
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_'));
    }

    #[test]
    fn constant_time_compare_handles_equal_and_different_values() {
        assert!(constant_time_eq("state-value", "state-value"));
        assert!(!constant_time_eq("state-value", "state-valuf"));
        assert!(!constant_time_eq("short", "longer"));
    }
}
