use std::path::PathBuf;

use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension};
use uuid::Uuid;

use super::types::{ApiError, ApiResult};

#[derive(Debug, Clone)]
pub struct IntegrationAccount {
    pub provider: String,
    pub account_email: Option<String>,
    pub display_name: Option<String>,
    pub status: String,
    pub scopes: Vec<String>,
    pub enabled_features: Vec<String>,
    pub sync_token: Option<String>,
    pub calendar_id: Option<String>,
    pub last_synced_at: Option<String>,
    pub last_error: Option<String>,
    pub metadata: serde_json::Value,
    pub connected_at: Option<String>,
    pub updated_at: Option<String>,
}

impl IntegrationAccount {
    pub fn new(provider: impl Into<String>) -> Self {
        Self {
            provider: provider.into(),
            account_email: None,
            display_name: None,
            status: "connected".to_string(),
            scopes: Vec::new(),
            enabled_features: Vec::new(),
            sync_token: None,
            calendar_id: None,
            last_synced_at: None,
            last_error: None,
            metadata: serde_json::json!({}),
            connected_at: None,
            updated_at: None,
        }
    }

    pub fn has_feature(&self, feature: &str) -> bool {
        self.enabled_features.iter().any(|value| value == feature)
    }

    pub fn has_scope(&self, scope: &str) -> bool {
        self.scopes.iter().any(|value| value == scope)
    }
}

/// A calendar event normalized by a provider adapter and ready to be written
/// to the local `meetings` table. This deliberately contains no credentials.
#[derive(Debug, Clone)]
pub struct ImportedCalendarMeeting {
    pub event_id: String,
    pub calendar_id: String,
    pub connection_id: String,
    pub title: String,
    pub description: Option<String>,
    pub date: String,
    pub start_time: String,
    pub end_time: Option<String>,
    pub meeting_url: Option<String>,
    pub timezone: Option<String>,
    pub external_provider: String,
    pub external_id: Option<String>,
    pub participants: Vec<String>,
    pub meeting_status: String,
    pub provider_metadata: serde_json::Value,
    pub is_recurring: bool,
    pub recurrence_rule: Option<String>,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct CalendarSyncOutcome {
    pub imported: usize,
    pub updated: usize,
    pub cancelled: usize,
}

#[derive(Debug, Clone)]
pub struct IntegrationStore {
    db_path: PathBuf,
}

impl IntegrationStore {
    pub fn new(db_path: PathBuf) -> Self {
        Self { db_path }
    }

    pub fn db_path(&self) -> &PathBuf {
        &self.db_path
    }

    pub fn connection(&self) -> ApiResult<Connection> {
        let conn = Connection::open(&self.db_path).map_err(ApiError::storage)?;
        conn.busy_timeout(std::time::Duration::from_secs(5))
            .map_err(ApiError::storage)?;
        conn.execute_batch("PRAGMA foreign_keys=ON;")
            .map_err(ApiError::storage)?;
        Ok(conn)
    }

    pub fn get_account(&self, provider: &str) -> ApiResult<Option<IntegrationAccount>> {
        let conn = self.connection()?;
        conn.query_row(
            "SELECT provider, account_email, display_name, status, scopes,
                    enabled_features, sync_token, calendar_id, last_synced_at,
                    last_error, metadata, connected_at, updated_at
             FROM integration_accounts
             WHERE provider = ?1",
            params![provider],
            map_account,
        )
        .optional()
        .map_err(ApiError::storage)
    }

