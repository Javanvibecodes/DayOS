pub mod models;
pub mod queries;

use rusqlite::{Connection, Result};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::AppHandle;
use tauri::Manager;

pub struct DbState {
    pub conn: Mutex<Connection>,
}

pub fn get_db_path(app: &AppHandle) -> PathBuf {
    let app_dir = app.path().app_data_dir().expect("failed to get app data dir");
    std::fs::create_dir_all(&app_dir).expect("failed to create app data dir");
    app_dir.join("dayos.db")
}

pub fn init_database(app: &AppHandle) -> Result<Connection> {
    let db_path = get_db_path(app);
    let conn = Connection::open(&db_path)?;
    
    conn.execute_batch("PRAGMA journal_mode=WAL;")?;
    conn.execute_batch("PRAGMA foreign_keys=ON;")?;
    
    create_tables(&conn)?;
    
    Ok(conn)
}

fn create_tables(conn: &Connection) -> Result<()> {
    conn.execute_batch("
        CREATE TABLE IF NOT EXISTS categories (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            color TEXT NOT NULL DEFAULT '#8083ff',
            icon TEXT NOT NULL DEFAULT 'folder',
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS goals (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT,
            type TEXT NOT NULL DEFAULT 'daily' CHECK(type IN ('daily', 'weekly', 'monthly')),
            start_date TEXT,
            end_date TEXT,
            status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'completed', 'archived')),
            color TEXT NOT NULL DEFAULT '#8083ff',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            goal_id TEXT,
            name TEXT NOT NULL,
            description TEXT,
            color TEXT NOT NULL DEFAULT '#6f00be',
            status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'completed', 'archived')),
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT,
            goal_id TEXT,
            project_id TEXT,
            category_id TEXT,
            scheduled_date TEXT,
            start_time TEXT,
            end_time TEXT,
            priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('critical', 'high', 'medium', 'low')),
            status TEXT NOT NULL DEFAULT 'todo' CHECK(status IN ('todo', 'in_progress', 'completed', 'cancelled')),
            is_recurring INTEGER NOT NULL DEFAULT 0,
            recurrence_rule TEXT,
            reminder_enabled INTEGER NOT NULL DEFAULT 0,
            reminder_minutes INTEGER,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            completed_at TEXT,
            FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE SET NULL,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
            FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS meetings (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT,
            date TEXT NOT NULL,
            start_time TEXT NOT NULL,
            end_time TEXT,
            meeting_url TEXT,
            reminder_enabled INTEGER NOT NULL DEFAULT 0,
            reminder_minutes INTEGER,
            is_recurring INTEGER NOT NULL DEFAULT 0,
            recurrence_rule TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS theme_preferences (
            id TEXT PRIMARY KEY DEFAULT 'current',
            theme_name TEXT NOT NULL DEFAULT 'midnight',
            color_mode TEXT NOT NULL DEFAULT 'dark' CHECK(color_mode IN ('light', 'dark', 'system')),
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS notification_jobs (
            id TEXT PRIMARY KEY,
            entity_type TEXT NOT NULL CHECK(entity_type IN ('task', 'meeting')),
            entity_id TEXT NOT NULL,
            scheduled_at TEXT NOT NULL,
            title TEXT NOT NULL,
            body TEXT NOT NULL,
            is_sent INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS routines (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            start_time TEXT,
            days TEXT NOT NULL DEFAULT '1,2,3,4,5',
            reminder_enabled INTEGER NOT NULL DEFAULT 0,
            reminder_minutes INTEGER,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS routine_tasks (
            id TEXT PRIMARY KEY,
            routine_id TEXT NOT NULL,
            title TEXT NOT NULL,
            duration_minutes INTEGER NOT NULL DEFAULT 5,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (routine_id) REFERENCES routines(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS planner_entries (
            id TEXT PRIMARY KEY,
            kind TEXT NOT NULL CHECK(kind IN ('day', 'week')),
            bucket TEXT NOT NULL,
            title TEXT NOT NULL,
            notes TEXT,
            start_time TEXT,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS planner_templates (
            id TEXT PRIMARY KEY,
            kind TEXT NOT NULL CHECK(kind IN ('day', 'week')),
            name TEXT NOT NULL,
            payload TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS day_templates (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            payload TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS note_folders (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS notes (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL DEFAULT '',
            content TEXT NOT NULL DEFAULT '',
            folder_id TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (folder_id) REFERENCES note_folders(id) ON DELETE SET NULL
        );
    ")?;

    // Guarded migration: add goals.recurrence_rule if missing
    let has_col: i64 = conn.query_row(
        "SELECT COUNT(*) FROM pragma_table_info('goals') WHERE name = 'recurrence_rule'",
        [],
        |row| row.get(0),
    )?;
    if has_col == 0 {
        conn.execute(
            "ALTER TABLE goals ADD COLUMN recurrence_rule TEXT",
            [],
        )?;
    }

    // Guarded migration: goals.category_id
    let has_col: i64 = conn.query_row(
        "SELECT COUNT(*) FROM pragma_table_info('goals') WHERE name = 'category_id'",
        [],
        |row| row.get(0),
    )?;
    if has_col == 0 {
        conn.execute(
            "ALTER TABLE goals ADD COLUMN category_id TEXT REFERENCES categories(id) ON DELETE SET NULL",
            [],
        )?;
    }

    // Guarded migration: projects.category_id
    let has_col: i64 = conn.query_row(
        "SELECT COUNT(*) FROM pragma_table_info('projects') WHERE name = 'category_id'",
        [],
        |row| row.get(0),
    )?;
    if has_col == 0 {
        conn.execute(
            "ALTER TABLE projects ADD COLUMN category_id TEXT REFERENCES categories(id) ON DELETE SET NULL",
            [],
        )?;
    }

    // Guarded migration: meetings.reminder_offsets (JSON array of minutes-before, max 3)
    let has_col: i64 = conn.query_row(
        "SELECT COUNT(*) FROM pragma_table_info('meetings') WHERE name = 'reminder_offsets'",
        [],
        |row| row.get(0),
    )?;
    if has_col == 0 {
        conn.execute(
            "ALTER TABLE meetings ADD COLUMN reminder_offsets TEXT",
            [],
        )?;
    }

    Ok(())
}
