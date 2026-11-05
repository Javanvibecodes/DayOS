import { useState, useEffect, useRef } from 'react';
import { useTaskStore } from '@/stores/taskStore';
import { useGoalStore } from '@/stores/goalStore';
import { useMeetingStore } from '@/stores/meetingStore';
import { useUIStore } from '@/stores/uiStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { playAlarm, stopAlarm } from '@/services/alarmService';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface TodayPageProps {
  onOpenGoalModal?: () => void;
  onOpenTaskModal?: () => void;
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
      expiredRef.current = false;
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

export function TodayPage({ onOpenGoalModal }: TodayPageProps) {
  const { tasks, completeTask, uncompleteTask, getOverdueTasks, checkOverdueTasks } = useTaskStore();
  const { goals } = useGoalStore();
  const { meetings } = useMeetingStore();
  const { setCurrentPage } = useUIStore();

  const [timerRunning, setTimerRunning] = useState(false);

  useEffect(() => {
    checkOverdueTasks();
    const id = setInterval(checkOverdueTasks, 60000);
    return () => clearInterval(id);
  }, [checkOverdueTasks]);

  const handleExpire = () => {
    const s = useSettingsStore.getState();
    if (s.soundEnabled) playAlarm(s.pomodoroTune);
  };

  const countdown = useCountdown(timerRunning, handleExpire);

  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  const todayTasks = tasks.filter((t) => t.scheduled_date === todayStr && t.status !== 'completed');
  const todayMeetings = meetings.filter((m) => m.date === todayStr);
  const highPriorityTasks = tasks.filter((t) => (t.priority === 'critical' || t.priority === 'high') && t.status !== 'completed');
  const activeGoals = goals.filter((g) => g.status === 'active');
  const dailyGoals = activeGoals.filter((g) => g.type === 'daily');
  const weeklyGoals = activeGoals.filter((g) => g.type === 'weekly');
  const overdueTasks = getOverdueTasks();

  const nextTask = todayTasks[0] || tasks[0];

  const displayName = (useSettingsStore((s) => s.displayName) || '').trim() || 'User';

  const formatGreeting = () => {
    const hour = today.getHours();
    if (hour < 12) return `Good morning, ${displayName}`;
    if (hour < 18) return `Good afternoon, ${displayName}`;
    return `Good evening, ${displayName}`;
  };

  const handleToggleTask = (taskId: string, isCompleted: boolean) => {
    if (isCompleted) {
      uncompleteTask(taskId);
    } else {
      completeTask(taskId);
    }
  };

  const toggleTimer = () => {
    if (timerRunning) {
      stopAlarm();
      setTimerRunning(false);
    } else {
      setTimerRunning(true);
    }
  };

  return (
    <div className="p-[32px] max-w-[1440px] mx-auto">
      {/* Page Header: Greeting & Summary */}
      <div className="mb-[30px] mt-[12px]">
        <p className="font-mono text-[13px] text-primary font-semibold tracking-wide uppercase mb-[10px]">
          {format(today, 'EEEE, MMMM d')}
        </p>
        <h2 className="text-[32px] leading-10 tracking-[-0.02em] font-bold text-on-surface mb-[20px]">
          {formatGreeting()}
        </h2>
        <p className="text-[14px] leading-5 text-on-surface-variant flex items-center gap-[18px]">
          <span className="inline-flex items-center gap-[16px] font-medium">
            <span className="w-2 h-2 rounded-full bg-secondary"></span>
            {todayTasks.length} task{todayTasks.length !== 1 ? 's' : ''}
          </span>
          <span className="text-outline-variant">•</span>
          <span className="inline-flex items-center gap-[16px] font-medium">
            <span className="w-2 h-2 rounded-full bg-tertiary"></span>
            {todayMeetings.length} meeting{todayMeetings.length !== 1 ? 's' : ''}
          </span>
          <span className="text-outline-variant">•</span>
          <span className="inline-flex items-center gap-[16px] font-medium">
            <span className="w-2 h-2 rounded-full bg-primary"></span>
            {activeGoals.length} goal{activeGoals.length !== 1 ? 's' : ''}
          </span>
          {overdueTasks.length > 0 && (
            <>
              <span className="text-outline-variant">•</span>
              <span className="inline-flex items-center gap-[16px] font-medium text-error">
                <span className="w-2 h-2 rounded-full bg-error"></span>
                {overdueTasks.length} overdue
              </span>
            </>
          )}
        </p>
      </div>

      {/* Overdue Section */}
      {overdueTasks.length > 0 && (
        <div className="mb-[32px] bg-error-container/10 border border-error/30 rounded-xl p-[28px]">
          <div className="flex items-center gap-[18px] mb-[20px]">
            <span className="material-symbols-outlined text-[18px] text-error">warning</span>
            <h3 className="text-[13px] font-semibold text-error uppercase tracking-wider">
              Overdue ({overdueTasks.length})
            </h3>
          </div>
          <div className="flex flex-col gap-[12px]">
            {overdueTasks.slice(0, 5).map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-[14px] p-[14px] bg-surface-container-low rounded-lg border border-error/20"
              >
                <button
                  onClick={() => completeTask(task.id)}
                  className="w-4 h-4 rounded border-2 border-error/50 hover:border-error flex items-center justify-center transition-colors shrink-0"
                />
                <span className="flex-1 text-[13px] text-on-surface font-medium">{task.title}</span>
                <span className="font-mono text-[11px] text-error">
                  {task.scheduled_date}
                  {task.end_time ? ` ${task.end_time}` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-[32px] mt-[40px]">
        {/* Left Column: Timeline & Next Up (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-[32px]">
          {/* Next Up Card */}
          <div className="bg-surface-container rounded-xl border border-outline-variant/30 p-[28px] relative overflow-hidden group shadow-sm">
            <div className="absolute inset-0 bg-gradient-to-r from-primary-container/10 to-transparent opacity-50"></div>
            <div className="relative z-10 flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-[11px] font-semibold text-primary uppercase tracking-wider mb-[20px] flex items-center gap-[16px]">
                  <span className="material-symbols-outlined text-[16px]">bolt</span> Next up
                </h3>
                {nextTask ? (
                  <>
                    <p className="text-[20px] leading-7 font-bold text-on-surface mb-[16px]">
                      {nextTask.title}
                    </p>
                    <p className="font-mono text-[13px] text-on-surface-variant flex items-center gap-[18px]">
                      <span className="material-symbols-outlined text-[16px]">schedule</span>
                      {nextTask.start_time || '09:00'} - {nextTask.end_time || '10:30'}
                    </p>
                  </>
                ) : (
                  <div className="flex flex-col items-start gap-[14px] py-[4px]">
                    <p className="text-[15px] leading-6 font-medium text-on-surface-variant">
                      Nothing scheduled yet
                    </p>
                    <p className="text-[13px] text-on-surface-variant/70">
                      Create a task to see it here.
                    </p>
                  </div>
                )}
              </div>
              <button
                onClick={toggleTimer}
                disabled={!nextTask}
                className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-md active:scale-95",
                  !nextTask && "opacity-40 cursor-not-allowed",
                  timerRunning
                    ? "bg-secondary text-on-secondary animate-pulse"
                    : "bg-primary-container text-on-primary-container hover:bg-primary"
                )}
                title={timerRunning ? "Pause Timer" : "Start Task Timer"}
              >
                <span className="material-symbols-outlined text-[24px]">
                  {timerRunning ? 'pause' : 'play_arrow'}
                </span>
              </button>
            </div>
            {timerRunning && (
              <div className="mt-[20px] pt-[8px] border-t border-outline-variant/20 flex items-center justify-between text-[11px] font-mono text-secondary">
                <span>Timer active: {countdown}</span>
                <span className="animate-pulse">● Running</span>
              </div>
            )}
          </div>

          {/* Today's Timeline */}
          <div className="bg-surface rounded-xl border border-outline-variant/30 flex flex-col flex-1 shadow-sm">
            <div className="p-[20px] border-b border-outline-variant/20 flex justify-between items-center bg-surface-container-low/50">
              <h3 className="text-[13px] font-semibold text-on-surface flex items-center gap-[18px] mb-[8px]">
                <span className="material-symbols-outlined text-[18px] text-primary">timeline</span> Today's Timeline
              </h3>
            </div>
            <div className="p-[28px] relative flex-1">
              <div className="absolute left-[88px] top-5 bottom-5 w-px bg-outline-variant/20 z-0"></div>
              <div className="flex flex-col gap-[12px] relative z-10">
                {todayTasks.length === 0 && todayMeetings.length === 0 ? (
                  <div className="text-center py-[40px] text-on-surface-variant text-[13px]">
                    No events scheduled for today
                  </div>
                ) : (
                  <>
                    {todayTasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-start gap-[16px] group hover:bg-surface-container-low p-[10px] rounded-xl transition-colors -ml-[8px]"
                      >
                        <div className="w-16 font-mono text-[13px] text-on-surface-variant text-right pt-[2px] group-hover:text-primary transition-colors">
                          {task.start_time || '09:00'}
                        </div>
                        <div className="relative pt-[6px]">
                          <div
                            className={cn(
                              "w-3 h-3 rounded-full border-2 border-surface absolute -left-[5px] top-2 z-10",
                              task.priority === 'critical' ? "bg-error" :
                              task.priority === 'high' ? "bg-tertiary" :
                              task.priority === 'medium' ? "bg-primary" :
                              "bg-outline-variant"
                            )}
                          />
                        </div>
                        <div className="flex-1 bg-surface-container-low border border-outline-variant/20 rounded-xl p-[12px] group-hover:border-primary/40 transition-colors">
                          <p className="text-[14px] font-medium text-on-surface mb-[12px]">{task.title}</p>
                          {task.description && (
                            <p className="text-[12px] text-on-surface-variant line-clamp-1">
                              {task.description}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                    {todayMeetings.map((meeting) => (
                      <div
                        key={meeting.id}
                        className="flex items-start gap-[16px] group hover:bg-surface-container-low p-[10px] rounded-xl transition-colors -ml-[8px]"
                      >
                        <div className="w-16 font-mono text-[13px] text-on-surface-variant text-right pt-[2px]">
                          {meeting.start_time}
                        </div>
                        <div className="relative pt-[6px]">
                          <div className="w-3 h-3 rounded-full bg-tertiary border-2 border-surface absolute -left-[5px] top-2 z-10" />
                        </div>
                        <div className="flex-1 bg-surface-container-low border border-outline-variant/20 rounded-xl p-[12px] border-l-4 border-l-tertiary">
                          <p className="text-[14px] text-on-surface font-semibold mb-[12px]">{meeting.title}</p>
                          <p className="text-[11px] font-mono text-on-surface-variant">
                            {meeting.start_time} - {meeting.end_time || '11:00'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Priority & Goals (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-[32px]">
          {/* Priority Tasks */}
          <div className="bg-surface rounded-xl border border-outline-variant/30 flex flex-col shadow-sm">
            <div className="p-[20px] border-b border-outline-variant/20 flex justify-between items-center bg-surface-container-low/50 rounded-t-xl">
              <h3 className="text-[13px] font-semibold text-on-surface flex items-center gap-[18px] mb-[8px]">
                <span className="material-symbols-outlined text-[18px] text-error">priority_high</span>
                High Priority
              </h3>
              <span className="bg-error-container/20 text-error text-[11px] font-semibold px-[10px] py-[4px] rounded-full border border-error/30">
                {highPriorityTasks.length} pending
              </span>
            </div>
            <div className="flex flex-col p-[12px]">
              {highPriorityTasks.slice(0, 5).map((task) => {
                const isCompleted = task.status === 'completed';
                return (
                  <div
                    key={task.id}
                    onClick={() => handleToggleTask(task.id, isCompleted)}
                    className="flex items-center gap-[12px] p-[12px] hover:bg-surface-container-low rounded-xl transition-colors cursor-pointer group"
                  >
                    <div className={cn(
                      "w-4 h-4 rounded border-2 flex items-center justify-center transition-colors",
                      isCompleted ? "bg-primary border-primary" : "border-outline-variant group-hover:border-primary"
                    )}>
                      {isCompleted && <span className="material-symbols-outlined text-[12px] text-on-primary">check</span>}
                    </div>
                    <span className={cn(
                      "flex-1 text-[13px] transition-colors",
                      isCompleted ? "text-on-surface-variant line-through" : "text-on-surface group-hover:text-primary font-medium"
                    )}>
                      {task.title}
                    </span>
                    <span
                      className={cn(
                        "w-2 h-2 rounded-full",
                        task.priority === 'critical' ? "bg-error" : "bg-tertiary"
                      )}
                    />
                  </div>
                );
              })}
              {highPriorityTasks.length === 0 && (
                <div className="text-center py-[24px] text-on-surface-variant text-[13px]">
                  No high priority tasks
                </div>
              )}
            </div>
            <div className="p-[12px] border-t border-outline-variant/10">
              <button
                onClick={() => setCurrentPage('tasks')}
                className="w-full py-[10px] text-[12px] font-semibold text-primary hover:bg-primary-container/20 rounded-lg transition-colors text-center flex items-center justify-center"
              >
                View all tasks
              </button>
            </div>
          </div>

          {/* Today's Goals Progress */}
          <div className="bg-surface rounded-xl border border-outline-variant/30 flex flex-col flex-1 shadow-sm">
            <div className="p-[20px] border-b border-outline-variant/20 flex justify-between items-center bg-surface-container-low/50">
              <h3 className="text-[13px] font-semibold text-on-surface flex items-center gap-[18px] mb-[8px]">
                <span className="material-symbols-outlined text-[18px] text-primary">track_changes</span> Today's Goals
              </h3>
            </div>
            <div className="p-[28px] flex flex-col gap-[20px]">
              {dailyGoals.slice(0, 3).map((goal) => {
                const goalTasks = tasks.filter((t) => t.goal_id === goal.id);
                const completed = goalTasks.filter((t) => t.status === 'completed').length;
                const progress = goalTasks.length > 0 ? Math.round((completed / goalTasks.length) * 100) : 0;

                return (
                  <div
                    key={goal.id}
                    className="bg-surface-container-low border border-outline-variant/20 rounded-xl p-[16px]"
                  >
                    <div className="flex justify-between items-start mb-[20px]">
                      <div>
                        <p className="text-[13px] font-semibold text-on-surface mb-[12px]">{goal.title}</p>
                        <p className="text-[11px] text-on-surface-variant capitalize">{goal.type} Goal</p>
                      </div>
                      <span className="font-mono text-[12px] font-bold text-primary">{progress}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              {dailyGoals.length === 0 && (
                <div className="text-center py-[16px] text-on-surface-variant text-[13px]">
                  No daily goals
                </div>
              )}
              <button
                onClick={() => onOpenGoalModal ? onOpenGoalModal() : setCurrentPage('goals')}
                className="w-full py-[10px] border border-dashed border-outline-variant/40 rounded-xl text-[12px] font-semibold text-on-surface-variant hover:text-primary hover:border-primary hover:bg-surface-container-low transition-colors flex items-center justify-center gap-[18px] text-center"
              >
                <span className="material-symbols-outlined text-[16px]">add</span> Add Goal
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* This Week's Goals */}
      <section className="mt-[28px]">
        <div className="bg-surface rounded-xl border border-outline-variant/30 shadow-sm">
          <div className="p-[20px] border-b border-outline-variant/20 flex justify-between items-center bg-surface-container-low/50">
            <h3 className="text-[13px] font-semibold text-on-surface flex items-center gap-[18px] mb-[8px]">
              <span className="material-symbols-outlined text-[18px] text-primary">date_range</span> This Week's Goals
            </h3>
            <button
              onClick={() => setCurrentPage('goals')}
              className="text-[12px] font-semibold text-primary hover:underline flex items-center justify-center text-center"
            >
              View all
            </button>
          </div>
          <div className="p-[24px] flex flex-col gap-[16px]">
            {weeklyGoals.length === 0 ? (
              <div className="text-center py-[16px] text-on-surface-variant text-[13px]">
                No weekly goals this week
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-[16px]">
                {weeklyGoals.map((goal) => {
                  const goalTasks = tasks.filter((t) => t.goal_id === goal.id);
                  const completed = goalTasks.filter((t) => t.status === 'completed').length;
                  const progress = goalTasks.length > 0 ? Math.round((completed / goalTasks.length) * 100) : 0;
                  return (
                    <div
                      key={goal.id}
                      className="bg-surface-container-low border border-outline-variant/20 rounded-xl p-[16px]"
                    >
                      <div className="flex justify-between items-start mb-[12px]">
                        <p className="text-[13px] font-semibold text-on-surface">{goal.title}</p>
                        <span className="font-mono text-[12px] font-bold text-primary">{progress}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
