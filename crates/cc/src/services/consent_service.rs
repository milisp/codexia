use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

/// Bump when the usage notice changes materially, so every user is asked again.
pub const CONSENT_VERSION: u32 = 1;

/// Stored in `~/.codexia/cc-consent.json`, shared by desktop, web and phone clients.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ConsentRecord {
    pub version: u32,
    /// Unix timestamp in seconds.
    pub accepted_at: u64,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ConsentStatus {
    pub accepted: bool,
    pub version: u32,
    pub accepted_at: Option<u64>,
}

fn consent_path() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("Failed to get home directory")?;
    Ok(home.join(".codexia").join("cc-consent.json"))
}

pub fn get_consent() -> Result<ConsentStatus, String> {
    let path = consent_path()?;
    // A missing or unreadable file just means the user has not accepted yet.
    let record = fs::read_to_string(&path)
        .ok()
        .and_then(|content| serde_json::from_str::<ConsentRecord>(&content).ok());

    Ok(match record {
        Some(record) if record.version >= CONSENT_VERSION => ConsentStatus {
            accepted: true,
            version: CONSENT_VERSION,
            accepted_at: Some(record.accepted_at),
        },
        _ => ConsentStatus {
            accepted: false,
            version: CONSENT_VERSION,
            accepted_at: None,
        },
    })
}

pub fn accept_consent() -> Result<ConsentStatus, String> {
    let path = consent_path()?;
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir)
            .map_err(|e| format!("Failed to create .codexia directory: {}", e))?;
    }

    let accepted_at = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| format!("System clock error: {}", e))?
        .as_secs();
    let record = ConsentRecord {
        version: CONSENT_VERSION,
        accepted_at,
    };
    let content = serde_json::to_string_pretty(&record)
        .map_err(|e| format!("Failed to serialize consent: {}", e))?;
    fs::write(&path, content).map_err(|e| format!("Failed to write consent file: {}", e))?;

    Ok(ConsentStatus {
        accepted: true,
        version: CONSENT_VERSION,
        accepted_at: Some(accepted_at),
    })
}
