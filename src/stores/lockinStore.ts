import { create } from 'zustand';
import type { LockinSession, LockinParticipant, LockinPhase } from '@/types';
import { playNotificationChime } from '@/services/alarmService';

interface LockinState {
  activeSession: LockinSession | null;
  participants: LockinParticipant[];
  isHost: boolean;
  myTaskTitle: string;
  isJoined: boolean;

  // Actions
  hostSession: (title: string, durationMinutes?: number, hostName?: string, hostDeviceId?: string) => void;
  joinSession: (pinCode: string, participantName: string, participantDeviceId: string) => boolean;
  leaveSession: () => void;
  setMyTaskTitle: (title: string) => void;

  // Timer controls (Host or local sync)
  startTimer: () => void;
  pauseTimer: () => void;
  resetTimer: () => void;
  tickTimer: () => void;
  switchPhase: (phase: LockinPhase) => void;
}

let timerInterval: ReturnType<typeof setInterval> | null = null;

function generatePin(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

export const useLockinStore = create<LockinState>((set, get) => ({
  activeSession: null,
  participants: [],
  isHost: false,
  myTaskTitle: '',
  isJoined: false,

  hostSession: (title, durationMinutes = 25, hostName = 'Host', hostDeviceId = 'dev_local') => {
    if (timerInterval) clearInterval(timerInterval);

    const pin = generatePin();
    const session: LockinSession = {
      id: `lockin_${Date.now()}`,
      title: title || 'Deep Work Lock-in',
      host_device_id: hostDeviceId,
      host_device_name: hostName,
      pin_code: pin,
      current_phase: 'focus',
      duration_minutes: durationMinutes,
      remaining_seconds: durationMinutes * 60,
      is_running: false,
      participant_count: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const hostParticipant: LockinParticipant = {
      device_id: hostDeviceId,
      device_name: `${hostName} (Host)`,
      is_host: true,
      status: 'idle',
      joined_at: new Date().toISOString(),
    };

    set({
      activeSession: session,
      participants: [hostParticipant],
      isHost: true,
      isJoined: true,
    });
  },

  joinSession: (pinCode, participantName, participantDeviceId) => {
    const trimmedPin = pinCode.trim();
    if (!trimmedPin || trimmedPin.length < 4) return false;

    // Connect to room (or create virtual peer join)
    const session: LockinSession = {
      id: `lockin_${trimmedPin}`,
      title: `Shared Lock-in (${trimmedPin})`,
      host_device_id: 'host_peer',
      host_device_name: 'Peer Host',
      pin_code: trimmedPin,
      current_phase: 'focus',
      duration_minutes: 25,
      remaining_seconds: 25 * 60,
      is_running: true,
      participant_count: 2,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const me: LockinParticipant = {
      device_id: participantDeviceId,
      device_name: participantName,
      is_host: false,
      status: 'focusing',
      joined_at: new Date().toISOString(),
    };

    const host: LockinParticipant = {
      device_id: 'dev_host',
      device_name: 'Host Device',
      is_host: true,
      status: 'focusing',
      joined_at: new Date().toISOString(),
    };

    set({
      activeSession: session,
      participants: [host, me],
      isHost: false,
      isJoined: true,
    });

    // Start sync tick
    get().startTimer();
    return true;
  },

  leaveSession: () => {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    set({
      activeSession: null,
      participants: [],
      isHost: false,
      isJoined: false,
      myTaskTitle: '',
    });
  },

  setMyTaskTitle: (title: string) => {
    set({ myTaskTitle: title });
  },

  startTimer: () => {
    const session = get().activeSession;
    if (!session) return;

    if (timerInterval) clearInterval(timerInterval);

    set({
      activeSession: { ...session, is_running: true },
      participants: get().participants.map((p) => ({ ...p, status: 'focusing' })),
    });

    timerInterval = setInterval(() => {
      get().tickTimer();
    }, 1000);
  },

  pauseTimer: () => {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    const session = get().activeSession;
    if (!session) return;

    set({
      activeSession: { ...session, is_running: false },
      participants: get().participants.map((p) => ({ ...p, status: 'idle' })),
    });
  },

  resetTimer: () => {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    const session = get().activeSession;
    if (!session) return;

    set({
      activeSession: {
        ...session,
        is_running: false,
        remaining_seconds: session.duration_minutes * 60,
      },
      participants: get().participants.map((p) => ({ ...p, status: 'idle' })),
    });
  },

  tickTimer: () => {
    const session = get().activeSession;
    if (!session || !session.is_running) return;

    if (session.remaining_seconds > 1) {
      set({
        activeSession: {
          ...session,
          remaining_seconds: session.remaining_seconds - 1,
        },
      });
    } else {
      // Phase completed!
      playNotificationChime();
      const nextPhase: LockinPhase = session.current_phase === 'focus' ? 'short_break' : 'focus';
      get().switchPhase(nextPhase);
    }
  },

  switchPhase: (phase: LockinPhase) => {
    const session = get().activeSession;
    if (!session) return;

    const duration = phase === 'focus' ? session.duration_minutes : phase === 'short_break' ? 5 : 15;
    set({
      activeSession: {
        ...session,
        current_phase: phase,
        remaining_seconds: duration * 60,
      },
      participants: get().participants.map((p) => ({
        ...p,
        status: phase === 'focus' ? 'focusing' : 'resting',
      })),
    });
  },
}));

