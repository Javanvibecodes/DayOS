// Task types
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';
export type TaskStatus = 'todo' | 'in_progress' | 'completed' | 'cancelled';

export interface Task {
  id: string;
  title: string;
  description: string | null;
  goal_id: string | null;
  project_id: string | null;
  category_id: string | null;
  scheduled_date: string | null;
  start_time: string | null;
  end_time: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  is_recurring: boolean;
  recurrence_rule: string | null;
  reminder_enabled: boolean;
  reminder_minutes: number | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  isOverdue?: boolean;
}

export interface CreateTaskRequest {
  title: string;
  description?: string;
  goal_id?: string;
  project_id?: string;
  category_id?: string;
  scheduled_date?: string;
  start_time?: string;
  end_time?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  is_recurring?: boolean;
  recurrence_rule?: string;
  reminder_enabled?: boolean;
  reminder_minutes?: number;
}

export interface UpdateTaskRequest {
  id: string;
  title?: string;
  description?: string;
  goal_id?: string;
  project_id?: string;
  category_id?: string;
  scheduled_date?: string;
  start_time?: string;
  end_time?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  is_recurring?: boolean;
  recurrence_rule?: string;
  reminder_enabled?: boolean;
  reminder_minutes?: number;
}

// Goal types
export type GoalType = 'daily' | 'weekly' | 'monthly';
export type GoalStatus = 'active' | 'completed' | 'archived';

