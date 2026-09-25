use crate::helpers::open_repo;
use gix::bstr::{BStr, ByteSlice};
use gix::objs::tree::{Entry, EntryKind, EntryMode};
use gix::objs::Tree;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/// Split a repo-relative path like `"src/foo/bar.rs"` into the first
/// component (`"src"`) and the remainder (`"foo/bar.rs"`), or return
/// `(full, None)` for top-level files.
fn split_path(path: &BStr) -> (&BStr, Option<&BStr>) {
    match path.find_byte(b'/') {
        Some(pos) => {
            let head = path[..pos].as_bstr();
            let tail = path[pos + 1..].as_bstr();
            (head, Some(tail))
        }
        None => (path, None),
    }
}

/// Recursively write a subtree for entries whose paths share the given
/// `prefix` (already stripped).  Each element of `flat` is `(path, id, mode)`.
/// Returns the `ObjectId` of the written tree object.
fn write_tree_recursive(
    repo: &gix::Repository,
    flat: &[(&BStr, gix::ObjectId, EntryMode)],
) -> Result<gix::ObjectId, String> {
    let mut tree = Tree::empty();
    let mut i = 0;

    while i < flat.len() {
        let (path, id, mode) = flat[i];
        let (head, tail) = split_path(path);

        if tail.is_some() {
            // Collect all entries that belong to this subdirectory
            let subtree_start = i;
            while i < flat.len() {
                let (p, _, _) = flat[i];
                let (h, _) = split_path(p);
                if h != head {
                    break;
                }
                i += 1;
            }
            // Strip the leading component for the recursive call
            let sub_flat: Vec<(&BStr, gix::ObjectId, EntryMode)> = flat[subtree_start..i]
                .iter()
                .map(|(p, oid, m)| {
                    let (_, rest) = split_path(p);
                    (rest.unwrap(), *oid, *m)
                })
                .collect();

            let sub_id = write_tree_recursive(repo, &sub_flat)?;
            tree.entries.push(Entry {
                mode: EntryKind::Tree.into(),
                filename: head.into(),
                oid: sub_id,
            });
        } else {
            // Plain file / symlink / submodule entry
            tree.entries.push(Entry {
                mode,
                filename: head.into(),
                oid: id,
            });
            i += 1;
        }
    }

    // gix requires entries sorted by filename
    tree.entries.sort();

    let oid = repo
        .write_object(&tree)
        .map_err(|e| format!("Failed to write tree object: {e}"))?
        .detach();
    Ok(oid)
}

/// Build a tree from the current index and return its `ObjectId`.
fn index_to_tree(repo: &gix::Repository) -> Result<gix::ObjectId, String> {
    let worktree_index = repo
        .index()
        .map_err(|e| format!("Failed to load index: {e}"))?;

    // Fast path: use the cached tree root from the TREE extension when present
    if let Some(cached) = worktree_index.tree()
        && cached.num_entries.is_some()
    {
        return Ok(cached.id);
    }

    // Slow path: reconstruct the tree hierarchy from index entries
    let backing = worktree_index.path_backing();
    let flat: Vec<(&BStr, gix::ObjectId, EntryMode)> = worktree_index
        .entries()
        .iter()
        .filter(|e| e.stage() == gix::index::entry::Stage::Unconflicted)
        .filter_map(|e| {
            let path = e.path_in(backing);
            let mode = e.mode.to_tree_entry_mode()?;
            Some((path, e.id, mode))
        })
        .collect();

    write_tree_recursive(repo, &flat)
}

// ---------------------------------------------------------------------------
// Public commands
// ---------------------------------------------------------------------------

pub fn git_commit(cwd: String, message: String) -> Result<String, String> {
    let repo = open_repo(&cwd)?;

    let tree_id = index_to_tree(&repo)?;

    // Resolve the parent commit (None on an unborn branch)
    let parent_ids: Vec<gix::ObjectId> = repo
        .head_id()
        .ok()
        .map(|id| vec![id.detach()])
        .unwrap_or_default();

    // repo.commit() reads author / committer from git config automatically
    let new_commit_id = repo
        .commit("HEAD", &message, tree_id, parent_ids)
        .map_err(|e| format!("Failed to create commit: {e}"))?;

    Ok(new_commit_id.to_string())
}

pub fn git_push(
    cwd: String,
    remote: Option<String>,
    branch: Option<String>,
) -> Result<String, String> {
    let repo = open_repo(&cwd)?;

    // Resolve the remote name from config when not provided
    let remote_name = remote.unwrap_or_else(|| {
        repo.head()
            .ok()
            .and_then(|head| head.try_into_referent())
            .and_then(|r| {
                let full = r.name().as_bstr().to_str_lossy().into_owned();
                let short = full
                    .strip_prefix("refs/heads/")
                    .unwrap_or(&full)
                    .to_string();
                repo.branch_remote_name(
                    short.as_bytes().as_bstr(),
                    gix::remote::Direction::Push,
                )
                .map(|n| n.as_bstr().to_str_lossy().into_owned())
            })
            .unwrap_or_else(|| "origin".to_string())
    });

    // Resolve the branch name from HEAD when not provided
    let branch_name = branch.unwrap_or_else(|| {
        repo.head()
            .ok()
            .and_then(|head| head.try_into_referent())
            .map(|r| {
                let full = r.name().as_bstr().to_str_lossy().into_owned();
                full.strip_prefix("refs/heads/")
                    .unwrap_or(&full)
                    .to_string()
            })
            .unwrap_or_else(|| "HEAD".to_string())
    });

    let mut cmd = std::process::Command::new("git");
    cmd.arg("push")
        .arg(&remote_name)
        .arg(&branch_name)
        .current_dir(&cwd);

    // Suppress console window on Windows
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to run git push: {e}"))?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout).into_owned();
        let stderr = String::from_utf8_lossy(&output.stderr).into_owned();
        Ok(if stdout.is_empty() { stderr } else { stdout })
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).into_owned();
        Err(format!("git push failed: {stderr}"))
    }
}
