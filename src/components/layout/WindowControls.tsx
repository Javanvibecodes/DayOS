import { useState, useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';

export function WindowControls() {
  const [isMaximized, setIsMaximized] = useState(false);

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
    <div
      className="flex items-center justify-end gap-[2px] p-[2px]"
      style={noDragStyle}
      role="group"
      aria-label="Window controls"
    >
      <button
        onClick={handleMinimize}
        className="w-7 h-7 flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors rounded-[6px]"
        title="Minimize"
        aria-label="Minimize"
      >
        <span className="material-symbols-outlined text-[16px]">minimize</span>
      </button>
      <button
        onClick={handleMaximize}
        className="w-7 h-7 flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors rounded-[6px]"
        title={isMaximized ? 'Restore' : 'Maximize'}
        aria-label={isMaximized ? 'Restore' : 'Maximize'}
      >
        <span className="material-symbols-outlined text-[16px]">
          {isMaximized ? 'fullscreen_exit' : 'fullscreen'}
        </span>
      </button>
      <button
        onClick={handleClose}
        className="w-7 h-7 flex items-center justify-center text-on-surface-variant hover:text-error hover:bg-error-container/20 transition-colors rounded-[6px]"
        title="Close"
        aria-label="Close"
      >
        <span className="material-symbols-outlined text-[16px]">close</span>
      </button>
    </div>
  );
}