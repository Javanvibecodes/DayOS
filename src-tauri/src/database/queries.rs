use rusqlite::{Connection, Result, params};
use uuid::Uuid;

use super::models::*;

const MEETING_REMINDER_OPTIONS: [i32; 8] = [1440, 720, 360, 180, 120, 60, 30, 15];

pub fn create_task(conn: &Connection, req: CreateTaskRequest) -> Result<Task> {
    let id = Uuid::new_v4().to_string();
    let priority = req.priority.unwrap_or_else(|| "medium".to_string());
    let status = req.status.unwrap_or_else(|| "todo".to_string());
    let is_recurring = req.is_recurring.unwrap_or(false) as i32;
    let reminder_enabled = req.reminder_enabled.unwrap_or(false) as i32;

    conn.execute(
        "INSERT INTO tasks (id, title, description, goal_id, project_id, category_id, scheduled_date, start_time, end_time, priority, status, is_recurring, recurrence_rule, reminder_enabled, reminder_minutes)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
        params![
            id, req.title, req.description, req.goal_id, req.project_id,
            req.category_id, req.scheduled_date, req.start_time, req.end_time,
            priority, status, is_recurring, req.recurrence_rule,
            reminder_enabled, req.reminder_minutes
        ],
    )?;

    get_task_by_id(conn, &id)
}

pub fn get_task_by_id(conn: &Connection, id: &str) -> Result<Task> {
    conn.query_row(
        "SELECT id, title, description, goal_id, project_id, category_id, scheduled_date, start_time, end_time, priority, status, is_recurring, recurrence_rule, reminder_enabled, reminder_minutes, created_at, updated_at, completed_at
         FROM tasks WHERE id = ?1",
        params![id],
        |row| {
            Ok(Task {
                id: row.get(0)?,
                title: row.get(1)?,
                description: row.get(2)?,
                goal_id: row.get(3)?,
                project_id: row.get(4)?,
                category_id: row.get(5)?,
                scheduled_date: row.get(6)?,
                start_time: row.get(7)?,
                end_time: row.get(8)?,
                priority: row.get(9)?,
                status: row.get(10)?,
                is_recurring: row.get::<_, i32>(11)? != 0,
                recurrence_rule: row.get(12)?,
                reminder_enabled: row.get::<_, i32>(13)? != 0,
                reminder_minutes: row.get(14)?,
                created_at: row.get(15)?,
                updated_at: row.get(16)?,
                completed_at: row.get(17)?,
            })
        },
    )
}

pub fn get_all_tasks(conn: &Connection) -> Result<Vec<Task>> {
    let mut stmt = conn.prepare(
        "SELECT id, title, description, goal_id, project_id, category_id, scheduled_date, start_time, end_time, priority, status, is_recurring, recurrence_rule, reminder_enabled, reminder_minutes, created_at, updated_at, completed_at
         FROM tasks ORDER BY 
            CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END,
            scheduled_date ASC"
    )?;

    let tasks = stmt.query_map([], |row| {
        Ok(Task {
            id: row.get(0)?,
            title: row.get(1)?,
            description: row.get(2)?,
            goal_id: row.get(3)?,
            project_id: row.get(4)?,
            category_id: row.get(5)?,
            scheduled_date: row.get(6)?,
            start_time: row.get(7)?,
            end_time: row.get(8)?,
            priority: row.get(9)?,
            status: row.get(10)?,
            is_recurring: row.get::<_, i32>(11)? != 0,
            recurrence_rule: row.get(12)?,
            reminder_enabled: row.get::<_, i32>(13)? != 0,
            reminder_minutes: row.get(14)?,
            created_at: row.get(15)?,
            updated_at: row.get(16)?,
            completed_at: row.get(17)?,
        })
    })?.collect::<Result<Vec<_>>>()?;

    Ok(tasks)
}

pub fn get_tasks_by_date(conn: &Connection, date: &str) -> Result<Vec<Task>> {
    let mut stmt = conn.prepare(
        "SELECT id, title, description, goal_id, project_id, category_id, scheduled_date, start_time, end_time, priority, status, is_recurring, recurrence_rule, reminder_enabled, reminder_minutes, created_at, updated_at, completed_at
         FROM tasks WHERE scheduled_date = ?1
         ORDER BY start_time ASC, 
            CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END"
    )?;

    let tasks = stmt.query_map(params![date], |row| {
        Ok(Task {
            id: row.get(0)?,
            title: row.get(1)?,
            description: row.get(2)?,
            goal_id: row.get(3)?,
            project_id: row.get(4)?,
            category_id: row.get(5)?,
            scheduled_date: row.get(6)?,
            start_time: row.get(7)?,
            end_time: row.get(8)?,
            priority: row.get(9)?,
            status: row.get(10)?,
            is_recurring: row.get::<_, i32>(11)? != 0,
            recurrence_rule: row.get(12)?,
            reminder_enabled: row.get::<_, i32>(13)? != 0,
            reminder_minutes: row.get(14)?,
            created_at: row.get(15)?,
            updated_at: row.get(16)?,
            completed_at: row.get(17)?,
        })
    })?.collect::<Result<Vec<_>>>()?;

    Ok(tasks)
}

