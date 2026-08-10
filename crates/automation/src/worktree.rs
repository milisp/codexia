use std::path::Path;

/// FNV-1a. Hand-rolled because the key must stay byte-identical across Rust
/// versions — a changed hash would orphan the worktree a task has been reusing.
fn stable_hash(value: &str) -> String {
    let mut hash: u64 = 0xcbf2_9ce4_8422_2325;
    for byte in value.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x0000_0100_0000_01b3);
    }
    format!("{hash:016x}")
}

/// One stable worktree per task per project, so repeated runs land in the same
/// place for review instead of piling up a new directory every night.
pub(super) fn worktree_key(task_id: &str, project: &str) -> String {
    let name = Path::new(project)
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("repo");
    format!("{task_id}-{name}-{}", &stable_hash(project)[..8])
}

/// Returns the working directory the agent should run in.
///
/// A clean worktree is rebuilt so the run starts from the project's current HEAD.
/// One holding unreviewed changes is reused as-is: destroying output the user has
/// not looked at yet would be worse than working from a slightly stale tree.
pub(super) async fn prepare_worktree(task_id: &str, project: &str) -> Result<String, String> {
    let key = worktree_key(task_id, project);

    let has_changes = {
        let project = project.to_string();
        let key = key.clone();
        tokio::task::spawn_blocking(move || codexia_git::git_has_worktree_changes(project, key))
            .await
            .map_err(|err| err.to_string())??
            .has_changes
    };

    if has_changes {
        log::warn!(
            "automation '{}' reusing worktree '{}' because it still holds unreviewed changes",
            task_id,
            key
        );
    } else {
        // Rebuild from scratch: `git_create_worktree` leaves an existing worktree
        // alone, so removing it first is what pulls in new commits from the project.
        let project = project.to_string();
        let key = key.clone();
        if let Err(err) =
            tokio::task::spawn_blocking(move || codexia_git::git_remove_worktree(project, key))
                .await
                .map_err(|err| err.to_string())?
        {
            log::warn!(
                "automation '{}' could not reset its worktree, continuing: {}",
                task_id,
                err
            );
        }
    }

    let project = project.to_string();
    let result =
        tokio::task::spawn_blocking(move || codexia_git::git_create_worktree(project, key))
            .await
            .map_err(|err| err.to_string())??;
    Ok(result.worktree_path)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn worktree_key_is_stable_for_the_same_project() {
        let first = worktree_key("automation-1", "/Users/me/code/app");
        let second = worktree_key("automation-1", "/Users/me/code/app");
        assert_eq!(first, second);
        assert!(first.starts_with("automation-1-app-"));
    }

    #[test]
    fn worktree_key_differs_per_project_and_per_task() {
        // Same directory name in different paths must not collide.
        assert_ne!(
            worktree_key("automation-1", "/a/app"),
            worktree_key("automation-1", "/b/app")
        );
        assert_ne!(
            worktree_key("automation-1", "/a/app"),
            worktree_key("automation-2", "/a/app")
        );
    }
}
