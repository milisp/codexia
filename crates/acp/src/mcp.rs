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
            let mut entry = json!({"type":kind,"name":name,"url":url,"headers":pairs("headers")?});
            if let Some(meta) = config.get("_meta") {
                if !meta.is_object() { return Err("MCP metadata must be an object".into()); }
                entry["_meta"] = meta.clone();
            }
            if let Some(oauth) = config.get("oauth") {
                if !oauth.is_object() { return Err("MCP OAuth configuration must be an object".into()); }
                if entry.get("_meta").is_none() { entry["_meta"] = json!({}); }
                entry["_meta"]["keke.dev/oauth"] = oauth.clone();
            }
            Ok(entry)
        }
        _ => Err("Unsupported MCP transport".into()),
    }
}

fn configure_oauth(config: &mut Value) {
    if config.get("oauth").is_some() { return; }
    if let Some(oauth) = config.get("_meta").and_then(|meta| meta.get("keke.dev/oauth")).cloned() {
        config["oauth"] = oauth;
        return;
    }
    if github_url(config).is_err() { return; }
    let Ok(client_id) = std::env::var("MCP_GITHUB_CLIENT_ID") else { return; };
    if client_id.trim().is_empty() { return; }
    let mut oauth = json!({"client_id":client_id.trim(), "redirect_uri":
        std::env::var("MCP_GITHUB_REDIRECT_URI").unwrap_or_else(|_| "http://127.0.0.1:8765/callback".into())});
    if std::env::var("MCP_GITHUB_CLIENT_SECRET").is_ok_and(|value| !value.trim().is_empty()) {
        oauth["client_secret"] = json!("${MCP_GITHUB_CLIENT_SECRET}");
    }
    config["oauth"] = oauth;
}

pub async fn read_mcp_servers() -> Result<McpServers, String> {
    let root = document(&path()?)?;
    let mut servers: McpServers = serde_json::from_value(root.get("mcpServers").cloned().unwrap_or(json!({}))).map_err(|e| e.to_string())?;
    for config in servers.values_mut() { configure_oauth(config); }
    Ok(servers)
}

async fn update(name: String, mut config: Option<Value>) -> Result<(), String> {
    if name.trim().is_empty() || name == "codexia-bots" { return Err("Empty or reserved server name".into()); }
    if let Some(config) = &mut config { configure_oauth(config); acp_entry(&name, config)?; }
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
    save_document(&path, &root)
}

fn save_document(path: &Path, root: &Value) -> Result<(), String> {
    std::fs::create_dir_all(path.parent().ok_or("Invalid configuration path")?).map_err(|e| e.to_string())?;
    let temp = path.with_file_name(format!(".mcp.{}.tmp", uuid::Uuid::new_v4()));
    let result = (|| {
        use std::io::Write;
        let mut options = std::fs::OpenOptions::new();
        options.write(true).create_new(true);
        #[cfg(unix)]
        { use std::os::unix::fs::OpenOptionsExt; options.mode(0o600); }
        let mut file = options.open(&temp).map_err(|e| e.to_string())?;
        file.write_all(serde_json::to_string_pretty(root).map_err(|e| e.to_string())?.as_bytes()).map_err(|e| e.to_string())?;
        file.sync_all().map_err(|e| e.to_string())?;
        std::fs::rename(&temp, path).map_err(|e| e.to_string())
    })();
    if result.is_err() { let _ = std::fs::remove_file(temp); }
    result
}

pub async fn add_mcp_server(name: String, config: Value) -> Result<(), String> { update(name, Some(config)).await }
pub async fn remove_mcp_server(name: String) -> Result<(), String> { update(name, None).await }

fn github_url(config: &Value) -> Result<String, String> {
    let raw = remote_url(config)?;
    let url = reqwest::Url::parse(raw).map_err(|_| "Invalid GitHub MCP URL")?;
    if url.scheme() != "https" || url.host_str() != Some("api.githubcopilot.com")
        || !url.username().is_empty() || url.password().is_some() || url.port_or_known_default() != Some(443) {
        return Err("GitHub tokens can only be sent to the official GitHub MCP server".into());
    }
    Ok(raw.to_string())
}

fn has_auth_header(config: &Value) -> bool {
    config.get("headers").and_then(Value::as_object).is_some_and(|headers| {
        headers.iter().any(|(name, value)| name.eq_ignore_ascii_case("authorization")
            && value.as_str().is_some_and(|value| !value.trim().is_empty() && !value.contains("${")))
    })
}

fn set_auth_header(config: &mut Value, token: &str) -> Result<(), String> {
    let headers = config.as_object_mut().ok_or("Invalid connector configuration")?
        .entry("headers").or_insert(json!({})).as_object_mut().ok_or("Invalid headers")?;
    headers.retain(|name, _| !name.eq_ignore_ascii_case("authorization"));
    headers.insert("Authorization".into(), Value::String(format!("Bearer {token}")));
    Ok(())
}

async fn verify_github_token(url: &str, token: &str) -> Result<(), String> {
    let client = reqwest::Client::builder().redirect(reqwest::redirect::Policy::none())
        .timeout(std::time::Duration::from_secs(30)).build().map_err(|_| "Could not prepare GitHub authorization")?;
    let response = client.post(url).bearer_auth(token).header("Accept", "application/json, text/event-stream")
        .json(&json!({"jsonrpc":"2.0","id":1,"method":"initialize","params":{
            "protocolVersion":"2025-06-18","capabilities":{},
            "clientInfo":{"name":"codexia","version":env!("CARGO_PKG_VERSION")}
        }})).send().await.map_err(|_| "Could not reach GitHub. Try again.")?;
    match response.status().as_u16() {
        200..=299 => Ok(()),
        401 => Err("GitHub rejected this token. Check that it is valid and has not expired.".into()),
        403 => Err("GitHub denied access. Check the token's permissions and organization approval.".into()),
        _ => Err(format!("GitHub could not authorize this connector (HTTP {}).", response.status().as_u16())),
    }
}

