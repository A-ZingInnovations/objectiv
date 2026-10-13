use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::process::Command;

use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstalledExtensionSummary {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub kind: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub enabled: bool,
    pub install_path: String,
}

fn apps_root() -> Result<PathBuf, String> {
    let home = crate::workspace::user_home()?;
    Ok(PathBuf::from(home).join(".objectiv").join("apps"))
}

fn runtime_path() -> Result<PathBuf, String> {
    let home = crate::workspace::user_home()?;
    Ok(PathBuf::from(home).join(".objectiv").join("marketplace-runtime.json"))
}

fn package_id(value: &Value) -> Result<String, String> {
    if let Some(id) = value
        .get("manifest")
        .and_then(|m| m.get("id"))
        .and_then(|v| v.as_str())
    {
        return Ok(id.to_string());
    }
    if let Some(id) = value
        .get("objectiv")
        .and_then(|o| o.get("extensionId"))
        .and_then(|v| v.as_str())
    {
        return Ok(id.to_string());
    }
    let publisher = value
        .get("publisher")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "package missing publisher".to_string())?;
    let name = value
        .get("name")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "package missing name".to_string())?;
    Ok(format!("{publisher}.{name}"))
}

fn safe_dir_name(id: &str) -> String {
    id.chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '.' || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect()
}

fn read_enabled_ids(root: &PathBuf) -> Result<Vec<String>, String> {
    let enabled_path = root.join("enabled.json");
    if !enabled_path.is_file() {
        return Ok(Vec::new());
    }
    serde_json::from_str(&fs::read_to_string(&enabled_path).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())
}

fn write_enabled_ids(root: &PathBuf, enabled: &[String]) -> Result<(), String> {
    let enabled_path = root.join("enabled.json");
    fs::write(
        &enabled_path,
        serde_json::to_string_pretty(enabled).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())
}

fn install_folder_name(value: &Value) -> Result<String, String> {
    if let (Some(publisher), Some(name)) = (
        value.get("publisher").and_then(|v| v.as_str()),
        value.get("name").and_then(|v| v.as_str()),
    ) {
        let version = value
            .get("version")
            .and_then(|v| v.as_str())
            .unwrap_or("0.0.0");
        return Ok(format!("{publisher}.{name}-{version}"));
    }
    Ok(safe_dir_name(&package_id(value)?))
}

fn resolve_package_dir(root: &PathBuf, id: &str) -> PathBuf {
    let legacy = root.join(safe_dir_name(id));
    if legacy.is_dir() {
        return legacy;
    }
    if let Ok(entries) = fs::read_dir(root) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }
            let pkg = path.join("package.json");
            if !pkg.is_file() {
                continue;
            }
            if let Ok(text) = fs::read_to_string(&pkg) {
                if let Ok(v) = serde_json::from_str::<Value>(&text) {
                    if package_id(&v).ok().as_deref() == Some(id) {
                        return path;
                    }
                }
            }
        }
    }
    legacy
}

fn enable_extension_id(root: &PathBuf, id: &str) -> Result<(), String> {
    let mut enabled = read_enabled_ids(root)?;
    if !enabled.iter().any(|x| x == id) {
        enabled.push(id.to_string());
        write_enabled_ids(root, &enabled)?;
    }
    Ok(())
}

fn install_document_to_dir(
    root: &PathBuf,
    dir: &PathBuf,
    value: &Value,
    extra_files: &HashMap<String, String>,
) -> Result<String, String> {
    let id = package_id(value)?;
    if dir.exists() {
        fs::remove_dir_all(dir).map_err(|e| e.to_string())?;
    }
    fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    crate::extension_pack::write_files_from_manifest(dir, value)?;
    crate::extension_pack::write_file_map(dir, extra_files)?;
    let slim = crate::extension_pack::slim_package_document(value)?;
    fs::write(dir.join("package.json"), slim.as_bytes()).map_err(|e| e.to_string())?;
    enable_extension_id(root, &id)?;
    Ok(id)
}

#[tauri::command]
pub fn marketplace_install_package(
    content: String,
    extra_files: Option<HashMap<String, String>>,
) -> Result<String, String> {
    let value: Value = serde_json::from_str(content.trim()).map_err(|e| e.to_string())?;
    let root = apps_root()?;
    let dir = root.join(install_folder_name(&value)?);
    install_document_to_dir(&root, &dir, &value, &extra_files.unwrap_or_default())
}

