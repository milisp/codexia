use portable_pty::{CommandBuilder, MasterPty, PtySize, native_pty_system};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::Write;
use std::sync::{Arc, Mutex};
use tokio::sync::Mutex as AsyncMutex;

/// Terminal session state shared between web and command modules
#[derive(Default)]
pub struct TerminalState {
    pub sessions: AsyncMutex<HashMap<String, Arc<TerminalSession>>>,
}

/// Internal terminal session data
pub struct TerminalSession {
    pub master: Mutex<Box<dyn MasterPty + Send>>,
    pub writer: Mutex<Box<dyn Write + Send>>,
    pub child: Mutex<Box<dyn portable_pty::Child + Send>>,
}

/// Response for terminal start operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalStartResponse {
    pub session_id: String,
    pub shell: String,
}

/// Payload for terminal data events
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalDataPayload {
    pub session_id: String,
    pub data: String,
}

/// Payload for terminal exit events
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalExitPayload {
    pub session_id: String,
    pub message: String,
}

/// Parameters for terminal write operation
#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct TerminalWriteParams {
    pub session_id: String,
    pub data: String,
}

/// Parameters for terminal resize operation
#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct TerminalResizeParams {
    pub session_id: String,
    pub cols: u16,
    pub rows: u16,
}

/// Parameters for terminal stop operation
#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct TerminalStopParams {
    pub session_id: String,
}

/// Get the default shell for the current platform
pub fn get_default_shell() -> String {
    #[cfg(target_os = "windows")]
    {
        return "powershell.exe".to_string();
    }

    #[cfg(target_os = "macos")]
    {
        std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string())
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        return std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string());
    }
}

/// Build shell command with platform-specific arguments
pub fn build_shell_command(cwd: Option<String>) -> (String, CommandBuilder) {
    let shell = get_default_shell();
    let mut cmd = CommandBuilder::new(shell.clone());

    #[cfg(target_os = "windows")]
    {
        cmd.arg("-NoLogo");
    }

    #[cfg(not(target_os = "windows"))]
    {
        cmd.arg("-i");
        cmd.arg("-l");
        cmd.env("TERM", "xterm-256color");
    }

    if let Some(path) = cwd.map(|value| value.trim().to_string()).filter(|value| !value.is_empty()) {
        cmd.cwd(path);
    }

    (shell, cmd)
}

/// Create a new PTY pair with the given size
pub fn create_pty_pair(cols: u16, rows: u16) -> Result<portable_pty::PtyPair, String> {
    let pty_system = native_pty_system();
    let size = PtySize {
        cols,
        rows,
        pixel_width: 0,
        pixel_height: 0,
    };
    pty_system
        .openpty(size)
        .map_err(|err| format!("Failed to open PTY: {err}"))
}

/// Spawn a shell command in the PTY slave
pub fn spawn_shell(
    slave: &mut dyn portable_pty::SlavePty,
    command: CommandBuilder,
) -> Result<Box<dyn portable_pty::Child + Send + Sync>, String> {
    slave
        .spawn_command(command)
        .map_err(|err| format!("Failed to start shell: {err}"))
}

/// Read from PTY master and emit events via a callback
pub fn read_pty_output<F>(mut reader: Box<dyn std::io::Read + Send>, mut on_data: F)
where
    F: FnMut(String) + Send + 'static,
{
    let mut buf = [0_u8; 8192];
    loop {
        match std::io::Read::read(&mut reader, &mut buf) {
            Ok(0) => break,
            Ok(count) => {
                let data = String::from_utf8_lossy(&buf[..count]).to_string();
                on_data(data);
            }
            Err(_) => break,
        }
    }
}

/// Resize terminal PTY
pub fn resize_terminal(
    master: &Mutex<Box<dyn MasterPty + Send>>,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let master = master
        .lock()
        .map_err(|_| "Failed to lock terminal master".to_string())?;
    master
        .resize(PtySize {
            cols: cols.max(2),
            rows: rows.max(2),
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|err| format!("Failed to resize terminal: {err}"))
}

/// Kill terminal child process
pub fn kill_terminal(
    child: &Mutex<Box<dyn portable_pty::Child + Send>>,
) -> Result<(), String> {
    let mut child = child
        .lock()
        .map_err(|_| "Failed to lock terminal child".to_string())?;
    child
        .kill()
        .map_err(|err| format!("Failed to stop terminal: {err}"))
}

/// Write data to terminal
pub fn write_terminal(
    writer: &Mutex<Box<dyn Write + Send>>,
    data: &str,
) -> Result<(), String> {
    let mut writer = writer
        .lock()
        .map_err(|_| "Failed to lock terminal writer".to_string())?;
    writer
        .write_all(data.as_bytes())
        .map_err(|err| format!("Failed to write terminal input: {err}"))?;
    writer
        .flush()
        .map_err(|err| format!("Failed to flush terminal input: {err}"))
}
