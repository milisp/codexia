use axum::{
    Router,
    routing::{get, post},
};
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use tower_http::cors::{Any, CorsLayer};
use tower_http::services::{ServeDir, ServeFile};

use super::{
    handlers::{
        api_account_rate_limits, api_allow_sleep, api_archive_thread, api_canonicalize_path,
        api_cc_list_projects, api_cc_mcp_add, api_cc_mcp_disable, api_cc_mcp_enable,
        api_cc_mcp_get, api_cc_mcp_list, api_cc_mcp_remove,
        api_cc_connect, api_cc_disconnect, api_cc_get_installed_skills, api_cc_get_projects,
        api_cc_delete_session, api_cc_get_session_file_path, api_cc_list_sessions, api_cc_get_settings, api_cc_get_slash_commands,
        api_cc_interrupt,
        api_cc_new_session, api_cc_resolve_permission, api_cc_resume_session,
        api_cc_send_message, api_cc_set_permission_mode, api_cc_update_settings,
        api_create_automation, api_delete_automation, api_list_automation_runs, api_list_automations, api_run_automation_now, api_set_automation_paused,
        api_update_automation,
        api_check_manifests_exist, api_codex_home, api_create_note, api_delete_file,
        api_delete_note, api_download_and_extract_manifests,
        api_get_account, api_get_agent_heatmaps, api_get_home_directory, api_get_insight_filter_options,
        api_get_insight_rankings, api_get_note_by_id, api_get_notes,
        api_get_unsynced_notes,
        api_git_branch_info, api_git_checkout_branch, api_git_create_branch,
        api_git_apply_worktree_changes,
        api_git_remove_worktree,
        api_git_diff_stats, api_git_file_diff, api_git_file_diff_meta, api_git_list_branches,
        api_git_create_worktree, api_git_reverse_files, api_git_stage_files,
        api_git_status, api_git_unstage_files, api_git_commit, api_git_push,
        api_list_archived_threads, api_list_threads, api_load_manifest, api_load_manifests,
        api_mark_notes_synced, api_prevent_sleep,
        api_login_account, api_model_list, api_model_list_post, api_read_directory, api_read_file,
        api_read_dxt_setting,
        api_read_pdf_content, api_read_text_file_lines,
        api_read_xlsx_content, api_respond_command_execution_approval,
        api_respond_file_change_approval, api_respond_user_input, api_resume_thread,
        api_rollback_thread, api_fork_thread,
        api_save_dxt_setting,
        api_search_files, api_search_files_by_name, api_skills_config_write, api_skills_list, api_start_review,
        api_start_thread, api_start_watch_file, api_start_watch_path, api_stop_watch_file,
        api_skill_groups_read, api_skill_groups_write,
        api_skills_clone_repo, api_skills_delete_central, api_skills_install_marketplace,
        api_skills_link_to_agent, api_skills_list_central, api_skills_list_installed,
        api_skills_list_marketplace, api_skills_uninstall_installed,
        api_skillssh_install, api_skillssh_leaderboard, api_skillssh_search,
        api_stop_watch_path, api_terminal_resize, api_terminal_start, api_terminal_stop,
        api_terminal_write, api_toggle_favorite, api_turn_interrupt, api_turn_start,
        api_unified_add_mcp_server, api_unified_disable_mcp_server,
        api_unified_enable_mcp_server, api_unified_read_mcp_config,
        api_unified_remove_mcp_server, api_update_note, api_write_file, health_check,
    },
    types::WebServerState,
    websocket::{sse_handler, ws_handler},
};

fn resolve_dist_dir() -> PathBuf {
    let mut candidates: Vec<PathBuf> = Vec::new();
    let mut seen = HashSet::new();
    let mut add_candidate = |path: PathBuf| {
        if seen.insert(path.clone()) {
            candidates.push(path);
        }
    };

    if let Some(project_root) = Path::new(env!("CARGO_MANIFEST_DIR")).parent() {
        add_candidate(project_root.join("dist"));
    }

    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            add_candidate(exe_dir.join("dist"));
            add_candidate(exe_dir.join("../dist"));
            add_candidate(exe_dir.join("../../dist"));
            add_candidate(exe_dir.join("resources/dist"));
            add_candidate(exe_dir.join("../resources/dist"));
            add_candidate(exe_dir.join("../Resources/dist"));
            add_candidate(exe_dir.join("../../Resources/dist"));
        }
    }

    add_candidate(PathBuf::from("dist"));

    let selected = candidates
        .into_iter()
        .find(|path| path.join("index.html").exists())
        .unwrap_or_else(|| PathBuf::from("dist"));

    selected
}