#[tauri::command]
pub fn marketplace_install_extension_folder(folder_path: String) -> Result<String, String> {
    let source = PathBuf::from(folder_path.trim());
    if !source.is_dir() {
        return Err("not a directory".into());
    }
    let root = apps_root()?;
    let temp_parent = root.join("_import");
    fs::create_dir_all(&temp_parent).map_err(|e| e.to_string())?;
    let staging = temp_parent.join(format!("stage-{}", uuid::Uuid::new_v4()));
    let doc = crate::extension_pack::install_tree_from_folder(&source, &staging)?;
    let id = package_id(&doc)?;
    let dest = root.join(install_folder_name(&doc)?);
    if dest.exists() {
        fs::remove_dir_all(&dest).map_err(|e| e.to_string())?;
    }
    fs::rename(&staging, &dest).map_err(|e| e.to_string())?;
    enable_extension_id(&root, &id)?;
    Ok(id)
}

#[tauri::command]
pub fn marketplace_install_extension_archive(
    path: String,
    content_base64: Option<String>,
) -> Result<String, String> {
    let bytes = if let Some(b64) = content_base64 {
        use base64::Engine;
        base64::engine::general_purpose::STANDARD
            .decode(b64.trim())
            .map_err(|e| e.to_string())?
    } else {
        let p = PathBuf::from(path.trim());
        if !p.is_file() {
            return Err("archive not found".into());
        }
        fs::read(&p).map_err(|e| e.to_string())?
    };
    let root = apps_root()?;
    let staging = root
        .join("_import")
        .join(format!("stage-{}", uuid::Uuid::new_v4()));
    let doc = crate::extension_pack::install_tree_from_zip_bytes(&bytes, &staging)?;
    let id = package_id(&doc)?;
    let dest = root.join(install_folder_name(&doc)?);
    if dest.exists() {
        fs::remove_dir_all(&dest).map_err(|e| e.to_string())?;
    }
    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::rename(&staging, &dest).map_err(|e| e.to_string())?;
    enable_extension_id(&root, &id)?;
    Ok(id)
}

fn installed_from_package(value: &Value, install_path: &str, enabled: bool) -> Result<InstalledExtensionSummary, String> {
    let id = package_id(value)?;
    let legacy = value.get("manifest");
    let name = legacy
        .and_then(|m| m.get("name"))
        .and_then(|v| v.as_str())
        .or_else(|| value.get("displayName").and_then(|v| v.as_str()))
        .or_else(|| value.get("name").and_then(|v| v.as_str()))
        .unwrap_or(&id)
        .to_string();
    let kind = legacy
        .and_then(|m| m.get("kind"))
        .and_then(|v| v.as_str())
        .or_else(|| {
            value
                .get("objectiv")
                .and_then(|o| o.get("kind"))
                .and_then(|v| v.as_str())
        })
        .map(|s| s.to_string());
    let version = value
        .get("version")
        .and_then(|v| v.as_str())
        .or_else(|| legacy.and_then(|m| m.get("version")).and_then(|v| v.as_str()))
        .map(|s| s.to_string());
    let description = value
        .get("description")
        .and_then(|v| v.as_str())
        .or_else(|| legacy.and_then(|m| m.get("description")).and_then(|v| v.as_str()))
        .map(|s| s.to_string());
    Ok(InstalledExtensionSummary {
        id,
        name,
        kind,
        version,
        description,
        enabled,
        install_path: install_path.to_string(),
    })
}

#[tauri::command]
pub fn marketplace_list_installed() -> Result<Vec<String>, String> {
    Ok(marketplace_list_installed_details()?
        .into_iter()
        .map(|e| e.id)
        .collect())
}

#[tauri::command]
pub fn marketplace_list_installed_details() -> Result<Vec<InstalledExtensionSummary>, String> {
    let root = apps_root()?;
    if !root.is_dir() {
        return Ok(Vec::new());
    }
    let enabled_set: std::collections::HashSet<String> =
        read_enabled_ids(&root)?.into_iter().collect();
    let mut out = Vec::new();
    for entry in fs::read_dir(&root).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        if path.file_name().and_then(|s| s.to_str()) == Some("_import") {
            continue;
        }
        let pkg = path.join("package.json");
        if !pkg.is_file() {
            continue;
        }
        let text = fs::read_to_string(&pkg).map_err(|e| e.to_string())?;
        if let Ok(v) = serde_json::from_str::<Value>(&text) {
            let enabled = package_id(&v)
                .ok()
                .map(|id| enabled_set.contains(&id))
                .unwrap_or(false);
            if let Ok(summary) = installed_from_package(&v, &path.to_string_lossy(), enabled) {
                out.push(summary);
            }
        }
    }
    out.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(out)
}

