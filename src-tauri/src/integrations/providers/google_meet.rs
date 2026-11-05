use async_trait::async_trait;

use super::{MeetingProvider, ProviderContext};
use crate::integrations::types::{
    ApiError, ApiResult, ExternalMeetingRequest, ExternalMeetingResult, UpdateExternalMeetingRequest, PROVIDER_GOOGLE_MEET,
};

fn not_ready() -> ApiError {
    ApiError::not_configured(
        "Google Meet needs OAuth configuration and a connected Google account before meetings can be created.",
    )
}

/// Provider adapter for Google Meet.
///
/// When a user schedules a meeting with a Google Meet link, DayOS uses the
/// Google Calendar API `meetings.space.created` endpoint. Because this
/// endpoint requires the `meetings.space.created` scope, which is granted
/// on every Google connection, one OAuth consent can legitimately enable
/// both Calendar sync and Meet creation.
pub struct GoogleMeetProvider;

#[async_trait]
impl MeetingProvider for GoogleMeetProvider {
    fn id(&self) -> &'static str {
        PROVIDER_GOOGLE_MEET
    }

    fn display_name(&self) -> &'static str {
        "Google Meet"
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