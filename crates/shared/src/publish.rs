//! One-click game publishing to productship.lol.
//!
//! Flow: connect once (device-connect: the user approves a code on
//! productship.lol/connect, we poll for a publish token), then each publish runs
//! the build command, uploads the output folder straight to R2 through presigned
//! URLs handed out by `/api/games/publish`, and calls `/complete` to go live at
//! `https://<slug>.productship.lol`.

use futures::stream::{self, StreamExt};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};
use std::time::Duration;
use walkdir::WalkDir;

const DEFAULT_API_BASE: &str = "https://productship.lol";
const UPLOAD_CONCURRENCY: usize = 6;
const BUILD_LOG_TAIL: usize = 4000;

/// `PRODUCTSHIP_URL` overrides the server, e.g. `http://localhost:3000` in dev.
pub fn api_base() -> String {
    std::env::var("PRODUCTSHIP_URL")
        .ok()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| DEFAULT_API_BASE.to_string())
        .trim_end_matches('/')
        .to_string()
}

fn http() -> reqwest::Client {
    reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(15))
        .build()
        .unwrap_or_default()
}

// ---------------------------------------------------------------------------
// Publish token storage (~/.codexia/productship.json)
// ---------------------------------------------------------------------------

#[derive(Serialize, Deserialize)]
struct StoredToken {
    token: String,
}

fn token_path() -> Result<PathBuf, String> {
    dirs::home_dir()
        .map(|home| home.join(".codexia").join("productship.json"))
        .ok_or_else(|| "Cannot resolve home directory".to_string())
}

fn load_token() -> Option<String> {
    let raw = std::fs::read_to_string(token_path().ok()?).ok()?;
    serde_json::from_str::<StoredToken>(&raw).ok().map(|t| t.token)
}

fn save_token(token: &str) -> Result<(), String> {
    let path = token_path()?;
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let body = serde_json::to_string(&StoredToken { token: token.to_string() }).map_err(|e| e.to_string())?;
    std::fs::write(&path, body).map_err(|e| e.to_string())?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o600));
    }
    Ok(())
}

pub fn disconnect() -> Result<(), String> {
    match std::fs::remove_file(token_path()?) {
        Err(e) if e.kind() != std::io::ErrorKind::NotFound => Err(e.to_string()),
        _ => Ok(()),
    }
}

fn require_token() -> Result<String, String> {
    load_token().ok_or_else(|| "Not connected to ProductShip. Connect first.".to_string())
}

// ---------------------------------------------------------------------------
// Device connect
// ---------------------------------------------------------------------------

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ConnectStart {
    pub code: String,
    /// Shown in Codexia and on /connect so the user can check they match.
    pub confirm_code: String,
    pub url: String,
}

fn confirm_code(code: &str) -> String {
    let digest = Sha256::digest(code.as_bytes());
    let hex: String = digest.iter().take(4).map(|b| format!("{b:02X}")).collect();
    format!("{}-{}", &hex[..4], &hex[4..])
}

pub fn connect_start() -> ConnectStart {
    let code = format!("{}{}", uuid::Uuid::new_v4().simple(), uuid::Uuid::new_v4().simple());
    ConnectStart {
        confirm_code: confirm_code(&code),
        url: format!("{}/connect?code={code}", api_base()),
        code,
    }
}

/// Returns true once the browser approved the code and the token was saved.
pub async fn connect_poll(code: &str) -> Result<bool, String> {
    let res = http()
        .post(format!("{}/api/connect/poll", api_base()))
        .json(&json!({ "code": code }))
        .timeout(Duration::from_secs(20))
        .send()
        .await
        .map_err(|e| format!("ProductShip unreachable: {e}"))?;
    if res.status() == reqwest::StatusCode::ACCEPTED {
        return Ok(false);
    }
    let status = res.status();
    let body: Value = res.json().await.unwrap_or(Value::Null);
    if !status.is_success() {
        return Err(error_message(&body, status));
    }
    let token = body
        .get("token")
        .and_then(Value::as_str)
        .ok_or_else(|| "Malformed connect response".to_string())?;
    save_token(token)?;
    Ok(true)
}

