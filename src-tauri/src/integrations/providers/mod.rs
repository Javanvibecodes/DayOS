mod google_meet;
mod zoom;

use std::collections::HashMap;
use std::sync::Arc;

use async_trait::async_trait;

use super::store::{IntegrationAccount, IntegrationStore};
use super::types::{
    ApiError, ApiResult, ExternalMeetingRequest, ExternalMeetingResult,
    UpdateExternalMeetingRequest,
};

pub use google_meet::GoogleMeetProvider;
pub use zoom::ZoomProvider;

/// Provider-independent context passed to every meeting adapter.
///
/// Credentials are deliberately not part of this context in the architecture
/// stage. Stage 3 adds the credential manager to the context while keeping the
/// renderer completely isolated from token material.
pub struct ProviderContext {
    pub store: IntegrationStore,
    pub account: IntegrationAccount,
}

#[async_trait]
pub trait MeetingProvider: Send + Sync {
    fn id(&self) -> &'static str;
    fn display_name(&self) -> &'static str;

    async fn create_meeting(
        &self,
        ctx: &ProviderContext,
        req: ExternalMeetingRequest,
    ) -> ApiResult<ExternalMeetingResult>;

    async fn get_meeting(
        &self,
        ctx: &ProviderContext,
        external_id: &str,
    ) -> ApiResult<ExternalMeetingResult>;

    async fn update_meeting(
        &self,
        ctx: &ProviderContext,
        req: UpdateExternalMeetingRequest,
    ) -> ApiResult<ExternalMeetingResult>;

    async fn delete_meeting(
        &self,
        ctx: &ProviderContext,
        external_id: &str,
    ) -> ApiResult<()>;
}

pub struct ProviderRegistry {
    providers: HashMap<&'static str, Arc<dyn MeetingProvider>>,
}

impl ProviderRegistry {
    pub fn new() -> Self {
        let providers: Vec<Arc<dyn MeetingProvider>> = vec![
            Arc::new(GoogleMeetProvider),
            Arc::new(ZoomProvider),
        ];

        Self {
            providers: providers
                .into_iter()
                .map(|provider| (provider.id(), provider))
                .collect(),
        }
    }

    pub fn get(&self, provider: &str) -> ApiResult<Arc<dyn MeetingProvider>> {
        self.providers
            .get(provider)
            .cloned()
            .ok_or_else(|| ApiError::invalid_request(format!("Unknown meeting provider: {}", provider)))
    }
}
