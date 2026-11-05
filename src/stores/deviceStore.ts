import { create } from 'zustand';
import { settingsApi } from '@/lib/db/api';
import type { Device } from '@/types';

interface DeviceState {
  currentDevice: Device;
  peerDevices: Device[];
  isLoaded: boolean;

  initDevice: () => Promise<void>;
  updateDeviceName: (name: string) => Promise<void>;
  addPeerDevice: (peer: Omit<Device, 'is_current'>) => Promise<void>;
  removePeerDevice: (id: string) => Promise<void>;
  toggleTrustPeer: (id: string) => Promise<void>;
}

const DEFAULT_DEVICE_ID_KEY = 'dayos_local_device_id';
const DEFAULT_DEVICE_NAME_KEY = 'dayos_local_device_name';
const PEER_DEVICES_KEY = 'dayos_peer_devices';

function generateDeviceId(): string {
  const chars = 'abcdef0123456789';
  let rand = '';
  for (let i = 0; i < 8; i++) {
    rand += chars[Math.floor(Math.random() * chars.length)];
  }
  return `dev_${rand}`;
}

export const useDeviceStore = create<DeviceState>((set, get) => ({
  currentDevice: {
    id: 'local_device',
    name: 'DayOS Desktop',
    last_seen: new Date().toISOString(),
    is_trusted: true,
    is_current: true,
    color: '#8083ff',
  },
  peerDevices: [],
  isLoaded: false,

  initDevice: async () => {
    try {
      let devId = await settingsApi.get(DEFAULT_DEVICE_ID_KEY);
      if (!devId) {
        devId = generateDeviceId();
        await settingsApi.set(DEFAULT_DEVICE_ID_KEY, devId);
      }

      let devName = await settingsApi.get(DEFAULT_DEVICE_NAME_KEY);
      if (!devName) {
        devName = 'My Desktop';
        await settingsApi.set(DEFAULT_DEVICE_NAME_KEY, devName);
      }

      const peersJson = await settingsApi.get(PEER_DEVICES_KEY);
      let peers: Device[] = [];
      if (peersJson) {
        try {
          peers = JSON.parse(peersJson);
        } catch {
          peers = [];
        }
      }

      set({
        currentDevice: {
          id: devId,
          name: devName,
          last_seen: new Date().toISOString(),
          is_trusted: true,
          is_current: true,
          color: '#8083ff',
        },
        peerDevices: peers,
        isLoaded: true,
      });
    } catch {
      // Fallback
      set({ isLoaded: true });
    }
  },

  updateDeviceName: async (name: string) => {
    const trimmed = name.trim() || 'My Desktop';
    await settingsApi.set(DEFAULT_DEVICE_NAME_KEY, trimmed);
    set((state) => ({
      currentDevice: { ...state.currentDevice, name: trimmed },
    }));
  },

  addPeerDevice: async (peer: Omit<Device, 'is_current'>) => {
    const newPeer: Device = { ...peer, is_current: false };
    const filtered = get().peerDevices.filter((d) => d.id !== peer.id);
    const updated = [...filtered, newPeer];
    await settingsApi.set(PEER_DEVICES_KEY, JSON.stringify(updated));
    set({ peerDevices: updated });
  },

  removePeerDevice: async (id: string) => {
    const updated = get().peerDevices.filter((d) => d.id !== id);
    await settingsApi.set(PEER_DEVICES_KEY, JSON.stringify(updated));
    set({ peerDevices: updated });
  },

  toggleTrustPeer: async (id: string) => {
    const updated = get().peerDevices.map((d) =>
      d.id === id ? { ...d, is_trusted: !d.is_trusted } : d
    );
    await settingsApi.set(PEER_DEVICES_KEY, JSON.stringify(updated));
    set({ peerDevices: updated });
  },
}));

