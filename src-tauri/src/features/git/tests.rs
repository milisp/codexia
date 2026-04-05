use super::*;
use std::path::{Path, PathBuf};

fn plugins_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("~"))
        .join(".agents")
        .join("plugins")
}

#[test]
#[ignore = "requires network access and writes into ~/.agents/plugins"]
fn clone_skills_repo_to_agents_plugins() {
    let target = plugins_dir();
    let result = clone("https://github.com/anthropics/skills.git", &target);
    assert!(result.is_ok(), "clone failed: {result:?}");
}

#[test]
fn git_status_reports_whole_repo_from_subdirectory_cwd() {
    let temp = tempfile::tempdir().expect("create tempdir");
    let repo_dir = temp.path();
    let subdir = repo_dir.join("subdir");
    std::fs::create_dir_all(&subdir).expect("create subdir");
    std::fs::write(repo_dir.join("root.txt"), "root").expect("write root file");
    std::fs::write(subdir.join("nested.txt"), "nested").expect("write nested file");

    gix::init(repo_dir).expect("init repo");
    let status = git_status(subdir.to_string_lossy().to_string()).expect("status ok");

    let paths: std::collections::BTreeSet<_> =
        status.entries.into_iter().map(|entry| entry.path).collect();
    assert!(
        paths.contains("root.txt"),
        "root file should be visible when cwd is subdir"
    );
    assert!(
        paths.contains("subdir/nested.txt"),
        "nested file should be visible when cwd is subdir"
    );
}

fn init_repo_with_one_commit(repo_dir: &Path) {
    use gix::bstr::ByteSlice;

    let repo = gix::init(repo_dir).expect("init repo");
    let empty_tree = repo.empty_tree().id().detach();
    let signature = gix::actor::SignatureRef {
        name: b"Codex Test".as_bstr(),
        email: b"codex@test.local".as_bstr(),
        time: "0 +0000",
    };
    repo.commit_as(signature, signature, "HEAD", "seed", empty_tree, Vec::<gix::ObjectId>::new())
        .expect("create initial commit");
}

#[test]
fn git_diff_stats_reports_staged_and_unstaged_counts() {
    let temp = tempfile::tempdir().expect("create tempdir");
    let repo_dir = temp.path();
    gix::init(repo_dir).expect("init repo");

    let file_path = repo_dir.join("demo.txt");
    std::fs::write(&file_path, "one\ntwo\n").expect("write initial file");

    git_stage_files(
        repo_dir.to_string_lossy().to_string(),
        vec!["demo.txt".to_string()],
    )
    .expect("stage initial file");

    std::fs::write(&file_path, "zero\none\nthree\n").expect("write unstaged update");

    let stats = git_diff_stats(repo_dir.to_string_lossy().to_string()).expect("compute diff stats");

    assert_eq!(stats.staged.additions, 2);
    assert_eq!(stats.staged.deletions, 0);
    assert_eq!(stats.unstaged.additions, 2);
    assert_eq!(stats.unstaged.deletions, 1);
}

#[test]
fn git_create_worktree_creates_and_reuses_worktree_path() {
    let temp = tempfile::tempdir().expect("create tempdir");
    let repo_dir = temp.path();
    init_repo_with_one_commit(repo_dir);

    let first = git_create_worktree(
        repo_dir.to_string_lossy().to_string(),
        "thread-42".to_string(),
    )
    .expect("create worktree");
    assert!(!first.existed, "first call should create worktree");

    let worktree = PathBuf::from(&first.worktree_path);
    assert!(worktree.exists(), "worktree path should exist");
    assert!(
        gix::discover(&worktree).is_ok(),
        "worktree path should be a git repository"
    );

    let second = git_create_worktree(
        repo_dir.to_string_lossy().to_string(),
        "thread-42".to_string(),
    )
    .expect("reuse existing worktree");
    assert!(second.existed, "second call should detect existing worktree");
    assert_eq!(first.worktree_path, second.worktree_path);

    let source_repo = gix::discover(repo_dir).expect("open source repo");
    let source_head = source_repo.head_id().expect("source head").detach();
    let worktree_repo = gix::discover(&worktree).expect("open worktree repo");
    let worktree_head = worktree_repo.head_id().expect("worktree head").detach();
    assert_eq!(source_head, worktree_head, "worktree should point to same HEAD");

    // Clean up: the worktree is stored in ~/.codexia/worktrees/{repo}-{hash}/
    // Remove only the per-repo directory to avoid touching other test data.
    if let Some(per_repo_dir) = worktree.parent() {
        let _ = std::fs::remove_dir_all(per_repo_dir);
    }
}

#[test]
fn git_reverse_unstaged_restores_file_from_index() {
    let temp = tempfile::tempdir().expect("create tempdir");
    let repo_dir = temp.path();
    gix::init(repo_dir).expect("init repo");

    let file_path = repo_dir.join("demo.txt");
    std::fs::write(&file_path, "v1\n").expect("write initial");
    git_stage_files(
        repo_dir.to_string_lossy().to_string(),
        vec!["demo.txt".to_string()],
    )
    .expect("stage file");

    std::fs::write(&file_path, "v2\n").expect("write unstaged change");

    git_reverse_files(
        repo_dir.to_string_lossy().to_string(),
        vec!["demo.txt".to_string()],
        false,
    )
    .expect("reverse unstaged");

    let content = std::fs::read_to_string(&file_path).expect("read restored file");
    assert_eq!(content, "v1\n");
}

#[test]
fn git_reverse_unstaged_removes_untracked_file() {
    let temp = tempfile::tempdir().expect("create tempdir");
    let repo_dir = temp.path();
    gix::init(repo_dir).expect("init repo");

    let file_path = repo_dir.join("scratch.txt");
    std::fs::write(&file_path, "temp").expect("write untracked file");
    assert!(file_path.exists(), "untracked file should exist");

    git_reverse_files(
        repo_dir.to_string_lossy().to_string(),
        vec!["scratch.txt".to_string()],
        false,
    )
    .expect("reverse untracked");

    assert!(!file_path.exists(), "untracked file should be removed");
}

#[test]
fn git_reverse_staged_moves_file_back_to_untracked() {
    let temp = tempfile::tempdir().expect("create tempdir");
    let repo_dir = temp.path();
    gix::init(repo_dir).expect("init repo");

    let file_path = repo_dir.join("new.txt");
    std::fs::write(&file_path, "hello\n").expect("write file");
    git_stage_files(
        repo_dir.to_string_lossy().to_string(),
        vec!["new.txt".to_string()],
    )
    .expect("stage file");

    git_reverse_files(
        repo_dir.to_string_lossy().to_string(),
        vec!["new.txt".to_string()],
        true,
    )
    .expect("reverse staged");

    let status = git_status(repo_dir.to_string_lossy().to_string()).expect("status ok");
    let entry = status
        .entries
        .into_iter()
        .find(|item| item.path == "new.txt")
        .expect("status entry exists");
    assert_eq!(entry.index_status, '?');
    assert_eq!(entry.worktree_status, '?');
}