pub fn update_task(conn: &Connection, req: UpdateTaskRequest) -> Result<Task> {
    let _current = get_task_by_id(conn, &req.id)?;
    let category_action = match req.category_id.as_deref() {
        None => "keep".to_string(),
        Some("") => "clear".to_string(),
        Some(id) => format!("set:{}", id),
    };

    conn.execute(
        "UPDATE tasks SET
            title = COALESCE(?1, title),
            description = COALESCE(?2, description),
            goal_id = COALESCE(?3, goal_id),
            project_id = COALESCE(?4, project_id),
            category_id = CASE
                WHEN ?5 = 'keep' THEN category_id
                WHEN ?5 = 'clear' THEN NULL
                ELSE substr(?5, 5)
            END,
            scheduled_date = COALESCE(?6, scheduled_date),
            start_time = COALESCE(?7, start_time),
            end_time = COALESCE(?8, end_time),
            priority = COALESCE(?9, priority),
            status = COALESCE(?10, status),
            is_recurring = COALESCE(?11, is_recurring),
            recurrence_rule = COALESCE(?12, recurrence_rule),
            reminder_enabled = COALESCE(?13, reminder_enabled),
            reminder_minutes = COALESCE(?14, reminder_minutes),
            updated_at = datetime('now')
         WHERE id = ?15",
        params![
            req.title, req.description, req.goal_id, req.project_id,
            category_action, req.scheduled_date, req.start_time, req.end_time,
            req.priority, req.status,
            req.is_recurring.map(|v| v as i32),
            req.recurrence_rule,
            req.reminder_enabled.map(|v| v as i32),
            req.reminder_minutes,
            req.id
        ],
    )?;

    get_task_by_id(conn, &req.id)
}

pub fn complete_task(conn: &Connection, id: &str) -> Result<Task> {
    conn.execute(
        "UPDATE tasks SET status = 'completed', completed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?1",
        params![id],
    )?;
    get_task_by_id(conn, id)
}

pub fn uncomplete_task(conn: &Connection, id: &str) -> Result<Task> {
    conn.execute(
        "UPDATE tasks SET status = 'todo', completed_at = NULL, updated_at = datetime('now') WHERE id = ?1",
        params![id],
    )?;
    get_task_by_id(conn, id)
}

pub fn delete_task(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("DELETE FROM tasks WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn duplicate_task(conn: &Connection, id: &str) -> Result<Task> {
    let original = get_task_by_id(conn, id)?;
    let new_id = Uuid::new_v4().to_string();
    
    conn.execute(
        "INSERT INTO tasks (id, title, description, goal_id, project_id, category_id, scheduled_date, start_time, end_time, priority, status, is_recurring, recurrence_rule, reminder_enabled, reminder_minutes)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 'todo', ?11, ?12, ?13, ?14)",
        params![
            new_id, original.title, original.description, original.goal_id,
            original.project_id, original.category_id, original.scheduled_date,
            original.start_time, original.end_time, original.priority,
            original.is_recurring as i32, original.recurrence_rule,
            original.reminder_enabled as i32, original.reminder_minutes
        ],
    )?;

    get_task_by_id(conn, &new_id)
}

// Goals
fn goal_cols() -> &'static str {
    "id, title, description, type, start_date, end_date, status, color, category_id, recurrence_rule, created_at, updated_at"
}

fn map_goal(row: &rusqlite::Row) -> Result<Goal> {
    Ok(Goal {
        id: row.get(0)?,
        title: row.get(1)?,
        description: row.get(2)?,
        goal_type: row.get(3)?,
        start_date: row.get(4)?,
        end_date: row.get(5)?,
        status: row.get(6)?,
        color: row.get(7)?,
        category_id: row.get(8)?,
        recurrence_rule: row.get(9)?,
        created_at: row.get(10)?,
        updated_at: row.get(11)?,
    })
}

pub fn create_goal(conn: &Connection, req: CreateGoalRequest) -> Result<Goal> {
    let id = Uuid::new_v4().to_string();
    let color = req.color.unwrap_or_else(|| "#8083ff".to_string());
    let category_id = req.category_id.filter(|s| !s.is_empty());

    conn.execute(
        "INSERT INTO goals (id, title, description, type, start_date, end_date, color, category_id, recurrence_rule)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![id, req.title, req.description, req.goal_type, req.start_date, req.end_date, color, category_id, req.recurrence_rule],
    )?;

    get_goal_by_id(conn, &id)
}

pub fn get_goal_by_id(conn: &Connection, id: &str) -> Result<Goal> {
    let sql = format!("SELECT {} FROM goals WHERE id = ?1", goal_cols());
    conn.query_row(&sql, params![id], map_goal)
}

pub fn get_all_goals(conn: &Connection) -> Result<Vec<Goal>> {
    let sql = format!("SELECT {} FROM goals WHERE status != 'archived' ORDER BY created_at DESC", goal_cols());
    let mut stmt = conn.prepare(&sql)?;
    let goals = stmt.query_map([], map_goal)?.collect::<Result<Vec<_>>>()?;
    Ok(goals)
}

pub fn update_goal(conn: &Connection, req: UpdateGoalRequest) -> Result<Goal> {
    let _current = get_goal_by_id(conn, &req.id)?;
    let category_action = match req.category_id.as_deref() {
        None => "keep".to_string(),
        Some("") => "clear".to_string(),
        Some(id) => format!("set:{}", id),
    };

    conn.execute(
        "UPDATE goals SET
            title = COALESCE(?1, title),
            description = COALESCE(?2, description),
            type = COALESCE(?3, type),
            start_date = COALESCE(?4, start_date),
            end_date = COALESCE(?5, end_date),
            status = COALESCE(?6, status),
            color = COALESCE(?7, color),
            category_id = CASE
                WHEN ?8 = 'keep' THEN category_id
                WHEN ?8 = 'clear' THEN NULL
                ELSE substr(?8, 5)
            END,
            recurrence_rule = COALESCE(?9, recurrence_rule),
            updated_at = datetime('now')
         WHERE id = ?10",
        params![
            req.title, req.description, req.goal_type,
            req.start_date, req.end_date, req.status, req.color,
            category_action,
            req.recurrence_rule,
            req.id
        ],
    )?;

    get_goal_by_id(conn, &req.id)
}

pub fn delete_goal(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("UPDATE tasks SET goal_id = NULL WHERE goal_id = ?1", params![id])?;
    conn.execute("UPDATE projects SET goal_id = NULL WHERE goal_id = ?1", params![id])?;
    conn.execute("DELETE FROM goals WHERE id = ?1", params![id])?;
    Ok(())
}

