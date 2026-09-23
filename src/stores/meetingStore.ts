import { create } from 'zustand';
import type { Meeting, CreateMeetingRequest, UpdateMeetingRequest } from '@/types';
import { meetingApi } from '@/lib/db/api';

interface MeetingState {
  meetings: Meeting[];
  selectedMeeting: Meeting | null;
  isLoading: boolean;
  error: string | null;
  
  loadMeetings: () => Promise<void>;
  loadMeetingsByDate: (date: string) => Promise<void>;
  createMeeting: (req: CreateMeetingRequest) => Promise<Meeting>;
  updateMeeting: (req: UpdateMeetingRequest) => Promise<Meeting>;
  deleteMeeting: (id: string) => Promise<void>;
  setSelectedMeeting: (meeting: Meeting | null) => void;
}

export const useMeetingStore = create<MeetingState>((set) => ({
  meetings: [],
  selectedMeeting: null,
  isLoading: false,
  error: null,
  
  loadMeetings: async () => {
    set({ isLoading: true, error: null });
    try {
      const meetings = await meetingApi.getAll();
      set({ meetings, isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },
  
  loadMeetingsByDate: async (date: string) => {
    set({ isLoading: true, error: null });
    try {
      const meetings = await meetingApi.getByDate(date);
      set({ meetings, isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },
  
  createMeeting: async (req: CreateMeetingRequest) => {
    const meeting = await meetingApi.create(req);
    set((state) => ({ meetings: [...state.meetings, meeting] }));
    return meeting;
  },
  
  updateMeeting: async (req: UpdateMeetingRequest) => {
    const meeting = await meetingApi.update(req);
    set((state) => ({
      meetings: state.meetings.map((m) => (m.id === req.id ? meeting : m)),
      selectedMeeting: state.selectedMeeting?.id === req.id ? meeting : state.selectedMeeting,
    }));
    return meeting;
  },
  
  deleteMeeting: async (id: string) => {
    await meetingApi.delete(id);
    set((state) => ({
      meetings: state.meetings.filter((m) => m.id !== id),
      selectedMeeting: state.selectedMeeting?.id === id ? null : state.selectedMeeting,
    }));
  },
  
  setSelectedMeeting: (meeting: Meeting | null) => {
    set({ selectedMeeting: meeting });
  },
}));
