use anyhow::Result;
use std::path::{Path, PathBuf};
use std::sync::atomic::AtomicBool;

use crate::features::git::helpers::{open_repo, repo_root_path};
use crate::features::git::types::GitCreateWorktreeResponse;

pub fn clone(url: &str, path: &Path) -> Result<PathBuf> {
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

/// Returns `~/.codexia/worktrees/{repo_name}-{short_hash}/`.
/// Home-level storage keeps worktrees out of every project directory and
/// avoids gitignore concerns while still allowing `git worktree add`.
fn worktrees_base_dir(repo_root: &Path) -> Result<PathBuf, String> {
    let home = std::env::var("HOME")
        .map(PathBuf::from)
        .or_else(|_| std::env::var("USERPROFILE").map(PathBuf::from))
        .map_err(|_| "Cannot find home directory (HOME / USERPROFILE not set)".to_string())?;

    let repo_name = repo_root
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "repo".to_string());

    // Short hash of the full repo path to disambiguate repos with the same name.
    let hash: u32 = repo_root
        .to_string_lossy()
        .bytes()
        .fold(0u32, |acc, b| acc.wrapping_mul(31).wrapping_add(b as u32));

    Ok(home
        .join(".codexia")
        .join("worktrees")
        .join(format!("{}-{:06x}", repo_name, hash & 0xFF_FFFF)))
}

/// Creates a linked git worktree at `worktree_path` using `git worktree add --detach`.
/// The worktree shares the object database with the main repo (no copying).
fn create_git_worktree(repo_root: &Path, worktree_path: &Path) -> Result<(), String> {
    if let Some(parent) = worktree_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create worktrees directory: {e}"))?;
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

/// Copy common env files from `src` to `dst` if they exist in src and not yet in dst.
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
        "thread".to_string()
    } else {
        trimmed.to_string()
    }
}

pub fn git_create_worktree(
    cwd: String,
    worktree_key: String,
) -> Result<GitCreateWorktreeResponse, String> {
    let repo = open_repo(&cwd)?;
    let repo_root = repo_root_path(&repo)?;
    let safe_key = sanitize_worktree_key(&worktree_key);
    let worktrees_dir = worktrees_base_dir(&repo_root)?;
    let worktree_path = worktrees_dir.join(&safe_key);

    let repo_root_str = repo_root.to_string_lossy().to_string();
    let worktree_path_str = worktree_path.to_string_lossy().to_string();

    if worktree_path.join(".git").exists() || gix::discover(&worktree_path).is_ok() {
        return Ok(GitCreateWorktreeResponse {
            repo_root: repo_root_str,
            worktree_path: worktree_path_str,
            existed: true,
            copied_env_files: vec![],
        });
    }

    create_git_worktree(&repo_root, &worktree_path)?;
    let copied_env_files = copy_env_files(&repo_root, &worktree_path);

    Ok(GitCreateWorktreeResponse {
        repo_root: repo_root_str,
        worktree_path: worktree_path_str,
        existed: false,
        copied_env_files,
    })
}

/// Removes a linked worktree created by `git_create_worktree`.
/// Uses `git worktree remove --force` so dirty worktrees are also cleaned up.
pub fn git_remove_worktree(cwd: String, worktree_key: String) -> Result<(), String> {
    let repo = open_repo(&cwd)?;
    let repo_root = repo_root_path(&repo)?;
    let safe_key = sanitize_worktree_key(&worktree_key);
    let worktrees_dir = worktrees_base_dir(&repo_root)?;
    let worktree_path = worktrees_dir.join(&safe_key);

    if !worktree_path.exists() {
        return Ok(());
    }

    let output = std::process::Command::new("git")
        .args(["worktree", "remove", "--force"])
        .arg(&worktree_path)
        .current_dir(&repo_root)
        .output()
        .map_err(|e| format!("Failed to run git: {e}"))?;

    if !output.status.success() {
        // Fallback: remove directory manually then prune stale metadata
        std::fs::remove_dir_all(&worktree_path)
            .map_err(|e| format!("Failed to remove worktree directory: {e}"))?;
        let _ = std::process::Command::new("git")
            .args(["worktree", "prune"])
            .current_dir(&repo_root)
            .output();
    }

    Ok(())
}
