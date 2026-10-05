//! Native keke MCP document management; preserves unknown configuration keys.
use serde_json::{Value, json};
use std::{collections::BTreeMap, path::Path};

pub type McpServers = BTreeMap<String, Value>;
static WRITE_LOCK: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

fn path() -> Result<std::path::PathBuf, String> {
    Ok(dirs::home_dir().ok_or("Home directory unavailable")?.join(".keke/.mcp.json"))
}

fn document(path: &Path) -> Result<Value, String> {
    let root: Value = match std::fs::read(path) {
        Ok(bytes) => serde_json::from_slice(&bytes).map_err(|e| e.to_string())?,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => json!({"mcpServers": {}}),
        Err(e) => return Err(e.to_string()),
    };
    if !root.is_object() || root.get("mcpServers").is_some_and(|v| !v.is_object()) {
        return Err("Invalid keke MCP document: expected object with mcpServers map".into());
    }
    Ok(root)
}

pub fn acp_entry(name: &str, config: &Value) -> Result<Value, String> {
    let pairs = |key: &str| -> Result<Vec<Value>, String> {
        let Some(value) = config.get(key) else { return Ok(vec![]); };
        value.as_object().ok_or_else(|| format!("{key} must be an object"))?.iter()
            .map(|(name, value)| value.as_str().map(|value| json!({"name":name,"value":value}))
                .ok_or_else(|| format!("{key} values must be strings"))).collect()
    };
    if !config.is_object() { return Err("Server must be an object".into()); }
    if config.get("disabled").is_some_and(|v| !v.is_boolean()) {
        return Err("disabled must be boolean".into());
    }
    let kind = config.get("type").map(|v| v.as_str().unwrap_or("")).unwrap_or("stdio");
    match kind {
        "stdio" => {
            let command = config.get("command").and_then(Value::as_str).filter(|v| !v.trim().is_empty()).ok_or("Missing command")?;
            let args = config.get("args").cloned().unwrap_or(json!([]));
            if !args.as_array().is_some_and(|v| v.iter().all(Value::is_string)) { return Err("args must be strings".into()); }
            Ok(json!({"name":name,"command":command,"args":args,"env":pairs("env")?}))
        }
        "http" | "sse" => {
            let url = config.get("url").and_then(Value::as_str).filter(|v| v.starts_with("https://") || v.starts_with("http://")).ok_or("Missing HTTP(S) URL")?;
            Ok(json!({"type":kind,"name":name,"url":url,"headers":pairs("headers")?}))
        }
        _ => Err("Unsupported MCP transport".into()),
    }
}

pub async fn read_mcp_servers() -> Result<McpServers, String> {
    let root = document(&path()?)?;
    serde_json::from_value(root.get("mcpServers").cloned().unwrap_or(json!({}))).map_err(|e| e.to_string())
}

async fn update(name: String, config: Option<Value>) -> Result<(), String> {
    if name.trim().is_empty() || name == "codexia-bots" { return Err("Empty or reserved server name".into()); }
    if let Some(config) = &config { acp_entry(&name, config)?; }
    let _guard = WRITE_LOCK.lock().await;
    let path = path()?;
    let mut root = document(&path)?;
    let servers = root.as_object_mut().unwrap().entry("mcpServers").or_insert(json!({})).as_object_mut().unwrap();
    match config {
        Some(config) => {
            if servers.contains_key(&name) { return Err("Server exists; remove explicitly before replacing".into()); }
            servers.insert(name, config);
        }
        None => { servers.remove(&name); }
    }
    std::fs::create_dir_all(path.parent().unwrap()).map_err(|e| e.to_string())?;
    let temp = path.with_file_name(format!(".mcp.{}.tmp", uuid::Uuid::new_v4()));
    let result = (|| {
        use std::io::Write;
        let mut options = std::fs::OpenOptions::new();
        options.write(true).create_new(true);
        #[cfg(unix)]
        { use std::os::unix::fs::OpenOptionsExt; options.mode(0o600); }
        let mut file = options.open(&temp).map_err(|e| e.to_string())?;
        file.write_all(serde_json::to_string_pretty(&root).map_err(|e| e.to_string())?.as_bytes()).map_err(|e| e.to_string())?;
        file.sync_all().map_err(|e| e.to_string())?;
        std::fs::rename(&temp, &path).map_err(|e| e.to_string())
    })();
    if result.is_err() { let _ = std::fs::remove_file(temp); }
    result
}

