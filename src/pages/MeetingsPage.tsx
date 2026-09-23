import { useState } from 'react';
import { useMeetingStore } from '@/stores/meetingStore';
import { format, parseISO } from 'date-fns';
import { openUrl } from '@tauri-apps/plugin-opener';
import type { Meeting } from '@/types';

interface MeetingsPageProps {
  onNewMeeting?: () => void;
  onEditMeeting?: (meeting: Meeting) => void;
}

export function MeetingsPage({ onNewMeeting, onEditMeeting }: MeetingsPageProps) {
  const { meetings, isLoading, deleteMeeting } = useMeetingStore();
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');

  const todayMeetings = meetings.filter((m) => m.date === todayStr);
  const upcomingMeetings = meetings.filter((m) => m.date > todayStr);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  const handleCopyLink = (url?: string | null) => {
    if (!url) {
      showToast('No meeting link to copy');
      return;
    }
    navigator.clipboard.writeText(url);
    showToast('Meeting link copied to clipboard!');
  };

  const handleJoin = async (url: string) => {
    try {
      await openUrl(url);
    } catch {
      showToast('Could not open meeting link');
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center py-[80px]">
        <span className="material-symbols-outlined text-[28px] text-primary animate-spin">progress_activity</span>
      </div>
    );
  }

  return (
    <div className="p-[32px] max-w-[1440px] mx-auto flex flex-col gap-[32px]">
      {/* Toast Banner */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-primary text-on-primary font-semibold text-[13px] px-[16px] py-[10px] rounded-xl shadow-2xl flex items-center gap-[18px] animate-in fade-in slide-in-from-bottom-4">
          <span className="material-symbols-outlined text-[18px]">content_copy</span>
          {toastMsg}
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center mt-[20px]">
        <div>
          <h2 className="text-[28px] leading-9 font-semibold text-on-surface mb-[20px] flex items-center gap-[12px]">
            <span className="material-symbols-outlined text-[32px] text-primary">groups</span>
            Meetings & Calendar Sync
          </h2>
          <p className="text-[14px] text-on-surface-variant">
            Schedule sessions, launch video calls, and review upcoming agendas.
          </p>
        </div>
        <button
          onClick={onNewMeeting}
          className="bg-primary hover:bg-primary/90 text-on-primary font-semibold text-[13px] px-[20px] py-[10px] rounded-lg transition-all flex items-center justify-center gap-[18px] shadow-lg shadow-primary/20 text-center"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          Schedule Meeting
        </button>
      </div>

      {/* Today Meetings */}
      <section className="flex flex-col gap-[16px]">
        <div className="flex items-center justify-between border-b border-outline-variant/30 pb-[12px] mb-[8px]">
          <h3 className="text-[18px] font-bold text-on-surface">Today's Schedule</h3>
          <span className="font-mono text-[13px] text-primary font-semibold">{format(today, 'MMM d, yyyy')}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-[28px]">
          {todayMeetings.length === 0 ? (
            <div className="col-span-full text-center py-[48px] text-on-surface-variant text-[13px] bg-surface rounded-2xl border border-outline-variant/20">
              No meetings scheduled for today
            </div>
          ) : (
            todayMeetings.map((meeting) => (
              <div
                key={meeting.id}
                className="bg-surface rounded-2xl p-[28px] border border-outline-variant/30 flex flex-col justify-between gap-[20px] shadow-sm hover:border-primary/40 transition-all relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 right-0 h-1 bg-primary" />
                <div>
                  <div className="flex justify-between items-center mb-[20px]">
                    <span className="font-mono text-[13px] text-primary font-semibold flex items-center gap-[16px]">
                      <span className="material-symbols-outlined text-[16px]">schedule</span>
                      {meeting.start_time} - {meeting.end_time || '11:00'}
                    </span>
                    <div className="flex items-center gap-[18px]">
                      <span className="bg-primary-container/20 text-primary text-[11px] font-semibold px-[10px] py-[2px] rounded-full border border-primary/20">
                        Confirmed
                      </span>
                      <button
                        onClick={() => onEditMeeting && onEditMeeting(meeting)}
                        className="p-[4px] text-on-surface-variant hover:text-primary rounded hover:bg-surface-container transition-colors"
                        title="Edit Meeting"
                      >
                        <span className="material-symbols-outlined text-[16px]">edit</span>
                      </button>
                      <button
                        onClick={() => deleteMeeting(meeting.id)}
                        className="p-[4px] text-on-surface-variant hover:text-error rounded hover:bg-surface-container transition-colors"
                        title="Delete Meeting"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    </div>
                  </div>
                  <h4 className="text-[20px] font-bold text-on-surface mb-[16px]">{meeting.title}</h4>
                  {meeting.description && (
                    <p className="text-[13px] text-on-surface-variant line-clamp-2">{meeting.description}</p>
                  )}
                </div>

                <div className="flex justify-between items-center pt-[16px] border-t border-outline-variant/20">
                  <span className="text-[12px] text-on-surface-variant truncate max-w-[200px]">
                    {meeting.meeting_url || 'No meeting link'}
                  </span>
                  <div className="flex gap-[18px]">
                    <button
                      onClick={() => handleCopyLink(meeting.meeting_url)}
                      className="px-[20px] py-[10px] border border-outline-variant/40 hover:bg-surface-container-high text-on-surface text-[12px] font-semibold rounded-lg transition-colors flex items-center justify-center gap-[14px] text-center"
                    >
                      <span className="material-symbols-outlined text-[14px]">content_copy</span> Copy Link
                    </button>
                    {meeting.meeting_url && (
                      <button
                        onClick={() => handleJoin(meeting.meeting_url!)}
                        className="px-[20px] py-[10px] bg-primary hover:bg-primary/90 text-on-primary text-[12px] font-semibold rounded-lg transition-colors flex items-center justify-center gap-[14px] shadow-sm text-center"
                      >
                        Join Meeting
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Upcoming Meetings */}
      <section className="flex flex-col gap-[16px] mt-[24px]">
        <div className="flex items-center justify-between border-b border-outline-variant/30 pb-[12px] mb-[8px]">
          <h3 className="text-[18px] font-bold text-on-surface">Upcoming Meetings</h3>
          <span className="text-[12px] text-on-surface-variant bg-surface-container px-[12px] py-[6px] rounded-lg">Upcoming</span>
        </div>

        <div className="bg-surface border border-outline-variant/30 rounded-2xl overflow-hidden divide-y divide-outline-variant/20 shadow-sm">
          {upcomingMeetings.length === 0 ? (
            <div className="text-center py-[48px] text-on-surface-variant text-[13px]">
              No upcoming meetings scheduled
            </div>
          ) : (
            upcomingMeetings.map((meeting) => (
              <div key={meeting.id} className="flex items-center gap-[20px] p-[20px] hover:bg-surface-container-low transition-colors">
                <div className="flex flex-col items-center justify-center w-14 h-14 bg-surface-container-high rounded-xl border border-outline-variant/30 text-center shrink-0">
                  <span className="text-[10px] font-semibold uppercase text-on-surface-variant">
                    {format(parseISO(meeting.date), 'EEE')}
                  </span>
                  <span className="text-[18px] font-bold text-on-surface leading-tight">
                    {format(parseISO(meeting.date), 'd')}
                  </span>
                </div>
                <div className="flex-1">
                  <h4 className="text-[15px] font-semibold text-on-surface mb-[12px]">{meeting.title}</h4>
                  <p className="font-mono text-[12px] text-on-surface-variant">
                    {meeting.start_time} - {meeting.end_time || ''}
                  </p>
                </div>
                <div className="flex gap-[14px]">
                  <button
                    onClick={() => onEditMeeting && onEditMeeting(meeting)}
                    className="p-[6px] text-on-surface-variant hover:text-primary rounded hover:bg-surface-container transition-colors"
                    title="Edit Meeting"
                  >
                    <span className="material-symbols-outlined text-[16px]">edit</span>
                  </button>
                  <button
                    onClick={() => deleteMeeting(meeting.id)}
                    className="p-[6px] text-on-surface-variant hover:text-error rounded hover:bg-surface-container transition-colors"
                    title="Delete Meeting"
                  >
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                  </button>
                </div>
                <button
                  onClick={() => handleCopyLink(meeting.meeting_url)}
                  className="px-[20px] py-[10px] border border-outline-variant/30 hover:bg-surface-container text-on-surface text-[12px] font-semibold rounded-lg transition-colors flex items-center justify-center gap-[14px] text-center"
                >
                  <span className="material-symbols-outlined text-[14px]">link</span> Link
                </button>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
