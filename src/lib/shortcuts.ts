import type { ShortcutAction, ShortcutBindings } from '@/types';

export const DEFAULT_SHORTCUTS: ShortcutBindings = {
  commandPalette: 'Ctrl+K',
  toggleSidebar: 'Ctrl+\\',
  newTask: 'Ctrl+Shift+T',
  newGoal: 'Alt+G',
  newMeeting: 'Ctrl+Shift+M',
  newProject: 'Ctrl+Shift+P',
  toggleTimetable: 'Ctrl+Shift+D',
  turnOffAlarm: 'Ctrl+Shift+A',
  openPomodoro: 'Ctrl+Shift+F',
};

export const SHORTCUT_LABELS: Record<ShortcutAction, string> = {
  commandPalette: 'Global Command Palette',
  toggleSidebar: 'Toggle Sidebar Collapse',
  newTask: 'New Task Modal',
  newGoal: 'Quick Goal Creation',
  newMeeting: 'New Meeting',
  newProject: 'New Project',
  toggleTimetable: 'Toggle Timetable',
  turnOffAlarm: 'Turn Off Alarm',
  openPomodoro: 'Open Pomodoro',
};

export const SHORTCUT_ACTIONS = Object.keys(DEFAULT_SHORTCUTS) as ShortcutAction[];

const MODIFIER_KEYS = new Set(['Control', 'Shift', 'Alt', 'Meta', 'CapsLock', 'AltGraph']);

let capturing = false;

export function setCapturingShortcut(value: boolean) {
  capturing = value;
}

export function isCapturingShortcut() {
  return capturing;
}

/** Build a normalized combo string (e.g. "Ctrl+Shift+T") from a keyboard event. */
export function eventToCombo(e: KeyboardEvent): string | null {
  if (MODIFIER_KEYS.has(e.key)) return null;

  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');

  let key = e.key;
  if (key === ' ') key = 'Space';
  else if (key === '\\') key = '\\';
  else if (key.length === 1) key = key.toUpperCase();
  else if (key === 'Escape') key = 'Escape';
  else if (key === 'Enter') key = 'Enter';
  else if (key === 'Tab') key = 'Tab';
  else return null;

  parts.push(key);
  return parts.join('+');
}

export function comboMatches(e: KeyboardEvent, binding: string): boolean {
  const combo = eventToCombo(e);
  if (!combo) return false;
  return combo === binding;
}

export function comboToKeys(combo: string): string[] {
  return combo.split('+');
}

export function findConflictingAction(
  bindings: ShortcutBindings,
  combo: string,
  exclude: ShortcutAction,
): ShortcutAction | null {
  for (const action of SHORTCUT_ACTIONS) {
    if (action !== exclude && bindings[action] === combo) return action;
  }
  return null;
}
