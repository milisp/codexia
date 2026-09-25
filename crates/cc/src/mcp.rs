use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

// ~/.claude.json {projects: { "working_dir": "mcpServers": {server}, disabledMcpServers:[server_name]}, mcpServers: {}, other_keys: {}}
// {'sentry': {'type': 'http', 'url': 'https://mcp.sentry.dev/mcp'},
//  'airtable': {'type': 'stdio', 'command': 'npx', 'args': ['-y', 'airtable-mcp-server'], 'env': {'AIRTABLE_API_KEY': 'YOUR_KEY'}}}
// $working_dir/.mcp.json {mcpServers: {}}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ClaudeCodeMcpServer {
    pub name: String,
    pub r#type: String, // "http", "sse", "stdio"
    pub url: Option<String>,
    pub command: Option<String>,
    pub args: Option<Vec<String>>,
    pub env: Option<HashMap<String, String>>,
    pub scope: String, // "global", "project", "local"
    pub enabled: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ClaudeCodeResponse {
    pub success: bool,
    pub message: String,
}

/// List all MCP servers configured in Claude Code
pub async fn cc_mcp_list(working_dir: String) -> Result<Vec<ClaudeCodeMcpServer>, String> {
    let cc_config_path = get_cc_config_path(Some(working_dir.clone()))?;

    if !cc_config_path.exists() {
        return Ok(Vec::new());
    }

    let config_content = fs::read_to_string(&cc_config_path)
        .map_err(|e| format!("Failed to read Claude config: {}", e))?;

    let config: serde_json::Value = serde_json::from_str(&config_content)
        .map_err(|e| format!("Failed to parse Claude config: {}", e))?;

    // Extract disabled_servers set from ~/.claude.json.projects[working_dir].disabledMcpServers
    let mut disabled_servers = HashSet::new();
    if let Some(projects) = config.get("projects")
        && let Some(project_config) = projects.get(&working_dir)
        && let Some(disabled) = project_config
            .get("disabledMcpServers")
            .and_then(|v| v.as_array())
    {
        for v in disabled {
            if let Some(name) = v.as_str() {
                disabled_servers.insert(name.to_string());
            }
        }
    }

    let mut servers_map: HashMap<String, ClaudeCodeMcpServer> = HashMap::new();

    // 1) Load global MCP servers from ~/.claude.json top-level mcpServers
    if let Some(global_mcp_servers) = config.get("mcpServers").and_then(|v| v.as_object()) {
        for (name, server_config) in global_mcp_servers {
            if let Ok(mut server) = parse_server_config(name, server_config) {
                server.scope = "global".to_string();
                server.enabled = !disabled_servers.contains(name);
                servers_map.insert(name.clone(), server);
            }
        }
    }

    // 2) Load project shared MCP servers from $working_dir/.mcp.json
    let local_mcp_path = Path::new(&working_dir).join(".mcp.json");
    if local_mcp_path.exists() {
        let local_content = fs::read_to_string(&local_mcp_path)
            .map_err(|e| format!("Failed to read local .mcp.json: {}", e))?;
        let local_config: serde_json::Value = serde_json::from_str(&local_content)
            .map_err(|e| format!("Failed to parse local .mcp.json: {}", e))?;

        if let Some(project_mcp_servers) =
            local_config.get("mcpServers").and_then(|v| v.as_object())
        {
            for (name, server_config) in project_mcp_servers {
                if let Ok(mut server) = parse_server_config(name, server_config) {
                    server.scope = "project".to_string();
                    server.enabled = !disabled_servers.contains(name);
                    // project overrides global
                    servers_map.insert(name.clone(), server);
                }
            }
        }
    }

    // 3) Load local per-project MCP servers from ~/.claude.json.projects[working_dir].mcpServers
    if let Some(projects) = config.get("projects")
        && let Some(project_config) = projects.get(&working_dir)
        && let Some(local_mcp_servers) =
            project_config.get("mcpServers").and_then(|v| v.as_object())
    {
        for (name, server_config) in local_mcp_servers {
            if let Ok(mut server) = parse_server_config(name, server_config) {
                server.scope = "local".to_string();
                server.enabled = !disabled_servers.contains(name);
                // local overrides project and global
                servers_map.insert(name.clone(), server);
            }
        }
    }

    // Return servers as vector
    let servers: Vec<ClaudeCodeMcpServer> = servers_map.into_values().collect();

    Ok(servers)
}

/// Get details for a specific MCP server
pub async fn cc_mcp_get(name: String, working_dir: String) -> Result<ClaudeCodeMcpServer, String> {
    let servers = cc_mcp_list(working_dir).await?;

    servers
        .into_iter()
        .find(|server| server.name == name)
        .ok_or_else(|| format!("Server '{}' not found", name))
}

