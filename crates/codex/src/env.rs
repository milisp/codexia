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