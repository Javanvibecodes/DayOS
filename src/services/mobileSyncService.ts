import { settingsApi, taskApi, goalApi, projectApi, meetingApi, noteApi } from '@/lib/db/api';
import type { Device, MobileSyncState } from '@/types';
import { toast } from '@/stores/toastStore';

const PAIRED_MOBILE_DEVICES_KEY = 'dayos_paired_mobile_devices';
const LAST_SYNC_KEY = 'dayos_mobile_last_sync_time';

export const mobileSyncService = {
  getSyncState: async (_currentDeviceId?: string): Promise<MobileSyncState> => {
    let paired: Device[] = [];
    try {
      const saved = await settingsApi.get(PAIRED_MOBILE_DEVICES_KEY);
      if (saved) paired = JSON.parse(saved);
    } catch {
      // ignore
    }

    const lastSync = await settingsApi.get(LAST_SYNC_KEY);

    return {
      pairing_code: Math.floor(100000 + Math.random() * 900000).toString(),
      local_ip: '192.168.1.100', // Local subnet placeholder or dynamically resolved
      port: 4141,
      status: 'idle',
      last_sync_timestamp: lastSync,
      paired_devices: paired,
    };
  },

  // Generates pairing URI for QR Code
  generatePairingUri: (currentDeviceId: string, pairingCode: string): string => {
    return `dayos://pair?device_id=${encodeURIComponent(currentDeviceId)}&code=${pairingCode}&port=4141`;
  },

  // Export local database deltas
  exportDeltaPackage: async (sinceTimestamp?: string | null): Promise<string> => {
    const tasks = await taskApi.getAll();
    const goals = await goalApi.getAll();
    const projects = await projectApi.getAll();
    const meetings = await meetingApi.getAll();
    const notes = await noteApi.getAll();

    const filterSince = (item: { updated_at?: string; created_at?: string }) => {
      if (!sinceTimestamp) return true;
      const t = item.updated_at || item.created_at || '';
      return t > sinceTimestamp;
    };

    const delta = {
      timestamp: new Date().toISOString(),
      tasks: tasks.filter(filterSince),
      goals: goals.filter(filterSince),
      projects: projects.filter(filterSince),
      meetings: meetings.filter(filterSince),
      notes: notes.filter(filterSince),
    };

    return JSON.stringify(delta, null, 2);
  },

  // Import delta package from mobile peer
  importDeltaPackage: async (jsonPackage: string): Promise<{ imported: number }> => {
    try {
      const data = JSON.parse(jsonPackage);
      let count = 0;

      if (Array.isArray(data.tasks)) {
        for (const t of data.tasks) {
          try {
            await taskApi.create(t);
            count++;
          } catch {
            // Task might already exist
          }
        }
      }

      if (Array.isArray(data.notes)) {
        for (const n of data.notes) {
          try {
            await noteApi.create(n);
            count++;
          } catch {
            // Note might already exist
          }
        }
      }

      await settingsApi.set(LAST_SYNC_KEY, new Date().toISOString());
      toast.success(`Synced ${count} items from mobile`);
      return { imported: count };
    } catch (e: any) {
      toast.error('Sync import failed: ' + e.message);
      return { imported: 0 };
    }
  },

  pairNewDevice: async (device: Device): Promise<void> => {
    let paired: Device[] = [];
    try {
      const saved = await settingsApi.get(PAIRED_MOBILE_DEVICES_KEY);
      if (saved) paired = JSON.parse(saved);
    } catch {
      // ignore
    }

    const updated = [...paired.filter((d) => d.id !== device.id), device];
    await settingsApi.set(PAIRED_MOBILE_DEVICES_KEY, JSON.stringify(updated));
    toast.success(`Paired mobile device: ${device.name}`);
  },

  removePairedDevice: async (id: string): Promise<void> => {
    let paired: Device[] = [];
    try {
      const saved = await settingsApi.get(PAIRED_MOBILE_DEVICES_KEY);
      if (saved) paired = JSON.parse(saved);
    } catch {
      // ignore
    }

    const updated = paired.filter((d) => d.id !== id);
    await settingsApi.set(PAIRED_MOBILE_DEVICES_KEY, JSON.stringify(updated));
    toast.info('Removed paired device');
  },
};

