use std::collections::HashMap;
use std::fs;
use std::path::{Component, Path, PathBuf};

use serde_json::Value;
use zip::ZipArchive;

pub fn safe_rel_path(raw: &str) -> Result<PathBuf, String> {
    let path = Path::new(raw.trim());
    if path.as_os_str().is_empty() {
        return Err("empty path".into());
    }
    let mut out = PathBuf::new();
    for comp in path.components() {
        match comp {
            Component::Normal(p) => out.push(p),
            Component::CurDir => {}
            Component::ParentDir => return Err("parent segments not allowed".into()),
            _ => return Err("invalid path".into()),
        }
    }
    if out.as_os_str().is_empty() {
        return Err("invalid path".into());
    }
    Ok(out)
}

pub fn write_file_map(base: &Path, files: &HashMap<String, String>) -> Result<(), String> {
    for (rel, content) in files {
        let rel = safe_rel_path(rel)?;
        let dest = base.join(rel);
        if let Some(parent) = dest.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        fs::write(&dest, content.as_bytes()).map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn write_files_from_manifest(base: &Path, value: &Value) -> Result<(), String> {
    let Some(files) = value.get("files").and_then(|f| f.as_object()) else {
        return Ok(());
    };
    let mut map = HashMap::new();
    for (name, content) in files {
        let text = match content {
            Value::String(s) => s.clone(),
            other => serde_json::to_string_pretty(other).map_err(|e| e.to_string())?,
        };
        map.insert(name.clone(), text);
    }
    write_file_map(base, &map)
}

pub fn slim_package_document(value: &Value) -> Result<String, String> {
    let mut doc = value.clone();
    if let Some(obj) = doc.as_object_mut() {
        obj.remove("files");
    }
    serde_json::to_string_pretty(&doc).map_err(|e| e.to_string())
}

fn copy_dir_all(from: &Path, to: &Path) -> Result<(), String> {
    fs::create_dir_all(to).map_err(|e| e.to_string())?;
    for entry in fs::read_dir(from).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let ty = entry.file_type().map_err(|e| e.to_string())?;
        let dest = to.join(entry.file_name());
        if ty.is_dir() {
            copy_dir_all(&entry.path(), &dest)?;
        } else if ty.is_file() {
            fs::copy(entry.path(), dest).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

fn find_package_json_root(dir: &Path) -> Result<PathBuf, String> {
    let direct = dir.join("package.json");
    if direct.is_file() {
        return Ok(dir.to_path_buf());
    }
    let mut children = Vec::new();
    for entry in fs::read_dir(dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        if entry.file_type().map_err(|e| e.to_string())?.is_dir() {
            children.push(entry.path());
        }
    }
    if children.len() == 1 && children[0].join("package.json").is_file() {
        return Ok(children[0].clone());
    }
    Err("extension pack must contain package.json at root".into())
}

pub fn install_tree_from_folder(source_dir: &Path, dest_dir: &Path) -> Result<Value, String> {
    if dest_dir.exists() {
        fs::remove_dir_all(dest_dir).map_err(|e| e.to_string())?;
    }
    fs::create_dir_all(dest_dir).map_err(|e| e.to_string())?;
    let root = find_package_json_root(source_dir)?;
    if root == source_dir {
        copy_dir_all(source_dir, dest_dir)?;
    } else {
        copy_dir_all(&root, dest_dir)?;
    }
    let pkg_path = dest_dir.join("package.json");
    let text = fs::read_to_string(&pkg_path).map_err(|e| e.to_string())?;
    serde_json::from_str(&text).map_err(|e| e.to_string())
}

pub fn install_tree_from_zip_bytes(bytes: &[u8], dest_dir: &Path) -> Result<Value, String> {
    let cursor = std::io::Cursor::new(bytes);
    let mut archive = ZipArchive::new(cursor).map_err(|e| format!("invalid zip: {e}"))?;
    let temp = dest_dir.with_extension("extracting");
    if temp.exists() {
        fs::remove_dir_all(&temp).map_err(|e| e.to_string())?;
    }
    fs::create_dir_all(&temp).map_err(|e| e.to_string())?;

    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        let enclosed = file.enclosed_name().ok_or_else(|| "zip path unsafe".to_string())?;
        let out_path = temp.join(enclosed);
        if file.name().ends_with('/') {
            fs::create_dir_all(&out_path).map_err(|e| e.to_string())?;
            continue;
        }
        if let Some(parent) = out_path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let mut out = fs::File::create(&out_path).map_err(|e| e.to_string())?;
        std::io::copy(&mut file, &mut out).map_err(|e| e.to_string())?;
    }

    let doc = install_tree_from_folder(&temp, dest_dir)?;
    let _ = fs::remove_dir_all(&temp);
    Ok(doc)
}

pub fn read_text_if_exists(base: &Path, rel: &str) -> Result<Option<String>, String> {
    let path = base.join(safe_rel_path(rel)?);
    if !path.is_file() {
        return Ok(None);
    }
    let meta = fs::metadata(&path).map_err(|e| e.to_string())?;
    if meta.len() > 512 * 1024 {
        return Err("file too large".into());
    }
    fs::read_to_string(&path).map_err(|e| e.to_string()).map(Some)
}

fn merge_contrib_key(contributes: &mut serde_json::Map<String, Value>, key: &str, value: Value) {
    if value.is_null() {
        return;
    }
    contributes.insert(key.to_string(), value);
}

fn is_vscode_extension_package(value: &Value) -> bool {
    value.get("manifest").is_none()
        && value.get("publisher").and_then(|v| v.as_str()).is_some()
        && value.get("name").and_then(|v| v.as_str()).is_some()
}

/// Merge sidecar files (snippets.json, tools.json, …) into manifest.contributes or objectiv (VS Code layout).
pub fn hydrate_package_from_dir(dir: &Path, mut value: Value) -> Result<Value, String> {
    if is_vscode_extension_package(&value) {
        return hydrate_vscode_sidecars(dir, value);
    }
    let Some(manifest) = value.get_mut("manifest") else {
        return Ok(value);
    };
    let Some(manifest_obj) = manifest.as_object_mut() else {
        return Ok(value);
    };
    let contributes = manifest_obj
        .entry("contributes")
        .or_insert_with(|| Value::Object(serde_json::Map::new()));
    if !contributes.is_object() {
        *contributes = Value::Object(serde_json::Map::new());
    }
    let obj = contributes.as_object_mut().ok_or("contributes not object")?;

    if let Some(text) = read_text_if_exists(dir, "snippets.json")? {
        let parsed: Value = serde_json::from_str(&text).map_err(|e| e.to_string())?;
        let snippets = if parsed.is_array() {
            parsed
        } else {
            parsed
                .get("snippets")
                .cloned()
                .unwrap_or(parsed)
        };
        merge_contrib_key(obj, "snippets", snippets);
    }

    if let Some(text) = read_text_if_exists(dir, "tools.json")? {
        let parsed: Value = serde_json::from_str(&text).map_err(|e| e.to_string())?;
        let tools = parsed
            .get("agentTools")
            .or_else(|| parsed.get("tools"))
            .cloned()
            .unwrap_or(parsed);
        merge_contrib_key(obj, "agentTools", tools);
    }

    if let Some(text) = read_text_if_exists(dir, "integration.json")? {
        let parsed: Value = serde_json::from_str(&text).map_err(|e| e.to_string())?;
        merge_contrib_key(obj, "integration", parsed);
    }

    if let Some(text) = read_text_if_exists(dir, "theme.json")? {
        let parsed: Value = serde_json::from_str(&text).map_err(|e| e.to_string())?;
        if let Some(map) = parsed.as_object() {
            for (k, v) in map {
                obj.insert(k.clone(), v.clone());
            }
        }
    }

    if let Some(text) = read_text_if_exists(dir, "settings.json")? {
        let parsed: Value = serde_json::from_str(&text).map_err(|e| e.to_string())?;
        if let Some(editor) = parsed.get("editor") {
            merge_contrib_key(obj, "editor", editor.clone());
        }
        if let Some(settings) = parsed.get("settings") {
            merge_contrib_key(obj, "settings", settings.clone());
        }
    }

    if let Some(text) = read_text_if_exists(dir, "workbench.json")? {
        let parsed: Value = serde_json::from_str(&text).map_err(|e| e.to_string())?;
        if let Some(panel) = parsed.get("workbenchPanel") {
            merge_contrib_key(obj, "workbenchPanel", panel.clone());
        }
    }

    if let Some(text) = read_text_if_exists(dir, "prompt.md")? {
        let trimmed = text.trim();
        if !trimmed.is_empty() {
            merge_contrib_key(obj, "promptAddendum", Value::String(trimmed.to_string()));
        }
    }

    Ok(value)
}

fn merge_objectiv_key(obj: &mut serde_json::Map<String, Value>, key: &str, value: Value) {
    if value.is_null() {
        return;
    }
    obj.insert(key.to_string(), value);
}

fn hydrate_vscode_sidecars(dir: &Path, mut value: Value) -> Result<Value, String> {
    let root = value.as_object_mut().ok_or("package root must be object")?;
    root.entry("objectiv")
        .or_insert_with(|| Value::Object(serde_json::Map::new()));
    let objectiv = root
        .get_mut("objectiv")
        .and_then(|v| v.as_object_mut())
        .ok_or("objectiv block invalid")?;

    if let Some(text) = read_text_if_exists(dir, "snippets.json")? {
        let parsed: Value = serde_json::from_str(&text).map_err(|e| e.to_string())?;
        let snippets = if parsed.is_array() {
            parsed
        } else {
            parsed
                .get("snippets")
                .cloned()
                .unwrap_or(parsed)
        };
        merge_objectiv_key(objectiv, "runtimeSnippets", snippets);
    }

    if let Some(text) = read_text_if_exists(dir, "tools.json")? {
        let parsed: Value = serde_json::from_str(&text).map_err(|e| e.to_string())?;
        let tools = parsed
            .get("agentTools")
            .or_else(|| parsed.get("tools"))
            .cloned()
            .unwrap_or(parsed);
        merge_objectiv_key(objectiv, "agentTools", tools);
    }

    if let Some(text) = read_text_if_exists(dir, "integration.json")? {
        let parsed: Value = serde_json::from_str(&text).map_err(|e| e.to_string())?;
        merge_objectiv_key(objectiv, "integration", parsed);
    }

    if let Some(text) = read_text_if_exists(dir, "theme.json")? {
        let parsed: Value = serde_json::from_str(&text).map_err(|e| e.to_string())?;
        if let Some(map) = parsed.as_object() {
            if let Some(t) = map.get("workbenchColorTheme") {
                merge_objectiv_key(objectiv, "workbenchColorTheme", t.clone());
            }
            if let Some(a) = map.get("accentColor") {
                merge_objectiv_key(objectiv, "accentColor", a.clone());
            }
        }
    }

    if let Some(text) = read_text_if_exists(dir, "settings.json")? {
        let parsed: Value = serde_json::from_str(&text).map_err(|e| e.to_string())?;
        if let Some(editor) = parsed.get("editor") {
            merge_objectiv_key(objectiv, "editor", editor.clone());
        }
    }

    if let Some(text) = read_text_if_exists(dir, "workbench.json")? {
        let parsed: Value = serde_json::from_str(&text).map_err(|e| e.to_string())?;
        if let Some(panel) = parsed.get("workbenchPanel") {
            merge_objectiv_key(objectiv, "workbenchPanel", panel.clone());
        }
    }

    if let Some(text) = read_text_if_exists(dir, "prompt.md")? {
        let trimmed = text.trim();
        if !trimmed.is_empty() {
            merge_objectiv_key(objectiv, "promptAddendum", Value::String(trimmed.to_string()));
        }
    }

    Ok(value)
}
