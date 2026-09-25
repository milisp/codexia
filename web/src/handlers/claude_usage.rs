use std::sync::OnceLock;
use std::time::{Duration, Instant};

use axum::{Json, extract::Query};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tokio::sync::Mutex;

use super::{ErrorResponse, to_error_response};

const CACHE_AGE: Duration = Duration::from_secs(180);
static CACHE: OnceLock<Mutex<Option<(Instant, ClaudeUsage)>>> = OnceLock::new();

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct UsageWindow {
    used_percent: f64,
    resets_at: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ClaudeUsage {
    five_hour: Option<UsageWindow>,
    seven_day: Option<UsageWindow>,
    fetched_at: String,
}

#[derive(Deserialize)]
pub(crate) struct UsageQuery {
    refresh: Option<bool>,
}

pub(crate) async fn api_claude_usage(
    Query(query): Query<UsageQuery>,
) -> Result<Json<ClaudeUsage>, ErrorResponse> {
    let cache = CACHE.get_or_init(|| Mutex::new(None));
    let mut guard = cache.lock().await;
    if !query.refresh.unwrap_or(false)
        && let Some((at, usage)) = guard.as_ref()
        && at.elapsed() < CACHE_AGE
    {
        return Ok(Json(usage.clone()));
    }

    let usage = fetch_usage().await.map_err(to_error_response)?;
    *guard = Some((Instant::now(), usage.clone()));
    Ok(Json(usage))
}

fn parse_window(value: Option<&Value>) -> Option<UsageWindow> {
    let value = value?;
    let percent = value.get("utilization")?.as_f64()?;
    if !percent.is_finite() || !(0.0..=100.0).contains(&percent) {
        return None;
    }
    Some(UsageWindow {
        used_percent: percent,
        resets_at: value.get("resets_at").and_then(Value::as_str).map(str::to_owned),
    })
}

#[cfg(target_os = "macos")]
async fn read_claude_token() -> Result<String, String> {
    // The credentials remain in the backend. Never log the command output.
    let output = tokio::time::timeout(
        Duration::from_secs(20),
        tokio::process::Command::new("/usr/bin/security")
            .args(["find-generic-password", "-s", "Claude Code-credentials", "-w"])
            .kill_on_drop(true)
            .output(),
    )
    .await
    .map_err(|_| "Keychain access timed out".to_string())?
    .map_err(|_| "Could not read Claude Code credentials from Keychain".to_string())?;
    if !output.status.success() {
        return Err("Claude Code credentials are unavailable in Keychain".to_string());
    }
    token_from_json(&output.stdout)
}

#[cfg(not(target_os = "macos"))]
async fn read_claude_token() -> Result<String, String> {
    let path = dirs::home_dir()
        .ok_or("Home directory is unavailable")?
        .join(".claude/.credentials.json");
    let bytes = tokio::fs::read(path)
        .await
        .map_err(|_| "Claude Code credentials are unavailable".to_string())?;
    token_from_json(&bytes)
}

fn token_from_json(bytes: &[u8]) -> Result<String, String> {
    let json: Value = serde_json::from_slice(bytes)
        .map_err(|_| "Claude Code credentials are invalid".to_string())?;
    json.pointer("/claudeAiOauth/accessToken")
        .and_then(Value::as_str)
        .filter(|token| !token.is_empty())
        .map(str::to_owned)
        .ok_or("Claude Code OAuth token is unavailable".to_string())
}

async fn fetch_usage() -> Result<ClaudeUsage, String> {
    let token = read_claude_token().await?;
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|_| "Could not create Claude usage client".to_string())?;
    let response = client
        .get("https://api.anthropic.com/api/oauth/usage")
        .bearer_auth(token)
        .header("anthropic-beta", "oauth-2025-04-20")
        .send()
        .await
        .map_err(|_| "Could not reach Claude usage service".to_string())?;
    if !response.status().is_success() {
        return Err(match response.status().as_u16() {
            401 | 403 => "Claude Code login expired; sign in again with Claude Code".to_string(),
            429 => "Claude usage service is rate limiting requests".to_string(),
            _ => format!("Claude usage service returned HTTP {}", response.status().as_u16()),
        });
    }
    let json: Value = response.json().await.map_err(|_| "Claude usage response is invalid".to_string())?;
    Ok(ClaudeUsage {
        five_hour: parse_window(json.get("five_hour")),
        seven_day: parse_window(json.get("seven_day")),
        fetched_at: chrono::Utc::now().to_rfc3339(),
    })
}
