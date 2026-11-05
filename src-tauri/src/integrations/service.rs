use std::sync::Arc;

use tauri::AppHandle;

use crate::database;

use super::providers::{ProviderContext, ProviderRegistry};
use super::store::{IntegrationAccount, IntegrationStore};
use super::types::{
    ApiError, ApiResult, ExternalMeetingRequest, ExternalMeetingResult,
    IntegrationStatuses, ProviderConnectionStatus, UpdateExternalMeetingRequest,
    CONNECTOR_GOOGLE_CALENDAR, CONNECTOR_GOOGLE_MEET, CONNECTOR_ZOOM, PROVIDER_GOOGLE_MEET,
    PROVIDER_ZOOM,
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
}

impl IntegrationService {
    pub fn new(app: &AppHandle) -> Self {
        let db_path = database::get_db_path(app);
        Self {
            store: IntegrationStore::new(db_path),
            registry: ProviderRegistry::new(),
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

    pub fn connect(&self, connector: &str) -> ApiResult<ProviderConnectionStatus> {
        validate_connector(connector)?;
        Err(ApiError::not_configured(
            "OAuth client configuration and the secure authorization flow are not enabled yet. \
             No provider account was connected.",
        ))
    }

    pub fn disconnect(&self, connector: &str) -> ApiResult<ProviderConnectionStatus> {
        validate_connector(connector)?;

        match connector {
            CONNECTOR_ZOOM => {
                self.store.delete_account(ZOOM_ACCOUNT)?;
            }
            CONNECTOR_GOOGLE_CALENDAR | CONNECTOR_GOOGLE_MEET => {
                let feature = if connector == CONNECTOR_GOOGLE_CALENDAR {
                    FEATURE_CALENDAR
                } else {
                    FEATURE_MEET
                };

                if let Some(mut account) = self.store.get_account(GOOGLE_ACCOUNT)? {
                    account.enabled_features.retain(|value| value != feature);
                    if account.enabled_features.is_empty() {
                        self.store.delete_account(GOOGLE_ACCOUNT)?;
                    } else {
                        self.store.save_account(&account)?;
                    }
                }
            }
            _ => {}
        }

        self.status_for_connector(connector)
    }

    pub fn sync_google_calendar(&self) -> ApiResult<()> {
        let account = self
            .store
            .get_account(GOOGLE_ACCOUNT)?
            .ok_or_else(|| ApiError::not_connected(CONNECTOR_GOOGLE_CALENDAR))?;

        if !account.has_feature(FEATURE_CALENDAR) {
            return Err(ApiError::not_connected(CONNECTOR_GOOGLE_CALENDAR));
        }

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
        (account.has_scope(GOOGLE_MEET_SCOPE), false)
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
        "connected" | "syncing" | "auth_expired" | "error" => status.to_string(),
        "not_connected" => "not_connected".to_string(),
        _ => "connected".to_string(),
    }
}

pub type SharedIntegrationService = Arc<IntegrationService>;

pub fn create_service(app: &AppHandle) -> SharedIntegrationService {
    Arc::new(IntegrationService::new(app))
}