pub fn create_router(state: WebServerState) -> Router {
    let dist_dir = resolve_dist_dir();
    let static_site = ServeDir::new(dist_dir.clone())
        .not_found_service(ServeFile::new(dist_dir.join("index.html")));

    Router::new()
        .route("/health", get(health_check))
        .route("/ws", get(ws_handler))
        .route("/api/events", get(sse_handler))
        .route("/api/codex/thread/start", post(api_start_thread))
        .route("/api/codex/start-thread", post(api_start_thread))
        .route("/api/codex/thread/resume", post(api_resume_thread))
        .route("/api/codex/thread/fork", post(api_fork_thread))
        .route("/api/codex/thread/rollback", post(api_rollback_thread))
        .route("/api/codex/thread/list", post(api_list_threads))
        .route(
            "/api/codex/thread/list-archived",
            post(api_list_archived_threads),
        )
        .route("/api/codex/thread/archive", post(api_archive_thread))
        .route("/api/codex/turn/start", post(api_turn_start))
        .route("/api/codex/turn/interrupt", post(api_turn_interrupt))
        .route(
            "/api/codex/model/list",
            get(api_model_list).post(api_model_list_post),
        )
        .route(
            "/api/codex/account/rate-limits",
            get(api_account_rate_limits),
        )
        .route("/api/codex/account/get", post(api_get_account))
        .route("/api/codex/account/login", post(api_login_account))
        .route("/api/codex/skills/list", post(api_skills_list))
        .route(
            "/api/codex/skills/config/write",
            post(api_skills_config_write),
        )
        .route(
            "/api/codex/approval/command-execution",
            post(api_respond_command_execution_approval),
        )
        .route(
            "/api/codex/approval/file-change",
            post(api_respond_file_change_approval),
        )
        .route(
            "/api/codex/approval/user-input",
            post(api_respond_user_input),
        )
        .route("/api/codex/review/start", post(api_start_review))
        .route("/api/filesystem/read-directory", post(api_read_directory))
        .route("/api/filesystem/home-directory", get(api_get_home_directory))
        .route("/api/filesystem/canonicalize-path", post(api_canonicalize_path))
        .route("/api/filesystem/search-files", post(api_search_files))
        .route("/api/filesystem/search-files-by-name", post(api_search_files_by_name))
        .route("/api/filesystem/codex-home", get(api_codex_home))
        .route("/api/filesystem/read-file", post(api_read_file))
        .route("/api/filesystem/read-text-file-lines", post(api_read_text_file_lines))
        .route("/api/filesystem/read-pdf", post(api_read_pdf_content))
        .route("/api/filesystem/read-xlsx", post(api_read_xlsx_content))
        .route("/api/filesystem/write-file", post(api_write_file))
        .route("/api/filesystem/delete-file", post(api_delete_file))
        .route("/api/filesystem/start-watch", post(api_start_watch_path))
        .route("/api/filesystem/stop-watch", post(api_stop_watch_path))
        .route("/api/filesystem/start-watch-file", post(api_start_watch_file))
        .route("/api/filesystem/stop-watch-file", post(api_stop_watch_file))
        .route("/api/terminal/start", post(api_terminal_start))
        .route("/api/terminal/write", post(api_terminal_write))
        .route("/api/terminal/resize", post(api_terminal_resize))
        .route("/api/terminal/stop", post(api_terminal_stop))
        .route("/api/notes/create", post(api_create_note))
        .route("/api/notes/list", post(api_get_notes))
        .route("/api/notes/get", post(api_get_note_by_id))
        .route("/api/notes/update", post(api_update_note))
        .route("/api/notes/delete", post(api_delete_note))
        .route("/api/notes/toggle-favorite", post(api_toggle_favorite))
        .route("/api/notes/mark-synced", post(api_mark_notes_synced))
        .route("/api/notes/unsynced", post(api_get_unsynced_notes))
        .route("/api/automation/list", post(api_list_automations))
        .route("/api/automation/runs/list", post(api_list_automation_runs))
        .route("/api/automation/create", post(api_create_automation))
        .route("/api/automation/update", post(api_update_automation))
        .route("/api/automation/set-paused", post(api_set_automation_paused))
        .route("/api/automation/delete", post(api_delete_automation))
        .route("/api/automation/run-now", post(api_run_automation_now))
        .route("/api/skills/list-marketplace", post(api_skills_list_marketplace))
        .route("/api/skills/list-installed", post(api_skills_list_installed))
        .route(
            "/api/skills/install-marketplace",
            post(api_skills_install_marketplace),
        )
        .route(
            "/api/skills/uninstall-installed",
            post(api_skills_uninstall_installed),
        )
        .route("/api/skills/clone-repo", post(api_skills_clone_repo))
        .route("/api/skills/list-central", post(api_skills_list_central))
        .route("/api/skills/link-to-agent", post(api_skills_link_to_agent))
        .route("/api/skills/delete-central", post(api_skills_delete_central))
        .route("/api/skillssh/leaderboard", post(api_skillssh_leaderboard))
        .route("/api/skillssh/search", post(api_skillssh_search))
        .route("/api/skillssh/install", post(api_skillssh_install))
        .route("/api/skills/groups/read", post(api_skill_groups_read))
        .route("/api/skills/groups/write", post(api_skill_groups_write))
        .route("/api/codex/mcp/read", post(api_unified_read_mcp_config))
        .route("/api/codex/mcp/add", post(api_unified_add_mcp_server))
        .route("/api/codex/mcp/remove", post(api_unified_remove_mcp_server))
        .route("/api/codex/mcp/enable", post(api_unified_enable_mcp_server))
        .route("/api/codex/mcp/disable", post(api_unified_disable_mcp_server))
        .route("/api/dxt/manifests", get(api_load_manifests))
        .route("/api/dxt/manifest", post(api_load_manifest))
        .route("/api/dxt/manifests/exist", get(api_check_manifests_exist))
        .route("/api/dxt/manifests/download", post(api_download_and_extract_manifests))
        .route("/api/dxt/setting/read", post(api_read_dxt_setting))
        .route("/api/dxt/setting/save", post(api_save_dxt_setting))
        .route(
            "/api/git/create-worktree",
            post(api_git_create_worktree),
        )
        .route(
            "/api/git/remove-worktree",
            post(api_git_remove_worktree),
        )
        .route(
            "/api/git/apply-worktree-changes",
            post(api_git_apply_worktree_changes),
        )
        .route("/api/git/branch-info", post(api_git_branch_info))
        .route("/api/git/list-branches", post(api_git_list_branches))
        .route("/api/git/create-branch", post(api_git_create_branch))
        .route("/api/git/checkout-branch", post(api_git_checkout_branch))
        .route("/api/git/status", post(api_git_status))
        .route("/api/git/file-diff", post(api_git_file_diff))
        .route("/api/git/file-diff-meta", post(api_git_file_diff_meta))
        .route("/api/git/diff-stats", post(api_git_diff_stats))
        .route("/api/git/stage-files", post(api_git_stage_files))
        .route("/api/git/unstage-files", post(api_git_unstage_files))
        .route("/api/git/reverse-files", post(api_git_reverse_files))
        .route("/api/git/commit", post(api_git_commit))
        .route("/api/git/push", post(api_git_push))
        .route("/api/cc/connect", post(api_cc_connect))
        .route("/api/cc/send-message", post(api_cc_send_message))
        .route("/api/cc/disconnect", post(api_cc_disconnect))
        .route("/api/cc/new-session", post(api_cc_new_session))
        .route("/api/cc/interrupt", post(api_cc_interrupt))
        .route("/api/cc/resume-session", post(api_cc_resume_session))
        .route("/api/cc/resolve-permission", post(api_cc_resolve_permission))
        .route("/api/cc/set-permission-mode", post(api_cc_set_permission_mode))
        .route("/api/cc/projects", get(api_cc_get_projects))
        .route("/api/cc/installed-skills", get(api_cc_get_installed_skills))
        .route("/api/cc/slash-commands", get(api_cc_get_slash_commands))
        .route("/api/cc/settings", get(api_cc_get_settings).post(api_cc_update_settings))
        .route("/api/cc/sessions", get(api_cc_list_sessions))
        .route("/api/cc/session-file-path", post(api_cc_get_session_file_path))
        .route("/api/cc/delete-session", post(api_cc_delete_session))
        .route("/api/cc/mcp/list", post(api_cc_mcp_list))
        .route("/api/cc/mcp/get", post(api_cc_mcp_get))
        .route("/api/cc/mcp/add", post(api_cc_mcp_add))
        .route("/api/cc/mcp/remove", post(api_cc_mcp_remove))
        .route("/api/cc/mcp/disable", post(api_cc_mcp_disable))
        .route("/api/cc/mcp/enable", post(api_cc_mcp_enable))
        .route("/api/cc/mcp/projects", get(api_cc_list_projects))
        .route("/api/insights/heatmaps", post(api_get_agent_heatmaps))
        .route("/api/insights/rankings", post(api_get_insight_rankings))
        .route("/api/insights/filter-options", post(api_get_insight_filter_options))
        .route("/api/sleep/prevent", post(api_prevent_sleep))
        .route("/api/sleep/allow", post(api_allow_sleep))
        .fallback_service(static_site)
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any),
        )
        .with_state(state)
}
