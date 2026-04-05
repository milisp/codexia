use std::collections::HashMap;
use std::ffi::OsStr;
use std::path::{Path, PathBuf};
use std::sync::{Arc, LazyLock, Mutex};
use std::sync::atomic::AtomicBool;

use crate::features::git::helpers::{open_repo, repo_root_path};
use crate::features::git::types::{GitApplyWorktreeResponse, GitCreateWorktreeResponse};

// ---------------------------------------------------------------------------
// Per-path locking — prevents concurrent create/remove on the same worktree.
// The inner Mutex is only held briefly (to insert/clone the Arc); the Arc'd
// Mutex is then held for the full duration of the operation.
// ---------------------------------------------------------------------------
static WORKTREE_LOCKS: LazyLock<Mutex<HashMap<String, Arc<Mutex<()>>>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

fn acquire_path_lock(path: &Path) -> Arc<Mutex<()>> {
    let key = path.to_string_lossy().to_string();
    let mut map = WORKTREE_LOCKS.lock().unwrap();
    map.entry(key)
        .or_insert_with(|| Arc::new(Mutex::new(())))
        .clone()
}

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

/// Returns `~/.codexia/worktrees/{repo_name}-{short_hash}/`.
fn worktrees_base_dir(repo_root: &Path) -> Result<PathBuf, String> {
    let home = std::env::var("HOME")
        .map(PathBuf::from)
        .or_else(|_| std::env::var("USERPROFILE").map(PathBuf::from))
        .map_err(|_| "Cannot find home directory (HOME / USERPROFILE not set)".to_string())?;

    let repo_name = repo_root
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "repo".to_string());

    let hash: u32 = repo_root
        .to_string_lossy()
        .bytes()
        .fold(0u32, |acc, b| acc.wrapping_mul(31).wrapping_add(b as u32));

    Ok(home
        .join(".codexia")
        .join("worktrees")
        .join(format!("{}-{:06x}", repo_name, hash & 0xFF_FFFF)))
}

fn sanitize_worktree_key(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    for ch in input.chars() {
        if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' {
            out.push(ch);
        } else {
            out.push('-');
        }
    }
    let trimmed = out.trim_matches('-');
    if trimmed.is_empty() {
        "worktree".to_string()
    } else {
        trimmed.to_string()
    }
}

// ---------------------------------------------------------------------------
// State validation
// ---------------------------------------------------------------------------

/// Returns the `.git/worktrees/` metadata directory for a repo root.
fn worktree_metadata_dir(repo_root: &Path) -> PathBuf {
    repo_root.join(".git").join("worktrees")
}

/// Canonical path comparison that handles macOS `/private/var` aliasing.
fn canonical(path: &Path) -> PathBuf {
    std::fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf())
}

/// Searches `.git/worktrees/*/gitdir` to find the internal worktree name
/// whose `gitdir` file points to `worktree_path/.git`.
fn find_worktree_internal_name(repo_root: &Path, worktree_path: &Path) -> Option<String> {
    let metadata_dir = worktree_metadata_dir(repo_root);
    let target = canonical(&worktree_path.join(".git"));

    let entries = std::fs::read_dir(&metadata_dir).ok()?;
    for entry in entries.flatten() {
        let gitdir_file = entry.path().join("gitdir");
        if let Ok(content) = std::fs::read_to_string(&gitdir_file) {
            let referenced = canonical(Path::new(content.trim()));
            if referenced == target {
                return Some(entry.file_name().to_string_lossy().to_string());
            }
        }
    }
    None
}

/// True only if both the filesystem path exists *and* git metadata is valid.
fn is_worktree_properly_set_up(repo_root: &Path, worktree_path: &Path) -> bool {
    if !worktree_path.exists() {
        return false;
    }
    // The worktree must be registered in .git/worktrees/
    find_worktree_internal_name(repo_root, worktree_path).is_some()
}

// ---------------------------------------------------------------------------
// Cleanup helpers
// ---------------------------------------------------------------------------

