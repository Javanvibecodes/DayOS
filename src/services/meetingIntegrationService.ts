import { invoke } from '@tauri-apps/api/core';
import type {
  ConnectorId,
  ExternalMeetingRequest,
  ExternalMeetingResult,
  IntegrationError,
  IntegrationStatuses,
  MeetingProvider,
  ProviderConnectionStatus,
  UpdateExternalMeetingRequest,
} from '@/types';

/**
 * Typed bridge to the Rust integration layer.
 *
 * The backend owns OAuth, token refresh, and provider API calls. The renderer
 * only ever sees connection status and normalized meeting results — never
 * credentials or raw provider payloads.
 */
export const meetingIntegrationService = {
  getStatuses: (): Promise<IntegrationStatuses> =>
    invoke('integration_get_statuses'),

  connect: (connector: ConnectorId): Promise<ProviderConnectionStatus> =>
    invoke('integration_connect', { connector }),

  disconnect: (connector: ConnectorId): Promise<ProviderConnectionStatus> =>
    invoke('integration_disconnect', { connector }),

  syncGoogleCalendar: (): Promise<void> =>
    invoke('integration_sync_google_calendar'),

  createMeeting: (
    provider: Exclude<MeetingProvider, 'none'>,
    req: ExternalMeetingRequest,
  ): Promise<ExternalMeetingResult> =>
    invoke('integration_create_meeting', { provider, req }),

  getMeeting: (
    provider: Exclude<MeetingProvider, 'none'>,
    externalId: string,
  ): Promise<ExternalMeetingResult> =>
    invoke('integration_get_meeting', { provider, externalId }),

  updateMeeting: (
    provider: Exclude<MeetingProvider, 'none'>,
    req: UpdateExternalMeetingRequest,
  ): Promise<ExternalMeetingResult> =>
    invoke('integration_update_meeting', { provider, req }),

  deleteMeeting: (
    provider: Exclude<MeetingProvider, 'none'>,
    externalId: string,
  ): Promise<void> =>
    invoke('integration_delete_meeting', { provider, externalId }),

  /** Normalize a Tauri command rejection into a readable message. */
  errorMessage: (error: unknown): string => {
    if (typeof error === 'string') return error;
    if (error && typeof error === 'object') {
      const candidate = error as Partial<IntegrationError>;
      if (typeof candidate.message === 'string' && candidate.message.trim()) {
        return candidate.message;
      }
    }
    return 'The integration request could not be completed.';
  },
};
