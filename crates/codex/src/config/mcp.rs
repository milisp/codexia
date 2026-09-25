use serde::{Deserialize, Serialize, de::Deserializer};
use std::collections::HashMap;
use std::fs;
use std::str::FromStr;
use toml_edit::{Document, Item, Table, Value, value};

use super::toml_helpers::{serialize_to_table, write_document_with_backup};
use super::{CodexConfig, get_config_path};

fn default_enabled() -> bool {
    true
}

fn is_enabled_true(enabled: &bool) -> bool {
    *enabled
}

fn inline_env_table(table: &mut Table) {
    if let Some(env_entry) = table.get_mut("env")
        && env_entry.is_table()
    {
        let env_item = std::mem::take(env_entry);
        if let Item::Table(env_table) = env_item {
            *env_entry = Item::Value(Value::InlineTable(env_table.into_inline_table()));
        } else {
            *env_entry = env_item;
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type")]
pub enum McpServerConfig {
    #[serde(rename = "stdio")]
    Stdio {
        command: String,
        args: Vec<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        env: Option<HashMap<String, String>>,
        #[serde(default = "default_enabled", skip_serializing_if = "is_enabled_true")]
        enabled: bool,
    },
    #[serde(rename = "http")]
    Http {
        url: String,
        #[serde(default = "default_enabled", skip_serializing_if = "is_enabled_true")]
        enabled: bool,
    },
    #[serde(rename = "sse")]
    Sse {
        url: String,
        #[serde(default = "default_enabled", skip_serializing_if = "is_enabled_true")]
        enabled: bool,
    },
}

impl<'de> Deserialize<'de> for McpServerConfig {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        #[derive(Deserialize)]
        #[serde(tag = "type")]
        enum TaggedMcpServerConfig {
            #[serde(rename = "stdio")]
            Stdio {
                command: String,
                args: Vec<String>,
                #[serde(default)]
                env: Option<HashMap<String, String>>,
                #[serde(default = "default_enabled")]
                enabled: bool,
            },
            #[serde(rename = "http")]
            Http {
                url: String,
                #[serde(default = "default_enabled")]
                enabled: bool,
            },
            #[serde(rename = "sse")]
            Sse {
                url: String,
                #[serde(default = "default_enabled")]
                enabled: bool,
            },
        }

        #[derive(Deserialize)]
        struct LegacyStdioConfig {
            command: String,
            #[serde(default)]
            args: Vec<String>,
            #[serde(default)]
            env: Option<HashMap<String, String>>,
            #[serde(default = "default_enabled")]
            enabled: bool,
        }

        #[derive(Deserialize)]
        #[serde(untagged)]
        enum McpServerConfigHelper {
            Tagged(TaggedMcpServerConfig),
            Legacy(LegacyStdioConfig),
        }

        match McpServerConfigHelper::deserialize(deserializer)? {
            McpServerConfigHelper::Tagged(TaggedMcpServerConfig::Stdio {
                command,
                args,
                env,
                enabled,
            }) => Ok(McpServerConfig::Stdio {
                command,
                args,
                env,
                enabled,
            }),
            McpServerConfigHelper::Tagged(TaggedMcpServerConfig::Http { url, enabled }) => {
                Ok(McpServerConfig::Http { url, enabled })
            }
            McpServerConfigHelper::Tagged(TaggedMcpServerConfig::Sse { url, enabled }) => {
                Ok(McpServerConfig::Sse { url, enabled })
            }
            McpServerConfigHelper::Legacy(LegacyStdioConfig {
                command,
                args,
                env,
                enabled,
            }) => Ok(McpServerConfig::Stdio {
                command,
                args,
                env,
                enabled,
            }),
        }
    }
}

pub async fn read_mcp_servers() -> Result<HashMap<String, McpServerConfig>, String> {
    let config_path = get_config_path()?;

    if !config_path.exists() {
        return Ok(HashMap::new());
    }

    let content = fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read config file: {}", e))?;

    let config: CodexConfig =
        toml::from_str(&content).map_err(|e| format!("Failed to parse config file: {}", e))?;

    Ok(config.mcp_servers)
}

pub async fn add_mcp_server(name: String, config: McpServerConfig) -> Result<(), String> {
    let config_path = get_config_path()?;

    let mut doc = if config_path.exists() {
        let content = fs::read_to_string(&config_path)
            .map_err(|e| format!("Failed to read config file: {}", e))?;
        Document::from_str(&content).map_err(|e| format!("Failed to parse config file: {}", e))?
    } else {
        Document::new()
    };

    let mcp_servers_entry = doc
        .entry("mcp_servers")
        .or_insert(Item::Table(Table::new()));

    let mcp_servers_table = match mcp_servers_entry.as_table_mut() {
        Some(table) => table,
        None => {
            *mcp_servers_entry = Item::Table(Table::new());
            mcp_servers_entry
                .as_table_mut()
                .ok_or("Failed to access mcp_servers table")?
        }
    };

    let mut server_table = serialize_to_table(&config)?;
    inline_env_table(&mut server_table);
    mcp_servers_table.insert(&name, Item::Table(server_table));

    write_document_with_backup(&config_path, &doc)?;

    Ok(())
}

pub async fn delete_mcp_server(name: String) -> Result<(), String> {
    let config_path = get_config_path()?;

    if !config_path.exists() {
        return Err("Config file does not exist".to_string());
    }

    let content = fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read config file: {}", e))?;

    let mut doc =
        Document::from_str(&content).map_err(|e| format!("Failed to parse config file: {}", e))?;

    let mcp_servers_entry = doc
        .entry("mcp_servers")
        .or_insert(Item::Table(Table::new()));

    let mcp_servers_table = match mcp_servers_entry.as_table_mut() {
        Some(table) => table,
        None => {
            return Err(format!("MCP server '{}' not found", name));
        }
    };

    if mcp_servers_table.remove(&name).is_none() {
        return Err(format!("MCP server '{}' not found", name));
    }

    write_document_with_backup(&config_path, &doc)?;

    Ok(())
}

pub async fn set_mcp_server_enabled(name: String, enabled: bool) -> Result<(), String> {
    let config_path = get_config_path()?;

    if !config_path.exists() {
        return Err("Config file does not exist".to_string());
    }

    let content = fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read config file: {}", e))?;

    let mut doc =
        Document::from_str(&content).map_err(|e| format!("Failed to parse config file: {}", e))?;

    let mcp_servers_entry = doc
        .entry("mcp_servers")
        .or_insert(Item::Table(Table::new()));

    let mcp_servers_table = mcp_servers_entry
        .as_table_mut()
        .ok_or("Failed to access mcp_servers table")?;

    let server_entry = mcp_servers_table
        .get_mut(&name)
        .ok_or(format!("MCP server '{}' not found", name))?;

    let server_table = server_entry
        .as_table_mut()
        .ok_or(format!("MCP server '{}' is not a table", name))?;

    if enabled {
        server_table.remove("enabled");
    } else {
        server_table.insert("enabled", value(enabled));
    }

    write_document_with_backup(&config_path, &doc)?;

    Ok(())
}
