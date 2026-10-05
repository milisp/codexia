use codexia_acp::mcp::{self, McpServers};
use serde_json::Value;

#[tauri::command]
pub async fn keke_read_mcp_servers() -> Result<McpServers, String> {
    mcp::read_mcp_servers().await
}

#[tauri::command]
pub async fn keke_add_mcp_server(name: String, config: Value) -> Result<(), String> {
    mcp::add_mcp_server(name, config).await
}

#[tauri::command]
pub async fn keke_remove_mcp_server(name: String) -> Result<(), String> {
    mcp::remove_mcp_server(name).await
}

#[tauri::command]
pub async fn keke_mcp_auth_statuses() -> Result<std::collections::BTreeMap<String, mcp::McpAuthStatus>, String> {
    mcp::read_mcp_auth_statuses().await
}

#[tauri::command]
pub async fn keke_mcp_login(name: String) -> Result<(), String> {
    mcp::login_mcp_server(name).await
}
