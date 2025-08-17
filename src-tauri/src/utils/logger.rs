use std::io::Write;
use std::sync::OnceLock;

// Logging is disabled by default to avoid I/O stalls on hot paths.
// Enable by setting CODEXIA_DEBUG_LOG=1 (and optionally CODEXIA_LOG_PATH).
static LOG_ENABLED: OnceLock<bool> = OnceLock::new();
static LOG_PATH: OnceLock<String> = OnceLock::new();

pub fn log_to_file(message: &str) {
    let enabled = *LOG_ENABLED.get_or_init(|| {
        std::env::var("CODEXIA_DEBUG_LOG")
            .ok()
            .map(|v| matches!(v.as_str(), "1" | "true" | "TRUE"))
            .unwrap_or(false)
    });
    if !enabled {
        return;
    }

    let path = LOG_PATH
        .get_or_init(|| std::env::var("CODEXIA_LOG_PATH").unwrap_or_else(|_| "/tmp/codexia.log".to_string()))
        .clone();

    if let Ok(mut log_file) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
    {
        let _ = writeln!(log_file, "{}", message);
    }
}