/// Add a new MCP server to Claude Code
pub async fn cc_mcp_add(
    request: ClaudeCodeMcpServer,
    working_dir: String,
) -> Result<ClaudeCodeResponse, String> {
    let scope = request.scope.clone();
    let server_name = request.name.clone();
    let server_json = server_to_json(&request)?;

    match scope.as_str() {
        "global" => {
            let config_path = get_cc_config_path(None)?;
            let backup_path = if config_path.exists() {
                Some(create_backup(&config_path)?)
            } else {
                None
            };

            let mut config = if config_path.exists() {
                let content = fs::read_to_string(&config_path)
                    .map_err(|e| format!("Failed to read config: {}", e))?;
                serde_json::from_str(&content)
                    .map_err(|e| format!("Failed to parse config: {}", e))?
            } else {
                serde_json::json!({"mcpServers": {}})
            };

            if !config["mcpServers"].is_object() {
                config["mcpServers"] = serde_json::json!({});
            }
            config["mcpServers"][&server_name] = server_json;

            fs::write(&config_path, serde_json::to_string_pretty(&config).unwrap()).map_err(
                |e| {
                    if let Some(bp) = backup_path {
                        let _ = restore_backup(&config_path, &bp);
                    }
                    format!("Failed to write config: {}", e)
                },
            )?;
        }
        "project" => {
            let config_path = Path::new(&working_dir).join(".mcp.json");
            let backup_path = if config_path.exists() {
                Some(create_backup(&config_path)?)
            } else {
                None
            };

            let mut config = if config_path.exists() {
                let content = fs::read_to_string(&config_path)
                    .map_err(|e| format!("Failed to read local config: {}", e))?;
                serde_json::from_str(&content)
                    .map_err(|e| format!("Failed to parse local config: {}", e))?
            } else {
                serde_json::json!({"mcpServers": {}})
            };

            if !config["mcpServers"].is_object() {
                config["mcpServers"] = serde_json::json!({});
            }
            config["mcpServers"][&server_name] = server_json;

            fs::write(&config_path, serde_json::to_string_pretty(&config).unwrap()).map_err(
                |e| {
                    if let Some(bp) = backup_path {
                        let _ = restore_backup(&config_path, &bp);
                    }
                    format!("Failed to write local config: {}", e)
                },
            )?;
        }
        "local" | "" => {
            let config_path = get_cc_config_path(Some(working_dir.clone()))?;
            let backup_path = if config_path.exists() {
                Some(create_backup(&config_path)?)
            } else {
                None
            };

            let mut config = if config_path.exists() {
                let content = fs::read_to_string(&config_path)
                    .map_err(|e| format!("Failed to read config: {}", e))?;
                serde_json::from_str(&content)
                    .map_err(|e| format!("Failed to parse config: {}", e))?
            } else {
                serde_json::json!({"projects": {}})
            };

            if !config["projects"].is_object() {
                config["projects"] = serde_json::json!({});
            }
            if !config["projects"][&working_dir].is_object() {
                config["projects"][&working_dir] = serde_json::json!({"mcpServers": {}});
            }
            if !config["projects"][&working_dir]["mcpServers"].is_object() {
                config["projects"][&working_dir]["mcpServers"] = serde_json::json!({});
            }

            config["projects"][&working_dir]["mcpServers"][&server_name] = server_json;

            fs::write(&config_path, serde_json::to_string_pretty(&config).unwrap()).map_err(
                |e| {
                    if let Some(bp) = backup_path {
                        let _ = restore_backup(&config_path, &bp);
                    }
                    format!("Failed to write config: {}", e)
                },
            )?;
        }
        _ => return Err(format!("Invalid scope: {}", scope)),
    }

    Ok(ClaudeCodeResponse {
        success: true,
        message: format!(
            "Server '{}' added successfully to {} scope",
            server_name, scope
        ),
    })
}

