use std::path::PathBuf;
use std::time::Duration;

use crate::integrations::types::{
    ApiError, ApiResult, CONNECTOR_GOOGLE_CALENDAR, CONNECTOR_GOOGLE_MEET, CONNECTOR_ZOOM,
};

pub const GOOGLE_PROVIDER_KEY: &str = "google";
pub const ZOOM_PROVIDER_KEY: &str = "zoom";

const GOOGLE_AUTH_URL: &str = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL: &str = "https://oauth2.googleapis.com/token";
const GOOGLE_REVOKE_URL: &str = "https://oauth2.googleapis.com/revoke";

const ZOOM_AUTH_URL: &str = "https://zoom.us/oauth/authorize";
const ZOOM_TOKEN_URL: &str = "https://zoom.us/oauth/token";
const ZOOM_REVOKE_URL: &str = "https://zoom.us/oauth/revoke";

const GOOGLE_CALENDAR_SCOPE: &str = "https://www.googleapis.com/auth/calendar.events";
const GOOGLE_MEET_SCOPE: &str = "https://www.googleapis.com/auth/meetings.space.created";
const GOOGLE_IDENTITY_SCOPES: [&str; 3] = ["openid", "email", "profile"];
// Zoom's current granular scopes. They map to the endpoints DayOS uses:
// GET /users/me, GET/POST/PATCH/DELETE /users/me/meetings.
const ZOOM_DEFAULT_SCOPES: [&str; 5] = [
    "user:read:user",
    "meeting:read:meeting",
    "meeting:write:meeting",
    "meeting:update:meeting",
    "meeting:delete:meeting",
];

/// Google installed-app clients do not support incremental authorization, so a
/// single Google token must request both feature scopes. This keeps Calendar
/// working after the user connects Meet (and vice versa).
const GOOGLE_FEATURE_SCOPES: [&str; 2] = [GOOGLE_CALENDAR_SCOPE, GOOGLE_MEET_SCOPE];

/// Resolved OAuth application configuration for a provider.
///
/// Client identifiers and secrets come from environment variables, compile-time
/// constants, or local untracked credentials files (credentials.local.json).
/// They are never persisted in SQLite, DayOS settings, logs, or the renderer.
#[derive(Debug, Clone)]
pub struct OAuthConfig {
    pub provider: &'static str,
    pub client_id: String,
    pub client_secret: Option<String>,
    pub auth_url: &'static str,
    pub token_url: &'static str,
    pub revoke_url: &'static str,
    pub scopes: Vec<String>,
    pub redirect_port: u16,
    pub redirect_path: String,
    pub timeout: Duration,
}

pub fn config_for(connector: &str) -> ApiResult<OAuthConfig> {
    match connector {
        CONNECTOR_GOOGLE_CALENDAR | CONNECTOR_GOOGLE_MEET => google_config(),
        CONNECTOR_ZOOM => zoom_config(),
        _ => Err(ApiError::invalid_request(format!(
            "Unknown connector: {}",
            connector
        ))),
    }
}

pub fn provider_key_for(connector: &str) -> ApiResult<&'static str> {
    match connector {
        CONNECTOR_GOOGLE_CALENDAR | CONNECTOR_GOOGLE_MEET => Ok(GOOGLE_PROVIDER_KEY),
        CONNECTOR_ZOOM => Ok(ZOOM_PROVIDER_KEY),
        _ => Err(ApiError::invalid_request(format!(
            "Unknown connector: {}",
            connector
        ))),
    }
}

fn google_config() -> ApiResult<OAuthConfig> {
    let client_id = resolve_credential(
        "DAYOS_GOOGLE_CLIENT_ID",
        option_env!("DAYOS_GOOGLE_CLIENT_ID"),
        "google",
        "client_id",
    )
    .ok_or_else(|| {
        ApiError::not_configured(
            "Google Calendar and Google Meet require a configured Google OAuth Client ID. \
             Please set DAYOS_GOOGLE_CLIENT_ID or provide credentials.local.json.",
        )
    })?;

    let client_secret = resolve_credential(
        "DAYOS_GOOGLE_CLIENT_SECRET",
        option_env!("DAYOS_GOOGLE_CLIENT_SECRET"),
        "google",
        "client_secret",
    );

    let mut scopes: Vec<String> = GOOGLE_IDENTITY_SCOPES
        .iter()
        .map(|scope| scope.to_string())
        .collect();
    scopes.extend(
        GOOGLE_FEATURE_SCOPES
            .iter()
            .map(|scope| scope.to_string()),
    );

    Ok(OAuthConfig {
        provider: GOOGLE_PROVIDER_KEY,
        client_id,
        client_secret,
        auth_url: GOOGLE_AUTH_URL,
        token_url: GOOGLE_TOKEN_URL,
        revoke_url: GOOGLE_REVOKE_URL,
        scopes,
        redirect_port: redirect_port("DAYOS_GOOGLE_REDIRECT_PORT")?,
        // Google's installed-app loopback redirect must be http://127.0.0.1:port
        // with no path component.
        redirect_path: "/".to_string(),
        timeout: oauth_timeout()?,
    })
}

