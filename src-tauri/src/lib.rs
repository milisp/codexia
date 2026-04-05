// Core modules — requires the "core" feature (shared by "desktop" and "web")
#[cfg(feature = "core")]
mod cc;
#[cfg(feature = "core")]
mod codex;
#[cfg(feature = "core")]
mod db;
#[cfg(feature = "core")]
mod features;
#[cfg(all(feature = "core", feature = "tauri"))]
mod state;
#[cfg(all(feature = "core", feature = "tauri"))]
mod commands;
#[cfg(all(feature = "core", feature = "tauri"))]
mod tray;
#[cfg(feature = "tauri")]
pub mod p2p;
// web_server compiles for the standalone web binary AND the desktop Tauri app
// (the latter uses it for in-process P2P routing without opening a port).
#[cfg(any(feature = "web", all(feature = "core", feature = "tauri")))]
mod web_server;
#[cfg(feature = "web")]
pub mod web;
#[cfg(all(feature = "core", feature = "tauri", any(windows, target_os = "linux")))]
mod window;

#[cfg(feature = "tauri")]
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Mobile: thin WebView client that connects to the desktop via Quinn P2P tunnel.
    #[cfg(not(desktop))]
    {
        // rustls 0.23+ has no built-in default crypto provider; install ring explicitly.
        // Without this, Tauri's internal tauri:// URL scheme handler (which uses reqwest+rustls)
        // panics on the first asset request, causing an immediate app crash on iOS.
        let _ = rustls::crypto::ring::default_provider().install_default();

        std::panic::set_hook(Box::new(|info| {
            eprintln!("[iOS PANIC] {info}");
        }));
    }

    #[cfg(not(feature = "desktop"))]
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            crate::p2p::p2p_stun,
            crate::p2p::p2p_connect,
            crate::p2p::p2p_disconnect,
            crate::p2p::p2p_set_stun_servers,
        ]);

    // Desktop: full app with all plugins, commands, and setup.
    #[cfg(feature = "desktop")]
    let builder = {
        use crate::cc::CCState;
        use crate::commands::terminal::TerminalState;
        use crate::features::sleep::SleepState;
        use crate::state::WatchState;
        use std::sync::Arc;
        use std::time::Instant;
        use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
        use tauri::{Emitter, Manager};

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
                let about = MenuItem::with_id(app, "app-about", "About Codexia", true, None::<&str>)?;
                let separator = PredefinedMenuItem::separator(app)?;
                let quit = MenuItem::with_id(app, "app-quit", "Quit Codexia", true, Some("CmdOrControl+Q"))?;
                let app_submenu = Submenu::with_items(app, "Codexia", true, &[&about, &separator, &quit])?;

                let edit_submenu = Submenu::with_items(app, "Edit", true, &[
                    &PredefinedMenuItem::undo(app, None)?,
                    &PredefinedMenuItem::redo(app, None)?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::cut(app, None)?,
                    &PredefinedMenuItem::copy(app, None)?,
                    &PredefinedMenuItem::paste(app, None)?,
                    &PredefinedMenuItem::select_all(app, None)?,
                ])?;

                let show = MenuItem::with_id(app, "app-show", "Show Main Window", true, None::<&str>)?;
                let window_submenu = Submenu::with_items(app, "Window", true, &[&show])?;

                Menu::with_items(app, &[&app_submenu, &edit_submenu, &window_submenu])
            })
            .on_menu_event(|app, event| match event.id().as_ref() {
                "app-quit" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                    let _ = app.emit("quit-requested", ());
                }
                "app-show" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
                "app-about" => {
                    if let Some(window) = app.get_webview_window("about") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    } else if let Err(e) = tauri::WebviewWindowBuilder::new(
                        app,
                        "about",
                        tauri::WebviewUrl::App("/about".into()),
                    )
                    .title("About Codexia")
                    .inner_size(360.0, 320.0)
                    .resizable(false)
                    .decorations(true)
                    .focused(true)
                    .build()
                    {
                        eprintln!("Failed to open about window: {e}");
                    }
                }
                _ => {}
            });

        builder
            .manage(WatchState::new())
            .manage(TerminalState::default())
            .manage(SleepState::default())
            .invoke_handler(tauri::generate_handler![
                crate::codex::start_thread,
                crate::codex::resume_thread,
                crate::codex::fork_thread,
                crate::codex::rollback_thread,
                crate::codex::list_threads,
                crate::codex::list_archived_threads,
                crate::codex::archive_thread,
                crate::codex::turn_start,
                crate::codex::turn_interrupt,
                crate::codex::model_list,
                crate::codex::account_rate_limits,
                crate::codex::get_account,
                crate::codex::login_account,
                crate::codex::skills_list,
                crate::codex::skills_config_write,
                crate::codex::start_review,
                crate::codex::respond_to_command_execution_approval,
                crate::codex::respond_to_file_change_approval,
                crate::codex::respond_to_request_user_input,
                crate::codex::initialize_codex_async,
                crate::commands::filesystem::read_directory,
                crate::commands::filesystem::get_home_directory,
                crate::commands::filesystem::search_files,
                crate::commands::filesystem::search_files_by_name,
                crate::commands::filesystem::canonicalize_path,
                crate::commands::filesystem::read_file,
                crate::commands::filesystem::read_text_file_lines,
                crate::commands::filesystem::write_file,
                crate::commands::filesystem::delete_file,
                crate::commands::filesystem::read_pdf_content,
                crate::commands::filesystem::read_xlsx_content,
                crate::commands::filesystem::start_watch_directory,
                crate::commands::filesystem::stop_watch_directory,
                crate::commands::filesystem::start_watch_file,
                crate::commands::filesystem::stop_watch_file,
                crate::commands::sleep::prevent_sleep,
                crate::commands::sleep::allow_sleep,
                crate::cc::cc_connect,
                crate::cc::cc_new_session,
                crate::cc::cc_send_message,
                crate::cc::cc_disconnect,
                crate::cc::cc_interrupt,
                crate::cc::cc_list_sessions,
                crate::cc::cc_resume_session,
                crate::cc::cc_get_projects,
                crate::cc::cc_get_sessions,
                crate::cc::cc_delete_session,
                crate::cc::cc_get_session_file_path,
                crate::cc::cc_get_installed_skills,
                crate::cc::cc_get_slash_commands,
                crate::cc::cc_get_settings,
                crate::cc::cc_update_settings,
                crate::cc::cc_resolve_permission,
                crate::cc::cc_set_permission_mode,
                crate::cc::cc_mcp_list,
                crate::cc::cc_mcp_get,
                crate::cc::cc_mcp_add,
                crate::cc::cc_mcp_remove,
                crate::cc::cc_list_projects,
                crate::cc::cc_mcp_disable,
                crate::cc::cc_mcp_enable,
                crate::commands::mcp::unified_add_mcp_server,
                crate::commands::mcp::unified_remove_mcp_server,
                crate::commands::mcp::unified_enable_mcp_server,
                crate::commands::mcp::unified_disable_mcp_server,
                crate::commands::mcp::unified_read_mcp_config,
                crate::commands::skillssh::fetch_market_leaderboard,
                crate::commands::skillssh::search_market_skills,
                crate::commands::skillssh::install_from_market,
                crate::commands::skills::clone_skills_repo,
                crate::commands::skills::list_marketplace_skills,
                crate::commands::skills::list_installed_skills,
                crate::commands::skills::list_central_skills,
                crate::commands::skills::install_marketplace_skill,
                crate::commands::skills::uninstall_installed_skill,
                crate::commands::skills::link_skill_to_agent,
                crate::commands::skills::delete_central_skill,
                crate::commands::skills::read_skill_groups,
                crate::commands::skills::write_skill_groups,
                crate::commands::notes::create_note,
                crate::commands::notes::get_notes,
                crate::commands::notes::get_note_by_id,
                crate::commands::notes::update_note,
                crate::commands::notes::delete_note,
                crate::commands::notes::toggle_favorite,
                crate::commands::notes::mark_notes_synced,
                crate::commands::notes::get_unsynced_notes,
                crate::commands::automation::list_automations,
                crate::commands::automation::list_automation_runs,
                crate::commands::automation::create_automation,
                crate::commands::automation::update_automation,
                crate::commands::automation::set_automation_paused,
                crate::commands::automation::delete_automation,
                crate::commands::automation::run_automation_now,
                crate::tray::resize_tray_window,
                crate::tray::show_main_window,
                crate::commands::git::git_branch_info,
                crate::commands::git::git_list_branches,
                crate::commands::git::git_create_branch,
                crate::commands::git::git_checkout_branch,
                crate::commands::git::git_status,
                crate::commands::git::git_file_diff,
                crate::commands::git::git_file_diff_meta,
                crate::commands::git::git_diff_stats,
                crate::commands::git::git_stage_files,
                crate::commands::git::git_unstage_files,
                crate::commands::git::git_reverse_files,
                crate::commands::git::git_create_worktree,
                crate::commands::git::git_remove_worktree,
                crate::commands::git::git_commit,
                crate::commands::git::git_push,
                crate::commands::terminal::terminal_start,
                crate::commands::terminal::terminal_write,
                crate::commands::terminal::terminal_resize,
                crate::commands::terminal::terminal_stop,
                crate::codex::codex_home,
                crate::commands::insights::get_agent_heatmaps,
                crate::commands::insights::get_insight_filter_options,
                crate::commands::insights::get_insight_rankings,
                crate::commands::dxt::load_manifests,
                crate::commands::dxt::load_manifest,
                crate::commands::dxt::read_dxt_setting,
                crate::commands::dxt::save_dxt_setting,
                crate::commands::dxt::download_and_extract_manifests,
                crate::commands::dxt::check_manifests_exist,
                crate::p2p::p2p_start,
                crate::p2p::p2p_stop,
                crate::p2p::p2p_status_cmd,
                crate::p2p::p2p_stun,
                crate::p2p::p2p_connect,
                crate::p2p::p2p_disconnect,
                crate::p2p::p2p_set_stun_servers,
                quit_app,
            ])
            .setup(|app| {
                let app_handle = app.handle().clone();
                let event_sink: Arc<dyn crate::features::event_sink::EventSink> =
                    Arc::new(crate::features::event_sink::TauriEventSink::new(app_handle));

                app.manage(CCState::new(Arc::clone(&event_sink)));

                let codex_init_started_at = Instant::now();
                let init_result = tauri::async_runtime::block_on(async {
                    let connect_started_at = Instant::now();
                    let codex_client = crate::codex::connect_codex(Arc::clone(&event_sink)).await?;
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
                        app.handle().manage(crate::codex::AppState { codex: codex_client });
                        app.handle().manage(crate::codex::CodexInitializationState::new(
                            Arc::clone(&event_sink),
                        ));
                    }
                    Err(err) => {
                        log::warn!(
                            "codex app-server init failed after {:?}, app will continue without codex backend: {}",
                            codex_init_started_at.elapsed(),
                            err,
                        );
                    }
                }

                crate::codex::scan::start_history_scanner(event_sink.clone());
                crate::cc::scan::start_session_scanner(event_sink);

                tauri::async_runtime::spawn(async {
                    tokio::task::spawn_blocking(crate::features::git::scan_all_orphan_worktrees)
                        .await
                        .ok();
                });

                crate::tray::create_tray(app.handle())?;

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
        .run(|app, event| {
            // macOS: clicking the Dock icon when the main window is hidden should show it.
            #[cfg(target_os = "macos")]
            {
            use tauri::Manager;
            if let tauri::RunEvent::Reopen { has_visible_windows, .. } = &event {
                if !has_visible_windows {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            }
            }
        });
}

#[cfg(all(feature = "tauri", feature = "core"))]
#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}
