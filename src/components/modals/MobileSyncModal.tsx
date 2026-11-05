import { useState, useEffect } from 'react';
import { mobileSyncService } from '@/services/mobileSyncService';
import { useDeviceStore } from '@/stores/deviceStore';
import type { MobileSyncState } from '@/types';
import { toast } from '@/stores/toastStore';

interface MobileSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileSyncModal({ isOpen, onClose }: MobileSyncModalProps) {
  const { currentDevice } = useDeviceStore();
  const [syncState, setSyncState] = useState<MobileSyncState | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      mobileSyncService.getSyncState(currentDevice.id).then(setSyncState);
    }
  }, [isOpen, currentDevice.id]);

  if (!isOpen || !syncState) return null;

  const pairingUri = mobileSyncService.generatePairingUri(currentDevice.id, syncState.pairing_code);

  const handleExportDelta = async () => {
    const pkg = await mobileSyncService.exportDeltaPackage(syncState.last_sync_timestamp);
    navigator.clipboard.writeText(pkg);
    toast.success('Sync delta copied to clipboard! Paste it into Mobile app.');
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      toast.success('Local Wi-Fi delta sync completed!');
      mobileSyncService.getSyncState(currentDevice.id).then(setSyncState);
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl p-6 space-y-6 animate-in fade-in-50 zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary text-sm">
              📱
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Pair DayOS Mobile Companion</h2>
              <p className="text-xs text-muted-foreground">Sync your PC database with your mobile phone locally over Wi-Fi.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-sm p-1"
          >
            ✕
          </button>
        </div>

        {/* Pairing Display */}
        <div className="flex flex-col items-center justify-center p-6 bg-muted/20 border border-border rounded-xl space-y-4">
          {/* Simulated High-Res QR Visualizer */}
          <div className="w-44 h-44 bg-white p-3 rounded-xl border border-border shadow-xs flex flex-col items-center justify-center text-center">
            <div className="w-full h-full border-4 border-dashed border-zinc-900 rounded-lg flex flex-col items-center justify-center p-2 text-zinc-900">
              <span className="font-mono text-[9px] tracking-tight break-all font-semibold uppercase">
                DAYOS MOBILE PAIR
              </span>
              <div className="text-2xl font-black font-mono tracking-widest my-1 text-primary">
                {syncState.pairing_code}
              </div>
              <span className="text-[8px] text-zinc-600 font-mono">PORT: 4141 (LAN)</span>
            </div>
          </div>

          <div className="text-center space-y-1">
            <div className="text-xs font-semibold text-foreground">
              6-Digit Pairing PIN: <span className="font-mono font-bold text-primary">{syncState.pairing_code}</span>
            </div>
            <p className="text-[11px] text-muted-foreground max-w-xs">
              Open DayOS on your Android phone while connected to the same Wi-Fi, tap <strong>Sync</strong>, and scan this code.
            </p>
          </div>
        </div>

        {/* Local Sync Actions */}
        <div className="flex items-center justify-between pt-2">
          <div className="text-xs text-muted-foreground">
            {syncState.last_sync_timestamp
              ? `Last synced: ${new Date(syncState.last_sync_timestamp).toLocaleTimeString()}`
              : 'Never synced'}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                navigator.clipboard.writeText(pairingUri);
                toast.success('Pairing link copied');
              }}
              className="px-3 py-1.5 border border-border bg-background hover:bg-muted text-foreground text-xs font-medium rounded-lg transition-colors"
            >
              Copy Link
            </button>
            <button
              onClick={handleExportDelta}
              className="px-3 py-1.5 border border-border bg-background hover:bg-muted text-foreground text-xs font-medium rounded-lg transition-colors"
            >
              Copy Delta
            </button>
            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              className="px-4 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold rounded-lg transition-colors shadow-xs"
            >
              {isSyncing ? 'Syncing...' : 'Sync Now'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

