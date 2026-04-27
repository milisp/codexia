import { invokeTauri, isDesktopTauri, postJson, postNoContent } from './shared';

export type GitStatusEntry = {
  path: string;
  index_status: string;
  worktree_status: string;
};

export type GitStatusResponse = {
  repo_root: string;
  entries: GitStatusEntry[];
};

export type GitFileDiffResponse = {
  old_content: string;
  new_content: string;
  has_changes: boolean;
};

export type GitFileDiffMetaResponse = {
  old_bytes: number;
  new_bytes: number;
  total_bytes: number;
};

export type GitDiffStatsCounts = {
  additions: number;
  deletions: number;
};

export type GitDiffStatsResponse = {
  staged: GitDiffStatsCounts;
  unstaged: GitDiffStatsCounts;
};

export type GitCreateWorktreeResponse = {
  repo_root: string;
  worktree_path: string;
  existed: boolean;
  copied_env_files: string[];
};

export type GitApplyWorktreeResponse = {
  changed_files: number;
};

export type GitHasWorktreeChangesResponse = {
  has_changes: boolean;
};

export type GitBranchInfoResponse = {
  owner: string;
  repo: string;
  branch: string;
};

export type GitBranchListResponse = {
  current: string;
  branches: string[];
};

export async function gitBranchInfo(cwd: string) {
  if (isDesktopTauri()) {
    return await invokeTauri<GitBranchInfoResponse>('git_branch_info', { cwd });
  }
  return await postJson<GitBranchInfoResponse>('/api/git/branch-info', { cwd });
}

// Returns true iff `cwd` is a git working tree. Used by useGitWatch to gate
// polling — non-git cwds otherwise loop on errors every 2.5s. Single
// gitBranchInfo round-trip; result is not cached because cwd changes are
// rare and the call is cheap.
export async function isGitRepo(cwd: string): Promise<boolean> {
  if (!cwd) return false;
  try {
    await gitBranchInfo(cwd);
    return true;
  } catch {
    return false;
  }
}

export async function gitListBranches(cwd: string) {
  if (isDesktopTauri()) {
    return await invokeTauri<GitBranchListResponse>('git_list_branches', { cwd });
  }
  return await postJson<GitBranchListResponse>('/api/git/list-branches', { cwd });
}

export async function gitCreateBranch(cwd: string, branch: string) {
  if (isDesktopTauri()) {
    return await invokeTauri<void>('git_create_branch', { cwd, branch });
  }
  await postNoContent('/api/git/create-branch', { cwd, branch });
}

export async function gitCheckoutBranch(cwd: string, branch: string) {
  if (isDesktopTauri()) {
    return await invokeTauri<void>('git_checkout_branch', { cwd, branch });
  }
  await postNoContent('/api/git/checkout-branch', { cwd, branch });
}

export async function gitStatus(cwd: string) {
  if (isDesktopTauri()) {
    return await invokeTauri<GitStatusResponse>('git_status', { cwd });
  }
  return await postJson<GitStatusResponse>('/api/git/status', { cwd });
}

export async function gitFileDiff(cwd: string, filePath: string, staged: boolean) {
  if (isDesktopTauri()) {
    return await invokeTauri<GitFileDiffResponse>('git_file_diff', { cwd, filePath, staged });
  }
  return await postJson<GitFileDiffResponse>('/api/git/file-diff', { cwd, filePath, staged });
}

export async function gitFileDiffMeta(cwd: string, filePath: string, staged: boolean) {
  if (isDesktopTauri()) {
    return await invokeTauri<GitFileDiffMetaResponse>('git_file_diff_meta', {
      cwd,
      filePath,
      staged,
    });
  }
  return await postJson<GitFileDiffMetaResponse>('/api/git/file-diff-meta', {
    cwd,
    filePath,
    staged,
  });
}

