import { useState, useEffect } from 'react';
import { useGoalStore } from '@/stores/goalStore';
import { useCategoryStore } from '@/stores/categoryStore';
import { toast } from '@/stores/toastStore';
import type { GoalType, Goal } from '@/types';

function isoDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function goalDatesFor(type: GoalType): { start: string; end: string } {
  const now = new Date();
  if (type === 'daily') {
    return { start: isoDate(now), end: isoDate(now) };
  }
  if (type === 'weekly') {
    // Week starts Monday, ends Sunday
    const day = now.getDay(); // 0 Sun … 6 Sat
    const offsetToMon = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + offsetToMon);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { start: isoDate(monday), end: isoDate(sunday) };
  }
  // monthly: 1st → last day of month
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start: isoDate(start), end: isoDate(end) };
}

interface GoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  goalToEdit?: Goal | null;
}

export function GoalModal({ isOpen, onClose, goalToEdit }: GoalModalProps) {
  const { createGoal, updateGoal } = useGoalStore();
  const { categories, loadCategories } = useCategoryStore();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<GoalType>('weekly');
  const [recurrence, setRecurrence] = useState<string>('none');
  const [categoryId, setCategoryId] = useState('');

  useEffect(() => {
    void loadCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (goalToEdit) {
      setTitle(goalToEdit.title);
      setDescription(goalToEdit.description || '');
      setType(goalToEdit.type);
      setRecurrence(goalToEdit.recurrence_rule || 'none');
      setCategoryId(goalToEdit.category_id || '');
    } else {
      setTitle('');
      setDescription('');
      setType('weekly');
      setRecurrence('none');
      setCategoryId('');
    }
  }, [goalToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Enter a goal title');
      return;
    }

    const { start, end } = goalDatesFor(type);

    if (goalToEdit) {
      updateGoal({
        id: goalToEdit.id,
        title: title.trim(),
        description: description.trim() || undefined,
        type,
        start_date: goalToEdit.start_date || start,
        end_date: goalToEdit.end_date || end,
        category_id: categoryId,
        recurrence_rule: recurrence === 'none' ? undefined : recurrence,
      });
      toast.success('Goal updated');
    } else {
      createGoal({
        title: title.trim(),
        description: description.trim() || undefined,
        type,
        start_date: start,
        end_date: end,
        category_id: categoryId || undefined,
        recurrence_rule: recurrence === 'none' ? undefined : recurrence,
      });
      toast.success('Goal created');
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-[16px]">
      <div className="bg-surface border border-outline-variant/30 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center px-[24px] py-[16px] border-b border-outline-variant/20 bg-surface-container-low">
          <h3 className="text-[18px] font-semibold text-on-surface flex items-center gap-[18px] mb-[8px]">
            <span className="material-symbols-outlined text-primary">emoji_events</span>
            {goalToEdit ? 'Edit Goal' : 'Create New Goal'}
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
              Goal Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Complete ATLAS Architecture"
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
              placeholder="Key objectives, milestones, or outcome metrics..."
              className="w-full bg-surface-container-low border border-outline-variant/30 rounded-lg px-[12px] py-[10px] text-[14px] text-on-surface focus:outline-none focus:border-primary resize-none"
            />
          </div>

          <div>
            <label className="block text-[12px] font-semibold uppercase tracking-wider text-on-surface-variant mb-[12px]">
              Time Horizon
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as GoalType)}
              className="w-full bg-surface-container-low border border-outline-variant/30 rounded-lg px-[12px] py-[10px] text-[14px] text-on-surface focus:outline-none focus:border-primary"
            >
              <option value="daily">Daily Goal</option>
              <option value="weekly">Weekly Goal</option>
              <option value="monthly">Monthly Goal</option>
            </select>
          </div>

          <div>
            <label className="block text-[12px] font-semibold uppercase tracking-wider text-on-surface-variant mb-[12px]">
              Repeat
            </label>
            <select
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value)}
              className="w-full bg-surface-container-low border border-outline-variant/30 rounded-lg px-[12px] py-[10px] text-[14px] text-on-surface focus:outline-none focus:border-primary"
            >
              <option value="none">Does not repeat</option>
              <option value="weekly">Every week</option>
              <option value="biweekly">Every 2 weeks</option>
              <option value="monthly">Every month</option>
            </select>
          </div>

          <div>
            <label className="block text-[12px] font-semibold uppercase tracking-wider text-on-surface-variant mb-[12px]">
              Category <span className="normal-case font-medium opacity-60">(optional)</span>
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full bg-surface-container-low border border-outline-variant/30 rounded-lg px-[12px] py-[10px] text-[14px] text-on-surface focus:outline-none focus:border-primary"
            >
              <option value="">None</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <p className="text-[11px] text-on-surface-variant/70 mt-[6px]">
              Manage categories in Settings → Categories. Tasks linked to this goal inherit its category.
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
              {goalToEdit ? 'Save Changes' : 'Create Goal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
