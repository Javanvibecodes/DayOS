import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';
import { useUIStore } from '@/stores/uiStore';
import { useTaskStore } from '@/stores/taskStore';
import { useGoalStore } from '@/stores/goalStore';
import { useProjectStore } from '@/stores/projectStore';
import { useMeetingStore } from '@/stores/meetingStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useCategoryStore } from '@/stores/categoryStore';
import { playAlarm, playNotificationChime, stopAlarm, onAlarmChange, isAlarmRinging } from '@/services/alarmService';
import { isEnabled as autostartIsEnabled } from '@tauri-apps/plugin-autostart';
import { ToastHost } from '@/components/ToastHost';
import { applyAppearance } from '@/lib/theme';

// Pages
import { TodayPage } from '@/pages/TodayPage';
import { TasksPage } from '@/pages/TasksPage';
import { GoalsPage } from '@/pages/GoalsPage';
import { ProjectsPage } from '@/pages/ProjectsPage';
import { MeetingsPage } from '@/pages/MeetingsPage';
import { TimetablePage } from '@/pages/TimetablePage';
import { SettingsPage } from '@/pages/SettingsPage';
import { PomodoroPage } from '@/pages/PomodoroPage';
import { RoutinesPage } from '@/pages/RoutinesPage';
import { NotesPage } from '@/pages/NotesPage';
import {
  SHORTCUT_ACTIONS,
  SHORTCUT_LABELS,
  DEFAULT_SHORTCUTS,
  comboMatches,
} from '@/lib/shortcuts';

// Modals
import { TaskModal } from '@/components/modals/TaskModal';
import { GoalModal } from '@/components/modals/GoalModal';
import { ProjectModal } from '@/components/modals/ProjectModal';
import { MeetingModal } from '@/components/modals/MeetingModal';
import { CommandPaletteModal } from '@/components/modals/CommandPaletteModal';
import type { Task, Goal, Project, Meeting } from '@/types';

