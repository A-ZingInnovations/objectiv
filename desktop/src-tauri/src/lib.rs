mod browser_webview;
mod debug;
mod marketplace;
mod lsp;
mod notebook_kernel;
mod openvscode;
mod pty;
mod shell;
mod slack;
mod slack_socket;
mod workspace;
mod workspace_watch;

use std::sync::Arc;

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::webview::{PermissionKind, PermissionResponse};
use tauri::{Emitter, Manager, RunEvent};

fn focus_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn build_app_menu(app: &tauri::App) -> tauri::Result<Menu<tauri::Wry>> {
    let open_file = MenuItem::with_id(
        app,
        "file_open_file",
        "Open File…",
        true,
        Some("CmdOrCtrl+O"),
    )?;
    let open_folder = MenuItem::with_id(
        app,
        "file_open_folder",
        "Open Folder…",
        true,
        Some("CmdOrCtrl+Shift+O"),
    )?;
    let add_folder = MenuItem::with_id(app, "file_add_folder", "Add Folder to Workspace…", true, None::<&str>)?;
    let close_folder = MenuItem::with_id(app, "file_close_folder", "Close Folder", true, None::<&str>)?;
    let sep_save = PredefinedMenuItem::separator(app)?;
    let save = MenuItem::with_id(app, "file_save", "Save", true, Some("CmdOrCtrl+S"))?;
    let save_all =
        MenuItem::with_id(app, "file_save_all", "Save All", true, Some("CmdOrCtrl+Shift+S"))?;
    let toggle_auto_save =
        MenuItem::with_id(app, "file_toggle_auto_save", "Auto Save", true, None::<&str>)?;
    let sep1 = PredefinedMenuItem::separator(app)?;
    let quit = PredefinedMenuItem::quit(app, Some("Quit Objectiv"))?;
    let file = Submenu::with_items(
        app,
        "File",
        true,
        &[
            &open_file,
            &open_folder,
            &add_folder,
            &close_folder,
            &sep_save,
            &save,
            &save_all,
            &toggle_auto_save,
            &sep1,
            &quit,
        ],
    )?;

    let view_palette =
        MenuItem::with_id(app, "view_command_palette", "Command Palette…", true, Some("CmdOrCtrl+Shift+P"))?;
    let view_sep = PredefinedMenuItem::separator(app)?;
    let full_screen =
        MenuItem::with_id(app, "view_fullscreen", "Full Screen", true, Some("Ctrl+CmdOrCtrl+F"))?;
    let app_sep = PredefinedMenuItem::separator(app)?;
    let toggle_sidebar = MenuItem::with_id(
        app,
        "view_toggle_sidebar",
        "Primary Side Bar",
        true,
        Some("CmdOrCtrl+B"),
    )?;
    let toggle_panel =
        MenuItem::with_id(app, "view_toggle_panel", "Panel", true, Some("CmdOrCtrl+J"))?;
    let toggle_activity =
        MenuItem::with_id(app, "view_toggle_activity_bar", "Activity Bar", true, None::<&str>)?;
    let toggle_status =
        MenuItem::with_id(app, "view_toggle_status_bar", "Status Bar", true, None::<&str>)?;
    let toggle_menu =
        MenuItem::with_id(app, "view_toggle_menu_bar", "Menu Bar", true, None::<&str>)?;
    let toggle_centered =
        MenuItem::with_id(app, "view_toggle_centered", "Centered Layout", true, None::<&str>)?;
    let app_sep2 = PredefinedMenuItem::separator(app)?;
    let theme_dark = MenuItem::with_id(app, "view_theme_dark", "Dark+", true, None::<&str>)?;
    let theme_light = MenuItem::with_id(app, "view_theme_light", "Light+", true, None::<&str>)?;
    let theme_menu = Submenu::with_items(app, "Color Theme", true, &[&theme_dark, &theme_light])?;
    let app_sep3 = PredefinedMenuItem::separator(app)?;
    let zoom_in = MenuItem::with_id(app, "view_zoom_in", "Zoom In", true, Some("CmdOrCtrl+="))?;
    let zoom_out = MenuItem::with_id(app, "view_zoom_out", "Zoom Out", true, Some("CmdOrCtrl+-"))?;
    let zoom_reset =
        MenuItem::with_id(app, "view_zoom_reset", "Reset Zoom", true, Some("CmdOrCtrl+0"))?;
    let appearance = Submenu::with_items(
        app,
        "Appearance",
        true,
        &[
            &full_screen,
            &app_sep,
            &toggle_sidebar,
            &toggle_panel,
            &toggle_activity,
            &toggle_status,
            &toggle_menu,
            &toggle_centered,
            &app_sep2,
            &theme_menu,
            &app_sep3,
            &zoom_in,
            &zoom_out,
            &zoom_reset,
        ],
    )?;
    let view_sep2 = PredefinedMenuItem::separator(app)?;
    let view_explorer = MenuItem::with_id(app, "view_explorer", "Explorer", true, None::<&str>)?;
    let view_search = MenuItem::with_id(app, "view_search", "Search", true, None::<&str>)?;
    let view_scm = MenuItem::with_id(app, "view_scm", "Source Control", true, None::<&str>)?;
    let view_problems =
        MenuItem::with_id(app, "view_problems", "Problems", true, Some("CmdOrCtrl+Shift+M"))?;
    let view_run = MenuItem::with_id(app, "view_run", "Run and Debug", true, None::<&str>)?;
    let view_extensions = MenuItem::with_id(app, "view_extensions", "Extensions", true, None::<&str>)?;
    let view_chat = MenuItem::with_id(app, "view_chat", "Objective Agent", true, None::<&str>)?;
    let view_terminal = MenuItem::with_id(app, "view_terminal", "Terminal", true, None::<&str>)?;
    let view_settings = MenuItem::with_id(app, "view_settings", "Settings", true, None::<&str>)?;
    let view = Submenu::with_items(
        app,
        "View",
        true,
        &[
            &view_palette,
            &view_sep,
            &appearance,
            &view_sep2,
            &view_explorer,
            &view_search,
            &view_scm,
            &view_problems,
            &view_run,
            &view_extensions,
            &view_chat,
            &view_terminal,
            &view_settings,
        ],
    )?;

    let account_settings =
        MenuItem::with_id(app, "account_settings", "Open Settings…", true, None::<&str>)?;
    let account = Submenu::with_items(app, "Account", true, &[&account_settings])?;

    let sync_export = MenuItem::with_id(app, "sync_export", "Export Settings…", true, None::<&str>)?;
    let sync_import = MenuItem::with_id(app, "sync_import", "Import Settings…", true, None::<&str>)?;
    let sync = Submenu::with_items(app, "Sync", true, &[&sync_export, &sync_import])?;

    let help_parity = MenuItem::with_id(app, "help_parity", "VS Code Parity Doc", true, None::<&str>)?;
    let help_ext = MenuItem::with_id(app, "help_extension", "Objective Extension", true, None::<&str>)?;
    let help = Submenu::with_items(app, "Help", true, &[&help_parity, &help_ext])?;

    Menu::with_items(app, &[&file, &view, &account, &sync, &help])
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .manage(Arc::new(pty::PtySessions::new()))
        .manage(Arc::new(lsp::LspPool::new()))
        .manage(Arc::new(debug::DebugPool::new()))
        .manage(Arc::new(openvscode::OpenVsCodePool::new()))
        .manage(Arc::new(notebook_kernel::NotebookKernelPool::new()))
        .manage(Arc::new(workspace_watch::WorkspaceWatchPool::new()))
        .manage(Arc::new(slack_socket::SlackSocketService::new()));

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            focus_main_window(app);
        }));
    }

    builder
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let menu = build_app_menu(app)?;
            app.set_menu(menu)?;
            Ok(())
        })
        .on_menu_event(|app, event| {
            let id = event.id().0.clone();
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.emit("objectiv-menu", id);
            } else {
                let _ = app.emit("objectiv-menu", id);
            }
        })
        .on_permission_request(|_, kind| match kind {
            PermissionKind::Camera | PermissionKind::Microphone | PermissionKind::DisplayCapture => {
                PermissionResponse::Allow
            }
            _ => PermissionResponse::Default,
        })
        .invoke_handler(tauri::generate_handler![
            shell::open_external,
            pty::pty_spawn,
            pty::pty_write,
            pty::pty_resize,
            pty::pty_kill,
            workspace::workspace_scan,
            workspace::workspace_read,
            workspace::workspace_read_bytes,
            workspace::workspace_write,
            workspace::workspace_write_bytes,
            workspace::workspace_mkdir,
            workspace::workspace_rename,
            workspace::workspace_copy,
            workspace::workspace_move,
            workspace::workspace_delete,
            workspace::workspace_reveal,
            workspace_watch::workspace_watch_sync,
            workspace_watch::workspace_watch_ping,
            workspace::workspace_git_status,
            workspace::workspace_git_snapshot,
            workspace::workspace_git_stage,
            workspace::workspace_git_unstage,
            workspace::workspace_git_stage_all,
            workspace::workspace_git_commit,
            workspace::workspace_git_fetch,
            workspace::workspace_git_push,
            workspace::workspace_git_pull,
            workspace::workspace_git_rebase,
            workspace::workspace_git_checkout,
            workspace::workspace_git_create_branch,
            workspace::workspace_search,
            workspace::workspace_run_shell,
            workspace::user_home,
            workspace::path_is_dir,
            lsp::lsp_start,
            lsp::lsp_send,
            lsp::lsp_stop,
            debug::debug_launch_node,
            debug::debug_launch_python,
            debug::debug_stop,
            openvscode::openvscode_start,
            openvscode::openvscode_stop,
            openvscode::openvscode_status,
            notebook_kernel::notebook_kernel_ensure,
            notebook_kernel::notebook_kernel_exec,
            notebook_kernel::notebook_kernel_interrupt,
            notebook_kernel::notebook_kernel_restart,
            notebook_kernel::notebook_kernel_shutdown,
            browser_webview::objectiv_browser_navigate,
            browser_webview::objectiv_browser_reload,
            marketplace::marketplace_apps_dir,
            marketplace::marketplace_list_installed,
            marketplace::marketplace_install,
            marketplace::marketplace_uninstall,
            marketplace::marketplace_set_enabled,
            slack::slack_fetch_workspace,
            slack::slack_conversation_history,
            slack::slack_fetch_protected_media,
            slack::slack_post_message,
            slack::slack_send_composer,
            slack::slack_update_message,
            slack::slack_auth_self,
            slack::slack_add_reaction,
            slack::slack_remove_reaction,
            slack::slack_list_users,
            slack::slack_cache_read,
            slack::slack_cache_write,
            slack_socket::slack_socket_start,
            slack_socket::slack_socket_stop,
            slack_socket::slack_socket_is_running,
        ])
        .build(tauri::generate_context!())
        .expect("error while running Objectiv")
        .run(|app_handle, event| {
            #[cfg(target_os = "macos")]
            if let RunEvent::Reopen { .. } = event {
                focus_main_window(app_handle);
            }
        });
}
