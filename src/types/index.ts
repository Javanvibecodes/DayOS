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
  assignee_device_id?: string | null;
  assigned_by_device_id?: string | null;
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
  assignee_device_id?: string;
  assigned_by_device_id?: string;
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
  assignee_device_id?: string;
  assigned_by_device_id?: string;
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
  owner_device_id?: string | null;
  collaborator_device_ids?: string[] | string | null;
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
  owner_device_id?: string;
  collaborator_device_ids?: string[];
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
  owner_device_id?: string;
  collaborator_device_ids?: string[];
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
  owner_device_id?: string | null;
  collaborator_device_ids?: string[] | string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateProjectRequest {
  goal_id?: string;
  name: string;
  description?: string;
  color?: string;
  category_id?: string;
  owner_device_id?: string;
  collaborator_device_ids?: string[];
}

export interface UpdateProjectRequest {
  id: string;
  goal_id?: string;
  name?: string;
  description?: string;
  color?: string;
  status?: ProjectStatus;
  category_id?: string;
  owner_device_id?: string;
  collaborator_device_ids?: string[];
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

export interface UpdateCategoryRequest {
  id: string;
  name?: string;
  color?: string;
  icon?: string;
  sort_order?: number;
}

// Meeting types
export const MEETING_REMINDER_OPTIONS = [
  1440, 720, 360, 180, 120, 60, 30, 15,
] as const;

export type MeetingReminderMinutes = (typeof MEETING_REMINDER_OPTIONS)[number];

/**
 * Normalized meeting provider. Provider identity is stored separately from the
 * meeting URL so a manual link can never be mistaken for a live integration.
 */
export type MeetingProvider = 'none' | 'google_meet' | 'zoom';
export type MeetingStatus = 'confirmed' | 'tentative' | 'cancelled';

export interface Meeting {
  id: string;
  title: string;
  description: string | null;
  date: string;
  start_time: string;
  end_time: string | null;
  meeting_url: string | null;
  /** IANA timezone captured from an external provider, when available. */
  timezone: string | null;
  external_provider: MeetingProvider;
  external_id: string | null;
  passcode: string | null;
  calendar_event_id: string | null;
  calendar_id: string | null;
  calendar_connection_id: string | null;
  participants: string[] | null;
  meeting_status: MeetingStatus;
  provider_metadata: Record<string, unknown> | null;
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
  timezone?: string;
  external_provider?: MeetingProvider;
  external_id?: string;
  passcode?: string;
  calendar_event_id?: string;
  calendar_id?: string;
  calendar_connection_id?: string;
  participants?: string[];
  meeting_status?: MeetingStatus;
  provider_metadata?: Record<string, unknown>;
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
  timezone?: string;
  external_provider?: MeetingProvider;
  external_id?: string;
  passcode?: string;
  calendar_event_id?: string;
  calendar_id?: string;
  calendar_connection_id?: string;
  participants?: string[];
  meeting_status?: MeetingStatus;
  provider_metadata?: Record<string, unknown>;
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
export type NavItem = 'today' | 'tasks' | 'goals' | 'projects' | 'meetings' | 'timetable' | 'pomodoro' | 'routines' | 'notes' | 'collaborate' | 'settings' | 'help';

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

// Device & Identity types
export interface Device {
  id: string;
  name: string;
  ip_address?: string | null;
  last_seen: string;
  is_trusted: boolean;
  is_current?: boolean;
  color?: string;
}

// Lock-in Session types
export type LockinPhase = 'focus' | 'short_break' | 'long_break';

export interface LockinSession {
  id: string;
  title: string;
  host_device_id: string;
  host_device_name: string;
  pin_code: string;
  current_phase: LockinPhase;
  duration_minutes: number;
  remaining_seconds: number;
  is_running: boolean;
  participant_count: number;
  created_at: string;
  updated_at: string;
}

export interface LockinParticipant {
  device_id: string;
  device_name: string;
  is_host: boolean;
  status: 'focusing' | 'resting' | 'idle';
  joined_at: string;
}

// External Calendar & Video Integrations
//
// OAuth credentials never cross the Tauri boundary. The renderer only receives
// the non-sensitive connection status described below.
export type ConnectorId = 'google_calendar' | 'google_meet' | 'zoom';

export type ConnectorState =
  | 'not_connected'
  | 'needs_authorization'
  | 'connecting'
  | 'connected'
  | 'syncing'
  | 'auth_expired'
  | 'error';

export interface ProviderConnectionStatus {
  provider: ConnectorId;
  state: ConnectorState;
  account_email: string | null;
  display_name: string | null;
  scopes: string[];
  read_access: boolean;
  write_access: boolean;
  last_synced_at: string | null;
  last_error: string | null;
  enabled_features: string[];
}

export interface IntegrationStatuses {
  google_calendar: ProviderConnectionStatus;
  google_meet: ProviderConnectionStatus;
  zoom: ProviderConnectionStatus;
}

export interface IntegrationError {
  code: string;
  message: string;
  retryable: boolean;
}

export interface ExternalMeetingRequest {
  title: string;
  description?: string;
  date: string;
  start_time: string;
  end_time?: string;
  timezone?: string;
  participants?: string[];
}

export interface ExternalMeetingResult {
  provider: Exclude<MeetingProvider, 'none'>;
  external_id: string;
  meeting_url: string;
  passcode: string | null;
  provider_metadata: Record<string, unknown>;
}

export interface UpdateExternalMeetingRequest {
  external_id: string;
  title?: string;
  description?: string;
  date?: string;
  start_time?: string;
  end_time?: string;
  timezone?: string;
  participants?: string[];
}

// AI Agent types
export type AIModelProvider = 'ollama' | 'openai' | 'gemini' | 'anthropic' | 'deepseek' | 'openrouter';

export interface AISettings {
  provider: AIModelProvider;
  model_name: string;
  endpoint_url: string;
  api_key: string;
  speech_input_enabled: boolean;
  speech_output_enabled: boolean;
  voice_pitch: number;
  voice_rate: number;
  tts_voice_id?: string;
  cloud_keys?: Record<string, string>;
  ollama_models_dir?: string;
  tts_models_dir?: string;
}

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
  tool_calls?: Array<{
    name: string;
    args: Record<string, unknown>;
    result?: unknown;
  }>;
}

// Mobile Sync types
export type SyncStatus = 'idle' | 'pairing' | 'syncing' | 'synced' | 'error';

export interface MobileSyncState {
  pairing_code: string;
  local_ip: string;
  port: number;
  status: SyncStatus;
  last_sync_timestamp: string | null;
  paired_devices: Device[];
}
