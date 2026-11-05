use std::sync::Arc;

use chrono::Utc;
use tauri::AppHandle;

use crate::database;

use super::credentials::{self, CredentialStore, TokenSet};
use super::oauth;
use super::providers::{ProviderContext, ProviderRegistry};
use super::store::{IntegrationAccount, IntegrationStore};
use super::types::{
    ApiError, ApiResult, ExternalMeetingRequest, ExternalMeetingResult, IntegrationStatuses,
    ProviderConnectionStatus, UpdateExternalMeetingRequest, CONNECTOR_GOOGLE_CALENDAR,
    CONNECTOR_GOOGLE_MEET, CONNECTOR_ZOOM, PROVIDER_GOOGLE_MEET, PROVIDER_ZOOM,
};

const GOOGLE_ACCOUNT: &str = "google";
const ZOOM_ACCOUNT: &str = "zoom";
const FEATURE_CALENDAR: &str = "calendar";
const FEATURE_MEET: &str = "meet";
const FEATURE_MEETINGS: &str = "meetings";

const GOOGLE_CALENDAR_READONLY_SCOPE: &str =
    "https://www.googleapis.com/auth/calendar.events.readonly";
const GOOGLE_CALENDAR_WRITE_SCOPE: &str = "https://www.googleapis.com/auth/calendar.events";
const GOOGLE_MEET_SCOPE: &str = "https://www.googleapis.com/auth/meetings.space.created";

pub struct IntegrationService {
    store: IntegrationStore,
    registry: ProviderRegistry,
    credentials: Box<dyn CredentialStore>,
    app: AppHandle,
}

impl IntegrationService {
    pub fn new(app: &AppHandle) -> Self {
        let db_path = database::get_db_path(app);
        let credentials = credentials::create_store(&db_path);

        Self {
            store: IntegrationStore::new(db_path),
            registry: ProviderRegistry::new(),
            credentials,
            app: app.clone(),
        }
    }

    pub fn statuses(&self) -> ApiResult<IntegrationStatuses> {
        let google = self.store.get_account(GOOGLE_ACCOUNT)?;
        let zoom = self.store.get_account(ZOOM_ACCOUNT)?;

        Ok(IntegrationStatuses {
            google_calendar: google_status(&google, FEATURE_CALENDAR, CONNECTOR_GOOGLE_CALENDAR),
            google_meet: google_status(&google, FEATURE_MEET, CONNECTOR_GOOGLE_MEET),
            zoom: zoom_status(&zoom),
        })
    }

    /// Run a real OAuth 2.0 Authorization Code + PKCE flow, then persist only
    /// the non-sensitive account metadata in SQLite. Tokens go to the Windows
    /// Data Protection API credential store.
    pub fn connect(&self, connector: &str) -> ApiResult<ProviderConnectionStatus> {
        validate_connector(connector)?;

        let config = oauth::config_for(connector)?;
        let authorization = oauth::run_authorization_flow(&self.app, &config)?;

        let response = oauth::exchange_code(
            &config,
            &authorization.code,
            &authorization.verifier,
            &authorization.redirect_uri,
        )?;
        let token = response.into_token_set(None);
        let profile = oauth::fetch_profile(&config, &token.access_token)?;

        self.credentials.save(config.provider, &token)?;

        let mut account = self
            .store
            .get_account(config.provider)?
            .unwrap_or_else(|| IntegrationAccount::new(config.provider));

        account.account_email = profile.email.or(account.account_email);
        account.display_name = profile.display_name.or(account.display_name);
        account.status = "connected".to_string();
        account.last_error = None;

        let mut granted_scopes = token.scopes();
        if granted_scopes.is_empty() {
            granted_scopes = config.scopes.clone();
        }
        account.scopes = merge_values(account.scopes, granted_scopes.clone());

        // Derive the enabled features from the scopes the provider actually
        // granted. Google returns both Google feature scopes from a single
        // consent, so one connection can legitimately enable Calendar and Meet.
        for feature in features_for_scopes(config.provider, &granted_scopes) {
            if !account.enabled_features.iter().any(|value| value == feature) {
                account.enabled_features.push(feature.to_string());
            }
        }

        if account.connected_at.is_none() {
            account.connected_at = Some(Utc::now().to_rfc3339());
        }

        if config.provider == oauth::config::GOOGLE_PROVIDER_KEY && account.calendar_id.is_none() {
            account.calendar_id = Some("primary".to_string());
        }

        self.store.save_account(&account)?;
        self.status_for_connector(connector)
    }