// Projects
fn project_cols() -> &'static str {
    "id, goal_id, name, description, color, status, category_id, created_at, updated_at"
}

fn map_project(row: &rusqlite::Row) -> Result<Project> {
    Ok(Project {
        id: row.get(0)?,
        goal_id: row.get(1)?,
        name: row.get(2)?,
        description: row.get(3)?,
        color: row.get(4)?,
        status: row.get(5)?,
        category_id: row.get(6)?,
        created_at: row.get(7)?,
        updated_at: row.get(8)?,
    })
}

pub fn create_project(conn: &Connection, req: CreateProjectRequest) -> Result<Project> {
    let id = Uuid::new_v4().to_string();
    let color = req.color.unwrap_or_else(|| "#6f00be".to_string());
    let category_id = req.category_id.filter(|s| !s.is_empty());

    conn.execute(
        "INSERT INTO projects (id, goal_id, name, description, color, category_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![id, req.goal_id, req.name, req.description, color, category_id],
    )?;

    get_project_by_id(conn, &id)
}

pub fn get_project_by_id(conn: &Connection, id: &str) -> Result<Project> {
    let sql = format!("SELECT {} FROM projects WHERE id = ?1", project_cols());
    conn.query_row(&sql, params![id], map_project)
}

pub fn get_all_projects(conn: &Connection) -> Result<Vec<Project>> {
    let sql = format!("SELECT {} FROM projects WHERE status != 'archived' ORDER BY created_at DESC", project_cols());
    let mut stmt = conn.prepare(&sql)?;
    let projects = stmt.query_map([], map_project)?.collect::<Result<Vec<_>>>()?;
    Ok(projects)
}

pub fn update_project(conn: &Connection, req: UpdateProjectRequest) -> Result<Project> {
    let _current = get_project_by_id(conn, &req.id)?;
    let category_action = match req.category_id.as_deref() {
        None => "keep".to_string(),
        Some("") => "clear".to_string(),
        Some(id) => format!("set:{}", id),
    };

    conn.execute(
        "UPDATE projects SET
            goal_id = COALESCE(?1, goal_id),
            name = COALESCE(?2, name),
            description = COALESCE(?3, description),
            color = COALESCE(?4, color),
            status = COALESCE(?5, status),
            category_id = CASE
                WHEN ?6 = 'keep' THEN category_id
                WHEN ?6 = 'clear' THEN NULL
                ELSE substr(?6, 5)
            END,
            updated_at = datetime('now')
         WHERE id = ?7",
        params![req.goal_id, req.name, req.description, req.color, req.status, category_action, req.id],
    )?;

    get_project_by_id(conn, &req.id)
}

pub fn delete_project(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("UPDATE tasks SET project_id = NULL WHERE project_id = ?1", params![id])?;
    conn.execute("DELETE FROM projects WHERE id = ?1", params![id])?;
    Ok(())
}

// Categories
pub fn create_category(conn: &Connection, req: CreateCategoryRequest) -> Result<Category> {
    let id = Uuid::new_v4().to_string();
    let color = req.color.unwrap_or_else(|| "#8083ff".to_string());
    let icon = req.icon.unwrap_or_else(|| "folder".to_string());
    let sort_order = req.sort_order.unwrap_or(0);

    conn.execute(
        "INSERT INTO categories (id, name, color, icon, sort_order)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![id, req.name, color, icon, sort_order],
    )?;

    get_category_by_id(conn, &id)
}

pub fn get_category_by_id(conn: &Connection, id: &str) -> Result<Category> {
    conn.query_row(
        "SELECT id, name, color, icon, sort_order, created_at, updated_at
         FROM categories WHERE id = ?1",
        params![id],
        |row| {
            Ok(Category {
                id: row.get(0)?,
                name: row.get(1)?,
                color: row.get(2)?,
                icon: row.get(3)?,
                sort_order: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        },
    )
}

pub fn get_all_categories(conn: &Connection) -> Result<Vec<Category>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, color, icon, sort_order, created_at, updated_at
         FROM categories ORDER BY sort_order ASC"
    )?;

    let categories = stmt.query_map([], |row| {
        Ok(Category {
            id: row.get(0)?,
            name: row.get(1)?,
            color: row.get(2)?,
            icon: row.get(3)?,
            sort_order: row.get(4)?,
            created_at: row.get(5)?,
            updated_at: row.get(6)?,
        })
    })?.collect::<Result<Vec<_>>>()?;

    Ok(categories)
}

