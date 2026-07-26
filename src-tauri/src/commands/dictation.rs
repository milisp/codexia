use crate::dictation::{DictationModelStatus, DictationSessionState, DictationState};

#[tauri::command]
pub async fn dictation_model_status(
    app: tauri::AppHandle,
    state: tauri::State<'_, DictationState>,
    model_id: Option<String>,
) -> Result<DictationModelStatus, String> {
    crate::dictation::dictation_model_status(app, state, model_id).await
}

#[tauri::command]
pub async fn dictation_download_model(
    app: tauri::AppHandle,
    state: tauri::State<'_, DictationState>,
    model_id: Option<String>,
) -> Result<DictationModelStatus, String> {
    crate::dictation::dictation_download_model(app, state, model_id).await
}

#[tauri::command]
pub async fn dictation_cancel_download(
    app: tauri::AppHandle,
    state: tauri::State<'_, DictationState>,
    model_id: Option<String>,
) -> Result<DictationModelStatus, String> {
    crate::dictation::dictation_cancel_download(app, state, model_id).await
}

#[tauri::command]
pub async fn dictation_remove_model(
    app: tauri::AppHandle,
    state: tauri::State<'_, DictationState>,
    model_id: Option<String>,
) -> Result<DictationModelStatus, String> {
    crate::dictation::dictation_remove_model(app, state, model_id).await
}

#[tauri::command]
pub async fn dictation_start(
    preferred_language: Option<String>,
    model_id: Option<String>,
    app: tauri::AppHandle,
    state: tauri::State<'_, DictationState>,
) -> Result<DictationSessionState, String> {
    crate::dictation::dictation_start(preferred_language, model_id, app, state).await
}

#[tauri::command]
pub async fn dictation_request_permission(app: tauri::AppHandle) -> Result<bool, String> {
    crate::dictation::dictation_request_permission(app).await
}

#[tauri::command]
pub async fn dictation_stop(
    app: tauri::AppHandle,
    state: tauri::State<'_, DictationState>,
) -> Result<DictationSessionState, String> {
    crate::dictation::dictation_stop(app, state).await
}

#[tauri::command]
pub async fn dictation_cancel(
    app: tauri::AppHandle,
    state: tauri::State<'_, DictationState>,
) -> Result<DictationSessionState, String> {
    crate::dictation::dictation_cancel(app, state).await
}