export async function gitDiffStats(cwd: string) {
  if (isDesktopTauri()) {
    return await invokeTauri<GitDiffStatsResponse>('git_diff_stats', { cwd });
  }
  return await postJson<GitDiffStatsResponse>('/api/git/diff-stats', { cwd });
}

export async function gitStageFiles(cwd: string, filePaths: string[]) {
  if (isDesktopTauri()) {
    return await invokeTauri<void>('git_stage_files', { cwd, filePaths });
  }
  await postNoContent('/api/git/stage-files', { cwd, filePaths });
}

export async function gitUnstageFiles(cwd: string, filePaths: string[]) {
  if (isDesktopTauri()) {
    return await invokeTauri<void>('git_unstage_files', { cwd, filePaths });
  }
  await postNoContent('/api/git/unstage-files', { cwd, filePaths });
}

export async function gitReverseFiles(cwd: string, filePaths: string[], staged: boolean) {
  if (isDesktopTauri()) {
    return await invokeTauri<void>('git_reverse_files', { cwd, filePaths, staged });
  }
  await postNoContent('/api/git/reverse-files', { cwd, filePaths, staged });
}

export async function gitCreateWorktree(cwd: string, worktreeKey: string) {
  if (isDesktopTauri()) {
    return await invokeTauri<GitCreateWorktreeResponse>('git_create_worktree', {
      cwd,
      worktreeKey,
    });
  }
  return await postJson<GitCreateWorktreeResponse>('/api/git/create-worktree', {
    cwd,
    worktreeKey,
  });
}

export async function gitRemoveWorktree(cwd: string, worktreeKey: string): Promise<void> {
  if (isDesktopTauri()) {
    await invokeTauri<void>('git_remove_worktree', { cwd, worktreeKey });
    return;
  }
  await postNoContent('/api/git/remove-worktree', { cwd, worktreeKey });
}

export async function gitApplyWorktreeChanges(cwd: string, worktreeKey: string) {
  if (isDesktopTauri()) {
    return await invokeTauri<GitApplyWorktreeResponse>('git_apply_worktree_changes', {
      cwd,
      worktreeKey,
    });
  }
  return await postJson<GitApplyWorktreeResponse>('/api/git/apply-worktree-changes', {
    cwd,
    worktreeKey,
  });
}

export async function gitHasWorktreeChanges(cwd: string, worktreeKey: string) {
  if (isDesktopTauri()) {
    return await invokeTauri<GitHasWorktreeChangesResponse>('git_has_worktree_changes', {
      cwd,
      worktreeKey,
    });
  }
  return await postJson<GitHasWorktreeChangesResponse>('/api/git/has-worktree-changes', {
    cwd,
    worktreeKey,
  });
}

function resolveCwd(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const lastSlash = normalized.lastIndexOf('/');
  return lastSlash > 0 ? normalized.slice(0, lastSlash) : '.';
}

export async function getGitFileDiff<T = unknown>(filePath: string) {
  const cwd = resolveCwd(filePath);
  if (isDesktopTauri()) {
    const diff = await invokeTauri<GitFileDiffResponse>('git_file_diff', {
      cwd,
      filePath,
      staged: false,
    });
    return {
      original_content: diff.old_content,
      current_content: diff.new_content,
      has_changes: diff.has_changes,
    } as T;
  }
  const diff = await postJson<GitFileDiffResponse>('/api/git/file-diff', {
    cwd,
    filePath,
    staged: false,
  });
  return {
    original_content: diff.old_content,
    current_content: diff.new_content,
    has_changes: diff.has_changes,
  } as T;
}

export async function gitCommit(cwd: string, message: string) {
  if (isDesktopTauri()) {
    return await invokeTauri<string>('git_commit', { cwd, message });
  }
  return await postJson<string>('/api/git/commit', { cwd, message });
}

export async function gitPush(cwd: string, remote?: string, branch?: string) {
  if (isDesktopTauri()) {
    return await invokeTauri<string>('git_push', { cwd, remote, branch });
  }
  return await postJson<string>('/api/git/push', { cwd, remote, branch });
}
