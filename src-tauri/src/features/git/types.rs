use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct GitStatusEntry {
    pub path: String,
    pub index_status: char,
    pub worktree_status: char,
}

#[derive(Debug, Clone, Serialize)]
pub struct GitStatusResponse {
    pub repo_root: String,
    pub entries: Vec<GitStatusEntry>,
}

#[derive(Debug, Clone, Serialize)]
pub struct GitFileDiffResponse {
    pub old_content: String,
    pub new_content: String,
    pub has_changes: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct GitFileDiffMetaResponse {
    pub old_bytes: usize,
    pub new_bytes: usize,
    pub total_bytes: usize,
}

#[derive(Debug, Clone, Serialize, Default)]
pub struct GitDiffStatsCounts {
    pub additions: usize,
    pub deletions: usize,
}

#[derive(Debug, Clone, Serialize, Default)]
pub struct GitDiffStatsResponse {
    pub staged: GitDiffStatsCounts,
    pub unstaged: GitDiffStatsCounts,
}

#[derive(Debug, Clone, Serialize)]
pub struct GitBranchListResponse {
    pub current: String,
    pub branches: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct GitBranchInfoResponse {
    pub owner: String,
    pub repo: String,
    pub branch: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct GitCreateWorktreeResponse {
    pub repo_root: String,
    pub worktree_path: String,
    pub existed: bool,
    /// Env files copied from the main repo (e.g. ".env", ".env.local")
    pub copied_env_files: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct GitApplyWorktreeResponse {
    pub changed_files: usize,
}
