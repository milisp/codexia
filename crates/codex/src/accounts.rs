use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::path::PathBuf;

use crate::app_server::CodexAppServer;
use crate::utils::codex_home;

fn accounts_dir() -> PathBuf {
    codex_home().join("codexia-accounts")
}

fn auth_json_path() -> PathBuf {
    codex_home().join("auth.json")
}

fn sanitize_label(label: &str) -> String {
    label
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '.' || c == '-' || c == '_' || c == '@' {
            c
        } else {
            '_'
        })
        .collect()
}

/// Snapshot of a saved account, mirroring the shape of CODEX_HOME/auth.json
/// plus label/email metadata used to identify it in the switcher UI.
#[derive(Serialize, Deserialize, Clone)]
struct StoredAccount {
    label: String,
    email: Option<String>,
    plan_type: Option<String>,
    account_id: Option<String>,
    auth: Value,
}

#[derive(Serialize)]
pub struct AccountSummary {
    pub label: String,
    pub email: Option<String>,
    #[serde(rename = "planType")]
    pub plan_type: Option<String>,
    #[serde(rename = "isCurrent")]
    pub is_current: bool,
}

fn current_account_id() -> Option<String> {
    let raw = fs::read_to_string(auth_json_path()).ok()?;
    let value: Value = serde_json::from_str(&raw).ok()?;
    value
        .pointer("/tokens/account_id")
        .and_then(Value::as_str)
        .map(str::to_string)
}

/// Copies the current CODEX_HOME/auth.json into the snapshot store under
/// `label`, so it can be restored later without asking the user to log out.
pub fn save_current_account(
    label: &str,
    email: Option<String>,
    plan_type: Option<String>,
) -> Result<(), String> {
    let auth_raw = fs::read_to_string(auth_json_path()).map_err(|e| e.to_string())?;
    let auth: Value = serde_json::from_str(&auth_raw).map_err(|e| e.to_string())?;

    // Only ChatGPT sessions can be restored later. When the active session is an
    // API key (or anything else without tokens), auth.json holds no tokens and
    // saving it would clobber a previously saved snapshot with the same label,
    // making it unswitchable.
    if auth.pointer("/tokens/access_token").is_none() {
        return Ok(());
    }

    let account_id = auth
        .pointer("/tokens/account_id")
        .and_then(Value::as_str)
        .map(str::to_string);

    let dir = accounts_dir();
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

    let stored = StoredAccount {
        label: label.to_string(),
        email,
        plan_type,
        account_id,
        auth,
    };
    let file_name = format!("{}.json", sanitize_label(label));
    let contents = serde_json::to_string_pretty(&stored).map_err(|e| e.to_string())?;
    fs::write(dir.join(file_name), contents).map_err(|e| e.to_string())
}

pub fn list_accounts() -> Result<Vec<AccountSummary>, String> {
    let dir = accounts_dir();
    if !dir.exists() {
        return Ok(Vec::new());
    }
    let current_id = current_account_id();

    let mut accounts = Vec::new();
    for entry in fs::read_dir(&dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }
        let raw = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        let stored: StoredAccount = match serde_json::from_str(&raw) {
            Ok(v) => v,
            Err(_) => continue,
        };
        // Skip snapshots that can't be switched to (e.g. written by an older
        // build while an API-key session was active).
        if stored.auth.pointer("/tokens/access_token").is_none() {
            continue;
        }
        let is_current = match (&stored.account_id, &current_id) {
            (Some(a), Some(b)) => a == b,
            _ => false,
        };
        accounts.push(AccountSummary {
            label: stored.label,
            email: stored.email,
            plan_type: stored.plan_type,
            is_current,
        });
    }
    accounts.sort_by(|a, b| a.label.cmp(&b.label));
    Ok(accounts)
}

pub fn remove_account(label: &str) -> Result<(), String> {
    let path = accounts_dir().join(format!("{}.json", sanitize_label(label)));
    if path.exists() {
        fs::remove_file(path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Switches the active session to `label` without a full logout: replays the
/// saved tokens through `account/login/start` (type `chatgptAuthTokens`),
/// which the app-server accepts as an externally-managed credential update.
pub async fn switch_account(label: &str, codex: &CodexAppServer) -> Result<Value, String> {
    let path = accounts_dir().join(format!("{}.json", sanitize_label(label)));
    let raw = fs::read_to_string(&path).map_err(|_| format!("Account '{label}' not found"))?;
    let stored: StoredAccount = serde_json::from_str(&raw).map_err(|e| e.to_string())?;

    let access_token = stored
        .auth
        .pointer("/tokens/access_token")
        .and_then(Value::as_str)
        .ok_or_else(|| "Saved account is missing an access token".to_string())?;
    let account_id = stored
        .auth
        .pointer("/tokens/account_id")
        .and_then(Value::as_str)
        .ok_or_else(|| "Saved account is missing an account id".to_string())?;

    let params = serde_json::json!({
        "type": "chatgptAuthTokens",
        "accessToken": access_token,
        "chatgptAccountId": account_id,
        "chatgptPlanType": stored.plan_type,
    });

    codex.send_request("account/login/start", params).await
}