pub async fn add_mcp_server(name: String, config: Value) -> Result<(), String> { update(name, Some(config)).await }
pub async fn remove_mcp_server(name: String) -> Result<(), String> { update(name, None).await }

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct McpAuthStatus {
    pub signed_in: Option<bool>,
    pub error: Option<String>,
}

fn remote_url(config: &Value) -> Result<&str, String> {
    if config.get("disabled").and_then(Value::as_bool) == Some(true) {
        return Err("Enable this connector before authorizing it".into());
    }
    match config.get("type").and_then(Value::as_str) {
        Some("http" | "sse") => config.get("url").and_then(Value::as_str).ok_or("Missing server URL".into()),
        _ => Err("Local connectors do not use browser authorization".into()),
    }
}

fn cli_command(agent: &crate::agents::AcpAgentDef, action: &str, name: &str, home: &Path) -> Result<tokio::process::Command, String> {
    let prefix = agent.args.strip_suffix(&["agent".into(), "stdio".into()])
        .ok_or("Keke launcher does not support MCP commands")?;
    let mut command = tokio::process::Command::new(&agent.command);
    command.args(prefix).args(["mcp", action, "--", name]).envs(&agent.env)
        .env("KEKE_HOME", home).current_dir(home)
        .stdin(std::process::Stdio::null()).kill_on_drop(true);
    Ok(command)
}

async fn run_cli(action: &str, name: &str, timeout: std::time::Duration) -> Result<String, String> {
    let agent = crate::agents::find_preset("keke").ok_or("Keke is unavailable")?;
    if !agent.local { return Err("Install Keke before authorizing connectors".into()); }
    let home = path()?.parent().ok_or("Keke home unavailable")?.to_path_buf();
    let mut command = cli_command(&agent, action, name, &home)?;
    let output = tokio::time::timeout(timeout, command.output()).await
        .map_err(|_| "Authorization timed out; try again".to_string())?
        .map_err(|error| error.to_string())?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }
    Ok(String::from_utf8_lossy(&output.stdout).into_owned())
}

fn signed_in(output: &str) -> Result<bool, String> {
    let value = output.lines().find_map(|line| line.strip_prefix("signed in: "))
        .ok_or("Keke did not report authorization status; update Keke")?;
    match value {
        "yes" => Ok(true),
        value if value == "no" || value.starts_with("no ") => Ok(false),
        _ => Err("Keke returned an unknown authorization status".into()),
    }
}

/// Use the same installed launcher and credential store as the Bot runtime.
/// A stored credential is reported as signed in, never as a verified connection.
pub async fn read_mcp_auth_statuses() -> Result<BTreeMap<String, McpAuthStatus>, String> {
    let servers = read_mcp_servers().await?;
    let mut statuses = BTreeMap::new();
    let mut jobs = tokio::task::JoinSet::new();
    for (name, config) in servers {
        if remote_url(&config).is_err() { continue; }
        jobs.spawn(async move {
            let result = run_cli("get", &name, std::time::Duration::from_secs(15)).await
                .and_then(|output| signed_in(&output));
            (name, result)
        });
    }
    while let Some(result) = jobs.join_next().await {
        let (name, result) = result.map_err(|error| error.to_string())?;
        statuses.insert(name, match result {
            Ok(value) => McpAuthStatus { signed_in: Some(value), error: None },
            Err(error) => McpAuthStatus { signed_in: None, error: Some(error) },
        });
    }
    Ok(statuses)
}

static LOGIN_LOCK: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

