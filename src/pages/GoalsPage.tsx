import { useState, useEffect } from 'react';
import { useGoalStore } from '@/stores/goalStore';
import { useTaskStore } from '@/stores/taskStore';
import { cn } from '@/lib/utils';
import type { Goal } from '@/types';

function formatCountdown(endDate: string | null): string {
  if (!endDate) return 'No due date';
  const end = new Date(`${endDate}T23:59:59`);
  const now = new Date();
  const diff = end.getTime() - now.getTime();
  if (diff <= 0) return 'Overdue';
  const totalHours = Math.floor(diff / 3600000);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (days > 0) return `${days}d ${hours}h left`;
  if (totalHours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}

interface GoalsPageProps {
  onNewGoal?: () => void;
  onNewTask?: () => void;
  onEditGoal?: (goal: Goal) => void;
}

export function GoalsPage({ onNewGoal, onNewTask, onEditGoal }: GoalsPageProps) {
  const { goals, deleteGoal } = useGoalStore();
  const { tasks, completeTask, uncompleteTask } = useTaskStore();

  const [expandedGoals, setExpandedGoals] = useState<Set<string>>(new Set());
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 60000);
    return () => window.clearInterval(id);
  }, []);

  const toggleGoalExpand = (goalId: string) => {
    setExpandedGoals((prev) => {
      const next = new Set(prev);
      if (next.has(goalId)) next.delete(goalId);
      else next.add(goalId);
      return next;
    });
  };

  const dailyGoals = goals.filter((g) => g.type === 'daily');
  const weeklyGoals = goals.filter((g) => g.type === 'weekly');
  const monthlyGoals = goals.filter((g) => g.type === 'monthly');
  const repeatingGoals = goals.filter((g) => g.recurrence_rule && g.recurrence_rule !== 'none');

  const goalSections: { id: string; label: string; icon: string; goals: Goal[] }[] = [
    { id: 'daily', label: 'Daily Goals', icon: 'today', goals: dailyGoals },
    { id: 'weekly', label: 'Weekly Goals', icon: 'date_range', goals: weeklyGoals },
    { id: 'monthly', label: 'Monthly Goals', icon: 'calendar_month', goals: monthlyGoals },
    { id: 'repeating', label: 'Repeating Goals', icon: 'repeat', goals: repeatingGoals },
  ];

  const renderGoalCard = (goal: Goal) => {
    const goalTasks = tasks.filter((t) => t.goal_id === goal.id);
    const completedTasks = goalTasks.filter((t) => t.status === 'completed').length;
    const totalTasks = goalTasks.length;
    const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const isExpanded = expandedGoals.has(goal.id);
    const repeatLabel =
      goal.recurrence_rule === 'weekly' ? 'Repeats every week'
      : goal.recurrence_rule === 'biweekly' ? 'Repeats every 2 weeks'
      : goal.recurrence_rule === 'monthly' ? 'Repeats every month'
      : null;

    return (
      <div
        key={goal.id}
        className="bg-surface rounded-2xl p-[28px] border border-outline-variant/30 relative overflow-hidden shadow-sm flex flex-col gap-[28px]"
      >
        <div className="flex justify-between items-start">
          <div>
            <span className="inline-block px-[12px] py-[4px] rounded-full bg-primary-container/20 text-primary text-[11px] font-semibold uppercase tracking-wider mb-[16px] border border-primary/20">
              {goal.type} Goal
            </span>
            <h3 className="text-[24px] font-bold text-on-surface mb-[16px]">
              {goal.title}
            </h3>
            <p className="text-[14px] text-on-surface-variant">
              {goal.description || 'No description provided.'}
            </p>
            {repeatLabel && (
              <p className="text-[12px] text-primary mt-[8px] flex items-center gap-[6px]">
                <span className="material-symbols-outlined text-[14px]">repeat</span>
                {repeatLabel}
              </p>
            )}
          </div>
          <div className="flex items-center gap-[12px]">
            <span className="text-[32px] font-bold text-primary">
              {progressPercent}%
            </span>
            <div className="flex gap-[16px]">
              <button
                onClick={() => onEditGoal && onEditGoal(goal)}
                className="p-[8px] text-on-surface-variant hover:text-primary rounded-lg hover:bg-surface-container transition-colors"
                title="Edit Goal"
              >
                <span className="material-symbols-outlined text-[18px]">edit</span>
              </button>
              <button
                onClick={() => deleteGoal(goal.id)}
                className="p-[8px] text-on-surface-variant hover:text-error rounded-lg hover:bg-surface-container transition-colors"
                title="Delete Goal"
              >
                <span className="material-symbols-outlined text-[18px]">delete</span>
              </button>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div>
          <div className="flex justify-between text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant mb-[16px]">
            <span>Progress ({completedTasks}/{totalTasks} tasks completed)</span>
            <span className={cn(goal.end_date && new Date(`${goal.end_date}T23:59:59`) < new Date() && 'text-error')}>
              {formatCountdown(goal.end_date)}
            </span>
          </div>
          <div className="w-full h-2 bg-surface-container-highest rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Expand Associated Tasks */}
        <div className="border-t border-outline-variant/20 pt-[20px]">
          <button
            onClick={() => toggleGoalExpand(goal.id)}
            className="flex items-center justify-center gap-[18px] text-[12px] font-semibold text-primary hover:underline py-[4px] text-center"
          >
            <span className="material-symbols-outlined text-[16px]">
              {isExpanded ? 'expand_less' : 'expand_more'}
            </span>
            {isExpanded ? 'Hide Associated Tasks' : 'View Associated Tasks'}
          </button>

          {isExpanded && (
            <div className="mt-[20px] flex flex-col gap-[18px]">
              {goalTasks.length === 0 ? (
                <div className="flex items-center justify-between p-[12px] bg-surface-container-low rounded-xl text-[13px] text-on-surface-variant">
                  <span>No tasks assigned to this goal yet.</span>
                  <button
                    onClick={onNewTask}
                    className="text-primary font-semibold hover:underline text-[12px] px-[12px] py-[8px] flex items-center justify-center text-center"
                  >
                    + Add Task
                  </button>
                </div>
              ) : (
                goalTasks.map((t) => {
                  const isDone = t.status === 'completed';
                  return (
                    <div
                      key={t.id}
                      className="flex items-center justify-between p-[12px] bg-surface-container-low rounded-xl border border-outline-variant/20"
                    >
                      <div className="flex items-center gap-[12px]">
                        <button
                          onClick={() => isDone ? uncompleteTask(t.id) : completeTask(t.id)}
                          className={cn(
                            "w-4 h-4 rounded border flex items-center justify-center transition-colors",
                            isDone ? "bg-primary border-primary text-on-primary" : "border-outline-variant"
                          )}
                        >
                          {isDone && <span className="material-symbols-outlined text-[12px]">check</span>}
                        </button>
                        <span className={cn("text-[13px]", isDone ? "line-through text-on-surface-variant" : "text-on-surface font-medium")}>
                          {t.title}
                        </span>
                      </div>
                      <span className="font-mono text-[11px] text-on-surface-variant">{t.priority}</span>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="p-[32px] max-w-[1440px] mx-auto flex flex-col gap-[32px]">
      {/* Header & Actions */}
      <div className="flex justify-between items-center mt-[20px]">
        <div>
          <h2 className="text-[28px] leading-9 font-semibold text-on-surface mb-[20px] flex items-center gap-[12px]">
            <span className="material-symbols-outlined text-[32px] text-primary">emoji_events</span>
            Goals & Milestones
          </h2>
          <p className="text-[14px] text-on-surface-variant">
            Track high-level objectives, project alignment, and progress metrics.
          </p>
        </div>
        <div className="flex gap-[12px]">
          <button
            onClick={onNewGoal}
            className="bg-primary hover:bg-primary/90 text-on-primary px-[20px] py-[10px] rounded-lg text-[12px] font-semibold transition-colors flex items-center justify-center gap-[16px] shadow-md shadow-primary/20 text-center"
          >
            <span className="material-symbols-outlined text-[16px]">add</span> New Goal
          </button>
        </div>
      </div>

      {goalSections.map((section) => {
        if (section.goals.length === 0 && section.id === 'repeating') return null;
        return (
          <section key={section.id} className="flex flex-col gap-[20px]">
            <div className="flex items-center gap-[12px] border-b border-outline-variant/30 pb-[12px]">
              <span className="material-symbols-outlined text-[22px] text-primary">{section.icon}</span>
              <h3 className="text-[16px] font-bold text-on-surface">{section.label}</h3>
              <span className="text-[12px] text-on-surface-variant bg-surface-container px-[10px] py-[2px] rounded-full">
                {section.goals.length}
              </span>
            </div>
            {section.goals.length === 0 ? (
              <div className="text-center py-[24px] text-on-surface-variant text-[13px] bg-surface rounded-2xl border border-outline-variant/20 border-dashed">
                No {section.label.toLowerCase()} yet
              </div>
            ) : (
              <div className="flex flex-col gap-[32px]">
                {section.goals.map(renderGoalCard)}
              </div>
            )}
          </section>
        );
      })}

      {goals.length === 0 && (
        <div className="text-center py-[40px] text-on-surface-variant text-[13px] bg-surface rounded-2xl border border-outline-variant/20">
          No goals yet — create your first goal to get started.
        </div>
      )}
    </div>
  );
}