pub fn delete_category(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("UPDATE tasks SET category_id = NULL WHERE category_id = ?1", params![id])?;
    conn.execute("UPDATE goals SET category_id = NULL WHERE category_id = ?1", params![id])?;
    conn.execute("UPDATE projects SET category_id = NULL WHERE category_id = ?1", params![id])?;
    conn.execute("DELETE FROM categories WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn update_category(conn: &Connection, req: UpdateCategoryRequest) -> Result<Category> {
    conn.execute(
        "UPDATE categories SET
            name = COALESCE(?2, name),
            color = COALESCE(?3, color),
            icon = COALESCE(?4, icon),
            sort_order = COALESCE(?5, sort_order),
            updated_at = datetime('now')
         WHERE id = ?1",
        params![req.id, req.name, req.color, req.icon, req.sort_order],
    )?;

    get_category_by_id(conn, &req.id)
}

// Meetings
const MEETING_COLS: &str = "id, title, description, date, start_time, end_time, meeting_url, timezone, external_provider, external_id, passcode, calendar_event_id, calendar_id, calendar_connection_id, participants, meeting_status, provider_metadata, reminder_enabled, reminder_minutes, reminder_offsets, is_recurring, recurrence_rule, created_at, updated_at";

fn parse_offsets(json: Option<String>) -> Option<Vec<i32>> {
    json.and_then(|s| serde_json::from_str(&s).ok())
}

fn serialize_offsets(offsets: Option<Vec<i32>>) -> Option<String> {
    offsets.map(|v| serde_json::to_string(&v).unwrap_or_else(|_| "[]".to_string()))
}

fn parse_string_list(json: Option<String>) -> Option<Vec<String>> {
    json.and_then(|s| serde_json::from_str(&s).ok())
}

fn parse_json_value(json: Option<String>) -> Option<serde_json::Value> {
    json.and_then(|s| serde_json::from_str(&s).ok())
}

fn map_meeting(row: &rusqlite::Row) -> Result<Meeting> {
    let external_provider: Option<String> = row.get(8)?;
    let participants_json: Option<String> = row.get(14)?;
    let metadata_json: Option<String> = row.get(16)?;
    let offsets_json: Option<String> = row.get(19)?;
    Ok(Meeting {
        id: row.get(0)?,
        title: row.get(1)?,
        description: row.get(2)?,
        date: row.get(3)?,
        start_time: row.get(4)?,
        end_time: row.get(5)?,
        meeting_url: row.get(6)?,
        timezone: row.get(7)?,
        external_provider: external_provider
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| "none".to_string()),
        external_id: row.get(9)?,
        passcode: row.get(10)?,
        calendar_event_id: row.get(11)?,
        calendar_id: row.get(12)?,
        calendar_connection_id: row.get(13)?,
        participants: parse_string_list(participants_json),
        meeting_status: row
            .get::<_, Option<String>>(15)?
            .unwrap_or_else(|| "confirmed".to_string()),
        provider_metadata: parse_json_value(metadata_json),
        reminder_enabled: row.get::<_, i32>(17)? != 0,
        reminder_minutes: row.get(18)?,
        reminder_offsets: parse_offsets(offsets_json),
        is_recurring: row.get::<_, i32>(20)? != 0,
        recurrence_rule: row.get(21)?,
        created_at: row.get(22)?,
        updated_at: row.get(23)?,
    })
}

pub fn create_meeting(conn: &Connection, req: CreateMeetingRequest) -> Result<Meeting> {
    let id = Uuid::new_v4().to_string();
    let reminder_enabled = req.reminder_enabled.unwrap_or(false) as i32;
    let is_recurring = req.is_recurring.unwrap_or(false) as i32;
    let offsets = req.reminder_offsets.map(|mut v| {
        v.retain(|x| MEETING_REMINDER_OPTIONS.contains(x));
        v.truncate(3);
        v
    });
    let offsets_json = serialize_offsets(offsets);
    let external_provider = req.external_provider.unwrap_or_else(|| "none".to_string());
    let meeting_status = req.meeting_status.unwrap_or_else(|| "confirmed".to_string());
    let participants_json = req
        .participants
        .map(|participants| serde_json::to_string(&participants).unwrap_or_else(|_| "[]".to_string()));
    let provider_metadata_json = req
        .provider_metadata
        .map(|metadata| serde_json::to_string(&metadata).unwrap_or_else(|_| "{}".to_string()));

    conn.execute(
        "INSERT INTO meetings (
            id, title, description, date, start_time, end_time, meeting_url,
            timezone, external_provider, external_id, passcode, calendar_event_id,
            calendar_id, calendar_connection_id, participants, meeting_status,
            provider_metadata, reminder_enabled, reminder_minutes, reminder_offsets,
            is_recurring, recurrence_rule
         )
         VALUES (
            ?1, ?2, ?3, ?4, ?5, ?6, ?7,
            ?8, ?9, ?10, ?11, ?12,
            ?13, ?14, ?15, ?16,
            ?17, ?18, ?19, ?20,
            ?21, ?22
         )",
        params![
            id,
            req.title,
            req.description,
            req.date,
            req.start_time,
            req.end_time,
            req.meeting_url,
            req.timezone,
            external_provider,
            req.external_id,
            req.passcode,
            req.calendar_event_id,
            req.calendar_id,
            req.calendar_connection_id,
            participants_json,
            meeting_status,
            provider_metadata_json,
            reminder_enabled,
            req.reminder_minutes,
            offsets_json,
            is_recurring,
            req.recurrence_rule
        ],
    )?;

    get_meeting_by_id(conn, &id)
}

pub fn get_meeting_by_id(conn: &Connection, id: &str) -> Result<Meeting> {
    let sql = format!("SELECT {} FROM meetings WHERE id = ?1", MEETING_COLS);
    conn.query_row(&sql, params![id], map_meeting)
}

pub fn get_all_meetings(conn: &Connection) -> Result<Vec<Meeting>> {
    let sql = format!("SELECT {} FROM meetings ORDER BY date ASC, start_time ASC", MEETING_COLS);
    let mut stmt = conn.prepare(&sql)?;
    let meetings = stmt.query_map([], map_meeting)?.collect::<Result<Vec<_>>>()?;
    Ok(meetings)
}

pub fn get_meetings_by_date(conn: &Connection, date: &str) -> Result<Vec<Meeting>> {
    let sql = format!("SELECT {} FROM meetings WHERE date = ?1 ORDER BY start_time ASC", MEETING_COLS);
    let mut stmt = conn.prepare(&sql)?;
    let meetings = stmt.query_map(params![date], map_meeting)?.collect::<Result<Vec<_>>>()?;
    Ok(meetings)
}

