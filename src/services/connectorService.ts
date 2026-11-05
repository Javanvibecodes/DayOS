import { settingsApi, meetingApi } from '@/lib/db/api';
import type { CalendarConnector, CreateMeetingRequest } from '@/types';
import { toast } from '@/stores/toastStore';

const CONNECTORS_SETTINGS_KEY = 'dayos_calendar_connectors';

export interface ParsedICalEvent {
  title: string;
  description?: string;
  startDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime?: string;
  url?: string;
  uid?: string;
}

export const connectorService = {
  getConnectors: async (): Promise<CalendarConnector[]> => {
    try {
      const data = await settingsApi.get(CONNECTORS_SETTINGS_KEY);
      if (!data) return [];
      return JSON.parse(data);
    } catch {
      return [];
    }
  },

  saveConnectors: async (connectors: CalendarConnector[]): Promise<void> => {
    await settingsApi.set(CONNECTORS_SETTINGS_KEY, JSON.stringify(connectors));
  },

  addGoogleCalendarConnector: async (email?: string, feedUrl?: string): Promise<CalendarConnector> => {
    const connectors = await connectorService.getConnectors();
    const newConnector: CalendarConnector = {
      id: `gcal_${Date.now()}`,
      provider: 'google_calendar',
      account_email: email || 'Connected Google Account',
      feed_url: feedUrl,
      sync_enabled: true,
      last_synced_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    const updated = [...connectors.filter((c) => c.provider !== 'google_calendar'), newConnector];
    await connectorService.saveConnectors(updated);
    toast.success('Google Calendar connected');
    return newConnector;
  },

  addZoomConnector: async (accountEmail?: string): Promise<CalendarConnector> => {
    const connectors = await connectorService.getConnectors();
    const newConnector: CalendarConnector = {
      id: `zoom_${Date.now()}`,
      provider: 'zoom',
      account_email: accountEmail || 'Connected Zoom Account',
      sync_enabled: true,
      last_synced_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    const updated = [...connectors.filter((c) => c.provider !== 'zoom'), newConnector];
    await connectorService.saveConnectors(updated);
    toast.success('Zoom connected');
    return newConnector;
  },

  removeConnector: async (id: string): Promise<void> => {
    const connectors = await connectorService.getConnectors();
    const updated = connectors.filter((c) => c.id !== id);
    await connectorService.saveConnectors(updated);
    toast.info('Connector disconnected');
  },

  toggleConnectorSync: async (id: string): Promise<void> => {
    const connectors = await connectorService.getConnectors();
    const updated = connectors.map((c) =>
      c.id === id ? { ...c, sync_enabled: !c.sync_enabled } : c
    );
    await connectorService.saveConnectors(updated);
  },

  // Parse standard iCal (.ics) text format
  parseICalText: (icsText: string): ParsedICalEvent[] => {
    const events: ParsedICalEvent[] = [];
    const lines = icsText.split(/\r\n|\n|\r/);
    let inEvent = false;
    let currentEvent: Partial<ParsedICalEvent> = {};

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (line === 'BEGIN:VEVENT') {
        inEvent = true;
        currentEvent = {};
      } else if (line === 'END:VEVENT') {
        inEvent = false;
        if (currentEvent.title && currentEvent.startDate && currentEvent.startTime) {
          events.push(currentEvent as ParsedICalEvent);
        }
      } else if (inEvent) {
        if (line.startsWith('SUMMARY:')) {
          currentEvent.title = line.substring(8);
        } else if (line.startsWith('DESCRIPTION:')) {
          currentEvent.description = line.substring(12);
        } else if (line.startsWith('URL:') || line.startsWith('LOCATION:')) {
          const val = line.substring(line.indexOf(':') + 1);
          if (val.startsWith('http')) {
            currentEvent.url = val;
          }
        } else if (line.startsWith('DTSTART')) {
          const val = line.substring(line.indexOf(':') + 1);
          // Format: 20261105T140000Z or 20261105
          if (val.length >= 8) {
            const y = val.substring(0, 4);
            const m = val.substring(4, 6);
            const d = val.substring(6, 8);
            currentEvent.startDate = `${y}-${m}-${d}`;
            if (val.includes('T') && val.length >= 13) {
              const tIdx = val.indexOf('T');
              const hh = val.substring(tIdx + 1, tIdx + 3);
              const mm = val.substring(tIdx + 3, tIdx + 5);
              currentEvent.startTime = `${hh}:${mm}`;
            } else {
              currentEvent.startTime = '09:00';
            }
          }
        } else if (line.startsWith('DTEND')) {
          const val = line.substring(line.indexOf(':') + 1);
          if (val.includes('T') && val.length >= 13) {
            const tIdx = val.indexOf('T');
            const hh = val.substring(tIdx + 1, tIdx + 3);
            const mm = val.substring(tIdx + 3, tIdx + 5);
            currentEvent.endTime = `${hh}:${mm}`;
          }
        } else if (line.startsWith('UID:')) {
          currentEvent.uid = line.substring(4);
        }
      }
    }
    return events;
  },

  // Sync iCal feed into meetings
  syncICalFeed: async (connectorId: string, icsText: string): Promise<number> => {
    const events = connectorService.parseICalText(icsText);
    let importedCount = 0;

    for (const ev of events) {
      const meetingReq: CreateMeetingRequest = {
        title: ev.title,
        description: ev.description,
        date: ev.startDate,
        start_time: ev.startTime,
        end_time: ev.endTime,
        meeting_url: ev.url,
        reminder_enabled: true,
        reminder_minutes: 15,
        reminder_offsets: [15],
        external_provider: 'google_calendar',
        external_id: ev.uid,
      };

      try {
        await meetingApi.create(meetingReq);
        importedCount++;
      } catch {
        // Skip duplicate or validation errors
      }
    }

    // Update last synced
    const connectors = await connectorService.getConnectors();
    const updated = connectors.map((c) =>
      c.id === connectorId ? { ...c, last_synced_at: new Date().toISOString() } : c
    );
    await connectorService.saveConnectors(updated);
    toast.success(`Synced ${importedCount} meetings from Google Calendar`);
    return importedCount;
  },
};

