import { cn } from '@/lib/utils';
import { useUIStore } from '@/stores/uiStore';

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar, currentPage, setCurrentPage } = useUIStore();

  const mainNavItems = [
    { id: 'today' as const, label: 'Today', icon: 'today' },
    { id: 'tasks' as const, label: 'Tasks', icon: 'checklist' },
    { id: 'goals' as const, label: 'Goals', icon: 'emoji_events' },
    { id: 'projects' as const, label: 'Projects', icon: 'account_tree' },
    { id: 'meetings' as const, label: 'Meetings', icon: 'groups' },
    { id: 'timetable' as const, label: 'Timetable', icon: 'calendar_view_day' },
    { id: 'routines' as const, label: 'Routines', icon: 'routine' },
    { id: 'notes' as const, label: 'Notes', icon: 'sticky_note_2' },
    { id: 'pomodoro' as const, label: 'Pomodoro', icon: 'timer' },
  ];

  const footerNavItems = [
    { id: 'settings' as const, label: 'Settings', icon: 'settings' },
  ];

  const navBtn = (active: boolean) =>
    cn(
      'flex items-center rounded-xl transition-all duration-200 ease-in-out active:scale-[0.98] font-medium text-[13px]',
      sidebarCollapsed
        ? 'justify-center px-0 py-[12px] w-full'
        : 'justify-start pl-[16px] pr-[16px] py-[12px] gap-[14px]',
      active
        ? 'bg-primary-container text-on-primary-container font-semibold shadow-sm'
        : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface',
    );

  return (
    <nav
      className={cn(
        'h-full bg-surface border-r-2 border-outline-variant/50 flex flex-col shrink-0 transition-all duration-300',
        sidebarCollapsed ? 'w-16 p-[12px]' : 'w-72 p-[30px]',
      )}
    >
      {/* Header — collapsed keeps logo visible; expanded left-aligned on same margin */}
      <div
        className={cn(
          'mb-[40px] flex items-center py-[4px]',
          sidebarCollapsed ? 'justify-center px-0' : 'justify-start px-[8px] gap-[18px]',
        )}
      >
        <div
          className={cn(
            'rounded-xl bg-primary-container flex items-center justify-center text-on-primary-container font-bold shadow-md shrink-0',
            sidebarCollapsed ? 'w-10 h-10 text-[18px]' : 'w-[72px] h-[72px] text-[36px]',
          )}
        >
          D
        </div>
        {!sidebarCollapsed && (
          <div>
            <h1 className="font-bold text-on-surface text-[30px] leading-tight">DayOS</h1>
            <p className="text-[16px] font-medium text-on-surface-variant mt-[8px]">
              Local-first Productivity
            </p>
          </div>
        )}
      </div>

      {/* Main Navigation — expanded: fixed left margin; collapsed: icons centered */}
      <div
        className={cn(
          'flex-1 flex flex-col overflow-y-auto',
          sidebarCollapsed ? 'gap-[8px]' : 'gap-[16px] pr-[2px]',
        )}
      >
        {mainNavItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setCurrentPage(item.id)}
            title={sidebarCollapsed ? item.label : undefined}
            className={navBtn(currentPage === item.id)}
          >
            <span className="material-symbols-outlined text-[22px] shrink-0">{item.icon}</span>
            {!sidebarCollapsed && <span>{item.label}</span>}
          </button>
        ))}
      </div>

      {/* Footer Navigation & Collapse Toggle */}
      <div
        className={cn(
          'mt-auto border-t border-outline-variant/20 flex flex-col',
          sidebarCollapsed ? 'gap-[8px] pt-[12px]' : 'gap-[16px] pt-[20px]',
        )}
      >
        {footerNavItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setCurrentPage(item.id)}
            title={sidebarCollapsed ? item.label : undefined}
            className={navBtn(currentPage === item.id)}
          >
            <span className="material-symbols-outlined text-[22px] shrink-0">{item.icon}</span>
            {!sidebarCollapsed && <span>{item.label}</span>}
          </button>
        ))}

        <button
          onClick={toggleSidebar}
          className={cn(
            'flex items-center rounded-xl text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors text-[12px] font-medium',
            sidebarCollapsed
              ? 'justify-center px-0 py-[10px] w-full mt-[8px]'
              : 'justify-start pl-[16px] pr-[16px] py-[10px] gap-[14px] mt-[16px]',
          )}
          title={sidebarCollapsed ? 'Expand Sidebar (Ctrl+\\)' : 'Collapse Sidebar'}
        >
          <span className="material-symbols-outlined text-[20px] shrink-0">
            {sidebarCollapsed ? 'chevron_right' : 'chevron_left'}
          </span>
          {!sidebarCollapsed && <span>Collapse Sidebar</span>}
        </button>
      </div>
    </nav>
  );
}
