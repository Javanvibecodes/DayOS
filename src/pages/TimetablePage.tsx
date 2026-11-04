import { useState, useEffect, useRef } from 'react';
import { format, addDays, subDays, isToday } from 'date-fns';
import { useTaskStore } from '@/stores/taskStore';
import { useMeetingStore } from '@/stores/meetingStore';
import { useGoalStore } from '@/stores/goalStore';
import { useProjectStore } from '@/stores/projectStore';
import { useCategoryStore } from '@/stores/categoryStore';
import { dayTemplateApi } from '@/lib/db/api';
import { toast } from '@/stores/toastStore';
import type { DayTemplate, Task, TaskPriority } from '@/types';

const HOURS = Array.from({ length: 24 }, (_, i) => i); // 00:00 to 23:00
const HOUR_HEIGHT = 60;
const DEFAULT_TASK_MINUTES = 60;
const FALLBACK_COLOR = '#8083ff';

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  critical: '#ff5d5d',
  high: '#ffb020',
  medium: FALLBACK_COLOR,
  low: '#7dd3a8',
};

function timeToTop(hour: number, min: number): number {
  return hour * HOUR_HEIGHT + (min / 60) * HOUR_HEIGHT;
}

function getEventHeight(startHour: number, startMin: number, endHour: number, endMin: number): number {
  const top = timeToTop(startHour, startMin);
  const bottom = timeToTop(endHour, endMin);
  return bottom - top - 2;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function withAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function durationMinutes(t: Task): number {
  if (t.start_time && t.end_time) {
    return Math.max(0, toMinutes(t.end_time) - toMinutes(t.start_time));
  }
  return DEFAULT_TASK_MINUTES;
}

function formatDuration(mins: number): string {
  if (mins <= 0) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

interface TimetablePageProps {
  onNewTask?: () => void;
}

export function TimetablePage({ onNewTask }: TimetablePageProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'hourly' | 'plan'>('hourly');
  const scrollRef = useRef<HTMLDivElement>(null);

  const { tasks, createTask, deleteTask, loadTasks } = useTaskStore();
  const { meetings } = useMeetingStore();
  const { goals } = useGoalStore();
  const { projects } = useProjectStore();
  const { categories, loadCategories } = useCategoryStore();

  const [addTitle, setAddTitle] = useState('');
  const [addTime, setAddTime] = useState('09:00');
  const [addMinutes, setAddMinutes] = useState(DEFAULT_TASK_MINUTES);
  const [templateName, setTemplateName] = useState('');
  const [dayTemplates, setDayTemplates] = useState<DayTemplate[]>([]);

  useEffect(() => {
    void loadCategories();
    void dayTemplateApi.getAll().then(setDayTemplates).catch(() => setDayTemplates([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (viewMode !== 'hourly' || !scrollRef.current) return;
    const now = new Date();
    const target = Math.max(0, timeToTop(now.getHours(), now.getMinutes()) - 80);
    scrollRef.current.scrollTop = target;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode]);

  const dateStr = format(currentDate, 'yyyy-MM-dd');

  const goalById = new Map(goals.map((g) => [g.id, g]));
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  const effectiveCategoryId = (t: Task): string | null => {
    if (t.category_id) return t.category_id;
    if (t.goal_id) {
      const g = goalById.get(t.goal_id);
      if (g?.category_id) return g.category_id;
    }
    if (t.project_id) {
      const p = projectById.get(t.project_id);
      if (p?.category_id) return p.category_id;
    }
    return null;
  };

  const eventColor = (t: Task): string => {
    const catId = effectiveCategoryId(t);
    const cat = catId ? categoryById.get(catId) : undefined;
    return cat?.color || PRIORITY_COLORS[t.priority] || FALLBACK_COLOR;
  };

  const handlePrev = () => setCurrentDate((d) => subDays(d, 1));
  const handleNext = () => setCurrentDate((d) => addDays(d, 1));
  const handleToday = () => setCurrentDate(new Date());

  const dayTasks = tasks.filter(
    (t) =>
      t.scheduled_date === dateStr &&
      t.status !== 'cancelled' &&
      t.status !== 'completed',
  );

  const orderedDayTasks = [...dayTasks].sort((a, b) => {
    const aStart = a.start_time ? toMinutes(a.start_time) : Number.MAX_SAFE_INTEGER;
    const bStart = b.start_time ? toMinutes(b.start_time) : Number.MAX_SAFE_INTEGER;
    if (aStart !== bStart) return aStart - bStart;
    const order: Record<TaskPriority, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return order[a.priority] - order[b.priority];
  });

  const addPlanTask = async () => {
    const title = addTitle.trim();
    if (!title) return;
    try {
      const start = addTime || '09:00';
      const [sh, sm] = start.split(':').map(Number);
      const total = Math.min(24 * 60 - 1, sh * 60 + sm + Math.max(5, addMinutes));
      const endH = Math.floor(total / 60);
      const endM = total % 60;
      const end = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
      await createTask({
        title,
        scheduled_date: dateStr,
        start_time: start,
        end_time: end,
        status: 'todo',
        priority: 'medium',
      });
      setAddTitle('');
      toast.success('Task added to your day');
    } catch {
      toast.error('Could not add the task');
    }
  };

  const removePlanTask = async (id: string) => {
    try {
      await deleteTask(id);
      toast.success('Task deleted');
    } catch {
      toast.error('Could not delete the task');
    }
  };

  const saveDayTemplate = async () => {
    const name = templateName.trim();
    if (!name) {
      toast.error('Enter a template name');
      return;
    }
    try {
      const payload = JSON.stringify(
        orderedDayTasks.map((t) => ({
          title: t.title,
          minutes: durationMinutes(t),
          start_time: t.start_time,
          priority: t.priority,
          category_id: t.category_id,
        })),
      );
      const tpl = await dayTemplateApi.create({ name, payload });
      setDayTemplates((p) => [tpl, ...p]);
      setTemplateName('');
      toast.success('Day template saved');
    } catch {
      toast.error('Could not save the day template');
    }
  };

  const applyDayTemplate = async (tpl: DayTemplate) => {
    try {
      const parsed = JSON.parse(tpl.payload) as Array<{
        title: string;
        minutes?: number;
        start_time?: string | null;
        priority?: TaskPriority;
        category_id?: string | null;
      }>;
      for (const item of parsed) {
        const minutes = Math.max(5, item.minutes || DEFAULT_TASK_MINUTES);
        const start = item.start_time || addTime || '09:00';
        const [sh] = start.split(':').map(Number);
        const total = Math.min(24 * 60 - 1, sh * 60 + minutes);
        const end = `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
        await createTask({
          title: item.title,
          scheduled_date: dateStr,
          start_time: start,
          end_time: end,
          status: 'todo',
          priority: item.priority || 'medium',
          category_id: item.category_id || undefined,
        });
      }
      await loadTasks();
      toast.success(`Applied “${tpl.name}”`);
    } catch {
      toast.error('Could not apply the day template');
    }
  };

  const deleteDayTemplate = async (id: string) => {
    try {
      await dayTemplateApi.delete(id);
      setDayTemplates((p) => p.filter((t) => t.id !== id));
      toast.success('Day template deleted');
    } catch {
      toast.error('Could not delete the day template');
    }
  };

  const taskEvents = tasks
    .filter((t) => t.start_time && t.end_time && t.scheduled_date === dateStr && t.status !== 'cancelled')
    .map((t) => {
      const [sh, sm] = (t.start_time || '09:00').split(':').map(Number);
      const [eh, em] = (t.end_time || '10:00').split(':').map(Number);
      const color = eventColor(t);
      const catId = effectiveCategoryId(t);
      const cat = catId ? categoryById.get(catId) : undefined;
      return {
        id: `task-${t.id}`,
        title: t.title,
        startHour: sh,
        startMin: sm,
        endHour: eh,
        endMin: em,
        icon: 'checklist',
        color,
        catName: cat?.name,
      };
    });

  const meetingEvents = meetings
    .filter((m) => m.date === dateStr)
    .map((m) => {
      const [sh, sm] = (m.start_time || '09:00').split(':').map(Number);
      const [eh, em] = (m.end_time || '10:00').split(':').map(Number);
      return {
        id: `meeting-${m.id}`,
        title: m.title,
        startHour: sh,
        startMin: sm,
        endHour: eh,
        endMin: em,
        icon: 'groups',
        color: '#b57cff',
        catName: 'Meeting',
      };
    });

  const allEvents = [...taskEvents, ...meetingEvents];
  const currentTimeTop = timeToTop(new Date().getHours(), new Date().getMinutes());
  const currentTimeLabel = format(new Date(), 'HH:mm');

  return (
    <div className="p-[32px] max-w-[1440px] mx-auto flex flex-col gap-[32px] h-[calc(100vh-80px)]">
      {/* Top Header Controls */}
      <div className="flex justify-between items-center gap-[16px] flex-wrap">
        <div>
          <h2 className="text-[28px] leading-9 font-semibold text-on-surface mb-[20px] flex items-center gap-[12px]">
            <span className="material-symbols-outlined text-[32px] text-primary">calendar_view_day</span>
            {viewMode === 'plan' ? 'Plan My Day' : 'Hourly Timetable'}
          </h2>
          <p className="text-[14px] text-on-surface-variant">
            {viewMode === 'plan'
              ? 'Color-coded tasks ordered by time. Add or delete items for this day.'
              : 'View-only timeblocking schedule for tasks and meetings.'}
          </p>
        </div>

        <div className="flex items-center gap-[12px] flex-wrap">
          <button
            onClick={() => setViewMode(viewMode === 'plan' ? 'hourly' : 'plan')}
            className="px-[16px] py-[10px] bg-primary hover:bg-primary/90 text-on-primary text-[13px] font-semibold rounded-lg flex items-center justify-center gap-[8px] shadow-sm text-center"
          >
            <span className="material-symbols-outlined text-[16px]">
              {viewMode === 'plan' ? 'schedule' : 'auto_awesome'}
            </span>
            {viewMode === 'plan' ? 'Hourly view' : 'Plan my day'}
          </button>
          <div className="flex items-center gap-[12px] bg-surface p-[8px] rounded-xl border border-outline-variant/30 shadow-sm">
            <button
              onClick={handlePrev}
              className="p-[10px] rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors flex items-center justify-center"
              title="Previous Day"
            >
              <span className="material-symbols-outlined text-[20px]">chevron_left</span>
            </button>
            <button
              onClick={handleToday}
              className={`px-[20px] py-[10px] rounded-lg text-[12px] font-semibold transition-colors flex items-center justify-center text-center ${
                isToday(currentDate)
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
              }`}
            >
              Today
            </button>
            <button
              onClick={handleNext}
              className="p-[10px] rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors flex items-center justify-center"
              title="Next Day"
            >
              <span className="material-symbols-outlined text-[20px]">chevron_right</span>
            </button>
            <span className="text-[13px] font-semibold text-on-surface ml-[8px] pr-[12px] border-l border-outline-variant/30 pl-[16px] text-center">
              {format(currentDate, 'EEEE, MMM d, yyyy')}
            </span>
          </div>
        </div>
      </div>

      {viewMode === 'plan' ? (
        /* ---------- Plan my day: color-coded ordered list ---------- */
        <div className="flex-1 min-h-0 bg-surface rounded-2xl border border-outline-variant/30 shadow-sm overflow-hidden flex flex-col">
          {/* Add row */}
          <div className="p-[20px] border-b border-outline-variant/20 bg-surface-container-low/50">
            <div className="flex gap-[10px] flex-wrap items-end">
              <div className="flex-1 min-w-[180px]">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant mb-[6px]">
                  Task
                </label>
                <input
                  value={addTitle}
                  onChange={(e) => setAddTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void addPlanTask(); }}
                  placeholder="What will you do?"
                  className="w-full bg-surface-container-low border border-outline-variant/30 rounded-lg px-[12px] py-[10px] text-[14px] text-on-surface focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant mb-[6px]">
                  Start
                </label>
                <input
                  type="time"
                  value={addTime}
                  onChange={(e) => setAddTime(e.target.value)}
                  className="bg-surface-container-low border border-outline-variant/30 rounded-lg px-[12px] py-[10px] text-[14px] text-on-surface focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant mb-[6px]">
                  Minutes
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={5}
                  max={480}
                  value={addMinutes}
                  onChange={(e) => setAddMinutes(Math.max(5, Number(e.target.value.replace(/\D/g, '')) || 5))}
                  className="int-free w-[88px] bg-surface-container-low border border-outline-variant/30 rounded-lg px-[12px] py-[10px] text-[14px] text-on-surface focus:outline-none focus:border-primary"
                />
              </div>
              <button
                onClick={() => void addPlanTask()}
                className="px-[18px] py-[10px] bg-primary hover:bg-primary/90 text-on-primary text-[13px] font-semibold rounded-lg flex items-center justify-center gap-[8px] text-center"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                Add task
              </button>
              {onNewTask && (
                <button
                  onClick={onNewTask}
                  className="px-[14px] py-[10px] border border-outline-variant/40 text-on-surface text-[13px] font-medium rounded-lg text-center"
                >
                  Full form
                </button>
              )}
            </div>
          </div>

          {/* Ordered list */}
          <div className="flex-1 overflow-y-auto p-[20px]">
            {orderedDayTasks.length === 0 ? (
              <div className="h-full min-h-[240px] flex flex-col items-center justify-center text-on-surface-variant/60">
                <span className="material-symbols-outlined text-[48px] mb-[12px]">event_busy</span>
                <p className="text-[14px] font-semibold">No tasks planned for this day</p>
                <p className="text-[12px] mt-[6px]">Add a task above to start your plan</p>
              </div>
            ) : (
              <ul className="flex flex-col gap-[10px]">
                {orderedDayTasks.map((t) => {
                  const color = eventColor(t);
                  const catId = effectiveCategoryId(t);
                  const cat = catId ? categoryById.get(catId) : undefined;
                  const mins = durationMinutes(t);
                  return (
                    <li
                      key={t.id}
                      className="group flex items-center gap-[14px] px-[16px] py-[14px] rounded-xl border border-outline-variant/20 bg-surface-container-low hover:bg-surface-container transition-colors"
                      style={{
                        borderLeftWidth: '4px',
                        borderLeftColor: color,
                        backgroundColor: withAlpha(color, 0.1),
                      }}
                    >
                      <span
                        className="w-3 h-3 rounded-full shrink-0 border border-outline-variant/30"
                        style={{ backgroundColor: color }}
                        title={cat?.name || t.priority}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-semibold text-on-surface truncate">{t.title}</p>
                        <p className="text-[12px] text-on-surface-variant mt-[2px]">
                          {t.start_time && t.end_time
                            ? `${t.start_time} – ${t.end_time}`
                            : t.start_time
                              ? `From ${t.start_time}`
                              : 'No time set'}
                          {mins > 0 ? ` · ${formatDuration(mins)}` : ''}
                          {cat ? ` · ${cat.name}` : ` · ${t.priority}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-[6px] shrink-0">
                        {t.status === 'in_progress' && (
                          <span className="px-[8px] py-[4px] rounded-full text-[11px] font-semibold bg-primary-container/40 text-on-primary-container">
                            In progress
                          </span>
                        )}
                        <button
                          onClick={() => void removePlanTask(t.id)}
                          className="material-symbols-outlined text-[18px] text-on-surface-variant hover:text-error opacity-60 group-hover:opacity-100 transition-opacity"
                          title="Delete task"
                        >
                          delete
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Templates bar */}
          <div className="px-[20px] py-[14px] border-t border-outline-variant/20 bg-surface-container-low/50 flex flex-wrap gap-[10px] items-center">
            <input
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Save as day template…"
              className="w-[200px] bg-surface-container-low border border-outline-variant/30 rounded-lg px-[12px] py-[8px] text-[13px] text-on-surface focus:outline-none focus:border-primary"
            />
            <button
              onClick={() => void saveDayTemplate()}
              className="px-[14px] py-[8px] border border-outline-variant/40 text-on-surface text-[12px] font-semibold rounded-lg text-center"
            >
              Save template
            </button>
            {dayTemplates.map((tpl) => (
              <div
                key={tpl.id}
                className="flex items-center gap-[6px] bg-surface-container-low border border-outline-variant/30 rounded-lg px-[10px] py-[6px]"
              >
                <button
                  onClick={() => void applyDayTemplate(tpl)}
                  className="text-[12px] font-medium text-primary hover:underline"
                >
                  {tpl.name}
                </button>
                <button
                  onClick={() => void deleteDayTemplate(tpl.id)}
                  className="material-symbols-outlined text-[14px] text-on-surface-variant hover:text-error"
                >
                  delete
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* ---------- Hourly view: read-only ---------- */
        <div className="flex-1 min-h-0 bg-surface rounded-2xl border border-outline-variant/30 shadow-sm overflow-hidden flex flex-col">
          <div ref={scrollRef} className="flex-1 overflow-y-auto relative no-scrollbar">
            <div className="relative min-w-[600px]" style={{ height: `${HOURS.length * HOUR_HEIGHT + 16}px` }}>
              {/* Current Time Red Line */}
              {isToday(currentDate) && (
                <div
                  className="absolute left-16 right-0 h-0.5 bg-error z-20 pointer-events-none flex items-center"
                  style={{ top: `${currentTimeTop}px` }}
                >
                  <div className="absolute left-0 -translate-x-full pr-[8px] flex items-center h-full">
                    <span className="text-error font-mono text-[11px] font-bold bg-background px-[6px] py-[2px] rounded shadow">
                      {currentTimeLabel}
                    </span>
                  </div>
                  <div className="w-2.5 h-2.5 rounded-full bg-error absolute -left-1 shadow" />
                </div>
              )}

              {/* Grid Layout */}
              <div className="absolute inset-0 flex">
                {/* Hours Labels Column */}
                <div className="w-16 shrink-0 border-r border-outline-variant/20 flex flex-col pt-[8px] bg-surface">
                  {HOURS.map((hour) => (
                    <div key={hour} className="hour-slot relative flex justify-end pr-[12px]">
                      <span className="text-on-surface-variant font-mono text-[11px] -mt-[8px]">
                        {String(hour).padStart(2, '0')}:00
                      </span>
                    </div>
                  ))}
                  <div className="relative flex justify-end pr-[12px] h-0">
                    <span className="text-on-surface-variant/70 font-mono text-[11px] -mt-[6px]">
                      24:00
                    </span>
                  </div>
                </div>

                {/* Time Slot Rows & Events — view only */}
                <div className="flex-1 flex flex-col pt-[8px] relative bg-surface">
                  <div className="absolute inset-0 z-0 flex flex-col">
                    {HOURS.map((hour) => (
                      <div
                        key={hour}
                        className="hour-slot border-b border-outline-variant/10 relative"
                      />
                    ))}
                  </div>

                  <div className="absolute inset-0 pt-[8px] z-10 pointer-events-none">
                    {allEvents.map((event) => {
                      const top = timeToTop(event.startHour, event.startMin);
                      const height = getEventHeight(event.startHour, event.startMin, event.endHour, event.endMin);
                      const startLabel = `${String(event.startHour).padStart(2, '0')}:${String(event.startMin).padStart(2, '0')}`;
                      const endLabel = `${String(event.endHour).padStart(2, '0')}:${String(event.endMin).padStart(2, '0')}`;

                      return (
                        <div
                          key={event.id}
                          className="absolute left-4 right-4 border-l-4 rounded-r-xl px-[16px] py-[8px] shadow-sm"
                          style={{
                            top: `${top}px`,
                            height: `${height}px`,
                            borderLeftColor: event.color,
                            backgroundColor: withAlpha(event.color, 0.22),
                          }}
                        >
                          <div className="flex justify-between items-start gap-[8px]">
                            <h3 className="text-[13px] font-semibold text-on-surface truncate">{event.title}</h3>
                            <span className="material-symbols-outlined text-[16px] shrink-0" style={{ color: event.color }}>
                              {event.icon}
                            </span>
                          </div>
                          <p className="text-[12px] font-mono text-on-surface-variant mt-[8px]">
                            {startLabel} - {endLabel}
                            {event.catName ? ` · ${event.catName}` : ''}
                          </p>
                        </div>
                      );
                    })}
                    {allEvents.length === 0 && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-on-surface-variant/50">
                        <span className="material-symbols-outlined text-[48px] mb-[16px]">event_busy</span>
                        <p className="text-[14px] font-semibold">No events scheduled for this day</p>
                        <p className="text-[12px] mt-[8px]">Switch to Plan my day to add tasks</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