export interface Goal {
  id: string;
  title: string;
  description: string | null;
  type: GoalType;
  start_date: string | null;
  end_date: string | null;
  status: GoalStatus;
  color: string;
  category_id: string | null;
  recurrence_rule: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateGoalRequest {
  title: string;
  description?: string;
  type: GoalType;
  start_date?: string;
  end_date?: string;
  color?: string;
  category_id?: string;
  recurrence_rule?: string;
}

export interface UpdateGoalRequest {
  id: string;
  title?: string;
  description?: string;
  type?: GoalType;
  start_date?: string;
  end_date?: string;
  status?: GoalStatus;
  color?: string;
  category_id?: string;
  recurrence_rule?: string;
}

// Project types
export type ProjectStatus = 'active' | 'completed' | 'archived';

export interface Project {
  id: string;
  goal_id: string | null;
  name: string;
  description: string | null;
  color: string;
  status: ProjectStatus;
  category_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateProjectRequest {
  goal_id?: string;
  name: string;
  description?: string;
  color?: string;
  category_id?: string;
}

export interface UpdateProjectRequest {
  id: string;
  goal_id?: string;
  name?: string;
  description?: string;
  color?: string;
  status?: ProjectStatus;
  category_id?: string;
}

// Category types
export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CreateCategoryRequest {
  name: string;
  color?: string;
  icon?: string;
  sort_order?: number;
}

// Meeting types
export const MEETING_REMINDER_OPTIONS = [
  1440, 720, 360, 180, 120, 60, 30, 15,
] as const;

export type MeetingReminderMinutes = (typeof MEETING_REMINDER_OPTIONS)[number];

export interface Meeting {
  id: string;
  title: string;
  description: string | null;
  date: string;
  start_time: string;
  end_time: string | null;
  meeting_url: string | null;
  reminder_enabled: boolean;
  reminder_minutes: number | null;
  /** Up to 3 reminder offsets in minutes before start (e.g. 1440, 60, 15) */
  reminder_offsets: number[] | null;
  is_recurring: boolean;
  recurrence_rule: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateMeetingRequest {
  title: string;
  description?: string;
  date: string;
  start_time: string;
  end_time?: string;
  meeting_url?: string;
  reminder_enabled?: boolean;
  reminder_minutes?: number;
  reminder_offsets?: number[];
  is_recurring?: boolean;
  recurrence_rule?: string;
}

export interface UpdateMeetingRequest {
  id: string;
  title?: string;
  description?: string;
  date?: string;
  start_time?: string;
  end_time?: string;
  meeting_url?: string;
  reminder_enabled?: boolean;
  reminder_minutes?: number;
  reminder_offsets?: number[];
  is_recurring?: boolean;
  recurrence_rule?: string;
}

// Settings types
export type ColorMode = 'light' | 'dark' | 'system';

export interface Settings {
  startWithWindows: boolean;
  startMinimized: boolean;
  showWidget: boolean;
  colorMode: ColorMode;
  theme: string;
  widgetAlwaysOnTop: boolean;
  widgetRememberPosition: boolean;
  widgetRememberSize: boolean;
  widgetShowCompleted: boolean;
  widgetCompactMode: boolean;
  backupEnabled: boolean;
  backupInterval: number;
  backupRetainCount: number;
}

// Search types
export interface SearchResult {
  tasks: Task[];
  goals: Goal[];
  projects: Project[];
  meetings: Meeting[];
  categories: Category[];
}

// Task stats
export interface TaskStats {
  total: number;
  completed: number;
  inProgress: number;
  overdue: number;
}

// Navigation
export type NavItem = 'today' | 'tasks' | 'goals' | 'projects' | 'meetings' | 'timetable' | 'pomodoro' | 'routines' | 'notes' | 'settings';

// Routines
export interface Routine {
  id: string;
  name: string;
  start_time: string | null;
  days: string;
  reminder_enabled: boolean;
  reminder_minutes: number | null;
  created_at: string;
  updated_at: string;
}

export interface RoutineTask {
  id: string;
  routine_id: string;
  title: string;
  duration_minutes: number;
  sort_order: number;
  created_at: string;
}

export interface CreateRoutineRequest {
  name: string;
  start_time?: string;
  days?: string;
  reminder_enabled?: boolean;
  reminder_minutes?: number;
}

export interface UpdateRoutineRequest {
  id: string;
  name?: string;
  start_time?: string;
  days?: string;
  reminder_enabled?: boolean;
  reminder_minutes?: number;
}

export interface CreateRoutineTaskRequest {
  routine_id: string;
  title: string;
  duration_minutes: number;
  sort_order?: number;
}

export interface UpdateRoutineTaskRequest {
  id: string;
  title?: string;
  duration_minutes?: number;
  sort_order?: number;
}

// Planners
export type PlannerKind = 'day' | 'week';

export interface PlannerEntry {
  id: string;
  kind: PlannerKind;
  bucket: string;
  title: string;
  notes: string | null;
  start_time: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CreatePlannerEntryRequest {
  kind: PlannerKind;
  bucket: string;
  title: string;
  notes?: string;
  start_time?: string;
  sort_order?: number;
}

export interface UpdatePlannerEntryRequest {
  id: string;
  title?: string;
  notes?: string;
  start_time?: string;
  sort_order?: number;
}

export interface PlannerTemplate {
  id: string;
  kind: PlannerKind;
  name: string;
  payload: string;
  created_at: string;
}

export interface CreatePlannerTemplateRequest {
  kind: PlannerKind;
  name: string;
  payload: string;
}

// Day templates (Plan my day)
export interface DayTemplate {
  id: string;
  name: string;
  payload: string;
  created_at: string;
}

export interface CreateDayTemplateRequest {
  name: string;
  payload: string;
}

// Notes
export interface NoteFolder {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  folder_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateNoteFolderRequest {
  name: string;
}

export interface UpdateNoteFolderRequest {
  id: string;
  name?: string;
}

export interface CreateNoteRequest {
  title?: string;
  content?: string;
  /** None or empty = unfiled */
  folder_id?: string;
}

export interface UpdateNoteRequest {
  id: string;
  title?: string;
  content?: string;
  /** None = unchanged; '' = clear; id = set */
  folder_id?: string;
}

// Keyboard shortcuts
export type ShortcutAction =
  | 'commandPalette'
  | 'toggleSidebar'
  | 'newTask'
  | 'newGoal'
  | 'newMeeting'
  | 'newProject'
  | 'toggleTimetable'
  | 'turnOffAlarm'
  | 'openPomodoro';

export type ShortcutBindings = Record<ShortcutAction, string>;