pub fn update_meeting(conn: &Connection, req: UpdateMeetingRequest) -> Result<Meeting> {
    let _current = get_meeting_by_id(conn, &req.id)?;
    let offsets_action = match &req.reminder_offsets {
        None => "keep".to_string(),
        Some(v) => {
            let mut cleaned: Vec<i32> = v.iter().copied().filter(|x| MEETING_REMINDER_OPTIONS.contains(x)).collect();
            cleaned.truncate(3);
            format!("set:{}", serde_json::to_string(&cleaned).unwrap_or_else(|_| "[]".to_string()))
        }
    };

    let participants_json = req
        .participants
        .map(|participants| serde_json::to_string(&participants).unwrap_or_else(|_| "[]".to_string()));
    let provider_metadata_json = req
        .provider_metadata
        .map(|metadata| serde_json::to_string(&metadata).unwrap_or_else(|_| "{}".to_string()));

    conn.execute(
        "UPDATE meetings SET
            title = COALESCE(?1, title),
            description = COALESCE(?2, description),
            date = COALESCE(?3, date),
            start_time = COALESCE(?4, start_time),
            end_time = COALESCE(?5, end_time),
            meeting_url = COALESCE(?6, meeting_url),
            timezone = COALESCE(?7, timezone),
            external_provider = COALESCE(?8, external_provider),
            external_id = COALESCE(?9, external_id),
            passcode = COALESCE(?10, passcode),
            calendar_event_id = COALESCE(?11, calendar_event_id),
            calendar_id = COALESCE(?12, calendar_id),
            calendar_connection_id = COALESCE(?13, calendar_connection_id),
            participants = COALESCE(?14, participants),
            meeting_status = COALESCE(?15, meeting_status),
            provider_metadata = COALESCE(?16, provider_metadata),
            reminder_enabled = COALESCE(?17, reminder_enabled),
            reminder_minutes = COALESCE(?18, reminder_minutes),
            reminder_offsets = CASE
                WHEN ?19 = 'keep' THEN reminder_offsets
                WHEN ?19 = 'set:[]' THEN NULL
                ELSE substr(?19, 5)
            END,
            is_recurring = COALESCE(?20, is_recurring),
            recurrence_rule = COALESCE(?21, recurrence_rule),
            updated_at = datetime('now')
         WHERE id = ?22",
        params![
            req.title,
            req.description,
            req.date,
            req.start_time,
            req.end_time,
            req.meeting_url,
            req.timezone,
            req.external_provider,
            req.external_id,
            req.passcode,
            req.calendar_event_id,
            req.calendar_id,
            req.calendar_connection_id,
            participants_json,
            req.meeting_status,
            provider_metadata_json,
            req.reminder_enabled.map(|v| v as i32),
            req.reminder_minutes,
            offsets_action,
            req.is_recurring.map(|v| v as i32),
            req.recurrence_rule,
            req.id
        ],
    )?;

    get_meeting_by_id(conn, &req.id)
}

pub fn delete_meeting(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("DELETE FROM meetings WHERE id = ?1", params![id])?;
    Ok(())
}

// Search
pub fn search_all(conn: &Connection, query: &str) -> Result<(Vec<Task>, Vec<Goal>, Vec<Project>, Vec<Meeting>, Vec<Category>)> {
    let like_query = format!("%{}%", query);
    
    let mut task_stmt = conn.prepare(
        "SELECT id, title, description, goal_id, project_id, category_id, scheduled_date, start_time, end_time, priority, status, is_recurring, recurrence_rule, reminder_enabled, reminder_minutes, created_at, updated_at, completed_at
         FROM tasks WHERE title LIKE ?1 OR description LIKE ?1"
    )?;
    let tasks = task_stmt.query_map(params![like_query], |row| {
        Ok(Task {
            id: row.get(0)?,
            title: row.get(1)?,
            description: row.get(2)?,
            goal_id: row.get(3)?,
            project_id: row.get(4)?,
            category_id: row.get(5)?,
            scheduled_date: row.get(6)?,
            start_time: row.get(7)?,
            end_time: row.get(8)?,
            priority: row.get(9)?,
            status: row.get(10)?,
            is_recurring: row.get::<_, i32>(11)? != 0,
            recurrence_rule: row.get(12)?,
            reminder_enabled: row.get::<_, i32>(13)? != 0,
            reminder_minutes: row.get(14)?,
            created_at: row.get(15)?,
            updated_at: row.get(16)?,
            completed_at: row.get(17)?,
        })
    })?.collect::<Result<Vec<_>>>()?;

    let mut goal_stmt = conn.prepare(&format!(
        "SELECT {} FROM goals WHERE title LIKE ?1 OR description LIKE ?1",
        goal_cols()
    ))?;
    let goals = goal_stmt.query_map(params![like_query], map_goal)?.collect::<Result<Vec<_>>>()?;

    let mut project_stmt = conn.prepare(&format!(
        "SELECT {} FROM projects WHERE name LIKE ?1 OR description LIKE ?1",
        project_cols()
    ))?;
    let projects = project_stmt.query_map(params![like_query], map_project)?.collect::<Result<Vec<_>>>()?;

    let mut meeting_stmt = conn.prepare(&format!(
        "SELECT {} FROM meetings WHERE title LIKE ?1 OR description LIKE ?1",
        MEETING_COLS
    ))?;
    let meetings = meeting_stmt.query_map(params![like_query], map_meeting)?.collect::<Result<Vec<_>>>()?;

    let mut cat_stmt = conn.prepare(
        "SELECT id, name, color, icon, sort_order, created_at, updated_at
         FROM categories WHERE name LIKE ?1"
    )?;
    let categories = cat_stmt.query_map(params![like_query], |row| {
        Ok(Category {
            id: row.get(0)?,
            name: row.get(1)?,
            color: row.get(2)?,
            icon: row.get(3)?,
            sort_order: row.get(4)?,
            created_at: row.get(5)?,
            updated_at: row.get(6)?,
        })
    })?.collect::<Result<Vec<_>>>()?;

    Ok((tasks, goals, projects, meetings, categories))
}

// Settings
pub fn get_setting(conn: &Connection, key: &str) -> Result<Option<String>> {
    let result = conn.query_row(
        "SELECT value FROM settings WHERE key = ?1",
        params![key],
        |row| row.get::<_, String>(0),
    );
    
    match result {
        Ok(value) => Ok(Some(value)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e),
    }
}

pub fn set_setting(conn: &Connection, key: &str, value: &str) -> Result<()> {
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?1, ?2, datetime('now'))",
        params![key, value],
    )?;
    Ok(())
}