    pub fn disconnect(&self, connector: &str) -> ApiResult<ProviderConnectionStatus> {
        validate_connector(connector)?;

        match connector {
            CONNECTOR_ZOOM => {
                if let Ok(Some(token)) = self.credentials.load(ZOOM_ACCOUNT) {
                    revoke_best_effort(connector, &token);
                }
                self.credentials.delete(ZOOM_ACCOUNT)?;
                self.store.delete_account(ZOOM_ACCOUNT)?;
            }
            CONNECTOR_GOOGLE_CALENDAR | CONNECTOR_GOOGLE_MEET => {
                let feature = feature_for_connector(connector);

                if let Some(mut account) = self.store.get_account(GOOGLE_ACCOUNT)? {
                    account.enabled_features.retain(|value| value != feature);

                    if account.enabled_features.is_empty() {
                        if let Ok(Some(token)) = self.credentials.load(GOOGLE_ACCOUNT) {
                            revoke_best_effort(connector, &token);
                        }
                        self.credentials.delete(GOOGLE_ACCOUNT)?;
                        self.store.delete_account(GOOGLE_ACCOUNT)?;
                    } else {
                        self.store.save_account(&account)?;
                    }
                } else {
                    self.credentials.delete(GOOGLE_ACCOUNT)?;
                }
            }
            _ => {}
        }

        self.status_for_connector(connector)
    }

    /// Refresh the provider access token when needed and return it for backend
    /// API calls. This is intentionally private to the Rust integration layer.
    pub fn access_token_for(&self, connector: &str) -> ApiResult<String> {
        let config = oauth::config_for(connector)?;
        let provider_key = oauth::provider_key_for(connector)?;

        let token = self
            .credentials
            .load(provider_key)?
            .ok_or_else(|| ApiError::not_connected(connector))?;

        if !token.is_expiring() {
            return Ok(token.access_token);
        }

        let Some(refresh_token) = token.refresh_token.clone() else {
            mark_auth_expired(&self.store, provider_key);
            return Err(ApiError::new(
                "auth_expired",
                "The provider authorization has expired. Reconnect in Settings → Connectors.",
                false,
            ));
        };

        match oauth::refresh_access_token(&config, &refresh_token) {
            Ok(response) => {
                let next = response.into_token_set(Some(refresh_token));
                let access_token = next.access_token.clone();
                self.credentials.save(provider_key, &next)?;
                Ok(access_token)
            }
            Err(error) => {
                if error.code == "auth_expired" {
                    mark_auth_expired(&self.store, provider_key);
                }
                Err(error)
            }
        }
    }

    pub fn sync_google_calendar(&self) -> ApiResult<()> {
        let account = self
            .store
            .get_account(GOOGLE_ACCOUNT)?
            .ok_or_else(|| ApiError::not_connected(CONNECTOR_GOOGLE_CALENDAR))?;

        if !account.has_feature(FEATURE_CALENDAR) {
            return Err(ApiError::not_connected(CONNECTOR_GOOGLE_CALENDAR));
        }

        // Validate and refresh credentials now. Calendar synchronization itself
        // is implemented in the next stage.
        let _ = self.access_token_for(CONNECTOR_GOOGLE_CALENDAR)?;

        Err(ApiError::not_configured(
            "Google Calendar synchronization is not enabled yet. No calendar data was imported.",
        ))
    }

    pub async fn create_meeting(
        &self,
        provider: &str,
        req: ExternalMeetingRequest,
    ) -> ApiResult<ExternalMeetingResult> {
        let (account, feature) = self.account_for_meeting_provider(provider)?;
        let ctx = ProviderContext {
            store: self.store.clone(),
            account,
        };
        let adapter = self.registry.get(provider)?;
        let _ = feature;
        adapter.create_meeting(&ctx, req).await
    }

    pub async fn get_meeting(
        &self,
        provider: &str,
        external_id: &str,
    ) -> ApiResult<ExternalMeetingResult> {
        let (account, _) = self.account_for_meeting_provider(provider)?;
        let ctx = ProviderContext {
            store: self.store.clone(),
            account,
        };
        self.registry
            .get(provider)?
            .get_meeting(&ctx, external_id)
            .await
    }

    pub async fn update_meeting(
        &self,
        provider: &str,
        req: UpdateExternalMeetingRequest,
    ) -> ApiResult<ExternalMeetingResult> {
        let (account, _) = self.account_for_meeting_provider(provider)?;
        let ctx = ProviderContext {
            store: self.store.clone(),
            account,
        };
        self.registry.get(provider)?.update_meeting(&ctx, req).await
    }

    pub async fn delete_meeting(&self, provider: &str, external_id: &str) -> ApiResult<()> {
        let (account, _) = self.account_for_meeting_provider(provider)?;
        let ctx = ProviderContext {
            store: self.store.clone(),
            account,
        };
        self.registry
            .get(provider)?
            .delete_meeting(&ctx, external_id)
            .await
    }