/// Connected account and its games, or `None` when not connected.
pub async fn whoami() -> Result<Option<Value>, String> {
    let Some(token) = load_token() else { return Ok(None) };
    let res = http()
        .get(format!("{}/api/games/whoami", api_base()))
        .bearer_auth(token)
        .timeout(Duration::from_secs(20))
        .send()
        .await
        .map_err(|e| format!("ProductShip unreachable: {e}"))?;
    let status = res.status();
    if status == reqwest::StatusCode::UNAUTHORIZED {
        // Token was revoked server-side; forget it so the UI offers Connect again.
        let _ = disconnect();
        return Ok(None);
    }
    let body: Value = res.json().await.unwrap_or(Value::Null);
    if !status.is_success() {
        return Err(error_message(&body, status));
    }
    Ok(Some(body))
}

fn error_message(body: &Value, status: reqwest::StatusCode) -> String {
    body.get("error")
        .and_then(Value::as_str)
        .map(str::to_string)
        .unwrap_or_else(|| format!("ProductShip request failed ({status})"))
}

// ---------------------------------------------------------------------------
// Publish
// ---------------------------------------------------------------------------

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PublishGameParams {
    pub cwd: String,
    pub build_command: Option<String>,
    /// Build output folder, relative to `cwd` (or absolute).
    pub output_dir: String,
    pub slug: String,
    pub title: String,
    pub tagline: Option<String>,
    pub description: Option<String>,
    /// One of the fixed genres on productship.lol (e.g. "puzzle").
    pub genre: Option<String>,
    /// "2d" or "3d".
    pub dimension: Option<String>,
    pub cover_path: Option<String>,
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PublishGameResult {
    pub version: u64,
    pub play_url: String,
    pub page_url: String,
    pub file_count: usize,
    pub total_bytes: u64,
}

/// Progress callback payload, emitted as the `publish:progress` event.
#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PublishProgress {
    pub slug: String,
    /// "build" | "scan" | "upload" | "finalize"
    pub stage: &'static str,
    pub message: String,
    pub done: usize,
    pub total: usize,
}

struct LocalFile {
    rel: String,
    abs: PathBuf,
    size: u64,
}

#[derive(Deserialize)]
struct UploadTarget {
    path: String,
    url: String,
    #[serde(rename = "contentType")]
    content_type: String,
}

#[derive(Deserialize)]
struct CoverTarget {
    url: String,
    #[serde(rename = "contentType")]
    content_type: String,
}

