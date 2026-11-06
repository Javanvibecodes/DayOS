import { useState, useEffect, useRef } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTaskStore } from '@/stores/taskStore';
import { useGoalStore } from '@/stores/goalStore';
import { useProjectStore } from '@/stores/projectStore';
import { useMeetingStore } from '@/stores/meetingStore';
import { useCategoryStore } from '@/stores/categoryStore';
import { TUNE_LIBRARY, playTune, type TuneId } from '@/services/alarmService';
import { enable as autostartEnable, disable as autostartDisable, isEnabled as autostartIsEnabled } from '@tauri-apps/plugin-autostart';
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';
import {
  DEFAULT_SHORTCUTS,
  SHORTCUT_ACTIONS,
  SHORTCUT_LABELS,
  comboToKeys,
} from '@/lib/shortcuts';
import { toast } from '@/stores/toastStore';
import { THEME_PALETTES, applyAppearance, resolveColorMode, type ThemeColor } from '@/lib/theme';
import { meetingIntegrationService } from '@/services/meetingIntegrationService';
import {
  aiAgentService,
  defaultAISettings,
  LOCAL_NEURAL_VOICES,
  MODEL_RECOMMENDATIONS,
  speechService,
  ollamaService,
} from '@/services/aiAgentService';
import { useDeviceStore } from '@/stores/deviceStore';
import { MobileSyncModal } from '@/components/modals/MobileSyncModal';
import type {
  AISettings,
  ConnectorId,
  ConnectorState,
  IntegrationStatuses,
  ProviderConnectionStatus,
} from '@/types';

type SettingsTab =
  | 'general'
  | 'connectors'
  | 'ai-agent'
  | 'sync'
  | 'notifications'
  | 'appearance'
  | 'shortcuts'
  | 'categories'
  | 'data';
type ThemeMode = 'light' | 'dark' | 'system';

async function syncAutostart(enabled: boolean) {
  try {
    const current = await autostartIsEnabled();
    if (enabled && !current) await autostartEnable();
    if (!enabled && current) await autostartDisable();
  } catch {
    // Browser dev without Tauri — ignore
  }
}

async function readSystemAutostart(): Promise<boolean | null> {
  try {
    return await autostartIsEnabled();
  } catch {
    return null;
  }
}

async function ensureNotifPermission(): Promise<boolean> {
  try {
    if (await isPermissionGranted()) return true;
    const res = await requestPermission();
    return res === 'granted';
  } catch {
    return false;
  }
}

const CONNECTOR_STATUS_LABELS: Record<ConnectorState, string> = {
  not_connected: 'Not connected',
  needs_authorization: 'Needs authorization',
  connecting: 'Connecting…',
  connected: 'Connected',
  syncing: 'Syncing…',
  auth_expired: 'Authorization expired',
  error: 'Error',
};

function connectorStatusClass(state: ConnectorState): string {
  switch (state) {
    case 'connected':
      return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
    case 'syncing':
    case 'connecting':
      return 'bg-primary/10 text-primary border-primary/20';
    case 'needs_authorization':
    case 'auth_expired':
      return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
    case 'error':
      return 'bg-error/10 text-error border-error/20';
    default:
      return 'bg-surface-container text-on-surface-variant border-outline-variant/30';
  }
}

