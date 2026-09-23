import { useEffect, useState } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';
import { usePomodoroStore, refreshPomodoroConfig } from '@/stores/pomodoroStore';

function formatTime(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

const DURATION_HINTS = {
  session: 'Total wall-clock length of the whole session (focus + breaks)',
  focus: 'Length of each focus block',
  break: 'Rest between focus blocks',
};

export function PomodoroPage() {
  const settings = useSettingsStore();
  const pom = usePomodoroStore();
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (pom.secondsLeft === 0 && !pom.running && !pom.completed && pom.currentBlock === 1 && pom.phase === 'focus') {
      refreshPomodoroConfig();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const setNum = (key: 'pomodoroSessionMinutes' | 'pomodoroFocusMinutes' | 'pomodoroBreakMinutes', value: number) => {
    const v = Math.max(key === 'pomodoroBreakMinutes' ? 0 : 1, Math.floor(value) || 0);
    void settings.updateSetting(key, v);
    setTimeout(() => refreshPomodoroConfig(), 0);
  };

  const sessionHours = Math.floor(settings.pomodoroSessionMinutes / 60);
  const sessionMins = settings.pomodoroSessionMinutes % 60;

  const setSessionFromHM = (h: number, m: number) => {
    const total = Math.max(5, h * 60 + m);
    void settings.updateSetting('pomodoroSessionMinutes', total);
    setTimeout(() => refreshPomodoroConfig(), 0);
  };

  const handleStart = () => {
    if (pom.completed) showToast('Session complete — reset to start a new one');
    pom.start();
  };

  const totalSeconds = (() => {
    const { phase, currentBlock, totalBlocks, secondsLeft, running, completed } = pom;
    if (completed) return 0;
    const focusSec = Math.max(1, settings.pomodoroFocusMinutes) * 60;
    const breakSec = Math.max(0, settings.pomodoroBreakMinutes) * 60;
    // Remaining in current phase + remaining full blocks
    const remainingCurrent = secondsLeft;
    let remaining = remainingCurrent;
    if (phase === 'focus') {
      for (let b = currentBlock; b < totalBlocks; b++) {
        remaining += breakSec + focusSec;
      }
    } else {
      // in break for currentBlock; remaining focus blocks after this
      for (let b = currentBlock + 1; b <= totalBlocks; b++) {
        remaining += focusSec;
        if (b < totalBlocks) remaining += breakSec;
      }
    }
    if (!running && secondsLeft === Math.max(1, settings.pomodoroFocusMinutes) * 60 && currentBlock === 1 && phase === 'focus') {
      // Not started — show full planned duration
      return Math.max(1, settings.pomodoroSessionMinutes) * 60;
    }
    return remaining;
  })();

  const plannedTotal = Math.max(1, settings.pomodoroSessionMinutes) * 60;
  const progress = pom.completed
    ? 100
    : plannedTotal <= 0
      ? 0
      : Math.min(100, Math.max(0, ((plannedTotal - totalSeconds) / plannedTotal) * 100));

  const phaseLabel = pom.completed
    ? 'Session complete'
    : pom.phase === 'focus'
      ? 'Focus'
      : 'Break';

  const sliderField = (
    label: string,
    value: number,
    min: number,
    max: number,
    step: number,
    onChange: (n: number) => void,
    display: string,
    hint: string,
  ) => (
    <label className="flex flex-col gap-[8px] flex-1 min-w-[160px]">
      <div className="flex items-center justify-between gap-[8px]">
        <span className="text-[12px] font-semibold text-on-surface-variant">{label}</span>
        <span className="text-[12px] font-bold text-primary font-mono">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onWheel={(e) => e.currentTarget.blur()}
        className="w-full h-[6px] appearance-none rounded-full bg-surface-container-highest accent-primary cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-[16px] [&::-webkit-slider-thumb]:h-[16px] [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer"
      />
      <span className="text-[11px] text-on-surface-variant/70 leading-4">{hint}</span>
    </label>
  );

  return (
    <div className="p-[32px] max-w-[960px] mx-auto flex flex-col gap-[28px]">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-primary text-on-primary font-semibold text-[13px] px-[16px] py-[10px] rounded-xl shadow-2xl flex items-center gap-[12px]">
          <span className="material-symbols-outlined text-[18px]">info</span>
          {toast}
        </div>
      )}

      <div className="mt-[8px]">
        <h2 className="text-[28px] leading-9 font-semibold text-on-surface mb-[8px] flex items-center gap-[12px]">
          <span className="material-symbols-outlined text-[32px] text-primary">timer</span>
          Pomodoro
        </h2>
        <p className="text-[14px] text-on-surface-variant">
          Focus sessions with breaks in between — e.g. a 4-hour session of 25-minute focus blocks and 5-minute breaks.
        </p>
      </div>

      {/* Session setup */}
      <section className="bg-surface rounded-2xl border border-outline-variant/30 p-[28px] flex flex-col gap-[20px] shadow-sm">
        <h3 className="text-[16px] font-bold text-on-surface flex items-center gap-[12px]">
          <span className="material-symbols-outlined text-primary text-[22px]">settings</span>
          Session Setup
        </h3>
        <div className="flex flex-col gap-[20px]">
          {/* Total session — hour + minute sliders */}
          <div className="flex flex-col gap-[10px]">
            <div className="flex items-center justify-between gap-[8px]">
              <span className="text-[12px] font-semibold text-on-surface-variant">Total session</span>
              <span className="text-[13px] font-bold text-primary font-mono">
                {sessionHours}h {sessionMins}m
              </span>
            </div>
            <div className="flex flex-wrap gap-[24px]">
              {sliderField(
                'Hours',
                sessionHours,
                0,
                12,
                1,
                (h) => setSessionFromHM(h, sessionMins),
                `${sessionHours} h`,
                '0–12 hours',
              )}
              {sliderField(
                'Minutes',
                sessionMins,
                0,
                59,
                5,
                (m) => setSessionFromHM(sessionHours, m),
                `${sessionMins} m`,
                '0–59 minutes (5-min steps)',
              )}
            </div>
            <p className="text-[11px] text-on-surface-variant/70 leading-4">{DURATION_HINTS.session}</p>
          </div>

          <div className="flex flex-wrap gap-[20px]">
            {sliderField(
              'Focus block',
              settings.pomodoroFocusMinutes,
              1,
              90,
              1,
              (n) => setNum('pomodoroFocusMinutes', n),
              `${settings.pomodoroFocusMinutes} min`,
              DURATION_HINTS.focus,
            )}
            {sliderField(
              'Break',
              settings.pomodoroBreakMinutes,
              0,
              60,
              1,
              (n) => setNum('pomodoroBreakMinutes', n),
              `${settings.pomodoroBreakMinutes} min`,
              DURATION_HINTS.break,
            )}
          </div>
        </div>
        <p className="text-[12px] text-on-surface-variant flex items-center gap-[8px]">
          <span className="material-symbols-outlined text-[16px] text-primary">calculate</span>
          <strong className="text-on-surface">{pom.totalBlocks}</strong>
          focus block{pom.totalBlocks === 1 ? '' : 's'} ·
          <strong className="text-on-surface">{settings.pomodoroFocusMinutes}</strong> min focus ·
          <strong className="text-on-surface">{settings.pomodoroBreakMinutes}</strong> min break
          {pom.totalBlocks > 1 && settings.pomodoroBreakMinutes > 0 && (
            <>
              {' '}between ({settings.pomodoroFocusMinutes + settings.pomodoroBreakMinutes} min cycle)
            </>
          )}
        </p>
      </section>

      {/* Timer */}
      <section className="bg-surface rounded-2xl border border-outline-variant/30 p-[36px] flex flex-col items-center gap-[24px] shadow-sm">
        <div className="flex items-center gap-[12px]">
          <span
            className={`px-[14px] py-[6px] rounded-full text-[12px] font-bold uppercase tracking-wide ${
              pom.completed
                ? 'bg-primary-container text-on-primary-container'
                : pom.phase === 'focus'
                  ? 'bg-primary-container text-on-primary-container'
                  : 'bg-secondary-container text-on-secondary-container'
            }`}
          >
            {phaseLabel}
          </span>
          {!pom.completed && (
            <span className="text-[13px] text-on-surface-variant font-medium">
              Block {pom.currentBlock} of {pom.totalBlocks}
            </span>
          )}
        </div>

        <div
          className={`font-mono font-bold tabular-nums leading-none ${
            pom.phase === 'break' && !pom.completed
              ? 'text-[72px] text-secondary'
              : 'text-[72px] text-on-surface'
          }`}
        >
          {formatTime(pom.completed ? 0 : pom.secondsLeft || Math.max(1, settings.pomodoroFocusMinutes) * 60)}
        </div>

        <div className="w-full max-w-[480px] h-[10px] rounded-full bg-surface-container-highest overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-1000 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-[12px] text-on-surface-variant -mt-[8px]">
          {pom.completed
            ? 'All blocks done — great work.'
            : `${Math.round(progress)}% of session · ~${formatTime(totalSeconds)} remaining`}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-[14px]">
          {!pom.running ? (
            <button
              onClick={handleStart}
              className="px-[28px] py-[12px] rounded-xl bg-primary hover:bg-primary/90 text-on-primary text-[14px] font-bold flex items-center gap-[10px] justify-center text-center shadow-sm"
            >
              <span className="material-symbols-outlined text-[20px]">play_arrow</span>
              {pom.secondsLeft > 0 && !pom.completed ? 'Resume' : 'Start Session'}
            </button>
          ) : (
            <button
              onClick={pom.pause}
              className="px-[28px] py-[12px] rounded-xl bg-surface-container-highest hover:bg-surface-container text-on-surface text-[14px] font-bold flex items-center gap-[10px] justify-center text-center border border-outline-variant/30"
            >
              <span className="material-symbols-outlined text-[20px]">pause</span>
              Pause
            </button>
          )}
          <button
            onClick={pom.skip}
            disabled={!pom.running || pom.completed}
            className="px-[20px] py-[12px] rounded-xl border border-outline-variant/40 text-on-surface text-[13px] font-semibold flex items-center gap-[8px] justify-center text-center hover:bg-surface-container-high disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-[18px]">skip_next</span>
            Skip Block
          </button>
          <button
            onClick={() => {
              pom.reset();
              showToast('Pomodoro reset');
            }}
            className="px-[20px] py-[12px] rounded-xl border border-outline-variant/40 text-on-surface-variant text-[13px] font-semibold flex items-center gap-[8px] justify-center text-center hover:bg-surface-container-high"
          >
            <span className="material-symbols-outlined text-[18px]">restart_alt</span>
            Reset
          </button>
        </div>

        <p className="text-[11px] text-on-surface-variant/70 flex items-center gap-[6px] text-center">
          <span className="material-symbols-outlined text-[14px]">volume_up</span>
          When a block ends, the Pomodoro tune rings until you turn it off (banner or{' '}
          <kbd className="px-[6px] py-[2px] bg-surface-container-highest border border-outline-variant/30 rounded font-mono text-[10px]">
            {settings.shortcuts?.turnOffAlarm ?? 'Ctrl+Shift+A'}
          </kbd>
          ).
        </p>
      </section>

      {/* Block timeline */}
      <section className="bg-surface rounded-2xl border border-outline-variant/30 p-[28px] flex flex-col gap-[16px] shadow-sm">
        <h3 className="text-[16px] font-bold text-on-surface flex items-center gap-[12px]">
          <span className="material-symbols-outlined text-primary text-[22px]">view_list</span>
          Blocks
        </h3>
        <div className="flex flex-wrap gap-[10px]">
          {Array.from({ length: pom.totalBlocks }, (_, i) => {
            const blockNum = i + 1;
            const done = pom.completed || blockNum < pom.currentBlock;
            const active = !pom.completed && blockNum === pom.currentBlock;
            return (
              <div
                key={blockNum}
                title={`Block ${blockNum}: ${settings.pomodoroFocusMinutes}m focus${settings.pomodoroBreakMinutes > 0 && blockNum < pom.totalBlocks ? ` + ${settings.pomodoroBreakMinutes}m break` : ''}`}
                className={`flex items-center gap-[8px] px-[12px] py-[8px] rounded-lg border text-[12px] font-semibold ${
                  active
                    ? 'border-primary bg-primary-container/20 text-primary ring-2 ring-primary/25'
                    : done
                      ? 'border-outline-variant/20 bg-surface-container-low text-on-surface-variant/60'
                      : 'border-outline-variant/25 bg-surface-container text-on-surface-variant'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">
                  {done ? 'check_circle' : active ? 'radio_button_checked' : 'radio_button_unchecked'}
                </span>
                {blockNum}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
