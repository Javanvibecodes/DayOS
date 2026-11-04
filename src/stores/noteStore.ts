import { create } from 'zustand';
import type {
  Note,
  NoteFolder,
  CreateNoteRequest,
  UpdateNoteRequest,
  CreateNoteFolderRequest,
  UpdateNoteFolderRequest,
} from '@/types';
import { noteApi, noteFolderApi } from '@/lib/db/api';

interface NoteState {
  notes: Note[];
  folders: NoteFolder[];
  isLoading: boolean;
  error: string | null;

  loadNotes: () => Promise<void>;
  loadFolders: () => Promise<void>;
  loadAll: () => Promise<void>;

  createNote: (req: CreateNoteRequest) => Promise<Note>;
  updateNote: (req: UpdateNoteRequest) => Promise<Note>;
  deleteNote: (id: string) => Promise<void>;

  createFolder: (req: CreateNoteFolderRequest) => Promise<NoteFolder>;
  updateFolder: (req: UpdateNoteFolderRequest) => Promise<NoteFolder>;
  deleteFolder: (id: string) => Promise<void>;

  getNotesByFolder: (folderId: string | null) => Note[];
}

export const useNoteStore = create<NoteState>((set, get) => ({
  notes: [],
  folders: [],
  isLoading: false,
  error: null,

  loadNotes: async () => {
    set({ isLoading: true, error: null });
    try {
      const notes = await noteApi.getAll();
      set({ notes, isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  loadFolders: async () => {
    try {
      const folders = await noteFolderApi.getAll();
      set({ folders });
    } catch (error) {
      set({ error: String(error) });
    }
  },

  loadAll: async () => {
    await Promise.all([get().loadNotes(), get().loadFolders()]);
  },

  createNote: async (req) => {
    const note = await noteApi.create(req);
    set((state) => ({ notes: [note, ...state.notes] }));
    return note;
  },

  updateNote: async (req) => {
    const note = await noteApi.update(req);
    set((state) => ({
      notes: state.notes.map((n) => (n.id === note.id ? note : n)),
    }));
    return note;
  },

  deleteNote: async (id) => {
    await noteApi.delete(id);
    set((state) => ({ notes: state.notes.filter((n) => n.id !== id) }));
  },

  createFolder: async (req) => {
    const folder = await noteFolderApi.create(req);
    set((state) => ({ folders: [...state.folders, folder] }));
    return folder;
  },

  updateFolder: async (req) => {
    const folder = await noteFolderApi.update(req);
    set((state) => ({
      folders: state.folders.map((f) => (f.id === folder.id ? folder : f)),
    }));
    return folder;
  },

  deleteFolder: async (id) => {
    await noteFolderApi.delete(id);
    set((state) => ({
      folders: state.folders.filter((f) => f.id !== id),
      // Notes in deleted folder come back unfiled (folder_id cleared by FK)
      notes: state.notes.map((n) =>
        n.folder_id === id ? { ...n, folder_id: null } : n,
      ),
    }));
  },

  getNotesByFolder: (folderId) => {
    const { notes } = get();
    if (!folderId) return notes;
    return notes.filter((n) => n.folder_id === folderId);
  },
}));
