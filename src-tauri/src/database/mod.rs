pub mod models;
pub mod queries;

use rusqlite::{Connection, Result};
use std::path::{Path, PathBuf};
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
    init_database_at(&get_db_path(app))
}

/// Initialize a DayOS database at an explicit path.
///
/// This is used by the app at startup and by integration tests that need an
/// isolated SQLite database without launching Tauri.
pub fn init_database_at(db_path: &Path) -> Result<Connection> {
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    }

    let conn = Connection::open(db_path)?;

    conn.execute_batch("PRAGMA journal_mode=WAL;")?;
    conn.execute_batch("PRAGMA foreign_keys=ON;")?;
    conn.execute_batch("PRAGMA busy_timeout=5000;")?;

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

        CREATE TABLE IF NOT EXISTS devices (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            ip_address TEXT,
            last_seen TEXT NOT NULL DEFAULT (datetime('now')),
            is_trusted INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS lockin_sessions (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            host_device_id TEXT NOT NULL,
            host_device_name TEXT NOT NULL,
            pin_code TEXT NOT NULL,
            current_phase TEXT NOT NULL DEFAULT 'focus' CHECK(current_phase IN ('focus', 'short_break', 'long_break')),
            duration_minutes INTEGER NOT NULL DEFAULT 25,
            remaining_seconds INTEGER NOT NULL DEFAULT 1500,
            is_running INTEGER NOT NULL DEFAULT 0,
            participant_count INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS calendar_connectors (
            id TEXT PRIMARY KEY,
            provider TEXT NOT NULL CHECK(provider IN ('google_calendar', 'zoom', 'ical')),
            account_email TEXT,
            access_token TEXT,
            refresh_token TEXT,
            token_expires_at TEXT,
            feed_url TEXT,
            sync_enabled INTEGER NOT NULL DEFAULT 1,
            last_synced_at TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        -- Non-sensitive integration metadata. OAuth credentials are stored
        -- separately by the Windows credential store and are never written here.
        CREATE TABLE IF NOT EXISTS integration_accounts (
            id TEXT PRIMARY KEY,
            provider TEXT NOT NULL UNIQUE,
            account_email TEXT,
            display_name TEXT,
            status TEXT NOT NULL DEFAULT 'not_connected',
            scopes TEXT NOT NULL DEFAULT '[]',
            enabled_features TEXT NOT NULL DEFAULT '[]',
            sync_token TEXT,
            calendar_id TEXT,
            last_synced_at TEXT,
            last_error TEXT,
            metadata TEXT NOT NULL DEFAULT '{}',
            connected_at TEXT,
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS ai_messages (
            id TEXT PRIMARY KEY,
            role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
            content TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
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

    // Guarded migration: tasks collaboration fields
    let has_col: i64 = conn.query_row(
        "SELECT COUNT(*) FROM pragma_table_info('tasks') WHERE name = 'assignee_device_id'",
        [],
        |row| row.get(0),
    )?;
    if has_col == 0 {
        conn.execute("ALTER TABLE tasks ADD COLUMN assignee_device_id TEXT", [])?;
    }

    let has_col: i64 = conn.query_row(
        "SELECT COUNT(*) FROM pragma_table_info('tasks') WHERE name = 'assigned_by_device_id'",
        [],
        |row| row.get(0),
    )?;
    if has_col == 0 {
        conn.execute("ALTER TABLE tasks ADD COLUMN assigned_by_device_id TEXT", [])?;
    }

    // Guarded migration: projects collaboration fields
    let has_col: i64 = conn.query_row(
        "SELECT COUNT(*) FROM pragma_table_info('projects') WHERE name = 'owner_device_id'",
        [],
        |row| row.get(0),
    )?;
    if has_col == 0 {
        conn.execute("ALTER TABLE projects ADD COLUMN owner_device_id TEXT", [])?;
    }

    let has_col: i64 = conn.query_row(
        "SELECT COUNT(*) FROM pragma_table_info('projects') WHERE name = 'collaborator_device_ids'",
        [],
        |row| row.get(0),
    )?;
    if has_col == 0 {
        conn.execute("ALTER TABLE projects ADD COLUMN collaborator_device_ids TEXT", [])?;
    }

    // Guarded migration: goals collaboration fields
    let has_col: i64 = conn.query_row(
        "SELECT COUNT(*) FROM pragma_table_info('goals') WHERE name = 'owner_device_id'",
        [],
        |row| row.get(0),
    )?;
    if has_col == 0 {
        conn.execute("ALTER TABLE goals ADD COLUMN owner_device_id TEXT", [])?;
    }

    let has_col: i64 = conn.query_row(
        "SELECT COUNT(*) FROM pragma_table_info('goals') WHERE name = 'collaborator_device_ids'",
        [],
        |row| row.get(0),
    )?;
    if has_col == 0 {
        conn.execute("ALTER TABLE goals ADD COLUMN collaborator_device_ids TEXT", [])?;
    }

    // Guarded migration: meetings connector fields
    let has_col: i64 = conn.query_row(
        "SELECT COUNT(*) FROM pragma_table_info('meetings') WHERE name = 'external_provider'",
        [],
        |row| row.get(0),
    )?;
    if has_col == 0 {
        conn.execute("ALTER TABLE meetings ADD COLUMN external_provider TEXT", [])?;
    }

    let has_col: i64 = conn.query_row(
        "SELECT COUNT(*) FROM pragma_table_info('meetings') WHERE name = 'external_id'",
        [],
        |row| row.get(0),
    )?;
    if has_col == 0 {
        conn.execute("ALTER TABLE meetings ADD COLUMN external_id TEXT", [])?;
    }

    // Integration meeting metadata. These columns are additive and keep the
    // existing local meeting workflow intact.
    add_column_if_missing(&conn, "meetings", "timezone", "timezone TEXT")?;
    add_column_if_missing(&conn, "meetings", "passcode", "passcode TEXT")?;
    add_column_if_missing(
        &conn,
        "meetings",
        "calendar_event_id",
        "calendar_event_id TEXT",
    )?;
    add_column_if_missing(&conn, "meetings", "calendar_id", "calendar_id TEXT")?;
    add_column_if_missing(
        &conn,
        "meetings",
        "calendar_connection_id",
        "calendar_connection_id TEXT",
    )?;
    add_column_if_missing(
        &conn,
        "meetings",
        "participants",
        "participants TEXT",
    )?;
    add_column_if_missing(
        &conn,
        "meetings",
        "meeting_status",
        "meeting_status TEXT NOT NULL DEFAULT 'confirmed'",
    )?;
    add_column_if_missing(
        &conn,
        "meetings",
        "provider_metadata",
        "provider_metadata TEXT",
    )?;

    // Legacy iCal imports were local-only records. Preserve the meetings but
    // normalize their provider so they can never masquerade as a live
    // Google/Zoom connection.
    conn.execute(
        "UPDATE meetings
         SET external_provider = 'none'
         WHERE external_provider IS NULL
            OR external_provider IN ('google_calendar', 'ical', 'manual')",
        [],
    )?;
    conn.execute(
        "UPDATE meetings SET meeting_status = 'confirmed' WHERE meeting_status IS NULL",
        [],
    )?;

    conn.execute_batch(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_meetings_calendar_event
            ON meetings(calendar_connection_id, calendar_id, calendar_event_id)
            WHERE calendar_event_id IS NOT NULL;
         CREATE INDEX IF NOT EXISTS idx_meetings_external_provider
            ON meetings(external_provider);",
    )?;

    Ok(())
}

fn add_column_if_missing(
    conn: &Connection,
    table: &str,
    column: &str,
    definition: &str,
) -> Result<()> {
    let sql = format!(
        "SELECT COUNT(*) FROM pragma_table_info('{}') WHERE name = ?1",
        table
    );
    let has_col: i64 = conn.query_row(&sql, rusqlite::params![column], |row| row.get(0))?;
    if has_col == 0 {
        conn.execute(
            &format!("ALTER TABLE {} ADD COLUMN {}", table, definition),
            [],
        )?;
    }
    Ok(())
}