#[derive(Deserialize)]
struct InitResponse {
    version: u64,
    uploads: Vec<UploadTarget>,
    cover: Option<CoverTarget>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CompleteResponse {
    version: u64,
    play_url: String,
    page_url: String,
}

async fn run_build(cwd: &Path, command: &str) -> Result<(), String> {
    #[cfg(windows)]
    let mut cmd = {
        let mut c = tokio::process::Command::new("cmd");
        c.arg("/C").arg(command);
        c
    };
    #[cfg(not(windows))]
    let mut cmd = {
        let mut c = tokio::process::Command::new("sh");
        c.arg("-c").arg(command);
        c
    };
    let output = cmd
        .current_dir(cwd)
        .stdin(std::process::Stdio::null())
        .output()
        .await
        .map_err(|e| format!("Failed to run build: {e}"))?;
    if output.status.success() {
        return Ok(());
    }
    let mut log = String::from_utf8_lossy(&output.stdout).into_owned();
    log.push_str(&String::from_utf8_lossy(&output.stderr));
    let tail_start = log.len().saturating_sub(BUILD_LOG_TAIL);
    let tail_start = (tail_start..log.len()).find(|i| log.is_char_boundary(*i)).unwrap_or(0);
    Err(format!("Build failed ({}):\n{}", output.status, &log[tail_start..]))
}

/// Everything under `root` except dotfiles/dot-dirs and source maps.
fn collect_files(root: &Path) -> Result<Vec<LocalFile>, String> {
    let mut files = Vec::new();
    let walker = WalkDir::new(root).follow_links(false).into_iter().filter_entry(|entry| {
        entry.depth() == 0 || !entry.file_name().to_string_lossy().starts_with('.')
    });
    for entry in walker {
        let entry = entry.map_err(|e| e.to_string())?;
        if !entry.file_type().is_file() {
            continue;
        }
        let rel_path = entry.path().strip_prefix(root).map_err(|e| e.to_string())?;
        let rel = rel_path
            .components()
            .map(|c| c.as_os_str().to_string_lossy())
            .collect::<Vec<_>>()
            .join("/");
        if rel.ends_with(".map") {
            continue;
        }
        let size = entry.metadata().map_err(|e| e.to_string())?.len();
        files.push(LocalFile { rel, abs: entry.path().to_path_buf(), size });
    }
    files.sort_by(|a, b| a.rel.cmp(&b.rel));
    Ok(files)
}

async fn put_file(client: &reqwest::Client, url: &str, content_type: &str, path: &Path) -> Result<(), String> {
    let bytes = tokio::fs::read(path).await.map_err(|e| format!("{}: {e}", path.display()))?;
    let res = client
        .put(url)
        .header(reqwest::header::CONTENT_TYPE, content_type)
        .body(bytes)
        .timeout(Duration::from_secs(600))
        .send()
        .await
        .map_err(|e| format!("Upload failed for {}: {e}", path.display()))?;
    if !res.status().is_success() {
        return Err(format!("Upload failed for {} ({})", path.display(), res.status()));
    }
    Ok(())
}

pub async fn publish_game<F>(params: PublishGameParams, progress: F) -> Result<PublishGameResult, String>
where
    F: Fn(PublishProgress) + Send + Sync,
{
    let token = require_token()?;
    let emit = |stage: &'static str, message: String, done: usize, total: usize| {
        progress(PublishProgress { slug: params.slug.clone(), stage, message, done, total });
    };

    let cwd = PathBuf::from(&params.cwd);
    if let Some(command) = params.build_command.as_deref().map(str::trim).filter(|c| !c.is_empty()) {
        emit("build", format!("Running `{command}`"), 0, 0);
        run_build(&cwd, command).await?;
    }

    emit("scan", "Collecting files".into(), 0, 0);
    let out_dir = cwd.join(&params.output_dir);
    if !out_dir.is_dir() {
        return Err(format!("Output folder not found: {}", out_dir.display()));
    }
    let files = collect_files(&out_dir)?;
    if !files.iter().any(|f| f.rel == "index.html") {
        return Err(format!("{} has no index.html at its root", out_dir.display()));
    }
    let total_bytes: u64 = files.iter().map(|f| f.size).sum();

    let cover = match params.cover_path.as_deref().filter(|p| !p.is_empty()) {
        Some(path) => {
            let path = PathBuf::from(path);
            let size = std::fs::metadata(&path).map_err(|e| format!("Cover: {e}"))?.len();
            let ext = path
                .extension()
                .map(|e| e.to_string_lossy().to_lowercase())
                .ok_or_else(|| "Cover needs a file extension".to_string())?;
            Some((path, ext, size))
        }
        None => None,
    };

    let client = http();
    let mut init_body = json!({
        "slug": params.slug,
        "title": params.title,
        "files": files.iter().map(|f| json!({ "path": f.rel, "size": f.size })).collect::<Vec<_>>(),
    });
    // Omit empty optionals entirely: the server schema accepts a missing field, not `null`.
    let optional = [
        ("tagline", params.tagline.as_deref().filter(|s| !s.is_empty()).map(Value::from)),
        ("description", params.description.as_deref().filter(|s| !s.is_empty()).map(Value::from)),
        ("genre", params.genre.as_deref().filter(|s| !s.is_empty()).map(Value::from)),
        ("dimension", params.dimension.as_deref().filter(|s| !s.is_empty()).map(Value::from)),
        ("cover", cover.as_ref().map(|(_, ext, size)| json!({ "ext": ext, "size": size }))),
    ];
    for (key, value) in optional {
        if let Some(value) = value {
            init_body[key] = value;
        }
    }
    let res = client
        .post(format!("{}/api/games/publish", api_base()))
        .bearer_auth(&token)
        .json(&init_body)
        .timeout(Duration::from_secs(120))
        .send()
        .await
        .map_err(|e| format!("ProductShip unreachable: {e}"))?;
    let status = res.status();
    if !status.is_success() {
        let body: Value = res.json().await.unwrap_or(Value::Null);
        return Err(error_message(&body, status));
    }
    let init: InitResponse = res.json().await.map_err(|e| format!("Malformed publish response: {e}"))?;

