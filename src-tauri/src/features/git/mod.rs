mod actions;
mod branch;
mod diff;
mod helpers;
mod staging;
mod stats;
mod status;
mod types;
mod worktree;

#[cfg(test)]
mod tests;

pub use self::actions::{git_commit, git_push};
pub use self::branch::{git_branch_info, git_checkout_branch, git_create_branch, git_list_branches};
pub use self::diff::{git_diff_stats, git_file_diff, git_file_diff_meta};
pub use self::staging::{git_reverse_files, git_stage_files, git_unstage_files};
pub use self::status::git_status;
pub use self::types::{
    GitBranchInfoResponse, GitBranchListResponse, GitDiffStatsResponse, GitFileDiffMetaResponse,
    GitApplyWorktreeResponse, GitCreateWorktreeResponse, GitFileDiffResponse, GitStatusResponse,
    GitHasWorktreeChangesResponse,
};
pub use self::worktree::{
    clone, git_apply_worktree_changes, git_create_worktree, git_remove_worktree,
    git_has_worktree_changes, scan_all_orphan_worktrees,
};
