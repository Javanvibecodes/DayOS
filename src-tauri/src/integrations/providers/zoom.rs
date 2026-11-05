use async_trait::async_trait;

use super::{MeetingProvider, ProviderContext};
use crate::integrations::types::{
    ApiError, ApiResult, ExternalMeetingRequest, ExternalMeetingResult,
    UpdateExternalMeetingRequest, PROVIDER_ZOOM,
};

pub struct ZoomProvider;

fn not_ready() -> ApiError {
    ApiError::not_configured(
        "Zoom needs OAuth configuration and a connected Zoom account before meetings can be created.",
    )
}

#[async_trait]
impl MeetingProvider for ZoomProvider {
    fn id(&self) -> &'static str {
        PROVIDER_ZOOM
    }

    fn display_name(&self) -> &'static str {
        "Zoom"
    }

    async fn create_meeting(
        &self,
        _ctx: &ProviderContext,
        _req: ExternalMeetingRequest,
    ) -> ApiResult<ExternalMeetingResult> {
        Err(not_ready())
    }

    async fn get_meeting(
        &self,
        _ctx: &ProviderContext,
        _external_id: &str,
    ) -> ApiResult<ExternalMeetingResult> {
        Err(not_ready())
    }

    async fn update_meeting(
        &self,
        _ctx: &ProviderContext,
        _req: UpdateExternalMeetingRequest,
    ) -> ApiResult<ExternalMeetingResult> {
        Err(not_ready())
    }

    async fn delete_meeting(
        &self,
        _ctx: &ProviderContext,
        _external_id: &str,
    ) -> ApiResult<()> {
        Err(not_ready())
    }
}