/// GitHub does not support dynamic registration; use its supported bearer token path.
pub async fn authorize_github_mcp(name: String, token: String) -> Result<(), String> {
    let token = token.trim();
    if token.is_empty() || token.chars().any(char::is_whitespace) {
        return Err("Enter a GitHub personal access token".into());
    }
    let servers = read_mcp_servers().await?;
    let original = servers.get(&name).ok_or("Connector is no longer configured")?;
    let url = github_url(original)?;
    verify_github_token(&url, token).await?;
    let _guard = WRITE_LOCK.lock().await;
    let path = path()?;
    let mut root = document(&path)?;
    let config = root.get_mut("mcpServers").and_then(Value::as_object_mut)
        .and_then(|servers| servers.get_mut(&name)).ok_or("Connector is no longer configured")?;
    if github_url(config)? != url { return Err("Connector changed during authorization. Try again.".into()); }
    set_auth_header(config, token)?;
    save_document(&path, &root)
}

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
        if has_auth_header(&config) {
            statuses.insert(name, McpAuthStatus { signed_in: Some(true), error: None });
            continue;
        }
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
    if github_url(config).is_ok() && config.get("oauth").is_none() {
        return Err("Configure MCP_GITHUB_CLIENT_ID before authorizing GitHub in the browser".into());
    }
    // CLI login reads the native document; ACP metadata alone is not enough.
    if let Some(oauth) = config.get("oauth") {
        let _write = WRITE_LOCK.lock().await;
        let path = path()?;
        let mut root = document(&path)?;
        let stored = root.get_mut("mcpServers").and_then(|servers| servers.get_mut(&name))
            .ok_or("Connector is no longer configured")?;
        if remote_url(stored)? != original_url { return Err("Connector changed before authorization".into()); }
        stored["oauth"] = oauth.clone();
        save_document(&path, &root)?;
    }
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
    fn oauth_metadata_survives_native_and_acp_conversion() {
        let oauth = json!({"client_id":"fixture", "client_secret":"${FIXTURE_SECRET}", "redirect_uri":"http://127.0.0.1:8765/callback"});
        for kind in ["http", "sse"] {
            let mut config = json!({"type":kind,"url":"https://example.com/mcp", "_meta":{"other":"preserved", "keke.dev/oauth":oauth}});
            configure_oauth(&mut config);
            assert_eq!(config["oauth"], oauth);
            let entry = acp_entry("fixture", &config).unwrap();
            assert_eq!(entry["_meta"]["keke.dev/oauth"], oauth);
            assert_eq!(entry["_meta"]["other"], "preserved");
            assert!(entry.to_string().contains("${FIXTURE_SECRET}"));
        }
    }

    #[test]
    fn github_tokens_are_scoped_to_the_official_host_and_preserve_configuration() {
        for url in ["https://api.githubcopilot.com.evil.test/mcp/", "http://api.githubcopilot.com/mcp/", "https://user@api.githubcopilot.com/mcp/", "https://api.githubcopilot.com:8443/mcp/"] {
            assert!(github_url(&json!({"type":"http","url":url})).is_err());
        }
        let mut config = json!({"type":"http","url":"https://api.githubcopilot.com/mcp/","future":42,"headers":{"authorization":"old","X-Custom":"kept"}});
        assert!(github_url(&config).is_ok());
        set_auth_header(&mut config, "fixture-token").unwrap();
        assert_eq!(config["headers"]["Authorization"], "Bearer fixture-token");
        assert!(config["headers"].get("authorization").is_none());
        assert_eq!(config["headers"]["X-Custom"], "kept");
        assert_eq!(config["future"], 42);
        assert!(has_auth_header(&config));
        assert!(!has_auth_header(&json!({"headers":{"Authorization":"Bearer ${TOKEN}"}})));
    }

    #[tokio::test]
    async fn github_authorization_checks_the_mcp_endpoint_and_redacts_failures() {
        use tokio::io::{AsyncReadExt, AsyncWriteExt};
        for status in [200, 401, 403] {
            let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
            let endpoint = format!("http://{}/mcp/", listener.local_addr().unwrap());
            let server = tokio::spawn(async move {
                let (mut socket, _) = listener.accept().await.unwrap();
                let mut request = Vec::new();
                loop {
                    let mut buffer = [0; 2048];
                    let count = socket.read(&mut buffer).await.unwrap();
                    if count == 0 { break; }
                    request.extend_from_slice(&buffer[..count]);
                    if request.windows(4).any(|bytes| bytes == b"\r\n\r\n") { break; }
                }
                let request = String::from_utf8(request).unwrap().to_lowercase();
                assert!(request.starts_with("post /mcp/"));
                assert!(request.contains("authorization: bearer fixture-token"));
                let response = format!("HTTP/1.1 {status} Test\r\nContent-Length: 0\r\nConnection: close\r\n\r\n");
                socket.write_all(response.as_bytes()).await.unwrap();
            });
            let result = verify_github_token(&endpoint, "fixture-token").await;
            if status == 200 { assert!(result.is_ok()); }
            else { assert!(!result.unwrap_err().contains("fixture-token")); }
            server.await.unwrap();
        }
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
