//! Navigate / reload / inspect embedded browser child webviews.

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

/// Toggle Web Inspector (Inspect Element / Elements / Console) on a browser tab webview.
#[tauri::command]
pub fn objectiv_browser_toggle_devtools(app: AppHandle, label: String) -> Result<(), String> {
    let win = browser_webview(&app, &label)?;
    // tauri crate is built with `devtools`; always allow toggle in Objectiv desktop.
    if win.is_devtools_open() {
        win.close_devtools();
    } else {
        win.open_devtools();
    }
    Ok(())
}
