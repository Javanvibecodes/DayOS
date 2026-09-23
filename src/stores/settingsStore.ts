import { create } from 'zustand';
import type { ColorMode, ShortcutBindings } from '@/types';
import { settingsApi } from '@/lib/db/api';
import { DEFAULT_SHORTCUTS } from '@/lib/shortcuts';

interface SettingsState {
  displayName: string;
  startWithWindows: boolean;
  startMinimized: boolean;
  showWidget: boolean;
  colorMode: ColorMode;
  theme: string;
  widgetAlwaysOnTop: boolean;
  widgetRememberPosition: boolean;
  widgetRememberSize: boolean;
  widgetShowCompleted: boolean;
  widgetCompactMode: boolean;
  backupEnabled: boolean;
  backupInterval: number;
  backupRetainCount: number;
  showNotifications: boolean;
  soundEnabled: boolean;
  taskReminderTune: string;
  meetingReminderTune: string;
  pomodoroTune: string;
  pomodoroSessionMinutes: number;
  pomodoroFocusMinutes: number;
  pomodoroBreakMinutes: number;
  routine_require_half_to_skip: boolean;
  shortcuts: ShortcutBindings;

  loadSettings: () => Promise<void>;
  updateSetting: (key: string, value: string | boolean | number | object) => Promise<void>;
}

const defaultSettings = {
  displayName: '',
  startWithWindows: true,
  startMinimized: true,
  showWidget: true,
  colorMode: 'dark' as ColorMode,
  theme: 'midnight',
  widgetAlwaysOnTop: false,
  widgetRememberPosition: true,
  widgetRememberSize: true,
  widgetShowCompleted: false,
  widgetCompactMode: false,
  backupEnabled: true,
  backupInterval: 24 * 60 * 60 * 1000, // 24 hours
  backupRetainCount: 30,
  showNotifications: true,
  soundEnabled: true,
  taskReminderTune: 'alert',
  meetingReminderTune: 'chime',
  pomodoroTune: 'digital',
  pomodoroSessionMinutes: 240,
  pomodoroFocusMinutes: 25,
  pomodoroBreakMinutes: 5,
  routine_require_half_to_skip: false,
  shortcuts: { ...DEFAULT_SHORTCUTS } as ShortcutBindings,
};

function mergeShortcuts(saved: unknown): ShortcutBindings {
  if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
    return { ...DEFAULT_SHORTCUTS, ...(saved as Partial<ShortcutBindings>) };
  }
  return { ...DEFAULT_SHORTCUTS };
}

export const useSettingsStore = create<SettingsState>((set) => ({
  ...defaultSettings,

  loadSettings: async () => {
    try {
      const settings: Record<string, any> = {};

      for (const key of Object.keys(defaultSettings)) {
        const value = await settingsApi.get(key);
        if (value !== null) {
          // Parse JSON values
          try {
            settings[key] = JSON.parse(value);
          } catch {
            settings[key] = value;
          }
        }
      }

      if ('shortcuts' in settings) {
        settings.shortcuts = mergeShortcuts(settings.shortcuts);
      }

      set(settings);
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  },

  updateSetting: async (key: string, value: string | boolean | number | object) => {
    // Optimistic update so UI (e.g. tune selection) responds immediately
    set({ [key]: value } as Partial<SettingsState>);
    try {
      await settingsApi.set(key, JSON.stringify(value));
    } catch (error) {
      console.error('Failed to update setting:', error);
    }
  },
}));