/// Remove an MCP server from Claude Code
pub async fn cc_mcp_remove(
    name: String,
    working_dir: String,
    scope: String,
) -> Result<ClaudeCodeResponse, String> {
    match scope.as_str() {
        "global" => {
            let config_path = get_cc_config_path(None)?;
            if !config_path.exists() {
                return Err("Global config not found".to_string());
            }
            let backup_path = create_backup(&config_path)?;

            let content = fs::read_to_string(&config_path)
                .map_err(|e| format!("Failed to read config: {}", e))?;
            let mut config: serde_json::Value = serde_json::from_str(&content)
                .map_err(|e| format!("Failed to parse config: {}", e))?;

            let removed = if let Some(mcp) = config.get_mut("mcpServers") {
                mcp.as_object_mut()
                    .map(|obj| obj.remove(&name).is_some())
                    .unwrap_or(false)
            } else {
                false
            };

            if removed {
                fs::write(&config_path, serde_json::to_string_pretty(&config).unwrap()).map_err(
                    |e| {
                        let _ = restore_backup(&config_path, &backup_path);
                        format!("Failed to write config: {}", e)
                    },
                )?;
                let _ = fs::remove_file(backup_path);
            } else {
                let _ = fs::remove_file(backup_path);
                return Err(format!("Server '{}' not found in global scope", name));
            }
        }
        "project" => {
            let config_path = Path::new(&working_dir).join(".mcp.json");
            if !config_path.exists() {
                return Err("Project .mcp.json not found".to_string());
            }
            let backup_path = create_backup(&config_path)?;

            let content = fs::read_to_string(&config_path)
                .map_err(|e| format!("Failed to read local config: {}", e))?;
            let mut config: serde_json::Value = serde_json::from_str(&content)
                .map_err(|e| format!("Failed to parse local config: {}", e))?;

            let removed = if let Some(mcp) = config.get_mut("mcpServers") {
                mcp.as_object_mut()
                    .map(|obj| obj.remove(&name).is_some())
                    .unwrap_or(false)
            } else {
                false
            };

            if removed {
                fs::write(&config_path, serde_json::to_string_pretty(&config).unwrap()).map_err(
                    |e| {
                        let _ = restore_backup(&config_path, &backup_path);
                        format!("Failed to write local config: {}", e)
                    },
                )?;
                let _ = fs::remove_file(backup_path);
            } else {
                let _ = fs::remove_file(backup_path);
                return Err(format!("Server '{}' not found in project scope", name));
            }
        }
        "local" | "" => {
            let config_path = get_cc_config_path(Some(working_dir.clone()))?;
            if !config_path.exists() {
                return Err("Claude config not found".to_string());
            }
            let backup_path = create_backup(&config_path)?;

            let content = fs::read_to_string(&config_path)
                .map_err(|e| format!("Failed to read config: {}", e))?;
            let mut config: serde_json::Value = serde_json::from_str(&content)
                .map_err(|e| format!("Failed to parse config: {}", e))?;

            let removed = if let Some(projects) = config.get_mut("projects") {
                if let Some(project) = projects.get_mut(&working_dir) {
                    if let Some(mcp) = project.get_mut("mcpServers") {
                        mcp.as_object_mut()
                            .map(|obj| obj.remove(&name).is_some())
                            .unwrap_or(false)
                    } else {
                        false
                    }
                } else {
                    false
                }
            } else {
                false
            };

            if removed {
                fs::write(&config_path, serde_json::to_string_pretty(&config).unwrap()).map_err(
                    |e| {
                        let _ = restore_backup(&config_path, &backup_path);
                        format!("Failed to write config: {}", e)
                    },
                )?;
                let _ = fs::remove_file(backup_path);
            } else {
                let _ = fs::remove_file(backup_path);
                return Err(format!("Server '{}' not found in local scope", name));
            }
        }
        _ => return Err(format!("Invalid scope: {}", scope)),
    }

    Ok(ClaudeCodeResponse {
        success: true,
        message: format!(
            "Server '{}' removed successfully from {} scope",
            name, scope
        ),
    })
}

/// List all projects configured in Claude Code
pub async fn cc_list_projects() -> Result<Vec<String>, String> {
    let cc_config_path = get_cc_config_path(None)?;

    if !cc_config_path.exists() {
        return Ok(Vec::new());
    }

    let config_content = fs::read_to_string(&cc_config_path)
        .map_err(|e| format!("Failed to read Claude config: {}", e))?;

    let config: serde_json::Value = serde_json::from_str(&config_content)
        .map_err(|e| format!("Failed to parse Claude config: {}", e))?;

    let mut projects = Vec::new();

    if let Some(projects_obj) = config.get("projects")
        && let Some(projects_map) = projects_obj.as_object()
    {
        for project_name in projects_map.keys() {
            projects.push(project_name.clone());
        }
    }

    projects.sort();
    Ok(projects)
}

