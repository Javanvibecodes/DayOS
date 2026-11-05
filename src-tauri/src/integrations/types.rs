use serde::{Deserialize, Serialize};
use std::fmt;

pub const PROVIDER_NONE: &str = "none";
pub const PROVIDER_GOOGLE_MEET: &str = "google_meet";
pub const PROVIDER_ZOOM: &str = "zoom";

pub const CONNECTOR_GOOGLE_CALENDAR: &str = "google_calendar";
pub const CONNECTOR_GOOGLE_MEET: &str = "google_meet";
pub const CONNECTOR_ZOOM: &str = "zoom";

pub type ApiResult<T> = Result<T, ApiError>;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiError {
    pub code: String,
    pub message: String,
    pub retryable: bool,
}

impl ApiError {
    pub fn new(code: impl Into<String>, message: impl Into<String>, retryable: bool) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
            retryable,
        }
    }

    pub fn not_connected(provider: impl Into<String>) -> Self {
        let provider = provider.into();
        Self::new(
            "not_connected",
            format!(
                "{} is not connected. Connect the provider in Settings → Connectors first.",
                provider_label(&provider)
            ),
            false,
        )
    }

    pub fn not_configured(message: impl Into<String>) -> Self {
        Self::new("not_configured", message, false)
    }

    pub fn invalid_request(message: impl Into<String>) -> Self {
        Self::new("invalid_request", message, false)
    }

    pub fn unsupported(message: impl Into<String>) -> Self {
        Self::new("unsupported_operation", message, false)
    }

    pub fn storage(error: impl fmt::Display) -> Self {
        Self::new(
            "storage_error",
            format!("Could not access DayOS integration data: {}", error),
            true,
        )
    }
}

impl fmt::Display for ApiError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}: {}", self.code, self.message)
    }
}

impl std::error::Error for ApiError {}

pub fn provider_label(provider: &str) -> &'static str {
    match provider {
        PROVIDER_GOOGLE_MEET => "Google Meet",
        PROVIDER_ZOOM => "Zoom",
        CONNECTOR_GOOGLE_CALENDAR => "Google Calendar",
        PROVIDER_NONE => "No external provider",
        _ => "External provider",
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ProviderConnectionStatus {
    pub provider: String,
    /// not_connected | connected | needs_authorization | syncing |
    /// auth_expired | error
    pub state: String,
    pub account_email: Option<String>,
    pub display_name: Option<String>,
    pub scopes: Vec<String>,
    pub read_access: bool,
    pub write_access: bool,
    pub last_synced_at: Option<String>,
    pub last_error: Option<String>,
    pub enabled_features: Vec<String>,
}

impl ProviderConnectionStatus {
    pub fn disconnected(provider: &str) -> Self {
        Self {
            provider: provider.to_string(),
            state: "not_connected".to_string(),
            ..Self::default()
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct IntegrationStatuses {
    pub google_calendar: ProviderConnectionStatus,
    pub google_meet: ProviderConnectionStatus,
    pub zoom: ProviderConnectionStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExternalMeetingRequest {
    pub title: String,
    pub description: Option<String>,
    pub date: String,
    pub start_time: String,
    pub end_time: Option<String>,
    pub timezone: Option<String>,
    pub participants: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExternalMeetingResult {
    /// Normalized provider identifier: "google_meet" or "zoom".
    pub provider: String,
    pub external_id: String,
    pub meeting_url: String,
    pub passcode: Option<String>,
    pub provider_metadata: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateExternalMeetingRequest {
    pub external_id: String,
    pub title: Option<String>,
    pub description: Option<String>,
    pub date: Option<String>,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub timezone: Option<String>,
    pub participants: Option<Vec<String>>,
}
