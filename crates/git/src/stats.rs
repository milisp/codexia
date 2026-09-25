use crate::helpers::{
    add_counts, index_blob_bytes, read_blob_bytes, worktree_bytes,
};
use crate::types::GitDiffStatsCounts;
use gix::bstr::{BString, ByteSlice};
use std::ops::ControlFlow;

fn is_probably_binary(bytes: &[u8]) -> bool {
    bytes.iter().take(8 * 1024).any(|byte| *byte == 0)
}

fn count_line_changes(old: &[u8], new: &[u8]) -> GitDiffStatsCounts {
    if is_probably_binary(old) || is_probably_binary(new) {
        return GitDiffStatsCounts::default();
    }
    let input = gix::diff::blob::InternedInput::new(
        gix::diff::blob::sources::byte_lines(old),
        gix::diff::blob::sources::byte_lines(new),
    );
    let diff = gix::diff::blob::Diff::compute(gix::diff::blob::Algorithm::Myers, &input);
    GitDiffStatsCounts {
        additions: diff.count_additions() as usize,
        deletions: diff.count_removals() as usize,
    }
}

pub(super) fn staged_diff_stats(repo: &gix::Repository) -> Result<GitDiffStatsCounts, String> {
    let head_tree_id = repo
        .head_tree_id_or_empty()
        .map_err(|err| format!("Failed to resolve HEAD tree id: {err}"))?;
    let index = repo
        .index_or_empty()
        .map_err(|err| format!("Failed to load git index: {err}"))?;
    let mut pathspec = repo
        .pathspec(
            false,
            None::<&str>,
            false,
            &gix::index::State::new(repo.object_hash()),
            gix::worktree::stack::state::attributes::Source::IdMapping,
        )
        .map_err(|err| format!("Failed to prepare pathspec: {err}"))?;
    let rewrites = gix::diff::Rewrites {
        limit: 0,
        ..Default::default()
    };

    let mut total = GitDiffStatsCounts::default();
    let mut callback_err: Option<String> = None;
    repo.tree_index_status(
        head_tree_id.as_ref(),
        &index,
        Some(&mut pathspec),
        gix::status::tree_index::TrackRenames::Given(rewrites),
        |change, _, _| {
            let counts_result = match change {
                gix::diff::index::ChangeRef::Addition { id, .. } => {
                    read_blob_bytes(repo, id.as_ref()).map(|new| count_line_changes(&[], &new))
                }
                gix::diff::index::ChangeRef::Deletion { id, .. } => {
                    read_blob_bytes(repo, id.as_ref()).map(|old| count_line_changes(&old, &[]))
                }
                gix::diff::index::ChangeRef::Modification {
                    previous_id, id, ..
                } => {
                    let old = read_blob_bytes(repo, previous_id.as_ref());
                    let new = read_blob_bytes(repo, id.as_ref());
                    match (old, new) {
                        (Ok(old), Ok(new)) => Ok(count_line_changes(&old, &new)),
                        (Err(err), _) | (_, Err(err)) => Err(err),
                    }
                }
                gix::diff::index::ChangeRef::Rewrite { source_id, id, .. } => {
                    let old = read_blob_bytes(repo, source_id.as_ref());
                    let new = read_blob_bytes(repo, id.as_ref());
                    match (old, new) {
                        (Ok(old), Ok(new)) => Ok(count_line_changes(&old, &new)),
                        (Err(err), _) | (_, Err(err)) => Err(err),
                    }
                }
            };
            match counts_result {
                Ok(counts) => add_counts(&mut total, counts),
                Err(err) => {
                    callback_err.get_or_insert(err);
                }
            }
            Ok(ControlFlow::Continue(()))
        },
    )
    .map_err(|err| format!("Failed to collect staged status: {err}"))?;

    if let Some(err) = callback_err {
        return Err(err);
    }

    Ok(total)
}

pub(super) fn unstaged_diff_stats(repo: &gix::Repository) -> Result<GitDiffStatsCounts, String> {
    let index = repo
        .index_or_empty()
        .map_err(|err| format!("Failed to load git index: {err}"))?;
    let iter = repo
        .status(gix::progress::Discard)
        .map_err(|err| format!("Failed to initialize worktree status: {err}"))?
        .untracked_files(gix::status::UntrackedFiles::Files)
        .index_worktree_options_mut(|opts| {
            if let Some(dirwalk_opts) = opts.dirwalk_options.as_mut() {
                dirwalk_opts.set_empty_patterns_match_prefix(false);
            }
        })
        .index_worktree_rewrites(None)
        .into_index_worktree_iter(Vec::<BString>::new())
        .map_err(|err| format!("Failed to collect worktree status: {err}"))?;

    let mut total = GitDiffStatsCounts::default();
    for item in iter {
        let item = item.map_err(|err| format!("Failed to read worktree status item: {err}"))?;
        let Some(summary) = item.summary() else {
            continue;
        };
        if summary == gix::status::index_worktree::iter::Summary::Added {
            continue;
        }

        let path = item.rela_path().to_str_lossy().into_owned();
        let old = index_blob_bytes(repo, &index, &path)?.unwrap_or_default();
        let new = worktree_bytes(repo, &path)?.unwrap_or_default();
        add_counts(&mut total, count_line_changes(&old, &new));
    }

    Ok(total)
}