fn zoom_config() -> ApiResult<OAuthConfig> {
    let client_id = resolve_credential(
        "DAYOS_ZOOM_CLIENT_ID",
        option_env!("DAYOS_ZOOM_CLIENT_ID"),
        "zoom",
        "client_id",
    )
    .ok_or_else(|| {
        ApiError::not_configured(
            "Zoom integration requires a configured Zoom OAuth Client ID. \
             Please set DAYOS_ZOOM_CLIENT_ID or provide credentials.local.json.",
        )
    })?;

    let client_secret = resolve_credential(
        "DAYOS_ZOOM_CLIENT_SECRET",
        option_env!("DAYOS_ZOOM_CLIENT_SECRET"),
        "zoom",
        "client_secret",
    );

    let scopes = match env_non_empty("DAYOS_ZOOM_SCOPES") {
        Some(value) => value
            .split(|c: char| c.is_whitespace() || c == ',')
            .filter(|scope| !scope.is_empty())
            .map(|scope| scope.to_string())
            .collect(),
        None => ZOOM_DEFAULT_SCOPES
            .iter()
            .map(|scope| scope.to_string())
            .collect(),
    };

    let redirect_port_num = redirect_port("DAYOS_ZOOM_REDIRECT_PORT")?;
    // Default to port 8765 to match the Zoom Marketplace redirect URL
    let port = if redirect_port_num == 0 { 8765 } else { redirect_port_num };

    Ok(OAuthConfig {
        provider: ZOOM_PROVIDER_KEY,
        client_id,
        client_secret,
        auth_url: ZOOM_AUTH_URL,
        token_url: ZOOM_TOKEN_URL,
        revoke_url: ZOOM_REVOKE_URL,
        scopes,
        redirect_port: port,
        redirect_path: zoom_redirect_path()?,
        timeout: oauth_timeout()?,
    })
}

fn env_non_empty(name: &str) -> Option<String> {
    std::env::var(name)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

/// Resolves an OAuth credential by checking:
/// 1. Runtime environment variables
/// 2. Build-time environment variable constants (option_env!)
/// 3. Local untracked credentials files (credentials.local.json or client_secret_*.json)
fn resolve_credential(
    env_name: &str,
    compile_time: Option<&'static str>,
    provider: &str,
    field: &str,
) -> Option<String> {
    env_non_empty(env_name)
        .or_else(|| compile_time.map(|s| s.trim().to_string()).filter(|s| !s.is_empty()))
        .or_else(|| file_credential(provider, field))
}

fn file_credential(provider: &str, field: &str) -> Option<String> {
    let candidate_paths = [
        PathBuf::from("credentials.local.json"),
        PathBuf::from("../credentials.local.json"),
        PathBuf::from("src-tauri/credentials.local.json"),
    ];

    for path in &candidate_paths {
        if let Ok(content) = std::fs::read_to_string(path) {
            if let Ok(val) = serde_json::from_str::<serde_json::Value>(&content) {
                if let Some(target) = val.get(provider).and_then(|p| p.get(field)).and_then(|v| v.as_str()) {
                    let s = target.trim();
                    if !s.is_empty() {
                        return Some(s.to_string());
                    }
                }
            }
        }
    }

    // Also check standard Google client_secret_*.json if searching for Google credentials
    if provider == "google" {
        let search_dirs = [PathBuf::from("."), PathBuf::from("..")];
        for dir in &search_dirs {
            if let Ok(entries) = std::fs::read_dir(dir) {
                for entry in entries.flatten() {
                    let file_name = entry.file_name();
                    let name = file_name.to_string_lossy();
                    if (name.starts_with("client_secret_") || name.ends_with(".apps.googleusercontent.com.json"))
                        && name.ends_with(".json")
                    {
                        if let Ok(content) = std::fs::read_to_string(entry.path()) {
                            if let Ok(val) = serde_json::from_str::<serde_json::Value>(&content) {
                                let obj = val.get("installed").or_else(|| val.get("web"));
                                if let Some(target) = obj.and_then(|o| o.get(field)).and_then(|v| v.as_str()) {
                                    let s = target.trim();
                                    if !s.is_empty() {
                                        return Some(s.to_string());
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    None
}

fn redirect_port(name: &str) -> ApiResult<u16> {
    let Some(value) = env_non_empty(name) else {
        return Ok(0);
    };

    value.parse::<u16>().map_err(|_| {
        ApiError::not_configured(format!(
            "{} must be a valid TCP port number (0 lets DayOS choose an ephemeral port).",
            name
        ))
    })
}

fn zoom_redirect_path() -> ApiResult<String> {
    let path = env_non_empty("DAYOS_ZOOM_REDIRECT_PATH")
        .unwrap_or_else(|| "/callback".to_string());

    if !path.starts_with('/') || path.contains('?') || path.contains('#') {
        return Err(ApiError::not_configured(
            "DAYOS_ZOOM_REDIRECT_PATH must start with '/' and must not contain a query or fragment.",
        ));
    }

    Ok(path)
}

fn oauth_timeout() -> ApiResult<Duration> {
    let Some(value) = env_non_empty("DAYOS_OAUTH_TIMEOUT_SECS") else {
        return Ok(Duration::from_secs(300));
    };

    let seconds = value.parse::<u64>().map_err(|_| {
        ApiError::not_configured(
            "DAYOS_OAUTH_TIMEOUT_SECS must be a whole number of seconds.",
        )
    })?;

    Ok(Duration::from_secs(seconds.clamp(30, 1800)))
}
