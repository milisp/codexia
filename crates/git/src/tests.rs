use super::*;
use std::path::{Path, PathBuf};
use std::sync::{LazyLock, Mutex};

static HOME_ENV_LOCK: LazyLock<Mutex<()>> = LazyLock::new(|| Mutex::new(()));

#[test]
#[ignore = "requires network access"]
fn clone_remote_repo_over_https() {
    let temp = tempfile::tempdir().expect("create tempdir");
    let target = temp.path().join("hello-world");
    let cloned = clone("https://github.com/octocat/Hello-World.git", &target).expect("clone");

    assert_eq!(cloned, target);
    assert!(target.join("README").is_file(), "worktree should be checked out");
    let repo = gix::open(&target).expect("open cloned repo");
    assert!(repo.head_id().is_ok(), "cloned repo should have a HEAD commit");
    assert!(
        repo.find_remote("origin").is_ok(),
        "cloned repo should have an origin remote"
    );
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

    gix::init(repo_dir).expect("init repo");
    // Repo-local identity so commits don't depend on ~/.gitconfig, which
    // `with_temp_home` hides from tests running in parallel.
    let config_path = repo_dir.join(".git").join("config");
    let mut config = std::fs::read_to_string(&config_path).expect("read repo config");
    config.push_str("[user]\n\tname = Codex Test\n\temail = codex@test.local\n");
    std::fs::write(&config_path, config).expect("write repo config");

    let repo = gix::open(repo_dir).expect("open repo");
    let empty_tree = repo.empty_tree().id().detach();
    let signature = gix::actor::SignatureRef {
        name: b"Codex Test".as_bstr(),
        email: b"codex@test.local".as_bstr(),
        time: "0 +0000",
    };
    repo.commit_as(signature, signature, "HEAD", "seed", empty_tree, Vec::<gix::ObjectId>::new())
        .expect("create initial commit");
}

fn with_temp_home<T>(home: &Path, action: impl FnOnce() -> T) -> T {
    let _guard = HOME_ENV_LOCK.lock().expect("lock HOME env");
    let previous_home = std::env::var_os("HOME");
    // Tests serialize HOME mutations behind a process-wide mutex.
    unsafe { std::env::set_var("HOME", home) };
    let result = action();
    if let Some(value) = previous_home {
        unsafe { std::env::set_var("HOME", value) };
    } else {
        unsafe { std::env::remove_var("HOME") };
    }
    result
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

    with_temp_home(temp.path(), || {
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
    });
}

