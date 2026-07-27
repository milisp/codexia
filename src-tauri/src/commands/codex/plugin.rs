use codex_app_server_protocol::{
    PluginInstallParams, PluginInstallResponse, PluginListParams, PluginListResponse,
    PluginReadParams, PluginReadResponse, PluginUninstallParams, PluginUninstallResponse,
};
use tauri::State;

use codexia_codex::AppState;

use crate::commands::codex::common::{from_value, to_value};

#[tauri::command]
pub async fn plugin_list(
    params: PluginListParams,
    state: State<'_, AppState>,
) -> Result<PluginListResponse, String> {
    let params_value = to_value(params)?;
    let result = state.codex.send_request("plugin/list", params_value).await?;
    Ok(from_value(result)?)
}

#[tauri::command]
pub async fn plugin_read(
    params: PluginReadParams,
    state: State<'_, AppState>,
) -> Result<PluginReadResponse, String> {
    let params_value = to_value(params)?;
    let result = state.codex.send_request("plugin/read", params_value).await?;
    Ok(from_value(result)?)
}

#[tauri::command]
pub async fn plugin_install(
    params: PluginInstallParams,
    state: State<'_, AppState>,
) -> Result<PluginInstallResponse, String> {
    let params_value = to_value(params)?;
    let result = state.codex.send_request("plugin/install", params_value).await?;
    Ok(from_value(result)?)
}

#[tauri::command]
pub async fn plugin_uninstall(
    params: PluginUninstallParams,
    state: State<'_, AppState>,
) -> Result<PluginUninstallResponse, String> {
    let params_value = to_value(params)?;
    let result = state.codex.send_request("plugin/uninstall", params_value).await?;
    Ok(from_value(result)?)
}