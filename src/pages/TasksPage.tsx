import { useState, useEffect, useRef } from 'react';
import { useTaskStore } from '@/stores/taskStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { playAlarm, stopAlarm } from '@/services/alarmService';
import type { Task } from '@/types';
import { cn } from '@/lib/utils';

interface TasksPageProps {
  onNewTask?: () => void;
  onEditTask?: (task: Task) => void;
}

function useCountdown(running: boolean, onExpire: () => void) {
  const [secondsLeft, setSecondsLeft] = useState(0);
  const expiredRef = useRef(false);

  useEffect(() => {
    if (!running) {
      setSecondsLeft(0);
      expiredRef.current = false;
      return;
    }
    if (secondsLeft === 0 && !expiredRef.current) {
      setSecondsLeft(60 * 15);
    }
    const id = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          if (!expiredRef.current) {
            expiredRef.current = true;
            onExpire();
          }
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const hh = String(Math.floor(secondsLeft / 3600)).padStart(2, '0');
  const mm = String(Math.floor((secondsLeft % 3600) / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

export function TasksPage({ onNewTask, onEditTask }: TasksPageProps) {
  const { tasks, selectedTask, setSelectedTask, completeTask, uncompleteTask, deleteTask, duplicateTask, getOverdueTasks, checkOverdueTasks } = useTaskStore();
  const [activeFilter, setActiveFilter] = useState<'today' | 'upcoming' | 'all' | 'completed' | 'overdue'>('all');
  const [timerActive, setTimerActive] = useState(false);
  const [timerToast, setTimerToast] = useState<string | null>(null);

  const overdueTasks = getOverdueTasks();

  useEffect(() => {
    checkOverdueTasks();
    const id = setInterval(checkOverdueTasks, 60000);
    return () => clearInterval(id);
  }, [checkOverdueTasks]);

  const handleExpire = () => {
    const s = useSettingsStore.getState();
    if (s.soundEnabled) playAlarm(s.pomodoroTune);
    setTimerToast('Timer finished! Alarm ringing...');
    setTimeout(() => setTimerToast(null), 5000);
  };

  const countdown = useCountdown(timerActive, handleExpire);

  const todayStr = new Date().toISOString().split('T')[0];
  const nowTime = `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`;

  const filteredTasks = tasks.filter((task) => {
    if (activeFilter === 'today') return task.scheduled_date === todayStr && task.status !== 'completed';
    if (activeFilter === 'upcoming') return task.scheduled_date && task.scheduled_date > todayStr && task.status !== 'completed';
    if (activeFilter === 'completed') return task.status === 'completed';
    if (activeFilter === 'overdue') {
      if (task.status === 'completed' || task.status === 'cancelled' || !task.scheduled_date) return false;
      if (task.scheduled_date < todayStr) return true;
      if (task.scheduled_date === todayStr && task.end_time && task.end_time < nowTime) return true;
      return false;
    }
    return true;
  });

  const handleToggleComplete = (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    if (task.status === 'completed') {
      uncompleteTask(task.id);
    } else {
      completeTask(task.id);
    }
  };

  const handleStartTimer = (task: Task) => {
    setTimerActive(true);
    setTimerToast(`Started timer for: "${task.title}"`);
    setTimeout(() => setTimerToast(null), 3000);
  };

  const handleStopTimer = () => {
    stopAlarm();
    setTimerActive(false);
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-background">
      {/* Timer Active Toast */}
      {timerToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-primary text-on-primary font-semibold text-[13px] px-[16px] py-[10px] rounded-xl shadow-2xl flex items-center gap-[18px] animate-in fade-in slide-in-from-bottom-4">
          <span className="material-symbols-outlined text-[18px]">timer</span>
          {timerToast}
        </div>
      )}

      {/* Main Task List Panel */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-outline-variant/20 bg-surface">
        {/* Filter Bar */}
        <div className="px-[32px] py-[20px] border-b border-outline-variant/20 flex flex-col gap-[20px] bg-surface-container-low/50">
          <div className="flex items-center justify-between">
            <div className="flex gap-[28px]">
              {(['all', 'today', 'upcoming', 'overdue', 'completed'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  className={cn(
                    "text-[13px] font-semibold pb-[4px] border-b-2 capitalize transition-all flex items-center justify-center gap-[16px] text-center",
                    activeFilter === filter
                      ? filter === 'overdue' ? "text-error border-error" : "text-primary border-primary"
                      : "text-on-surface-variant hover:text-on-surface border-transparent"
                  )}
                >
                  {filter}
                  {filter === 'overdue' && overdueTasks.length > 0 && (
                    <span className="bg-error text-on-error text-[10px] font-bold px-[6px] py-[2px] rounded-full min-w-[18px] text-center">
                      {overdueTasks.length}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <button
              onClick={onNewTask}
              className="bg-primary hover:bg-primary/90 text-on-primary text-[12px] font-semibold px-[20px] py-[10px] rounded-lg transition-colors flex items-center justify-center gap-[16px] shadow-sm text-center"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              New Task
            </button>
          </div>
        </div>

        {/* Task Items List */}
        <div className="flex-1 overflow-y-auto p-[32px] flex flex-col gap-[16px]">
          {filteredTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-[80px] text-center">
              <span className="material-symbols-outlined text-[48px] text-on-surface-variant/40 mb-[16px]">task_alt</span>
              <p className="text-[15px] font-semibold text-on-surface mb-[8px]">No tasks found</p>
              <p className="text-[13px] text-on-surface-variant mb-[24px]">No tasks match your current filter view.</p>
              <button
                onClick={onNewTask}
                className="px-[20px] py-[10px] bg-primary hover:bg-primary/90 text-on-primary text-[12px] font-semibold rounded-lg transition-colors flex items-center justify-center gap-[16px] text-center"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                Create New Task
              </button>
            </div>
          ) : (
            filteredTasks.map((task) => {
              const isSelected = selectedTask?.id === task.id;
              const isCompleted = task.status === 'completed';
              const isOverdue = task.isOverdue ||
                (task.scheduled_date && task.status !== 'completed' &&
                  (task.scheduled_date < todayStr ||
                   (task.scheduled_date === todayStr && task.end_time && task.end_time < nowTime)));

              return (
                <div
                  key={task.id}
                  onClick={() => setSelectedTask(task)}
                  className={cn(
                    "group flex items-center gap-[16px] p-[16px] rounded-xl cursor-pointer transition-all border",
                    isSelected
                      ? "bg-surface-container border-primary/50 shadow-sm"
                      : isOverdue
                        ? "bg-error-container/10 border-error/30 hover:bg-error-container/15"
                        : "bg-surface-container-low/40 border-outline-variant/20 hover:bg-surface-container-low hover:border-outline-variant/50"
                  )}
                >
                  <div
                    onClick={(e) => handleToggleComplete(task, e)}
                    className={cn(
                      "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors shrink-0 cursor-pointer",
                      isCompleted ? "bg-primary border-primary text-on-primary" : "border-outline-variant hover:border-primary"
                    )}
                  >
                    {isCompleted && <span className="material-symbols-outlined text-[14px]">check</span>}
                  </div>

                  <div className="flex-1 truncate">
                    <span className={cn(
                      "text-[14px] leading-5 block truncate",
                      isCompleted ? "line-through text-on-surface-variant" : "text-on-surface font-medium"
                    )}>
                      {task.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-[12px] shrink-0">
                    {isOverdue && (
                      <span className="bg-error text-on-error text-[11px] font-semibold uppercase px-[8px] py-[2px] rounded border border-error">
                        overdue
                      </span>
                    )}
                    <span className={cn(
                      "text-[11px] font-semibold uppercase px-[8px] py-[2px] rounded border",
                      task.priority === 'critical' ? "bg-error/20 text-error border-error/30" :
                      task.priority === 'high' ? "bg-tertiary/20 text-tertiary border-tertiary/30" :
                      "bg-surface-container-high text-on-surface-variant border-outline-variant/30"
                    )}>
                      {task.priority}
                    </span>
                    <span className="font-mono text-[12px] text-on-surface-variant">
                      {task.start_time || task.scheduled_date || 'Today'}
                    </span>
                    <div className="flex items-center gap-[14px] opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => { e.stopPropagation(); if (onEditTask) onEditTask(task); }}
                        className="p-[4px] text-on-surface-variant hover:text-primary rounded hover:bg-surface-container transition-colors"
                        title="Edit Task"
                      >
                        <span className="material-symbols-outlined text-[18px]">edit</span>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }}
                        className="p-[4px] text-on-surface-variant hover:text-error rounded hover:bg-surface-container transition-colors"
                        title="Delete Task"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Task Detail Drawer / Sidebar */}
      {selectedTask && (
        <aside className="w-[420px] flex-shrink-0 bg-surface-container-low/80 backdrop-blur-xl border-l border-outline-variant/20 flex flex-col h-full shadow-2xl">
          <div className="h-16 border-b border-outline-variant/20 flex items-center justify-between px-[28px] shrink-0">
            <div className="flex gap-[18px]">
              <button
                onClick={() => completeTask(selectedTask.id)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container text-on-surface-variant hover:text-primary transition-colors"
                title="Mark Completed"
              >
                <span className="material-symbols-outlined text-[20px]">check_circle</span>
              </button>
              <button
                onClick={() => duplicateTask(selectedTask.id)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container text-on-surface-variant hover:text-primary transition-colors"
                title="Duplicate Task"
              >
                <span className="material-symbols-outlined text-[20px]">content_copy</span>
              </button>
            </div>
            <div className="flex gap-[18px]">
              <button
                onClick={() => deleteTask(selectedTask.id)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-error-container hover:text-on-error-container text-on-surface-variant transition-colors"
                title="Delete Task"
              >
                <span className="material-symbols-outlined text-[20px]">delete</span>
              </button>
              <button
                onClick={() => setSelectedTask(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container text-on-surface-variant transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-[28px] flex flex-col gap-[28px]">
            <div>
              <h2 className="text-[22px] font-bold text-on-surface mb-[24px] leading-snug">{selectedTask.title}</h2>
              <div className="flex flex-col gap-[12px]">
                <div className="flex items-center justify-between py-[10px] border-b border-outline-variant/10 text-[13px]">
                  <span className="text-on-surface-variant flex items-center gap-[18px] font-medium">
                    <span className="material-symbols-outlined text-[16px]">radio_button_checked</span> Status
                  </span>
                  <span className="text-on-surface font-semibold capitalize">{selectedTask.status.replace('_', ' ')}</span>
                </div>
                <div className="flex items-center justify-between py-[10px] border-b border-outline-variant/10 text-[13px]">
                  <span className="text-on-surface-variant flex items-center gap-[18px] font-medium">
                    <span className="material-symbols-outlined text-[16px]">priority_high</span> Priority
                  </span>
                  <span className="text-on-surface font-semibold capitalize">{selectedTask.priority}</span>
                </div>
                <div className="flex items-center justify-between py-[10px] border-b border-outline-variant/10 text-[13px]">
                  <span className="text-on-surface-variant flex items-center gap-[18px] font-medium">
                    <span className="material-symbols-outlined text-[16px]">calendar_today</span> Scheduled
                  </span>
                  <span className="font-mono text-on-surface">{selectedTask.scheduled_date || 'Today'}</span>
                </div>
                <div className="flex items-center justify-between py-[10px] border-b border-outline-variant/10 text-[13px]">
                  <span className="text-on-surface-variant flex items-center gap-[18px] font-medium">
                    <span className="material-symbols-outlined text-[16px]">schedule</span> Time
                  </span>
                  <span className="font-mono text-on-surface">
                    {selectedTask.start_time || '--:--'} - {selectedTask.end_time || '--:--'}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-[12px] font-semibold text-on-surface-variant uppercase tracking-wider mb-[20px]">Description</h3>
              <div className="bg-surface rounded-xl p-[20px] border border-outline-variant/20 text-[13px] text-on-surface/90 leading-relaxed min-h-[120px]">
                {selectedTask.description || 'No detailed description provided.'}
              </div>
            </div>

            {timerActive && (
              <div className="bg-secondary-container/20 border border-secondary/30 rounded-xl p-[20px] flex items-center justify-between">
                <span className="text-[13px] font-semibold text-secondary flex items-center gap-[18px]">
                  <span className="material-symbols-outlined text-[16px] animate-pulse">timer</span>
                  Timer Running
                </span>
                <span className="font-mono text-[18px] font-bold text-on-surface">{countdown}</span>
              </div>
            )}
          </div>

          <div className="p-[20px] border-t border-outline-variant/20 bg-surface-container shrink-0">
            <button
              onClick={() => timerActive ? handleStopTimer() : handleStartTimer(selectedTask)}
              className={cn(
                "w-full py-[12px] font-semibold text-[13px] rounded-xl transition-all flex items-center justify-center gap-[18px] shadow-lg",
                timerActive
                  ? "bg-error-container text-on-error-container hover:bg-error-container/80 shadow-error/20"
                  : "bg-primary hover:bg-primary/90 text-on-primary shadow-primary/20"
              )}
            >
              <span className="material-symbols-outlined text-[18px]">{timerActive ? 'stop' : 'play_arrow'}</span>
              {timerActive ? `Stop Timer (${countdown})` : 'Start Task Timer'}
            </button>
          </div>
        </aside>
      )}
    </div>
  );
}
