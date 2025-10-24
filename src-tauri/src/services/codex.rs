use crate::utils::codex_discovery::discover_codex_command;
use std::process::Command;

pub async fn check_codex_version() -> Result<String, String> {
    let path = match discover_codex_command() {
        Some(p) => p.to_string_lossy().to_string(),
        None => "codex".to_string(),
    };

    let output = Command::new(&path)
        .arg("-V")
        .output()
        .map_err(|e| format!("Failed to execute codex binary: {}", e))?;

    if output.status.success() {
        let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
        Ok(version)
    } else {
        let err_msg = String::from_utf8_lossy(&output.stderr).trim().to_string();
        Err(format!("Codex binary returned error: {}", err_msg))
    }
}
