import { invoke } from '@tauri-apps/api/core';
import type {
  Task,
  Goal,
  Project,
  Category,
  Meeting,
  CreateTaskRequest,
  UpdateTaskRequest,
  CreateGoalRequest,
  UpdateGoalRequest,
  CreateProjectRequest,
  UpdateProjectRequest,
  CreateCategoryRequest,
  CreateMeetingRequest,
  UpdateMeetingRequest,
  SearchResult,
  TaskStats,
  Routine,
  RoutineTask,
  CreateRoutineRequest,
  UpdateRoutineRequest,
  CreateRoutineTaskRequest,
  UpdateRoutineTaskRequest,
  PlannerEntry,
  PlannerKind,
  CreatePlannerEntryRequest,
  UpdatePlannerEntryRequest,
  PlannerTemplate,
  CreatePlannerTemplateRequest,
  DayTemplate,
  CreateDayTemplateRequest,
  Note,
  NoteFolder,
  CreateNoteRequest,
  UpdateNoteRequest,
  CreateNoteFolderRequest,
  UpdateNoteFolderRequest,
} from '@/types';

// Task commands
export const taskApi = {
  create: (req: CreateTaskRequest): Promise<Task> =>
    invoke('create_task', { req }),
  
  getAll: (): Promise<Task[]> =>
    invoke('get_all_tasks'),
  
  getByDate: (date: string): Promise<Task[]> =>
    invoke('get_tasks_by_date', { date }),
  
  update: (req: UpdateTaskRequest): Promise<Task> =>
    invoke('update_task', { req }),
  
  complete: (id: string): Promise<Task> =>
    invoke('complete_task', { id }),
  
  uncomplete: (id: string): Promise<Task> =>
    invoke('uncomplete_task', { id }),
  
  delete: (id: string): Promise<void> =>
    invoke('delete_task', { id }),
  
  duplicate: (id: string): Promise<Task> =>
    invoke('duplicate_task', { id }),
  
  getForDateRange: (start: string, end: string): Promise<Task[]> =>
    invoke('get_tasks_for_date_range', { start, end }),
  
  getStats: (): Promise<TaskStats> =>
    invoke('get_task_stats'),
};

// Goal commands
export const goalApi = {
  create: (req: CreateGoalRequest): Promise<Goal> =>
    invoke('create_goal', { req }),
  
  getAll: (): Promise<Goal[]> =>
    invoke('get_all_goals'),
  
  update: (req: UpdateGoalRequest): Promise<Goal> =>
    invoke('update_goal', { req }),
  
  delete: (id: string): Promise<void> =>
    invoke('delete_goal', { id }),
};

// Project commands
export const projectApi = {
  create: (req: CreateProjectRequest): Promise<Project> =>
    invoke('create_project', { req }),
  
  getAll: (): Promise<Project[]> =>
    invoke('get_all_projects'),
  
  update: (req: UpdateProjectRequest): Promise<Project> =>
    invoke('update_project', { req }),
  
  delete: (id: string): Promise<void> =>
    invoke('delete_project', { id }),
};

// Category commands
export const categoryApi = {
  create: (req: CreateCategoryRequest): Promise<Category> =>
    invoke('create_category', { req }),
  
  getAll: (): Promise<Category[]> =>
    invoke('get_all_categories'),
  
  delete: (id: string): Promise<void> =>
    invoke('delete_category', { id }),
};

// Meeting commands
export const meetingApi = {
  create: (req: CreateMeetingRequest): Promise<Meeting> =>
    invoke('create_meeting', { req }),
  
  getAll: (): Promise<Meeting[]> =>
    invoke('get_all_meetings'),
  
  getByDate: (date: string): Promise<Meeting[]> =>
    invoke('get_meetings_by_date', { date }),
  
  update: (req: UpdateMeetingRequest): Promise<Meeting> =>
    invoke('update_meeting', { req }),
  
  delete: (id: string): Promise<void> =>
    invoke('delete_meeting', { id }),
  
  getForDateRange: (start: string, end: string): Promise<Meeting[]> =>
    invoke('get_meetings_for_date_range', { start, end }),
};

