use gix::bstr::{BString, ByteSlice};
use std::collections::BTreeMap;
use std::ops::ControlFlow;

use crate::helpers::{
    open_repo, repo_root, stage_code_from_tree_index_change, stage_entry_path, worktree_code_from_summary,
};
use crate::types::{GitStatusEntry, GitStatusResult};

pub fn git_status(cwd: String) -> Result<GitStatusResult, String> {
    let repo = open_repo(&cwd)?;
    let mut table: BTreeMap<String, (char, char)> = BTreeMap::new();

    let head_tree_id = repo
        .head_tree_id_or_empty()
        .map_err(|err| format!("Failed to resolve HEAD tree id: {err}"))?;
    let index = repo
        .index_or_empty()
        .map_err(|err| format!("Failed to load git index: {err}"))?;
    let mut full_repo_pathspec = repo
        .pathspec(
            false,
            None::<&str>,
            false,
            &gix::index::State::new(repo.object_hash()),
            gix::worktree::stack::state::attributes::Source::IdMapping,
        )
        .map_err(|err| format!("Failed to prepare full-repo pathspec: {err}"))?;
    let rename_tracking = gix::diff::Rewrites {
        limit: 0,
        ..Default::default()
    };

    repo.tree_index_status(
        head_tree_id.as_ref(),
        &index,
        Some(&mut full_repo_pathspec),
        gix::status::tree_index::TrackRenames::Given(rename_tracking),
        |change, _, _| {
            let (path, remove_source_path) = stage_entry_path(&change);
            if let Some(source_path) = remove_source_path {
                table.remove(&source_path);
            }
            let entry = table.entry(path).or_insert((' ', ' '));
            entry.0 = stage_code_from_tree_index_change(&change);
            Ok::<_, std::convert::Infallible>(ControlFlow::Continue(()))
        },
    )
    .map_err(|err| format!("Failed to collect staged status: {err}"))?;

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

    for item in iter {
        let item = item.map_err(|err| format!("Failed to read worktree status item: {err}"))?;
        let Some(summary) = item.summary() else {
            continue;
        };
        let path = item.rela_path().to_str_lossy().into_owned();
        let code = worktree_code_from_summary(summary);
        let entry = table.entry(path).or_insert((' ', ' '));
        if code == '?' {
            entry.0 = '?';
            entry.1 = '?';
        } else {
            entry.1 = code;
        }
    }

    let entries = table
        .into_iter()
        .map(|(path, (index_status, worktree_status))| GitStatusEntry {
            path,
            index_status,
            worktree_status,
        })
        .collect();

    Ok(GitStatusResult {
        repo_root: repo_root(&repo),
        entries,
    })
}
