//! Recursive workspace filesystem watch → frontend explorer refresh.

use notify::{Config, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, State};

const EVENT: &str = "objectiv-workspace-changed";
const DEBOUNCE_MS: u64 = 200;

pub struct WorkspaceWatchPool {
    inner: Mutex<WatchInner>,
}

struct WatchInner {
    watchers: HashMap<String, RecommendedWatcher>,
    last_emit: Instant,
}

impl WorkspaceWatchPool {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(WatchInner {
                watchers: HashMap::new(),
                last_emit: Instant::now()
                    .checked_sub(Duration::from_secs(10))
                    .unwrap_or_else(Instant::now),
            }),
        }
    }
}

fn should_ignore(path: &std::path::Path) -> bool {
    for comp in path.components() {
        let name = comp.as_os_str().to_string_lossy();
        if name == "node_modules"
            || name == ".git"
            || name == "target"
            || name == "dist"
            || name == "__pycache__"
            || name == ".venv"
            || name == "vllm_venv"
            || name == ".venv-objective"
        {
            return true;
        }
    }
    false
}

fn emit_changed(app: &AppHandle, pool: &WorkspaceWatchPool, root: &str) {
    let mut guard = match pool.inner.lock() {
        Ok(g) => g,
        Err(_) => return,
    };
    let now = Instant::now();
    if now.duration_since(guard.last_emit) < Duration::from_millis(DEBOUNCE_MS) {
        return;
    }
    guard.last_emit = now;
    drop(guard);
    let _ = app.emit(
        EVENT,
        serde_json::json!({
            "root": root,
            "reason": "fs",
        }),
    );
}

/// Start/stop recursive watchers so they match the open workspace roots.
#[tauri::command]
pub fn workspace_watch_sync(
    app: AppHandle,
    pool: State<'_, Arc<WorkspaceWatchPool>>,
    roots: Vec<String>,
) -> Result<(), String> {
    let pool_arc = Arc::clone(&pool);

    let mut wanted: HashMap<String, PathBuf> = HashMap::new();
    for root in &roots {
        let path = PathBuf::from(root)
            .canonicalize()
            .map_err(|e| format!("watch root {root}: {e}"))?;
        wanted.insert(path.to_string_lossy().to_string(), path);
    }

    let mut guard = pool_arc.inner.lock().map_err(|_| "watch lock poisoned")?;

    let existing: Vec<String> = guard.watchers.keys().cloned().collect();
    for key in existing {
        if !wanted.contains_key(&key) {
            guard.watchers.remove(&key);
        }
    }

    for (key, path) in wanted {
        if guard.watchers.contains_key(&key) {
            continue;
        }
        let app_h = app.clone();
        let pool_h = Arc::clone(&pool_arc);
        let root_key = key.clone();
        let mut watcher =
            notify::recommended_watcher(move |res: Result<notify::Event, notify::Error>| {
                let Ok(event) = res else {
                    return;
                };
                match event.kind {
                    EventKind::Create(_)
                    | EventKind::Remove(_)
                    | EventKind::Modify(_)
                    | EventKind::Any => {}
                    _ => return,
                }
                if !event.paths.is_empty() && event.paths.iter().all(|p| should_ignore(p)) {
                    return;
                }
                emit_changed(&app_h, &pool_h, &root_key);
            })
            .map_err(|e| format!("create watcher: {e}"))?;

        let _ = watcher.configure(Config::default().with_poll_interval(Duration::from_secs(2)));
        watcher
            .watch(&path, RecursiveMode::Recursive)
            .map_err(|e| format!("watch {}: {e}", path.display()))?;
        guard.watchers.insert(key, watcher);
    }
    Ok(())
}

/// Emit a change event (e.g. after Objectiv writes a file itself).
#[tauri::command]
pub fn workspace_watch_ping(app: AppHandle, root: String) -> Result<(), String> {
    let _ = app.emit(
        EVENT,
        serde_json::json!({
            "root": root,
            "reason": "ping",
        }),
    );
    Ok(())
}
