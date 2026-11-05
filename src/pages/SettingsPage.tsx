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
import { aiAgentService, defaultAISettings, LOCAL_NEURAL_VOICES, speechService, ollamaService } from '@/services/aiAgentService';
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

function IntegrationStatusBadge({ status }: { status: ProviderConnectionStatus }) {
  return (
    <span
      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${connectorStatusClass(status.state)}`}
    >
      {CONNECTOR_STATUS_LABELS[status.state] ?? status.state}
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

  useEffect(() => {
    const checkModels = async () => {
      try {
        const downloaded = await speechService.listDownloadedModels();
        const status: Record<string, 'downloaded' | 'downloading' | 'not_downloaded'> = {};
        LOCAL_NEURAL_VOICES.filter(v => v.engine !== 'system').forEach(v => {
          status[v.id] = downloaded.some(d => d.includes(v.id.replace('-', '_')) || d.includes(v.id)) ? 'downloaded' : 'not_downloaded';
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
                  {integrationStatuses && <IntegrationStatusBadge status={integrationStatuses.google_calendar} />}
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
                  {integrationStatuses && <IntegrationStatusBadge status={integrationStatuses.google_meet} />}
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
                  {integrationStatuses && <IntegrationStatusBadge status={integrationStatuses.zoom} />}
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
            <section className="bg-surface rounded-2xl border border-outline-variant/30 p-[28px] flex flex-col gap-[28px] shadow-sm">
              <div>
                <h3 className="text-[18px] font-bold text-on-surface flex items-center gap-[18px] mb-[8px]">
                  <span className="material-symbols-outlined text-primary">smart_toy</span> DayOS AI Assistant
                </h3>
                <p className="text-[14px] text-on-surface-variant">
                  Configure your local or online LLM model, speech recognition, and voice response parameters.
                </p>
              </div>

              <div className="flex flex-col gap-[16px]">
                {/* Provider Picker */}
                <div>
                  <label className="text-[12px] font-semibold uppercase tracking-wider text-on-surface-variant block mb-2">
                    Model Provider
                  </label>
                  <select
                    value={aiConfig.provider}
                    onChange={(e) =>
                      setAiConfig({
                        ...aiConfig,
                        provider: e.target.value as any,
                        endpoint_url:
                          e.target.value === 'ollama' ? 'http://localhost:11434' : aiConfig.endpoint_url,
                      })
                    }
                    className="w-full bg-surface-container-low border border-outline-variant/30 rounded-lg px-[12px] py-[10px] text-[14px] text-on-surface focus:outline-none focus:border-primary"
                  >
                    <option value="ollama">Ollama (100% Local Offline - Recommended)</option>
                    <option value="openai">OpenAI (GPT-4o / GPT-4o-mini)</option>
                    <option value="gemini">Google Gemini API</option>
                    <option value="anthropic">Anthropic Claude</option>
                    <option value="openrouter">OpenRouter (Multi-model)</option>
                  </select>
                </div>

                {/* Connection Status Dashboard */}
                <div className="p-[16px] rounded-xl bg-surface-container-low border border-outline-variant/20 space-y-4">
                  <h4 className="text-[13px] font-bold text-on-surface flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[18px]">dashboard</span>
                    Connection Status
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Cloud APIs */}
                    <div className="space-y-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">Cloud APIs</p>
                      <div className="space-y-1.5">
                        {[
                          { id: 'openai', label: 'OpenAI', model: 'GPT-4o-mini' },
                          { id: 'gemini', label: 'Google Gemini', model: 'Flash 1.5' },
                          { id: 'anthropic', label: 'Anthropic', model: 'Claude 3.5 Sonnet' },
                          { id: 'openrouter', label: 'OpenRouter', model: 'Multi-model' },
                        ].map((api) => (
                          <div
                            key={api.id}
                            className="flex items-center justify-between p-2 rounded-lg bg-surface border border-outline-variant/20 text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${
                                aiConfig.api_key && aiConfig.provider === api.id
                                  ? 'bg-emerald-500'
                                  : 'bg-surface-container-highest'
                              }`} />
                              <span className="font-medium text-on-surface">{api.label}</span>
                              <span className="text-[10px] text-on-surface-variant px-1.5 py-0.5 rounded bg-surface-container">{api.model}</span>
                            </div>
                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                              aiConfig.api_key && aiConfig.provider === api.id
                                ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                : 'bg-surface-container border border-outline-variant/30 text-on-surface-variant'
                            }`}>
                              {aiConfig.api_key && aiConfig.provider === api.id ? 'Connected' : 'Not Connected'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Local Models */}
                    <div className="space-y-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">Local Models</p>
                      <div className="space-y-1.5">
                        {/* Ollama Models */}
                        <div className="p-2 rounded-lg bg-surface border border-outline-variant/20 text-xs">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-on-surface flex items-center gap-1.5">
                              <span className={`w-2 h-2 rounded-full ${isOllamaRunning ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                              Ollama Server
                            </span>
                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                              isOllamaRunning
                                ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                            }`}>
                              {isOllamaRunning ? 'Running' : 'Offline'}
                            </span>
                          </div>
                          {installedOllamaModels.length > 0 ? (
                            <div className="space-y-1 pl-4">
                              {installedOllamaModels.slice(0, 3).map((m) => (
                                <div key={m} className="flex items-center gap-2 text-[11px] text-on-surface-variant">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  <span className="font-mono text-[10px] truncate max-w-[200px]">{m}</span>
                                </div>
                              ))}
                              {installedOllamaModels.length > 3 && (
                                <div className="text-[10px] text-on-surface-variant/60 pl-2">
                                  +{installedOllamaModels.length - 3} more models
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-[11px] text-on-surface-variant/60 pl-4">No models installed</div>
                          )}
                        </div>

                        {/* Downloaded TTS Models */}
                        <div className="p-2 rounded-lg bg-surface border border-outline-variant/20 text-xs">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-on-surface flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-primary" />
                              Local TTS (Piper/Kokoro)
                            </span>
                          </div>
                          <div className="space-y-1 pl-4">
                            {LOCAL_NEURAL_VOICES.filter(v => v.engine !== 'system').map((v) => (
                              <div key={v.id} className="flex items-center gap-2 text-[11px]">
                                <span className={`w-1.5 h-1.5 rounded-full ${
                                  modelDownloadStatus[v.id] === 'downloaded' ? 'bg-emerald-500' : 'bg-surface-container-highest'
                                }`} />
                                <span className="font-mono text-[10px] truncate max-w-[180px]">{v.name} ({v.engine})</span>
                                <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                                  modelDownloadStatus[v.id] === 'downloaded'
                                    ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                    : 'bg-surface-container border border-outline-variant/30 text-on-surface-variant'
                                }`}>
                                  {modelDownloadStatus[v.id] === 'downloaded' ? 'Ready' : 'Not Downloaded'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Model Name */}
                <div>
                  <label className="text-[12px] font-semibold uppercase tracking-wider text-on-surface-variant block mb-2">
                    Model Name
                  </label>
                  <input
                    type="text"
                    value={aiConfig.model_name}
                    onChange={(e) => setAiConfig({ ...aiConfig, model_name: e.target.value })}
                    placeholder="e.g. llama3.2, mistral, gpt-4o-mini"
                    className="w-full bg-surface-container-low border border-outline-variant/30 rounded-lg px-[12px] py-[10px] text-[14px] text-on-surface focus:outline-none focus:border-primary"
                  />
                  <p className="text-[11px] text-on-surface-variant/70 mt-1">
                    For local Ollama, ensure you have run <code>ollama run {aiConfig.model_name || 'llama3.2'}</code>.
                  </p>
                </div>

                {/* Endpoint URL (For Ollama / Local) */}
                {aiConfig.provider === 'ollama' && (
                  <div>
                    <label className="text-[12px] font-semibold uppercase tracking-wider text-on-surface-variant block mb-2">
                      Local Endpoint URL
                    </label>
                    <input
                      type="text"
                      value={aiConfig.endpoint_url}
                      onChange={(e) => setAiConfig({ ...aiConfig, endpoint_url: e.target.value })}
                      className="w-full bg-surface-container-low border border-outline-variant/30 rounded-lg px-[12px] py-[10px] text-[14px] text-on-surface font-mono text-xs focus:outline-none focus:border-primary"
                    />
                  </div>
                )}

                {/* API Key (For Cloud) */}
                {aiConfig.provider !== 'ollama' && (
                  <div>
                    <label className="text-[12px] font-semibold uppercase tracking-wider text-on-surface-variant block mb-2">
                      API Key
                    </label>
                    <input
                      type="password"
                      value={aiConfig.api_key}
                      onChange={(e) => setAiConfig({ ...aiConfig, api_key: e.target.value })}
                      placeholder="sk-..."
                      className="w-full bg-surface-container-low border border-outline-variant/30 rounded-lg px-[12px] py-[10px] text-[14px] text-on-surface font-mono text-xs focus:outline-none focus:border-primary"
                    />
                  </div>
                )}

                {/* Voice Features Toggles */}
                <div className="pt-2 border-t border-outline-variant/20 space-y-3">
                  <h4 className="text-[13px] font-bold text-on-surface">Voice & Speech Capabilities</h4>
                  <label className="flex items-center justify-between p-[14px] rounded-xl bg-surface-container-low cursor-pointer">
                    <div>
                      <p className="text-[13px] font-semibold text-on-surface">Speech Recognition (Voice In)</p>
                      <p className="text-[11px] text-on-surface-variant">Talk directly to DayOS using your microphone</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={aiConfig.speech_input_enabled}
                      onChange={(e) =>
                        setAiConfig({ ...aiConfig, speech_input_enabled: e.target.checked })
                      }
                      className="w-5 h-5 accent-primary cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-[14px] rounded-xl bg-surface-container-low cursor-pointer">
                    <div>
                      <p className="text-[13px] font-semibold text-on-surface">Voice Output (Text-to-Speech)</p>
                      <p className="text-[11px] text-on-surface-variant">Speak AI responses back using natural speech models</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={aiConfig.speech_output_enabled}
                      onChange={(e) =>
                        setAiConfig({ ...aiConfig, speech_output_enabled: e.target.checked })
                      }
                      className="w-5 h-5 accent-primary cursor-pointer"
                    />
                  </label>

                  {/* Neural TTS Voice Selector (Kokoro & Piper) */}
                  <div className="p-[16px] rounded-xl bg-surface-container-low border border-outline-variant/20 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <label className="text-[12px] font-semibold uppercase tracking-wider text-on-surface block">
                          Local Neural Voice (Kokoro & Piper)
                        </label>
                        <p className="text-[11px] text-on-surface-variant">
                          High-fidelity offline voices designed for natural speech rhythm. Download models for best quality.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          const voiceId = aiConfig.tts_voice_id || 'kokoro-heart';
                          await speechService.previewVoice(voiceId);
                          toast.info('Playing voice audition sample...');
                        }}
                        className="px-3 py-1 rounded-lg text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex items-center gap-1.5"
                      >
                        <span>🔊</span>
                        <span>Preview Voice</span>
                      </button>
                    </div>

                    {/* Voice selector with download status */}
                    <div className="space-y-2">
                      <select
                        value={aiConfig.tts_voice_id || 'kokoro-heart'}
                        onChange={(e) => setAiConfig({ ...aiConfig, tts_voice_id: e.target.value })}
                        className="w-full bg-surface-container border border-outline-variant/30 rounded-lg px-[12px] py-[8px] text-[13px] text-on-surface focus:outline-none focus:border-primary"
                      >
                        <optgroup label="Kokoro Neural Voices (Warm & Expressive)">
                          {LOCAL_NEURAL_VOICES.filter((v) => v.engine === 'kokoro').map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name} ({v.accent}) — {v.description}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Piper Neural Voices (Crisp & Natural)">
                          {LOCAL_NEURAL_VOICES.filter((v) => v.engine === 'piper').map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name} ({v.accent}) — {v.description}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="System Fallback (Always Available)">
                          {LOCAL_NEURAL_VOICES.filter((v) => v.engine === 'system').map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name} — {v.description}
                            </option>
                          ))}
                        </optgroup>
                      </select>

                      {/* Model Download Status & Actions */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                        {LOCAL_NEURAL_VOICES.filter((v) => v.engine !== 'system').map((v) => (
                          <div
                            key={v.id}
                            className={`p-3 rounded-lg border transition-colors ${
                              aiConfig.tts_voice_id === v.id
                                ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/20'
                                : 'border-outline-variant/20 bg-surface-container-low hover:border-outline-variant/40'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <span className="text-[12px] font-semibold text-on-surface truncate">{v.name}</span>
                                <span className="text-[10px] text-on-surface-variant uppercase tracking-wider">{v.engine}</span>
                              </div>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono shrink-0 ${
                                modelDownloadStatus[v.id] === 'downloaded'
                                  ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                  : modelDownloadStatus[v.id] === 'downloading'
                                  ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                                  : 'bg-surface-container border border-outline-variant/30 text-on-surface-variant'
                              }`}>
                                {modelDownloadStatus[v.id] === 'downloaded' ? '✓ Downloaded' : modelDownloadStatus[v.id] === 'downloading' ? '⬇ Downloading...' : '⬇ Not Downloaded'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {modelDownloadStatus[v.id] !== 'downloaded' && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    setModelDownloadStatus(prev => ({ ...prev, [v.id]: 'downloading' }));
                                    try {
                                      await speechService.downloadLocalModel(v.id);
                                      setModelDownloadStatus(prev => ({ ...prev, [v.id]: 'downloaded' }));
                                      toast.success(`${v.name} model downloaded successfully`);
                                    } catch (err) {
                                      setModelDownloadStatus(prev => ({ ...prev, [v.id]: 'not_downloaded' }));
                                      toast.error(`Failed to download ${v.name}: ${String(err)}`);
                                    }
                                  }}
                                  disabled={modelDownloadStatus[v.id] === 'downloading'}
                                  className="flex-1 px-2 py-1.5 text-[11px] font-medium rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  Download Model
                                </button>
                              )}
                              {modelDownloadStatus[v.id] === 'downloaded' && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await speechService.previewVoice(v.id);
                                    toast.info(`Playing ${v.name} sample...`);
                                  }}
                                  className="flex-1 px-2 py-1.5 text-[11px] font-medium rounded-lg bg-primary-container text-on-primary-container hover:bg-primary-container/90 transition-colors"
                                >
                                  Test Voice
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={async () => {
                      await aiAgentService.saveSettings(aiConfig);
                      toast.success('AI Agent configuration saved');
                    }}
                    className="px-[20px] py-[10px] bg-primary text-on-primary text-[13px] font-semibold rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
                  >
                    Save AI Settings
                  </button>
                </div>
              </div>
            </section>
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
