use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;

#[tauri::command]
pub fn open_external(app: AppHandle, target: String) -> Result<(), String> {
    app.shell()
        .open(target, None)
        .map_err(|e| e.to_string())
}
