use gix::bstr::ByteSlice;
use std::collections::HashMap;

use crate::helpers::open_repo;
use crate::types::{GitBranchInfoResult, GitBranchListResult};

pub fn git_branch_info(cwd: String) -> Result<GitBranchInfoResult, String> {
    let repo = open_repo(&cwd)?;

    // Get current branch name from HEAD
    let branch = repo
        .head()
        .ok()
        .and_then(|head| head.try_into_referent())
        .map(|r| {
            let full = r.name().as_bstr().to_str_lossy().into_owned();
            full.strip_prefix("refs/heads/")
                .unwrap_or(&full)
                .to_string()
        })
        .unwrap_or_else(|| {
            // Detached HEAD — use short commit hash
            repo.head_id()
                .map(|id| id.to_hex_with_len(7).to_string())
                .unwrap_or_else(|_| "HEAD".to_string())
        });

    let (owner, repo_name) = extract_owner_repo(&repo);

    Ok(GitBranchInfoResult {
        owner,
        repo: repo_name,
        branch,
    })
}

/// Try to extract owner/repo from the "origin" remote URL.
/// Falls back to the working directory name when no remote is configured.
fn extract_owner_repo(repo: &gix::Repository) -> (String, String) {
    let url_str = repo
        .find_remote("origin")
        .ok()
        .and_then(|r| {
            r.url(gix::remote::Direction::Fetch)
                .map(|u| u.to_bstring().to_str_lossy().into_owned())
        });

    if let Some(url) = url_str
        && let Some(pair) = parse_remote_url_owner_repo(&url) {
            return pair;
        }

    // Fall back to directory name as repo name
    let repo_name = repo
        .workdir()
        .and_then(|p| p.file_name())
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();

    (String::new(), repo_name)
}

pub fn git_list_branches(cwd: String) -> Result<GitBranchListResult, String> {
    let repo = open_repo(&cwd)?;

    let current = repo
        .head()
        .ok()
        .and_then(|head| head.try_into_referent())
        .map(|r| {
            let full = r.name().as_bstr().to_str_lossy().into_owned();
            full.strip_prefix("refs/heads/")
                .unwrap_or(&full)
                .to_string()
        })
        .unwrap_or_default();

    let platform = repo
        .references()
        .map_err(|e| format!("Failed to access references: {e}"))?;

    let mut branches: Vec<String> = platform
        .prefixed("refs/heads/")
        .map_err(|e| format!("Failed to iterate branches: {e}"))?
        .filter_map(|r| {
            r.ok().map(|r| {
                let full = r.name().as_bstr().to_str_lossy().into_owned();
                full.strip_prefix("refs/heads/")
                    .unwrap_or(&full)
                    .to_string()
            })
        })
        .collect();

    branches.sort();

    Ok(GitBranchListResult { current, branches })
}

pub fn git_create_branch(cwd: String, branch: String) -> Result<(), String> {
    let repo = open_repo(&cwd)?;

    let head_id = repo
        .head_id()
        .map_err(|e| format!("Failed to resolve HEAD: {e}"))?
        .detach();

    let branch_ref: gix::refs::FullName = format!("refs/heads/{branch}")
        .try_into()
        .map_err(|_| format!("Invalid branch name: '{branch}'"))?;

    repo.edit_reference(gix::refs::transaction::RefEdit {
        change: gix::refs::transaction::Change::Update {
            log: gix::refs::transaction::LogChange {
                mode: gix::refs::transaction::RefLog::AndReference,
                force_create_reflog: false,
                message: "branch: Created from HEAD".into(),
            },
            expected: gix::refs::transaction::PreviousValue::MustNotExist,
            new: gix::refs::Target::Object(head_id),
        },
        name: branch_ref,
        deref: false,
    })
    .map_err(|e| format!("Failed to create branch '{branch}': {e}"))?;

    // Point HEAD at the new branch
    std::fs::write(
        repo.git_dir().join("HEAD"),
        format!("ref: refs/heads/{branch}\n"),
    )
    .map_err(|e| format!("Failed to update HEAD: {e}"))?;

    Ok(())
}

