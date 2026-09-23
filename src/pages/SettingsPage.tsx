import { useState, useEffect, useCallback } from 'react';
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
  eventToCombo,
  findConflictingAction,
  setCapturingShortcut,
} from '@/lib/shortcuts';
import type { ShortcutAction } from '@/types';

type SettingsTab = 'general' | 'notifications' | 'appearance' | 'shortcuts' | 'categories' | 'data';
type ThemeMode = 'light' | 'dark' | 'system';
type ThemeColor = 'midnight' | 'paper' | 'forest' | 'aurora';

const THEME_PALETTES: Record<ThemeColor, { primary: string; primaryContainer: string; onPrimary: string; onPrimaryContainer: string; secondary: string; background: string; surface: string; surfaceContainerLow: string; surfaceContainer: string; surfaceContainerHigh: string; onSurface: string; onSurfaceVariant: string; outlineVariant: string; }> = {
  midnight: {
    primary: '#c0c1ff', primaryContainer: '#8083ff', onPrimary: '#1000a9', onPrimaryContainer: '#0d0096',
    secondary: '#ddb7ff', background: '#131315', surface: '#131315',
    surfaceContainerLow: '#1c1b1d', surfaceContainer: '#201f22', surfaceContainerHigh: '#2a2a2c',
    onSurface: '#e5e1e4', onSurfaceVariant: '#c7c4d7', outlineVariant: '#464554',
  },
  paper: {
    primary: '#5b5f9f', primaryContainer: '#e0e0ff', onPrimary: '#ffffff', onPrimaryContainer: '#1a1a4e',
    secondary: '#7c4da0', background: '#f6f5f9', surface: '#f6f5f9',
    surfaceContainerLow: '#eeedf2', surfaceContainer: '#e8e7ed', surfaceContainerHigh: '#dddce4',
    onSurface: '#1b1b1f', onSurfaceVariant: '#46464f', outlineVariant: '#c7c6d0',
  },
  forest: {
    primary: '#6dbf8a', primaryContainer: '#1f4d33', onPrimary: '#ffffff', onPrimaryContainer: '#d4f5e0',
    secondary: '#8fd4a8', background: '#0f1612', surface: '#0f1612',
    surfaceContainerLow: '#162019', surfaceContainer: '#1a2720', surfaceContainerHigh: '#22332a',
    onSurface: '#e0ebe4', onSurfaceVariant: '#b0c4b8', outlineVariant: '#3d5248',
  },
  aurora: {
    primary: '#7dd3fc', primaryContainer: '#0e7490', onPrimary: '#082f49', onPrimaryContainer: '#e0f2fe',
    secondary: '#a78bfa', background: '#0c0a14', surface: '#0c0a14',
    surfaceContainerLow: '#14121f', surfaceContainer: '#1a1728', surfaceContainerHigh: '#252136',
    onSurface: '#e8e6f0', onSurfaceVariant: '#c0bcd4', outlineVariant: '#4a4560',
  },
};

const PALETTE_CSS_VARS = [
  '--primary',
  '--primary-container',
  '--on-primary',
  '--on-primary-container',
  '--secondary',
  '--background',
  '--surface',
  '--surface-container-low',
  '--surface-container',
  '--surface-container-high',
  '--surface-container-highest',
  '--surface-container-lowest',
  '--surface-dim',
  '--surface-bright',
  '--surface-variant',
  '--on-surface',
  '--on-background',
  '--on-surface-variant',
  '--outline',
  '--outline-variant',
  '--secondary-container',
  '--on-secondary',
  '--on-secondary-container',
];