// Stats
pub fn get_task_stats(conn: &Connection) -> Result<(i64, i64, i64, i64)> {
    let total: i64 = conn.query_row("SELECT COUNT(*) FROM tasks", [], |row| row.get(0))?;
    let completed: i64 = conn.query_row("SELECT COUNT(*) FROM tasks WHERE status = 'completed'", [], |row| row.get(0))?;
    let in_progress: i64 = conn.query_row("SELECT COUNT(*) FROM tasks WHERE status = 'in_progress'", [], |row| row.get(0))?;
    let overdue: i64 = conn.query_row(
        "SELECT COUNT(*) FROM tasks WHERE scheduled_date < date('now') AND status NOT IN ('completed', 'cancelled')",
        [],
        |row| row.get(0),
    )?;
    
    Ok((total, completed, in_progress, overdue))
}

pub fn get_tasks_for_date_range(conn: &Connection, start: &str, end: &str) -> Result<Vec<Task>> {
    let mut stmt = conn.prepare(
        "SELECT id, title, description, goal_id, project_id, category_id, scheduled_date, start_time, end_time, priority, status, is_recurring, recurrence_rule, reminder_enabled, reminder_minutes, created_at, updated_at, completed_at
         FROM tasks WHERE scheduled_date >= ?1 AND scheduled_date <= ?2
         ORDER BY scheduled_date ASC, start_time ASC"
    )?;

    let tasks = stmt.query_map(params![start, end], |row| {
        Ok(Task {
            id: row.get(0)?,
            title: row.get(1)?,
            description: row.get(2)?,
            goal_id: row.get(3)?,
            project_id: row.get(4)?,
            category_id: row.get(5)?,
            scheduled_date: row.get(6)?,
            start_time: row.get(7)?,
            end_time: row.get(8)?,
            priority: row.get(9)?,
            status: row.get(10)?,
            is_recurring: row.get::<_, i32>(11)? != 0,
            recurrence_rule: row.get(12)?,
            reminder_enabled: row.get::<_, i32>(13)? != 0,
            reminder_minutes: row.get(14)?,
            created_at: row.get(15)?,
            updated_at: row.get(16)?,
            completed_at: row.get(17)?,
        })
    })?.collect::<Result<Vec<_>>>()?;

    Ok(tasks)
}

pub fn get_meetings_for_date_range(conn: &Connection, start: &str, end: &str) -> Result<Vec<Meeting>> {
    let sql = format!(
        "SELECT {} FROM meetings WHERE date >= ?1 AND date <= ?2 ORDER BY date ASC, start_time ASC",
        MEETING_COLS
    );
    let mut stmt = conn.prepare(&sql)?;
    let meetings = stmt.query_map(params![start, end], map_meeting)?.collect::<Result<Vec<_>>>()?;
    Ok(meetings)
}

// Routines
fn map_routine(row: &rusqlite::Row) -> Result<Routine> {
    Ok(Routine {
        id: row.get(0)?,
        name: row.get(1)?,
        start_time: row.get(2)?,
        days: row.get(3)?,
        reminder_enabled: row.get::<_, i32>(4)? != 0,
        reminder_minutes: row.get(5)?,
        created_at: row.get(6)?,
        updated_at: row.get(7)?,
    })
}

fn map_routine_task(row: &rusqlite::Row) -> Result<RoutineTask> {
    Ok(RoutineTask {
        id: row.get(0)?,
        routine_id: row.get(1)?,
        title: row.get(2)?,
        duration_minutes: row.get(3)?,
        sort_order: row.get(4)?,
        created_at: row.get(5)?,
    })
}

fn map_planner_entry(row: &rusqlite::Row) -> Result<PlannerEntry> {
    Ok(PlannerEntry {
        id: row.get(0)?,
        kind: row.get(1)?,
        bucket: row.get(2)?,
        title: row.get(3)?,
        notes: row.get(4)?,
        start_time: row.get(5)?,
        sort_order: row.get(6)?,
        created_at: row.get(7)?,
        updated_at: row.get(8)?,
    })
}

fn map_planner_template(row: &rusqlite::Row) -> Result<PlannerTemplate> {
    Ok(PlannerTemplate {
        id: row.get(0)?,
        kind: row.get(1)?,
        name: row.get(2)?,
        payload: row.get(3)?,
        created_at: row.get(4)?,
    })
}

const ROUTINE_COLS: &str = "id, name, start_time, days, reminder_enabled, reminder_minutes, created_at, updated_at";
const ROUTINE_TASK_COLS: &str = "id, routine_id, title, duration_minutes, sort_order, created_at";
const PLANNER_ENTRY_COLS: &str = "id, kind, bucket, title, notes, start_time, sort_order, created_at, updated_at";
const PLANNER_TEMPLATE_COLS: &str = "id, kind, name, payload, created_at";

pub fn create_routine(conn: &Connection, req: CreateRoutineRequest) -> Result<Routine> {
    let id = Uuid::new_v4().to_string();
    let days = req.days.unwrap_or_else(|| "1,2,3,4,5".to_string());
    let reminder_enabled = req.reminder_enabled.unwrap_or(false) as i32;

    conn.execute(
        "INSERT INTO routines (id, name, start_time, days, reminder_enabled, reminder_minutes)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![id, req.name, req.start_time, days, reminder_enabled, req.reminder_minutes],
    )?;

    get_routine_by_id(conn, &id)
}

pub fn get_routine_by_id(conn: &Connection, id: &str) -> Result<Routine> {
    let sql = format!("SELECT {} FROM routines WHERE id = ?1", ROUTINE_COLS);
    conn.query_row(&sql, params![id], map_routine)
}

pub fn get_all_routines(conn: &Connection) -> Result<Vec<Routine>> {
    let sql = format!("SELECT {} FROM routines ORDER BY created_at DESC", ROUTINE_COLS);
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map([], map_routine)?;
    rows.collect()
}