// Search
export const searchApi = {
  search: (query: string): Promise<SearchResult> =>
    invoke('search', { query }),
};

// Settings
export const settingsApi = {
  get: (key: string): Promise<string | null> =>
    invoke('get_setting', { key }),

  set: (key: string, value: string): Promise<void> =>
    invoke('set_setting', { key, value }),
};

// Routines
export const routineApi = {
  create: (req: CreateRoutineRequest): Promise<Routine> =>
    invoke('create_routine', { req }),

  getAll: (): Promise<Routine[]> =>
    invoke('get_all_routines'),

  update: (req: UpdateRoutineRequest): Promise<Routine> =>
    invoke('update_routine', { req }),

  delete: (id: string): Promise<void> =>
    invoke('delete_routine', { id }),

  createTask: (req: CreateRoutineTaskRequest): Promise<RoutineTask> =>
    invoke('create_routine_task', { req }),

  getTasks: (routineId: string): Promise<RoutineTask[]> =>
    invoke('get_routine_tasks', { routineId }),

  getAllTasks: (): Promise<RoutineTask[]> =>
    invoke('get_all_routine_tasks'),

  updateTask: (req: UpdateRoutineTaskRequest): Promise<RoutineTask> =>
    invoke('update_routine_task', { req }),

  deleteTask: (id: string): Promise<void> =>
    invoke('delete_routine_task', { id }),
};

// Planners
export const plannerApi = {
  createEntry: (req: CreatePlannerEntryRequest): Promise<PlannerEntry> =>
    invoke('create_planner_entry', { req }),

  getEntries: (kind: PlannerKind): Promise<PlannerEntry[]> =>
    invoke('get_planner_entries', { kind }),

  updateEntry: (req: UpdatePlannerEntryRequest): Promise<PlannerEntry> =>
    invoke('update_planner_entry', { req }),

  deleteEntry: (id: string): Promise<void> =>
    invoke('delete_planner_entry', { id }),

  createTemplate: (req: CreatePlannerTemplateRequest): Promise<PlannerTemplate> =>
    invoke('create_planner_template', { req }),

  getTemplates: (kind: PlannerKind): Promise<PlannerTemplate[]> =>
    invoke('get_planner_templates', { kind }),

  deleteTemplate: (id: string): Promise<void> =>
    invoke('delete_planner_template', { id }),
};

// Day templates (Plan my day)
export const dayTemplateApi = {
  create: (req: CreateDayTemplateRequest): Promise<DayTemplate> =>
    invoke('create_day_template', { req }),

  getAll: (): Promise<DayTemplate[]> =>
    invoke('get_day_templates'),

  delete: (id: string): Promise<void> =>
    invoke('delete_day_template', { id }),
};

// Notes
export const noteApi = {
  create: (req: CreateNoteRequest): Promise<Note> =>
    invoke('create_note', { req }),

  getAll: (): Promise<Note[]> =>
    invoke('get_all_notes'),

  getByFolder: (folderId: string): Promise<Note[]> =>
    invoke('get_notes_by_folder', { folderId }),

  update: (req: UpdateNoteRequest): Promise<Note> =>
    invoke('update_note', { req }),

  delete: (id: string): Promise<void> =>
    invoke('delete_note', { id }),
};

// Note folders
export const noteFolderApi = {
  create: (req: CreateNoteFolderRequest): Promise<NoteFolder> =>
    invoke('create_note_folder', { req }),

  getAll: (): Promise<NoteFolder[]> =>
    invoke('get_all_note_folders'),

  update: (req: UpdateNoteFolderRequest): Promise<NoteFolder> =>
    invoke('update_note_folder', { req }),

  delete: (id: string): Promise<void> =>
    invoke('delete_note_folder', { id }),
};
