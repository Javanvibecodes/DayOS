import { useState, useEffect } from 'react';
import { useMeetingStore } from '@/stores/meetingStore';
import { toast } from '@/stores/toastStore';
import { MEETING_REMINDER_OPTIONS, type Meeting } from '@/types';

const REMINDER_LABELS: Record<number, string> = {
  1440: '1 day before',
  720: '12 hours before',
  360: '6 hours before',
  180: '3 hours before',
  120: '2 hours before',
  60: '1 hour before',
  30: '30 minutes before',
  15: '15 minutes before',
};

interface MeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  meetingToEdit?: Meeting | null;
}

export function MeetingModal({ isOpen, onClose, meetingToEdit }: MeetingModalProps) {
  const { createMeeting, updateMeeting } = useMeetingStore();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('11:00');
  const [meetingUrl, setMeetingUrl] = useState('');
  const [reminderOffsets, setReminderOffsets] = useState<number[]>([]);

  useEffect(() => {
    if (meetingToEdit) {
      setTitle(meetingToEdit.title);
      setDescription(meetingToEdit.description || '');
      setDate(meetingToEdit.date);
      setStartTime(meetingToEdit.start_time);
      setEndTime(meetingToEdit.end_time || '');
      setMeetingUrl(meetingToEdit.meeting_url || '');
      setReminderOffsets(
        (meetingToEdit.reminder_offsets || [])
          .filter((n) => MEETING_REMINDER_OPTIONS.includes(n as typeof MEETING_REMINDER_OPTIONS[number]))
          .slice(0, 3),
      );
    } else {
      setTitle('');
      setDescription('');
      setDate(new Date().toISOString().split('T')[0]);
      setStartTime('10:00');
      setEndTime('11:00');
      setMeetingUrl('');
      setReminderOffsets([]);
    }
  }, [meetingToEdit, isOpen]);

  if (!isOpen) return null;

  const toggleReminder = (minutes: number) => {
    setReminderOffsets((prev) => {
      if (prev.includes(minutes)) return prev.filter((m) => m !== minutes);
      if (prev.length >= 3) return prev;
      return [...prev, minutes].sort((a, b) => b - a);
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Enter a meeting title');
      return;
    }

    const offsets = [...reminderOffsets].sort((a, b) => b - a).slice(0, 3);
    const reminderEnabled = offsets.length > 0;
    const reminderMinutes = offsets.length > 0 ? offsets[0] : undefined;

    if (meetingToEdit) {
      updateMeeting({
        id: meetingToEdit.id,
        title: title.trim(),
        description: description.trim() || undefined,
        date,
        start_time: startTime,
        end_time: endTime || undefined,
        meeting_url: meetingUrl.trim() || undefined,
        reminder_enabled: reminderEnabled,
        reminder_minutes: reminderMinutes,
        reminder_offsets: offsets,
      });
      toast.success('Meeting updated');
    } else {
      createMeeting({
        title: title.trim(),
        description: description.trim() || undefined,
        date,
        start_time: startTime,
        end_time: endTime || undefined,
        meeting_url: meetingUrl.trim() || undefined,
        reminder_enabled: reminderEnabled,
        reminder_minutes: reminderMinutes,
        reminder_offsets: offsets,
      });
      toast.success('Meeting scheduled');
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-[16px]">
      <div className="bg-surface border border-outline-variant/30 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center px-[24px] py-[16px] border-b border-outline-variant/20 bg-surface-container-low sticky top-0 z-10">
          <h3 className="text-[18px] font-semibold text-on-surface flex items-center gap-[18px] mb-[8px]">
            <span className="material-symbols-outlined text-primary">groups</span>
            {meetingToEdit ? 'Edit Meeting' : 'Schedule Meeting'}
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div>
            <label className="block text-[12px] font-semibold uppercase tracking-wider text-on-surface-variant mb-[12px]">
              Meeting Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Architecture Sync"
              className="w-full bg-surface-container-low border border-outline-variant/30 rounded-lg px-[12px] py-[10px] text-[14px] text-on-surface focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-[12px] font-semibold uppercase tracking-wider text-on-surface-variant mb-[12px]">
              Description / Agenda
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Meeting topic or agenda notes..."
              className="w-full bg-surface-container-low border border-outline-variant/30 rounded-lg px-[12px] py-[10px] text-[14px] text-on-surface focus:outline-none focus:border-primary resize-none"
            />
          </div>

          <div>
            <label className="block text-[12px] font-semibold uppercase tracking-wider text-on-surface-variant mb-[12px]">
              Date *
            </label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-surface-container-low border border-outline-variant/30 rounded-lg px-[12px] py-[10px] text-[14px] text-on-surface focus:outline-none focus:border-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-[20px]">
            <div>
              <label className="block text-[12px] font-semibold uppercase tracking-wider text-on-surface-variant mb-[12px]">
                Start Time *
              </label>
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full bg-surface-container-low border border-outline-variant/30 rounded-lg px-[12px] py-[10px] text-[14px] text-on-surface focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-[12px] font-semibold uppercase tracking-wider text-on-surface-variant mb-[12px]">
                End Time <span className="normal-case font-medium opacity-60">(optional)</span>
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full bg-surface-container-low border border-outline-variant/30 rounded-lg px-[12px] py-[10px] text-[14px] text-on-surface focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-semibold uppercase tracking-wider text-on-surface-variant mb-[12px]">
              Meeting URL <span className="normal-case font-medium opacity-60">(optional)</span>
            </label>
            <input
              type="url"
              value={meetingUrl}
              onChange={(e) => setMeetingUrl(e.target.value)}
              placeholder="https://meet.google.com/... — leave blank if no link"
              className="w-full bg-surface-container-low border border-outline-variant/30 rounded-lg px-[12px] py-[10px] text-[14px] text-on-surface focus:outline-none focus:border-primary"
            />
            <p className="text-[11px] text-on-surface-variant/70 mt-[6px]">
              Join Meeting only appears when a link is set.
            </p>
          </div>

          <div>
            <label className="block text-[12px] font-semibold uppercase tracking-wider text-on-surface-variant mb-[8px]">
              Reminders <span className="normal-case font-medium opacity-60">(up to 3)</span>
            </label>
            <p className="text-[11px] text-on-surface-variant/70 mb-[10px]">
              {reminderOffsets.length}/3 selected
              {reminderOffsets.length >= 3 ? ' — deselect one to change' : ''}
            </p>
            <div className="flex flex-wrap gap-[8px]">
              {MEETING_REMINDER_OPTIONS.map((m) => {
                const selected = reminderOffsets.includes(m);
                const disabled = !selected && reminderOffsets.length >= 3;
                return (
                  <button
                    key={m}
                    type="button"
                    disabled={disabled}
                    onClick={() => toggleReminder(m)}
                    className={`px-[12px] py-[7px] rounded-lg text-[12px] font-semibold border transition-colors text-center ${
                      selected
                        ? 'bg-primary-container text-on-primary-container border-primary-container'
                        : disabled
                          ? 'bg-surface-container-low border-outline-variant/20 text-on-surface-variant/40 cursor-not-allowed'
                          : 'bg-surface-container-low border-outline-variant/30 text-on-surface hover:border-primary'
                    }`}
                  >
                    {REMINDER_LABELS[m]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-[16px] mt-[16px] pt-[20px] border-t border-outline-variant/20">
            <button
              type="button"
              onClick={onClose}
              className="px-[20px] py-[10px] rounded-lg border border-outline-variant/30 text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors text-[13px] font-medium flex items-center justify-center text-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-[24px] py-[10px] rounded-lg bg-primary hover:bg-primary/90 text-on-primary text-[13px] font-semibold transition-colors flex items-center justify-center gap-[16px] shadow-lg shadow-primary/20 text-center"
            >
              <span className="material-symbols-outlined text-[16px]">check</span>
              {meetingToEdit ? 'Save Changes' : 'Schedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
