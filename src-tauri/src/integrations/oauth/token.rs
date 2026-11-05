use std::time::Duration;

use chrono::Utc;
use serde::Deserialize;

use super::config::{OAuthConfig, ZOOM_PROVIDER_KEY};
use crate::integrations::credentials::TokenSet;
use crate::integrations::types::{ApiError, ApiResult};

#[derive(Debug, Deserialize)]
pub struct TokenResponse {
    pub access_token: String,
    #[serde(default)]
    pub refresh_token: Option<String>,
    #[serde(default)]
    pub expires_in: Option<i64>,
    #[serde(default)]
    pub scope: Option<String>,
    #[serde(default)]
    pub token_type: Option<String>,
}

impl TokenResponse {
    pub fn into_token_set(self, fallback_refresh_token: Option<String>) -> TokenSet {
        TokenSet {
            access_token: self.access_token,
            refresh_token: self.refresh_token.or(fallback_refresh_token),
            token_type: self.token_type.unwrap_or_else(|| "Bearer".to_string()),
            scope: self.scope.unwrap_or_default(),
            expires_at: Utc::now().timestamp() + self.expires_in.unwrap_or(3600),
        }
    }
}

#[derive(Debug, Default, Deserialize)]
struct OAuthErrorBody {
    error: Option<String>,
    error_description: Option<String>,
}

pub fn exchange_code(
    config: &OAuthConfig,
    code: &str,
    verifier: &str,
    redirect_uri: &str,
) -> ApiResult<TokenResponse> {
    let client = http_client()?;

    let request = if config.provider == ZOOM_PROVIDER_KEY {
        let mut form = vec![
            ("grant_type", "authorization_code"),
            ("code", code),
            ("redirect_uri", redirect_uri),
            ("code_verifier", verifier),
        ];

        if let Some(secret) = config.client_secret.as_deref() {
            client
                .post(config.token_url)
                .form(&form)
                .basic_auth(&config.client_id, Some(secret))
        } else {
            // Zoom public-client PKCE flow: the client ID travels in the body
            // and no Authorization header is used.
            form.push(("client_id", config.client_id.as_str()));
            client.post(config.token_url).form(&form)
        }
    } else {
        let mut form = vec![
            ("client_id", config.client_id.as_str()),
            ("code", code),
            ("code_verifier", verifier),
            ("grant_type", "authorization_code"),
            ("redirect_uri", redirect_uri),
        ];
        if let Some(secret) = config.client_secret.as_deref() {
            form.push(("client_secret", secret));
        }
        client.post(config.token_url).form(&form)
    };

    parse_token_response(request.send().map_err(|_| network_error())?)
}

pub fn refresh_access_token(
    config: &OAuthConfig,
    refresh_token: &str,
) -> ApiResult<TokenResponse> {
    let client = http_client()?;

    let request = if config.provider == ZOOM_PROVIDER_KEY {
        let mut form = vec![
            ("grant_type", "refresh_token"),
            ("refresh_token", refresh_token),
        ];

        if let Some(secret) = config.client_secret.as_deref() {
            client
                .post(config.token_url)
                .form(&form)
                .basic_auth(&config.client_id, Some(secret))
        } else {
            form.push(("client_id", config.client_id.as_str()));
            client.post(config.token_url).form(&form)
        }
    } else {
        let mut form = vec![
            ("client_id", config.client_id.as_str()),
            ("grant_type", "refresh_token"),
            ("refresh_token", refresh_token),
        ];
        if let Some(secret) = config.client_secret.as_deref() {
            form.push(("client_secret", secret));
        }
        client.post(config.token_url).form(&form)
    };

    parse_token_response(request.send().map_err(|_| network_error())?)
}

pub fn revoke_token(config: &OAuthConfig, token: &str) -> ApiResult<()> {
    let client = http_client()?;

    let response = if config.provider == ZOOM_PROVIDER_KEY {
        let mut form = vec![("token", token)];

        if let Some(secret) = config.client_secret.as_deref() {
            client
                .post(config.revoke_url)
                .form(&form)
                .basic_auth(&config.client_id, Some(secret))
                .send()
        } else {
            form.push(("client_id", config.client_id.as_str()));
            client.post(config.revoke_url).form(&form).send()
        }
    } else {
        client
            .post(config.revoke_url)
            .form(&[("token", token)])
            .send()
    }
    .map_err(|_| network_error())?;

    if response.status().is_success() {
        Ok(())
    } else {
        Err(ApiError::new(
            "provider_error",
            "The provider did not confirm token revocation.",
            true,
        ))
    }
}

fn http_client() -> ApiResult<reqwest::blocking::Client> {
    reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(30))
        .user_agent("DayOS/0.1")
        .build()
        .map_err(|_| {
            ApiError::new(
                "network_error",
                "Could not initialize the provider HTTP client.",
                true,
            )
        })
}

fn parse_token_response(response: reqwest::blocking::Response) -> ApiResult<TokenResponse> {
    let status = response.status();
    let body = response.text().map_err(|_| {
        ApiError::new(
            "provider_error",
            "The provider returned an unreadable token response.",
            true,
        )
    })?;

    if !status.is_success() {
        let parsed: OAuthErrorBody = serde_json::from_str(&body).unwrap_or_default();
        let provider_code = parsed
            .error
            .unwrap_or_else(|| format!("http_{}", status.as_u16()));
        let description = parsed
            .error_description
            .unwrap_or_else(|| "The provider rejected the OAuth request.".to_string());

        let code = match provider_code.as_str() {
            "invalid_grant" => "auth_expired",
            "access_denied" => "auth_cancelled",
            _ => "auth_failed",
        };

        return Err(ApiError::new(
            code,
            truncate(&description, 300),
            status.is_server_error(),
        ));
    }

    serde_json::from_str(&body).map_err(|_| {
        ApiError::new(
            "provider_error",
            "The provider returned a token response DayOS could not read.",
            true,
        )
    })
}

fn truncate(value: &str, max_chars: usize) -> String {
    value.chars().take(max_chars).collect()
}

fn network_error() -> ApiError {
    ApiError::new(
        "network_error",
        "Could not reach the provider. Check your internet connection and try again.",
        true,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn token_response_preserves_existing_refresh_token_when_absent() {
        let response = TokenResponse {
            access_token: "new-access".to_string(),
            refresh_token: None,
            expires_in: Some(1200),
            scope: Some("openid email".to_string()),
            token_type: Some("Bearer".to_string()),
        };

        let token = response.into_token_set(Some("old-refresh".to_string()));
        assert_eq!(token.access_token, "new-access");
        assert_eq!(token.refresh_token.as_deref(), Some("old-refresh"));
        assert_eq!(token.scope, "openid email");
        assert!(token.expires_at > Utc::now().timestamp());
    }
}
