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

  const noDragStyle: React.CSSProperties = { WebkitAppRegion: 'no-drag' } as React.CSSProperties;

  return (
    <div
      className="flex items-center justify-end gap-[14px]"
      style={noDragStyle}
      role="group"
      aria-label="Window controls"
    >
      <button
        onClick={handleMinimize}
        className="p-[4px] text-on-surface-variant hover:text-[#a855f7] transition-colors cursor-pointer select-none flex items-center justify-center"
        title="Minimize"
        aria-label="Minimize"
      >
        <svg width="7" height="7" viewBox="0 0 7 7" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
          <line x1="0.5" y1="5.5" x2="6.5" y2="5.5" />
        </svg>
      </button>

      <button
        onClick={handleMaximize}
        className="p-[4px] text-on-surface-variant hover:text-[#a855f7] transition-colors cursor-pointer select-none flex items-center justify-center"
        title={isMaximized ? 'Restore' : 'Maximize'}
        aria-label={isMaximized ? 'Restore' : 'Maximize'}
      >
        {isMaximized ? (
          <svg width="7" height="7" viewBox="0 0 7 7" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round">
            <rect x="1.8" y="0.6" width="4.6" height="4.6" rx="0.5" />
            <polyline points="0.6,2.2 0.6,6.4 4.8,6.4" />
          </svg>
        ) : (
          <svg width="7" height="7" viewBox="0 0 7 7" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round">
            <rect x="0.6" y="0.6" width="5.8" height="5.8" rx="0.5" />
          </svg>
        )}
      </button>

      <button
        onClick={handleClose}
        className="p-[4px] text-on-surface-variant hover:text-[#a855f7] transition-colors cursor-pointer select-none flex items-center justify-center"
        title="Close"
        aria-label="Close"
      >
        <svg width="7" height="7" viewBox="0 0 7 7" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
          <line x1="1" y1="1" x2="6" y2="6" />
          <line x1="6" y1="1" x2="1" y2="6" />
        </svg>
      </button>
    </div>
  );
}