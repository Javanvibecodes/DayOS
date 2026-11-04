import { useEffect, useMemo, useRef, useState } from 'react';
import { useRoutineStore } from '@/stores/routineStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { toast } from '@/stores/toastStore';

function formatMins(total: number): string {
  const m = Math.max(0, Math.floor(total));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h > 0) return `${h}h ${r}m`;
  return `${r}m`;
}

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

const DAY_LABELS = [
  { v: '1', label: 'Mon' },
  { v: '2', label: 'Tue' },
  { v: '3', label: 'Wed' },
  { v: '4', label: 'Thu' },
  { v: '5', label: 'Fri' },
  { v: '6', label: 'Sat' },
  { v: '0', label: 'Sun' },
];

interface RunState {
  routineId: string;
  taskIndex: number;
  taskElapsed: number; // seconds
  totalElapsed: number;
  running: boolean;
}

export function RoutinesPage() {
  const {
    routines,
    routineTasks,
    loadRoutines,
    loadRoutineTasks,
    createRoutine,
    updateRoutine,
    deleteRoutine,
    createRoutineTask,
    updateRoutineTask,
    deleteRoutineTask,
    tasksFor,
  } = useRoutineStore();
  const settings = useSettingsStore();

  const [editingRoutineId, setEditingRoutineId] = useState<string | null>(null);
  const [routineName, setRoutineName] = useState('');
  const [routineStart, setRoutineStart] = useState('');
  const [routineDays, setRoutineDays] = useState<string[]>(['1', '2', '3', '4', '5']);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDuration, setTaskDuration] = useState(10);
  const [pendingTasks, setPendingTasks] = useState<{ title: string; duration_minutes: number }[]>([]);
  const [run, setRun] = useState<RunState | null>(null);
  const runRef = useRef<RunState | null>(null);
  runRef.current = run;

  useEffect(() => {
    void loadRoutines();
    void loadRoutineTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Run timer
  useEffect(() => {
    if (!run?.running) return;
    const id = setInterval(() => {
      setRun((prev) => {
        if (!prev || !prev.running) return prev;
        return {
          ...prev,
          taskElapsed: prev.taskElapsed + 1,
          totalElapsed: prev.totalElapsed + 1,
        };
      });
    }, 1000);
    return () => clearInterval(id);
  }, [run?.running]);

  const requireHalf = Boolean(settings.routine_require_half_to_skip);
  const currentRoutine = run ? routines.find((r) => r.id === run.routineId) : null;
  const currentTasks = run ? tasksFor(run.routineId) : [];
  const currentTask = run ? currentTasks[run.taskIndex] : null;
  const currentTaskDurationSec = (currentTask?.duration_minutes ?? 0) * 60;
  const currentTotalSec = currentTasks.reduce((s, t) => s + t.duration_minutes * 60, 0);

  const canSkipCurrent = () => {
    if (!run || !currentTask) return false;
    if (!requireHalf) return true;
    return run.taskElapsed >= Math.floor(currentTaskDurationSec / 2);
  };

  const startRun = (routineId: string) => {
    const tasks = tasksFor(routineId);
    if (tasks.length === 0) {
      toast.info('Add at least one block before starting');
      return;
    }
    setRun({ routineId, taskIndex: 0, taskElapsed: 0, totalElapsed: 0, running: true });
  };

  const togglePause = () => {
    setRun((prev) => (prev ? { ...prev, running: !prev.running } : prev));
  };

  const skipTask = () => {
    if (!run) return;
    if (!canSkipCurrent()) {
      toast.info(
        requireHalf
          ? `You can skip once ${formatMins((currentTask?.duration_minutes ?? 0) / 2)} of this block has passed`
          : 'This block cannot be skipped yet',
      );
      return;
    }
    // Count skipped task as fully completed for overall progress
    const remainingInTask = Math.max(0, currentTaskDurationSec - run.taskElapsed);
    const boostedTotal = run.totalElapsed + remainingInTask;
    if (run.taskIndex + 1 >= currentTasks.length) {
      setRun(null);
      toast.success('Routine complete');
      return;
    }
    setRun({
      ...run,
      taskIndex: run.taskIndex + 1,
      taskElapsed: 0,
      totalElapsed: boostedTotal,
    });
  };

  const stopRun = () => setRun(null);

  const openEditRoutine = (id: string) => {
    const r = routines.find((x) => x.id === id);
    if (!r) return;
    setEditingRoutineId(id);
    setRoutineName(r.name);
    setRoutineStart(r.start_time || '');
    setRoutineDays(r.days ? r.days.split(',').filter(Boolean) : ['1', '2', '3', '4', '5']);
    setTaskTitle('');
    setTaskDuration(10);
    setPendingTasks([]);
  };

  const closeEditRoutine = () => {
    setEditingRoutineId(null);
    setRoutineName('');
    setRoutineStart('');
    setRoutineDays(['1', '2', '3', '4', '5']);
    setTaskTitle('');
    setTaskDuration(10);
    setPendingTasks([]);
  };

  const removeRoutine = async (id: string) => {
    if (run?.routineId === id) setRun(null);
    await deleteRoutine(id);
    if (editingRoutineId === id) closeEditRoutine();
    toast.success('Routine deleted');
  };

  const addRoutineTask = async () => {
    if (!taskTitle.trim()) return;
    const duration = Math.max(1, taskDuration);
    if (editingRoutineId === 'new') {
      setPendingTasks((prev) => [...prev, { title: taskTitle.trim(), duration_minutes: duration }]);
      setTaskTitle('');
      setTaskDuration(10);
      return;
    }
    if (!editingRoutineId) return;
    const existing = tasksFor(editingRoutineId);
    await createRoutineTask({
      routine_id: editingRoutineId,
      title: taskTitle.trim(),
      duration_minutes: duration,
      sort_order: existing.length,
    });
    setTaskTitle('');
    setTaskDuration(10);
  };

  const removePendingTask = (index: number) => {
    setPendingTasks((prev) => prev.filter((_, i) => i !== index));
  };

  const saveRoutine = async () => {
    if (!routineName.trim()) {
      toast.error('Enter a routine name');
      return;
    }
    if (editingRoutineId === 'new') {
      const r = await createRoutine({
        name: routineName.trim(),
        start_time: routineStart || undefined,
        days: routineDays.join(','),
      });
      for (let i = 0; i < pendingTasks.length; i++) {
        const pt = pendingTasks[i];
        await createRoutineTask({
          routine_id: r.id,
          title: pt.title,
          duration_minutes: pt.duration_minutes,
          sort_order: i,
        });
      }
      setPendingTasks([]);
      setEditingRoutineId(r.id);
      setTaskTitle('');
      setTaskDuration(10);
      toast.success(
        pendingTasks.length > 0
          ? `Routine created with ${pendingTasks.length} block${pendingTasks.length === 1 ? '' : 's'}`
          : 'Routine created — add blocks to get started',
      );
      return;
    }
    if (editingRoutineId !== 'new' && editingRoutineId) {
      await updateRoutine({
        id: editingRoutineId,
        name: routineName.trim(),
        start_time: routineStart || undefined,
        days: routineDays.join(','),
      });
      toast.success('Routine updated');
      closeEditRoutine();
      return;
    }
    // 'new' with no valid path should not reach here — saveRoutine handles 'new' above
    toast.error('Enter a routine name');
  };

  const editingTasks = useMemo(
    () => (editingRoutineId && editingRoutineId !== 'new' ? tasksFor(editingRoutineId) : []),
    [editingRoutineId, routineTasks], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const shownTasks = editingRoutineId === 'new'
    ? pendingTasks.map((p, i) => ({
        id: `pending-${i}`,
        routine_id: 'new',
        title: p.title,
        duration_minutes: p.duration_minutes,
        sort_order: i,
        created_at: '',
      }))
    : editingTasks;

  if (run && currentRoutine && currentTask) {
    const taskProgress = currentTaskDurationSec > 0
      ? Math.min(100, (run.taskElapsed / currentTaskDurationSec) * 100)
      : 100;
    const totalProgress = currentTotalSec > 0
      ? Math.min(100, (run.totalElapsed / currentTotalSec) * 100)
      : 0;

    return (
      <div className="p-[40px]">
        <div className="max-w-[720px] mx-auto flex flex-col gap-[24px]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-wider text-on-surface-variant mb-[8px]">Running routine</p>
              <h2 className="text-[24px] font-bold text-on-surface">{currentRoutine.name}</h2>
            </div>
            <button
              onClick={stopRun}
              className="px-[20px] py-[10px] border border-outline-variant/40 hover:bg-surface-container-high text-on-surface text-[13px] font-semibold rounded-lg text-center"
            >
              Stop
            </button>
          </div>

          <div className="bg-surface rounded-xl border border-outline-variant/30 p-[32px] shadow-sm">
            <p className="text-[12px] font-semibold uppercase tracking-wider text-on-surface-variant mb-[12px]">
              Step {run.taskIndex + 1} of {currentTasks.length}
            </p>
            <h3 className="text-[20px] font-bold text-on-surface mb-[8px]">{currentTask.title}</h3>
            <p className="text-[13px] text-on-surface-variant mb-[20px]">
              Planned {formatMins(currentTask.duration_minutes)} · Elapsed {formatClock(run.taskElapsed)}
              {requireHalf && (
                <span className="ml-[8px] text-primary">
                  half at {formatClock(Math.floor(currentTaskDurationSec / 2))}
                </span>
              )}
            </p>

            <div className="w-full h-2 bg-surface-container-highest rounded-full overflow-hidden mb-[28px]">
              <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${taskProgress}%` }} />
            </div>

            <div className="flex justify-between items-center mb-[12px] text-[12px] text-on-surface-variant">
              <span>Overall progress</span>
              <span className="font-mono font-bold text-primary">{Math.round(totalProgress)}%</span>
            </div>
            <div className="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden mb-[28px]">
              <div className="h-full bg-tertiary rounded-full transition-all duration-500" style={{ width: `${totalProgress}%` }} />
            </div>

            <div className="flex gap-[16px] flex-wrap">
              <button
                onClick={togglePause}
                className="flex-1 min-w-[120px] px-[20px] py-[12px] bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-[13px] font-semibold rounded-lg text-center"
              >
                {run.running ? 'Pause' : 'Resume'}
              </button>
              <button
                onClick={skipTask}
                disabled={!canSkipCurrent()}
                className={`flex-1 min-w-[120px] px-[20px] py-[12px] text-[13px] font-semibold rounded-lg text-center border transition-colors ${
                  canSkipCurrent()
                    ? 'border-primary text-primary hover:bg-primary/10'
                    : 'border-outline-variant/30 text-on-surface-variant/50 cursor-not-allowed'
                }`}
              >
                {requireHalf && !canSkipCurrent() ? 'Skip (half)' : 'Skip task'}
              </button>
              {run.taskIndex + 1 >= currentTasks.length && (
                <button
                  onClick={() => { setRun(null); toast.success('Routine complete'); }}
                  className="flex-1 min-w-[120px] px-[20px] py-[12px] bg-primary hover:bg-primary/90 text-on-primary text-[13px] font-semibold rounded-lg text-center"
                >
                  Finish
                </button>
              )}
            </div>
          </div>

          <ol className="flex flex-col gap-[8px]">
            {currentTasks.map((t, i) => (
              <li
                key={t.id}
                className={`flex items-center justify-between px-[16px] py-[12px] rounded-lg border text-[13px] ${
                  i === run.taskIndex
                    ? 'border-primary bg-primary/10 text-on-surface font-semibold'
                    : i < run.taskIndex
                      ? 'border-outline-variant/20 text-on-surface-variant/70 line-through'
                      : 'border-outline-variant/20 text-on-surface'
                }`}
              >
                <span className="flex items-center gap-[12px]">
                  <span className="material-symbols-outlined text-[16px]">
                    {i < run.taskIndex ? 'check_circle' : i === run.taskIndex ? 'play_circle' : 'radio_button_unchecked'}
                  </span>
                  {t.title}
                </span>
                <span className="font-mono text-[12px] text-on-surface-variant">{formatMins(t.duration_minutes)}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    );
  }

  return (
    <div className="p-[40px]">
      <div className="flex justify-between items-center mb-[32px]">
        <div>
          <h2 className="text-[28px] font-bold text-on-surface mb-[8px]">Routines</h2>
          <p className="text-[14px] text-on-surface-variant">Blocks, run timer, and guided focus sessions</p>
        </div>
        <div className="flex gap-[16px] items-center">
          <label className="flex items-center gap-[10px] text-[12px] text-on-surface-variant">
            <input
              type="checkbox"
              checked={requireHalf}
              onChange={(e) => void settings.updateSetting('routine_require_half_to_skip', e.target.checked)}
              className="w-4 h-4 accent-primary cursor-pointer"
            />
            Require half to skip
          </label>
          <button
            onClick={() => {
              closeEditRoutine();
              setEditingRoutineId('new');
              setRoutineName('');
              setRoutineStart('');
              setRoutineDays(['1', '2', '3', '4', '5']);
            }}
            className="px-[20px] py-[10px] bg-primary hover:bg-primary/90 text-on-primary text-[13px] font-semibold rounded-lg transition-colors shadow-sm flex items-center justify-center gap-[14px] text-center"
          >
            <span className="material-symbols-outlined text-[16px]">add</span> New Routine
          </button>
        </div>
      </div>

      {/* Editor */}
      {editingRoutineId && (
        <div className="bg-surface rounded-xl border border-outline-variant/30 p-[28px] mb-[28px] shadow-sm">
          <div className="flex justify-between items-center mb-[20px]">
            <h3 className="text-[16px] font-bold text-on-surface">
              {editingRoutineId === 'new' ? 'Create routine' : 'Edit routine'}
            </h3>
            <button
              onClick={closeEditRoutine}
              className="material-symbols-outlined text-[20px] text-on-surface-variant hover:text-on-surface"
            >
              close
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-[20px] mb-[20px]">
            <div>
              <label className="block text-[12px] font-semibold uppercase tracking-wider text-on-surface-variant mb-[8px]">Name *</label>
              <input
                value={routineName}
                onChange={(e) => setRoutineName(e.target.value)}
                className="w-full bg-surface-container-low border border-outline-variant/30 rounded-lg px-[12px] py-[10px] text-[14px] text-on-surface focus:outline-none focus:border-primary"
                placeholder="Morning routine"
              />
            </div>
            <div>
              <label className="block text-[12px] font-semibold uppercase tracking-wider text-on-surface-variant mb-[8px]">Start time</label>
              <input
                type="time"
                value={routineStart}
                onChange={(e) => setRoutineStart(e.target.value)}
                className="w-full bg-surface-container-low border border-outline-variant/30 rounded-lg px-[12px] py-[10px] text-[14px] text-on-surface focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-[12px] font-semibold uppercase tracking-wider text-on-surface-variant mb-[8px]">Days</label>
              <div className="flex flex-wrap gap-[6px]">
                {DAY_LABELS.map((d) => {
                  const on = routineDays.includes(d.v);
                  return (
                    <button
                      key={d.v}
                      type="button"
                      onClick={() =>
                        setRoutineDays((prev) =>
                          on ? prev.filter((x) => x !== d.v) : [...prev, d.v],
                        )
                      }
                      className={`px-[10px] py-[6px] rounded-lg text-[11px] font-semibold border transition-colors ${
                        on
                          ? 'bg-primary-container text-on-primary-container border-primary-container'
                          : 'border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high'
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex gap-[16px] mb-[16px]">
            <button
              onClick={() => void saveRoutine()}
              className="px-[20px] py-[10px] bg-primary hover:bg-primary/90 text-on-primary text-[13px] font-semibold rounded-lg text-center"
            >
              {editingRoutineId === 'new' ? 'Create routine' : 'Save routine'}
            </button>
            {editingRoutineId !== 'new' && (
              <button
                onClick={() => void removeRoutine(editingRoutineId)}
                className="px-[20px] py-[10px] border border-error/40 text-error hover:bg-error/10 text-[13px] font-semibold rounded-lg text-center"
              >
                Delete
              </button>
            )}
          </div>

          {/* Blocks — available while creating (pending) and when editing */}
          <div className="border-t border-outline-variant/20 pt-[20px]">
            <div className="flex items-center justify-between mb-[12px]">
              <h4 className="text-[13px] font-semibold text-on-surface">Blocks</h4>
              {editingRoutineId === 'new' && pendingTasks.length > 0 && (
                <span className="text-[12px] text-primary font-semibold">
                  {pendingTasks.length} pending — saved on Create
                </span>
              )}
            </div>
            <div className="flex gap-[12px] mb-[16px] flex-wrap items-end">
              <div className="flex-1 min-w-[180px]">
                <label className="block text-[12px] text-on-surface-variant mb-[6px]">Task title</label>
                <input
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void addRoutineTask(); }}
                  className="w-full bg-surface-container-low border border-outline-variant/30 rounded-lg px-[12px] py-[10px] text-[14px] text-on-surface focus:outline-none focus:border-primary"
                  placeholder="Warm up"
                />
              </div>
                <div>
                  <label className="block text-[12px] text-on-surface-variant mb-[6px]">Duration (minutes)</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    min={1}
                    className="int-free w-[120px] bg-surface-container-low border border-outline-variant/30 rounded-lg px-[12px] py-[10px] text-[14px] text-on-surface focus:outline-none focus:border-primary"
                    value={taskDuration}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9]/g, '');
                      setTaskDuration(raw === '' ? 1 : Math.max(1, parseInt(raw, 10) || 1));
                    }}
                  />
                </div>
              <button
                onClick={() => void addRoutineTask()}
                disabled={!taskTitle.trim()}
                className="px-[16px] py-[10px] border border-outline-variant/40 hover:bg-surface-container-high text-on-surface text-[13px] font-semibold rounded-lg text-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add block
              </button>
            </div>
            <ol className="flex flex-col gap-[8px]">
              {shownTasks.map((t, i) => (
                <li
                  key={t.id}
                  className="flex items-center gap-[12px] px-[14px] py-[10px] bg-surface-container-low border border-outline-variant/20 rounded-lg"
                >
                  <span className="text-[12px] font-mono text-on-surface-variant w-[24px]">{i + 1}</span>
                  <span className="flex-1 text-[13px] text-on-surface">{t.title}</span>
                  {editingRoutineId === 'new' ? (
                    <input
                      type="number"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      min={1}
                      className="int-free w-[80px] bg-surface border border-outline-variant/30 rounded px-[8px] py-[4px] text-[12px] text-on-surface focus:outline-none focus:border-primary"
                      value={pendingTasks[i]?.duration_minutes ?? t.duration_minutes}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^0-9]/g, '');
                        const v = raw === '' ? 1 : Math.max(1, parseInt(raw, 10) || 1);
                        setPendingTasks((prev) => prev.map((p, idx) => (idx === i ? { ...p, duration_minutes: v } : p)));
                      }}
                      aria-label="Duration minutes"
                    />
                  ) : (
                    <input
                      type="number"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      min={1}
                      className="int-free w-[80px] bg-surface border border-outline-variant/30 rounded px-[8px] py-[4px] text-[12px] text-on-surface focus:outline-none focus:border-primary"
                      value={t.duration_minutes}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^0-9]/g, '');
                        const v = raw === '' ? 1 : Math.max(1, parseInt(raw, 10) || 1);
                        void updateRoutineTask({ id: t.id, duration_minutes: v });
                      }}
                      aria-label="Duration minutes"
                    />
                  )}
                  <span className="text-[11px] text-on-surface-variant w-[28px]">min</span>
                  {editingRoutineId === 'new' ? (
                    <button
                      onClick={() => removePendingTask(i)}
                      className="material-symbols-outlined text-[16px] text-on-surface-variant hover:text-error"
                    >
                      delete
                    </button>
                  ) : (
                    <button
                      onClick={() => void deleteRoutineTask(t.id)}
                      className="material-symbols-outlined text-[16px] text-on-surface-variant hover:text-error"
                    >
                      delete
                    </button>
                  )}
                </li>
              ))}
              {shownTasks.length === 0 && (
                <li className="text-[13px] text-on-surface-variant py-[8px]">No blocks yet — set how long each task takes</li>
              )}
            </ol>
          </div>
        </div>
      )}

      {/* Routine cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-[20px] mb-[40px]">
        {routines.length === 0 && !editingRoutineId && (
          <div className="col-span-full text-center py-[40px] text-on-surface-variant text-[13px] border border-dashed border-outline-variant/30 rounded-xl">
            No routines yet — create one to get started
          </div>
        )}
        {routines.map((r) => {
          const tasks = tasksFor(r.id);
          const total = tasks.reduce((s, t) => s + t.duration_minutes, 0);
          return (
            <div key={r.id} className="bg-surface rounded-xl border border-outline-variant/30 p-[24px] shadow-sm">
              <div className="flex justify-between items-start mb-[16px]">
                <div>
                  <h3 className="text-[16px] font-bold text-on-surface mb-[6px]">{r.name}</h3>
                  <p className="text-[12px] text-on-surface-variant">
                    {r.start_time ? `Starts ${r.start_time} · ` : ''}
                    {r.days} · {tasks.length} block{tasks.length === 1 ? '' : 's'} · {formatMins(total)}
                  </p>
                </div>
                <div className="flex gap-[8px]">
                  <button
                    onClick={() => openEditRoutine(r.id)}
                    className="material-symbols-outlined text-[18px] text-on-surface-variant hover:text-primary"
                    title="Edit"
                  >
                    settings
                  </button>
                  <button
                    onClick={() => void removeRoutine(r.id)}
                    className="material-symbols-outlined text-[18px] text-on-surface-variant hover:text-error"
                    title="Delete"
                  >
                    delete
                  </button>
                </div>
              </div>
              <ol className="flex flex-col gap-[6px] mb-[20px]">
                {tasks.map((t, i) => (
                  <li key={t.id} className="flex justify-between text-[13px] text-on-surface">
                    <span className="flex gap-[10px]">
                      <span className="text-on-surface-variant font-mono">{i + 1}.</span> {t.title}
                    </span>
                    <span className="font-mono text-on-surface-variant text-[12px]">{formatMins(t.duration_minutes)}</span>
                  </li>
                ))}
                {tasks.length === 0 && <li className="text-[13px] text-on-surface-variant">No blocks</li>}
              </ol>
              <button
                onClick={() => startRun(r.id)}
                className="w-full px-[20px] py-[10px] bg-primary hover:bg-primary/90 text-on-primary text-[13px] font-semibold rounded-lg shadow-sm flex items-center justify-center gap-[14px] text-center"
              >
                <span className="material-symbols-outlined text-[16px]">play_arrow</span> Run routine
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
