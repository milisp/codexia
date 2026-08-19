#[cfg(target_os = "macos")]
use std::process::Command;

#[cfg(target_os = "windows")]
use winreg::{enums::*, RegKey};

pub fn get_env(key: String) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        let root = RegKey::predef(HKEY_CURRENT_USER);
        if let Ok(env_key) = root.open_subkey("Environment") {
            if let Ok(value) = env_key.get_value::<String, _>(&key) {
                return Ok(value);
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        let cmd = format!("source ~/.zshrc && echo ${}", key);
        if let Ok(output) = Command::new("zsh").args(["-c", &cmd]).output() {
            if output.status.success() {
                let value = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !value.is_empty() {
                    return Ok(value);
                }
            }
        }
    }

    std::env::var(&key).map_err(|_| format!("Environment variable '{}' not found", key))
}

/// Batch lookup: on macOS a single shell sources ~/.zshrc once for every key,
/// instead of spawning one `zsh` per key.
pub fn get_envs(keys: &[String]) -> std::collections::HashMap<String, String> {
    let mut result = std::collections::HashMap::new();

    #[cfg(target_os = "macos")]
    {
        let echos = keys
            .iter()
            .map(|k| format!("echo ${}", k))
            .collect::<Vec<_>>()
            .join("; ");
        let cmd = format!("source ~/.zshrc >/dev/null 2>&1; {}", echos);
        if let Ok(output) = Command::new("zsh").args(["-c", &cmd]).output() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            for (key, line) in keys.iter().zip(stdout.lines()) {
                let value = line.trim();
                if !value.is_empty() {
                    result.insert(key.clone(), value.to_string());
                }
            }
        }
    }

    for key in keys {
        if result.contains_key(key) {
            continue;
        }
        // macOS already ran the shell above; only the process env is left to check.
        #[cfg(target_os = "macos")]
        let found = std::env::var(key).ok();
        #[cfg(not(target_os = "macos"))]
        let found = get_env(key.clone()).ok();

        if let Some(value) = found {
            result.insert(key.clone(), value);
        }
    }

    result
}

pub fn set_env(key: String, value: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let root = RegKey::predef(HKEY_CURRENT_USER);
        let (env_key, _) = root.create_subkey("Environment").map_err(|e| e.to_string())?;
        env_key.set_value(&key, &value).map_err(|e| e.to_string())?;

        unsafe extern "system" {
            fn SendMessageTimeoutW(
                hwnd: *mut std::ffi::c_void,
                msg: u32,
                wparam: usize,
                lparam: *const u16,
                flags: u32,
                timeout: u32,
                result: *mut usize,
            ) -> i32;
        }
        unsafe {
            let mut res = 0;
            let env_str: Vec<u16> = "Environment\0".encode_utf16().collect();
            SendMessageTimeoutW(0xffff as *mut std::ffi::c_void, 0x001A, 0, env_str.as_ptr(), 0x0002, 5000, &mut res);
        }
        Ok(())
    }

    #[cfg(target_os = "macos")]
    {
        let home = std::env::var("HOME").map_err(|e| e.to_string())?;
        let file_path = format!("{}/.zshrc", home);

        let cmd = format!("echo '\nexport {}={}' >> {}", key, value, file_path);
        let output = Command::new("zsh")
            .args(["-c", &cmd])
            .output()
            .map_err(|e| e.to_string())?;

        if !output.status.success() {
            return Err(String::from_utf8_lossy(&output.stderr).to_string());
        }
        Ok(())
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        let _ = key;
        let _ = value;
        Ok(())
    }
}
/// Env var names referenced by `model_providers.*.env_key`, gathered from the
/// user's `config.toml` and from the bundled provider presets.
///
/// Needed before the app-server is up, so the config file is read directly
/// instead of going through `config/read`.
pub fn provider_env_keys() -> Vec<String> {
    let mut keys: Vec<String> = crate::providers::list_provider_presets()
        .unwrap_or_default()
        .into_iter()
        .map(|p| p.env_key)
        .collect();

    let config_path = crate::utils::codex_home().join("config.toml");
    if let Ok(text) = std::fs::read_to_string(&config_path)
        && let Ok(toml::Value::Table(root)) = text.parse::<toml::Value>()
        && let Some(toml::Value::Table(providers)) = root.get("model_providers")
    {
        for provider in providers.values() {
            if let Some(env_key) = provider.get("env_key").and_then(toml::Value::as_str) {
                keys.push(env_key.to_string());
            }
        }
    }

    keys.sort();
    keys.dedup();
    keys.retain(|k| !k.is_empty());
    keys
}

#[cfg(test)]
mod tests {
    #[test]
    fn provider_env_keys_includes_config_and_presets() {
        let keys = super::provider_env_keys();
        assert!(keys.iter().any(|k| k == "OPENROUTER_API_KEY"));
        assert!(!keys.iter().any(String::is_empty));
        assert_eq!(keys.len(), keys.iter().collect::<std::collections::HashSet<_>>().len());
    }
}
