use std::time::Duration;

use chrono::{DateTime, Duration as ChronoDuration, Utc};
use serde::Deserialize;
use url::Url;

use crate::integrations::store::ImportedCalendarMeeting;
use crate::integrations::types::{
    ApiError, ApiResult, PROVIDER_GOOGLE_MEET, PROVIDER_NONE, PROVIDER_ZOOM,
};

const CALENDAR_API_BASE: &str = "https://www.googleapis.com/calendar/v3/calendars";
const PAGE_SIZE: u32 = 2500;
const MAX_PAGES: u32 = 40;
const INITIAL_LOOKBACK_DAYS: i64 = 90;
const INITIAL_LOOKAHEAD_DAYS: i64 = 365;

/// Events fetched from the Google Calendar API, ready to be applied to SQLite.
pub struct GoogleSyncBatch {
    pub meetings: Vec<ImportedCalendarMeeting>,
    /// Google event IDs that were cancelled since the previous sync token.
    pub cancelled: Vec<String>,
    pub next_sync_token: Option<String>,
    pub full_sync: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct EventListResponse {
    #[serde(default)]
    items: Vec<CalendarEvent>,
    next_page_token: Option<String>,
    next_sync_token: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CalendarEvent {
    id: String,
    status: Option<String>,
    summary: Option<String>,
    description: Option<String>,
    location: Option<String>,
    html_link: Option<String>,
    hangout_link: Option<String>,
    conference_data: Option<ConferenceData>,
    start: Option<EventDateTime>,
    end: Option<EventDateTime>,
    #[serde(default)]
    attendees: Vec<Attendee>,
    organizer: Option<Organizer>,
    recurrence: Option<Vec<String>>,
    recurring_event_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct EventDateTime {
    date_time: Option<String>,
    date: Option<String>,
    time_zone: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ConferenceData {
    conference_id: Option<String>,
    #[serde(default)]
    entry_points: Vec<EntryPoint>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct EntryPoint {
    entry_point_type: Option<String>,
    uri: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Attendee {
    email: Option<String>,
}

#[derive(Debug, Deserialize)]
struct Organizer {
    email: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GoogleErrorEnvelope {
    error: Option<GoogleError>,
}

#[derive(Debug, Deserialize)]
struct GoogleError {
    message: Option<String>,
}

/// Fetch events from the primary calendar using sync tokens when available.
///
/// The first sync pulls a bounded window (90 days back through 12 months
/// ahead) and stores Google's `nextSyncToken`. Later syncs send that token and
/// receive only changes, including cancellations.
pub fn fetch_events(
    access_token: &str,
    calendar_id: &str,
    connection_id: &str,
    sync_token: Option<&str>,
) -> ApiResult<GoogleSyncBatch> {
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(60))
        .user_agent("DayOS/0.1")
        .build()
        .map_err(|_| {
            ApiError::new(
                "network_error",
                "Could not initialize the Google Calendar HTTP client.",
                true,
            )
        })?;

    let base = events_url(calendar_id)?;
    let full_sync = sync_token.is_none();
    let mut page_token: Option<String> = None;
    let mut next_sync_token: Option<String> = None;
    let mut meetings = Vec::new();
    let mut cancelled = Vec::new();
    let mut pages = 0;

    loop {
        pages += 1;
        if pages > MAX_PAGES {
            return Err(ApiError::new(
                "provider_error",
                "Google Calendar returned more event pages than DayOS can import in one sync.",
                true,
            ));
        }

        let mut query: Vec<(&str, String)> = vec![
            ("singleEvents", "true".to_string()),
            ("maxResults", PAGE_SIZE.to_string()),
        ];

        match sync_token {
            Some(token) => {
                query.push(("syncToken", token.to_string()));
                // Cancellations are only reported when deleted events are requested.
                query.push(("showDeleted", "true".to_string()));
            }
            None => {
                // Google does not allow orderBy/timeMin/timeMax with a syncToken.
                query.push(("orderBy", "startTime".to_string()));
                query.push(("timeMin", initial_time_min()));
                query.push(("timeMax", initial_time_max()));
            }
        }

        if let Some(token) = page_token.as_deref() {
            query.push(("pageToken", token.to_string()));
        }

        let response = client
            .get(base.clone())
            .bearer_auth(access_token)
            .query(&query)
            .send()
            .map_err(|_| network_error())?;

        let status = response.status();
        if status == reqwest::StatusCode::GONE {
            return Err(ApiError::new(
                "sync_token_invalid",
                "Google Calendar requested a full resync.",
                false,
            ));
        }
        if status == reqwest::StatusCode::UNAUTHORIZED {
            return Err(ApiError::new(
                "auth_expired",
                "Google Calendar rejected the saved authorization. Reconnect in Settings → Connectors.",
                false,
            ));
        }
        if !status.is_success() {
            return Err(provider_error(response));
        }

        let page: EventListResponse = response.json().map_err(|_| {
            ApiError::new(
                "provider_error",
                "Google Calendar returned a response DayOS could not read.",
                true,
            )
        })?;

        for event in page.items {
            if event.status.as_deref() == Some("cancelled") {
                cancelled.push(event.id);
                continue;
            }

            if let Some(meeting) = map_event(&event, calendar_id, connection_id) {
                meetings.push(meeting);
            }
        }

        if let Some(token) = page.next_sync_token {
            next_sync_token = Some(token);
        }

        match page.next_page_token {
            Some(token) if !token.is_empty() => page_token = Some(token),
            _ => break,
        }
    }

    Ok(GoogleSyncBatch {
        meetings,
        cancelled,
        next_sync_token,
        full_sync,
    })
}

fn events_url(calendar_id: &str) -> ApiResult<Url> {
    let mut url = Url::parse(CALENDAR_API_BASE).map_err(|_| {
        ApiError::new(
            "internal_error",
            "The Google Calendar API URL is invalid.",
            false,
        )
    })?;

    {
        let mut segments = url.path_segments_mut().map_err(|_| {
            ApiError::new(
                "internal_error",
                "The Google Calendar API URL cannot accept path segments.",
                false,
            )
        })?;
        segments.push(calendar_id);
        segments.push("events");
    }

    Ok(url)
}

fn initial_time_min() -> String {
    (Utc::now() - ChronoDuration::days(INITIAL_LOOKBACK_DAYS)).to_rfc3339()
}

fn initial_time_max() -> String {
    (Utc::now() + ChronoDuration::days(INITIAL_LOOKAHEAD_DAYS)).to_rfc3339()
}

fn map_event(
    event: &CalendarEvent,
    calendar_id: &str,
    connection_id: &str,
) -> Option<ImportedCalendarMeeting> {
    let start = event.start.as_ref()?;
    let (date, start_time, all_day) = parse_start(start)?;
    let end_time = parse_end(event.end.as_ref(), &date);

    let meeting_url = video_url(event);
    let (external_provider, external_id) = match meeting_url.as_deref() {
        Some(url) => classify_video_url(url, event.conference_data.as_ref()),
        None => (PROVIDER_NONE, None),
    };

    let mut participants: Vec<String> = event
        .attendees
        .iter()
        .filter_map(|attendee| attendee.email.as_deref())
        .map(str::trim)
        .filter(|email| !email.is_empty())
        .map(str::to_string)
        .collect();

    if participants.is_empty() {
        if let Some(email) = event
            .organizer
            .as_ref()
            .and_then(|organizer| organizer.email.as_deref())
        {
            let email = email.trim();
            if !email.is_empty() {
                participants.push(email.to_string());
            }
        }
    }

    participants.sort();
    participants.dedup();

    let title = event
        .summary
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("Untitled event")
        .to_string();

    let meeting_status = match event.status.as_deref() {
        Some("tentative") => "tentative",
        _ => "confirmed",
    };

    let is_recurring = event.recurring_event_id.is_some() || event.recurrence.is_some();
    let recurrence_rule = event
        .recurrence
        .as_ref()
        .filter(|rules| !rules.is_empty())
        .map(|rules| rules.join("\n"));

    let provider_metadata = serde_json::json!({
        "source": "google_calendar",
        "all_day": all_day,
        "html_link": event.html_link,
        "location": event.location,
        "conference_id": event
            .conference_data
            .as_ref()
            .and_then(|conference| conference.conference_id.clone()),
        "recurring_event_id": event.recurring_event_id,
    });

    Some(ImportedCalendarMeeting {
        event_id: event.id.clone(),
        calendar_id: calendar_id.to_string(),
        connection_id: connection_id.to_string(),
        title,
        description: event.description.clone(),
        date,
        start_time,
        end_time,
        meeting_url,
        timezone: start.time_zone.clone(),
        external_provider: external_provider.to_string(),
        external_id,
        participants,
        meeting_status: meeting_status.to_string(),
        provider_metadata,
        is_recurring,
        recurrence_rule,
    })
}

fn parse_start(start: &EventDateTime) -> Option<(String, String, bool)> {
    if let Some(value) = start.date_time.as_deref() {
        let parsed = DateTime::parse_from_rfc3339(value).ok()?;
        return Some((
            parsed.date_naive().format("%Y-%m-%d").to_string(),
            parsed.format("%H:%M").to_string(),
            false,
        ));
    }

    let date = start.date.as_deref()?.trim();
    if date.is_empty() {
        return None;
    }

    Some((date.to_string(), "00:00".to_string(), true))
}

fn parse_end(end: Option<&EventDateTime>, start_date: &str) -> Option<String> {
    let end = end?;

    if let Some(value) = end.date_time.as_deref() {
        let parsed = DateTime::parse_from_rfc3339(value).ok()?;
        if parsed.date_naive().format("%Y-%m-%d").to_string() != start_date {
            return Some("23:59".to_string());
        }
        return Some(parsed.format("%H:%M").to_string());
    }

    end.date.as_ref().map(|_| "23:59".to_string())
}

fn video_url(event: &CalendarEvent) -> Option<String> {
    if let Some(link) = event
        .hangout_link
        .as_deref()
        .map(str::trim)
        .filter(|value| is_http_url(value))
    {
        return Some(link.to_string());
    }

    if let Some(conference) = event.conference_data.as_ref() {
        for entry_point in &conference.entry_points {
            if entry_point.entry_point_type.as_deref() != Some("video") {
                continue;
            }

            if let Some(uri) = entry_point
                .uri
                .as_deref()
                .map(str::trim)
                .filter(|value| is_http_url(value))
            {
                return Some(uri.to_string());
            }
        }
    }

    find_video_link(event.description.as_deref())
        .or_else(|| find_video_link(event.location.as_deref()))
}

fn find_video_link(text: Option<&str>) -> Option<String> {
    let text = text?;

    text.split_whitespace()
        .map(|token| {
            token.trim_matches(|character: char| {
                matches!(
                    character,
                    '"' | '\'' | '(' | ')' | '[' | ']' | '<' | '>' | ',' | ';' | '.'
                )
            })
        })
        .find(|token| {
            is_http_url(token)
                && (token.contains("meet.google.com") || token.contains("zoom.us"))
        })
        .map(str::to_string)
}

fn is_http_url(value: &str) -> bool {
    value.starts_with("https://") || value.starts_with("http://")
}

fn classify_video_url(url: &str, conference: Option<&ConferenceData>) -> (&'static str, Option<String>) {
    let lower = url.to_ascii_lowercase();

    if lower.contains("meet.google.com") {
        let external_id = conference
            .and_then(|value| value.conference_id.clone())
            .or_else(|| last_path_segment(url));

        return (PROVIDER_GOOGLE_MEET, external_id);
    }

    if lower.contains("zoom.us") {
        return (PROVIDER_ZOOM, zoom_meeting_id(url));
    }

    (PROVIDER_NONE, None)
}

fn last_path_segment(url: &str) -> Option<String> {
    let parsed = Url::parse(url).ok()?;
    parsed
        .path_segments()?
        .filter(|segment| !segment.is_empty())
        .last()
        .map(str::to_string)
}

fn zoom_meeting_id(url: &str) -> Option<String> {
    let parsed = Url::parse(url).ok()?;
    let segments: Vec<&str> = parsed
        .path_segments()?
        .filter(|segment| !segment.is_empty())
        .collect();

    segments
        .iter()
        .position(|segment| *segment == "j" || *segment == "w" || *segment == "s")
        .and_then(|index| segments.get(index + 1))
        .filter(|value| value.chars().all(|character| character.is_ascii_digit()))
        .map(|value| value.to_string())
}

fn provider_error(response: reqwest::blocking::Response) -> ApiError {
    let status = response.status();
    let body = response.text().unwrap_or_default();
    let message = serde_json::from_str::<GoogleErrorEnvelope>(&body)
        .ok()
        .and_then(|envelope| envelope.error)
        .and_then(|error| error.message)
        .unwrap_or_else(|| "Google Calendar rejected the request.".to_string());

    ApiError::new(
        "provider_error",
        format!(
            "Google Calendar sync failed (HTTP {}): {}",
            status.as_u16(),
            truncate(&message, 300)
        ),
        status.is_server_error() || status == reqwest::StatusCode::TOO_MANY_REQUESTS,
    )
}

fn truncate(value: &str, max_chars: usize) -> String {
    value.chars().take(max_chars).collect()
}

fn network_error() -> ApiError {
    ApiError::new(
        "network_error",
        "Could not reach Google Calendar. Check your internet connection and try again.",
        true,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn event_json(value: serde_json::Value) -> CalendarEvent {
        serde_json::from_value(value).expect("event should deserialize")
    }

    #[test]
    fn maps_timed_event_with_google_meet() {
        let event = event_json(serde_json::json!({
            "id": "event-1",
            "status": "confirmed",
            "summary": "Design review",
            "description": "Join at https://meet.google.com/abc-defg-hij",
            "hangoutLink": "https://meet.google.com/abc-defg-hij",
            "conferenceData": {
                "conferenceId": "abc-defg-hij",
                "entryPoints": [
                    { "entryPointType": "video", "uri": "https://meet.google.com/abc-defg-hij" }
                ]
            },
            "start": { "dateTime": "2026-11-05T10:30:00-05:00", "timeZone": "America/New_York" },
            "end": { "dateTime": "2026-11-05T11:00:00-05:00", "timeZone": "America/New_York" },
            "attendees": [
                { "email": "a@example.com" },
                { "email": "b@example.com" },
                { "email": "a@example.com" }
            ]
        }));

        let meeting = map_event(&event, "primary", "google").expect("event should map");

        assert_eq!(meeting.title, "Design review");
        assert_eq!(meeting.date, "2026-11-05");
        assert_eq!(meeting.start_time, "10:30");
        assert_eq!(meeting.end_time.as_deref(), Some("11:00"));
        assert_eq!(meeting.external_provider, PROVIDER_GOOGLE_MEET);
        assert_eq!(meeting.external_id.as_deref(), Some("abc-defg-hij"));
        assert_eq!(
            meeting.participants,
            vec!["a@example.com".to_string(), "b@example.com".to_string()]
        );
        assert_eq!(meeting.timezone.as_deref(), Some("America/New_York"));
    }

    #[test]
    fn maps_all_day_event_and_zoom_link() {
        let event = event_json(serde_json::json!({
            "id": "event-2",
            "summary": "Conference",
            "location": "https://zoom.us/j/123456789",
            "start": { "date": "2026-12-01" },
            "end": { "date": "2026-12-02" }
        }));

        let meeting = map_event(&event, "primary", "google").expect("event should map");

        assert_eq!(meeting.date, "2026-12-01");
        assert_eq!(meeting.start_time, "00:00");
        assert_eq!(meeting.end_time.as_deref(), Some("23:59"));
        assert_eq!(meeting.external_provider, PROVIDER_ZOOM);
        assert_eq!(meeting.external_id.as_deref(), Some("123456789"));
        assert_eq!(
            meeting.provider_metadata.get("all_day"),
            Some(&serde_json::Value::Bool(true))
        );
    }

    #[test]
    fn leaves_plain_local_events_without_a_provider() {
        let event = event_json(serde_json::json!({
            "id": "event-3",
            "summary": "Focus time",
            "start": { "dateTime": "2026-11-05T09:00:00Z" },
            "end": { "dateTime": "2026-11-05T10:00:00Z" }
        }));

        let meeting = map_event(&event, "primary", "google").expect("event should map");

        assert_eq!(meeting.external_provider, PROVIDER_NONE);
        assert!(meeting.external_id.is_none());
        assert!(meeting.meeting_url.is_none());
    }

    #[test]
    fn events_url_encodes_calendar_ids_as_one_path_segment() {
        let url = events_url("team/example").expect("url should build");
        assert!(url.as_str().contains("team%2Fexample"));
        assert!(url.as_str().ends_with("/events"));
    }
}
