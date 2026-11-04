use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Task {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub goal_id: Option<String>,
    pub project_id: Option<String>,
    pub category_id: Option<String>,
    pub scheduled_date: Option<String>,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub priority: String,
    pub status: String,
    pub is_recurring: bool,
    pub recurrence_rule: Option<String>,
    pub reminder_enabled: bool,
    pub reminder_minutes: Option<i32>,
    pub created_at: String,
    pub updated_at: String,
    pub completed_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Goal {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    #[serde(rename = "type")]
    pub goal_type: String,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub status: String,
    pub color: String,
    pub category_id: Option<String>,
    pub recurrence_rule: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: String,
    pub goal_id: Option<String>,
    pub name: String,
    pub description: Option<String>,
    pub color: String,
    pub status: String,
    pub category_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Category {
    pub id: String,
    pub name: String,
    pub color: String,
    pub icon: String,
    pub sort_order: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Meeting {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub date: String,
    pub start_time: String,
    pub end_time: Option<String>,
    pub meeting_url: Option<String>,
    pub reminder_enabled: bool,
    pub reminder_minutes: Option<i32>,
    /// Up to 3 reminder offsets in minutes before start (e.g. 1440, 60, 15)
    pub reminder_offsets: Option<Vec<i32>>,
    pub is_recurring: bool,
    pub recurrence_rule: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateTaskRequest {
    pub title: String,
    pub description: Option<String>,
    pub goal_id: Option<String>,
    pub project_id: Option<String>,
    pub category_id: Option<String>,
    pub scheduled_date: Option<String>,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub priority: Option<String>,
    pub status: Option<String>,
    pub is_recurring: Option<bool>,
    pub recurrence_rule: Option<String>,
    pub reminder_enabled: Option<bool>,
    pub reminder_minutes: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateTaskRequest {
    pub id: String,
    pub title: Option<String>,
    pub description: Option<String>,
    pub goal_id: Option<String>,
    pub project_id: Option<String>,
    pub category_id: Option<String>,
    pub scheduled_date: Option<String>,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub priority: Option<String>,
    pub status: Option<String>,
    pub is_recurring: Option<bool>,
    pub recurrence_rule: Option<String>,
    pub reminder_enabled: Option<bool>,
    pub reminder_minutes: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateGoalRequest {
    pub title: String,
    pub description: Option<String>,
    #[serde(rename = "type")]
    pub goal_type: String,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub color: Option<String>,
    pub category_id: Option<String>,
    pub recurrence_rule: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateProjectRequest {
    pub goal_id: Option<String>,
    pub name: String,
    pub description: Option<String>,
    pub color: Option<String>,
    pub category_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateCategoryRequest {
    pub name: String,
    pub color: Option<String>,
    pub icon: Option<String>,
    pub sort_order: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateGoalRequest {
    pub id: String,
    pub title: Option<String>,
    pub description: Option<String>,
    #[serde(rename = "type")]
    pub goal_type: Option<String>,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub status: Option<String>,
    pub color: Option<String>,
    /// None = leave unchanged; Some("") = clear; Some(id) = set
    pub category_id: Option<String>,
    pub recurrence_rule: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Routine {
    pub id: String,
    pub name: String,
    pub start_time: Option<String>,
    pub days: String,
    pub reminder_enabled: bool,
    pub reminder_minutes: Option<i32>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoutineTask {
    pub id: String,
    pub routine_id: String,
    pub title: String,
    pub duration_minutes: i32,
    pub sort_order: i32,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlannerEntry {
    pub id: String,
    pub kind: String,
    pub bucket: String,
    pub title: String,
    pub notes: Option<String>,
    pub start_time: Option<String>,
    pub sort_order: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlannerTemplate {
    pub id: String,
    pub kind: String,
    pub name: String,
    pub payload: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateRoutineRequest {
    pub name: String,
    pub start_time: Option<String>,
    pub days: Option<String>,
    pub reminder_enabled: Option<bool>,
    pub reminder_minutes: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateRoutineRequest {
    pub id: String,
    pub name: Option<String>,
    pub start_time: Option<String>,
    pub days: Option<String>,
    pub reminder_enabled: Option<bool>,
    pub reminder_minutes: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateRoutineTaskRequest {
    pub routine_id: String,
    pub title: String,
    pub duration_minutes: i32,
    pub sort_order: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateRoutineTaskRequest {
    pub id: String,
    pub title: Option<String>,
    pub duration_minutes: Option<i32>,
    pub sort_order: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreatePlannerEntryRequest {
    pub kind: String,
    pub bucket: String,
    pub title: String,
    pub notes: Option<String>,
    pub start_time: Option<String>,
    pub sort_order: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdatePlannerEntryRequest {
    pub id: String,
    pub title: Option<String>,
    pub notes: Option<String>,
    pub start_time: Option<String>,
    pub sort_order: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreatePlannerTemplateRequest {
    pub kind: String,
    pub name: String,
    pub payload: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateProjectRequest {
    pub id: String,
    pub goal_id: Option<String>,
    pub name: Option<String>,
    pub description: Option<String>,
    pub color: Option<String>,
    pub status: Option<String>,
    /// None = leave unchanged; Some("") = clear; Some(id) = set
    pub category_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateMeetingRequest {
    pub title: String,
    pub description: Option<String>,
    pub date: String,
    pub start_time: String,
    pub end_time: Option<String>,
    pub meeting_url: Option<String>,
    pub reminder_enabled: Option<bool>,
    pub reminder_minutes: Option<i32>,
    /// Up to 3 offsets in minutes before start
    pub reminder_offsets: Option<Vec<i32>>,
    pub is_recurring: Option<bool>,
    pub recurrence_rule: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateMeetingRequest {
    pub id: String,
    pub title: Option<String>,
    pub description: Option<String>,
    pub date: Option<String>,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub meeting_url: Option<String>,
    pub reminder_enabled: Option<bool>,
    pub reminder_minutes: Option<i32>,
    /// None = leave unchanged; Some(vec![]) = clear; Some(offsets) = set (max 3)
    pub reminder_offsets: Option<Vec<i32>>,
    pub is_recurring: Option<bool>,
    pub recurrence_rule: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DayTemplate {
    pub id: String,
    pub name: String,
    pub payload: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateDayTemplateRequest {
    pub name: String,
    pub payload: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NoteFolder {
    pub id: String,
    pub name: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Note {
    pub id: String,
    pub title: String,
    pub content: String,
    pub folder_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateNoteFolderRequest {
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateNoteFolderRequest {
    pub id: String,
    pub name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateNoteRequest {
    pub title: Option<String>,
    pub content: Option<String>,
    /// None or empty string = unfiled
    pub folder_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateNoteRequest {
    pub id: String,
    pub title: Option<String>,
    pub content: Option<String>,
    /// None = leave unchanged; Some("") = clear; Some(id) = set
    pub folder_id: Option<String>,
}