    fn account_for_meeting_provider(
        &self,
        provider: &str,
    ) -> ApiResult<(IntegrationAccount, &'static str)> {
        match provider {
            PROVIDER_GOOGLE_MEET => {
                let account = self
                    .store
                    .get_account(GOOGLE_ACCOUNT)?
                    .ok_or_else(|| ApiError::not_connected(PROVIDER_GOOGLE_MEET))?;
                if !account.has_feature(FEATURE_MEET) {
                    return Err(ApiError::not_connected(PROVIDER_GOOGLE_MEET));
                }
                Ok((account, FEATURE_MEET))
            }
            PROVIDER_ZOOM => {
                let account = self
                    .store
                    .get_account(ZOOM_ACCOUNT)?
                    .ok_or_else(|| ApiError::not_connected(PROVIDER_ZOOM))?;
                if !account.has_feature(FEATURE_MEETINGS) {
                    return Err(ApiError::not_connected(PROVIDER_ZOOM));
                }
                Ok((account, FEATURE_MEETINGS))
            }
            _ => Err(ApiError::invalid_request(format!(
                "Unknown meeting provider: {}",
                provider
            ))),
        }
    }

    fn status_for_connector(&self, connector: &str) -> ApiResult<ProviderConnectionStatus> {
        let statuses = self.statuses()?;
        match connector {
            CONNECTOR_GOOGLE_CALENDAR => Ok(statuses.google_calendar),
            CONNECTOR_GOOGLE_MEET => Ok(statuses.google_meet),
            CONNECTOR_ZOOM => Ok(statuses.zoom),
            _ => Err(ApiError::invalid_request(format!(
                "Unknown connector: {}",
                connector
            ))),
        }
    }
}

fn validate_connector(connector: &str) -> ApiResult<()> {
    match connector {
        CONNECTOR_GOOGLE_CALENDAR | CONNECTOR_GOOGLE_MEET | CONNECTOR_ZOOM => Ok(()),
        _ => Err(ApiError::invalid_request(format!(
            "Unknown connector: {}",
            connector
        ))),
    }
}

fn feature_for_connector(connector: &str) -> &'static str {
    match connector {
        CONNECTOR_GOOGLE_CALENDAR => FEATURE_CALENDAR,
        CONNECTOR_GOOGLE_MEET => FEATURE_MEET,
        CONNECTOR_ZOOM => FEATURE_MEETINGS,
        _ => "",
    }
}

fn features_for_scopes(provider: &str, scopes: &[String]) -> Vec<&'static str> {
    let has = |scope: &str| scopes.iter().any(|value| value == scope);

    match provider {
        oauth::config::GOOGLE_PROVIDER_KEY => {
            let mut features = Vec::new();

            if has(GOOGLE_CALENDAR_WRITE_SCOPE) || has(GOOGLE_CALENDAR_READONLY_SCOPE) {
                features.push(FEATURE_CALENDAR);
            }
            if has(GOOGLE_MEET_SCOPE) {
                features.push(FEATURE_MEET);
            }

            features
        }
        oauth::config::ZOOM_PROVIDER_KEY => {
            if has("meeting:write:meeting") || has("meeting:write") {
                vec![FEATURE_MEETINGS]
            } else {
                Vec::new()
            }
        }
        _ => Vec::new(),
    }
}

fn merge_values(mut existing: Vec<String>, incoming: Vec<String>) -> Vec<String> {
    for value in incoming {
        if !existing.iter().any(|current| current == &value) {
            existing.push(value);
        }
    }
    existing
}

fn mark_auth_expired(store: &IntegrationStore, provider_key: &str) {
    let _ = store.set_status(
        provider_key,
        "auth_expired",
        Some("Authorization expired. Reconnect in Settings → Connectors."),
    );
}

fn revoke_best_effort(connector: &str, token: &TokenSet) {
    let Ok(config) = oauth::config_for(connector) else {
        log::warn!("Skipping provider token revocation: OAuth client configuration is unavailable");
        return;
    };

    let target = token.refresh_token.as_deref().unwrap_or(&token.access_token);
    if let Err(error) = oauth::revoke_token(&config, target) {
        // Local credentials are still deleted on disconnect. Only the error
        // code is logged; token material is never logged.
        log::warn!("Provider token revocation did not complete: {}", error.code);
    }
}

