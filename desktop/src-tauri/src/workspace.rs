use globset::{Glob, GlobSet, GlobSetBuilder};
use regex::{Regex, RegexBuilder};
use serde::Serialize;
use std::io::{BufRead, BufReader};
use std::path::{Component, Path, PathBuf};
use std::process::Command;

const SKIP_DIRS: &[&str] = &[
    "node_modules",
    ".git",
    "target",
    "dist",
    ".venv-objective",
    "vllm_venv",
    "__pycache__",
];
const MAX_FILES: usize = 2000;
const MAX_SCAN_BYTES: u64 = 25_000_000;
const MAX_TEXT_BYTES: u64 = 2_000_000;
const MAX_BINARY_BYTES: u64 = 25_000_000;

fn safe_rel(root: &Path, rel: &str) -> Result<PathBuf, String> {
    let rel = rel.trim_start_matches('/');
    let mut out = PathBuf::new();
    for comp in Path::new(rel).components() {
        match comp {
            Component::Normal(p) => out.push(p),
            Component::ParentDir => return Err("path escapes workspace".into()),
            Component::RootDir | Component::Prefix(_) => return Err("absolute path not allowed".into()),
            Component::CurDir => {}
        }
    }
    let canon_root = root
        .canonicalize()
        .map_err(|e| format!("workspace root: {e}"))?;
    let joined = canon_root.join(&out);
    if !joined.starts_with(&canon_root) {
        return Err("path escapes workspace".into());
    }
    Ok(out)
}

fn should_skip_dir(name: &str) -> bool {
    name.starts_with('.') || SKIP_DIRS.contains(&name)
}

fn should_skip_file(name: &str) -> bool {
    let lower = name.to_lowercase();
    matches!(
        lower.as_str(),
        ".ds_store" | "thumbs.db" | "desktop.ini" | ".localized"
    ) || lower.ends_with(".swp") || lower.ends_with('~')
}