pub fn update_routine(conn: &Connection, req: UpdateRoutineRequest) -> Result<Routine> {
    let _ = get_routine_by_id(conn, &req.id)?;
    conn.execute(
        "UPDATE routines SET
            name = COALESCE(?1, name),
            start_time = COALESCE(?2, start_time),
            days = COALESCE(?3, days),
            reminder_enabled = COALESCE(?4, reminder_enabled),
            reminder_minutes = COALESCE(?5, reminder_minutes),
            updated_at = datetime('now')
         WHERE id = ?6",
        params![
            req.name, req.start_time, req.days,
            req.reminder_enabled.map(|v| v as i32),
            req.reminder_minutes,
            req.id
        ],
    )?;
    get_routine_by_id(conn, &req.id)
}

pub fn delete_routine(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("DELETE FROM routine_tasks WHERE routine_id = ?1", params![id])?;
    conn.execute("DELETE FROM routines WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn create_routine_task(conn: &Connection, req: CreateRoutineTaskRequest) -> Result<RoutineTask> {
    let id = Uuid::new_v4().to_string();
    let sort_order = req.sort_order.unwrap_or(0);

    conn.execute(
        "INSERT INTO routine_tasks (id, routine_id, title, duration_minutes, sort_order)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![id, req.routine_id, req.title, req.duration_minutes, sort_order],
    )?;

    get_routine_task_by_id(conn, &id)
}

pub fn get_routine_task_by_id(conn: &Connection, id: &str) -> Result<RoutineTask> {
    let sql = format!("SELECT {} FROM routine_tasks WHERE id = ?1", ROUTINE_TASK_COLS);
    conn.query_row(&sql, params![id], map_routine_task)
}

pub fn get_routine_tasks(conn: &Connection, routine_id: &str) -> Result<Vec<RoutineTask>> {
    let sql = format!(
        "SELECT {} FROM routine_tasks WHERE routine_id = ?1 ORDER BY sort_order ASC, created_at ASC",
        ROUTINE_TASK_COLS
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(params![routine_id], map_routine_task)?;
    rows.collect()
}

pub fn get_all_routine_tasks(conn: &Connection) -> Result<Vec<RoutineTask>> {
    let sql = format!(
        "SELECT {} FROM routine_tasks ORDER BY routine_id, sort_order ASC, created_at ASC",
        ROUTINE_TASK_COLS
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map([], map_routine_task)?;
    rows.collect()
}

pub fn update_routine_task(conn: &Connection, req: UpdateRoutineTaskRequest) -> Result<RoutineTask> {
    let _ = get_routine_task_by_id(conn, &req.id)?;
    conn.execute(
        "UPDATE routine_tasks SET
            title = COALESCE(?1, title),
            duration_minutes = COALESCE(?2, duration_minutes),
            sort_order = COALESCE(?3, sort_order)
         WHERE id = ?4",
        params![req.title, req.duration_minutes, req.sort_order, req.id],
    )?;
    get_routine_task_by_id(conn, &req.id)
}

pub fn delete_routine_task(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("DELETE FROM routine_tasks WHERE id = ?1", params![id])?;
    Ok(())
}

// Planners
pub fn create_planner_entry(conn: &Connection, req: CreatePlannerEntryRequest) -> Result<PlannerEntry> {
    let id = Uuid::new_v4().to_string();
    let sort_order = req.sort_order.unwrap_or(0);

    conn.execute(
        "INSERT INTO planner_entries (id, kind, bucket, title, notes, start_time, sort_order)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![id, req.kind, req.bucket, req.title, req.notes, req.start_time, sort_order],
    )?;

    get_planner_entry_by_id(conn, &id)
}

pub fn get_planner_entry_by_id(conn: &Connection, id: &str) -> Result<PlannerEntry> {
    let sql = format!("SELECT {} FROM planner_entries WHERE id = ?1", PLANNER_ENTRY_COLS);
    conn.query_row(&sql, params![id], map_planner_entry)
}

pub fn get_planner_entries(conn: &Connection, kind: &str) -> Result<Vec<PlannerEntry>> {
    let sql = format!(
        "SELECT {} FROM planner_entries WHERE kind = ?1 ORDER BY bucket ASC, sort_order ASC, created_at ASC",
        PLANNER_ENTRY_COLS
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(params![kind], map_planner_entry)?;
    rows.collect()
}

pub fn update_planner_entry(conn: &Connection, req: UpdatePlannerEntryRequest) -> Result<PlannerEntry> {
    let _ = get_planner_entry_by_id(conn, &req.id)?;
    conn.execute(
        "UPDATE planner_entries SET
            title = COALESCE(?1, title),
            notes = COALESCE(?2, notes),
            start_time = COALESCE(?3, start_time),
            sort_order = COALESCE(?4, sort_order),
            updated_at = datetime('now')
         WHERE id = ?5",
        params![req.title, req.notes, req.start_time, req.sort_order, req.id],
    )?;
    get_planner_entry_by_id(conn, &req.id)
}

pub fn delete_planner_entry(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("DELETE FROM planner_entries WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn create_planner_template(conn: &Connection, req: CreatePlannerTemplateRequest) -> Result<PlannerTemplate> {
    let id = Uuid::new_v4().to_string();

    conn.execute(
        "INSERT INTO planner_templates (id, kind, name, payload) VALUES (?1, ?2, ?3, ?4)",
        params![id, req.kind, req.name, req.payload],
    )?;

    let sql = format!("SELECT {} FROM planner_templates WHERE id = ?1", PLANNER_TEMPLATE_COLS);
    conn.query_row(&sql, params![id], map_planner_template)
}

pub fn get_planner_templates(conn: &Connection, kind: &str) -> Result<Vec<PlannerTemplate>> {
    let sql = format!(
        "SELECT {} FROM planner_templates WHERE kind = ?1 ORDER BY created_at DESC",
        PLANNER_TEMPLATE_COLS
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(params![kind], map_planner_template)?;
    rows.collect()
}

pub fn delete_planner_template(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("DELETE FROM planner_templates WHERE id = ?1", params![id])?;
    Ok(())
}

// Day templates (Plan my day)
const DAY_TEMPLATE_COLS: &str = "id, name, payload, created_at";

fn map_day_template(row: &rusqlite::Row) -> Result<DayTemplate> {
    Ok(DayTemplate {
        id: row.get(0)?,
        name: row.get(1)?,
        payload: row.get(2)?,
        created_at: row.get(3)?,
    })
}

pub fn create_day_template(conn: &Connection, req: CreateDayTemplateRequest) -> Result<DayTemplate> {
    let id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO day_templates (id, name, payload) VALUES (?1, ?2, ?3)",
        params![id, req.name, req.payload],
    )?;
    let sql = format!("SELECT {} FROM day_templates WHERE id = ?1", DAY_TEMPLATE_COLS);
    conn.query_row(&sql, params![id], map_day_template)
}

pub fn get_day_templates(conn: &Connection) -> Result<Vec<DayTemplate>> {
    let sql = format!("SELECT {} FROM day_templates ORDER BY created_at DESC", DAY_TEMPLATE_COLS);
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map([], map_day_template)?;
    rows.collect()
}

pub fn delete_day_template(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("DELETE FROM day_templates WHERE id = ?1", params![id])?;
    Ok(())
}

// Notes
const NOTE_FOLDER_COLS: &str = "id, name, created_at, updated_at";
const NOTE_COLS: &str = "id, title, content, folder_id, created_at, updated_at";

fn map_note_folder(row: &rusqlite::Row) -> Result<NoteFolder> {
    Ok(NoteFolder {
        id: row.get(0)?,
        name: row.get(1)?,
        created_at: row.get(2)?,
        updated_at: row.get(3)?,
    })
}

fn map_note(row: &rusqlite::Row) -> Result<Note> {
    Ok(Note {
        id: row.get(0)?,
        title: row.get(1)?,
        content: row.get(2)?,
        folder_id: row.get(3)?,
        created_at: row.get(4)?,
        updated_at: row.get(5)?,
    })
}

pub fn create_note_folder(conn: &Connection, req: CreateNoteFolderRequest) -> Result<NoteFolder> {
    let id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO note_folders (id, name) VALUES (?1, ?2)",
        params![id, req.name],
    )?;
    let sql = format!("SELECT {} FROM note_folders WHERE id = ?1", NOTE_FOLDER_COLS);
    conn.query_row(&sql, params![id], map_note_folder)
}

pub fn get_all_note_folders(conn: &Connection) -> Result<Vec<NoteFolder>> {
    let sql = format!("SELECT {} FROM note_folders ORDER BY name ASC", NOTE_FOLDER_COLS);
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map([], map_note_folder)?;
    rows.collect()
}

pub fn update_note_folder(conn: &Connection, req: UpdateNoteFolderRequest) -> Result<NoteFolder> {
    if let Some(name) = req.name {
        conn.execute(
            "UPDATE note_folders SET name = ?1, updated_at = datetime('now') WHERE id = ?2",
            params![name, req.id],
        )?;
    }
    let sql = format!("SELECT {} FROM note_folders WHERE id = ?1", NOTE_FOLDER_COLS);
    conn.query_row(&sql, params![req.id], map_note_folder)
}

pub fn delete_note_folder(conn: &Connection, id: &str) -> Result<()> {
    // Notes keep existing (FK ON DELETE SET NULL) — folder_id cleared by SQLite
    conn.execute("DELETE FROM note_folders WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn create_note(conn: &Connection, req: CreateNoteRequest) -> Result<Note> {
    let id = Uuid::new_v4().to_string();
    let title = req.title.unwrap_or_default();
    let content = req.content.unwrap_or_default();
    let folder_id = req.folder_id.filter(|s| !s.is_empty());
    conn.execute(
        "INSERT INTO notes (id, title, content, folder_id) VALUES (?1, ?2, ?3, ?4)",
        params![id, title, content, folder_id],
    )?;
    let sql = format!("SELECT {} FROM notes WHERE id = ?1", NOTE_COLS);
    conn.query_row(&sql, params![id], map_note)
}

pub fn get_all_notes(conn: &Connection) -> Result<Vec<Note>> {
    let sql = format!(
        "SELECT {} FROM notes ORDER BY updated_at DESC",
        NOTE_COLS
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map([], map_note)?;
    rows.collect()
}

pub fn get_notes_by_folder(conn: &Connection, folder_id: &str) -> Result<Vec<Note>> {
    let sql = format!(
        "SELECT {} FROM notes WHERE folder_id = ?1 ORDER BY updated_at DESC",
        NOTE_COLS
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(params![folder_id], map_note)?;
    rows.collect()
}

pub fn update_note(conn: &Connection, req: UpdateNoteRequest) -> Result<Note> {
    if let Some(title) = req.title {
        conn.execute(
            "UPDATE notes SET title = ?1, updated_at = datetime('now') WHERE id = ?2",
            params![title, req.id],
        )?;
    }
    if let Some(content) = req.content {
        conn.execute(
            "UPDATE notes SET content = ?1, updated_at = datetime('now') WHERE id = ?2",
            params![content, req.id],
        )?;
    }
    if let Some(folder_id) = req.folder_id {
        let fid: Option<String> = if folder_id.is_empty() {
            None
        } else {
            Some(folder_id)
        };
        conn.execute(
            "UPDATE notes SET folder_id = ?1, updated_at = datetime('now') WHERE id = ?2",
            params![fid, req.id],
        )?;
    }
    let sql = format!("SELECT {} FROM notes WHERE id = ?1", NOTE_COLS);
    conn.query_row(&sql, params![req.id], map_note)
}

pub fn delete_note(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("DELETE FROM notes WHERE id = ?1", params![id])?;
    Ok(())
}
