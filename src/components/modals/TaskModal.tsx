import { useState, useEffect } from 'react';
import { useTaskStore } from '@/stores/taskStore';
import { useGoalStore } from '@/stores/goalStore';
import { useProjectStore } from '@/stores/projectStore';
import { useCategoryStore } from '@/stores/categoryStore';
import type { TaskPriority, Task } from '@/types';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskToEdit?: Task | null;
}

export function TaskModal({ isOpen, onClose, taskToEdit }: TaskModalProps) {
  const { createTask, updateTask } = useTaskStore();
  const { goals } = useGoalStore();
  const { projects } = useProjectStore();
  const { categories, loadCategories } = useCategoryStore();

  useEffect(() => {
    void loadCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [scheduledDate, setScheduledDate] = useState(new Date().toISOString().split('T')[0]);
  const [timeMode, setTimeMode] = useState<'range' | 'duration'>('range');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [durationHours, setDurationHours] = useState(1);
  const [durationMinutes, setDurationMinutes] = useState(0);
  const [goalId, setGoalId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceRule, setRecurrenceRule] = useState<string>('every:1');
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderMinutes, setReminderMinutes] = useState(15);
  const [categoryId, setCategoryId] = useState('');

  useEffect(() => {
    if (taskToEdit) {
      setTitle(taskToEdit.title);
      setDescription(taskToEdit.description || '');
      setPriority(taskToEdit.priority);
      setScheduledDate(taskToEdit.scheduled_date || new Date().toISOString().split('T')[0]);
      setStartTime(taskToEdit.start_time || '');
      setEndTime(taskToEdit.end_time || '');
      setGoalId(taskToEdit.goal_id || '');
      setProjectId(taskToEdit.project_id || '');
      setIsRecurring(taskToEdit.is_recurring);
      setRecurrenceRule(taskToEdit.recurrence_rule || 'every:1');
      setReminderEnabled(taskToEdit.reminder_enabled);
      setReminderMinutes(taskToEdit.reminder_minutes ?? 15);
      setCategoryId(taskToEdit.category_id || '');
      setTimeMode('range');
      setDurationHours(1);
      setDurationMinutes(0);
    } else {
      setTitle('');
      setDescription('');
      setPriority('medium');
      setScheduledDate(new Date().toISOString().split('T')[0]);
      setStartTime('');
      setEndTime('');
      setGoalId('');
      setProjectId('');
      setIsRecurring(false);
      setRecurrenceRule('every:1');
      setReminderEnabled(false);
      setReminderMinutes(15);
      setCategoryId('');
      setTimeMode('range');
      setDurationHours(1);
      setDurationMinutes(0);
    }
  }, [taskToEdit, isOpen]);

  if (!isOpen) return null;

  const computeEndTime = () => {
    if (timeMode === 'range') return endTime || undefined;
    if (!startTime) return undefined;
    const [h, m] = startTime.split(':').map(Number);
    const total = h * 60 + m + durationHours * 60 + durationMinutes;
    const eh = Math.floor(total / 60) % 24;
    const em = total % 60;
    return `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const finalEnd = computeEndTime();

    if (taskToEdit) {
      updateTask({
        id: taskToEdit.id,
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        scheduled_date: scheduledDate || undefined,
        start_time: startTime || undefined,
        end_time: finalEnd,
        goal_id: goalId || undefined,
        project_id: projectId || undefined,
        category_id: categoryId,
        is_recurring: isRecurring,
        recurrence_rule: isRecurring ? recurrenceRule : undefined,
        reminder_enabled: reminderEnabled,
        reminder_minutes: reminderEnabled ? reminderMinutes : undefined,
      });
    } else {
      createTask({
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        scheduled_date: scheduledDate || undefined,
        start_time: startTime || undefined,
        end_time: finalEnd,
        goal_id: goalId || undefined,
        project_id: projectId || undefined,
        category_id: categoryId || undefined,
        status: 'todo',
        is_recurring: isRecurring,
        recurrence_rule: isRecurring ? recurrenceRule : undefined,
        reminder_enabled: reminderEnabled,
        reminder_minutes: reminderEnabled ? reminderMinutes : undefined,
      });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-[16px]">
      <div className="bg-surface border border-outline-variant/30 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center px-[24px] py-[16px] border-b border-outline-variant/20 bg-surface-container-low">
          <h3 className="text-[18px] font-semibold text-on-surface flex items-center gap-[18px] mb-[8px]">
            <span className="material-symbols-outlined text-primary">add_task</span>
            {taskToEdit ? 'Edit Task' : 'Create New Task'}
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div>
            <label className="block text-[12px] font-semibold uppercase tracking-wider text-on-surface-variant mb-[12px]">
              Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task summary..."
              className="w-full bg-surface-container-low border border-outline-variant/30 rounded-lg px-[12px] py-[10px] text-[14px] text-on-surface focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-[12px] font-semibold uppercase tracking-wider text-on-surface-variant mb-[12px]">
              Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add details, links or instructions..."
              className="w-full bg-surface-container-low border border-outline-variant/30 rounded-lg px-[12px] py-[10px] text-[14px] text-on-surface focus:outline-none focus:border-primary resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-[20px]">
            <div>
              <label className="block text-[12px] font-semibold uppercase tracking-wider text-on-surface-variant mb-[12px]">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full bg-surface-container-low border border-outline-variant/30 rounded-lg px-[12px] py-[10px] text-[14px] text-on-surface focus:outline-none focus:border-primary"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>

            <div>
              <label className="block text-[12px] font-semibold uppercase tracking-wider text-on-surface-variant mb-[12px]">
                Date
              </label>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full bg-surface-container-low border border-outline-variant/30 rounded-lg px-[12px] py-[10px] text-[14px] text-on-surface focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Time mode toggle */}
          <div className="flex items-center gap-[18px]">
            <div className="flex bg-surface-container-low border border-outline-variant/30 rounded-lg p-[2px]">
              <button
                type="button"
                onClick={() => setTimeMode('range')}
                className={`px-[12px] py-[6px] rounded-md text-[12px] font-semibold transition-colors flex items-center justify-center text-center ${
                  timeMode === 'range' ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant'
                }`}
              >
                Time Range
              </button>
              <button
                type="button"
                onClick={() => setTimeMode('duration')}
                className={`px-[12px] py-[6px] rounded-md text-[12px] font-semibold transition-colors flex items-center justify-center text-center ${
                  timeMode === 'duration' ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant'
                }`}
              >
                Duration
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-[20px]">
            <div>
              <label className="block text-[12px] font-semibold uppercase tracking-wider text-on-surface-variant mb-[12px]">
                Start Time
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full bg-surface-container-low border border-outline-variant/30 rounded-lg px-[12px] py-[10px] text-[14px] text-on-surface focus:outline-none focus:border-primary"
              />
            </div>
            {timeMode === 'range' ? (
              <div>
                <label className="block text-[12px] font-semibold uppercase tracking-wider text-on-surface-variant mb-[12px]">
                  End Time
                </label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant/30 rounded-lg px-[12px] py-[10px] text-[14px] text-on-surface focus:outline-none focus:border-primary"
                />
              </div>
            ) : (
              <div>
                <label className="block text-[12px] font-semibold uppercase tracking-wider text-on-surface-variant mb-[12px]">
                  Duration
                </label>
                <div className="flex gap-[18px]">
                  <select
                    value={durationHours}
                    onChange={(e) => setDurationHours(Number(e.target.value))}
                    className="flex-1 bg-surface-container-low border border-outline-variant/30 rounded-lg px-[12px] py-[10px] text-[14px] text-on-surface focus:outline-none focus:border-primary"
                  >
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((h) => (
                      <option key={h} value={h}>{h}h</option>
                    ))}
                  </select>
                  <select
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    className="flex-1 bg-surface-container-low border border-outline-variant/30 rounded-lg px-[12px] py-[10px] text-[14px] text-on-surface focus:outline-none focus:border-primary"
                  >
                    {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => (
                      <option key={m} value={m}>{m}m</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-[20px]">
            <div>
              <label className="block text-[12px] font-semibold uppercase tracking-wider text-on-surface-variant mb-[12px]">
                Associated Goal
              </label>
              <select
                value={goalId}
                onChange={(e) => setGoalId(e.target.value)}
                className="w-full bg-surface-container-low border border-outline-variant/30 rounded-lg px-[12px] py-[10px] text-[14px] text-on-surface focus:outline-none focus:border-primary"
              >
                <option value="">None</option>
                {goals.map((g) => (
                  <option key={g.id} value={g.id}>{g.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-semibold uppercase tracking-wider text-on-surface-variant mb-[12px]">
                Associated Project
              </label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full bg-surface-container-low border border-outline-variant/30 rounded-lg px-[12px] py-[10px] text-[14px] text-on-surface focus:outline-none focus:border-primary"
              >
                <option value="">None</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-[20px] items-end">
            <div className="flex flex-col gap-[10px]">
              <label className="flex items-center gap-[10px] p-[12px] rounded-lg bg-surface-container-low cursor-pointer">
                <input
                  type="checkbox"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                  className="w-4 h-4 accent-primary cursor-pointer"
                />
                <span className="text-[13px] font-medium text-on-surface">Recurring task</span>
              </label>
              <label className="flex items-center gap-[10px] p-[12px] rounded-lg bg-surface-container-low cursor-pointer">
                <input
                  type="checkbox"
                  checked={reminderEnabled}
                  onChange={(e) => setReminderEnabled(e.target.checked)}
                  className="w-4 h-4 accent-primary cursor-pointer"
                />
                <span className="text-[13px] font-medium text-on-surface">Add reminder</span>
              </label>
            </div>
            <div className="flex flex-col gap-[10px]">
              {isRecurring && (
                <div>
                  <label className="block text-[12px] font-semibold uppercase tracking-wider text-on-surface-variant mb-[8px]">
                    Repeat every
                  </label>
                  <select
                    value={recurrenceRule}
                    onChange={(e) => setRecurrenceRule(e.target.value)}
                    className="w-full bg-surface-container-low border border-outline-variant/30 rounded-lg px-[12px] py-[10px] text-[14px] text-on-surface focus:outline-none focus:border-primary"
                  >
                    <option value="every:1">Every day</option>
                    <option value="every:2">Every 2 days</option>
                    <option value="every:3">Every 3 days</option>
                  </select>
                </div>
              )}
              {reminderEnabled && (
                <div>
                  <label className="block text-[12px] font-semibold uppercase tracking-wider text-on-surface-variant mb-[8px]">
                    Remind me
                  </label>
                  <select
                    value={reminderMinutes}
                    onChange={(e) => setReminderMinutes(Number(e.target.value))}
                    className="w-full bg-surface-container-low border border-outline-variant/30 rounded-lg px-[12px] py-[10px] text-[14px] text-on-surface focus:outline-none focus:border-primary"
                  >
                    <option value={1440}>1 day before</option>
                    <option value={720}>12 hours before</option>
                    <option value={360}>6 hours before</option>
                    <option value={180}>3 hours before</option>
                    <option value={120}>2 hours before</option>
                    <option value={60}>1 hour before</option>
                    <option value={30}>30 minutes before</option>
                    <option value={15}>15 minutes before</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-semibold uppercase tracking-wider text-on-surface-variant mb-[8px]">
              Category <span className="normal-case font-medium opacity-60">(optional)</span>
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full bg-surface-container-low border border-outline-variant/30 rounded-lg px-[12px] py-[10px] text-[14px] text-on-surface focus:outline-none focus:border-primary"
            >
              <option value="">None (inherit from goal/project)</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <p className="text-[11px] text-on-surface-variant/70 mt-[6px]">
              If goal/project already has a category and you leave this empty, the task inherits it.
            </p>
          </div>

          <div className="flex justify-end gap-[16px] mt-[16px] pt-[20px] border-t border-outline-variant/20">
            <button
              type="button"
              onClick={onClose}
              className="px-[20px] py-[10px] rounded-lg border border-outline-variant/30 text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors text-[13px] font-medium flex items-center justify-center text-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-[24px] py-[10px] rounded-lg bg-primary hover:bg-primary/90 text-on-primary text-[13px] font-semibold transition-colors flex items-center justify-center gap-[16px] shadow-lg shadow-primary/20 text-center"
            >
              <span className="material-symbols-outlined text-[16px]">check</span>
              {taskToEdit ? 'Save Changes' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