fn collect_files(dir: &Path, root: &Path, out: &mut Vec<String>, count: &mut usize) -> Result<(), String> {
    if *count >= MAX_FILES {
        return Ok(());
    }
    for entry in std::fs::read_dir(dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let name = entry.file_name().to_string_lossy().to_string();
        let path = entry.path();
        if path.is_dir() {
            if should_skip_dir(&name) {
                continue;
            }
            // Include directories (trailing `/`) so empty folders appear in the explorer.
            if *count < MAX_FILES {
                let rel = path
                    .strip_prefix(root)
                    .map_err(|e| e.to_string())?
                    .to_string_lossy()
                    .replace('\\', "/");
                out.push(format!("{rel}/"));
                *count += 1;
            }
            collect_files(&path, root, out, count)?;
        } else if path.is_file() {
            if should_skip_file(&name) {
                continue;
            }
            let meta = entry.metadata().map_err(|e| e.to_string())?;
            if meta.len() > MAX_SCAN_BYTES {
                continue;
            }
            let rel = path
                .strip_prefix(root)
                .map_err(|e| e.to_string())?
                .to_string_lossy()
                .replace('\\', "/");
            out.push(rel);
            *count += 1;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn workspace_scan(root: String) -> Result<Vec<String>, String> {
    let root = PathBuf::from(&root);
    let root = root
        .canonicalize()
        .map_err(|e| format!("invalid workspace root: {e}"))?;
    let mut paths: Vec<String> = Vec::new();
    let mut count = 0;
    collect_files(&root, &root, &mut paths, &mut count)?;
    paths.sort();
    Ok(paths)
}

/// Resolve relative path from any of the keys frontends have used historically.
fn pick_rel_path(rel_path: Option<String>, path: Option<String>) -> Result<String, String> {
    rel_path
        .filter(|s| !s.is_empty())
        .or_else(|| path.filter(|s| !s.is_empty()))
        .ok_or_else(|| "missing relative path (relPath/path)".to_string())
}

#[tauri::command]
pub fn workspace_read(
    root: String,
    rel_path: Option<String>,
    path: Option<String>,
) -> Result<String, String> {
    let rel_path = pick_rel_path(rel_path, path)?;
    let root = PathBuf::from(&root)
        .canonicalize()
        .map_err(|e| e.to_string())?;
    let rel = safe_rel(&root, &rel_path)?;
    let full = root.join(rel);
    let meta = std::fs::metadata(&full).map_err(|e| e.to_string())?;
    if meta.len() > MAX_TEXT_BYTES {
        return Err(format!(
            "file too large for text editor ({} bytes; max {})",
            meta.len(),
            MAX_TEXT_BYTES
        ));
    }
    std::fs::read_to_string(&full).map_err(|e| e.to_string())
}

/// Read a workspace file as base64 (PDF, Office, images, etc.).
#[tauri::command]
pub fn workspace_read_bytes(
    root: String,
    rel_path: Option<String>,
    path: Option<String>,
) -> Result<String, String> {
    use base64::Engine;
    let rel_path = pick_rel_path(rel_path, path)?;
    let root = PathBuf::from(&root)
        .canonicalize()
        .map_err(|e| e.to_string())?;
    let rel = safe_rel(&root, &rel_path)?;
    let full = root.join(rel);
    let meta = std::fs::metadata(&full).map_err(|e| e.to_string())?;
    if meta.len() > MAX_BINARY_BYTES {
        return Err(format!(
            "file too large for viewer ({} bytes; max {})",
            meta.len(),
            MAX_BINARY_BYTES
        ));
    }
    let bytes = std::fs::read(&full).map_err(|e| e.to_string())?;
    Ok(base64::engine::general_purpose::STANDARD.encode(bytes))
}

#[tauri::command]
pub fn workspace_write(
    root: String,
    content: String,
    rel_path: Option<String>,
    path: Option<String>,
) -> Result<(), String> {
    let rel_path = pick_rel_path(rel_path, path)?;
    let root = PathBuf::from(&root)
        .canonicalize()
        .map_err(|e| e.to_string())?;
    let rel = safe_rel(&root, &rel_path)?;
    let full = root.join(&rel);
    if let Some(parent) = full.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(&full, content).map_err(|e| e.to_string())?;
    Ok(())
}

/// Write a workspace file from base64 (SQLite DB, images, etc.).
#[tauri::command]
pub fn workspace_write_bytes(
    root: String,
    content_base64: String,
    rel_path: Option<String>,
    path: Option<String>,
) -> Result<(), String> {
    use base64::Engine;
    let rel_path = pick_rel_path(rel_path, path)?;
    let root = PathBuf::from(&root)
        .canonicalize()
        .map_err(|e| e.to_string())?;
    let rel = safe_rel(&root, &rel_path)?;
    let full = root.join(&rel);
    if let Some(parent) = full.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(content_base64.trim())
        .map_err(|e| format!("invalid base64: {e}"))?;
    if bytes.len() as u64 > MAX_BINARY_BYTES {
        return Err(format!(
            "file too large to write ({} bytes; max {})",
            bytes.len(),
            MAX_BINARY_BYTES
        ));
    }
    std::fs::write(&full, bytes).map_err(|e| e.to_string())?;
    Ok(())
}

/// Create a directory (and parents) inside the workspace.
#[tauri::command]
pub fn workspace_mkdir(
    root: String,
    rel_path: Option<String>,
    path: Option<String>,
) -> Result<(), String> {
    let rel_path = pick_rel_path(rel_path, path)?;
    let root = PathBuf::from(&root)
        .canonicalize()
        .map_err(|e| e.to_string())?;
    let rel = safe_rel(&root, &rel_path.trim_end_matches('/'))?;
    let full = root.join(&rel);
    std::fs::create_dir_all(&full).map_err(|e| e.to_string())
}

/// Rename/move a file or directory within the workspace.
#[tauri::command]
pub fn workspace_rename(
    root: String,
    from_rel: String,
    to_rel: String,
) -> Result<(), String> {
    let root = PathBuf::from(&root)
        .canonicalize()
        .map_err(|e| e.to_string())?;
    let from = safe_rel(&root, from_rel.trim_end_matches('/'))?;
    let to = safe_rel(&root, to_rel.trim_end_matches('/'))?;
    let from_full = root.join(&from);
    let to_full = root.join(&to);
    if !from_full.exists() {
        return Err(format!("not found: {}", from.display()));
    }
    if to_full.exists() {
        return Err(format!("already exists: {}", to.display()));
    }
    if let Some(parent) = to_full.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::rename(&from_full, &to_full).map_err(|e| e.to_string())
}

fn copy_recursive(from: &Path, to: &Path) -> Result<(), String> {
    let meta = std::fs::symlink_metadata(from).map_err(|e| e.to_string())?;
    if meta.is_dir() {
        std::fs::create_dir_all(to).map_err(|e| e.to_string())?;
        for entry in std::fs::read_dir(from).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            copy_recursive(&entry.path(), &to.join(entry.file_name()))?;
        }
    } else {
        if let Some(parent) = to.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        std::fs::copy(from, to).map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn uniquify_dest(dest: &Path) -> PathBuf {
    if !dest.exists() {
        return dest.to_path_buf();
    }
    let parent = dest.parent().unwrap_or_else(|| Path::new(""));
    let is_dir = dest.is_dir();
    let file_name = dest
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("copy");
    let (stem, ext) = if is_dir {
        (file_name.to_string(), None::<String>)
    } else {
        match dest.extension().and_then(|s| s.to_str()) {
            Some(e) => {
                let stem = dest
                    .file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or(file_name);
                (stem.to_string(), Some(e.to_string()))
            }
            None => (file_name.to_string(), None),
        }
    };
    for n in 1..=500 {
        let name = match (&ext, n) {
            (Some(e), 1) => format!("{stem} copy.{e}"),
            (Some(e), n) => format!("{stem} copy {n}.{e}"),
            (None, 1) => format!("{stem} copy"),
            (None, n) => format!("{stem} copy {n}"),
        };
        let candidate = parent.join(name);
        if !candidate.exists() {
            return candidate;
        }
    }
    dest.to_path_buf()
}

fn is_inside(parent: &Path, child: &Path) -> bool {
    let Ok(parent) = parent.canonicalize() else {
        return false;
    };
    let Ok(child) = child.canonicalize() else {
        return false;
    };
    child.starts_with(&parent)
}

/// Copy a file or directory into `to_dir_rel` (empty = workspace root).
/// Returns the relative path of the created item (may be uniquified).
#[tauri::command]
pub fn workspace_copy(
    from_root: String,
    from_rel: String,
    to_root: String,
    to_dir_rel: String,
) -> Result<String, String> {
    let from_root = PathBuf::from(&from_root)
        .canonicalize()
        .map_err(|e| e.to_string())?;
    let to_root = PathBuf::from(&to_root)
        .canonicalize()
        .map_err(|e| e.to_string())?;
    let from = safe_rel(&from_root, from_rel.trim_end_matches('/'))?;
    let from_full = from_root.join(&from);
    if !from_full.exists() {
        return Err(format!("not found: {}", from.display()));
    }
    let base = from
        .file_name()
        .ok_or_else(|| "cannot copy workspace root".to_string())?
        .to_string_lossy()
        .to_string();
    let to_dir = safe_rel(&to_root, to_dir_rel.trim_end_matches('/'))?;
    let to_dir_full = to_root.join(&to_dir);
    if !to_dir.as_os_str().is_empty() && !to_dir_full.is_dir() {
        return Err(format!("destination is not a directory: {}", to_dir.display()));
    }
    if from_full.is_dir() && is_inside(&from_full, &to_dir_full) {
        return Err("cannot copy a folder into itself".into());
    }
    let desired = if to_dir.as_os_str().is_empty() {
        to_root.join(&base)
    } else {
        to_dir_full.join(&base)
    };
    let dest = uniquify_dest(&desired);
    copy_recursive(&from_full, &dest)?;
    let rel = dest
        .strip_prefix(&to_root)
        .map_err(|_| "destination escaped workspace".to_string())?;
    Ok(rel.to_string_lossy().replace('\\', "/"))
}

/// Move a file or directory into `to_dir_rel` (empty = workspace root).
/// Same-root uses rename; cross-root copies then deletes. Returns new relative path.
#[tauri::command]
pub fn workspace_move(
    from_root: String,
    from_rel: String,
    to_root: String,
    to_dir_rel: String,
) -> Result<String, String> {
    let from_root_pb = PathBuf::from(&from_root)
        .canonicalize()
        .map_err(|e| e.to_string())?;
    let to_root_pb = PathBuf::from(&to_root)
        .canonicalize()
        .map_err(|e| e.to_string())?;
    let from = safe_rel(&from_root_pb, from_rel.trim_end_matches('/'))?;
    let from_full = from_root_pb.join(&from);
    if !from_full.exists() {
        return Err(format!("not found: {}", from.display()));
    }
    let base = from
        .file_name()
        .ok_or_else(|| "cannot move workspace root".to_string())?
        .to_string_lossy()
        .to_string();
    let to_dir = safe_rel(&to_root_pb, to_dir_rel.trim_end_matches('/'))?;
    let to_dir_full = to_root_pb.join(&to_dir);
    if !to_dir.as_os_str().is_empty() && !to_dir_full.is_dir() {
        return Err(format!("destination is not a directory: {}", to_dir.display()));
    }
    if from_full.is_dir() && is_inside(&from_full, &to_dir_full) {
        return Err("cannot move a folder into itself".into());
    }

    if from_root_pb == to_root_pb {
        let desired = if to_dir.as_os_str().is_empty() {
            to_root_pb.join(&base)
        } else {
            to_dir_full.join(&base)
        };
        // Moving onto itself
        if from_full.canonicalize().ok().as_ref() == desired.canonicalize().ok().as_ref() {
            return Ok(from.to_string_lossy().replace('\\', "/"));
        }
        let dest = if desired.exists() {
            uniquify_dest(&desired)
        } else {
            desired
        };
        if let Some(parent) = dest.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        std::fs::rename(&from_full, &dest).map_err(|e| e.to_string())?;
        let rel = dest
            .strip_prefix(&to_root_pb)
            .map_err(|_| "destination escaped workspace".to_string())?;
        return Ok(rel.to_string_lossy().replace('\\', "/"));
    }

    let created = workspace_copy(from_root, from_rel, to_root, to_dir_rel)?;
    if from_full.is_dir() {
        std::fs::remove_dir_all(&from_full).map_err(|e| e.to_string())?;
    } else {
        std::fs::remove_file(&from_full).map_err(|e| e.to_string())?;
    }
    Ok(created)
}

/// Delete a file or directory (recursive) inside the workspace.
#[tauri::command]
pub fn workspace_delete(
    root: String,
    rel_path: Option<String>,
    path: Option<String>,
) -> Result<(), String> {
    let rel_path = pick_rel_path(rel_path, path)?;
    let root = PathBuf::from(&root)
        .canonicalize()
        .map_err(|e| e.to_string())?;
    let rel = safe_rel(&root, rel_path.trim_end_matches('/'))?;
    let full = root.join(&rel);
    if !full.exists() {
        return Err(format!("not found: {}", rel.display()));
    }
    if full.is_dir() {
        std::fs::remove_dir_all(&full).map_err(|e| e.to_string())
    } else {
        std::fs::remove_file(&full).map_err(|e| e.to_string())
    }
}

/// Reveal a workspace path in the OS file manager (Finder / Explorer).
#[tauri::command]
pub fn workspace_reveal(
    root: String,
    rel_path: Option<String>,
    path: Option<String>,
) -> Result<(), String> {
    let rel_path = pick_rel_path(rel_path, path).unwrap_or_default();
    let root = PathBuf::from(&root)
        .canonicalize()
        .map_err(|e| e.to_string())?;
    let full = if rel_path.is_empty() || rel_path == "." {
        root.clone()
    } else {
        let rel = safe_rel(&root, rel_path.trim_end_matches('/'))?;
        root.join(rel)
    };
    if !full.exists() {
        return Err(format!("not found: {}", full.display()));
    }

    #[cfg(target_os = "macos")]
    {
        let status = Command::new("open")
            .args(["-R", &full.to_string_lossy()])
            .status()
            .map_err(|e| e.to_string())?;
        if !status.success() {
            return Err("open -R failed".into());
        }
        return Ok(());
    }
    #[cfg(target_os = "windows")]
    {
        let status = Command::new("explorer")
            .arg(format!("/select,{}", full.display()))
            .status()
            .map_err(|e| e.to_string())?;
        if !status.success() {
            return Err("explorer /select failed".into());
        }
        return Ok(());
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let parent = if full.is_dir() {
            full.clone()
        } else {
            full.parent().unwrap_or(&root).to_path_buf()
        };
        let status = Command::new("xdg-open")
            .arg(&parent)
            .status()
            .map_err(|e| e.to_string())?;
        if !status.success() {
            return Err("xdg-open failed".into());
        }
        Ok(())
    }
}

fn git_in(root: &Path, args: &[&str]) -> Result<String, String> {
    let out = Command::new("git")
        .arg("-C")
        .arg(root)
        .args(args)
        .output()
        .map_err(|e| e.to_string())?;
    let stdout = String::from_utf8_lossy(&out.stdout).to_string();
    let stderr = String::from_utf8_lossy(&out.stderr).to_string();
    if !out.status.success() {
        return Err(if stderr.is_empty() { stdout } else { stderr }.trim().to_string());
    }
    Ok(stdout)
}

#[tauri::command]
pub fn workspace_git_status(root: String) -> Result<Vec<String>, String> {
    let root = PathBuf::from(&root)
        .canonicalize()
        .map_err(|e| e.to_string())?;
    let text = git_in(&root, &["status", "--porcelain"])?;
    Ok(text
        .lines()
        .map(str::trim)
        .filter(|l| !l.is_empty())
        .map(String::from)
        .collect())
}

#[tauri::command]
pub fn workspace_git_stage_all(root: String) -> Result<String, String> {
    let root = PathBuf::from(&root)
        .canonicalize()
        .map_err(|e| e.to_string())?;
    git_in(&root, &["add", "-A"])?;
    Ok("staged".into())
}

#[tauri::command]
pub fn workspace_git_commit(root: String, message: String) -> Result<String, String> {
    let msg = message.trim();
    if msg.is_empty() {
        return Err("commit message required".into());
    }
    let root = PathBuf::from(&root)
        .canonicalize()
        .map_err(|e| e.to_string())?;
    git_in(&root, &["commit", "-m", msg])?;
    Ok("committed".into())
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitChangeRow {
    pub path: String,
    pub index: String,
    pub worktree: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitCommitRow {
    pub hash: String,
    pub short_hash: String,
    pub subject: String,
    pub author: String,
    pub relative_date: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitSnapshot {
    pub branch: String,
    pub upstream: Option<String>,
    pub ahead: u32,
    pub behind: u32,
    pub remote_url: Option<String>,
    pub local_branches: Vec<String>,
    pub changes: Vec<GitChangeRow>,
    pub commits: Vec<GitCommitRow>,
}

fn git_in_optional(root: &Path, args: &[&str]) -> Option<String> {
    git_in(root, args).ok().map(|s| s.trim().to_string()).filter(|s| !s.is_empty())
}

fn parse_porcelain_line(line: &str) -> Option<GitChangeRow> {
    let line = line.trim();
    if line.len() < 4 {
        return None;
    }
    let index = line.chars().next()?.to_string();
    let worktree = line.chars().nth(1)?.to_string();
    let rest = line.get(3..)?.trim();
    let path = if let Some((_left, right)) = rest.split_once(" -> ") {
        right.trim().to_string()
    } else {
        rest.to_string()
    };
    if path.is_empty() {
        return None;
    }
    Some(GitChangeRow {
        path,
        index,
        worktree,
    })
}

fn git_ahead_behind(root: &Path) -> (u32, u32) {
    let ahead = git_in_optional(root, &["rev-list", "--count", "@{u}..HEAD"])
        .and_then(|s| s.parse().ok())
        .unwrap_or(0);
    let behind = git_in_optional(root, &["rev-list", "--count", "HEAD..@{u}"])
        .and_then(|s| s.parse().ok())
        .unwrap_or(0);
    (ahead, behind)
}

#[tauri::command]
pub fn workspace_git_snapshot(root: String) -> Result<GitSnapshot, String> {
    let root = PathBuf::from(&root)
        .canonicalize()
        .map_err(|e| e.to_string())?;
    git_in(&root, &["rev-parse", "--git-dir"])?;

    let branch = git_in(&root, &["branch", "--show-current"])?
        .trim()
        .to_string();
    let branch = if branch.is_empty() {
        "HEAD".into()
    } else {
        branch
    };

    let upstream = git_in_optional(&root, &["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]);
    let (ahead, behind) = if upstream.is_some() {
        git_ahead_behind(&root)
    } else {
        (0, 0)
    };

    let remote_url = git_in_optional(&root, &["remote", "get-url", "origin"]);

    let porcelain = git_in(&root, &["status", "--porcelain"])?;
    let changes: Vec<GitChangeRow> = porcelain
        .lines()
        .filter_map(parse_porcelain_line)
        .collect();

    let log_raw = git_in(
        &root,
        &[
            "log",
            "-30",
            "--pretty=format:%H%x1f%h%x1f%s%x1f%an%x1f%cr",
        ],
    )
    .unwrap_or_default();
    let commits: Vec<GitCommitRow> = log_raw
        .lines()
        .filter_map(|line| {
            let parts: Vec<&str> = line.split('\x1f').collect();
            if parts.len() < 5 {
                return None;
            }
            Some(GitCommitRow {
                hash: parts[0].to_string(),
                short_hash: parts[1].to_string(),
                subject: parts[2].to_string(),
                author: parts[3].to_string(),
                relative_date: parts[4].to_string(),
            })
        })
        .collect();

    let local_branches: Vec<String> = git_in(
        &root,
        &["for-each-ref", "--format=%(refname:short)", "refs/heads/"],
    )
    .unwrap_or_default()
    .lines()
    .map(str::trim)
    .filter(|s| !s.is_empty())
    .map(String::from)
    .collect();

    Ok(GitSnapshot {
        branch,
        upstream,
        ahead,
        behind,
        remote_url,
        local_branches,
        changes,
        commits,
    })
}

#[tauri::command]
pub fn workspace_git_stage(root: String, rel_path: String) -> Result<(), String> {
    let root = PathBuf::from(&root)
        .canonicalize()
        .map_err(|e| e.to_string())?;
    let rel = rel_path.trim().trim_start_matches('/');
    if rel.is_empty() {
        return Err("empty path".into());
    }
    git_in(&root, &["add", "--", rel])?;
    Ok(())
}

#[tauri::command]
pub fn workspace_git_unstage(root: String, rel_path: String) -> Result<(), String> {
    let root = PathBuf::from(&root)
        .canonicalize()
        .map_err(|e| e.to_string())?;
    let rel = rel_path.trim().trim_start_matches('/');
    if rel.is_empty() {
        return Err("empty path".into());
    }
    git_in(&root, &["restore", "--staged", "--", rel])?;
    Ok(())
}

fn git_has_upstream(root: &Path) -> bool {
    git_in_optional(root, &["rev-parse", "--abbrev-ref", "@{u}"]).is_some()
}

#[tauri::command]
pub fn workspace_git_fetch(root: String) -> Result<String, String> {
    let root = PathBuf::from(&root)
        .canonicalize()
        .map_err(|e| e.to_string())?;
    git_in(&root, &["fetch", "--all", "--prune"])
}

#[tauri::command]
pub fn workspace_git_push(root: String, set_upstream: Option<bool>) -> Result<String, String> {
    let root = PathBuf::from(&root)
        .canonicalize()
        .map_err(|e| e.to_string())?;
    let force_upstream = set_upstream.unwrap_or(false);
    if force_upstream || !git_has_upstream(&root) {
        let branch = git_in(&root, &["branch", "--show-current"])?
            .trim()
            .to_string();
        if branch.is_empty() {
            return Err("detached HEAD — checkout a branch before push".into());
        }
        let remote = git_in_optional(&root, &["remote"])
            .and_then(|s| s.lines().next().map(|l| l.trim().to_string()))
            .unwrap_or_else(|| "origin".into());
        git_in(&root, &["push", "-u", &remote, &branch])
    } else {
        git_in(&root, &["push"])
    }
}

#[tauri::command]
pub fn workspace_git_pull(root: String, rebase: Option<bool>) -> Result<String, String> {
    let root = PathBuf::from(&root)
        .canonicalize()
        .map_err(|e| e.to_string())?;
    if rebase.unwrap_or(false) {
        git_in(&root, &["pull", "--rebase"])
    } else {
        git_in(&root, &["pull", "--ff-only"])
    }
}

#[tauri::command]
pub fn workspace_git_rebase(root: String, onto: Option<String>) -> Result<String, String> {
    let root = PathBuf::from(&root)
        .canonicalize()
        .map_err(|e| e.to_string())?;
    match onto {
        Some(ref target) if !target.trim().is_empty() => {
            git_in(&root, &["rebase", target.trim()])
        }
        _ => git_in(&root, &["rebase", "@{u}"]),
    }
}

#[tauri::command]
pub fn workspace_git_checkout(root: String, branch: String) -> Result<String, String> {
    let name = branch.trim();
    if name.is_empty() {
        return Err("branch name required".into());
    }
    let root = PathBuf::from(&root)
        .canonicalize()
        .map_err(|e| e.to_string())?;
    git_in(&root, &["checkout", name])
}

#[tauri::command]
pub fn workspace_git_create_branch(
    root: String,
    name: String,
    checkout: Option<bool>,
) -> Result<String, String> {
    let branch = name.trim();
    if branch.is_empty() {
        return Err("branch name required".into());
    }
    if branch.contains(['/', ' ', '\0']) {
        return Err("invalid branch name".into());
    }
    let root = PathBuf::from(&root)
        .canonicalize()
        .map_err(|e| e.to_string())?;
    if checkout.unwrap_or(true) {
        git_in(&root, &["checkout", "-b", branch])
    } else {
        git_in(&root, &["branch", branch])
    }
}

fn split_glob_list(raw: Option<String>) -> Vec<String> {
    raw.unwrap_or_default()
        .split(',')
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(String::from)
        .collect()
}

fn normalize_glob_pattern(raw: &str, for_exclude: bool) -> String {
    let g = raw.trim();
    if g.is_empty() {
        return String::new();
    }
    if g.starts_with("**/") {
        return g.to_string();
    }
    if g.contains('/') {
        return format!("**/{g}");
    }
    if g.contains('*') || g.contains('?') {
        return format!("**/{g}");
    }
    if for_exclude {
        format!("**/{g}/**")
    } else {
        format!("**/{g}")
    }
}

fn build_glob_set(patterns: &[String], for_exclude: bool) -> Result<Option<GlobSet>, String> {
    if patterns.is_empty() {
        return Ok(None);
    }
    let mut builder = GlobSetBuilder::new();
    for p in patterns {
        let norm = normalize_glob_pattern(p, for_exclude);
        if norm.is_empty() {
            continue;
        }
        builder.add(Glob::new(&norm).map_err(|e| e.to_string())?);
    }
    Ok(Some(builder.build().map_err(|e| e.to_string())?))
}

fn compile_search_regex(
    pattern: &str,
    regex_mode: bool,
    match_case: bool,
    whole_word: bool,
) -> Result<Regex, String> {
    let mut body = if regex_mode {
        pattern.to_string()
    } else {
        regex::escape(pattern)
    };
    if whole_word {
        body = format!(r"\b{body}\b");
    }
    RegexBuilder::new(&body)
        .case_insensitive(!match_case)
        .build()
        .map_err(|e| format!("invalid search pattern: {e}"))
}

fn rel_path_from_root(root: &Path, full: &Path) -> Result<String, String> {
    Ok(full
        .strip_prefix(root)
        .map_err(|e| e.to_string())?
        .to_string_lossy()
        .replace('\\', "/"))
}

fn path_allowed(rel: &str, includes: &Option<GlobSet>, excludes: &Option<GlobSet>) -> bool {
    if let Some(ex) = excludes {
        if ex.is_match(rel) {
            return false;
        }
    }
    if let Some(inc) = includes {
        return inc.is_match(rel);
    }
    true
}

fn search_files_native(
    workspace_root: &Path,
    search_root: &Path,
    re: &Regex,
    includes: &Option<GlobSet>,
    excludes: &Option<GlobSet>,
    out: &mut Vec<String>,
    max_total: u32,
) -> Result<(), String> {
    let mut stack = vec![search_root.to_path_buf()];
    let mut total = 0u32;

    while let Some(dir) = stack.pop() {
        if total >= max_total {
            break;
        }
        for entry in std::fs::read_dir(&dir).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let name = entry.file_name().to_string_lossy().to_string();
            let path = entry.path();
            if path.is_dir() {
                if should_skip_dir(&name) {
                    continue;
                }
                stack.push(path);
                continue;
            }
            if !path.is_file() {
                continue;
            }
            if should_skip_file(&name) {
                continue;
            }
            let meta = entry.metadata().map_err(|e| e.to_string())?;
            if meta.len() > MAX_TEXT_BYTES {
                continue;
            }
            let rel = rel_path_from_root(workspace_root, &path)?;
            if !path_allowed(&rel, includes, excludes) {
                continue;
            }
            let file = std::fs::File::open(&path).map_err(|e| e.to_string())?;
            let reader = BufReader::new(file);
            for (idx, line) in reader.lines().enumerate() {
                if total >= max_total {
                    return Ok(());
                }
                let line = line.map_err(|e| e.to_string())?;
                if re.is_match(&line) {
                    out.push(format!("{}:{}:{}", rel, idx + 1, line.trim()));
                    total += 1;
                }
            }
        }
    }
    Ok(())
}

fn find_rg_binary() -> Option<PathBuf> {
    if let Ok(custom) = std::env::var("OBJECTIV_RG_PATH") {
        let p = PathBuf::from(custom);
        if p.is_file() {
            return Some(p);
        }
    }
    for candidate in [
        "rg",
        "/opt/homebrew/bin/rg",
        "/usr/local/bin/rg",
        "/Applications/Cursor.app/Contents/Resources/app/node_modules/@vscode/ripgrep/bin/rg",
        "/Applications/Visual Studio Code.app/Contents/Resources/app/node_modules/@vscode/ripgrep/bin/rg",
    ] {
        let p = PathBuf::from(candidate);
        if Command::new(&p)
            .arg("--version")
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
        {
            return Some(p);
        }
    }
    None
}

fn workspace_search_rg(
    rg: &Path,
    workspace_root: &Path,
    search_root: &Path,
    pattern: &str,
    include_patterns: &[String],
    exclude_patterns: &[String],
    regex: Option<bool>,
    match_case: Option<bool>,
    whole_word: Option<bool>,
    max_results: Option<u32>,
) -> Result<Vec<String>, String> {
    let max_count = max_results.unwrap_or(500).clamp(1, 5000);
    let mut cmd = Command::new(rg);
    cmd.arg("--line-number")
        .arg("--max-count")
        .arg(max_count.to_string());

    if !match_case.unwrap_or(false) {
        cmd.arg("-i");
    }
    if whole_word.unwrap_or(false) {
        cmd.arg("-w");
    }
    if regex == Some(false) {
        cmd.arg("--fixed-strings");
    }

    for g in include_patterns {
        cmd.arg("--glob").arg(g.as_str());
    }
    for g in exclude_patterns {
        cmd.arg("--glob").arg(format!("!{g}"));
    }

    cmd.arg(pattern).arg(search_root);

    let out = cmd.output().map_err(|e| format!("rg: {e}"))?;
    let stdout = String::from_utf8_lossy(&out.stdout);
    let mut lines: Vec<String> = stdout
        .lines()
        .map(str::trim)
        .filter(|l| !l.is_empty())
        .map(String::from)
        .collect();

    // Normalize to workspace-relative paths for the UI.
    let root_s = workspace_root.to_string_lossy().replace('\\', "/");
    for line in &mut lines {
        if let Some((path, rest)) = line.split_once(':') {
            let path_norm = path.replace('\\', "/");
            if path_norm.starts_with(&root_s) {
                let rel = path_norm
                    .strip_prefix(&root_s)
                    .unwrap_or(&path_norm)
                    .trim_start_matches('/');
                *line = format!("{rel}:{rest}");
            }
        }
    }

    if lines.is_empty() && !out.status.success() {
        let stderr = String::from_utf8_lossy(&out.stderr);
        if stderr.contains("No files were searched") || stderr.is_empty() {
            return Ok(vec![]);
        }
        return Err(stderr.trim().to_string());
    }
    Ok(lines)
}

#[tauri::command]
pub fn workspace_search(
    root: String,
    pattern: String,
    glob: Option<String>,
    exclude_glob: Option<String>,
    folder: Option<String>,
    regex: Option<bool>,
    match_case: Option<bool>,
    whole_word: Option<bool>,
    max_results: Option<u32>,
) -> Result<Vec<String>, String> {
    let pattern = pattern.trim();
    if pattern.is_empty() {
        return Err("empty pattern".into());
    }
    let root = PathBuf::from(&root)
        .canonicalize()
        .map_err(|e| e.to_string())?;

    let search_root = if let Some(f) = folder.filter(|s| !s.trim().is_empty()) {
        safe_rel(&root, f.trim())?
    } else {
        root.clone()
    };
    if !search_root.is_dir() {
        return Err("search folder not found".into());
    }

    let max_count = max_results.unwrap_or(500).clamp(1, 5000);
    let include_patterns = split_glob_list(glob);
    let exclude_patterns = split_glob_list(exclude_glob);
    let include_set = build_glob_set(&include_patterns, false)?;
    let exclude_set = build_glob_set(&exclude_patterns, true)?;

    if let Some(rg) = find_rg_binary() {
        return workspace_search_rg(
            &rg,
            &root,
            &search_root,
            pattern,
            &include_patterns,
            &exclude_patterns,
            regex,
            match_case,
            whole_word,
            max_results,
        );
    }

    let re = compile_search_regex(
        pattern,
        regex.unwrap_or(false),
        match_case.unwrap_or(false),
        whole_word.unwrap_or(false),
    )?;
    let mut lines = Vec::new();
    search_files_native(
        &root,
        &search_root,
        &re,
        &include_set,
        &exclude_set,
        &mut lines,
        max_count,
    )?;
    Ok(lines)
}

#[tauri::command]
pub fn workspace_run_shell(root: String, command: String) -> Result<String, String> {
    if command.trim().is_empty() {
        return Err("empty command".into());
    }
    let blocked = ["rm -rf", "sudo", "mkfs", "dd if="];
    let lower = command.to_lowercase();
    if blocked.iter().any(|b| lower.contains(b)) {
        return Err("command blocked".into());
    }
    let root = PathBuf::from(&root)
        .canonicalize()
        .map_err(|e| e.to_string())?;
    let out = Command::new("bash")
        .arg("-lc")
        .arg(&command)
        .current_dir(&root)
        .output()
        .map_err(|e| e.to_string())?;
    let mut text = String::new();
    text.push_str(&String::from_utf8_lossy(&out.stdout));
    text.push_str(&String::from_utf8_lossy(&out.stderr));
    if text.is_empty() {
        text.push_str("(no output)\n");
    }
    if !out.status.success() {
        text.push_str(&format!("\n[exit {}]", out.status.code().unwrap_or(-1)));
    }
    Ok(text)
}

#[tauri::command]
pub fn user_home() -> Result<String, String> {
    std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map_err(|_| "cannot resolve home directory".to_string())
}

#[tauri::command]
pub fn path_is_dir(path: String) -> bool {
    PathBuf::from(path).is_dir()
}