function applyThemePalette(theme: ThemeColor) {
  const p = THEME_PALETTES[theme];
  const r = document.documentElement.style;
  r.setProperty('--primary', p.primary);
  r.setProperty('--primary-container', p.primaryContainer);
  r.setProperty('--on-primary', p.onPrimary);
  r.setProperty('--on-primary-container', p.onPrimaryContainer);
  r.setProperty('--secondary', p.secondary);
  r.setProperty('--background', p.background);
  r.setProperty('--surface', p.surface);
  r.setProperty('--surface-container-low', p.surfaceContainerLow);
  r.setProperty('--surface-container', p.surfaceContainer);
  r.setProperty('--surface-container-high', p.surfaceContainerHigh);
  r.setProperty('--surface-container-highest', p.surfaceContainerHigh);
  r.setProperty('--on-surface', p.onSurface);
  r.setProperty('--on-background', p.onSurface);
  r.setProperty('--on-surface-variant', p.onSurfaceVariant);
  r.setProperty('--outline-variant', p.outlineVariant);
  document.body.style.backgroundColor = p.background;
  document.body.style.color = p.onSurface;
}

/** Remove inline palette overrides so html.light CSS variables take effect. */
function clearThemePalette() {
  const r = document.documentElement.style;
  for (const key of PALETTE_CSS_VARS) r.removeProperty(key);
  document.body.style.backgroundColor = '';
  document.body.style.color = '';
}

function resolveColorMode(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  return mode;
}

function applyAppearance(mode: ThemeMode, theme: ThemeColor) {
  const root = document.documentElement;
  const resolved = resolveColorMode(mode);
  if (resolved === 'light') {
    root.classList.add('light');
    root.classList.remove('dark');
    clearThemePalette();
  } else {
    root.classList.remove('light');
    root.classList.add('dark');
    applyThemePalette(theme);
  }
}

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
  return (
    <div className="p-[16px] rounded-xl bg-surface-container-low flex flex-col gap-[12px]">
      <div className="flex items-center justify-between gap-[16px] flex-wrap">
        <div>
          <p className="text-[14px] font-semibold text-on-surface">{label}</p>
          <p className="text-[12px] text-on-surface-variant">{hint}</p>
        </div>
        <button
          onClick={() => onPreview(current as TuneId)}
          className="px-[14px] py-[8px] rounded-lg border border-outline-variant/40 text-[12px] font-semibold text-on-surface hover:bg-surface-container-high transition-colors flex items-center gap-[8px]"
        >
          <span className="material-symbols-outlined text-[16px]">volume_up</span>
          Preview
        </button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-[10px]" role="radiogroup" aria-label={label}>
        {TUNE_LIBRARY.map((tune) => {
          const selected = current === tune.id;
          return (
            <button
              key={tune.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onSelect(settingKey, tune.id)}
              title={tune.description}
              className={`relative flex flex-col items-start gap-[4px] p-[12px] pr-[28px] rounded-lg border text-left transition-all cursor-pointer ${
                selected
                  ? 'border-primary bg-primary-container/15 ring-2 ring-primary/25 text-primary'
                  : 'border-outline-variant/25 bg-surface-container hover:border-outline-variant hover:bg-surface-container-high text-on-surface-variant'
              }`}
            >
              {selected && (
                <span className="material-symbols-outlined text-[16px] absolute top-[10px] right-[10px]">
                  check_circle
                </span>
              )}
              <span className="text-[13px] font-semibold">{tune.name}</span>
              <span className="text-[11px] leading-4 opacity-70">{tune.description}</span>
            </button>
          );
        })}
      </div>
      {!soundEnabled && (
        <p className="text-[11px] text-on-surface-variant/70 flex items-center gap-[6px]">
          <span className="material-symbols-outlined text-[14px]">info</span>
          Master sound is off — selection still saves; enable Notification Sound to hear alerts.
        </p>
      )}
    </div>
  );
}