    pub fn save_account(&self, account: &IntegrationAccount) -> ApiResult<()> {
        let conn = self.connection()?;
        let scopes = serde_json::to_string(&account.scopes)
            .map_err(|error| ApiError::storage(error.to_string()))?;
        let enabled_features = serde_json::to_string(&account.enabled_features)
            .map_err(|error| ApiError::storage(error.to_string()))?;
        let metadata = serde_json::to_string(&account.metadata)
            .map_err(|error| ApiError::storage(error.to_string()))?;

        conn.execute(
            "INSERT INTO integration_accounts (
                id, provider, account_email, display_name, status, scopes,
                enabled_features, sync_token, calendar_id, last_synced_at,
                last_error, metadata, connected_at, updated_at
             )
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12,
                     COALESCE(?13, datetime('now')), datetime('now'))
             ON CONFLICT(provider) DO UPDATE SET
                account_email = excluded.account_email,
                display_name = excluded.display_name,
                status = excluded.status,
                scopes = excluded.scopes,
                enabled_features = excluded.enabled_features,
                sync_token = excluded.sync_token,
                calendar_id = excluded.calendar_id,
                last_synced_at = excluded.last_synced_at,
                last_error = excluded.last_error,
                metadata = excluded.metadata,
                updated_at = datetime('now')",
            params![
                account.provider,
                account.provider,
                account.account_email,
                account.display_name,
                account.status,
                scopes,
                enabled_features,
                account.sync_token,
                account.calendar_id,
                account.last_synced_at,
                account.last_error,
                metadata,
                account.connected_at,
            ],
        )
        .map_err(ApiError::storage)?;

        Ok(())
    }

    pub fn delete_account(&self, provider: &str) -> ApiResult<()> {
        let conn = self.connection()?;
        conn.execute(
            "DELETE FROM integration_accounts WHERE provider = ?1",
            params![provider],
        )
        .map_err(ApiError::storage)?;
        Ok(())
    }

    pub fn set_status(
        &self,
        provider: &str,
        status: &str,
        last_error: Option<&str>,
    ) -> ApiResult<()> {
        let conn = self.connection()?;
        conn.execute(
            "UPDATE integration_accounts
             SET status = ?2, last_error = ?3, updated_at = datetime('now')
             WHERE provider = ?1",
            params![provider, status, last_error],
        )
        .map_err(ApiError::storage)?;
        Ok(())
    }

    pub fn mark_sync_success(&self, provider: &str, sync_token: Option<&str>) -> ApiResult<()> {
        let conn = self.connection()?;
        conn.execute(
            "UPDATE integration_accounts
             SET status = 'connected', last_error = NULL, sync_token = ?2,
                 last_synced_at = ?3, updated_at = datetime('now')
             WHERE provider = ?1",
            params![provider, sync_token, Utc::now().to_rfc3339()],
        )
        .map_err(ApiError::storage)?;
        Ok(())
    }

    /// Apply one provider sync batch to the local meeting table inside a single
    /// transaction. Upserts never clear unrelated local meetings; only events
    /// the provider explicitly reports as cancelled are deleted.
    pub fn apply_calendar_sync(
        &self,
        calendar_id: &str,
        connection_id: &str,
        meetings: &[ImportedCalendarMeeting],
        cancelled: &[String],
    ) -> ApiResult<CalendarSyncOutcome> {
        let mut conn = self.connection()?;
        let tx = conn.transaction().map_err(ApiError::storage)?;
        let mut outcome = CalendarSyncOutcome::default();

        for meeting in meetings {
            let participants = serde_json::to_string(&meeting.participants)
                .map_err(|error| ApiError::storage(error.to_string()))?;
            let provider_metadata = serde_json::to_string(&meeting.provider_metadata)
                .map_err(|error| ApiError::storage(error.to_string()))?;

            let existing: Option<String> = tx
                .query_row(
                    "SELECT id FROM meetings
                     WHERE calendar_connection_id = ?1
                       AND calendar_id = ?2
                       AND calendar_event_id = ?3",
                    params![connection_id, calendar_id, meeting.event_id],
                    |row| row.get(0),
                )
                .optional()
                .map_err(ApiError::storage)?;

            match existing {
                Some(id) => {
                    tx.execute(
                        "UPDATE meetings SET
                            title = ?2,
                            description = ?3,
                            date = ?4,
                            start_time = ?5,
                            end_time = ?6,
                            meeting_url = ?7,
                            timezone = ?8,
                            external_provider = ?9,
                            external_id = ?10,
                            calendar_event_id = ?11,
                            calendar_id = ?12,
                            calendar_connection_id = ?13,
                            participants = ?14,
                            meeting_status = ?15,
                            provider_metadata = ?16,
                            is_recurring = ?17,
                            recurrence_rule = ?18,
                            updated_at = datetime('now')
                         WHERE id = ?1",
                        params![
                            id,
                            meeting.title,
                            meeting.description,
                            meeting.date,
                            meeting.start_time,
                            meeting.end_time,
                            meeting.meeting_url,
                            meeting.timezone,
                            meeting.external_provider,
                            meeting.external_id,
                            meeting.event_id,
                            calendar_id,
                            connection_id,
                            participants,
                            meeting.meeting_status,
                            provider_metadata,
                            meeting.is_recurring as i32,
                            meeting.recurrence_rule,
                        ],
                    )
                    .map_err(ApiError::storage)?;
                    outcome.updated += 1;
                }
                None => {
                    tx.execute(
                        "INSERT INTO meetings (
                            id, title, description, date, start_time, end_time,
                            meeting_url, timezone, external_provider, external_id,
                            calendar_event_id, calendar_id, calendar_connection_id,
                            participants, meeting_status, provider_metadata,
                            is_recurring, recurrence_rule
                         )
                         VALUES (
                            ?1, ?2, ?3, ?4, ?5, ?6,
                            ?7, ?8, ?9, ?10,
                            ?11, ?12, ?13,
                            ?14, ?15, ?16,
                            ?17, ?18
                         )",
                        params![
                            Uuid::new_v4().to_string(),
                            meeting.title,
                            meeting.description,
                            meeting.date,
                            meeting.start_time,
                            meeting.end_time,
                            meeting.meeting_url,
                            meeting.timezone,
                            meeting.external_provider,
                            meeting.external_id,
                            meeting.event_id,
                            calendar_id,
                            connection_id,
                            participants,
                            meeting.meeting_status,
                            provider_metadata,
                            meeting.is_recurring as i32,
                            meeting.recurrence_rule,
                        ],
                    )
                    .map_err(ApiError::storage)?;
                    outcome.imported += 1;
                }
            }
        }

        for event_id in cancelled {
            let removed = tx
                .execute(
                    "DELETE FROM meetings
                     WHERE calendar_connection_id = ?1
                       AND calendar_id = ?2
                       AND calendar_event_id = ?3",
                    params![connection_id, calendar_id, event_id],
                )
                .map_err(ApiError::storage)?;
            outcome.cancelled += removed;
        }

        tx.commit().map_err(ApiError::storage)?;
        Ok(outcome)
    }
}

