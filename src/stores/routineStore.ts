import { create } from 'zustand';
import type {
  Routine,
  RoutineTask,
  CreateRoutineRequest,
  UpdateRoutineRequest,
  CreateRoutineTaskRequest,
  UpdateRoutineTaskRequest,
} from '@/types';
import { routineApi } from '@/lib/db/api';

interface RoutineState {
  routines: Routine[];
  routineTasks: RoutineTask[];
  isLoading: boolean;
  error: string | null;

  loadRoutines: () => Promise<void>;
  loadRoutineTasks: () => Promise<void>;
  createRoutine: (req: CreateRoutineRequest) => Promise<Routine>;
  updateRoutine: (req: UpdateRoutineRequest) => Promise<Routine>;
  deleteRoutine: (id: string) => Promise<void>;
  createRoutineTask: (req: CreateRoutineTaskRequest) => Promise<RoutineTask>;
  updateRoutineTask: (req: UpdateRoutineTaskRequest) => Promise<RoutineTask>;
  deleteRoutineTask: (id: string) => Promise<void>;
  tasksFor: (routineId: string) => RoutineTask[];
}

export const useRoutineStore = create<RoutineState>((set, get) => ({
  routines: [],
  routineTasks: [],
  isLoading: false,
  error: null,

  loadRoutines: async () => {
    set({ isLoading: true, error: null });
    try {
      const routines = await routineApi.getAll();
      set({ routines, isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  loadRoutineTasks: async () => {
    try {
      const routineTasks = await routineApi.getAllTasks();
      set({ routineTasks });
    } catch (error) {
      set({ error: String(error) });
    }
  },

  createRoutine: async (req) => {
    const routine = await routineApi.create(req);
    set((state) => ({ routines: [routine, ...state.routines] }));
    return routine;
  },

  updateRoutine: async (req) => {
    const routine = await routineApi.update(req);
    set((state) => ({
      routines: state.routines.map((r) => (r.id === req.id ? routine : r)),
    }));
    return routine;
  },

  deleteRoutine: async (id) => {
    await routineApi.delete(id);
    set((state) => ({
      routines: state.routines.filter((r) => r.id !== id),
      routineTasks: state.routineTasks.filter((t) => t.routine_id !== id),
    }));
  },

  createRoutineTask: async (req) => {
    const task = await routineApi.createTask(req);
    set((state) => ({ routineTasks: [...state.routineTasks, task] }));
    return task;
  },

  updateRoutineTask: async (req) => {
    const task = await routineApi.updateTask(req);
    set((state) => ({
      routineTasks: state.routineTasks.map((t) => (t.id === req.id ? task : t)),
    }));
    return task;
  },

  deleteRoutineTask: async (id) => {
    await routineApi.deleteTask(id);
    set((state) => ({
      routineTasks: state.routineTasks.filter((t) => t.id !== id),
    }));
  },

  tasksFor: (routineId) =>
    get()
      .routineTasks.filter((t) => t.routine_id === routineId)
      .sort((a, b) => a.sort_order - b.sort_order),
}));
