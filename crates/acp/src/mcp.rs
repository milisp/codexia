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
}
