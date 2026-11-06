use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::time::{Duration, Instant};

use tauri::AppHandle;
use tauri_plugin_opener::OpenerExt;
use url::Url;

use super::config::OAuthConfig;
use super::pkce::{constant_time_eq, Pkce};
use crate::integrations::types::{ApiError, ApiResult};

#[derive(Debug, Clone)]
pub struct AuthorizationCode {
    pub code: String,
    pub verifier: String,
    pub redirect_uri: String,
}

/// Run the OAuth 2.0 Authorization Code + PKCE flow through the system browser.
///
/// A loopback listener receives the single authorization callback. The state
/// parameter is validated before the code is exchanged, and the listener binds
/// only to 127.0.0.1.
pub fn run_authorization_flow(
    app: &AppHandle,
    config: &OAuthConfig,
) -> ApiResult<AuthorizationCode> {
    let listener = TcpListener::bind(("127.0.0.1", config.redirect_port)).map_err(|error| {
        ApiError::new(
            "auth_failed",
            format!(
                "Could not start the local OAuth callback listener on port {}: {}",
                config.redirect_port, error
            ),
            true,
        )
    })?;
    listener.set_nonblocking(true).map_err(|error| {
        ApiError::new(
            "auth_failed",
            format!("Could not configure the OAuth callback listener: {}", error),
            true,
        )
    })?;

    let port = listener
        .local_addr()
        .map_err(|error| {
            ApiError::new(
                "auth_failed",
                format!("Could not read the OAuth callback port: {}", error),
                false,
            )
        })?
        .port();

    let redirect_uri = redirect_uri_for(port, &config.redirect_path);
    let pkce = Pkce::generate();
    let authorization_url = build_authorization_url(config, &redirect_uri, &pkce)?;

    app.opener()
        .open_url(authorization_url, None::<&str>)
        .map_err(|error| {
            ApiError::new(
                "auth_failed",
                format!("Could not open the system browser for sign-in: {}", error),
                true,
            )
        })?;

    let code = wait_for_code(
        &listener,
        &pkce.state,
        &config.redirect_path,
        config.timeout,
    )?;

    Ok(AuthorizationCode {
        code,
        verifier: pkce.verifier,
        redirect_uri,
    })
}

pub fn build_authorization_url(
    config: &OAuthConfig,
    redirect_uri: &str,
    pkce: &Pkce,
) -> ApiResult<String> {
    let mut url = Url::parse(config.auth_url).map_err(|error| {
        ApiError::new(
            "not_configured",
            format!("The provider authorization URL is invalid: {}", error),
            false,
        )
    })?;

    {
        let mut query = url.query_pairs_mut();
        query.append_pair("client_id", &config.client_id);
        query.append_pair("redirect_uri", redirect_uri);
        query.append_pair("response_type", "code");
        query.append_pair("scope", &config.scopes.join(" "));
        query.append_pair("state", &pkce.state);
        query.append_pair("code_challenge", &pkce.challenge);
        query.append_pair("code_challenge_method", "S256");

        // Google only returns a refresh token with offline access, and prompt=consent
        // makes re-authorization deterministic for users who previously granted scopes.
        if config.provider == super::config::GOOGLE_PROVIDER_KEY {
            query.append_pair("access_type", "offline");
            query.append_pair("prompt", "consent");
        }
    }

    Ok(url.into())
}

fn redirect_uri_for(port: u16, path: &str) -> String {
    if path == "/" {
        format!("http://127.0.0.1:{}", port)
    } else {
        format!("http://127.0.0.1:{}{}", port, path)
    }
}