fn map_account(row: &rusqlite::Row<'_>) -> rusqlite::Result<IntegrationAccount> {
    let scopes: String = row.get(4)?;
    let enabled_features: String = row.get(5)?;
    let metadata: String = row.get(10)?;
    Ok(IntegrationAccount {
        provider: row.get(0)?,
        account_email: row.get(1)?,
        display_name: row.get(2)?,
        status: row.get(3)?,
        scopes: serde_json::from_str(&scopes).unwrap_or_default(),
        enabled_features: serde_json::from_str(&enabled_features).unwrap_or_default(),
        sync_token: row.get(6)?,
        calendar_id: row.get(7)?,
        last_synced_at: row.get(8)?,
        last_error: row.get(9)?,
        metadata: serde_json::from_str(&metadata).unwrap_or_else(|_| serde_json::json!({})),
        connected_at: row.get(11)?,
        updated_at: row.get(12)?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::{init_database_at, models::CreateMeetingRequest, queries};

    struct TestDb {
        path: PathBuf,
    }

    impl TestDb {
        fn new() -> Self {
            let path = std::env::temp_dir().join(format!(
                "dayos-integration-test-{}.db",
                Uuid::new_v4()
            ));
            init_database_at(&path).expect("test database should initialize");
            Self { path }
        }

        fn store(&self) -> IntegrationStore {
            IntegrationStore::new(self.path.clone())
        }
    }

    impl Drop for TestDb {
        fn drop(&mut self) {
            let _ = std::fs::remove_file(&self.path);
        }
    }

    fn imported(event_id: &str, title: &str) -> ImportedCalendarMeeting {
        ImportedCalendarMeeting {
            event_id: event_id.to_string(),
            calendar_id: "primary".to_string(),
            connection_id: "google".to_string(),
            title: title.to_string(),
            description: Some("Description".to_string()),
            date: "2026-11-05".to_string(),
            start_time: "10:00".to_string(),
            end_time: Some("10:30".to_string()),
            meeting_url: Some("https://meet.google.com/abc-defg-hij".to_string()),
            timezone: Some("America/New_York".to_string()),
            external_provider: "google_meet".to_string(),
            external_id: Some("abc-defg-hij".to_string()),
            participants: vec!["a@example.com".to_string()],
            meeting_status: "confirmed".to_string(),
            provider_metadata: serde_json::json!({ "source": "google_calendar" }),
            is_recurring: false,
            recurrence_rule: None,
        }
    }

    #[test]
    fn apply_calendar_sync_inserts_then_updates_without_duplicates() {
        let db = TestDb::new();
        let store = db.store();

        let first = store
            .apply_calendar_sync("primary", "google", &[imported("event-1", "First")], &[])
            .expect("initial sync should succeed");
        assert_eq!(first.imported, 1);
        assert_eq!(first.updated, 0);

        let second = store
            .apply_calendar_sync(
                "primary",
                "google",
                &[imported("event-1", "Updated title")],
                &[],
            )
            .expect("second sync should succeed");
        assert_eq!(second.imported, 0);
        assert_eq!(second.updated, 1);

        let conn = store.connection().expect("connection should open");
        let meetings = queries::get_all_meetings(&conn).expect("meetings should load");
        assert_eq!(meetings.len(), 1);
        assert_eq!(meetings[0].title, "Updated title");
        assert_eq!(meetings[0].calendar_event_id.as_deref(), Some("event-1"));
        assert_eq!(
            meetings[0].calendar_connection_id.as_deref(),
            Some("google")
        );
    }

    #[test]
    fn apply_calendar_sync_deletes_cancelled_events_only() {
        let db = TestDb::new();
        let store = db.store();

        store
            .apply_calendar_sync(
                "primary",
                "google",
                &[imported("event-1", "One"), imported("event-2", "Two")],
                &[],
            )
            .expect("initial sync should succeed");

        let conn = store.connection().expect("connection should open");
        queries::create_meeting(
            &conn,
            CreateMeetingRequest {
                title: "Local meeting".to_string(),
                description: None,
                date: "2026-11-06".to_string(),
                start_time: "09:00".to_string(),
                end_time: None,
                meeting_url: None,
                timezone: None,
                external_provider: None,
                external_id: None,
                passcode: None,
                calendar_event_id: None,
                calendar_id: None,
                calendar_connection_id: None,
                participants: None,
                meeting_status: None,
                provider_metadata: None,
                reminder_enabled: None,
                reminder_minutes: None,
                reminder_offsets: None,
                is_recurring: None,
                recurrence_rule: None,
            },
        )
        .expect("local meeting should be created");
        drop(conn);

        let outcome = store
            .apply_calendar_sync("primary", "google", &[], &["event-1".to_string()])
            .expect("cancel sync should succeed");
        assert_eq!(outcome.cancelled, 1);

        let conn = store.connection().expect("connection should open");
        let meetings = queries::get_all_meetings(&conn).expect("meetings should load");
        let ids: Vec<_> = meetings
            .iter()
            .map(|meeting| meeting.title.as_str())
            .collect();
        assert!(ids.contains(&"Two"));
        assert!(ids.contains(&"Local meeting"));
        assert!(!ids.contains(&"One"));
    }

    #[test]
    fn sync_token_is_persisted_with_the_account() {
        let db = TestDb::new();
        let store = db.store();

        let mut account = IntegrationAccount::new("google");
        account.sync_token = Some("token-1".to_string());
        store.save_account(&account).expect("account should save");

        store
            .mark_sync_success("google", Some("token-2"))
            .expect("sync success should save");

        let saved = store
            .get_account("google")
            .expect("account should load")
            .expect("account should exist");
        assert_eq!(saved.sync_token.as_deref(), Some("token-2"));
        assert_eq!(saved.status, "connected");
        assert!(saved.last_synced_at.is_some());
    }
}
