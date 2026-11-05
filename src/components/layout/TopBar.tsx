import { useState, useEffect } from 'react';
import { useUIStore } from '@/stores/uiStore';
import { getCurrentWindow } from '@tauri-apps/api/window';

interface TopBarProps {
  onOpenHelp?: () => void;
  onOpenAI?: () => void;
}

export function TopBar({ onOpenHelp, onOpenAI }: TopBarProps) {
  const { setCommandPaletteOpen, currentPage, setCurrentPage } = useUIStore();
  const [showNotifications, setShowNotifications] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    let unlistenFn: (() => void) | null = null;

    const setup = async () => {
      try {
        const win = getCurrentWindow();
        const max = await win.isMaximized();
        setIsMaximized(max);
        unlistenFn = await win.onResized(async () => {
          const resizedMax = await win.isMaximized();
          setIsMaximized(resizedMax);
        });
      } catch {
        // outside Tauri
      }
    };

    void setup();
    return () => {
      if (unlistenFn) unlistenFn();
    };
  }, []);

  const handleMinimize = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      const win = getCurrentWindow();
      await win.minimize();
    } catch (err) {
      console.error('Failed to minimize window:', err);
    }
  };

  const handleMaximize = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      const win = getCurrentWindow();
      await win.toggleMaximize();
      const max = await win.isMaximized();
      setIsMaximized(max);
    } catch (err) {
      console.error('Failed to toggle maximize window:', err);
    }
  };

  const handleClose = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      const win = getCurrentWindow();
      await win.close();
    } catch (err) {
      console.error('Failed to close window:', err);
    }
  };

  const handleHeaderMouseDown = (e: React.MouseEvent<HTMLElement>) => {
    // Only primary mouse button and not on interactive controls
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('button, input, [role="button"], a, [data-no-drag]')) {
      return;
    }
    if (!isMaximized) {
      try {
        getCurrentWindow().startDragging().catch(() => { });
      } catch {
        // ignore outside Tauri
      }
    }
  };

  return (
    <header
      data-tauri-drag-region
      onMouseDown={handleHeaderMouseDown}
      className="h-14 pt-[10px] pb-[6px] w-full bg-surface border-b border-outline-variant/20 flex justify-between items-center px-[20px] shrink-0 relative select-none cursor-default"
    >
      {/* Left: Open space allowing window drag */}
      <div className="flex-1 min-w-[32px] h-full pointer-events-none" />

      {/* Center: Search Command Input */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pt-[4px] z-10">
        <div
          className="group cursor-pointer w-64 md:w-80 flex items-center gap-[14px]"
          onClick={() => setCommandPaletteOpen(true)}
        >
          <span className="material-symbols-outlined shrink-0 text-on-surface-variant group-hover:text-primary transition-colors text-sm pointer-events-none">
            search
          </span>
          <div className="relative flex-1">
            <input
              className="w-full bg-surface-container-low border border-outline-variant/30 rounded-full py-[8px] pl-[20px] pr-[16px] text-[13px] text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:border-primary transition-all cursor-pointer"
              placeholder="Search commands or tasks..."
              type="text"
              readOnly
            />
          </div>
        </div>
      </div>

      {/* Right: Actions, Help & Window Controls (shrink-0 so empty space between search and buttons is draggable) */}
      <div className="flex items-center gap-[12px] shrink-0 z-10 ml-auto">
        {/* AI Assistant Button */}
        <button
          type="button"
          onClick={onOpenAI}
          className="w-8 h-8 flex items-center justify-center text-primary transition-colors rounded-full hover:bg-primary/10 relative cursor-pointer"
          title="DayOS AI Assistant (Voice & Chat)"
        >
          <span className="text-[16px]">✨</span>
        </button>

        {/* Notifications Button */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowNotifications(!showNotifications)}
            className="w-8 h-8 flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors rounded-full hover:bg-surface-container-high relative cursor-pointer"
            title="Notifications"
          >
            <span className="material-symbols-outlined text-[19px]">notifications</span>
          </button>

          {/* Notifications Popover */}
          {showNotifications && (
            <div className="absolute right-0 mt-[8px] w-80 bg-surface border border-outline-variant/30 rounded-xl shadow-2xl p-[16px] z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex justify-between items-center mb-[16px] pb-[8px] border-b border-outline-variant/20">
                <h4 className="text-[13px] font-semibold text-on-surface">Notifications</h4>
              </div>
              <div className="flex flex-col gap-[18px]">
                <div className="p-[8px] rounded-lg bg-surface-container-low text-center text-[12px] text-on-surface-variant">
                  No new notifications
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Help Button - Navigates to Help & Guide */}
        <button
          type="button"
          onClick={() => {
            if (onOpenHelp) onOpenHelp();
            setCurrentPage('help');
          }}
          className={`w-8 h-8 flex items-center justify-center transition-colors rounded-full cursor-pointer ${currentPage === 'help'
              ? 'bg-primary-container text-on-primary-container font-semibold'
              : 'text-on-surface-variant hover:text-primary hover:bg-surface-container-high'
            }`}
          title="Help & User Guide"
        >
          <span className="material-symbols-outlined text-[19px]">help</span>
        </button>

        {/* Vertical divider */}
        <div className="h-4 w-[1px] bg-outline-variant/30 mx-[2px]" />

        {/* Window Actions: Minimize, Maximize/Restore, Close — half size, purple hover */}
        <div className="flex items-center gap-[6px]">
          <button
            type="button"
            onClick={handleMinimize}
            className="p-[2px] text-on-surface-variant hover:text-[#a855f7] transition-colors cursor-pointer select-none flex items-center justify-center rounded-[3px]"
            title="Minimize"
            aria-label="Minimize"
          >
            <svg width="4" height="4" viewBox="0 0 4 4" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round">
              <line x1="0.5" y1="3.5" x2="3.5" y2="3.5" />
            </svg>
          </button>

          <button
            type="button"
            onClick={handleMaximize}
            className="p-[2px] text-on-surface-variant hover:text-[#a855f7] transition-colors cursor-pointer select-none flex items-center justify-center rounded-[3px]"
            title={isMaximized ? 'Restore' : 'Maximize'}
            aria-label={isMaximized ? 'Restore' : 'Maximize'}
          >
            {isMaximized ? (
              <svg width="4" height="4" viewBox="0 0 4 4" fill="none" stroke="currentColor" strokeWidth="0.9" strokeLinejoin="round">
                <rect x="1" y="0.3" width="2.7" height="2.7" rx="0.3" />
                <polyline points="0.3,1.2 0.3,3.4 2.5,3.4" />
              </svg>
            ) : (
              <svg width="4" height="4" viewBox="0 0 4 4" fill="none" stroke="currentColor" strokeWidth="1" strokeLinejoin="round">
                <rect x="0.3" y="0.3" width="3.4" height="3.4" rx="0.3" />
              </svg>
            )}
          </button>

          <button
            type="button"
            onClick={handleClose}
            className="p-[2px] text-on-surface-variant hover:text-[#a855f7] transition-colors cursor-pointer select-none flex items-center justify-center rounded-[3px]"
            title="Close"
            aria-label="Close"
          >
            <svg width="4" height="4" viewBox="0 0 4 4" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round">
              <line x1="0.6" y1="0.6" x2="3.4" y2="3.4" />
              <line x1="3.4" y1="0.6" x2="0.6" y2="3.4" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
