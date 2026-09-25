use codexia_codex::config::mcp::McpServerConfig;
use serde_json::Value as JsonValue;
use std::collections::HashMap;

use crate::mcp::{
    ClaudeCodeMcpServer, cc_mcp_add, cc_mcp_disable, cc_mcp_enable, cc_mcp_list, cc_mcp_remove,
};
use codexia_codex as codex;

/// Unified command to add MCP server for either Codex or CC
pub async fn unified_add_mcp_server(
    client_name: String,
    path: Option<String>,
    server_name: String,
    server_config: JsonValue,
    scope: Option<String>,
) -> Result<(), String> {
    match client_name.as_str() {
        "codex" => {
            let config: McpServerConfig = serde_json::from_value(server_config)
                .map_err(|e| format!("Failed to parse Codex MCP config: {}", e))?;
            codex::add_mcp_server(server_name, config).await
        }
        "cc" => {
            let scope = scope.unwrap_or_else(|| "local".to_string());
            // Global servers live in ~/.claude.json, so no project path is needed.
            let working_dir = match path {
                Some(path) => path,
                None if scope == "global" => String::new(),
                None => return Err("CC requires a project path".to_string()),
            };

            let cc_server = ClaudeCodeMcpServer {
                name: server_name.clone(),
                r#type: server_config
                    .get("type")
                    .and_then(|v| v.as_str())
                    .unwrap_or("stdio")
                    .to_string(),
                url: server_config
                    .get("url")
                    .and_then(|v| v.as_str())
                    .map(String::from),
                command: server_config
                    .get("command")
                    .and_then(|v| v.as_str())
                    .map(String::from),
                args: server_config.get("args").and_then(|v| {
                    v.as_array().map(|arr| {
                        arr.iter()
                            .filter_map(|v| v.as_str())
                            .map(String::from)
                            .collect()
                    })
                }),
                env: server_config.get("env").and_then(|v| {
                    v.as_object().map(|obj| {
                        obj.iter()
                            .filter_map(|(k, v)| v.as_str().map(|s| (k.clone(), s.to_string())))
                            .collect()
                    })
                }),
                scope,
                enabled: true,
            };

            cc_mcp_add(cc_server, working_dir).await.map(|_| ())
        }
        _ => Err(format!("Unknown client: {}", client_name)),
    }
}

/// Unified command to enable MCP server for either Codex or CC
pub async fn unified_enable_mcp_server(
    client_name: String,
    path: Option<String>,
    server_name: String,
) -> Result<(), String> {
    match client_name.as_str() {
        "codex" => codex::set_mcp_server_enabled(server_name, true).await,
        "cc" => {
            let working_dir = path.ok_or("CC requires a project path")?;
            cc_mcp_enable(server_name, working_dir).await.map(|_| ())
        }
        _ => Err(format!("Unknown client: {}", client_name)),
    }
}

/// Unified command to disable MCP server for either Codex or CC
pub async fn unified_disable_mcp_server(
    client_name: String,
    path: Option<String>,
    server_name: String,
) -> Result<(), String> {
    match client_name.as_str() {
        "codex" => codex::set_mcp_server_enabled(server_name, false).await,
        "cc" => {
            let working_dir = path.ok_or("CC requires a project path")?;
            cc_mcp_disable(server_name, working_dir).await.map(|_| ())
        }
        _ => Err(format!("Unknown client: {}", client_name)),
    }
}

/// Unified command to remove MCP server for either Codex or CC
pub async fn unified_remove_mcp_server(
    client_name: String,
    path: Option<String>,
    server_name: String,
    scope: Option<String>,
) -> Result<(), String> {
    match client_name.as_str() {
        "codex" => codex::delete_mcp_server(server_name).await,
        "cc" => {
            let working_dir = path.ok_or("CC requires a project path")?;
            let scope = scope.ok_or("CC requires a scope for removal")?;
            cc_mcp_remove(server_name, working_dir, scope)
                .await
                .map(|_| ())
        }
        _ => Err(format!("Unknown client: {}", client_name)),
    }
}

/// Unified command to read MCP configuration for either Codex or CC
pub async fn unified_read_mcp_config(
    client_name: String,
    path: Option<String>,
) -> Result<JsonValue, String> {
    match client_name.as_str() {
        "codex" => {
            let servers = codex::read_mcp_servers().await?;
            Ok(serde_json::json!({
                "mcpServers": servers
            }))
        }
        "cc" => {
            let working_dir = path.ok_or("CC requires a project path")?;
            let servers = cc_mcp_list(working_dir).await?;

            let mut servers_map: HashMap<String, JsonValue> = HashMap::new();
            for server in servers {
                let mut server_json = serde_json::json!({
                    "type": server.r#type,
                    "enabled": server.enabled,
                    "scope": server.scope,
                });

                if let Some(url) = server.url {
                    server_json["url"] = JsonValue::String(url);
                }
                if let Some(command) = server.command {
                    server_json["command"] = JsonValue::String(command);
                }
                if let Some(args) = server.args {
                    server_json["args"] = serde_json::json!(args);
                }
                if let Some(env) = server.env {
                    server_json["env"] = serde_json::json!(env);
                }

                servers_map.insert(server.name, server_json);
            }

            Ok(serde_json::json!({
                "mcpServers": servers_map
            }))
        }
        _ => Err(format!("Unknown client: {}", client_name)),
    }
}
