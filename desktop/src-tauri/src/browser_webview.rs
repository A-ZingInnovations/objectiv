//! Navigate / reload embedded browser child webviews (JS API has no navigate yet).

use tauri::{AppHandle, Manager, Url};

fn browser_webview(app: &AppHandle, label: &str) -> Result<tauri::WebviewWindow, String> {
    app.get_webview_window(label)
        .ok_or_else(|| format!("Browser window not found: {label}"))
}

#[tauri::command]
pub fn objectiv_browser_navigate(
    app: AppHandle,
    label: String,
    url: String,
) -> Result<(), String> {
    let parsed = Url::parse(&url).map_err(|e| e.to_string())?;
    browser_webview(&app, &label)?
        .navigate(parsed)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn objectiv_browser_reload(app: AppHandle, label: String) -> Result<(), String> {
    browser_webview(&app, &label)?
        .reload()
        .map_err(|e| e.to_string())
}
