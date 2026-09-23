import { create } from 'zustand';
import type { Task, CreateTaskRequest, UpdateTaskRequest, TaskPriority, TaskStatus } from '@/types';
import { taskApi } from '@/lib/db/api';

interface TaskState {
  tasks: Task[];
  selectedTask: Task | null;
  isLoading: boolean;
  error: string | null;
  
  // Filters
  filterPriority: TaskPriority | null;
  filterStatus: TaskStatus | null;
  filterCategoryId: string | null;
  filterGoalId: string | null;
  filterProjectId: string | null;
  filterDate: string | null;
  filterOverdue: boolean;
  
  // Actions
  loadTasks: () => Promise<void>;
  loadTasksByDate: (date: string) => Promise<void>;
  createTask: (req: CreateTaskRequest) => Promise<Task>;
  updateTask: (req: UpdateTaskRequest) => Promise<Task>;
  completeTask: (id: string) => Promise<Task>;
  uncompleteTask: (id: string) => Promise<Task>;
  deleteTask: (id: string) => Promise<void>;
  duplicateTask: (id: string) => Promise<Task>;
  setSelectedTask: (task: Task | null) => void;
  setFilter: (key: string, value: string | null) => void;
  clearFilters: () => void;
  
  // Computed
  getFilteredTasks: () => Task[];
  getTasksByPriority: (priority: TaskPriority) => Task[];
  getTasksByStatus: (status: TaskStatus) => Task[];
  checkOverdueTasks: () => void;
  getOverdueTasks: () => Task[];
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  selectedTask: null,
  isLoading: false,
  error: null,
  
  filterPriority: null,
  filterStatus: null,
  filterCategoryId: null,
  filterGoalId: null,
  filterProjectId: null,
  filterDate: null,
  filterOverdue: false,
  
  loadTasks: async () => {
    set({ isLoading: true, error: null });
    try {
      const tasks = await taskApi.getAll();
      set({ tasks, isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },
  
  loadTasksByDate: async (date: string) => {
    set({ isLoading: true, error: null });
    try {
      const tasks = await taskApi.getByDate(date);
      set({ tasks, isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },
  
  createTask: async (req: CreateTaskRequest) => {
    const task = await taskApi.create(req);
    set((state) => ({ tasks: [...state.tasks, task] }));
    return task;
  },
  
  updateTask: async (req: UpdateTaskRequest) => {
    const task = await taskApi.update(req);
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === req.id ? task : t)),
      selectedTask: state.selectedTask?.id === req.id ? task : state.selectedTask,
    }));
    return task;
  },
  
  completeTask: async (id: string) => {
    const existing = get().tasks.find((t) => t.id === id);
    const task = await taskApi.complete(id);
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === id ? task : t)),
      selectedTask: state.selectedTask?.id === id ? task : state.selectedTask,
    }));
    if (existing?.is_recurring && existing.scheduled_date && existing.recurrence_rule) {
      const daysMatch = existing.recurrence_rule.match(/every:(\d+)/);
      const step = daysMatch ? Math.max(1, Number(daysMatch[1])) : 1;
      const next = new Date(`${existing.scheduled_date}T12:00:00`);
      next.setDate(next.getDate() + step);
      try {
        await taskApi.create({
          title: existing.title,
          description: existing.description ?? undefined,
          goal_id: existing.goal_id ?? undefined,
          project_id: existing.project_id ?? undefined,
          category_id: existing.category_id ?? undefined,
          scheduled_date: next.toISOString().split('T')[0],
          start_time: existing.start_time ?? undefined,
          end_time: existing.end_time ?? undefined,
          priority: existing.priority,
          status: 'todo',
          is_recurring: true,
          recurrence_rule: existing.recurrence_rule,
          reminder_enabled: existing.reminder_enabled,
          reminder_minutes: existing.reminder_minutes ?? undefined,
        });
        const tasks = await taskApi.getAll();
        set({ tasks });
      } catch (e) {
        console.error('Failed to create recurring occurrence:', e);
      }
    }
    return task;
  },
  
  uncompleteTask: async (id: string) => {
    const task = await taskApi.uncomplete(id);
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === id ? task : t)),
      selectedTask: state.selectedTask?.id === id ? task : state.selectedTask,
    }));
    return task;
  },
  
  deleteTask: async (id: string) => {
    await taskApi.delete(id);
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== id),
      selectedTask: state.selectedTask?.id === id ? null : state.selectedTask,
    }));
  },
  
  duplicateTask: async (id: string) => {
    const task = await taskApi.duplicate(id);
    set((state) => ({ tasks: [...state.tasks, task] }));
    return task;
  },
  
  setSelectedTask: (task: Task | null) => {
    set({ selectedTask: task });
  },
  
  setFilter: (key: string, value: string | null) => {
    set({ [key]: value } as any);
  },
  
  clearFilters: () => {
    set({
      filterPriority: null,
      filterStatus: null,
      filterCategoryId: null,
      filterGoalId: null,
      filterProjectId: null,
      filterDate: null,
      filterOverdue: false,
    });
  },
  
  getFilteredTasks: () => {
    const state = get();
    let filtered = [...state.tasks];
    
    if (state.filterPriority) {
      filtered = filtered.filter((t) => t.priority === state.filterPriority);
    }
    if (state.filterStatus) {
      filtered = filtered.filter((t) => t.status === state.filterStatus);
    }
    if (state.filterCategoryId) {
      filtered = filtered.filter((t) => t.category_id === state.filterCategoryId);
    }
    if (state.filterGoalId) {
      filtered = filtered.filter((t) => t.goal_id === state.filterGoalId);
    }
    if (state.filterProjectId) {
      filtered = filtered.filter((t) => t.project_id === state.filterProjectId);
    }
    if (state.filterDate) {
      filtered = filtered.filter((t) => t.scheduled_date === state.filterDate);
    }
    if (state.filterOverdue) {
      filtered = filtered.filter((t) => {
        if (t.status === 'completed' || t.status === 'cancelled') return false;
        if (!t.scheduled_date) return false;
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        if (t.scheduled_date < todayStr) return true;
        if (t.scheduled_date === todayStr && t.end_time && t.end_time < nowTime) return true;
        return false;
      });
    }
    
    return filtered;
  },
  
  getTasksByPriority: (priority: TaskPriority) => {
    return get().tasks.filter((t) => t.priority === priority);
  },
  
  getTasksByStatus: (status: TaskStatus) => {
    return get().tasks.filter((t) => t.status === status);
  },
  
  checkOverdueTasks: () => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    const { tasks } = get();
    const updated = tasks.map((t) => {
      if (t.status === 'completed' || t.status === 'cancelled') return t;
      if (!t.scheduled_date) return t;
      
      let isOverdue = false;
      if (t.scheduled_date < todayStr) {
        isOverdue = true;
      } else if (t.scheduled_date === todayStr && t.end_time && t.end_time < nowTime) {
        isOverdue = true;
      }
      
      return { ...t, isOverdue };
    });
    
    set({ tasks: updated as Task[] });
  },
  
  getOverdueTasks: () => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    return get().tasks.filter((t) => {
      if (t.status === 'completed' || t.status === 'cancelled') return false;
      if (!t.scheduled_date) return false;
      if (t.scheduled_date < todayStr) return true;
      if (t.scheduled_date === todayStr && t.end_time && t.end_time < nowTime) return true;
      return false;
    });
  },
}));
