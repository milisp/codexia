use anyhow::Result;
use serde_json;
use std::process::Stdio;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::mpsc;
use uuid::Uuid;

use crate::protocol::{
    CodexConfig, Event, InputItem, Op, Submission
};
use crate::utils::logger::log_to_file;
use crate::utils::codex_discovery::discover_codex_command;


pub struct CodexClient {
    #[allow(dead_code)]
    app: AppHandle,
    session_id: String,
    process: Option<Child>,
    stdin_tx: Option<mpsc::UnboundedSender<String>>,
    #[allow(dead_code)]
    config: CodexConfig,
}

impl CodexClient {
    pub async fn new(app: &AppHandle, session_id: String, config: CodexConfig) -> Result<Self> {
        log_to_file(&format!("Creating CodexClient for session: {}", session_id));
        
        // Build codex command based on configuration
        let (command, args): (String, Vec<String>) = if let Some(configured_path) = &config.codex_path {
            (configured_path.clone(), vec![])
        } else if let Some(path) = discover_codex_command() {
            (path.to_string_lossy().to_string(), vec![])
        } else {
            return Err(anyhow::anyhow!("Could not find codex executable"));
        };

        // Build base arguments
        let mut built_args: Vec<String> = vec!["proto".to_string()];
        
        // Use -c configuration parameter format (codex proto only supports -c configuration)
        if config.use_oss {
            built_args.push("-c".to_string());
            built_args.push("model_provider=oss".to_string());
        }
        
        if !config.model.is_empty() {
            built_args.push("-c".to_string());
            built_args.push(format!("model={}", config.model));
        }
        
        if !config.approval_policy.is_empty() {
            built_args.push("-c".to_string());
            built_args.push(format!("approval_policy={}", config.approval_policy));
        }
        
        if !config.sandbox_mode.is_empty() {
            let sandbox_config = match config.sandbox_mode.as_str() {
                "read-only" => "sandbox_mode=read-only".to_string(),
                "workspace-write" => "sandbox_mode=workspace-write".to_string(), 
                "danger-full-access" => "sandbox_mode=danger-full-access".to_string(),
                _ => "sandbox_mode=workspace-write".to_string(),
            };
            built_args.push("-c".to_string());
            built_args.push(sandbox_config);
        }

        // Optional dev override: force reasoning visibility like CLI
        if std::env::var("CODEX_FORCE_REASONING").ok().as_deref() == Some("1") {
            built_args.push("-c".to_string());
            built_args.push("show_raw_agent_reasoning=true".to_string());
            built_args.push("-c".to_string());
            built_args.push("model_reasoning_effort=high".to_string());
            built_args.push("-c".to_string());
            built_args.push("model_reasoning_summary=detailed".to_string());
        }
        // Add any custom args from config
        if let Some(custom_args) = &config.custom_args {
            for arg in custom_args {
                built_args.push(arg.clone());
            }
        }

        // Decide on a spawn strategy: optional TTY wrapper using `script -qf -c` to mimic CLI flushing
        let use_tty = std::env::var("CODEX_TTY").ok().as_deref() == Some("1");
        let mut process: Child;
        if use_tty {
            if which::which("script").is_ok() {
                // Compose a single shell-escaped command string
                fn sh_escape(s: &str) -> String {
                    if s.is_empty() { return "''".to_string(); }
                    let mut out = String::from("'");
                    for c in s.chars() {
                        if c == '\'' { out.push_str("'\\''"); } else { out.push(c); }
                    }
                    out.push('\'');
                    out
                }
                let mut full = Vec::new();
                full.push(sh_escape(&command));
                if !args.is_empty() {
                    for a in &args { full.push(sh_escape(a)); }
                }
                for a in &built_args { full.push(sh_escape(a)); }
                let cmd_str = full.join(" ");

                let mut cmd = Command::new("script");
                cmd.arg("-qf");
                cmd.arg("-c").arg(cmd_str);
                cmd.arg("/dev/null");
                if !config.working_directory.is_empty() {
                    cmd.current_dir(&config.working_directory);
                }
                log_to_file(&format!("Starting codex via script pty: {:?}", cmd));
                process = cmd
                    .stdin(Stdio::piped())
                    .stdout(Stdio::piped())
                    .stderr(Stdio::piped())
                    .spawn()?;
            } else {
                // Fallback: stdbuf if available
                if which::which("stdbuf").is_ok() {
                    let mut cmd = Command::new("stdbuf");
                    cmd.arg("-oL").arg("-eL");
                    cmd.arg(&command);
                    if !args.is_empty() { cmd.args(&args); }
                    cmd.args(&built_args);
                    if !config.working_directory.is_empty() { cmd.current_dir(&config.working_directory); }
                    log_to_file(&format!("Starting codex via stdbuf: {:?}", cmd));
                    process = cmd.stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped()).spawn()?;
                } else {
                    // Plain spawn
                    let mut cmd = Command::new(&command);
                    if !args.is_empty() { cmd.args(&args); }
                    cmd.args(&built_args);
                    if !config.working_directory.is_empty() { cmd.current_dir(&config.working_directory); }
                    log_to_file(&format!("Starting codex plain: {:?}", cmd));
                    process = cmd.stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped()).spawn()?;
                }
            }
        } else {
            // Plain spawn (default)
            let mut cmd = Command::new(&command);
            if !args.is_empty() { cmd.args(&args); }
            cmd.args(&built_args);
            if !config.working_directory.is_empty() { cmd.current_dir(&config.working_directory); }
            log_to_file(&format!("Starting codex plain: {:?}", cmd));
            process = cmd.stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped()).spawn()?;
        }

        let stdin = process.stdin.take().expect("Failed to open stdin");
        let stdout = process.stdout.take().expect("Failed to open stdout");
        let stderr = process.stderr.take().expect("Failed to open stderr");

        let (stdin_tx, mut stdin_rx) = mpsc::unbounded_channel::<String>();

        // Handle stdin writing
        let mut stdin_writer = stdin;
        tokio::spawn(async move {
            while let Some(line) = stdin_rx.recv().await {
                if let Err(e) = stdin_writer.write_all(line.as_bytes()).await {
                    log_to_file(&format!("Failed to write to codex stdin: {}", e));
                    break;
                }
                if let Err(e) = stdin_writer.write_all(b"\n").await {
                    log_to_file(&format!("Failed to write newline to codex stdin: {}", e));
                    break;
                }
                if let Err(e) = stdin_writer.flush().await {
                    log_to_file(&format!("Failed to flush codex stdin: {}", e));
                    break;
                }
            }
            log_to_file("Stdin writer task terminated");
        });

        // Handle stdout reading
        let app_clone = app.clone();
        let session_id_clone = session_id.clone();
        tokio::spawn(async move {
            let reader = BufReader::new(stdout);
            let mut lines = reader.lines();
            log_to_file(&format!("Starting stdout reader for session: {}", session_id_clone));
            while let Ok(Some(line)) = lines.next_line().await {
                if let Ok(event) = serde_json::from_str::<Event>(&line) {
                    // Minimal logging by default to avoid I/O stalls
                    // log_to_file(&format!("Parsed event: {:?}", event));
                    // Send event to frontend
                    if let Err(e) = app_clone.emit(&format!("codex-event-{}", session_id_clone), &event) {
                        log_to_file(&format!("Failed to emit event: {}", e));
                    }
                } else {
                    log_to_file(&format!("Failed to parse codex event: {}", line));
                }
            }
            log_to_file(&format!("Stdout reader terminated for session: {}", session_id_clone));
        });

        // Handle stderr reading and forward to UI
        let app_err = app.clone();
        let session_id_err = session_id.clone();
        tokio::spawn(async move {
            let reader = BufReader::new(stderr);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let _ = app_err.emit(&format!("codex-error:{}", session_id_err), &line);
            }
            log_to_file(&format!("Stderr reader terminated for session: {}", session_id_err));
        });

        let client = Self {
            app: app.clone(),
            session_id,
            process: Some(process),
            stdin_tx: Some(stdin_tx),
            config: config.clone(),
        };

        Ok(client)
    }


    async fn send_submission(&self, submission: Submission) -> Result<()> {
        if let Some(stdin_tx) = &self.stdin_tx {
            let json = serde_json::to_string(&submission)?;
            stdin_tx.send(json)?;
        }
        Ok(())
    }

    pub async fn send_user_input(&self, message: String) -> Result<()> {
        let submission = Submission {
            id: Uuid::new_v4().to_string(),
            op: Op::UserInput {
                items: vec![InputItem::Text { text: message }],
            },
        };

        self.send_submission(submission).await
    }

    pub async fn send_exec_approval(&self, approval_id: String, approved: bool) -> Result<()> {
        let decision = if approved { "allow" } else { "deny" }.to_string();
        
        let submission = Submission {
            id: Uuid::new_v4().to_string(),
            op: Op::ExecApproval {
                id: approval_id,
                decision,
            },
        };

        self.send_submission(submission).await
    }

    #[allow(dead_code)]
    pub async fn send_patch_approval(&self, approval_id: String, approved: bool) -> Result<()> {
        let decision = if approved { "allow" } else { "deny" }.to_string();
        
        let submission = Submission {
            id: Uuid::new_v4().to_string(),
            op: Op::PatchApproval {
                id: approval_id,
                decision,
            },
        };

        self.send_submission(submission).await
    }

    #[allow(dead_code)]
    pub async fn interrupt(&self) -> Result<()> {
        let submission = Submission {
            id: Uuid::new_v4().to_string(),
            op: Op::Interrupt,
        };

        self.send_submission(submission).await
    }

    pub async fn close_session(&mut self) -> Result<()> {
        log_to_file(&format!("Closing session: {}", self.session_id));
        
        // Send shutdown command
        let submission = Submission {
            id: Uuid::new_v4().to_string(),
            op: Op::Shutdown,
        };
        
        if let Err(e) = self.send_submission(submission).await {
            log_to_file(&format!("Failed to send shutdown command: {}", e));
        }

        // Close stdin channel
        if let Some(stdin_tx) = self.stdin_tx.take() {
            drop(stdin_tx);
        }

        // Terminate process
        if let Some(mut process) = self.process.take() {
            if let Err(e) = process.kill().await {
                log_to_file(&format!("Failed to kill codex process: {}", e));
            }
        }

        Ok(())
    }

    pub async fn shutdown(&mut self) -> Result<()> {
        self.close_session().await
    }

    #[allow(dead_code)]
    pub fn is_active(&self) -> bool {
        self.process.is_some() && self.stdin_tx.is_some()
    }
}