function App() {
  const { toggleSidebar, currentPage, setCurrentPage, commandPaletteOpen, setCommandPaletteOpen } = useUIStore();
  const { loadTasks, tasks, checkOverdueTasks } = useTaskStore();
  const { loadGoals } = useGoalStore();
  const { loadProjects } = useProjectStore();
  const { loadMeetings, meetings } = useMeetingStore();
  const { loadCategories } = useCategoryStore();
  const settingsStore = useSettingsStore();

  // Modals state
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [meetingModalOpen, setMeetingModalOpen] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [alarmRinging, setAlarmRinging] = useState(isAlarmRinging());

  useEffect(() => {
    return onAlarmChange(setAlarmRinging);
  }, []);

  useEffect(() => {
    loadTasks();
    loadGoals();
    loadProjects();
    loadMeetings();
    void loadCategories();
    void (async () => {
      await settingsStore.loadSettings();
      const s = useSettingsStore.getState();
      applyAppearance(s.colorMode, s.theme);
      try {
        // Align with actual Windows Startup settings (Windows is source of truth)
        const systemEnabled = await autostartIsEnabled();
        if (systemEnabled !== s.startWithWindows) {
          await useSettingsStore.getState().updateSetting('startWithWindows', systemEnabled);
        }
      } catch {
        // not in Tauri — ignore
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Overdue check every 60s
  useEffect(() => {
    checkOverdueTasks();
    const id = setInterval(checkOverdueTasks, 60000);
    return () => clearInterval(id);
  }, [checkOverdueTasks]);

  // Alarm check: expired tasks + upcoming meetings every 30s
  useEffect(() => {
    const firedRef = new Set<string>();

    const checkAlarms = () => {
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      // Expired incomplete tasks today
      for (const t of tasks) {
        if (t.status === 'completed' || t.status === 'cancelled') continue;
        if (t.scheduled_date !== todayStr || !t.end_time) continue;
        if (t.end_time <= nowTime) {
          const key = `task-${t.id}-${todayStr}-${nowTime.slice(0, 2)}`;
          if (!firedRef.has(key)) {
            firedRef.add(key);
            const s = useSettingsStore.getState();
            if (s.soundEnabled) playAlarm(s.taskReminderTune);
          }
        }
      }

      // Upcoming meetings within any reminder offset window
      for (const m of meetings) {
        if (m.date !== todayStr) continue;
        const offsets = (m.reminder_offsets && m.reminder_offsets.length > 0)
          ? m.reminder_offsets
          : (m.reminder_enabled && m.reminder_minutes != null ? [m.reminder_minutes] : []);
        if (offsets.length === 0) continue;
        const [mh, mm] = m.start_time.split(':').map(Number);
        const mTotal = mh * 60 + mm;
        const nTotal = now.getHours() * 60 + now.getMinutes();
        const diff = mTotal - nTotal;
        const hitOffset = offsets.find((o) => diff > 0 && diff <= o);
        if (hitOffset !== undefined) {
          const key = `meeting-${m.id}-${m.start_time}-${hitOffset}`;
          if (!firedRef.has(key)) {
            firedRef.add(key);
            const s = useSettingsStore.getState();
            if (s.soundEnabled) playNotificationChime(s.meetingReminderTune);
          }
        }
      }
    };

    checkAlarms();
    const id = setInterval(checkAlarms, 30000);
    return () => clearInterval(id);
  }, [tasks, meetings]);

  // Global Keyboard Shortcuts (bindings from settings store)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const bindings = useSettingsStore.getState().shortcuts ?? DEFAULT_SHORTCUTS;
      let handled = false;

      if (comboMatches(e, bindings.commandPalette)) {
        e.preventDefault();
        setCommandPaletteOpen(!commandPaletteOpen);
        handled = true;
      }
      if (!handled && comboMatches(e, bindings.toggleSidebar)) {
        e.preventDefault();
        toggleSidebar();
        handled = true;
      }
      if (!handled && comboMatches(e, bindings.newTask)) {
        e.preventDefault();
        handleOpenTaskModal();
        handled = true;
      }
      if (!handled && comboMatches(e, bindings.newGoal)) {
        e.preventDefault();
        setEditingGoal(null);
        setGoalModalOpen(true);
        handled = true;
      }
      if (!handled && comboMatches(e, bindings.newMeeting)) {
        e.preventDefault();
        handleOpenMeetingModal();
        handled = true;
      }
      if (!handled && comboMatches(e, bindings.newProject)) {
        e.preventDefault();
        handleOpenProjectModal();
        handled = true;
      }
      if (!handled && comboMatches(e, bindings.toggleTimetable)) {
        e.preventDefault();
        setCurrentPage(currentPage === 'timetable' ? 'today' : 'timetable');
        handled = true;
      }
      if (!handled && comboMatches(e, bindings.turnOffAlarm)) {
        e.preventDefault();
        stopAlarm();
        handled = true;
      }
      if (!handled && comboMatches(e, bindings.openPomodoro)) {
        e.preventDefault();
        setCurrentPage('pomodoro');
        handled = true;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commandPaletteOpen, setCommandPaletteOpen, toggleSidebar, currentPage]);

  const handleOpenTaskModal = (task?: Task | null) => {
    setEditingTask(task || null);
    setTaskModalOpen(true);
  };

  const handleOpenGoalModal = (goal?: Goal | null) => {
    setEditingGoal(goal || null);
    setGoalModalOpen(true);
  };

  const handleOpenProjectModal = (project?: Project | null) => {
    setEditingProject(project || null);
    setProjectModalOpen(true);
  };

  const handleOpenMeetingModal = (meeting?: Meeting | null) => {
    setEditingMeeting(meeting || null);
    setMeetingModalOpen(true);
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'tasks':
        return (
          <TasksPage
            onNewTask={() => handleOpenTaskModal()}
            onEditTask={(t) => handleOpenTaskModal(t)}
          />
        );
      case 'goals':
        return (
          <GoalsPage
            onNewGoal={() => handleOpenGoalModal()}
            onNewTask={() => handleOpenTaskModal()}
            onEditGoal={(g) => handleOpenGoalModal(g)}
          />
        );
      case 'projects':
        return (
          <ProjectsPage
            onNewProject={() => handleOpenProjectModal()}
            onEditProject={(p) => handleOpenProjectModal(p)}
          />
        );
      case 'meetings':
        return (
          <MeetingsPage
            onNewMeeting={() => handleOpenMeetingModal()}
            onEditMeeting={(m) => handleOpenMeetingModal(m)}
          />
        );
      case 'timetable':
        return (
          <TimetablePage
            onNewTask={() => handleOpenTaskModal()}
          />
        );
      case 'pomodoro':
        return <PomodoroPage />;
      case 'routines':
        return <RoutinesPage />;
      case 'notes':
        return <NotesPage />;
      case 'settings':
        return <SettingsPage />;
      case 'today':
      default:
        return (
          <TodayPage
            onOpenGoalModal={() => handleOpenGoalModal()}
            onOpenTaskModal={() => handleOpenTaskModal()}
          />
        );
    }
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-on-background">
      {/* Sidebar - part of flex flow */}
      <Sidebar />

      {/* Main Content Area - flex-1 fills remaining space */}
      <div className="flex-1 flex flex-col h-full min-w-0 border-l-2 border-outline-variant/50 pl-[60px] bg-background">
        <TopBar
          onOpenHelp={() => setHelpModalOpen(true)}
        />
        <main className="flex-1 overflow-y-auto bg-background">
          {renderPage()}
        </main>
      </div>

      {/* Global Modals */}
      <TaskModal
        isOpen={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
        taskToEdit={editingTask}
      />
      <GoalModal
        isOpen={goalModalOpen}
        onClose={() => setGoalModalOpen(false)}
        goalToEdit={editingGoal}
      />
      <ProjectModal
        isOpen={projectModalOpen}
        onClose={() => setProjectModalOpen(false)}
        projectToEdit={editingProject}
      />
      <MeetingModal
        isOpen={meetingModalOpen}
        onClose={() => setMeetingModalOpen(false)}
        meetingToEdit={editingMeeting}
      />
      <CommandPaletteModal
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onOpenTaskModal={() => { setCommandPaletteOpen(false); handleOpenTaskModal(); }}
        onOpenGoalModal={() => { setCommandPaletteOpen(false); handleOpenGoalModal(); }}
        onOpenProjectModal={() => { setCommandPaletteOpen(false); handleOpenProjectModal(); }}
        onOpenMeetingModal={() => { setCommandPaletteOpen(false); handleOpenMeetingModal(); }}
      />

      {/* Global toast notifications */}
      <ToastHost />

      {/* Repeat-until-stopped alarm banner */}
      {alarmRinging && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-[16px] bg-error-container text-on-error-container border border-error/40 px-[20px] py-[12px] rounded-2xl shadow-2xl">
          <span className="material-symbols-outlined text-[22px] animate-pulse">notifications_active</span>
          <div className="flex flex-col">
            <span className="text-[13px] font-bold">Reminder alert is ringing</span>
            <span className="text-[11px] opacity-80">Repeats until you turn it off</span>
          </div>
          <button
            onClick={() => stopAlarm()}
            className="ml-[8px] px-[16px] py-[8px] rounded-xl bg-error text-on-error text-[12px] font-bold hover:opacity-90 transition-opacity flex items-center gap-[8px] justify-center text-center"
          >
            <span className="material-symbols-outlined text-[16px]">stop_circle</span>
            Turn Off
          </button>
        </div>
      )}

      {/* Help & Shortcuts Modal */}
      {helpModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-[16px]" onClick={() => setHelpModalOpen(false)}>
          <div className="bg-surface border border-outline-variant/30 rounded-2xl w-full max-w-md shadow-2xl p-[28px] flex flex-col gap-[24px]" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b border-outline-variant/20 pb-[16px]">
              <h3 className="text-[18px] font-bold text-on-surface flex items-center gap-[18px] mb-[12px]">
                <span className="material-symbols-outlined text-primary">help</span> DayOS Shortcuts
              </h3>
              <button onClick={() => setHelpModalOpen(false)} className="text-on-surface-variant hover:text-on-surface">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <div className="flex flex-col gap-[16px] text-[13px]">
              {(settingsStore.shortcuts
                ? SHORTCUT_ACTIONS
                : SHORTCUT_ACTIONS
              ).map((action) => {
                const combo = settingsStore.shortcuts?.[action] ?? DEFAULT_SHORTCUTS[action];
                return (
                  <div key={action} className="flex justify-between items-center py-[2px] gap-[16px]">
                    <span className="text-on-surface-variant">{SHORTCUT_LABELS[action]}</span>
                    <div className="flex gap-[6px] flex-wrap justify-end">
                      {combo.split('+').map((k) => (
                        <kbd
                          key={k}
                          className="px-[10px] py-[6px] bg-surface-container-highest border border-outline-variant/30 rounded text-on-surface font-mono"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                );
              })}
              <p className="text-[11px] text-on-surface-variant/70 pt-[8px] border-t border-outline-variant/20">
                Edit any shortcut in Settings → Shortcuts.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
