use std::path::PathBuf;

use rusqlite::{params, Connection, OptionalExtension};

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

    pub fn mark_sync_success(&self, provider: &str) -> ApiResult<()> {
        let conn = self.connection()?;
        conn.execute(
            "UPDATE integration_accounts
             SET status = 'connected', last_error = NULL,
                 last_synced_at = datetime('now'), updated_at = datetime('now')
             WHERE provider = ?1",
            params![provider],
        )
        .map_err(ApiError::storage)?;
        Ok(())
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