#[tauri::command]
pub fn marketplace_read_enabled_packages() -> Result<Vec<String>, String> {
    let root = apps_root()?;
    let enabled = read_enabled_ids(&root)?;
    let mut out = Vec::new();
    for id in enabled {
        let dir = resolve_package_dir(&root, &id);
        let pkg = dir.join("package.json");
        if !pkg.is_file() {
            continue;
        }
        let text = fs::read_to_string(&pkg).map_err(|e| e.to_string())?;
        let mut value: Value = serde_json::from_str(&text).map_err(|e| e.to_string())?;
        value = crate::extension_pack::hydrate_package_from_dir(&dir, value)?;
        out.push(serde_json::to_string(&value).map_err(|e| e.to_string())?);
    }
    Ok(out)
}

#[tauri::command]
pub fn marketplace_read_extension_readme(extension_id: String) -> Result<Option<String>, String> {
    let root = apps_root()?;
    let dir = resolve_package_dir(&root, extension_id.trim());
    for candidate in ["README.md", "readme.md", "README"] {
        if let Some(text) = crate::extension_pack::read_text_if_exists(&dir, candidate)? {
            return Ok(Some(text));
        }
    }
    Ok(None)
}

#[tauri::command]
pub fn marketplace_reveal_extension_folder(extension_id: String) -> Result<(), String> {
    let root = apps_root()?;
    let dir = resolve_package_dir(&root, extension_id.trim());
    if !dir.is_dir() {
        return Err("extension not installed".into());
    }
    let full = dir
        .canonicalize()
        .map_err(|e| e.to_string())?;
    #[cfg(target_os = "macos")]
    {
        let status = Command::new("open")
            .args(["-R", &full.join("package.json").to_string_lossy()])
            .status()
            .map_err(|e| e.to_string())?;
        if !status.success() {
            return Err("reveal failed".into());
        }
        return Ok(());
    }
    #[cfg(target_os = "windows")]
    {
        let status = Command::new("explorer")
            .arg(format!("/select,{}", full.join("package.json").display()))
            .status()
            .map_err(|e| e.to_string())?;
        if !status.success() {
            return Err("reveal failed".into());
        }
        return Ok(());
    }
    #[cfg(target_os = "linux")]
    {
        let status = Command::new("xdg-open")
            .arg(&full)
            .status()
            .map_err(|e| e.to_string())?;
        if !status.success() {
            return Err("reveal failed".into());
        }
        Ok(())
    }
}

#[tauri::command]
pub fn marketplace_read_cloud_env() -> Result<String, String> {
    let home = crate::workspace::user_home()?;
    let path = PathBuf::from(home).join(".objectiv").join("cloud-env.json");
    if !path.is_file() {
        return Ok("{}".to_string());
    }
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn marketplace_set_extension_enabled(extension_id: String, enabled: bool) -> Result<(), String> {
    let id = extension_id.trim();
    if id.is_empty() {
        return Err("extension id required".into());
    }
    let root = apps_root()?;
    let dir = resolve_package_dir(&root, id);
    if !dir.join("package.json").is_file() {
        return Err(format!("extension not installed: {id}"));
    }
    let mut enabled_ids = read_enabled_ids(&root)?;
    let present = enabled_ids.iter().any(|x| x == id);
    if enabled {
        if !present {
            enabled_ids.push(id.to_string());
            write_enabled_ids(&root, &enabled_ids)?;
        }
    } else if present {
        enabled_ids.retain(|x| x != id);
        write_enabled_ids(&root, &enabled_ids)?;
    }
    Ok(())
}

#[tauri::command]
pub fn marketplace_uninstall_extension(extension_id: String) -> Result<(), String> {
    let id = extension_id.trim();
    if id.is_empty() {
        return Err("extension id required".into());
    }
    let root = apps_root()?;
    let dir = resolve_package_dir(&root, id);
    if dir.is_dir() {
        fs::remove_dir_all(&dir).map_err(|e| e.to_string())?;
    }
    let mut enabled_ids = read_enabled_ids(&root)?;
    enabled_ids.retain(|x| x != id);
    write_enabled_ids(&root, &enabled_ids)?;
    Ok(())
}

#[tauri::command]
pub fn marketplace_write_runtime(content: String) -> Result<(), String> {
    let path = runtime_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&path, content.as_bytes()).map_err(|e| e.to_string())?;
    Ok(())
}