export function SettingsPage() {
  const settings = useSettingsStore();
  const { tasks } = useTaskStore();
  const { goals } = useGoalStore();
  const { projects } = useProjectStore();
  const { meetings } = useMeetingStore();
  const { categories, loadCategories, createCategory, deleteCategory } = useCategoryStore();

  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [systemAutostart, setSystemAutostart] = useState<boolean | null>(null);
  const [editingShortcut, setEditingShortcut] = useState<ShortcutAction | null>(null);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#8083ff');

  const shortcuts = settings.shortcuts ?? DEFAULT_SHORTCUTS;

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

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

  const tabs: { id: SettingsTab; icon: string; label: string }[] = [
    { id: 'general', icon: 'tune', label: 'General' },
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
      showToast(
        sys === enabled
          ? enabled
            ? 'Windows startup: ON (matches system)'
            : 'Windows startup: OFF (matches system)'
          : 'Could not update Windows startup settings',
      );
    } catch {
      showToast('Could not update Windows startup settings');
    }
  };

  const handleStartMinimized = (enabled: boolean) => {
    setBool('startMinimized', enabled);
    showToast(enabled ? 'Will start minimized' : 'Will start normally');
  };

  const handleNotifToggle = async (enabled: boolean) => {
    setBool('showNotifications', enabled);
    if (enabled) {
      const ok = await ensureNotifPermission();
      showToast(ok ? 'Desktop notifications enabled' : 'Permission denied for notifications');
      if (ok) {
        try {
          sendNotification({ title: 'DayOS', body: 'Desktop notifications are on.' });
        } catch { /* ignore */ }
      }
    } else {
      showToast('Desktop notifications disabled');
    }
  };

  const handleSoundToggle = (enabled: boolean) => {
    setBool('soundEnabled', enabled);
    if (enabled) playTune('chime');
    showToast(enabled ? 'Sounds enabled' : 'Sounds muted');
  };

  const handleThemeMode = (mode: ThemeMode) => {
    setStr('colorMode', mode);
    applyAppearance(mode, (settings.theme as ThemeColor) || 'midnight');
    showToast(`Mode: ${mode}`);
  };

  const handleThemeColor = (theme: ThemeColor) => {
    setStr('theme', theme);
    applyAppearance(settings.colorMode, theme);
    showToast(`Applied theme: ${theme.toUpperCase()}`);
  };

  const handleTestTune = (id: TuneId) => {
    // Preview always plays (user-initiated); master toggle only gates live alerts
    playTune(id);
    if (!settings.soundEnabled) {
      showToast('Previewing sound (master Notification Sound is off)');
    }
  };

  const handleSelectTune = (key: string, tuneId: string) => {
    void settings.updateSetting(key, tuneId);
    playTune(tuneId);
    const tune = TUNE_LIBRARY.find((t) => t.id === tuneId);
    showToast(`${tune?.name ?? tuneId} selected`);
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
    showToast('Exported DayOS database backup!');
  };

  const handleResetShortcuts = () => {
    void settings.updateSetting('shortcuts', { ...DEFAULT_SHORTCUTS });
    setEditingShortcut(null);
    showToast('Shortcuts reset to defaults!');
  };

  const beginEditShortcut = (action: ShortcutAction) => {
    setEditingShortcut(action);
    setCapturingShortcut(true);
  };

  const cancelEditShortcut = useCallback(() => {
    setEditingShortcut(null);
    setCapturingShortcut(false);
  }, []);

  useEffect(() => {
    if (!editingShortcut) return;

    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === 'Escape') {
        cancelEditShortcut();
        showToast('Shortcut editing cancelled');
        return;
      }

      const combo = eventToCombo(e);
      if (!combo) return; // modifier-only — keep listening

      const conflict = findConflictingAction(shortcuts, combo, editingShortcut);
      if (conflict) {
        showToast(`Already used by "${SHORTCUT_LABELS[conflict]}"`);
        cancelEditShortcut();
        return;
      }

      void settings.updateSetting('shortcuts', {
        ...shortcuts,
        [editingShortcut]: combo,
      });
      setEditingShortcut(null);
      setCapturingShortcut(false);
      showToast(`${SHORTCUT_LABELS[editingShortcut]} → ${combo}`);
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      setCapturingShortcut(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingShortcut, shortcuts]);

  return (
    <div className="p-[32px] max-w-[1280px] mx-auto flex flex-col gap-[32px]">
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-primary text-on-primary font-semibold text-[13px] px-[16px] py-[10px] rounded-xl shadow-2xl flex items-center gap-[18px] animate-in fade-in slide-in-from-bottom-4">
          <span className="material-symbols-outlined text-[18px]">palette</span>
          {toastMsg}
        </div>
      )}

      <div className="mt-[20px]">
        <h2 className="text-[28px] leading-9 font-semibold text-on-surface mb-[20px] flex items-center gap-[12px]">
          <span className="material-symbols-outlined text-[32px] text-primary">settings</span>
          Preferences & Settings
        </h2>
        <p className="text-[14px] text-on-surface-variant">
          Customize your DayOS workflow, themes, keybindings, and system preferences.
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
            </>
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
                        style={{ background: THEME_PALETTES[theme].background }}
                      >
                        <div className="h-2 w-full rounded opacity-80" style={{ background: THEME_PALETTES[theme].primary }} />
                        <div className="h-4 w-3/4 rounded" style={{ background: THEME_PALETTES[theme].surfaceContainerHigh }} />
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

          {/* Shortcuts Tab */}
          {activeTab === 'shortcuts' && (
            <section className="bg-surface rounded-2xl border border-outline-variant/30 overflow-hidden shadow-sm">
              <div className="p-[28px] border-b border-outline-variant/20 flex justify-between items-center bg-surface-container-low">
                <h3 className="text-[18px] font-bold text-on-surface flex items-center gap-[18px] mb-[12px]">
                  <span className="material-symbols-outlined text-primary">keyboard</span> Keyboard Shortcuts
                </h3>
                <button
                  onClick={handleResetShortcuts}
                  className="text-[12px] font-semibold text-primary hover:underline px-[8px] py-[4px] flex items-center justify-center text-center"
                >
                  Reset Defaults
                </button>
              </div>
              <div className="divide-y divide-outline-variant/10">
                {SHORTCUT_ACTIONS.map((action) => {
                  const combo = shortcuts[action] ?? DEFAULT_SHORTCUTS[action];
                  const isEditing = editingShortcut === action;
                  return (
                    <div
                      key={action}
                      className="flex justify-between items-center p-[20px] hover:bg-surface-container-low transition-colors gap-[16px] flex-wrap"
                    >
                      <span className="text-[14px] font-medium text-on-surface">{SHORTCUT_LABELS[action]}</span>
                      {isEditing ? (
                        <div className="flex items-center gap-[12px]">
                          <span className="px-[14px] py-[8px] rounded-lg border-2 border-dashed border-primary bg-primary-container/15 text-[12px] font-semibold text-primary animate-pulse">
                            Press keys… (Esc to cancel)
                          </span>
                          <button
                            onClick={cancelEditShortcut}
                            className="text-[12px] text-on-surface-variant hover:text-on-surface"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-[12px]">
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
                          <button
                            onClick={() => beginEditShortcut(action)}
                            title="Edit shortcut"
                            className="p-[6px] rounded-lg text-on-surface-variant hover:text-primary hover:bg-primary-container/15 transition-colors"
                          >
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="p-[16px] text-[12px] text-on-surface-variant bg-surface-container-low border-t border-outline-variant/10 flex items-center gap-[8px]">
                <span className="material-symbols-outlined text-[16px] text-primary">info</span>
                Click the edit icon, then press the new key combination. Esc cancels. Duplicates are rejected.
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
                        showToast('Category created');
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
                    await createCategory({ name: newCatName.trim(), color: newCatColor });
                    setNewCatName('');
                    showToast('Category created');
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
                {categories.map((c) => (
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
                    <button
                      onClick={async () => {
                        await deleteCategory(c.id);
                        showToast('Category deleted');
                      }}
                      className="material-symbols-outlined text-[18px] text-on-surface-variant hover:text-error shrink-0"
                      title="Delete category"
                    >
                      delete
                    </button>
                  </li>
                ))}
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
    </div>
  );
}
