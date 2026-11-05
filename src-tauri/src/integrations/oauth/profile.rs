use std::time::Duration;

use serde::Deserialize;

use super::config::{OAuthConfig, ZOOM_PROVIDER_KEY};
use crate::integrations::types::{ApiError, ApiResult};

const GOOGLE_USERINFO_URL: &str = "https://openidconnect.googleapis.com/v1/userinfo";
const ZOOM_USERINFO_URL: &str = "https://api.zoom.us/v2/users/me";

#[derive(Debug, Clone, Default)]
pub struct Profile {
    pub email: Option<String>,
    pub display_name: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GoogleProfile {
    email: Option<String>,
    name: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ZoomProfile {
    email: Option<String>,
    first_name: Option<String>,
    last_name: Option<String>,
    display_name: Option<String>,
}

pub fn fetch_profile(config: &OAuthConfig, access_token: &str) -> ApiResult<Profile> {
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(20))
        .user_agent("DayOS/0.1")
        .build()
        .map_err(|_| {
            ApiError::new(
                "network_error",
                "Could not initialize the provider HTTP client.",
                true,
            )
        })?;

    if config.provider == ZOOM_PROVIDER_KEY {
        let response = client
            .get(ZOOM_USERINFO_URL)
            .bearer_auth(access_token)
            .send()
            .map_err(|_| network_error())?;

        ensure_success(&response)?;

        let profile: ZoomProfile = response.json().map_err(|_| {
            ApiError::new(
                "provider_error",
                "The Zoom profile response could not be read.",
                true,
            )
        })?;

        let fallback_name = [profile.first_name, profile.last_name]
            .into_iter()
            .flatten()
            .collect::<Vec<_>>()
            .join(" ");

        Ok(Profile {
            email: profile.email,
            display_name: profile
                .display_name
                .filter(|value| !value.trim().is_empty())
                .or_else(|| Some(fallback_name).filter(|value| !value.trim().is_empty())),
        })
    } else {
        let response = client
            .get(GOOGLE_USERINFO_URL)
            .bearer_auth(access_token)
            .send()
            .map_err(|_| network_error())?;

        ensure_success(&response)?;

        let profile: GoogleProfile = response.json().map_err(|_| {
            ApiError::new(
                "provider_error",
                "The Google profile response could not be read.",
                true,
            )
        })?;

        Ok(Profile {
            email: profile.email,
            display_name: profile.name,
        })
    }
}

fn ensure_success(response: &reqwest::blocking::Response) -> ApiResult<()> {
    if response.status().is_success() {
        return Ok(());
    }

    let code = if response.status() == reqwest::StatusCode::UNAUTHORIZED {
        "auth_expired"
    } else {
        "provider_error"
    };

    Err(ApiError::new(
        code,
        "The provider rejected the account profile request.",
        response.status().is_server_error(),
    ))
}

fn network_error() -> ApiError {
    ApiError::new(
        "network_error",
        "Could not reach the provider to read the account profile.",
        true,
    )
}
