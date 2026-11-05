import { useState, useEffect } from 'react';
import { useUIStore } from '@/stores/uiStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { format } from 'date-fns';
import { getCurrentWindow } from '@tauri-apps/api/window';

interface TopBarProps {
  onOpenHelp?: () => void;
}

export function TopBar({ onOpenHelp }: TopBarProps) {
  const { setCommandPaletteOpen } = useUIStore();
  const displayName = useSettingsStore((s) => s.displayName);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const today = new Date();
  const avatarInitial = (displayName || 'U').trim().charAt(0).toUpperCase() || 'U';

  useEffect(() => {
    const win = getCurrentWindow();
    const checkMaximized = async () => {
      const max = await win.isMaximized();
      setIsMaximized(max);
    };
    checkMaximized();
    
    const setupListener = async () => {
      const unlisten = await win.onResized(() => {
        checkMaximized();
      });
      return unlisten;
    };
    
    let unlistenFn: (() => void) | null = null;
    setupListener().then(fn => { unlistenFn = fn; });
    return () => { if (unlistenFn) unlistenFn(); };
  }, []);

  const win = getCurrentWindow();
  const handleMinimize = () => win.minimize();
  const handleMaximize = async () => {
    if (isMaximized) {
      await win.unmaximize();
    } else {
      await win.maximize();
    }
    setIsMaximized(!isMaximized);
  };
  const handleClose = () => win.close();

  const noDragStyle: React.CSSProperties = { WebkitAppRegion: 'no-drag' } as React.CSSProperties;

  return (
    <header
      className="h-16 bg-surface border-b border-outline-variant/20 flex justify-between items-center px-[32px] shrink-0 relative select-none"
    >
      {/* Left: Window Controls (small, left-aligned) + Day & Date */}
      <div className="flex items-center gap-[12px] min-w-0" style={noDragStyle}>
        {/* Window Controls */}
        <div className="flex items-center gap-[1px]">
          <button
            onClick={handleMinimize}
            className="w-6 h-6 flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors rounded-[4px]"
            title="Minimize"
            aria-label="Minimize"
          >
            <span className="material-symbols-outlined text-[14px]">minimize</span>
          </button>
          <button
            onClick={handleMaximize}
            className="w-6 h-6 flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors rounded-[4px]"
            title={isMaximized ? 'Restore' : 'Maximize'}
            aria-label={isMaximized ? 'Restore' : 'Maximize'}
          >
            <span className="material-symbols-outlined text-[14px]">
              {isMaximized ? 'fullscreen_exit' : 'fullscreen'}
            </span>
          </button>
          <button
            onClick={handleClose}
            className="w-6 h-6 flex items-center justify-center text-on-surface-variant hover:text-error hover:bg-error-container/20 transition-colors rounded-[4px]"
            title="Close"
            aria-label="Close"
          >
            <span className="material-symbols-outlined text-[14px]">close</span>
          </button>
        </div>
        
        {/* Day & Date */}
        <p className="font-mono text-[13px] text-primary font-semibold whitespace-nowrap">
          {format(today, 'EEEE, MMMM d')}
        </p>
      </div>

      {/* Center: Search Command Input */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center" style={noDragStyle}>
        <div
          className="group cursor-pointer w-64 md:w-80 flex items-center gap-[14px]"
          onClick={() => setCommandPaletteOpen(true)}
        >
          <span className="material-symbols-outlined shrink-0 text-on-surface-variant group-hover:text-primary transition-colors text-sm pointer-events-none">
            search
          </span>
          <div className="relative flex-1">
            <input
              className="w-full bg-surface-container-low border border-outline-variant/30 rounded-full py-[10px] pl-[22px] pr-[16px] text-[13px] text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:border-primary transition-all cursor-pointer"
              placeholder="Search commands or tasks..."
              type="text"
              readOnly
            />
          </div>
        </div>
      </div>

      {/* Right: Actions & Notifications */}
      <div className="flex items-center gap-[20px] relative z-10" style={noDragStyle}>
        <div className="flex items-center gap-[12px] border-l border-outline-variant/30 pl-[20px] ml-[8px] relative">
          {/* Notifications Button */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="w-9 h-9 flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors rounded-full hover:bg-surface-container-high relative"
              title="Notifications"
            >
              <span className="material-symbols-outlined text-[20px]">notifications</span>
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

          {/* Help Button */}
          <button
            onClick={onOpenHelp}
            className="w-9 h-9 flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors rounded-full hover:bg-surface-container-high"
            title="Keyboard Shortcuts & Help"
          >
            <span className="material-symbols-outlined text-[20px]">help</span>
          </button>

          {/* User Profile Avatar */}
          <div
            className="w-9 h-9 rounded-full ml-[8px] overflow-hidden border border-outline-variant/50 cursor-pointer bg-primary-container flex items-center justify-center text-on-primary-container font-semibold text-[12px]"
            title={displayName.trim() || 'User'}
          >
            {avatarInitial}
          </div>
        </div>
      </div>
    </header>
  );
}
