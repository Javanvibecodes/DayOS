import { useState, useEffect } from 'react';
import { useDeviceStore } from '@/stores/deviceStore';
import { useLockinStore } from '@/stores/lockinStore';
import { useTaskStore } from '@/stores/taskStore';
import { toast } from '@/stores/toastStore';

export function CollaboratePage() {
  const { currentDevice, peerDevices, initDevice, updateDeviceName, addPeerDevice, removePeerDevice } = useDeviceStore();
  const {
    activeSession,
    participants,
    isJoined,
    myTaskTitle,
    hostSession,
    joinSession,
    leaveSession,
    setMyTaskTitle,
    startTimer,
    pauseTimer,
    resetTimer,
    switchPhase,
  } = useLockinStore();

  const { tasks } = useTaskStore();

  const [hostTitle, setHostTitle] = useState('Deep Work Lock-in');
  const [hostDuration, setHostDuration] = useState(25);
  const [joinPin, setJoinPin] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [deviceNameInput, setDeviceNameInput] = useState('');
  const [newPeerId, setNewPeerId] = useState('');
  const [newPeerName, setNewPeerName] = useState('');

  useEffect(() => {
    initDevice();
  }, [initDevice]);

  useEffect(() => {
    if (currentDevice.name) {
      setDeviceNameInput(currentDevice.name);
    }
  }, [currentDevice.name]);

  const handleCopyDeviceId = () => {
    navigator.clipboard.writeText(currentDevice.id);
    toast.success('Device ID copied to clipboard');
  };

  const handleSaveDeviceName = async () => {
    await updateDeviceName(deviceNameInput);
    setIsEditingName(false);
    toast.success('Device name updated');
  };

  const handleAddPeer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPeerId.trim() || !newPeerName.trim()) {
      toast.error('Please enter both device ID and a display name');
      return;
    }
    await addPeerDevice({
      id: newPeerId.trim(),
      name: newPeerName.trim(),
      last_seen: new Date().toISOString(),
      is_trusted: true,
      color: '#6f00be',
    });
    setNewPeerId('');
    setNewPeerName('');
    toast.success('Peer device added');
  };

  const handleHost = () => {
    hostSession(hostTitle, hostDuration, currentDevice.name, currentDevice.id);
    toast.success('Hosted new Lock-in session!');
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (joinSession(joinPin, currentDevice.name, currentDevice.id)) {
      toast.success('Joined Lock-in session!');
      setJoinPin('');
    } else {
      toast.error('Invalid 4-digit PIN code');
    }
  };

  // Timer formatting
  const remaining = activeSession ? activeSession.remaining_seconds : 0;
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const timeFormatted = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  const assignedTasks = tasks.filter(
    (t) => t.assignee_device_id === currentDevice.id || t.assigned_by_device_id
  );

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Local Collaboration & Lock-in</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Synchronize focus sessions and share tasks across devices over your local network — with zero cloud accounts.
        </p>
      </div>

      {/* Device Identity Card */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary text-sm">
            {currentDevice.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={deviceNameInput}
                    onChange={(e) => setDeviceNameInput(e.target.value)}
                    className="px-2 py-0.5 text-sm bg-background border border-border rounded-md text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                  />
                  <button
                    onClick={handleSaveDeviceName}
                    className="text-xs px-2 py-1 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setIsEditingName(false)}
                    className="text-xs px-2 py-1 bg-muted text-muted-foreground rounded-md hover:bg-muted/80"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <>
                  <span className="font-semibold text-foreground text-sm">{currentDevice.name}</span>
                  <button
                    onClick={() => setIsEditingName(true)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                    title="Edit device name"
                  >
                    ✏️
                  </button>
                </>
              )}
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                This Device
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs font-mono text-muted-foreground">ID: {currentDevice.id}</span>
              <button
                onClick={handleCopyDeviceId}
                className="text-xs text-primary hover:underline font-medium"
              >
                Copy ID
              </button>
            </div>
          </div>
        </div>

        <div className="text-xs text-muted-foreground max-w-sm">
          Other DayOS devices can assign tasks or invite this machine using your Device ID.
        </div>
      </div>

      {/* Lock-in Session Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Lock-in Card */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  {isJoined ? activeSession?.title : 'Shared Lock-in Session'}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {isJoined
                    ? `Session PIN: ${activeSession?.pin_code} • ${participants.length} connected`
                    : 'Start or join a synchronized Pomodoro room with nearby peers.'}
                </p>
              </div>
              {isJoined && (
                <button
                  onClick={leaveSession}
                  className="px-3 py-1 text-xs font-medium text-destructive bg-destructive/10 hover:bg-destructive/20 rounded-md transition-colors"
                >
                  Leave Session
                </button>
              )}
            </div>

            {isJoined && activeSession ? (
              /* Active Timer Room */
              <div className="py-8 flex flex-col items-center justify-center text-center">
                {/* Phase Badge */}
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider mb-4 bg-primary/10 text-primary border border-primary/20">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  {activeSession.current_phase === 'focus' ? 'Deep Focus' : 'Short Break'}
                </div>

                {/* Big Timer */}
                <div className="text-6xl font-black font-mono tracking-tight text-foreground my-2">
                  {timeFormatted}
                </div>

                {/* Task Input for the session */}
                <div className="mt-4 w-full max-w-md">
                  <input
                    type="text"
                    value={myTaskTitle}
                    onChange={(e) => {
                      setMyTaskTitle(e.target.value);
                    }}
                    placeholder="What task are you locked into? (visible to peers)"
                    className="w-full text-center px-4 py-2 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/60"
                  />
                </div>

                {/* Controls (Host only or synced) */}
                <div className="flex items-center gap-3 mt-6">
                  {activeSession.is_running ? (
                    <button
                      onClick={pauseTimer}
                      className="px-6 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-medium text-sm transition-colors shadow-sm"
                    >
                      Pause
                    </button>
                  ) : (
                    <button
                      onClick={startTimer}
                      className="px-6 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-sm transition-colors shadow-sm"
                    >
                      Start Focus
                    </button>
                  )}
                  <button
                    onClick={resetTimer}
                    className="px-4 py-2.5 rounded-lg border border-border bg-background hover:bg-muted text-foreground text-sm font-medium transition-colors"
                  >
                    Reset
                  </button>
                  <button
                    onClick={() =>
                      switchPhase(activeSession.current_phase === 'focus' ? 'short_break' : 'focus')
                    }
                    className="px-4 py-2.5 rounded-lg border border-border bg-background hover:bg-muted text-foreground text-sm font-medium transition-colors"
                  >
                    Skip Phase
                  </button>
                </div>
              </div>
            ) : (
              /* Host or Join Selection */
              <div className="py-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Host Section */}
                <div className="p-4 border border-border rounded-lg bg-muted/20 flex flex-col justify-between space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Host a Session</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Create a room with a 4-digit code that peers can join.
                    </p>
                    <div className="mt-3 space-y-2">
                      <div>
                        <label className="text-[11px] font-medium text-muted-foreground">Session Title</label>
                        <input
                          type="text"
                          value={hostTitle}
                          onChange={(e) => setHostTitle(e.target.value)}
                          className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-md text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-muted-foreground">Duration (Minutes)</label>
                        <select
                          value={hostDuration}
                          onChange={(e) => setHostDuration(Number(e.target.value))}
                          className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-md text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                        >
                          <option value={15}>15 Minutes (Sprint)</option>
                          <option value={25}>25 Minutes (Standard Pomodoro)</option>
                          <option value={45}>45 Minutes (Deep Work)</option>
                          <option value={60}>60 Minutes (Intensive)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleHost}
                    className="w-full py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold rounded-md transition-colors shadow-xs"
                  >
                    Host Lock-in Room
                  </button>
                </div>

                {/* Join Section */}
                <form onSubmit={handleJoin} className="p-4 border border-border rounded-lg bg-muted/20 flex flex-col justify-between space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Join a Session</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Enter the 4-digit PIN code displayed on your peer's screen.
                    </p>
                    <div className="mt-4">
                      <input
                        type="text"
                        maxLength={4}
                        placeholder="PIN (e.g. 4821)"
                        value={joinPin}
                        onChange={(e) => setJoinPin(e.target.value.replace(/\D/g, ''))}
                        className="w-full text-center text-lg font-mono tracking-widest px-3 py-2 bg-background border border-border rounded-md text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs font-semibold rounded-md transition-colors"
                  >
                    Join with PIN
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Connected Participants List */}
          {isJoined && participants.length > 0 && (
            <div className="pt-4 border-t border-border mt-4">
              <h4 className="text-xs font-semibold text-foreground mb-2">Connected Peers in Room:</h4>
              <div className="flex flex-wrap gap-2">
                {participants.map((p) => (
                  <div
                    key={p.device_id}
                    className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-muted/40 border border-border text-xs"
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        p.status === 'focusing'
                          ? 'bg-emerald-500'
                          : p.status === 'resting'
                          ? 'bg-amber-500'
                          : 'bg-muted-foreground'
                      }`}
                    />
                    <span className="font-medium text-foreground">{p.device_name}</span>
                    <span className="text-[10px] text-muted-foreground uppercase">{p.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Known Peer Devices & Quick Add */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Trusted Peer Devices</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Devices you collaborate with on your local network.
            </p>

            {/* Peer List */}
            <div className="mt-4 space-y-2">
              {peerDevices.length === 0 ? (
                <div className="p-4 border border-dashed border-border rounded-lg text-center text-xs text-muted-foreground">
                  No peer devices added yet. Enter a peer's Device ID below to connect.
                </div>
              ) : (
                peerDevices.map((peer) => (
                  <div
                    key={peer.id}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-muted/10 text-xs"
                  >
                    <div>
                      <div className="font-medium text-foreground">{peer.name}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">{peer.id}</div>
                    </div>
                    <button
                      onClick={() => removePeerDevice(peer.id)}
                      className="text-muted-foreground hover:text-destructive text-xs"
                      title="Remove peer"
                    >
                      ✕
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Add Peer Form */}
          <form onSubmit={handleAddPeer} className="pt-4 border-t border-border space-y-2">
            <h4 className="text-xs font-semibold text-foreground">Add Peer Device</h4>
            <input
              type="text"
              placeholder="Display Name (e.g. Alex's Laptop)"
              value={newPeerName}
              onChange={(e) => setNewPeerName(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-md text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
            />
            <input
              type="text"
              placeholder="Device ID (e.g. dev_a9f1b2)"
              value={newPeerId}
              onChange={(e) => setNewPeerId(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-md text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
            />
            <button
              type="submit"
              className="w-full py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-medium hover:bg-primary/90 transition-colors"
            >
              Add Device
            </button>
          </form>
        </div>
      </div>

      {/* Assigned Tasks & Shared Goals */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-xs">
        <h3 className="text-sm font-semibold text-foreground">Peer Delegated Tasks</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Tasks assigned between you and peer devices on your local network.
        </p>

        <div className="mt-4">
          {assignedTasks.length === 0 ? (
            <div className="p-6 border border-dashed border-border rounded-lg text-center text-xs text-muted-foreground">
              No tasks delegated to or from other devices yet. When editing any task, you can assign it to a peer device.
            </div>
          ) : (
            <div className="divide-y divide-border border border-border rounded-lg overflow-hidden">
              {assignedTasks.map((t) => (
                <div key={t.id} className="p-3 flex items-center justify-between text-xs bg-card">
                  <div>
                    <span className="font-medium text-foreground">{t.title}</span>
                    <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] bg-primary/10 text-primary">
                      {t.priority}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {t.assignee_device_id === currentDevice.id
                      ? `Assigned to you by ${t.assigned_by_device_id || 'Peer'}`
                      : `Assigned by you to ${t.assignee_device_id}`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