#[test]
fn git_apply_worktree_changes_applies_tracked_and_untracked_files() {
    let temp = tempfile::tempdir().expect("create tempdir");
    let repo_dir = temp.path();
    init_repo_with_one_commit(repo_dir);

    let tracked_file = repo_dir.join("tracked.txt");
    std::fs::write(&tracked_file, "base\n").expect("write tracked file");
    git_stage_files(
        repo_dir.to_string_lossy().to_string(),
        vec!["tracked.txt".to_string()],
    )
    .expect("stage tracked file");
    let _ = git_commit(
        repo_dir.to_string_lossy().to_string(),
        "seed tracked file".to_string(),
    )
    .expect("commit tracked file");

    with_temp_home(temp.path(), || {
        let worktree = git_create_worktree(
            repo_dir.to_string_lossy().to_string(),
            "apply-me".to_string(),
        )
        .expect("create worktree");
        let worktree_path = PathBuf::from(&worktree.worktree_path);

        std::fs::write(worktree_path.join("tracked.txt"), "worktree update\n")
            .expect("update tracked file in worktree");
        std::fs::write(worktree_path.join("new-file.txt"), "fresh\n")
            .expect("write untracked file in worktree");

        let result = git_apply_worktree_changes(
            repo_dir.to_string_lossy().to_string(),
            "apply-me".to_string(),
        )
        .expect("apply worktree changes");

        assert_eq!(result.changed_files, 2);
        assert_eq!(
            std::fs::read_to_string(repo_dir.join("tracked.txt")).expect("read tracked file"),
            "worktree update\n"
        );
        assert_eq!(
            std::fs::read_to_string(repo_dir.join("new-file.txt")).expect("read new file"),
            "fresh\n"
        );
    });
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

fn stage(repo_dir: &Path, paths: &[&str]) {
    git_stage_files(
        repo_dir.to_string_lossy().to_string(),
        paths.iter().map(|path| path.to_string()).collect(),
    )
    .expect("stage files");
}

fn commit(repo_dir: &Path, message: &str) {
    git_commit(repo_dir.to_string_lossy().to_string(), message.to_string()).expect("commit");
}

fn status_codes(repo_dir: &Path) -> std::collections::BTreeMap<String, (char, char)> {
    git_status(repo_dir.to_string_lossy().to_string())
        .expect("status ok")
        .entries
        .into_iter()
        .map(|entry| (entry.path, (entry.index_status, entry.worktree_status)))
        .collect()
}

#[test]
fn git_status_reports_staged_add_modify_delete() {
    let temp = tempfile::tempdir().expect("create tempdir");
    let repo_dir = temp.path();
    init_repo_with_one_commit(repo_dir);

    std::fs::write(repo_dir.join("keep.txt"), "a\n").expect("write keep");
    std::fs::write(repo_dir.join("gone.txt"), "b\n").expect("write gone");
    stage(repo_dir, &["keep.txt", "gone.txt"]);
    commit(repo_dir, "seed files");

    std::fs::write(repo_dir.join("keep.txt"), "a\nb\n").expect("modify keep");
    std::fs::remove_file(repo_dir.join("gone.txt")).expect("remove gone");
    std::fs::write(repo_dir.join("fresh.txt"), "c\n").expect("write fresh");
    stage(repo_dir, &["keep.txt", "gone.txt", "fresh.txt"]);

    let codes = status_codes(repo_dir);
    assert_eq!(codes.get("keep.txt"), Some(&('M', ' ')), "{codes:?}");
    assert_eq!(codes.get("gone.txt"), Some(&('D', ' ')), "{codes:?}");
    assert_eq!(codes.get("fresh.txt"), Some(&('A', ' ')), "{codes:?}");
}

#[test]
fn git_status_reports_staged_and_unstaged_on_same_file() {
    let temp = tempfile::tempdir().expect("create tempdir");
    let repo_dir = temp.path();
    init_repo_with_one_commit(repo_dir);

    std::fs::write(repo_dir.join("demo.txt"), "v1\n").expect("write v1");
    stage(repo_dir, &["demo.txt"]);
    commit(repo_dir, "seed demo");

    std::fs::write(repo_dir.join("demo.txt"), "v2\n").expect("write v2");
    stage(repo_dir, &["demo.txt"]);
    std::fs::write(repo_dir.join("demo.txt"), "v3\n").expect("write v3");

    let codes = status_codes(repo_dir);
    assert_eq!(codes.get("demo.txt"), Some(&('M', 'M')), "{codes:?}");
}

#[test]
fn git_diff_stats_counts_staged_modification_and_deletion_against_head() {
    let temp = tempfile::tempdir().expect("create tempdir");
    let repo_dir = temp.path();
    init_repo_with_one_commit(repo_dir);

    std::fs::write(repo_dir.join("edit.txt"), "one\ntwo\nthree\n").expect("write edit");
    std::fs::write(repo_dir.join("drop.txt"), "x\ny\n").expect("write drop");
    stage(repo_dir, &["edit.txt", "drop.txt"]);
    commit(repo_dir, "seed files");

    // Replace one line and append one: +2 / -1.
    std::fs::write(repo_dir.join("edit.txt"), "one\nTWO\nthree\nfour\n").expect("edit");
    // Deleting a two-line file: +0 / -2.
    std::fs::remove_file(repo_dir.join("drop.txt")).expect("remove drop");
    stage(repo_dir, &["edit.txt", "drop.txt"]);

    let stats = git_diff_stats(repo_dir.to_string_lossy().to_string()).expect("diff stats");
    assert_eq!(stats.staged.additions, 2);
    assert_eq!(stats.staged.deletions, 3);
    assert_eq!(stats.unstaged.additions, 0);
    assert_eq!(stats.unstaged.deletions, 0);
}

#[test]
fn git_diff_stats_ignores_binary_content() {
    let temp = tempfile::tempdir().expect("create tempdir");
    let repo_dir = temp.path();
    init_repo_with_one_commit(repo_dir);

    std::fs::write(repo_dir.join("blob.bin"), b"\0\x01\x02\n").expect("write binary");
    stage(repo_dir, &["blob.bin"]);
    commit(repo_dir, "seed binary");
    std::fs::write(repo_dir.join("blob.bin"), b"\0\x03\x04\nmore\n").expect("edit binary");

    let stats = git_diff_stats(repo_dir.to_string_lossy().to_string()).expect("diff stats");
    assert_eq!(stats.unstaged.additions, 0);
    assert_eq!(stats.unstaged.deletions, 0);
}
