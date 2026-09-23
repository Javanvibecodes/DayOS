import { create } from 'zustand';
import { playAlarm, stopAlarm } from '@/services/alarmService';
import { useSettingsStore } from '@/stores/settingsStore';

export type PomodoroPhase = 'focus' | 'break';

interface PomodoroState {
  running: boolean;
  phase: PomodoroPhase;
  secondsLeft: number;
  currentBlock: number;
  totalBlocks: number;
  completed: boolean;
  start: () => void;
  pause: () => void;
  reset: () => void;
  skip: () => void;
}

function computeTotalBlocks(sessionMinutes: number, focusMinutes: number, breakMinutes: number): number {
  const s = Math.max(1, sessionMinutes);
  const f = Math.max(1, focusMinutes);
  const b = Math.max(0, breakMinutes);
  if (b === 0) return Math.max(1, Math.floor(s / f));
  return Math.max(1, Math.floor((s + b) / (f + b)));
}

function phaseSeconds(phase: PomodoroPhase): number {
  const s = useSettingsStore.getState();
  const minutes = phase === 'focus' ? s.pomodoroFocusMinutes : s.pomodoroBreakMinutes;
  return Math.max(1, minutes) * 60;
}

function playPhaseAlarm() {
  const s = useSettingsStore.getState();
  if (s.soundEnabled) playAlarm(s.pomodoroTune);
}

let intervalId: number | null = null;

function clearTick() {
  if (intervalId !== null) {
    window.clearInterval(intervalId);
    intervalId = null;
  }
}

function advance() {
  const state = usePomodoroStore.getState();
  const s = useSettingsStore.getState();
  const totalBlocks = computeTotalBlocks(s.pomodoroSessionMinutes, s.pomodoroFocusMinutes, s.pomodoroBreakMinutes);

  playPhaseAlarm();

  if (state.phase === 'focus') {
    if (state.currentBlock >= totalBlocks) {
      usePomodoroStore.setState({
        running: false,
        completed: true,
        secondsLeft: 0,
      });
      clearTick();
      return;
    }
    usePomodoroStore.setState({
      phase: 'break',
      secondsLeft: phaseSeconds('break'),
    });
    return;
  }

  // break → next focus
  const nextBlock = state.currentBlock + 1;
  if (nextBlock > totalBlocks) {
    usePomodoroStore.setState({
      running: false,
      completed: true,
      secondsLeft: 0,
    });
    clearTick();
    return;
  }
  usePomodoroStore.setState({
    phase: 'focus',
    currentBlock: nextBlock,
    secondsLeft: phaseSeconds('focus'),
  });
}

function tick() {
  const state = usePomodoroStore.getState();
  if (!state.running) return;

  if (state.secondsLeft <= 1) {
    advance();
    return;
  }
  usePomodoroStore.setState({ secondsLeft: state.secondsLeft - 1 });
}

export const usePomodoroStore = create<PomodoroState>((set, get) => ({
  running: false,
  phase: 'focus',
  secondsLeft: 0,
  currentBlock: 1,
  totalBlocks: 1,
  completed: false,

  start: () => {
    const s = useSettingsStore.getState();
    const totalBlocks = computeTotalBlocks(
      s.pomodoroSessionMinutes,
      s.pomodoroFocusMinutes,
      s.pomodoroBreakMinutes,
    );
    const state = get();

    if (state.completed) {
      stopAlarm();
      set({
        running: true,
        completed: false,
        phase: 'focus',
        currentBlock: 1,
        totalBlocks,
        secondsLeft: phaseSeconds('focus'),
      });
    } else if (state.secondsLeft === 0) {
      set({
        running: true,
        totalBlocks,
        secondsLeft: phaseSeconds(state.phase),
      });
    } else {
      set({ running: true, totalBlocks });
    }

    clearTick();
    intervalId = window.setInterval(tick, 1000);
  },

  pause: () => {
    set({ running: false });
    clearTick();
    stopAlarm();
  },

  reset: () => {
    clearTick();
    stopAlarm();
    const s = useSettingsStore.getState();
    set({
      running: false,
      completed: false,
      phase: 'focus',
      currentBlock: 1,
      totalBlocks: computeTotalBlocks(
        s.pomodoroSessionMinutes,
        s.pomodoroFocusMinutes,
        s.pomodoroBreakMinutes,
      ),
      secondsLeft: phaseSeconds('focus'),
    });
  },

  skip: () => {
    if (!get().running) return;
    stopAlarm();
    advance();
    if (get().running && intervalId === null) {
      intervalId = window.setInterval(tick, 1000);
    }
  },
}));

/** Recompute block count when session config changes (does not touch a running timer). */
export function refreshPomodoroConfig() {
  const s = useSettingsStore.getState();
  const totalBlocks = computeTotalBlocks(
    s.pomodoroSessionMinutes,
    s.pomodoroFocusMinutes,
    s.pomodoroBreakMinutes,
  );
  const state = usePomodoroStore.getState();
  if (!state.running && !state.completed) {
    usePomodoroStore.setState({
      totalBlocks,
      secondsLeft: phaseSeconds(state.phase),
      currentBlock: Math.min(state.currentBlock, totalBlocks),
    });
  } else {
    usePomodoroStore.setState({ totalBlocks });
  }
}
