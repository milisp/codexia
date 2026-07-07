// Core modules
mod commands;
mod event_sink;
#[cfg(all(any(windows, target_os = "linux")))]
mod window;
#[cfg(all(target_os = "macos"))]
mod menu;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Desktop: full app with all plugins, commands, and setup.
    let builder = {
        use cc::CCState;
        use codexia_shared::terminal::TerminalState;
        use codexia_shared::sleep::SleepState;
        use codexia_shared::state::WatchState;
        use codexia_codex as codex;
        use codexia_cc as cc;
        use std::sync::Arc;
        use std::time::Instant;
        use tauri::Manager;

        let builder = tauri::Builder::default()
            .plugin(tauri_plugin_os::init())
            .plugin(tauri_plugin_deep_link::init())
            .plugin(
                tauri_plugin_log::Builder::new()
                    .level(log::LevelFilter::Info)
                    .build(),
            )
            .plugin(tauri_plugin_fs::init())
            .plugin(tauri_plugin_opener::init())
            .plugin(tauri_plugin_process::init())
            .plugin(tauri_plugin_shell::init())
            .plugin(tauri_plugin_dialog::init())
            .plugin(tauri_plugin_screenshots::init())
            .plugin(tauri_plugin_updater::Builder::new().build());

        #[cfg(any(windows, target_os = "linux"))]
        let builder = builder.plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            crate::window::show_window(app, argv);
        }));

        #[cfg(target_os = "macos")]
        let builder = builder
            .menu(|app| {
                crate::menu::build_menu(app)
            })
            .on_menu_event(|app, event| {
                crate::menu::on_menu_event(app, &event)
            });

        builder
            .manage(WatchState::new())
            .manage(TerminalState::default())
            .manage(SleepState::default())
            .invoke_handler(tauri::generate_handler![
                commands::codex::list_other_models,
                commands::codex::load_env_keys,
                commands::codex::start_thread,
                commands::codex::resume_thread,
                commands::codex::fork_thread,
                commands::codex::rollback_thread,
                commands::codex::list_threads,
                commands::codex::archive_thread,
                commands::codex::unarchive_thread,
                commands::codex::delete_thread,
                commands::codex::rename_thread,
                commands::codex::turn_start,
                commands::codex::turn_steer,
                commands::codex::turn_interrupt,
                commands::codex::model_list,
                commands::codex::account_rate_limits,
                commands::codex::get_account,
                commands::codex::login_account,
                commands::codex::skills_list,
                commands::codex::skills_config_write,
                commands::codex::start_review,
                commands::codex::thread_goal_set,
                commands::codex::thread_goal_get,
                commands::codex::thread_goal_clear,
                commands::codex::respond_to_command_execution_approval,
                commands::codex::respond_to_file_change_approval,
                commands::codex::respond_to_request_user_input,
                commands::codex::initialize_codex_async,
                commands::fs::read_directory,
                commands::fs::get_home_directory,
                commands::fs::search_files,
                commands::fs::search_files_by_name,
                commands::fs::canonicalize_path,
                commands::fs::read_file,
                commands::fs::read_text_file_lines,
                commands::fs::write_file,
                commands::fs::delete_file,
                commands::fs::read_pdf_content,
                commands::fs::read_xlsx_content,
                commands::fs::watch_directory,
                commands::fs::unwatch_directory,
                commands::sleep::prevent_sleep,
                commands::sleep::allow_sleep,
                commands::cc::cc_connect,
                commands::cc::cc_new_session,
                commands::cc::cc_send_message,
                commands::cc::cc_disconnect,
                commands::cc::cc_interrupt,
                commands::cc::cc_resume_session,
                commands::cc::cc_list_sessions,
                commands::cc::cc_delete_session,
                commands::cc::cc_get_session_messages,
                commands::cc::cc_get_installed_skills,
                commands::cc::cc_get_slash_commands,
                commands::cc::cc_get_settings,
                commands::cc::cc_update_settings,
                commands::cc::cc_resolve_permission,
                commands::cc::cc_set_permission_mode,
                commands::cc::cc_mcp_list,
                commands::cc::cc_mcp_get,
                commands::cc::cc_mcp_add,
                commands::cc::cc_mcp_remove,
                commands::cc::cc_list_projects,
                commands::cc::cc_mcp_disable,
                commands::cc::cc_mcp_enable,
                commands::mcp::unified_add_mcp_server,
                commands::mcp::unified_remove_mcp_server,
                commands::mcp::unified_enable_mcp_server,
                commands::mcp::unified_disable_mcp_server,
                commands::mcp::unified_read_mcp_config,
                commands::skillssh::fetch_market_leaderboard,
                commands::skillssh::search_market_skills,
                commands::skillssh::install_from_market,
                commands::skills::clone_skills_repo,
                commands::skills::list_marketplace_skills,
                commands::skills::list_installed_skills,
                commands::skills::list_central_skills,
                commands::skills::install_marketplace_skill,
                commands::skills::uninstall_installed_skill,
                commands::skills::link_skill_to_agent,
                commands::skills::delete_central_skill,
                commands::skills::read_skill_groups,
                commands::skills::write_skill_groups,
                commands::notes::create_note,
                commands::notes::get_notes,
                commands::notes::get_note_by_id,
                commands::notes::update_note,
                commands::notes::delete_note,
                commands::notes::toggle_favorite,
                commands::notes::mark_notes_synced,
                commands::notes::get_unsynced_notes,
                commands::automation::list_automations,
                commands::automation::list_automation_runs,
                commands::automation::create_automation,
                commands::automation::update_automation,
                commands::automation::set_automation_paused,
                commands::automation::delete_automation,
                commands::automation::run_automation_now,
                commands::git::git_branch_info,
                commands::git::git_list_branches,
                commands::git::git_create_branch,
                commands::git::git_checkout_branch,
                commands::git::git_status,
                commands::git::git_file_diff,
                commands::git::git_file_diff_meta,
                commands::git::git_diff_stats,
                commands::git::git_stage_files,
                commands::git::git_unstage_files,
                commands::git::git_reverse_files,
                commands::git::git_create_worktree,
                commands::git::git_remove_worktree,
                commands::git::git_apply_worktree_changes,
                commands::git::git_has_worktree_changes,
                commands::git::git_commit,
                commands::git::git_push,
                commands::terminal::terminal_start,
                commands::terminal::terminal_write,
                commands::terminal::terminal_resize,
                commands::terminal::terminal_stop,
                commands::insights::get_agent_heatmaps,
                commands::insights::get_insight_filter_options,
                commands::insights::get_insight_rankings,
                commands::dxt::load_manifests,
                commands::dxt::load_manifest,
                commands::dxt::read_dxt_setting,
                commands::dxt::save_dxt_setting,
                commands::dxt::download_and_extract_manifests,
                commands::dxt::check_manifests_exist,
                quit_app,
                commands::codex::codex_home,
                commands::env::get_env,
                commands::env::set_env,
            ])
            .setup(|app| {
                let app_handle = app.handle().clone();
                let event_sink: Arc<dyn codexia_shared::event_sink::EventSink> =
                    Arc::new(event_sink::TauriEventSink::new(app_handle));

                app.manage(CCState::new(Arc::clone(&event_sink)));

                let codex_init_started_at = Instant::now();
                let init_result = tauri::async_runtime::block_on(async {
                    let connect_started_at = Instant::now();
                    let codex_client = codex::connect_codex(Arc::clone(&event_sink)).await?;
                    log::info!(
                        "codex startup timing: connect_codex finished in {:?}",
                        connect_started_at.elapsed()
                    );
                    Ok::<_, String>(codex_client)
                });

                match init_result {
                    Ok(codex_client) => {
                        log::info!(
                            "codex startup timing: total connect during setup took {:?}",
                            codex_init_started_at.elapsed()
                        );
                        let client_clone = codex_client.clone();
                        app.handle().manage(codex::AppState { codex: codex_client });
                        app.handle().manage(codex::CodexInitializationState::new(
                            Arc::clone(&event_sink),
                        ));
                        tauri::async_runtime::spawn(async move {
                        if let Err(e) = codex::config::provider::write_model_providers(&*client_clone).await {
                                log::error!("Failed to write model provider configs: {}", e);
                            }
                        });
                    }
                    Err(err) => {
                        log::warn!(
                            "codex app-server init failed after {:?}, app will continue without codex backend: {}",
                            codex_init_started_at.elapsed(),
                            err,
                        );
                    }
                }

                cc::scan::start_session_scanner();

                tauri::async_runtime::spawn(async {
                    tokio::task::spawn_blocking(codexia_git::scan_all_orphan_worktrees)
                        .await
                        .ok();
                });

                if let Some(main_window) = app.get_webview_window("main") {
                    let app_handle = app.handle().clone();
                    main_window.on_window_event(move |event| {
                        if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                            api.prevent_close();
                            if let Some(w) = app_handle.get_webview_window("main") {
                                let _ = w.hide();
                            }
                        }
                    });
                }

                #[cfg(any(windows, target_os = "linux"))]
                {
                    use tauri_plugin_deep_link::DeepLinkExt;
                    app.deep_link().register_all()?;
                }

                Ok(())
            })
    };

    builder
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app, _event| {
            // macOS: clicking the Dock icon when the main window is hidden should show it.
            #[cfg(target_os = "macos")]
            {
            use tauri::Manager;
            if let tauri::RunEvent::Reopen { has_visible_windows, .. } = &_event {
                if !has_visible_windows {
                    if let Some(window) = _app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            }
            }
        });
}

#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}