fn wait_for_code(
    listener: &TcpListener,
    expected_state: &str,
    expected_path: &str,
    timeout: Duration,
) -> ApiResult<String> {
    let deadline = Instant::now() + timeout;

    loop {
        match listener.accept() {
            Ok((mut stream, _address)) => {
                let _ = stream.set_read_timeout(Some(Duration::from_secs(5)));
                let mut buffer = [0u8; 16 * 1024];
                let read = stream.read(&mut buffer).unwrap_or(0);

                if read == 0 {
                    continue;
                }

                let request = String::from_utf8_lossy(&buffer[..read]);
                let request_line = request.lines().next().unwrap_or("");
                let mut parts = request_line.split_whitespace();
                let method = parts.next().unwrap_or("");
                let target = parts.next().unwrap_or("");

                if method != "GET" {
                    write_response(
                        &mut stream,
                        "405 Method Not Allowed",
                        &response_page("Method Not Allowed", "This endpoint only accepts GET requests.", false),
                    );
                    continue;
                }

                match inspect_callback(target, expected_state, expected_path) {
                    CallbackOutcome::Ignore => {
                        write_response(
                            &mut stream,
                            "404 Not Found",
                            &response_page("Endpoint Not Found", "This is not the OAuth callback endpoint.", false),
                        );
                    }
                    CallbackOutcome::InvalidState => {
                        write_response(
                            &mut stream,
                            "400 Bad Request",
                            &response_page(
                                "Invalid Security State",
                                "The sign-in response did not match this request. You can safely close this window.",
                                false,
                            ),
                        );
                    }
                    CallbackOutcome::MissingCode => {
                        write_response(
                            &mut stream,
                            "400 Bad Request",
                            &response_page(
                                "Authorization Incomplete",
                                "The provider did not return an authorization code. You can close this window.",
                                false,
                            ),
                        );
                        return Err(ApiError::new(
                            "auth_failed",
                            "The provider did not return an authorization code.",
                            false,
                        ));
                    }
                    CallbackOutcome::ProviderError(message) => {
                        write_response(
                            &mut stream,
                            "400 Bad Request",
                            &response_page("Sign-In Not Completed", &message, false),
                        );
                        return Err(ApiError::new("auth_cancelled", message, false));
                    }
                    CallbackOutcome::Authorized(code) => {
                        write_response(
                            &mut stream,
                            "200 OK",
                            &response_page(
                                "DayOS is Connected",
                                "Sign-in is complete! Your calendar and meetings are now synced. You can return to DayOS.",
                                true,
                            ),
                        );
                        return Ok(code);
                    }
                }
            }
            Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                if Instant::now() >= deadline {
                    return Err(ApiError::new(
                        "auth_timeout",
                        "Sign-in timed out before the provider responded. Start the connection again from DayOS.",
                        false,
                    ));
                }
                std::thread::sleep(Duration::from_millis(50));
            }
            Err(error) => {
                return Err(ApiError::new(
                    "auth_failed",
                    format!("The OAuth callback listener failed: {}", error),
                    true,
                ));
            }
        }
    }
}

#[derive(Debug, PartialEq, Eq)]
enum CallbackOutcome {
    Authorized(String),
    ProviderError(String),
    InvalidState,
    MissingCode,
    Ignore,
}

fn inspect_callback(target: &str, expected_state: &str, expected_path: &str) -> CallbackOutcome {
    let Ok(url) = Url::parse(&format!("http://127.0.0.1{}", target)) else {
        return CallbackOutcome::Ignore;
    };

    if url.path() != expected_path {
        return CallbackOutcome::Ignore;
    }

    let params: std::collections::HashMap<String, String> =
        url.query_pairs().into_owned().collect();

    let Some(state) = params.get("state") else {
        return CallbackOutcome::InvalidState;
    };

    if !constant_time_eq(state, expected_state) {
        return CallbackOutcome::InvalidState;
    }

    if let Some(error) = params.get("error") {
        let description = params
            .get("error_description")
            .map(|value| truncate(value, 300))
            .unwrap_or_else(|| error.clone());

        return CallbackOutcome::ProviderError(format!(
            "The provider did not authorize DayOS: {}",
            description
        ));
    }

    match params.get("code") {
        Some(code) if !code.trim().is_empty() => CallbackOutcome::Authorized(code.clone()),
        _ => CallbackOutcome::MissingCode,
    }
}

fn truncate(value: &str, max_chars: usize) -> String {
    value.chars().take(max_chars).collect()
}