fn google_status(
    account: &Option<IntegrationAccount>,
    feature: &str,
    provider: &str,
) -> ProviderConnectionStatus {
    let Some(account) = account else {
        return ProviderConnectionStatus::disconnected(provider);
    };

    if !account.has_feature(feature) {
        return ProviderConnectionStatus {
            provider: provider.to_string(),
            state: "needs_authorization".to_string(),
            account_email: account.account_email.clone(),
            display_name: account.display_name.clone(),
            scopes: account.scopes.clone(),
            ..ProviderConnectionStatus::default()
        };
    }

    let (read_access, write_access) = if feature == FEATURE_CALENDAR {
        (
            account.has_scope(GOOGLE_CALENDAR_READONLY_SCOPE)
                || account.has_scope(GOOGLE_CALENDAR_WRITE_SCOPE),
            account.has_scope(GOOGLE_CALENDAR_WRITE_SCOPE),
        )
    } else {
        // `meetings.space.created` lets DayOS create spaces and read the
        // spaces it created, so it is both read and write capability.
        let allowed = account.has_scope(GOOGLE_MEET_SCOPE);
        (allowed, allowed)
    };

    ProviderConnectionStatus {
        provider: provider.to_string(),
        state: normalize_state(&account.status),
        account_email: account.account_email.clone(),
        display_name: account.display_name.clone(),
        scopes: account.scopes.clone(),
        read_access,
        write_access,
        last_synced_at: account.last_synced_at.clone(),
        last_error: account.last_error.clone(),
        enabled_features: account.enabled_features.clone(),
    }
}

fn zoom_status(account: &Option<IntegrationAccount>) -> ProviderConnectionStatus {
    let Some(account) = account else {
        return ProviderConnectionStatus::disconnected(CONNECTOR_ZOOM);
    };

    if !account.has_feature(FEATURE_MEETINGS) {
        return ProviderConnectionStatus {
            provider: CONNECTOR_ZOOM.to_string(),
            state: "needs_authorization".to_string(),
            account_email: account.account_email.clone(),
            display_name: account.display_name.clone(),
            scopes: account.scopes.clone(),
            ..ProviderConnectionStatus::default()
        };
    }

    ProviderConnectionStatus {
        provider: CONNECTOR_ZOOM.to_string(),
        state: normalize_state(&account.status),
        account_email: account.account_email.clone(),
        display_name: account.display_name.clone(),
        scopes: account.scopes.clone(),
        read_access: true,
        write_access: true,
        last_synced_at: account.last_synced_at.clone(),
        last_error: account.last_error.clone(),
        enabled_features: account.enabled_features.clone(),
    }
}

fn normalize_state(status: &str) -> String {
    match status {
        "connected" | "syncing" | "connecting" | "auth_expired" | "error"
        | "needs_authorization" | "not_connected" => status.to_string(),
        _ => "connected".to_string(),
    }
}

pub type SharedIntegrationService = Arc<IntegrationService>;

pub fn create_service(app: &AppHandle) -> SharedIntegrationService {
    Arc::new(IntegrationService::new(app))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scopes(values: &[&str]) -> Vec<String> {
        values.iter().map(|value| value.to_string()).collect()
    }

    #[test]
    fn google_scopes_enable_both_features_from_one_consent() {
        let granted = scopes(&["openid", GOOGLE_CALENDAR_WRITE_SCOPE, GOOGLE_MEET_SCOPE]);
        let features = features_for_scopes(oauth::config::GOOGLE_PROVIDER_KEY, &granted);

        assert!(features.contains(&FEATURE_CALENDAR));
        assert!(features.contains(&FEATURE_MEET));
    }

    #[test]
    fn google_meet_is_not_enabled_without_its_scope() {
        let granted = scopes(&["openid", GOOGLE_CALENDAR_WRITE_SCOPE]);
        let features = features_for_scopes(oauth::config::GOOGLE_PROVIDER_KEY, &granted);

        assert!(features.contains(&FEATURE_CALENDAR));
        assert!(!features.contains(&FEATURE_MEET));
    }

    #[test]
    fn zoom_requires_a_meeting_write_scope() {
        assert_eq!(
            features_for_scopes(
                oauth::config::ZOOM_PROVIDER_KEY,
                &scopes(&["user:read:user", "meeting:write:meeting"]),
            ),
            vec![FEATURE_MEETINGS]
        );
        assert!(features_for_scopes(
            oauth::config::ZOOM_PROVIDER_KEY,
            &scopes(&["user:read:user", "meeting:read:meeting"]),
        )
        .is_empty());
    }

    #[test]
    fn merge_values_keeps_order_and_deduplicates() {
        assert_eq!(
            merge_values(scopes(&["a", "b"]), scopes(&["b", "c", "a"])),
            scopes(&["a", "b", "c"])
        );
    }
}
