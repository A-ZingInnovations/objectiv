use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Serialize, Deserialize, Default)]
struct Registry {
    apps: HashMap<String, InstalledRecord>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct InstalledRecord {
    pub enabled: bool,
    pub version: String,
    pub installed_at: String,
}

#[derive(Serialize)]
pub struct InstalledAppInfo {
    pub id: String,
    pub enabled: bool,
    pub version: String,
    pub manifest_json: String,
}

fn objectiv_home() -> Result<PathBuf, String> {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map_err(|_| "cannot resolve home directory".to_string())?;
    Ok(PathBuf::from(home).join(".objectiv"))
}

fn apps_dir() -> Result<PathBuf, String> {
    Ok(objectiv_home()?.join("apps"))
}

fn registry_path() -> Result<PathBuf, String> {
    Ok(objectiv_home()?.join("marketplace").join("installed.json"))
}

fn validate_app_id(id: &str) -> Result<(), String> {
    if id.is_empty() || id.len() > 128 {
        return Err("invalid app id".into());
    }
    if !id
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '-' || c == '_')
    {
        return Err("invalid app id characters".into());
    }
    Ok(())
}

fn safe_rel_path(rel: &str) -> Result<PathBuf, String> {
    let rel = rel.trim().trim_start_matches('/');
    if rel.is_empty() {
        return Err("empty relative path".into());
    }
    let mut out = PathBuf::new();
    for comp in Path::new(rel).components() {
        match comp {
            Component::Normal(p) => out.push(p),
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => {
                return Err("invalid path".into());
            }
            Component::CurDir => {}
        }
    }
    Ok(out)
}

fn read_registry() -> Result<Registry, String> {
    let path = registry_path()?;
    if !path.is_file() {
        return Ok(Registry::default());
    }
    let raw = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&raw).map_err(|e| e.to_string())
}

fn write_registry(reg: &Registry) -> Result<(), String> {
    let path = registry_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let raw = serde_json::to_string_pretty(reg).map_err(|e| e.to_string())?;
    fs::write(path, raw.as_bytes()).map_err(|e| e.to_string())
}

fn now_epoch_secs() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs().to_string())
        .unwrap_or_else(|_| "0".to_string())
}

fn manifest_version(manifest_json: &str) -> String {
    serde_json::from_str::<serde_json::Value>(manifest_json)
        .ok()
        .and_then(|v| v.get("version").and_then(|x| x.as_str()).map(String::from))
        .unwrap_or_else(|| "?".to_string())
}

#[tauri::command]
pub fn marketplace_apps_dir() -> Result<String, String> {
    let dir = apps_dir()?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.to_string_lossy().to_string())
}

#[tauri::command]
pub fn marketplace_list_installed() -> Result<Vec<InstalledAppInfo>, String> {
    let reg = read_registry()?;
    let base = apps_dir()?;
    let mut out = Vec::new();
    for (id, rec) in reg.apps {
        let manifest_path = base.join(&id).join("manifest.json");
        let manifest_json = if manifest_path.is_file() {
            fs::read_to_string(&manifest_path).unwrap_or_default()
        } else {
            String::new()
        };
        out.push(InstalledAppInfo {
            id,
            enabled: rec.enabled,
            version: rec.version,
            manifest_json,
        });
    }
    out.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(out)
}

#[tauri::command]
pub fn marketplace_install(
    app_id: String,
    manifest_json: String,
    files: HashMap<String, String>,
) -> Result<(), String> {
    validate_app_id(&app_id)?;
    if manifest_json.trim().is_empty() {
        return Err("manifest required".into());
    }
    let app_dir = apps_dir()?.join(&app_id);
    fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;
    fs::write(app_dir.join("manifest.json"), manifest_json.as_bytes()).map_err(|e| e.to_string())?;
    for (rel, content) in files {
        let rel = safe_rel_path(&rel)?;
        let path = app_dir.join(rel);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        fs::write(path, content.as_bytes()).map_err(|e| e.to_string())?;
    }
    let version = manifest_version(&manifest_json);
    let mut reg = read_registry()?;
    reg.apps.insert(
        app_id,
        InstalledRecord {
            enabled: true,
            version,
            installed_at: now_epoch_secs(),
        },
    );
    write_registry(&reg)
}

#[tauri::command]
pub fn marketplace_uninstall(app_id: String) -> Result<(), String> {
    validate_app_id(&app_id)?;
    let app_dir = apps_dir()?.join(&app_id);
    if app_dir.is_dir() {
        fs::remove_dir_all(&app_dir).map_err(|e| e.to_string())?;
    }
    let mut reg = read_registry()?;
    reg.apps.remove(&app_id);
    write_registry(&reg)
}

#[tauri::command]
pub fn marketplace_set_enabled(app_id: String, enabled: bool) -> Result<(), String> {
    validate_app_id(&app_id)?;
    let mut reg = read_registry()?;
    let rec = reg.apps.get_mut(&app_id).ok_or_else(|| "app not installed".to_string())?;
    rec.enabled = enabled;
    write_registry(&reg)
}