fn response_page(title: &str, message: &str, is_success: bool) -> String {
    let escaped_title = escape_html(title);
    let escaped_message = escape_html(message);

    let (icon_svg, glow_color, badge_text, badge_color) = if is_success {
        (
            r##"<div style="width:72px;height:72px;margin:0 auto 20px;border-radius:50%;background:rgba(16,185,129,0.12);border:2px solid rgba(16,185,129,0.4);display:flex;align-items:center;justify-content:center;box-shadow:0 0 30px rgba(16,185,129,0.25);">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
            </div>"##,
            "rgba(16, 185, 129, 0.15)",
            "Connected to DayOS",
            "#10B981",
        )
    } else {
        (
            r##"<div style="width:72px;height:72px;margin:0 auto 20px;border-radius:50%;background:rgba(239,68,68,0.12);border:2px solid rgba(239,68,68,0.4);display:flex;align-items:center;justify-content:center;box-shadow:0 0 30px rgba(239,68,68,0.25);">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
            </div>"##,
            "rgba(239, 68, 68, 0.15)",
            "Authentication Notice",
            "#EF4444",
        )
    };

    let auto_close_script = if is_success {
        r##"<script>
            let seconds = 4;
            const timerEl = document.getElementById('countdown');
            const countdownInterval = setInterval(() => {
                seconds--;
                if (timerEl) timerEl.textContent = seconds;
                if (seconds <= 0) {
                    clearInterval(countdownInterval);
                    window.close();
                }
            }, 1000);
        </script>"##
    } else {
        ""
    };

    let countdown_html = if is_success {
        r##"<p style="margin:20px 0 0;color:#64748B;font-size:12px;display:flex;align-items:center;justify-content:center;gap:6px;">
            <span>This window will attempt to close in <strong id="countdown" style="color:#94A3B8;">4</strong>s</span>
        </p>"##
    } else {
        ""
    };

    format!(
        r##"<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>{title} • DayOS</title>
    <style>
        * {{ box-sizing: border-box; }}
        body {{
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: radial-gradient(circle at 50% 25%, {glow_color}, transparent 55%), radial-gradient(circle at 80% 80%, rgba(99, 102, 241, 0.08), transparent 45%), #090D16;
            color: #F8FAFC;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            padding: 24px;
        }}
        .card {{
            background: rgba(15, 23, 42, 0.85);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 24px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 40px -10px {glow_color};
            backdrop-filter: blur(24px);
            -webkit-backdrop-filter: blur(24px);
            max-width: 440px;
            width: 100%;
            padding: 40px 32px;
            text-align: center;
        }}
        .brand {{
            display: inline-flex;
            align-items: center;
            gap: 8px;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            color: #94A3B8;
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid rgba(255, 255, 255, 0.08);
            padding: 6px 14px;
            border-radius: 9999px;
            margin-bottom: 24px;
        }}
        .dot {{
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: {badge_color};
            box-shadow: 0 0 8px {badge_color};
        }}
        h1 {{
            font-size: 22px;
            font-weight: 700;
            margin: 0 0 10px;
            color: #FFFFFF;
            letter-spacing: -0.02em;
        }}
        p.desc {{
            margin: 0 0 28px;
            color: #94A3B8;
            font-size: 14px;
            line-height: 1.6;
        }}
        .btn {{
            display: inline-block;
            width: 100%;
            padding: 12px 20px;
            background: #2563EB;
            color: #FFFFFF;
            font-size: 14px;
            font-weight: 600;
            border: none;
            border-radius: 12px;
            cursor: pointer;
            text-decoration: none;
            transition: all 0.2s ease;
            box-shadow: 0 4px 14px rgba(37, 99, 235, 0.35);
        }}
        .btn:hover {{
            background: #1D4ED8;
            transform: translateY(-1px);
        }}
    </style>
</head>
<body>
    <div class="card">
        <div class="brand">
            <span class="dot"></span>
            <span>{badge_text}</span>
        </div>
        {icon_svg}
        <h1>{title}</h1>
        <p class="desc">{message}</p>
        <button class="btn" onclick="window.close()">Return to DayOS</button>
        {countdown_html}
    </div>
    {auto_close_script}
</body>
</html>"##,
        title = escaped_title,
        message = escaped_message,
        glow_color = glow_color,
        badge_text = badge_text,
        badge_color = badge_color,
        icon_svg = icon_svg,
        countdown_html = countdown_html,
        auto_close_script = auto_close_script
    )
}

