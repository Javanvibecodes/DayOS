use tauri::State;
use crate::database::DbState;
use crate::database::models::*;
use crate::database::queries;

#[tauri::command]
pub fn create_task(state: State<'_, DbState>, req: CreateTaskRequest) -> Result<Task, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    queries::create_task(&conn, req).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_all_tasks(state: State<'_, DbState>) -> Result<Vec<Task>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    queries::get_all_tasks(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_tasks_by_date(state: State<'_, DbState>, date: String) -> Result<Vec<Task>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    queries::get_tasks_by_date(&conn, &date).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_task(state: State<'_, DbState>, req: UpdateTaskRequest) -> Result<Task, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    queries::update_task(&conn, req).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn complete_task(state: State<'_, DbState>, id: String) -> Result<Task, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    queries::complete_task(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn uncomplete_task(state: State<'_, DbState>, id: String) -> Result<Task, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    queries::uncomplete_task(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_task(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    queries::delete_task(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn duplicate_task(state: State<'_, DbState>, id: String) -> Result<Task, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    queries::duplicate_task(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_goal(state: State<'_, DbState>, req: CreateGoalRequest) -> Result<Goal, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    queries::create_goal(&conn, req).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_all_goals(state: State<'_, DbState>) -> Result<Vec<Goal>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    queries::get_all_goals(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_goal(state: State<'_, DbState>, req: UpdateGoalRequest) -> Result<Goal, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    queries::update_goal(&conn, req).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_goal(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    queries::delete_goal(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_project(state: State<'_, DbState>, req: CreateProjectRequest) -> Result<Project, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    queries::create_project(&conn, req).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_all_projects(state: State<'_, DbState>) -> Result<Vec<Project>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    queries::get_all_projects(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_project(state: State<'_, DbState>, req: UpdateProjectRequest) -> Result<Project, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    queries::update_project(&conn, req).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_project(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    queries::delete_project(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_category(state: State<'_, DbState>, req: CreateCategoryRequest) -> Result<Category, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    queries::create_category(&conn, req).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_all_categories(state: State<'_, DbState>) -> Result<Vec<Category>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    queries::get_all_categories(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_category(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    queries::delete_category(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_category(state: State<'_, DbState>, req: UpdateCategoryRequest) -> Result<Category, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    queries::update_category(&conn, req).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_meeting(state: State<'_, DbState>, req: CreateMeetingRequest) -> Result<Meeting, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    queries::create_meeting(&conn, req).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_all_meetings(state: State<'_, DbState>) -> Result<Vec<Meeting>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    queries::get_all_meetings(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_meetings_by_date(state: State<'_, DbState>, date: String) -> Result<Vec<Meeting>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    queries::get_meetings_by_date(&conn, &date).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_meeting(state: State<'_, DbState>, req: UpdateMeetingRequest) -> Result<Meeting, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    queries::update_meeting(&conn, req).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_meeting(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    queries::delete_meeting(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn search(state: State<'_, DbState>, query: String) -> Result<(Vec<Task>, Vec<Goal>, Vec<Project>, Vec<Meeting>, Vec<Category>), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    queries::search_all(&conn, &query).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_task_stats(state: State<'_, DbState>) -> Result<(i64, i64, i64, i64), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    queries::get_task_stats(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_tasks_for_date_range(state: State<'_, DbState>, start: String, end: String) -> Result<Vec<Task>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    queries::get_tasks_for_date_range(&conn, &start, &end).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_meetings_for_date_range(state: State<'_, DbState>, start: String, end: String) -> Result<Vec<Meeting>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    queries::get_meetings_for_date_range(&conn, &start, &end).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_setting(state: State<'_, DbState>, key: String) -> Result<Option<String>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    queries::get_setting(&conn, &key).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_setting(state: State<'_, DbState>, key: String, value: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    queries::set_setting(&conn, &key, &value).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_routine(state: State<'_, DbState>, req: CreateRoutineRequest) -> Result<Routine, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    queries::create_routine(&conn, req).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_all_routines(state: State<'_, DbState>) -> Result<Vec<Routine>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    queries::get_all_routines(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_routine(state: State<'_, DbState>, req: UpdateRoutineRequest) -> Result<Routine, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    queries::update_routine(&conn, req).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_routine(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    queries::delete_routine(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_routine_task(state: State<'_, DbState>, req: CreateRoutineTaskRequest) -> Result<RoutineTask, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    queries::create_routine_task(&conn, req).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_routine_tasks(state: State<'_, DbState>, routine_id: String) -> Result<Vec<RoutineTask>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    queries::get_routine_tasks(&conn, &routine_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_all_routine_tasks(state: State<'_, DbState>) -> Result<Vec<RoutineTask>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    queries::get_all_routine_tasks(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_routine_task(state: State<'_, DbState>, req: UpdateRoutineTaskRequest) -> Result<RoutineTask, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    queries::update_routine_task(&conn, req).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_routine_task(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    queries::delete_routine_task(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_planner_entry(state: State<'_, DbState>, req: CreatePlannerEntryRequest) -> Result<PlannerEntry, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    queries::create_planner_entry(&conn, req).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_planner_entries(state: State<'_, DbState>, kind: String) -> Result<Vec<PlannerEntry>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    queries::get_planner_entries(&conn, &kind).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_planner_entry(state: State<'_, DbState>, req: UpdatePlannerEntryRequest) -> Result<PlannerEntry, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    queries::update_planner_entry(&conn, req).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_planner_entry(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    queries::delete_planner_entry(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_planner_template(state: State<'_, DbState>, req: CreatePlannerTemplateRequest) -> Result<PlannerTemplate, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    queries::create_planner_template(&conn, req).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_planner_templates(state: State<'_, DbState>, kind: String) -> Result<Vec<PlannerTemplate>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    queries::get_planner_templates(&conn, &kind).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_planner_template(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    queries::delete_planner_template(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_day_template(state: State<'_, DbState>, req: CreateDayTemplateRequest) -> Result<DayTemplate, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    queries::create_day_template(&conn, req).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_day_templates(state: State<'_, DbState>) -> Result<Vec<DayTemplate>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    queries::get_day_templates(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_day_template(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    queries::delete_day_template(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_note_folder(state: State<'_, DbState>, req: CreateNoteFolderRequest) -> Result<NoteFolder, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    queries::create_note_folder(&conn, req).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_all_note_folders(state: State<'_, DbState>) -> Result<Vec<NoteFolder>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    queries::get_all_note_folders(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_note_folder(state: State<'_, DbState>, req: UpdateNoteFolderRequest) -> Result<NoteFolder, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    queries::update_note_folder(&conn, req).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_note_folder(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    queries::delete_note_folder(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_note(state: State<'_, DbState>, req: CreateNoteRequest) -> Result<Note, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    queries::create_note(&conn, req).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_all_notes(state: State<'_, DbState>) -> Result<Vec<Note>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    queries::get_all_notes(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_notes_by_folder(state: State<'_, DbState>, folder_id: String) -> Result<Vec<Note>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    queries::get_notes_by_folder(&conn, &folder_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_note(state: State<'_, DbState>, req: UpdateNoteRequest) -> Result<Note, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    queries::update_note(&conn, req).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_note(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    queries::delete_note(&conn, &id).map_err(|e| e.to_string())
}