    let by_path: std::collections::HashMap<&str, &LocalFile> =
        files.iter().map(|f| (f.rel.as_str(), f)).collect();
    // Owned jobs keep the upload futures free of borrows, so the whole publish
    // future stays `Send` for the axum handler.
    let mut jobs = Vec::with_capacity(init.uploads.len());
    for target in init.uploads {
        let file = by_path
            .get(target.path.as_str())
            .ok_or_else(|| format!("Server asked for unknown file {}", target.path))?;
        jobs.push((target.url, target.content_type, file.abs.clone()));
    }
    let total = jobs.len();
    emit("upload", format!("Uploading {total} files"), 0, total);

    let mut done = 0usize;
    let mut uploads = stream::iter(jobs.into_iter().map(|(url, content_type, path)| {
        let client = client.clone();
        async move { put_file(&client, &url, &content_type, &path).await }
    }))
    .buffer_unordered(UPLOAD_CONCURRENCY);
    while let Some(result) = uploads.next().await {
        result?;
        done += 1;
        emit("upload", format!("Uploaded {done}/{total}"), done, total);
    }
    drop(uploads);

    if let (Some(target), Some((path, _, _))) = (init.cover.as_ref(), cover.as_ref()) {
        put_file(&client, &target.url, &target.content_type, path).await?;
    }

    emit("finalize", "Going live".into(), total, total);
    let res = client
        .post(format!("{}/api/games/publish/complete", api_base()))
        .bearer_auth(&token)
        .json(&json!({ "slug": params.slug, "version": init.version }))
        .timeout(Duration::from_secs(120))
        .send()
        .await
        .map_err(|e| format!("ProductShip unreachable: {e}"))?;
    let status = res.status();
    if !status.is_success() {
        let body: Value = res.json().await.unwrap_or(Value::Null);
        return Err(error_message(&body, status));
    }
    let done: CompleteResponse = res.json().await.map_err(|e| format!("Malformed publish response: {e}"))?;

    Ok(PublishGameResult {
        version: done.version,
        play_url: done.play_url,
        page_url: done.page_url,
        file_count: files.len(),
        total_bytes,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn confirm_code_matches_server_format() {
        // Server: sha256 hex, first 8 chars uppercased, split 4-4.
        let code = "a".repeat(64);
        let expected = {
            let hex = format!("{:x}", Sha256::digest(code.as_bytes()));
            let head = hex[..8].to_uppercase();
            format!("{}-{}", &head[..4], &head[4..])
        };
        assert_eq!(confirm_code(&code), expected);
    }

    #[test]
    fn collect_skips_dotfiles_and_maps() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        std::fs::write(root.join("index.html"), "<html>").unwrap();
        std::fs::create_dir_all(root.join("assets")).unwrap();
        std::fs::write(root.join("assets/app.js"), "x").unwrap();
        std::fs::write(root.join("assets/app.js.map"), "x").unwrap();
        std::fs::write(root.join(".DS_Store"), "x").unwrap();
        std::fs::create_dir_all(root.join(".git")).unwrap();
        std::fs::write(root.join(".git/HEAD"), "x").unwrap();
        let rels: Vec<String> = collect_files(root).unwrap().into_iter().map(|f| f.rel).collect();
        assert_eq!(rels, vec!["assets/app.js".to_string(), "index.html".to_string()]);
    }
}