fn update_disabled_server(
    working_dir: &str,
    server_name: &str,
    enable: bool, // true = enable, false = disable
) -> Result<ClaudeCodeResponse, String> {
    let cc_config_path = get_cc_config_path(Some(working_dir.to_string()))?;

    if !cc_config_path.exists() {
        return Err("Claude config file not found".to_string());
    }

    let backup_path = create_backup(&cc_config_path)?;

    let config_content = fs::read_to_string(&cc_config_path)
        .map_err(|e| format!("Failed to read Claude config: {}", e))?;

    let mut config: serde_json::Value = serde_json::from_str(&config_content)
        .map_err(|e| format!("Failed to parse Claude config: {}", e))?;

    let projects = config
        .get_mut("projects")
        .ok_or("No projects section found")?;
    let project = projects.get_mut(working_dir).ok_or("Project not found")?;

    if project.get_mut("disabledMcpServers").is_none() {
        project["disabledMcpServers"] = serde_json::json!([]);
    }
    let disabled = project["disabledMcpServers"]
        .as_array_mut()
        .expect("disabledMcpServers should be an array");

    if enable {
        // remove from disabled list
        disabled.retain(|v| v != &serde_json::Value::String(server_name.to_string()));
    } else {
        // add to disabled list if not already
        if !disabled
            .iter()
            .any(|v| v == &serde_json::Value::String(server_name.to_string()))
        {
            disabled.push(serde_json::Value::String(server_name.to_string()));
        }
    }

    fs::write(
        &cc_config_path,
        serde_json::to_string_pretty(&config).unwrap(),
    )
    .map_err(|e| {
        let _ = restore_backup(&cc_config_path, &backup_path);
        format!("Failed to write config: {}", e)
    })?;

    let _ = fs::remove_file(backup_path);

    Ok(ClaudeCodeResponse {
        success: true,
        message: if enable {
            format!("Server '{}' enabled successfully", server_name)
        } else {
            format!("Server '{}' disabled successfully", server_name)
        },
    })
}

pub async fn cc_mcp_disable(
    name: String,
    working_dir: String,
) -> Result<ClaudeCodeResponse, String> {
    update_disabled_server(&working_dir, &name, false)
}

pub async fn cc_mcp_enable(
    name: String,
    working_dir: String,
) -> Result<ClaudeCodeResponse, String> {
    update_disabled_server(&working_dir, &name, true)
}

fn get_cc_config_path(_working_dir: Option<String>) -> Result<PathBuf, String> {
    let home_dir = dirs::home_dir().ok_or("Unable to find home directory")?;
    Ok(home_dir.join(".claude.json"))
}

fn parse_server_config(
    name: &str,
    config: &serde_json::Value,
) -> Result<ClaudeCodeMcpServer, String> {
    let server_type = config
        .get("type")
        .and_then(|v| v.as_str())
        .unwrap_or("stdio")
        .to_string();

    let url = config
        .get("url")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let command = config
        .get("command")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let args = config.get("args").and_then(|v| v.as_array()).map(|arr| {
        arr.iter()
            .filter_map(|v| v.as_str())
            .map(|s| s.to_string())
            .collect()
    });

    let env = config.get("env").and_then(|v| v.as_object()).map(|obj| {
        obj.iter()
            .filter_map(|(k, v)| v.as_str().map(|s| (k.clone(), s.to_string())))
            .collect()
    });

    Ok(ClaudeCodeMcpServer {
        name: name.to_string(),
        r#type: server_type,
        url,
        command,
        args,
        env,
        scope: "".to_string(),
        enabled: true,
    })
}

fn server_to_json(server: &ClaudeCodeMcpServer) -> Result<serde_json::Value, String> {
    let mut json = serde_json::json!({
        "type": server.r#type
    });

    if let Some(url) = &server.url {
        json["url"] = serde_json::Value::String(url.clone());
    }

    if let Some(command) = &server.command {
        json["command"] = serde_json::Value::String(command.clone());
    }

    if let Some(args) = &server.args {
        json["args"] = serde_json::Value::Array(
            args.iter()
                .map(|arg| serde_json::Value::String(arg.clone()))
                .collect(),
        );
    }

    if let Some(env) = &server.env {
        json["env"] = serde_json::Value::Object(
            env.iter()
                .map(|(k, v)| (k.clone(), serde_json::Value::String(v.clone())))
                .collect(),
        );
    }

    Ok(json)
}

fn create_backup(config_path: &PathBuf) -> Result<PathBuf, String> {
    if !config_path.exists() {
        return Err("Config file does not exist".to_string());
    }

    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();

    let backup_path = config_path.with_extension(format!("json.backup.{}", timestamp));

    fs::copy(config_path, &backup_path).map_err(|e| format!("Failed to create backup: {}", e))?;

    Ok(backup_path)
}

fn restore_backup(config_path: &PathBuf, backup_path: &PathBuf) -> Result<(), String> {
    if !backup_path.exists() {
        return Err("Backup file does not exist".to_string());
    }

    fs::copy(backup_path, config_path).map_err(|e| format!("Failed to restore backup: {}", e))?;

    Ok(())
}