/// Directly removes the `.git/worktrees/<name>` metadata directory.
fn force_cleanup_worktree_metadata(repo_root: &Path, worktree_path: &Path) {
    if let Some(name) = find_worktree_internal_name(repo_root, worktree_path) {
        let meta = worktree_metadata_dir(repo_root).join(name);
        if meta.exists() {
            log::debug!("Removing git worktree metadata: {}", meta.display());
            let _ = std::fs::remove_dir_all(&meta);
        }
    }
}

/// Four-step comprehensive cleanup (mirrors vibe-kanban's approach):
/// 1. `git worktree remove --force`
/// 2. Force-remove `.git/worktrees/<name>` metadata
/// 3. Remove physical directory
/// 4. `git worktree prune`
fn comprehensive_cleanup(repo_root: &Path, worktree_path: &Path) {
    // Step 1: ask git to deregister
    let _ = std::process::Command::new("git")
        .args(["worktree", "remove", "--force"])
        .arg(worktree_path)
        .current_dir(repo_root)
        .output();

    // Step 2: forcibly delete metadata even if step 1 failed
    force_cleanup_worktree_metadata(repo_root, worktree_path);

    // Step 3: remove physical directory
    if worktree_path.exists() {
        log::debug!("Removing worktree directory: {}", worktree_path.display());
        let _ = std::fs::remove_dir_all(worktree_path);
    }

    // Step 4: prune any remaining stale entries
    let _ = std::process::Command::new("git")
        .args(["worktree", "prune"])
        .current_dir(repo_root)
        .output();
}

// ---------------------------------------------------------------------------
// Git operations
// ---------------------------------------------------------------------------

