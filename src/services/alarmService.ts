let audioCtx: AudioContext | null = null;
let alarmInterval: number | null = null;

export type TuneId =
  | 'chime'
  | 'bell'
  | 'digital'
  | 'marimba'
  | 'alert'
  | 'soft'
  | 'urgent'
  | 'success';

export interface TuneInfo {
  id: TuneId;
  name: string;
  description: string;
}

export const TUNE_LIBRARY: TuneInfo[] = [
  { id: 'chime', name: 'Chime', description: 'Classic two-note notification chime' },
  { id: 'bell', name: 'Bell', description: 'Clear service-bell ding' },
  { id: 'digital', name: 'Digital', description: 'Modern double-beep' },
  { id: 'marimba', name: 'Marimba', description: 'Soft wooden mallet notes' },
  { id: 'alert', name: 'Alert', description: 'Attention-raising pulse' },
  { id: 'soft', name: 'Soft', description: 'Gentle low-key tones' },
  { id: 'urgent', name: 'Urgent', description: 'Fast repeating urgency' },
  { id: 'success', name: 'Success', description: 'Rising accomplishment jingle' },
];

type AlarmListener = (ringing: boolean) => void;
const alarmListeners = new Set<AlarmListener>();

export function isAlarmRinging(): boolean {
  return alarmInterval !== null;
}

export function onAlarmChange(listener: AlarmListener): () => void {
  alarmListeners.add(listener);
  return () => {
    alarmListeners.delete(listener);
  };
}

function notifyAlarmListeners() {
  const ringing = alarmInterval !== null;
  alarmListeners.forEach((fn) => fn(ringing));
}

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function tone(
  freq: number,
  start: number,
  duration: number,
  gainVal: number,
  type: OscillatorType = 'sine',
) {
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, ctx.currentTime + start);
  gain.gain.linearRampToValueAtTime(gainVal, ctx.currentTime + start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime + start);
  osc.stop(ctx.currentTime + start + duration);
}

export function playTune(id: TuneId | string): void {
  const tune = (TUNE_LIBRARY.find((t) => t.id === id)?.id ?? 'chime') as TuneId;

  switch (tune) {
    case 'bell':
      tone(1318, 0, 0.35, 0.25, 'triangle');
      tone(1760, 0.08, 0.4, 0.15, 'sine');
      break;
    case 'digital':
      tone(880, 0, 0.1, 0.2, 'square');
      tone(880, 0.15, 0.1, 0.2, 'square');
      tone(1100, 0.3, 0.12, 0.18, 'square');
      break;
    case 'marimba':
      tone(523, 0, 0.2, 0.22, 'sine');
      tone(659, 0.12, 0.2, 0.2, 'sine');
      tone(784, 0.24, 0.25, 0.18, 'sine');
      break;
    case 'alert':
      tone(740, 0, 0.12, 0.25, 'sawtooth');
      tone(740, 0.18, 0.12, 0.25, 'sawtooth');
      tone(740, 0.36, 0.15, 0.22, 'sawtooth');
      break;
    case 'soft':
      tone(392, 0, 0.3, 0.15, 'sine');
      tone(494, 0.15, 0.35, 0.14, 'sine');
      tone(587, 0.3, 0.4, 0.12, 'sine');
      break;
    case 'urgent':
      tone(988, 0, 0.08, 0.28, 'square');
      tone(988, 0.1, 0.08, 0.28, 'square');
      tone(1175, 0.2, 0.08, 0.28, 'square');
      tone(988, 0.3, 0.08, 0.28, 'square');
      tone(1175, 0.4, 0.12, 0.28, 'square');
      break;
    case 'success':
      tone(523, 0, 0.15, 0.2, 'sine');
      tone(659, 0.12, 0.15, 0.2, 'sine');
      tone(784, 0.24, 0.15, 0.2, 'sine');
      tone(1047, 0.36, 0.3, 0.22, 'sine');
      break;
    case 'chime':
    default:
      tone(880, 0, 0.15, 0.2);
      tone(1108, 0.12, 0.2, 0.18);
      break;
  }
}

/** Repeats until stopAlarm() is called via the Stop button. */
export function playAlarm(tuneId?: string) {
  stopAlarm();
  const id = (tuneId ?? 'alert') as TuneId;
  const playBeep = () => playTune(id);
  playBeep();
  alarmInterval = window.setInterval(playBeep, 1400);
  notifyAlarmListeners();
}

/** Meeting/task notification — also repeats until dismissed. */
export function playNotificationChime(tuneId?: string) {
  playAlarm(tuneId ?? 'chime');
}

export function stopAlarm() {
  if (alarmInterval !== null) {
    clearInterval(alarmInterval);
    alarmInterval = null;
    notifyAlarmListeners();
  }
}
