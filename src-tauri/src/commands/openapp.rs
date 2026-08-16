use codexia_shared::openapp::{self, AppStatus, OpenWorkspaceOptions};

#[tauri::command]
pub async fn check_app_installed(app_name: String) -> Result<AppStatus, String> {
    openapp::check_app_installed(app_name).await
}

#[tauri::command]
pub async fn open_workspace_in(path: String, options: OpenWorkspaceOptions) -> Result<(), String> {
    openapp::open_workspace_in(path, options).await
}