fn run_git_worktree_add(repo_root: &Path, worktree_path: &Path) -> Result<(), String> {
    if let Some(parent) = worktree_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create parent directory: {e}"))?;
    }
    let output = std::process::Command::new("git")
        .args(["worktree", "add", "--detach"])
        .arg(worktree_path)
        .current_dir(repo_root)
        .output()
        .map_err(|e| format!("Failed to run git: {e}"))?;

    if !output.status.success() {
        return Err(format!(
            "git worktree add failed: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }
    Ok(())
}

/// Copies common env files from `src` to `dst` if absent in `dst`.
fn copy_env_files(src: &Path, dst: &Path) -> Vec<String> {
    const ENV_FILES: &[&str] = &[
        ".env",
        ".env.local",
        ".env.development",
        ".env.development.local",
        ".env.test",
        ".env.test.local",
        ".env.production",
        ".env.production.local",
    ];
    let mut copied = Vec::new();
    for name in ENV_FILES {
        let src_file = src.join(name);
        let dst_file = dst.join(name);
        if src_file.exists() && !dst_file.exists() {
            if std::fs::copy(&src_file, &dst_file).is_ok() {
                copied.push(name.to_string());
            }
        }
    }
    copied
}

fn run_git_collect_output<I, S>(cwd: &Path, args: I) -> Result<std::process::Output, String>
where
    I: IntoIterator<Item = S>,
    S: AsRef<OsStr>,
{
    std::process::Command::new("git")
        .args(args)
        .current_dir(cwd)
        .output()
        .map_err(|e| format!("Failed to run git: {e}"))
}

fn ensure_git_ok(output: std::process::Output, context: &str) -> Result<std::process::Output, String> {
    if output.status.success() {
        return Ok(output);
    }
    Err(format!(
        "{context}: {}",
        String::from_utf8_lossy(&output.stderr).trim()
    ))
}

/// A file change to be applied from the worktree to the main checkout.
struct WorktreeChange {
    path: String,
    deleted: bool,
}

/// Collects all files that differ between `base_commit` (main repo HEAD) and
/// the worktree — covering both committed changes (worktree HEAD ahead of base)
/// and uncommitted working-tree changes.
fn collect_worktree_changes(
    worktree_path: &Path,
    base_commit: &str,
) -> Result<Vec<WorktreeChange>, String> {
    use std::collections::HashMap;

    // 1. Committed changes: diff between base commit and worktree HEAD.
    //    `--diff-filter=ACDMRT` covers Add/Copy/Delete/Modify/Rename/Type-change.
    let committed_out = ensure_git_ok(
        run_git_collect_output(
            worktree_path,
            [
                "diff",
                "--name-status",
                "--diff-filter=ACDMRT",
                base_commit,
                "HEAD",
            ],
        )?,
        "git diff (committed) failed",
    )?;

    // path → deleted
    let mut map: HashMap<String, bool> = HashMap::new();

    for line in String::from_utf8_lossy(&committed_out.stdout).lines() {
        let mut parts = line.splitn(2, '\t');
        let status = parts.next().unwrap_or("").trim();
        let path = match parts.next() {
            Some(p) => p.trim().to_string(),
            None => continue,
        };
        if path.is_empty() { continue; }
        map.insert(path, status.starts_with('D'));
    }

    // 2. Uncommitted changes (working tree + index) in the worktree.
    let status_out = ensure_git_ok(
        run_git_collect_output(
            worktree_path,
            ["status", "--porcelain=v1", "--untracked-files=all"],
        )?,
        "git status failed",
    )?;

    for line in String::from_utf8_lossy(&status_out.stdout).lines() {
        if line.len() < 4 { continue; }
        let x = line.chars().next().unwrap_or(' ');
        let y = line.chars().nth(1).unwrap_or(' ');
        let path = line[3..].trim().to_string();
        if path.is_empty() { continue; }
        let deleted = y == 'D' || (x == 'D' && y == ' ');
        // Uncommitted change overwrites the committed-change entry for the same path.
        map.insert(path, deleted);
    }

    Ok(map
        .into_iter()
        .map(|(path, deleted)| WorktreeChange { path, deleted })
        .collect())
}

/// Returns the full commit hash of HEAD in the given directory.
fn git_rev_parse_head(dir: &Path) -> Result<String, String> {
    let out = ensure_git_ok(
        run_git_collect_output(dir, ["rev-parse", "HEAD"])?,
        "git rev-parse HEAD failed",
    )?;
    Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/// Creates a linked git worktree (detached HEAD) for the given key.
///
/// - Idempotent: returns `existed = true` if already properly set up.
/// - If partially set up (stale metadata / missing directory), cleans up then
///   recreates.
/// - On first-time creation failure, cleans metadata and retries once.
/// - Concurrent calls for the same path are serialised via a per-path lock.
pub fn git_create_worktree(
    cwd: String,
    worktree_key: String,
) -> Result<GitCreateWorktreeResponse, String> {
    let repo = open_repo(&cwd)?;
    let repo_root = repo_root_path(&repo)?;
    let safe_key = sanitize_worktree_key(&worktree_key);
    let worktrees_dir = worktrees_base_dir(&repo_root)?;
    let worktree_path = worktrees_dir.join(&safe_key);

    let lock = acquire_path_lock(&worktree_path);
    let _guard = lock.lock().unwrap();

    let repo_root_str = repo_root.to_string_lossy().to_string();
    let worktree_path_str = worktree_path.to_string_lossy().to_string();

    // Validate both filesystem and git metadata.
    if is_worktree_properly_set_up(&repo_root, &worktree_path) {
        return Ok(GitCreateWorktreeResponse {
            repo_root: repo_root_str,
            worktree_path: worktree_path_str,
            existed: true,
            copied_env_files: vec![],
        });
    }

    // Partial state detected — clean up before creating.
    if worktree_path.exists()
        || find_worktree_internal_name(&repo_root, &worktree_path).is_some()
    {
        log::debug!(
            "Stale worktree state detected at {}, cleaning up",
            worktree_path_str
        );
        comprehensive_cleanup(&repo_root, &worktree_path);
    }

    // First attempt.
    if let Err(e) = run_git_worktree_add(&repo_root, &worktree_path) {
        log::warn!("git worktree add failed, retrying after metadata cleanup: {e}");
        // Clean up any partial state and retry once.
        force_cleanup_worktree_metadata(&repo_root, &worktree_path);
        if worktree_path.exists() {
            let _ = std::fs::remove_dir_all(&worktree_path);
        }
        run_git_worktree_add(&repo_root, &worktree_path)?;
    }

    if !worktree_path.exists() {
        return Err(format!(
            "git worktree add succeeded but path does not exist: {worktree_path_str}"
        ));
    }

    let copied_env_files = copy_env_files(&repo_root, &worktree_path);
    log::debug!("Created worktree at {worktree_path_str}");

    Ok(GitCreateWorktreeResponse {
        repo_root: repo_root_str,
        worktree_path: worktree_path_str,
        existed: false,
        copied_env_files,
    })
}

/// Removes a linked worktree using the four-step comprehensive cleanup.
/// Concurrent calls for the same path are serialised via a per-path lock.
pub fn git_remove_worktree(cwd: String, worktree_key: String) -> Result<(), String> {
    let repo = open_repo(&cwd)?;
    let repo_root = repo_root_path(&repo)?;
    let safe_key = sanitize_worktree_key(&worktree_key);
    let worktrees_dir = worktrees_base_dir(&repo_root)?;
    let worktree_path = worktrees_dir.join(&safe_key);

    let lock = acquire_path_lock(&worktree_path);
    let _guard = lock.lock().unwrap();

    if !worktree_path.exists()
        && find_worktree_internal_name(&repo_root, &worktree_path).is_none()
    {
        return Ok(());
    }

    comprehensive_cleanup(&repo_root, &worktree_path);
    log::debug!(
        "Removed worktree {}",
        worktree_path.to_string_lossy()
    );
    Ok(())
}

/// Applies all tracked and untracked changes from a linked worktree onto the
/// target checkout at `cwd` by directly copying/deleting files.
///
/// This approach is robust regardless of the main checkout's index state
/// (e.g. staged changes to the same files won't cause "does not match index"
/// errors that the `git apply` patch approach suffers from).
pub fn git_apply_worktree_changes(
    cwd: String,
    worktree_key: String,
) -> Result<GitApplyWorktreeResponse, String> {
    let repo = open_repo(&cwd)?;
    let repo_root = repo_root_path(&repo)?;
    let safe_key = sanitize_worktree_key(&worktree_key);
    let worktrees_dir = worktrees_base_dir(&repo_root)?;
    let worktree_path = worktrees_dir.join(&safe_key);

    let lock = acquire_path_lock(&worktree_path);
    let _guard = lock.lock().unwrap();

    if !is_worktree_properly_set_up(&repo_root, &worktree_path) {
        return Err(format!(
            "Worktree is not available: {}",
            worktree_path.to_string_lossy()
        ));
    }

    let target_path = canonical(Path::new(&cwd));
    let source_path = canonical(&worktree_path);
    if target_path == source_path {
        return Err("Cannot apply worktree changes onto the same worktree".to_string());
    }

    // Get main repo HEAD to use as the base for diffing committed changes.
    let base_commit = git_rev_parse_head(&repo_root)?;

    let changes = collect_worktree_changes(&worktree_path, &base_commit)?;
    if changes.is_empty() {
        return Err("No worktree changes to apply".to_string());
    }

    let changed_count = changes.len();

    for change in &changes {
        if change.deleted {
            let dst = repo_root.join(&change.path);
            if dst.exists() {
                std::fs::remove_file(&dst)
                    .map_err(|e| format!("Failed to delete {}: {e}", change.path))?;
            }
        } else {
            let src = worktree_path.join(&change.path);
            let dst = repo_root.join(&change.path);
            if let Some(parent) = dst.parent() {
                std::fs::create_dir_all(parent)
                    .map_err(|e| format!("Failed to create directory for {}: {e}", change.path))?;
            }
            std::fs::copy(&src, &dst)
                .map_err(|e| format!("Failed to copy {}: {e}", change.path))?;
        }
    }

    Ok(GitApplyWorktreeResponse {
        changed_files: changed_count,
    })
}

/// Scans all of `~/.codexia/worktrees/` at startup and removes directories
/// that look like worktrees (contain a `.git` file) but whose backing repo no
/// longer has them registered — typically left over from a crash.
///
/// The repo root is inferred from the worktree's own `.git` file so no `cwd`
/// is required.
pub fn scan_all_orphan_worktrees() {
    let base = match global_worktrees_base() {
        Some(p) => p,
        None => return,
    };

    if !base.exists() {
        return;
    }

    // ~/.codexia/worktrees/{repo}-{hash}/{worktree_key}/
    let repo_dirs = match std::fs::read_dir(&base) {
        Ok(d) => d,
        Err(_) => return,
    };

    for repo_entry in repo_dirs.flatten() {
        let repo_dir = repo_entry.path();
        if !repo_dir.is_dir() {
            continue;
        }
        let wt_entries = match std::fs::read_dir(&repo_dir) {
            Ok(d) => d,
            Err(_) => continue,
        };
        for wt_entry in wt_entries.flatten() {
            let wt_path = wt_entry.path();
            if !wt_path.is_dir() {
                continue;
            }
            // A worktree has a `.git` file (not a directory).
            let git_marker = wt_path.join(".git");
            if !git_marker.is_file() {
                continue;
            }
            // Read the `.git` file to find the repo root.
            // Format: "gitdir: /repo/.git/worktrees/<name>"
            let git_content = match std::fs::read_to_string(&git_marker) {
                Ok(s) => s,
                Err(_) => continue,
            };
            let gitdir = git_content
                .strip_prefix("gitdir: ")
                .unwrap_or(git_content.trim())
                .trim()
                .to_string();

            // .git/worktrees/<name> → .git → repo root
            let repo_root = match PathBuf::from(&gitdir).parent().and_then(|p| p.parent()) {
                Some(p) => p.to_path_buf(),
                None => continue,
            };

            if !repo_root.exists() {
                // Repo deleted — just remove the directory.
                log::warn!(
                    "Orphan worktree at {} (repo gone), removing",
                    wt_path.display()
                );
                let lock = acquire_path_lock(&wt_path);
                let _guard = lock.lock().unwrap();
                let _ = std::fs::remove_dir_all(&wt_path);
                continue;
            }

            if find_worktree_internal_name(&repo_root, &wt_path).is_none() {
                log::warn!(
                    "Orphan worktree at {} (not in git metadata), removing",
                    wt_path.display()
                );
                let lock = acquire_path_lock(&wt_path);
                let _guard = lock.lock().unwrap();
                comprehensive_cleanup(&repo_root, &wt_path);
            }
        }
    }
}

fn global_worktrees_base() -> Option<PathBuf> {
    let home = std::env::var("HOME")
        .map(PathBuf::from)
        .or_else(|_| std::env::var("USERPROFILE").map(PathBuf::from))
        .ok()?;
    Some(home.join(".codexia").join("worktrees"))
}

// ---------------------------------------------------------------------------
// git clone helper (unchanged)
// ---------------------------------------------------------------------------

pub fn clone(url: &str, path: &Path) -> anyhow::Result<PathBuf> {
    if path.exists() {
        let git_dir = path.join(".git");
        if git_dir.exists() {
            return Ok(path.to_path_buf());
        }
        let is_empty = std::fs::read_dir(path)?.next().is_none();
        if !is_empty {
            anyhow::bail!(
                "target exists and is not an empty directory/git repository: {}",
                path.display()
            );
        }
    }

    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    let should_interrupt = AtomicBool::new(false);
    let mut prepare = gix::prepare_clone(url, path)?;

    let (mut checkout, _outcome) = prepare
        .fetch_then_checkout(gix::progress::Discard, &should_interrupt)
        .map_err(|e| anyhow::anyhow!("fetch_then_checkout failed: {}", e))?;

    let repo = checkout.main_worktree(gix::progress::Discard, &should_interrupt)?;
    drop(repo);

    let git_dir = path.join(".git");
    if !git_dir.exists() {
        anyhow::bail!(
            "clone appeared to succeed but .git directory not found at: {}",
            git_dir.display()
        );
    }

    Ok(path.to_path_buf())
}
