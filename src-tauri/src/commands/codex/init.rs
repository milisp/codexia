use codexia_codex::CodexInitializationState;
use tauri::State;

use codexia_codex::{AppState, initialize_codex};

#[tauri::command]
pub async fn codex_home() -> std::path::PathBuf {
    codexia_codex::utils::codex_home()
}

#[tauri::command]
pub async fn initialize_codex_async(
    state: State<'_, AppState>,
    init_state: State<'_, CodexInitializationState>,
    cc_state: State<'_, codexia_cc::CCState>,
) -> Result<(), String> {
    if init_state.initialized.load(std::sync::atomic::Ordering::SeqCst) {
        return Ok(());
    }

    let _guard = init_state.init_lock.lock().await;

    if init_state.initialized.load(std::sync::atomic::Ordering::SeqCst) {
        return Ok(());
    }

    initialize_codex(&state.codex, std::sync::Arc::clone(&init_state.event_sink)).await?;

    codexia_cc::automation::initialize_automation_runtime(
        Some(state.codex.clone()),
        cc_state.inner().clone(),
        std::sync::Arc::clone(&init_state.event_sink),
    )
    .await?;

    init_state.initialized.store(true, std::sync::atomic::Ordering::SeqCst);
    Ok(())
}