pub fn git_checkout_branch(cwd: String, branch: String) -> Result<(), String> {
    let repo = open_repo(&cwd)?;

    // Resolve target branch → commit → tree
    let branch_ref = format!("refs/heads/{branch}");
    let mut reference = repo
        .find_reference(branch_ref.as_str())
        .map_err(|e| format!("Branch '{branch}' not found: {e}"))?;

    let target_commit_id = reference
        .peel_to_id()
        .map_err(|e| format!("Failed to resolve '{branch}': {e}"))?
        .detach();

    let target_tree_id = repo
        .find_object(target_commit_id)
        .map_err(|e| format!("Failed to find commit object: {e}"))?
        .try_into_commit()
        .map_err(|_| format!("'{branch}' does not point to a commit"))?
        .tree_id()
        .map_err(|e| format!("Failed to get tree id: {e}"))?
        .detach();

    let workdir = repo
        .workdir()
        .ok_or_else(|| "Repository has no worktree".to_string())?
        .to_path_buf();

    // Build snapshot of current index: path → oid
    let old_oid_map: HashMap<String, gix::ObjectId> = {
        let old_index = repo
            .index_or_empty()
            .map_err(|e| format!("Failed to open current index: {e}"))?;
        let backing = old_index.path_backing();
        old_index
            .entries()
            .iter()
            .map(|e| (e.path_in(backing).to_str_lossy().into_owned(), e.id))
            .collect()
    };

    // Build new index from target tree
    let mut new_index = repo
        .index_from_tree(&target_tree_id)
        .map_err(|e| format!("Failed to build index from tree: {e}"))?;

    // Collect new index entries to write
    let new_entries: Vec<(String, gix::ObjectId)> = {
        let backing = new_index.path_backing();
        new_index
            .entries()
            .iter()
            .map(|e| (e.path_in(backing).to_str_lossy().into_owned(), e.id))
            .collect()
    };

    let new_paths: std::collections::HashSet<&str> =
        new_entries.iter().map(|(p, _)| p.as_str()).collect();

    // Delete files present in old tree but absent in new tree
    for path_str in old_oid_map.keys() {
        if !new_paths.contains(path_str.as_str()) {
            let full_path = workdir.join(path_str);
            if full_path.exists() {
                std::fs::remove_file(&full_path)
                    .map_err(|e| format!("Failed to delete '{path_str}': {e}"))?;
            }
        }
    }

    // Write new or changed files
    for (path_str, oid) in &new_entries {
        if old_oid_map.get(path_str) == Some(oid) {
            continue; // unchanged
        }
        let full_path = workdir.join(path_str);
        if let Some(parent) = full_path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create directory for '{path_str}': {e}"))?;
        }
        let object = repo
            .find_object(*oid)
            .map_err(|e| format!("Failed to read object for '{path_str}': {e}"))?;
        std::fs::write(&full_path, &object.data)
            .map_err(|e| format!("Failed to write '{path_str}': {e}"))?;
    }

    // Persist new index to .git/index
    new_index
        .write(gix::index::write::Options::default())
        .map_err(|e| format!("Failed to write index: {e}"))?;

    // Update HEAD symref
    std::fs::write(
        repo.git_dir().join("HEAD"),
        format!("ref: refs/heads/{branch}\n"),
    )
    .map_err(|e| format!("Failed to update HEAD: {e}"))?;

    Ok(())
}

/// Parse owner and repo name from either SSH or HTTPS remote URLs.
///
/// Supported formats:
/// - `git@github.com:owner/repo.git`
/// - `https://github.com/owner/repo.git`
fn parse_remote_url_owner_repo(url: &str) -> Option<(String, String)> {
    // Normalize SSH colon separator to slash so both formats share the same split logic
    let normalized = if url.contains("://") {
        url.to_string()
    } else if let Some(pos) = url.find(':') {
        let mut s = url.to_string();
        s.replace_range(pos..=pos, "/");
        s
    } else {
        return None;
    };

    // Take the last two non-empty path segments: owner and repo
    let parts: Vec<&str> = normalized.split('/').filter(|s| !s.is_empty()).collect();
    if parts.len() < 2 {
        return None;
    }

    let owner = parts[parts.len() - 2].to_string();
    let repo_name = parts[parts.len() - 1]
        .trim_end_matches(".git")
        .to_string();

    if owner.is_empty() || repo_name.is_empty() {
        return None;
    }

    Some((owner, repo_name))
}
