import { useState, useEffect } from 'react';
import { useUIStore } from '@/stores/uiStore';
import { useTaskStore } from '@/stores/taskStore';
import { useGoalStore } from '@/stores/goalStore';
import { useMeetingStore } from '@/stores/meetingStore';
import type { NavItem } from '@/types';

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenTaskModal: () => void;
  onOpenGoalModal: () => void;
  onOpenProjectModal: () => void;
  onOpenMeetingModal: () => void;
}

export function CommandPaletteModal({
  isOpen,
  onClose,
  onOpenTaskModal,
  onOpenGoalModal,
  onOpenProjectModal,
  onOpenMeetingModal,
}: CommandPaletteModalProps) {
  const { setCurrentPage } = useUIStore();
  const { tasks } = useTaskStore();
  const { goals } = useGoalStore();
  const { meetings } = useMeetingStore();

  const [query, setQuery] = useState('');

  useEffect(() => {
    if (isOpen) {
      setQuery('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const navigateTo = (page: NavItem) => {
    setCurrentPage(page);
    onClose();
  };

  const navCommands = [
    { label: 'Go to Today', icon: 'today', action: () => navigateTo('today') },
    { label: 'Go to Tasks', icon: 'checklist', action: () => navigateTo('tasks') },
    { label: 'Go to Goals', icon: 'emoji_events', action: () => navigateTo('goals') },
    { label: 'Go to Projects', icon: 'account_tree', action: () => navigateTo('projects') },
    { label: 'Go to Meetings', icon: 'groups', action: () => navigateTo('meetings') },
    { label: 'Go to Timetable', icon: 'calendar_view_day', action: () => navigateTo('timetable') },
    { label: 'Go to Routines', icon: 'routine', action: () => navigateTo('routines') },
    { label: 'Go to Notes', icon: 'sticky_note_2', action: () => navigateTo('notes') },
    { label: 'Go to Pomodoro', icon: 'timer', action: () => navigateTo('pomodoro') },
    { label: 'Go to Settings', icon: 'settings', action: () => navigateTo('settings') },
  ];

  const createCommands = [
    { label: 'Create New Task', icon: 'add_task', action: () => { onClose(); onOpenTaskModal(); } },
    { label: 'Create New Goal', icon: 'emoji_events', action: () => { onClose(); onOpenGoalModal(); } },
    { label: 'Create New Project', icon: 'account_tree', action: () => { onClose(); onOpenProjectModal(); } },
    { label: 'Schedule Meeting', icon: 'groups', action: () => { onClose(); onOpenMeetingModal(); } },
  ];

  const filteredNav = navCommands.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()));
  const filteredCreate = createCommands.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()));
  const filteredTasks = tasks.filter((t) => t.title.toLowerCase().includes(query.toLowerCase()));
  const filteredGoals = goals.filter((g) => g.title.toLowerCase().includes(query.toLowerCase()));
  const filteredMeetings = meetings.filter((m) => m.title.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[80px] bg-black/60 backdrop-blur-sm p-[16px]" onClick={onClose}>
      <div
        className="bg-surface border border-outline-variant/30 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center px-[20px] py-[16px] border-b border-outline-variant/20 bg-surface-container-low">
          <span className="material-symbols-outlined text-[20px] text-primary mr-[16px]">search</span>
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search tasks, goals, meetings..."
            className="flex-1 bg-transparent text-[15px] text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none"
          />
          <kbd className="px-[8px] py-[2px] text-[10px] font-mono bg-surface-container-highest border border-outline-variant/30 rounded text-on-surface-variant">ESC</kbd>
        </div>

        <div className="max-h-[380px] overflow-y-auto p-[12px] flex flex-col gap-[16px]">
          {/* Create Section */}
          {filteredCreate.length > 0 && (
            <div>
              <p className="px-[16px] py-[6px] text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">Actions</p>
              {filteredCreate.map((cmd) => (
                <button
                  key={cmd.label}
                  onClick={cmd.action}
                  className="w-full flex items-center justify-center gap-[14px] px-[16px] py-[10px] rounded-lg text-[13px] text-on-surface hover:bg-primary-container/20 hover:text-primary transition-colors text-center"
                >
                  <span className="material-symbols-outlined text-[18px] text-primary">{cmd.icon}</span>
                  <span className="flex-1 font-medium">{cmd.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Nav Section */}
          {filteredNav.length > 0 && (
            <div>
              <p className="px-[16px] py-[6px] text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">Navigation</p>
              {filteredNav.map((cmd) => (
                <button
                  key={cmd.label}
                  onClick={cmd.action}
                  className="w-full flex items-center justify-center gap-[14px] px-[16px] py-[10px] rounded-lg text-[13px] text-on-surface hover:bg-surface-container-high transition-colors text-center"
                >
                  <span className="material-symbols-outlined text-[18px] text-on-surface-variant">{cmd.icon}</span>
                  <span className="flex-1 font-medium">{cmd.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Tasks Section */}
          {query.trim() && filteredTasks.length > 0 && (
            <div>
              <p className="px-[16px] py-[6px] text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">Tasks</p>
              {filteredTasks.slice(0, 5).map((t) => (
                <button
                  key={t.id}
                  onClick={() => navigateTo('tasks')}
                  className="w-full flex items-center justify-center gap-[14px] px-[16px] py-[10px] rounded-lg text-[13px] text-on-surface hover:bg-surface-container-high transition-colors text-center"
                >
                  <span className="material-symbols-outlined text-[18px] text-secondary">checklist</span>
                  <span className="flex-1 truncate">{t.title}</span>
                </button>
              ))}
            </div>
          )}

          {/* Goals Section */}
          {query.trim() && filteredGoals.length > 0 && (
            <div>
              <p className="px-[16px] py-[6px] text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">Goals</p>
              {filteredGoals.slice(0, 3).map((g) => (
                <button
                  key={g.id}
                  onClick={() => navigateTo('goals')}
                  className="w-full flex items-center justify-center gap-[14px] px-[16px] py-[10px] rounded-lg text-[13px] text-on-surface hover:bg-surface-container-high transition-colors text-center"
                >
                  <span className="material-symbols-outlined text-[18px] text-tertiary">emoji_events</span>
                  <span className="flex-1 truncate">{g.title}</span>
                </button>
              ))}
            </div>
          )}

          {/* Meetings Section */}
          {query.trim() && filteredMeetings.length > 0 && (
            <div>
              <p className="px-[16px] py-[6px] text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">Meetings</p>
              {filteredMeetings.slice(0, 3).map((m) => (
                <button
                  key={m.id}
                  onClick={() => navigateTo('meetings')}
                  className="w-full flex items-center justify-center gap-[14px] px-[16px] py-[10px] rounded-lg text-[13px] text-on-surface hover:bg-surface-container-high transition-colors text-center"
                >
                  <span className="material-symbols-outlined text-[18px] text-primary">groups</span>
                  <span className="flex-1 truncate">{m.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