/// OAuth discovery, browser launch, callback validation and storage belong to Keke.
pub async fn login_mcp_server(name: String) -> Result<(), String> {
    let _guard = LOGIN_LOCK.try_lock().map_err(|_| "Another connector is being authorized")?;
    let servers = read_mcp_servers().await?;
    let config = servers.get(&name).ok_or("Connector is no longer configured")?;
    let original_url = remote_url(config)?.to_string();
    run_cli("login", &name, std::time::Duration::from_secs(360)).await?;
    let current = read_mcp_servers().await?;
    let current_url = current.get(&name).map(remote_url).transpose()?;
    if current_url != Some(original_url.as_str()) {
        return Err("Connector changed during authorization; authorize the current configuration".into());
    }
    let output = run_cli("get", &name, std::time::Duration::from_secs(15)).await?;
    if !signed_in(&output)? { return Err("Keke did not save an authorization credential".into()); }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn native_transports() {
        for kind in ["http", "sse"] {
            let entry = acp_entry("native", &json!({"type":kind,"url":"https://example.com","headers":{"X-Test":"${TEST_HEADER}"}})).unwrap();
            assert_eq!(entry["name"], "native");
            assert_eq!(entry["type"], kind);
            assert_eq!(entry["headers"][0]["value"], "${TEST_HEADER}");
        }
        let stdio = acp_entry("native", &json!({"command":"fixture","args":["serve"],"env":{"TEST_ENV":"${TEST_VALUE}"}})).unwrap();
        assert_eq!(stdio["name"], "native");
        assert_eq!(stdio["args"], json!(["serve"]));
        assert_eq!(stdio["env"][0]["value"], "${TEST_VALUE}");
        assert!(acp_entry("test", &json!({"command":"node","args":[1]})).is_err());
        assert!(acp_entry("test", &json!({})).is_err());
    }

    #[test]
    fn malformed_documents_are_not_empty_defaults() {
        let path = std::env::temp_dir().join(format!("codexia-mcp-test-{}", uuid::Uuid::new_v4()));
        assert_eq!(document(&path).unwrap(), json!({"mcpServers":{}}));
        for text in ["{broken", "[]", "{\"mcpServers\":[]}"] {
            std::fs::write(&path, text).unwrap();
            assert!(document(&path).is_err());
            assert_eq!(std::fs::read_to_string(&path).unwrap(), text);
        }
        std::fs::write(&path, r#"{"future":true,"mcpServers":{"test":{"command":"node","future":42}}}"#).unwrap();
        let root = document(&path).unwrap();
        assert_eq!(root["future"], true);
        assert_eq!(root["mcpServers"]["test"]["future"], 42);
        std::fs::remove_file(path).unwrap();
    }

    #[test]
    fn authorization_status_is_not_guessed_from_configuration() {
        assert!(signed_in("transport: http\nsigned in: yes\n").unwrap());
        assert!(!signed_in("signed in: no — keke mcp login linear\n").unwrap());
        assert!(signed_in("configured: yes").is_err());
        assert!(remote_url(&json!({"command":"node"})).is_err());
        assert!(remote_url(&json!({"type":"http","url":"https://example.com","disabled":true})).is_err());
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn cli_auth_preserves_launcher_prefix_and_literal_server_name() {
        let root = std::env::temp_dir().join(format!("codexia-auth-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&root).unwrap();
        let script = root.join("fixture.sh");
        std::fs::write(&script, "#!/bin/sh\nprintf '%s\\n' \"$@\"\nprintf '%s\\n' \"$KEKE_HOME\"\n").unwrap();
        let agent = crate::agents::AcpAgentDef {
            id: "keke".into(), name: "Keke".into(), command: "/bin/sh".into(),
            args: vec![script.to_string_lossy().into_owned(), "agent".into(), "stdio".into()],
            env: BTreeMap::new(), available: true, local: true,
        };
        let name = "-server; echo do-not-execute";
        let output = cli_command(&agent, "login", name, &root).unwrap().output().await.unwrap();
        assert!(output.status.success());
        let lines: Vec<_> = std::str::from_utf8(&output.stdout).unwrap().lines().collect();
        assert_eq!(&lines[..4], &["mcp", "login", "--", name]);
        assert_eq!(lines[4], root.to_string_lossy());
        std::fs::remove_dir_all(root).unwrap();
    }
}