function IntegrationStatusBadge({
  status,
  busy = false,
}: {
  status: ProviderConnectionStatus;
  busy?: boolean;
}) {
  const state: ConnectorState = busy ? 'connecting' : status.state;

  return (
    <span
      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${connectorStatusClass(state)}`}
    >
      {CONNECTOR_STATUS_LABELS[state] ?? state}
    </span>
  );
}

function TunePicker({
  label,
  hint,
  settingKey,
  current,
  soundEnabled,
  onSelect,
  onPreview,
}: {
  label: string;
  hint: string;
  settingKey: string;
  current: string;
  soundEnabled: boolean;
  onSelect: (key: string, tuneId: string) => void;
  onPreview: (id: TuneId) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const currentTune = TUNE_LIBRARY.find((t) => t.id === current) || TUNE_LIBRARY[0];

  return (
    <div className="p-[16px] rounded-xl bg-surface-container-low flex flex-col md:flex-row md:items-center justify-between gap-[16px]">
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold text-on-surface">{label}</p>
        <p className="text-[12px] text-on-surface-variant mt-[2px]">{hint}</p>
        {!soundEnabled && (
          <p className="text-[11px] text-on-surface-variant/70 flex items-center gap-[6px] mt-[6px]">
            <span className="material-symbols-outlined text-[14px]">info</span>
            Master sound is off — selection still saves; enable Notification Sound to hear alerts.
          </p>
        )}
      </div>

      <div ref={dropdownRef} className="relative flex items-center gap-[8px] shrink-0">
        {/* Quick preview button for currently selected tune */}
        <button
          type="button"
          onClick={() => onPreview(currentTune.id)}
          title={`Preview ${currentTune.name}`}
          className="h-10 w-10 rounded-xl border border-outline-variant/30 text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-colors flex items-center justify-center shrink-0 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">volume_up</span>
        </button>

        {/* Dropdown trigger button */}
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          className="flex items-center justify-between gap-[12px] min-w-[200px] h-10 px-[14px] rounded-xl bg-surface-container border border-outline-variant/30 hover:border-outline-variant/60 hover:bg-surface-container-high transition-all cursor-pointer text-left shadow-sm"
        >
          <div className="flex items-center gap-[10px] min-w-0">
            <span className="material-symbols-outlined text-primary text-[18px] shrink-0">music_note</span>
            <span className="text-[13px] font-semibold text-on-surface truncate">{currentTune.name}</span>
          </div>
          <span
            className={`material-symbols-outlined text-[18px] text-on-surface-variant transition-transform duration-200 shrink-0 ${
              isOpen ? 'rotate-180' : ''
            }`}
          >
            expand_more
          </span>
        </button>

        {/* Floating dropdown menu */}
        {isOpen && (
          <div
            role="listbox"
            aria-label={label}
            className="absolute right-0 top-full mt-[6px] w-[260px] max-h-[300px] overflow-y-auto bg-surface border border-outline-variant/30 rounded-xl shadow-2xl p-[6px] z-50 flex flex-col gap-[2px] animate-in fade-in zoom-in-95 duration-150"
          >
            {TUNE_LIBRARY.map((tune) => {
              const isSelected = current === tune.id;
              return (
                <button
                  key={tune.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    // Previews and selects without closing the dropdown!
                    onSelect(settingKey, tune.id);
                  }}
                  title={tune.description}
                  className={`flex items-center justify-between gap-[12px] px-[12px] py-[8px] rounded-lg text-left transition-colors cursor-pointer group ${
                    isSelected
                      ? 'bg-primary-container/20 text-primary font-semibold'
                      : 'text-on-surface hover:bg-surface-container-high'
                  }`}
                >
                  <div className="flex flex-col min-w-0 pr-[8px]">
                    <span className="text-[13px] leading-tight font-medium">{tune.name}</span>
                    <span className="text-[11px] text-on-surface-variant/80 truncate mt-[2px]">
                      {tune.description}
                    </span>
                  </div>
                  {isSelected && (
                    <span className="material-symbols-outlined text-[18px] text-primary shrink-0">
                      check
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function SettingsPage() {
  const settings = useSettingsStore();
  const { tasks } = useTaskStore();
  const { goals } = useGoalStore();
  const { projects } = useProjectStore();
  const { meetings } = useMeetingStore();
  const { categories, loadCategories, createCategory, updateCategory, deleteCategory } = useCategoryStore();

  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [ready, setReady] = useState(false);
  const [systemAutostart, setSystemAutostart] = useState<boolean | null>(null);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#8083ff');
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [editCatColor, setEditCatColor] = useState('#8083ff');

  const shortcuts = settings.shortcuts ?? DEFAULT_SHORTCUTS;

  const [modelDownloadStatus, setModelDownloadStatus] = useState<Record<string, 'downloaded' | 'downloading' | 'not_downloaded'>>({});
  const [installedOllamaModels, setInstalledOllamaModels] = useState<string[]>([]);
  const [isOllamaRunning, setIsOllamaRunning] = useState(false);
  const [ollamaDownloadStatus, setOllamaDownloadStatus] = useState<Record<string, { status: 'idle' | 'downloading' | 'installed'; progress?: number }>>({});
  const [editingCloudProvider, setEditingCloudProvider] = useState<string | null>(null);
  const [cloudKeyInput, setCloudKeyInput] = useState('');
  const [activeMenuCloudProvider, setActiveMenuCloudProvider] = useState<string | null>(null);

  useEffect(() => {
    const checkModels = async () => {
      try {
        const downloaded = await speechService.listDownloadedModels();
        const status: Record<string, 'downloaded' | 'downloading' | 'not_downloaded'> = {};
        const hasKokoro = downloaded.some(d => d.toLowerCase().includes('kokoro'));
        LOCAL_NEURAL_VOICES.forEach(v => {
          if (v.engine === 'system') {
            status[v.id] = 'downloaded';
          } else if (v.engine === 'kokoro') {
            status[v.id] = hasKokoro ? 'downloaded' : 'not_downloaded';
          } else {
            status[v.id] = downloaded.some(d => d.includes(v.id.replace('-', '_')) || d.includes(v.id)) ? 'downloaded' : 'not_downloaded';
          }
        });
        setModelDownloadStatus(status);
      } catch {
        // ignore
      }
    };
    checkModels();
  }, []);

  useEffect(() => {
    const checkOllama = async () => {
      try {
        const running = await ollamaService.isServerRunning();
        setIsOllamaRunning(running);
        if (running) {
          const models = await ollamaService.getInstalledModels();
          setInstalledOllamaModels(models);
        } else {
          setInstalledOllamaModels([]);
        }
      } catch {
        setIsOllamaRunning(false);
        setInstalledOllamaModels([]);
      }
    };
    checkOllama();
    const interval = setInterval(checkOllama, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    void loadCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    let loaded = false;
    (async () => {
      if (!loaded) {
        loaded = true;
        await settings.loadSettings();
      }
      try {
        const sys = await autostartIsEnabled();
        if (!cancelled) {
          setSystemAutostart(sys);
          const storeVal = useSettingsStore.getState().startWithWindows;
          if (sys !== storeVal) {
            await useSettingsStore.getState().updateSetting('startWithWindows', sys);
          }
        }
      } catch {
        if (!cancelled) setSystemAutostart(null);
      }
      if (!cancelled) setReady(true);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready) return;
    applyAppearance(settings.colorMode, (settings.theme as ThemeColor) || 'midnight');
  }, [ready, settings.colorMode, settings.theme]);

  const { currentDevice, initDevice } = useDeviceStore();
  const [integrationStatuses, setIntegrationStatuses] = useState<IntegrationStatuses | null>(null);
  const [integrationBusy, setIntegrationBusy] = useState<ConnectorId | null>(null);
  const [aiConfig, setAiConfig] = useState<AISettings>(defaultAISettings);
  const [mobileSyncOpen, setMobileSyncOpen] = useState(false);

  useEffect(() => {
    initDevice();
    aiAgentService.getSettings().then(setAiConfig);
    meetingIntegrationService
      .getStatuses()
      .then(setIntegrationStatuses)
      .catch(() => setIntegrationStatuses(null));
  }, [initDevice]);

  const refreshIntegrationStatuses = async () => {
    try {
      setIntegrationStatuses(await meetingIntegrationService.getStatuses());
    } catch (error) {
      toast.error(meetingIntegrationService.errorMessage(error));
    }
  };

  const handleIntegrationConnect = async (connector: ConnectorId) => {
    setIntegrationBusy(connector);
    try {
      await meetingIntegrationService.connect(connector);
      toast.success('Provider connected');
    } catch (error) {
      // Connecting is not enabled until OAuth is configured. Surface the real
      // backend reason rather than pretending the account is connected.
      toast.error(meetingIntegrationService.errorMessage(error));
    } finally {
      setIntegrationBusy(null);
      await refreshIntegrationStatuses();
    }
  };

  const handleIntegrationDisconnect = async (connector: ConnectorId) => {
    setIntegrationBusy(connector);
    try {
      await meetingIntegrationService.disconnect(connector);
      toast.success('Provider disconnected');
    } catch (error) {
      toast.error(meetingIntegrationService.errorMessage(error));
    } finally {
      setIntegrationBusy(null);
      await refreshIntegrationStatuses();
    }
  };

  const handleSyncGoogleCalendar = async () => {
    setIntegrationBusy('google_calendar');
    try {
      await meetingIntegrationService.syncGoogleCalendar();
      await useMeetingStore.getState().loadMeetings();
      toast.success('Google Calendar sync complete');
    } catch (error) {
      toast.error(meetingIntegrationService.errorMessage(error));
    } finally {
      setIntegrationBusy(null);
      await refreshIntegrationStatuses();
    }
  };

  const tabs: { id: SettingsTab; icon: string; label: string }[] = [
    { id: 'general', icon: 'tune', label: 'General' },
    { id: 'connectors', icon: 'link', label: 'Connectors' },
    { id: 'ai-agent', icon: 'smart_toy', label: 'AI Agent' },
    { id: 'sync', icon: 'sync', label: 'Mobile Sync' },
    { id: 'notifications', icon: 'notifications_active', label: 'Notifications' },
    { id: 'appearance', icon: 'palette', label: 'Appearance' },
    { id: 'shortcuts', icon: 'keyboard', label: 'Shortcuts' },
    { id: 'categories', icon: 'category', label: 'Categories' },
    { id: 'data', icon: 'database', label: 'Data & Backup' },
  ];

  const setBool = (key: string, value: boolean) => {
    void settings.updateSetting(key, value);
  };

  const setStr = (key: string, value: string) => {
    void settings.updateSetting(key, value);
  };

  const handleAutostartChange = async (enabled: boolean) => {
    setBool('startWithWindows', enabled);
    try {
      await syncAutostart(enabled);
      const sys = await readSystemAutostart();
      setSystemAutostart(sys);
      if (sys === enabled) {
        toast.success(enabled ? 'DayOS will start with Windows' : 'Windows startup disabled');
      } else {
        toast.error('Could not update Windows startup — change it in Task Manager');
      }
    } catch {
      toast.error('Could not update Windows startup — change it in Task Manager');
    }
  };

  const handleStartMinimized = (enabled: boolean) => {
    setBool('startMinimized', enabled);
    toast.success(enabled ? 'DayOS will start minimized' : 'DayOS will start with the window open');
  };

  const handleNotifToggle = async (enabled: boolean) => {
    setBool('showNotifications', enabled);
    if (enabled) {
      const ok = await ensureNotifPermission();
      if (ok) {
        toast.success('Desktop notifications enabled');
        try {
          sendNotification({ title: 'DayOS', body: 'Desktop notifications are on.' });
        } catch { /* ignore */ }
      } else {
        toast.error('Notification permission denied — allow it in Windows settings');
      }
    } else {
      toast.success('Desktop notifications disabled');
    }
  };

  const handleSoundToggle = (enabled: boolean) => {
    setBool('soundEnabled', enabled);
    if (enabled) playTune('chime');
    toast.success(enabled ? 'Sounds enabled' : 'Sounds muted');
  };

  const handleThemeMode = (mode: ThemeMode) => {
    setStr('colorMode', mode);
    applyAppearance(mode, (settings.theme as ThemeColor) || 'midnight');
    toast.success(`Appearance set to ${mode === 'system' ? 'match system' : mode}`);
  };

  const handleThemeColor = (theme: ThemeColor) => {
    setStr('theme', theme);
    applyAppearance(settings.colorMode, theme);
    toast.success(`Theme changed to ${theme.charAt(0).toUpperCase()}${theme.slice(1)}`);
  };

  const handleTestTune = (id: TuneId) => {
    // Preview always plays (user-initiated); master toggle only gates live alerts
    playTune(id);
    if (!settings.soundEnabled) {
      toast.info('Previewing sound — Notification Sound is currently off');
    }
  };

  const handleSelectTune = (key: string, tuneId: string) => {
    void settings.updateSetting(key, tuneId);
    playTune(tuneId);
    const tune = TUNE_LIBRARY.find((t) => t.id === tuneId);
    toast.success(`${tune?.name ?? tuneId} selected`);
  };

  const handleExport = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      app: 'DayOS',
      version: '0.1.0',
      tasks,
      goals,
      projects,
      meetings,
      settings: {
        displayName: settings.displayName,
        startWithWindows: settings.startWithWindows,
        startMinimized: settings.startMinimized,
        colorMode: settings.colorMode,
        theme: settings.theme,
        showNotifications: settings.showNotifications,
        soundEnabled: settings.soundEnabled,
        taskReminderTune: settings.taskReminderTune,
        meetingReminderTune: settings.meetingReminderTune,
        pomodoroTune: settings.pomodoroTune,
        pomodoroSessionMinutes: settings.pomodoroSessionMinutes,
        pomodoroFocusMinutes: settings.pomodoroFocusMinutes,
        pomodoroBreakMinutes: settings.pomodoroBreakMinutes,
        shortcuts: settings.shortcuts,
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dayos-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Backup exported');
  };

  return (
    <div className="p-[32px] max-w-[1280px] mx-auto flex flex-col gap-[32px]">
      <div className="mt-[20px]">
        <h2 className="text-[28px] leading-9 font-semibold text-on-surface mb-[20px] flex items-center gap-[12px]">
          <span className="material-symbols-outlined text-[32px] text-primary">settings</span>
          Preferences & Settings
        </h2>
        <p className="text-[14px] text-on-surface-variant">
          Configure your DayOS workflow, themes, notifications, and system preferences.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-[32px]">
        {/* Navigation Sidebar — left-aligned, shared left margin */}
        <nav className="w-full lg:w-56 flex flex-row lg:flex-col gap-[10px] overflow-x-auto lg:overflow-visible pb-[8px] lg:pb-0 shrink-0 border-b lg:border-b-0 lg:border-r border-outline-variant/20 pr-0 lg:pr-[24px]">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-[12px] px-[16px] py-[12px] rounded-xl transition-all whitespace-nowrap lg:whitespace-normal font-semibold text-[13px] text-left justify-start ${
                activeTab === tab.id
                  ? 'bg-primary-container text-on-primary-container shadow-sm'
                  : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[20px] shrink-0">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Content Canvas */}
        <div className="flex-1 flex flex-col gap-[32px] max-w-[840px]">
          {/* General Tab */}
          {activeTab === 'general' && (
            <>
              <section className="bg-surface rounded-2xl border border-outline-variant/30 p-[28px] flex flex-col gap-[28px] shadow-sm">
                <div>
                  <h3 className="text-[18px] font-bold text-on-surface flex items-center gap-[18px] mb-[8px]">
                    <span className="material-symbols-outlined text-primary">person</span> Profile
                  </h3>
                  <p className="text-[14px] text-on-surface-variant">
                    Used in greetings like “Good morning” and your avatar initial.
                  </p>
                </div>
                <div className="flex flex-col gap-[8px]">
                  <label
                    htmlFor="display-name"
                    className="text-[12px] font-semibold uppercase tracking-wider text-on-surface-variant"
                  >
                    Display Name
                  </label>
                  <input
                    id="display-name"
                    type="text"
                    value={settings.displayName}
                    onChange={(e) => void settings.updateSetting('displayName', e.target.value)}
                    placeholder="e.g. Alex"
                    maxLength={40}
                    className="w-full bg-surface-container-low border border-outline-variant/30 rounded-lg px-[12px] py-[10px] text-[14px] text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary"
                  />
                  <p className="text-[11px] text-on-surface-variant/70">
                    Leave empty to use “User” in greetings.
                    {settings.displayName.trim()
                      ? ` Preview: “Good morning, ${settings.displayName.trim()}”`
                      : ''}
                  </p>
                </div>
              </section>

              <section className="bg-surface rounded-2xl border border-outline-variant/30 p-[28px] flex flex-col gap-[28px] shadow-sm">
                <h3 className="text-[18px] font-bold text-on-surface flex items-center gap-[18px] mb-[12px]">
                  <span className="material-symbols-outlined text-primary">tune</span> System Launch & Behavior
                </h3>
                <div className="flex flex-col gap-[16px]">
                  <label className="flex items-center justify-between p-[16px] rounded-xl bg-surface-container-low cursor-pointer">
                    <div>
                      <p className="text-[14px] font-semibold text-on-surface">Start DayOS with Windows</p>
                      <p className="text-[12px] text-on-surface-variant">
                        {systemAutostart === null
                          ? 'Syncs with Windows Startup apps'
                          : systemAutostart
                            ? 'Windows Startup: ON — DayOS launches at sign-in'
                            : 'Windows Startup: OFF — DayOS does not launch at sign-in'}
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={systemAutostart ?? settings.startWithWindows}
                      onChange={(e) => void handleAutostartChange(e.target.checked)}
                      className="w-5 h-5 accent-primary cursor-pointer"
                    />
                  </label>
                  <label className="flex items-center justify-between p-[16px] rounded-xl bg-surface-container-low cursor-pointer">
                    <div>
                      <p className="text-[14px] font-semibold text-on-surface">Start Minimized to System Tray</p>
                      <p className="text-[12px] text-on-surface-variant">Launch silently in background tray</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.startMinimized}
                      onChange={(e) => handleStartMinimized(e.target.checked)}
                      className="w-5 h-5 accent-primary cursor-pointer"
                    />
                  </label>
                </div>
              </section>

              <section className="bg-surface rounded-2xl border border-outline-variant/30 p-[28px] flex flex-col gap-[28px] shadow-sm">
                <div>
                  <h3 className="text-[18px] font-bold text-on-surface flex items-center gap-[18px] mb-[8px]">
                    <span className="material-symbols-outlined text-primary">devices</span> Device Identity & Network ID
                  </h3>
                  <p className="text-[14px] text-on-surface-variant">
                    Identifies this device for peer-to-peer collaboration, Lock-in sessions, and local mobile syncing with zero cloud accounts.
                  </p>
                </div>
                <div className="p-[16px] rounded-xl bg-surface-container-low border border-outline-variant/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-[16px]">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-semibold text-on-surface">{currentDevice.name}</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                        Active Local ID
                      </span>
                    </div>
                    <p className="text-[12px] font-mono text-on-surface-variant mt-1">ID: {currentDevice.id}</p>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(currentDevice.id);
                      toast.success('Device ID copied to clipboard');
                    }}
                    className="px-[16px] py-[8px] bg-primary/10 hover:bg-primary/20 text-primary text-[12px] font-semibold rounded-lg transition-colors"
                  >
                    Copy Device ID
                  </button>
                </div>
              </section>
            </>
          )}

          {/* Connectors Tab */}
          {activeTab === 'connectors' && (
            <section className="bg-surface rounded-2xl border border-outline-variant/30 p-[28px] flex flex-col gap-[28px] shadow-sm">
              <div>
                <h3 className="text-[18px] font-bold text-on-surface flex items-center gap-[18px] mb-[8px]">
                  <span className="material-symbols-outlined text-primary">link</span> External Account Connectors
                </h3>
                <p className="text-[14px] text-on-surface-variant">
                  Connect real Google Calendar, Google Meet, and Zoom accounts. DayOS talks to the official provider APIs
                  from the desktop backend; OAuth credentials are stored in Windows Credential Manager, never in the DayOS
                  database.
                </p>
              </div>

              {/* Google Calendar Card */}
              <div className="p-[20px] rounded-xl bg-surface-container-low border border-outline-variant/20 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <img src="/connectors/google-calendar.svg" alt="Google Calendar" className="w-8 h-8" />
                    <div>
                      <h4 className="text-[14px] font-semibold text-on-surface">Google Calendar</h4>
                      <p className="text-[12px] text-on-surface-variant">
                        Import events with the official Google Calendar API and incremental sync tokens. iCal feed
                        imports are not used.
                      </p>
                    </div>
                  </div>
                  {integrationStatuses && (
                    <IntegrationStatusBadge
                      status={integrationStatuses.google_calendar}
                      busy={integrationBusy === 'google_calendar'}
                    />
                  )}
                </div>

                {integrationStatuses?.google_calendar.last_error && (
                  <p className="text-[11px] text-error bg-error/5 border border-error/20 rounded-lg px-3 py-2">
                    {integrationStatuses.google_calendar.last_error}
                  </p>
                )}

                {integrationStatuses?.google_calendar.last_synced_at && (
                  <p className="text-[11px] text-on-surface-variant/70">
                    Last synced: {new Date(integrationStatuses.google_calendar.last_synced_at).toLocaleString()}
                  </p>
                )}

                <div className="flex items-center justify-between flex-wrap gap-3 pt-2">
                  <p className="text-[11px] text-on-surface-variant/70 max-w-lg">
                    Requires a Google OAuth client configured for DayOS. Google Calendar and Google Meet share one
                    Google account connection.
                  </p>
                  <div className="flex items-center gap-2">
                    {integrationStatuses &&
                      ['connected', 'syncing', 'auth_expired', 'error'].includes(
                        integrationStatuses.google_calendar.state,
                      ) && (
                        <>
                          {integrationStatuses.google_calendar.state === 'connected' && (
                            <button
                              onClick={handleSyncGoogleCalendar}
                              disabled={integrationBusy !== null}
                              className="px-[14px] py-[8px] rounded-lg border border-outline-variant/30 text-on-surface text-[12px] font-semibold hover:bg-surface-container transition-colors disabled:opacity-50"
                            >
                              Sync now
                            </button>
                          )}
                          <button
                            onClick={() => handleIntegrationDisconnect('google_calendar')}
                            disabled={integrationBusy !== null}
                            className="px-[14px] py-[8px] rounded-lg border border-error/30 text-error text-[12px] font-semibold hover:bg-error/10 transition-colors disabled:opacity-50"
                          >
                            Disconnect
                          </button>
                        </>
                      )}
                    {(!integrationStatuses ||
                      !['connected', 'syncing', 'auth_expired', 'error'].includes(
                        integrationStatuses.google_calendar.state,
                      )) && (
                      <button
                        onClick={() => handleIntegrationConnect('google_calendar')}
                        disabled={integrationBusy !== null}
                        className="px-[16px] py-[8px] bg-primary text-on-primary text-[12px] font-semibold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                      >
                        {integrationStatuses?.google_calendar.state === 'needs_authorization'
                          ? 'Authorize'
                          : 'Connect'}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Google Meet Card */}
              <div className="p-[20px] rounded-xl bg-surface-container-low border border-outline-variant/20 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <img src="/connectors/google-meet.svg" alt="Google Meet" className="w-8 h-8" />
                    <div>
                      <h4 className="text-[14px] font-semibold text-on-surface">Google Meet</h4>
                      <p className="text-[12px] text-on-surface-variant">
                        Create real Google Meet spaces through your Google account. No randomly generated links.
                      </p>
                    </div>
                  </div>
                  {integrationStatuses && (
                    <IntegrationStatusBadge
                      status={integrationStatuses.google_meet}
                      busy={integrationBusy === 'google_meet'}
                    />
                  )}
                </div>

                {integrationStatuses?.google_meet.last_error && (
                  <p className="text-[11px] text-error bg-error/5 border border-error/20 rounded-lg px-3 py-2">
                    {integrationStatuses.google_meet.last_error}
                  </p>
                )}

                <div className="flex items-center justify-between flex-wrap gap-3 pt-2">
                  <p className="text-[11px] text-on-surface-variant/70 max-w-lg">
                    Google Meet uses the same Google OAuth client as Google Calendar, with the Meet space-creation
                    scope.
                  </p>
                  <div className="flex items-center gap-2">
                    {integrationStatuses &&
                      ['connected', 'syncing', 'auth_expired', 'error'].includes(
                        integrationStatuses.google_meet.state,
                      ) && (
                        <button
                          onClick={() => handleIntegrationDisconnect('google_meet')}
                          disabled={integrationBusy !== null}
                          className="px-[14px] py-[8px] rounded-lg border border-error/30 text-error text-[12px] font-semibold hover:bg-error/10 transition-colors disabled:opacity-50"
                        >
                          Disconnect
                        </button>
                      )}
                    {(!integrationStatuses ||
                      !['connected', 'syncing', 'auth_expired', 'error'].includes(
                        integrationStatuses.google_meet.state,
                      )) && (
                      <button
                        onClick={() => handleIntegrationConnect('google_meet')}
                        disabled={integrationBusy !== null}
                        className="px-[16px] py-[8px] bg-primary text-on-primary text-[12px] font-semibold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                      >
                        {integrationStatuses?.google_meet.state === 'needs_authorization'
                          ? 'Authorize'
                          : 'Connect'}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Zoom Card */}
              <div className="p-[20px] rounded-xl bg-surface-container-low border border-outline-variant/20 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <img src="/connectors/zoom.svg" alt="Zoom" className="w-8 h-8" />
                    <div>
                      <h4 className="text-[14px] font-semibold text-on-surface">Zoom</h4>
                      <p className="text-[12px] text-on-surface-variant">
                        Create real Zoom meetings through the Zoom API and join them from the DayOS timetable.
                      </p>
                    </div>
                  </div>
                  {integrationStatuses && (
                    <IntegrationStatusBadge
                      status={integrationStatuses.zoom}
                      busy={integrationBusy === 'zoom'}
                    />
                  )}
                </div>

                {integrationStatuses?.zoom.last_error && (
                  <p className="text-[11px] text-error bg-error/5 border border-error/20 rounded-lg px-3 py-2">
                    {integrationStatuses.zoom.last_error}
                  </p>
                )}

                <div className="flex items-center justify-between flex-wrap gap-3 pt-2">
                  <p className="text-[11px] text-on-surface-variant/70 max-w-lg">
                    Requires a Zoom OAuth app configured for DayOS with the meeting creation scopes.
                  </p>
                  <div className="flex items-center gap-2">
                    {integrationStatuses &&
                      ['connected', 'syncing', 'auth_expired', 'error'].includes(integrationStatuses.zoom.state) && (
                        <button
                          onClick={() => handleIntegrationDisconnect('zoom')}
                          disabled={integrationBusy !== null}
                          className="px-[14px] py-[8px] rounded-lg border border-error/30 text-error text-[12px] font-semibold hover:bg-error/10 transition-colors disabled:opacity-50"
                        >
                          Disconnect
                        </button>
                      )}
                    {(!integrationStatuses ||
                      !['connected', 'syncing', 'auth_expired', 'error'].includes(
                        integrationStatuses.zoom.state,
                      )) && (
                      <button
                        onClick={() => handleIntegrationConnect('zoom')}
                        disabled={integrationBusy !== null}
                        className="px-[16px] py-[8px] bg-primary text-on-primary text-[12px] font-semibold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                      >
                        {integrationStatuses?.zoom.state === 'needs_authorization' ? 'Authorize' : 'Connect'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* AI Agent Tab */}
          {activeTab === 'ai-agent' && (
            <div className="flex flex-col gap-[28px]">
              {/* SECTION 1: Local AI Engine (100% Offline & Private) */}
              <section className="bg-surface rounded-2xl border border-outline-variant/30 p-[28px] flex flex-col gap-[24px] shadow-sm">
                <div className="flex items-start justify-between flex-wrap gap-4">
                  <div>
                    <h3 className="text-[18px] font-bold text-on-surface flex items-center gap-[12px] mb-[6px]">
                      <span className="material-symbols-outlined text-primary">memory</span>
                      Local AI Engine (100% Offline & Private)
                    </h3>
                    <p className="text-[13px] text-on-surface-variant max-w-2xl leading-relaxed">
                      Runs locally on your machine via Ollama and neural ONNX engines. Zero data, prompts, or focus logs ever leave your device.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                      isOllamaRunning
                        ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                    }`}>
                      <span className={`w-2 h-2 rounded-full ${isOllamaRunning ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                      Ollama {isOllamaRunning ? 'Running' : 'Offline'}
                    </span>
                    {!isOllamaRunning && (
                      <button
                        type="button"
                        onClick={async () => {
                          toast.info('Starting Ollama server...');
                          const running = await ollamaService.ensureRunning();
                          setIsOllamaRunning(running);
                          if (running) {
                            const models = await ollamaService.getInstalledModels();
                            setInstalledOllamaModels(models);
                            toast.success('Ollama server is active');
                          } else {
                            toast.error('Could not auto-start Ollama. Make sure Ollama is installed on your PC.');
                          }
                        }}
                        className="px-3 py-1 bg-primary text-on-primary text-xs font-semibold rounded-lg hover:bg-primary/90 transition-colors"
                      >
                        Start Server
                      </button>
                    )}
                  </div>
                </div>

                {/* Local Model Selector (No manual model name field) */}
                <div className="p-[18px] rounded-xl bg-surface-container-low border border-outline-variant/20 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <label className="text-[12px] font-bold uppercase tracking-wider text-on-surface block">
                        Active Local Model
                      </label>
                      <p className="text-[12px] text-on-surface-variant">
                        Select which installed Ollama model powers your local DayOS AI assistant.
                      </p>
                    </div>
                    {aiConfig.provider === 'ollama' && (
                      <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                        Active Provider
                      </span>
                    )}
                  </div>

                  {installedOllamaModels.length > 0 ? (
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                      <select
                        value={aiConfig.model_name || installedOllamaModels[0]}
                        onChange={(e) => {
                          const newModel = e.target.value;
                          setAiConfig({ ...aiConfig, provider: 'ollama', model_name: newModel });
                          toast.success(`Selected local model: ${newModel}`);
                        }}
                        className="flex-1 bg-surface border border-outline-variant/30 rounded-lg px-[12px] py-[10px] text-[13px] text-on-surface font-medium focus:outline-none focus:border-primary"
                      >
                        {installedOllamaModels.map((m) => (
                          <option key={m} value={m}>
                            {m} {aiConfig.model_name === m ? '(Active)' : ''}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          setAiConfig({ ...aiConfig, provider: 'ollama' });
                          toast.success('Ollama set as active AI provider');
                        }}
                        className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors shrink-0 ${
                          aiConfig.provider === 'ollama'
                            ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                            : 'bg-primary text-on-primary hover:bg-primary/90'
                        }`}
                      >
                        {aiConfig.provider === 'ollama' ? '✓ Currently Using Local AI' : 'Switch to Local AI'}
                      </button>
                    </div>
                  ) : (
                    <div className="p-4 rounded-lg bg-surface border border-dashed border-outline-variant/40 text-center space-y-1">
                      <p className="text-[13px] font-semibold text-on-surface">No local models detected yet</p>
                      <p className="text-[12px] text-on-surface-variant">
                        One-tap download any recommended model below to start using 100% private AI on your machine.
                      </p>
                    </div>
                  )}
                </div>

                {/* One-Tap Download Ollama Models */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h4 className="text-[14px] font-bold text-on-surface flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-[18px]">download_for_offline</span>
                      One-Tap Download Ollama Models
                    </h4>
                    <span className="text-[11px] text-on-surface-variant font-medium">
                      Optimized for local laptop & desktop hardware
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {MODEL_RECOMMENDATIONS.map((rec) => {
                      const isInstalled = installedOllamaModels.some(
                        (m) => m === rec.tag || m.startsWith(`${rec.tag}:`) || rec.tag.startsWith(m.split(':')[0])
                      );
                      const isDownloading = ollamaDownloadStatus[rec.tag]?.status === 'downloading';
                      const downloadProgress = ollamaDownloadStatus[rec.tag]?.progress;
                      const isCurrentActive = aiConfig.provider === 'ollama' && (aiConfig.model_name === rec.tag || aiConfig.model_name.startsWith(rec.tag));

                      return (
                        <div
                          key={rec.tag}
                          className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                            isCurrentActive
                              ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/25'
                              : 'border-outline-variant/20 bg-surface-container-low hover:border-outline-variant/40'
                          }`}
                        >
                          <div className="space-y-2 mb-3">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h5 className="text-[14px] font-bold text-on-surface">{rec.name}</h5>
                                <span className="text-[11px] font-mono text-on-surface-variant">{rec.tag}</span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-primary/10 text-primary border border-primary/20">
                                  {rec.sizeGb}
                                </span>
                                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-surface-container border border-outline-variant/30 text-on-surface-variant">
                                  {rec.smoothness}
                                </span>
                              </div>
                            </div>
                            <p className="text-[12px] text-on-surface-variant whitespace-normal break-words leading-relaxed">
                              {rec.description}
                            </p>
                          </div>

                          <div className="pt-2 border-t border-outline-variant/15 flex items-center justify-between gap-2">
                            {isInstalled ? (
                              <>
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-500">
                                  <span className="material-symbols-outlined text-[15px]">check_circle</span>
                                  Installed
                                </span>
                                {isCurrentActive ? (
                                  <span className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                    Active Model
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setAiConfig({ ...aiConfig, provider: 'ollama', model_name: rec.tag });
                                      toast.success(`${rec.name} set as active model`);
                                    }}
                                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                                  >
                                    Set Active
                                  </button>
                                )}
                              </>
                            ) : (
                              <button
                                type="button"
                                disabled={isDownloading}
                                onClick={async () => {
                                  setOllamaDownloadStatus((prev) => ({
                                    ...prev,
                                    [rec.tag]: { status: 'downloading', progress: 0 },
                                  }));
                                  toast.info(`Starting download for ${rec.name} (${rec.sizeGb})...`);
                                  try {
                                    await ollamaService.pullModel(rec.tag, (pct) => {
                                      setOllamaDownloadStatus((prev) => ({
                                        ...prev,
                                        [rec.tag]: { status: 'downloading', progress: pct },
                                      }));
                                    });
                                    setOllamaDownloadStatus((prev) => ({
                                      ...prev,
                                      [rec.tag]: { status: 'installed' },
                                    }));
                                    const updatedModels = await ollamaService.getInstalledModels();
                                    setInstalledOllamaModels(updatedModels);
                                    setAiConfig((prev) => ({ ...prev, provider: 'ollama', model_name: rec.tag }));
                                    toast.success(`${rec.name} downloaded & set as active model!`);
                                  } catch (err) {
                                    setOllamaDownloadStatus((prev) => ({
                                      ...prev,
                                      [rec.tag]: { status: 'idle' },
                                    }));
                                    toast.error(`Download failed: ${String(err)}`);
                                  }
                                }}
                                className="w-full py-2 px-3 text-xs font-semibold rounded-lg bg-primary text-on-primary hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5"
                              >
                                {isDownloading ? (
                                  <>
                                    <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
                                    <span>Downloading {downloadProgress ? `${downloadProgress}%` : '...'}</span>
                                  </>
                                ) : (
                                  <>
                                    <span className="material-symbols-outlined text-[16px]">download</span>
                                    <span>Download Model ({rec.sizeGb})</span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Local Neural Voice & Speech (TTS Together with Local Model Selector) */}
                <div className="pt-4 border-t border-outline-variant/20 space-y-4">
                  <div>
                    <h4 className="text-[14px] font-bold text-on-surface flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-[18px]">record_voice_over</span>
                      Local Neural TTS Voices (Kokoro & Piper)
                    </h4>
                    <p className="text-[12px] text-on-surface-variant mt-1 leading-relaxed">
                      High-fidelity, ultra-natural offline voices that synthesize speech locally without any robotic system cadence.
                    </p>
                  </div>

                  {/* Active Voice Picker */}
                  <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/20 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <div className="flex-1">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant block mb-1">
                        Active Speech Voice
                      </label>
                      <select
                        value={aiConfig.tts_voice_id || 'kokoro-heart'}
                        onChange={(e) => {
                          setAiConfig({ ...aiConfig, tts_voice_id: e.target.value });
                          toast.success('Active voice updated');
                        }}
                        className="w-full bg-surface border border-outline-variant/30 rounded-lg px-[12px] py-[8px] text-[13px] text-on-surface focus:outline-none focus:border-primary font-medium"
                      >
                        {LOCAL_NEURAL_VOICES.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name} ({v.accent}) • {v.sizeMb}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        const voiceId = aiConfig.tts_voice_id || 'kokoro-heart';
                        await speechService.previewVoice(voiceId);
                        toast.info('Auditioning voice sample...');
                      }}
                      className="px-4 py-2 bg-primary/10 text-primary hover:bg-primary/20 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 self-end sm:self-center shrink-0"
                    >
                      <span className="material-symbols-outlined text-[16px]">volume_up</span>
                      <span>Preview Current Voice</span>
                    </button>
                  </div>

                  {/* TTS Voice Cards with Sizes, Working Downloads & Text Wrapping */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {LOCAL_NEURAL_VOICES.map((v) => {
                      const isDownloaded = modelDownloadStatus[v.id] === 'downloaded' || v.engine === 'system';
                      const isDownloading = modelDownloadStatus[v.id] === 'downloading';
                      const isSelected = (aiConfig.tts_voice_id || 'kokoro-heart') === v.id;

                      return (
                        <div
                          key={v.id}
                          className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                            isSelected
                              ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/25'
                              : 'border-outline-variant/20 bg-surface-container-low hover:border-outline-variant/40'
                          }`}
                        >
                          <div className="space-y-2 mb-3">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h5 className="text-[13px] font-bold text-on-surface">{v.name}</h5>
                                <span className="text-[10px] uppercase tracking-wider font-semibold text-on-surface-variant">
                                  {v.engine} • {v.gender} • {v.accent}
                                </span>
                              </div>
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-primary/10 text-primary border border-primary/20 shrink-0">
                                {v.sizeMb}
                              </span>
                            </div>
                            <p className="text-[12px] text-on-surface-variant whitespace-normal break-words leading-relaxed">
                              {v.description}
                            </p>
                          </div>

                          <div className="pt-2 border-t border-outline-variant/15 flex items-center justify-between gap-2">
                            {isDownloaded ? (
                              <>
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-500">
                                  <span className="material-symbols-outlined text-[15px]">check_circle</span>
                                  {v.engine === 'system' ? 'System Built-In' : 'Ready'}
                                </span>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      await speechService.previewVoice(v.id);
                                      toast.info(`Playing ${v.name} sample...`);
                                    }}
                                    className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-surface border border-outline-variant/30 text-on-surface hover:bg-surface-container transition-colors"
                                  >
                                    Test Voice
                                  </button>
                                  {isSelected ? (
                                    <span className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-primary/15 text-primary border border-primary/25">
                                      Active
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setAiConfig({ ...aiConfig, tts_voice_id: v.id });
                                        toast.success(`${v.name} selected as active voice`);
                                      }}
                                      className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-primary text-on-primary hover:bg-primary/90 transition-colors"
                                    >
                                      Select
                                    </button>
                                  )}
                                </div>
                              </>
                            ) : (
                              <button
                                type="button"
                                disabled={isDownloading}
                                onClick={async () => {
                                  setModelDownloadStatus((prev) => ({ ...prev, [v.id]: 'downloading' }));
                                  toast.info(`Downloading ${v.name} model (${v.sizeMb})...`);
                                  try {
                                    await speechService.downloadLocalModel(v.id);
                                    if (v.engine === 'kokoro') {
                                      setModelDownloadStatus((prev) => {
                                        const next = { ...prev };
                                        LOCAL_NEURAL_VOICES.filter((vo) => vo.engine === 'kokoro').forEach((vo) => {
                                          next[vo.id] = 'downloaded';
                                        });
                                        return next;
                                      });
                                    } else {
                                      setModelDownloadStatus((prev) => ({ ...prev, [v.id]: 'downloaded' }));
                                    }
                                    setAiConfig((prev) => ({ ...prev, tts_voice_id: v.id }));
                                    toast.success(`${v.name} downloaded successfully!`);
                                  } catch (err) {
                                    setModelDownloadStatus((prev) => ({ ...prev, [v.id]: 'not_downloaded' }));
                                    toast.error(`Failed to download ${v.name}: ${String(err)}`);
                                  }
                                }}
                                className="w-full py-1.5 px-3 text-xs font-semibold rounded-lg bg-primary text-on-primary hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5"
                              >
                                {isDownloading ? (
                                  <>
                                    <span className="material-symbols-outlined text-[15px] animate-spin">sync</span>
                                    <span>Downloading ({v.sizeMb})...</span>
                                  </>
                                ) : (
                                  <>
                                    <span className="material-symbols-outlined text-[15px]">download</span>
                                    <span>Download Voice ({v.sizeMb})</span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Speech Input & Output Master Switches */}
                <div className="pt-4 border-t border-outline-variant/20 space-y-3">
                  <h4 className="text-[13px] font-bold text-on-surface">Voice & Audio Input/Output</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="flex items-center justify-between p-[14px] rounded-xl bg-surface border border-outline-variant/20 cursor-pointer">
                      <div>
                        <p className="text-[13px] font-semibold text-on-surface">Speech-to-Text (Mic In)</p>
                        <p className="text-[11px] text-on-surface-variant">Speak directly to DayOS using microphone</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={aiConfig.speech_input_enabled}
                        onChange={(e) =>
                          setAiConfig({ ...aiConfig, speech_input_enabled: e.target.checked })
                        }
                        className="w-5 h-5 accent-primary cursor-pointer shrink-0"
                      />
                    </label>

                    <label className="flex items-center justify-between p-[14px] rounded-xl bg-surface border border-outline-variant/20 cursor-pointer">
                      <div>
                        <p className="text-[13px] font-semibold text-on-surface">Voice Audio (Speech Out)</p>
                        <p className="text-[11px] text-on-surface-variant">Read responses out loud via neural TTS</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={aiConfig.speech_output_enabled}
                        onChange={(e) =>
                          setAiConfig({ ...aiConfig, speech_output_enabled: e.target.checked })
                        }
                        className="w-5 h-5 accent-primary cursor-pointer shrink-0"
                      />
                    </label>
                  </div>
                </div>
              </section>

              {/* SECTION 2: Cloud AI Providers (Online Models) */}
              <section className="bg-surface rounded-2xl border border-outline-variant/30 p-[28px] flex flex-col gap-[24px] shadow-sm">
                <div>
                  <h3 className="text-[18px] font-bold text-on-surface flex items-center gap-[12px] mb-[6px]">
                    <span className="material-symbols-outlined text-primary">cloud</span>
                    Cloud AI Providers (Online Models)
                  </h3>
                  <p className="text-[13px] text-on-surface-variant max-w-2xl leading-relaxed">
                    Connect external API keys for commercial frontier models. Keys are stored encrypted in your local OS credential store.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3.5">
                  {[
                    {
                      id: 'openai',
                      name: 'OpenAI',
                      models: 'GPT-4o, GPT-4o-mini',
                      desc: 'Advanced reasoning, multimodal analysis, and fast task execution.',
                      icon: 'psychology',
                      color: '#10A37F',
                      defaultModel: 'gpt-4o-mini',
                    },
                    {
                      id: 'gemini',
                      name: 'Google Gemini',
                      models: 'Gemini 1.5 Pro, Flash',
                      desc: 'Massive context comprehension and rapid productivity reasoning.',
                      icon: 'auto_awesome',
                      color: '#4285F4',
                      defaultModel: 'gemini-1.5-flash',
                    },
                    {
                      id: 'anthropic',
                      name: 'Anthropic Claude',
                      models: 'Claude 3.5 Sonnet',
                      desc: 'Industry benchmark for thoughtful writing, task synthesis, and planning.',
                      icon: 'neurology',
                      color: '#D97706',
                      defaultModel: 'claude-3-5-sonnet-20241022',
                    },
                    {
                      id: 'deepseek',
                      name: 'DeepSeek',
                      models: 'DeepSeek V3, R1',
                      desc: 'State-of-the-art open-weights reasoning model with high performance.',
                      icon: 'explore',
                      color: '#0284C7',
                      defaultModel: 'deepseek-chat',
                    },
                    {
                      id: 'openrouter',
                      name: 'OpenRouter',
                      models: 'Multi-model aggregation',
                      desc: 'Unified gateway to hundreds of open-source and proprietary models.',
                      icon: 'hub',
                      color: '#7C3AED',
                      defaultModel: 'meta-llama/llama-3.2-3b-instruct:free',
                    },
                  ].map((provider) => {
                    const savedKey =
                      aiConfig.cloud_keys?.[provider.id] ||
                      (aiConfig.provider === provider.id ? aiConfig.api_key : '');
                    const isConnected = Boolean(savedKey && savedKey.trim().length > 0);
                    const isActive = aiConfig.provider === provider.id;
                    const isEditing = editingCloudProvider === provider.id;
                    const isMenuOpen = activeMenuCloudProvider === provider.id;

                    return (
                      <div
                        key={provider.id}
                        className={`p-4 rounded-xl border transition-all ${
                          isActive
                            ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/20'
                            : 'border-outline-variant/20 bg-surface-container-low hover:border-outline-variant/40'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div
                              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                              style={{ backgroundColor: `${provider.color}15`, color: provider.color }}
                            >
                              <span className="material-symbols-outlined text-[22px]">{provider.icon}</span>
                            </div>
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="text-[14px] font-bold text-on-surface">{provider.name}</h4>
                                <span className="text-[11px] font-mono text-on-surface-variant px-2 py-0.5 rounded bg-surface border border-outline-variant/20">
                                  {provider.models}
                                </span>
                                {isActive && (
                                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                    Active AI
                                  </span>
                                )}
                              </div>
                              <p className="text-[12px] text-on-surface-variant whitespace-normal break-words">
                                {provider.desc}
                              </p>
                            </div>
                          </div>

                          {/* Action Buttons: Connect / Connected + Three Dots */}
                          <div className="flex items-center gap-2 self-end sm:self-center relative">
                            {isConnected ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAiConfig({
                                      ...aiConfig,
                                      provider: provider.id as any,
                                      model_name: provider.defaultModel,
                                      api_key: savedKey,
                                    });
                                    toast.success(`${provider.name} set as active AI`);
                                  }}
                                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/25 hover:bg-emerald-500/20 transition-colors flex items-center gap-1.5"
                                >
                                  <span className="material-symbols-outlined text-[15px]">check_circle</span>
                                  <span>Connected</span>
                                </button>

                                {/* Three Dots Menu for Rebind & Disconnect */}
                                <div className="relative">
                                  <button
                                    type="button"
                                    onClick={() => setActiveMenuCloudProvider(isMenuOpen ? null : provider.id)}
                                    className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors border border-outline-variant/30"
                                    title="Options"
                                  >
                                    <span className="material-symbols-outlined text-[18px]">more_vert</span>
                                  </button>

                                  {isMenuOpen && (
                                    <div className="absolute right-0 top-10 w-44 bg-surface border border-outline-variant/30 rounded-xl shadow-xl p-1 z-30 space-y-0.5">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingCloudProvider(provider.id);
                                          setCloudKeyInput(savedKey);
                                          setActiveMenuCloudProvider(null);
                                        }}
                                        className="w-full text-left px-3 py-2 text-xs font-medium text-on-surface hover:bg-surface-container rounded-lg flex items-center gap-2 transition-colors"
                                      >
                                        <span className="material-symbols-outlined text-[16px] text-primary">key</span>
                                        <span>Rebind (Update API)</span>
                                      </button>
                                      {!isActive && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setAiConfig({
                                              ...aiConfig,
                                              provider: provider.id as any,
                                              model_name: provider.defaultModel,
                                              api_key: savedKey,
                                            });
                                            toast.success(`${provider.name} set as active AI`);
                                            setActiveMenuCloudProvider(null);
                                          }}
                                          className="w-full text-left px-3 py-2 text-xs font-medium text-on-surface hover:bg-surface-container rounded-lg flex items-center gap-2 transition-colors"
                                        >
                                          <span className="material-symbols-outlined text-[16px] text-emerald-500">check</span>
                                          <span>Set as Active AI</span>
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const nextCloudKeys = { ...(aiConfig.cloud_keys || {}) };
                                          delete nextCloudKeys[provider.id];
                                          const nextProvider = aiConfig.provider === provider.id ? 'ollama' : aiConfig.provider;
                                          const updatedConfig = {
                                            ...aiConfig,
                                            provider: nextProvider,
                                            api_key: aiConfig.provider === provider.id ? '' : aiConfig.api_key,
                                            cloud_keys: nextCloudKeys,
                                          };
                                          setAiConfig(updatedConfig);
                                          void aiAgentService.saveSettings(updatedConfig);
                                          toast.success(`${provider.name} disconnected`);
                                          setActiveMenuCloudProvider(null);
                                        }}
                                        className="w-full text-left px-3 py-2 text-xs font-medium text-error hover:bg-error/10 rounded-lg flex items-center gap-2 transition-colors"
                                      >
                                        <span className="material-symbols-outlined text-[16px]">link_off</span>
                                        <span>Disconnect</span>
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingCloudProvider(provider.id);
                                  setCloudKeyInput('');
                                }}
                                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-primary text-on-primary hover:bg-primary/90 transition-colors flex items-center gap-1.5"
                              >
                                <span className="material-symbols-outlined text-[15px]">add_link</span>
                                <span>Connect</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Inline Key Input for Connect or Rebind */}
                        {isEditing && (
                          <div className="mt-3.5 pt-3.5 border-t border-outline-variant/20 space-y-2">
                            <label className="text-[11px] font-bold uppercase tracking-wider text-on-surface block">
                              Enter {provider.name} API Key
                            </label>
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                              <input
                                type="password"
                                value={cloudKeyInput}
                                onChange={(e) => setCloudKeyInput(e.target.value)}
                                placeholder={`Paste your ${provider.name} API key...`}
                                className="flex-1 bg-surface border border-outline-variant/30 rounded-lg px-3 py-2 text-xs font-mono text-on-surface focus:outline-none focus:border-primary"
                              />
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (!cloudKeyInput.trim()) {
                                      toast.error('API key cannot be empty');
                                      return;
                                    }
                                    const nextCloudKeys = {
                                      ...(aiConfig.cloud_keys || {}),
                                      [provider.id]: cloudKeyInput.trim(),
                                    };
                                    const updatedConfig: AISettings = {
                                      ...aiConfig,
                                      provider: provider.id as any,
                                      model_name: provider.defaultModel,
                                      api_key: cloudKeyInput.trim(),
                                      cloud_keys: nextCloudKeys,
                                    };
                                    setAiConfig(updatedConfig);
                                    await aiAgentService.saveSettings(updatedConfig);
                                    setEditingCloudProvider(null);
                                    setCloudKeyInput('');
                                    toast.success(`${provider.name} API key saved & connected!`);
                                  }}
                                  className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-primary text-on-primary hover:bg-primary/90 transition-colors"
                                >
                                  Save & Connect
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingCloudProvider(null);
                                    setCloudKeyInput('');
                                  }}
                                  className="px-3 py-2 text-xs font-semibold rounded-lg border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Master Save Button */}
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={async () => {
                    await aiAgentService.saveSettings(aiConfig);
                    toast.success('AI configuration saved successfully');
                  }}
                  className="px-6 py-2.5 bg-primary text-on-primary text-[13px] font-semibold rounded-xl hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-[18px]">save</span>
                  <span>Save All AI Preferences</span>
                </button>
              </div>
            </div>
          )}

          {/* Sync Tab */}
          {activeTab === 'sync' && (
            <section className="bg-surface rounded-2xl border border-outline-variant/30 p-[28px] flex flex-col gap-[28px] shadow-sm">
              <div>
                <h3 className="text-[18px] font-bold text-on-surface flex items-center gap-[18px] mb-[8px]">
                  <span className="material-symbols-outlined text-primary">sync</span> Mobile Companion & Local Sync
                </h3>
                <p className="text-[14px] text-on-surface-variant">
                  Keep your DayOS database synchronized with your Android mobile device over your local Wi-Fi without any cloud intermediate.
                </p>
              </div>

              <div className="p-[20px] rounded-xl bg-surface-container-low border border-outline-variant/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-[16px]">
                <div>
                  <h4 className="text-[14px] font-semibold text-on-surface">Wi-Fi QR Pairing</h4>
                  <p className="text-[12px] text-on-surface-variant mt-1">
                    Display a 6-digit PIN and QR code to pair your phone in seconds.
                  </p>
                </div>
                <button
                  onClick={() => setMobileSyncOpen(true)}
                  className="px-[20px] py-[10px] bg-primary text-on-primary text-[12px] font-semibold rounded-lg hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-[16px]">qr_code_scanner</span>
                  Pair Mobile Phone
                </button>
              </div>
            </section>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <section className="bg-surface rounded-2xl border border-outline-variant/30 p-[28px] flex flex-col gap-[28px] shadow-sm">
              <h3 className="text-[18px] font-bold text-on-surface flex items-center gap-[18px] mb-[12px]">
                <span className="material-symbols-outlined text-primary">notifications_active</span> Reminders & Desktop Alerts
              </h3>
              <div className="flex flex-col gap-[16px]">
                <label className="flex items-center justify-between p-[16px] rounded-xl bg-surface-container-low cursor-pointer">
                  <div>
                    <p className="text-[14px] font-semibold text-on-surface">Enable Desktop Notifications</p>
                    <p className="text-[12px] text-on-surface-variant">Show OS banner when tasks & meetings are due</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.showNotifications}
                    onChange={(e) => void handleNotifToggle(e.target.checked)}
                    className="w-5 h-5 accent-primary cursor-pointer"
                  />
                </label>
                <label className="flex items-center justify-between p-[16px] rounded-xl bg-surface-container-low cursor-pointer">
                  <div>
                    <p className="text-[14px] font-semibold text-on-surface">Notification Sound</p>
                    <p className="text-[12px] text-on-surface-variant">Play audio alert on task completion and reminders</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.soundEnabled}
                    onChange={(e) => handleSoundToggle(e.target.checked)}
                    className="w-5 h-5 accent-primary cursor-pointer"
                  />
                </label>
              </div>

              <div className="flex flex-col gap-[16px] border-t border-outline-variant/20 pt-[24px]">
                <div>
                  <h4 className="text-[15px] font-bold text-on-surface flex items-center gap-[10px] mb-[4px]">
                    <span className="material-symbols-outlined text-primary text-[20px]">library_music</span>
                    Reminder Tunes
                  </h4>
                  <p className="text-[12px] text-on-surface-variant">
                    Pick a different tune for each reminder type. Click a tune to select and preview it.
                  </p>
                </div>

                <TunePicker
                  label="Task Reminders"
                  hint="Rings when a scheduled task end time is reached"
                  settingKey="taskReminderTune"
                  current={settings.taskReminderTune}
                  soundEnabled={settings.soundEnabled}
                  onSelect={handleSelectTune}
                  onPreview={handleTestTune}
                />
                <TunePicker
                  label="Meeting Reminders"
                  hint="Plays before an upcoming meeting based on its reminder window"
                  settingKey="meetingReminderTune"
                  current={settings.meetingReminderTune}
                  soundEnabled={settings.soundEnabled}
                  onSelect={handleSelectTune}
                  onPreview={handleTestTune}
                />
                <TunePicker
                  label="Pomodoro / Focus Timer"
                  hint="Plays when the focus or task timer countdown finishes"
                  settingKey="pomodoroTune"
                  current={settings.pomodoroTune}
                  soundEnabled={settings.soundEnabled}
                  onSelect={handleSelectTune}
                  onPreview={handleTestTune}
                />
              </div>
            </section>
          )}

          {/* Appearance Tab */}
          {activeTab === 'appearance' && (
            <>
              <section className="bg-surface rounded-2xl border border-outline-variant/30 p-[28px] flex flex-col gap-[20px] shadow-sm">
                <h3 className="text-[18px] font-bold text-on-surface flex items-center gap-[18px] mb-[12px]">
                  <span className="material-symbols-outlined text-primary">contrast</span> Interface Mode
                </h3>
                <div className="grid grid-cols-3 gap-[20px]">
                  {(['light', 'dark', 'system'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => handleThemeMode(mode)}
                      className={`flex flex-col items-center justify-center gap-[18px] p-[20px] rounded-xl border transition-all ${
                        settings.colorMode === mode
                          ? 'border-primary bg-primary-container/20 ring-2 ring-primary/20 text-primary font-bold'
                          : 'border-outline-variant/20 bg-surface-container-low hover:bg-surface-container text-on-surface-variant'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[28px]">
                        {mode === 'light' ? 'light_mode' : mode === 'dark' ? 'dark_mode' : 'desktop_windows'}
                      </span>
                      <span className="text-[12px] font-semibold capitalize">{mode} Mode</span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="bg-surface rounded-2xl border border-outline-variant/30 p-[28px] flex flex-col gap-[20px] shadow-sm">
                <h3 className="text-[18px] font-bold text-on-surface flex items-center gap-[18px] mb-[12px]">
                  <span className="material-symbols-outlined text-primary">format_paint</span> Color Palettes
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-[20px]">
                  {(['midnight', 'paper', 'forest', 'aurora'] as const).map((theme) => (
                    <div
                      key={theme}
                      onClick={() => handleThemeColor(theme)}
                      className={`group cursor-pointer border rounded-xl p-[16px] flex flex-col transition-all ${
                        settings.theme === theme
                          ? 'border-primary bg-primary-container/10 ring-2 ring-primary/20'
                          : 'border-outline-variant/20 bg-surface-container-low hover:border-outline-variant'
                      }`}
                    >
                      <div
                        className="h-16 rounded-lg border border-outline-variant/20 p-[8px] flex flex-col gap-[14px] overflow-hidden"
                        style={{ background: THEME_PALETTES[theme][resolveColorMode(settings.colorMode)].background }}
                      >
                        <div className="h-2 w-full rounded opacity-80" style={{ background: THEME_PALETTES[theme][resolveColorMode(settings.colorMode)].primary }} />
                        <div className="h-4 w-3/4 rounded" style={{ background: THEME_PALETTES[theme][resolveColorMode(settings.colorMode)].surfaceContainerHigh }} />
                      </div>
                      <div className="flex justify-between items-center text-[12px] font-semibold capitalize text-on-surface mt-[8px]">
                        <span>{theme}</span>
                        {settings.theme === theme && (
                          <span className="material-symbols-outlined text-[16px] text-primary">check_circle</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          {/* Shortcuts Tab — hardcoded defaults, read-only */}
          {activeTab === 'shortcuts' && (
            <section className="bg-surface rounded-2xl border border-outline-variant/30 overflow-hidden shadow-sm">
              <div className="p-[28px] border-b border-outline-variant/20 bg-surface-container-low">
                <h3 className="text-[18px] font-bold text-on-surface flex items-center gap-[18px] mb-[12px]">
                  <span className="material-symbols-outlined text-primary">keyboard</span> Keyboard Shortcuts
                </h3>
              </div>
              <div className="divide-y divide-outline-variant/10">
                {SHORTCUT_ACTIONS.map((action) => {
                  const combo = shortcuts[action] ?? DEFAULT_SHORTCUTS[action];
                  return (
                    <div
                      key={action}
                      className="flex justify-between items-center p-[20px] hover:bg-surface-container-low transition-colors gap-[16px] flex-wrap"
                    >
                      <span className="text-[14px] font-medium text-on-surface">{SHORTCUT_LABELS[action]}</span>
                      <div className="flex gap-[8px] font-mono text-[12px]">
                        {comboToKeys(combo).map((k) => (
                          <kbd
                            key={k}
                            className="px-[10px] py-[4px] bg-surface-container-highest border border-outline-variant/30 rounded-lg text-on-surface shadow-sm font-semibold"
                          >
                            {k}
                          </kbd>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="p-[16px] text-[12px] text-on-surface-variant bg-surface-container-low border-t border-outline-variant/10 flex items-center gap-[8px]">
                <span className="material-symbols-outlined text-[16px] text-primary">lock</span>
                Shortcuts are built into DayOS and can't be changed.
              </p>
            </section>
          )}

          {/* Categories Tab */}
          {activeTab === 'categories' && (
            <section className="bg-surface rounded-2xl border border-outline-variant/30 p-[28px] flex flex-col gap-[28px] shadow-sm">
              <div>
                <h3 className="text-[18px] font-bold text-on-surface flex items-center gap-[18px] mb-[8px]">
                  <span className="material-symbols-outlined text-primary">category</span> Categories
                </h3>
                <p className="text-[14px] text-on-surface-variant">
                  General categories you can assign to goals, projects, and tasks. Tasks inherit category from their goal or project when unset.
                </p>
              </div>

              <div className="flex gap-[12px] flex-wrap items-end">
                <div className="flex-1 min-w-[180px]">
                  <label className="block text-[12px] font-semibold uppercase tracking-wider text-on-surface-variant mb-[8px]">
                    Name
                  </label>
                  <input
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newCatName.trim()) {
                        void createCategory({ name: newCatName.trim(), color: newCatColor });
                        setNewCatName('');
                        toast.success(`Category “${newCatName.trim()}” created`);
                      }
                    }}
                    placeholder="e.g. Work, Health, Learning"
                    className="w-full bg-surface-container-low border border-outline-variant/30 rounded-lg px-[12px] py-[10px] text-[14px] text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold uppercase tracking-wider text-on-surface-variant mb-[8px]">
                    Color
                  </label>
                  <input
                    type="color"
                    value={newCatColor}
                    onChange={(e) => setNewCatColor(e.target.value)}
                    className="w-14 h-10 bg-surface-container-low border border-outline-variant/30 rounded-lg px-[4px] py-[4px] cursor-pointer"
                  />
                </div>
                <button
                  onClick={async () => {
                    if (!newCatName.trim()) return;
                    const name = newCatName.trim();
                    await createCategory({ name, color: newCatColor });
                    setNewCatName('');
                    toast.success(`Category “${name}” created`);
                  }}
                  className="px-[20px] py-[10px] bg-primary hover:bg-primary/90 text-on-primary text-[13px] font-semibold rounded-lg text-center"
                >
                  Add
                </button>
              </div>

              <ul className="flex flex-col gap-[10px]">
                {categories.length === 0 && (
                  <li className="text-[13px] text-on-surface-variant/70 p-[16px] rounded-xl bg-surface-container-low">
                    No categories yet. Create one above.
                  </li>
                )}
                {categories.map((c) => {
                  const isEditing = editingCatId === c.id;
                  if (isEditing) {
                    return (
                      <li
                        key={c.id}
                        className="flex items-center justify-between gap-[12px] px-[16px] py-[12px] bg-surface-container-low border border-primary/50 rounded-xl flex-wrap"
                      >
                        <div className="flex items-center gap-[12px] min-w-0 flex-1">
                          <input
                            type="color"
                            value={editCatColor}
                            onChange={(e) => setEditCatColor(e.target.value)}
                            className="w-8 h-8 shrink-0 bg-surface-container border border-outline-variant/30 rounded-lg px-[2px] py-[2px] cursor-pointer"
                            title="Category color"
                          />
                          <input
                            value={editCatName}
                            onChange={(e) => setEditCatName(e.target.value)}
                            onKeyDown={async (e) => {
                              if (e.key === 'Enter' && editCatName.trim()) {
                                const newName = editCatName.trim();
                                await updateCategory(c.id, { name: newName, color: editCatColor });
                                setEditingCatId(null);
                                toast.success(`Category “${newName}” updated`);
                              } else if (e.key === 'Escape') {
                                setEditingCatId(null);
                              }
                            }}
                            autoFocus
                            placeholder="Category name"
                            className="flex-1 min-w-[140px] bg-surface border border-outline-variant/30 rounded-lg px-[12px] py-[8px] text-[14px] text-on-surface focus:outline-none focus:border-primary"
                          />
                        </div>
                        <div className="flex items-center gap-[8px]">
                          <button
                            onClick={async () => {
                              if (!editCatName.trim()) return;
                              const newName = editCatName.trim();
                              await updateCategory(c.id, { name: newName, color: editCatColor });
                              setEditingCatId(null);
                              toast.success(`Category “${newName}” updated`);
                            }}
                            className="px-[14px] py-[7px] bg-primary hover:bg-primary/90 text-on-primary text-[12px] font-semibold rounded-lg"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingCatId(null)}
                            className="text-[12px] text-on-surface-variant hover:text-on-surface px-[8px] py-[7px]"
                          >
                            Cancel
                          </button>
                        </div>
                      </li>
                    );
                  }
                  return (
                    <li
                      key={c.id}
                      className="flex items-center justify-between gap-[12px] px-[16px] py-[12px] bg-surface-container-low border border-outline-variant/20 rounded-xl"
                    >
                      <div className="flex items-center gap-[12px] min-w-0">
                        <span
                          className="w-4 h-4 rounded-full shrink-0 border border-outline-variant/40"
                          style={{ backgroundColor: c.color }}
                        />
                        <span className="text-[14px] font-semibold text-on-surface truncate">{c.name}</span>
                      </div>
                      <div className="flex items-center gap-[4px] shrink-0">
                        <button
                          onClick={() => {
                            setEditingCatId(c.id);
                            setEditCatName(c.name);
                            setEditCatColor(c.color);
                          }}
                          className="material-symbols-outlined text-[18px] text-on-surface-variant hover:text-primary transition-colors"
                          title="Edit category"
                        >
                          edit
                        </button>
                        <button
                          onClick={async () => {
                            await deleteCategory(c.id);
                            toast.success(`Category “${c.name}” deleted`);
                          }}
                          className="material-symbols-outlined text-[18px] text-on-surface-variant hover:text-error transition-colors"
                          title="Delete category"
                        >
                          delete
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* Data Tab */}
          {activeTab === 'data' && (
            <section className="bg-surface rounded-2xl border border-outline-variant/30 p-[28px] flex flex-col gap-[28px] shadow-sm">
              <h3 className="text-[18px] font-bold text-on-surface flex items-center gap-[18px] mb-[12px]">
                <span className="material-symbols-outlined text-primary">database</span> Data Storage & Backups
              </h3>
              <div className="flex flex-col gap-[16px]">
                <div className="p-[20px] rounded-xl bg-surface-container-low border border-outline-variant/20 flex justify-between items-center gap-[16px] flex-wrap">
                  <div>
                    <p className="text-[14px] font-semibold text-on-surface">Export Local Database</p>
                    <p className="text-[12px] text-on-surface-variant">
                      Save JSON backup ({tasks.length} tasks, {goals.length} goals, {meetings.length} meetings)
                    </p>
                  </div>
                  <button
                    onClick={handleExport}
                    className="px-[20px] py-[10px] bg-primary hover:bg-primary/90 text-on-primary text-[12px] font-semibold rounded-lg transition-colors flex items-center justify-center gap-[16px] shadow-sm text-center"
                  >
                    <span className="material-symbols-outlined text-[16px]">download</span> Export JSON
                  </button>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
      <MobileSyncModal isOpen={mobileSyncOpen} onClose={() => setMobileSyncOpen(false)} />
    </div>
  );
}