fn escape_html(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}

fn write_response(stream: &mut TcpStream, status: &str, html: &str) {
    let body = html.as_bytes();
    let header = format!(
        "HTTP/1.1 {}\r\nContent-Type: text/html; charset=utf-8\r\n\
         Content-Length: {}\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n",
        status,
        body.len()
    );

    let _ = stream.write_all(header.as_bytes());
    let _ = stream.write_all(body);
    let _ = stream.flush();
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::integrations::oauth::config::{GOOGLE_PROVIDER_KEY, OAuthConfig};
    use crate::integrations::oauth::pkce::Pkce;

    fn test_config() -> OAuthConfig {
        OAuthConfig {
            provider: GOOGLE_PROVIDER_KEY,
            client_id: "client-id".to_string(),
            client_secret: None,
            auth_url: "https://accounts.google.com/o/oauth2/v2/auth",
            token_url: "https://oauth2.googleapis.com/token",
            revoke_url: "https://oauth2.googleapis.com/revoke",
            scopes: vec!["openid".to_string(), "email".to_string()],
            redirect_port: 0,
            redirect_path: "/callback".to_string(),
            timeout: Duration::from_secs(30),
        }
    }

    #[test]
    fn authorization_url_contains_pkce_and_state() {
        let config = test_config();
        let pkce = Pkce::generate();
        let url = build_authorization_url(&config, "http://127.0.0.1:4567/callback", &pkce)
            .expect("url should build");
        let parsed = Url::parse(&url).expect("url should parse");
        let params: std::collections::HashMap<String, String> =
            parsed.query_pairs().into_owned().collect();

        assert_eq!(params.get("client_id").map(String::as_str), Some("client-id"));
        assert_eq!(
            params.get("redirect_uri").map(String::as_str),
            Some("http://127.0.0.1:4567/callback")
        );
        assert_eq!(
            params.get("code_challenge").map(String::as_str),
            Some(pkce.challenge.as_str())
        );
        assert_eq!(
            params.get("code_challenge_method").map(String::as_str),
            Some("S256")
        );
        assert_eq!(params.get("state").map(String::as_str), Some(pkce.state.as_str()));
        assert_eq!(params.get("access_type").map(String::as_str), Some("offline"));
    }

    #[test]
    fn callback_accepts_matching_state() {
        assert_eq!(
            inspect_callback("/callback?code=abc&state=expected", "expected", "/callback"),
            CallbackOutcome::Authorized("abc".to_string())
        );
    }

    #[test]
    fn google_root_callback_is_supported() {
        assert_eq!(
            inspect_callback("/?code=abc&state=expected", "expected", "/"),
            CallbackOutcome::Authorized("abc".to_string())
        );
        assert_eq!(redirect_uri_for(9004, "/"), "http://127.0.0.1:9004");
    }

    #[test]
    fn callback_rejects_wrong_state() {
        assert_eq!(
            inspect_callback("/callback?code=abc&state=wrong", "expected", "/callback"),
            CallbackOutcome::InvalidState
        );
    }

    #[test]
    fn callback_surfaces_provider_error() {
        match inspect_callback(
            "/callback?error=access_denied&state=expected",
            "expected",
            "/callback",
        ) {
            CallbackOutcome::ProviderError(message) => {
                assert!(message.contains("access_denied"));
            }
            other => panic!("unexpected outcome: {:?}", other),
        }
    }

    #[test]
    fn non_callback_paths_are_ignored() {
        assert_eq!(
            inspect_callback("/favicon.ico", "expected", "/callback"),
            CallbackOutcome::Ignore
        );
    }
}
