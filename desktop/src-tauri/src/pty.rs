use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, State};

static NEXT_PTY_ID: AtomicU64 = AtomicU64::new(1);

struct LivePty {
    writer: Mutex<Box<dyn Write + Send>>,
    master: Box<dyn MasterPty + Send>,
    child: Mutex<Box<dyn Child + Send + Sync>>,
}

pub struct PtySessions {
    sessions: Mutex<HashMap<String, LivePty>>,
}

impl PtySessions {
    pub fn new() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
        }
    }
}

fn resolve_shell(shell: Option<String>) -> String {
    if let Some(s) = shell.map(|s| s.trim().to_string()).filter(|s| !s.is_empty()) {
        return s;
    }
    std::env::var("SHELL").unwrap_or_else(|_| {
        if cfg!(target_os = "windows") {
            "powershell.exe".into()
        } else {
            "/bin/bash".into()
        }
    })
}

#[tauri::command]
pub fn pty_spawn(
    app: AppHandle,
    state: State<'_, Arc<PtySessions>>,
    root: String,
    session_id: Option<String>,
    shell: Option<String>,
) -> Result<String, String> {
    let id = session_id
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| format!("pty-{}", NEXT_PTY_ID.fetch_add(1, Ordering::Relaxed)));
    let shell_path = resolve_shell(shell);

    // Replace existing session with same id.
    {
        let mut map = state.sessions.lock().map_err(|e| e.to_string())?;
        if let Some(old) = map.remove(&id) {
            let _ = old.child.lock().map(|mut c| c.kill());
        }
    }

    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows: 24,
            cols: 80,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;

    let mut cmd = CommandBuilder::new(&shell_path);
    cmd.cwd(&root);
    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");

    let child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
    drop(pair.slave);

    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;
    let master = pair.master;

    {
        let mut map = state.sessions.lock().map_err(|e| e.to_string())?;
        map.insert(
            id.clone(),
            LivePty {
                writer: Mutex::new(writer),
                master,
                child: Mutex::new(child),
            },
        );
    }

    let emit_id = id.clone();
    let app_clone = app.clone();
    let state_clone = Arc::clone(&state);
    std::thread::spawn(move || {
        let mut buf = [0u8; 8192];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let chunk = String::from_utf8_lossy(&buf[..n]).to_string();
                    let _ = app_clone.emit(
                        "pty-output",
                        serde_json::json!({ "id": emit_id, "data": chunk }),
                    );
                }
                Err(_) => break,
            }
        }
        if let Ok(mut map) = state_clone.sessions.lock() {
            if let Some(sess) = map.get(&emit_id) {
                let _ = sess.child.lock().map(|mut c| {
                    let _ = c.wait();
                });
            }
            map.remove(&emit_id);
        }
        let _ = app_clone.emit("pty-exit", serde_json::json!({ "id": emit_id }));
    });

    Ok(id)
}

#[tauri::command]
pub fn pty_write(state: State<'_, Arc<PtySessions>>, id: String, data: String) -> Result<(), String> {
    let map = state.sessions.lock().map_err(|e| e.to_string())?;
    let sess = map.get(&id).ok_or("pty session not found")?;
    let mut w = sess.writer.lock().map_err(|e| e.to_string())?;
    w.write_all(data.as_bytes()).map_err(|e| e.to_string())?;
    w.flush().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn pty_resize(
    state: State<'_, Arc<PtySessions>>,
    id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let map = state.sessions.lock().map_err(|e| e.to_string())?;
    let sess = map.get(&id).ok_or("pty session not found")?;
    sess.master
        .resize(PtySize {
            rows: rows.max(1),
            cols: cols.max(1),
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn pty_kill(state: State<'_, Arc<PtySessions>>, id: String) -> Result<(), String> {
    let mut map = state.sessions.lock().map_err(|e| e.to_string())?;
    if let Some(sess) = map.remove(&id) {
        let _ = sess.child.lock().map(|mut c| c.kill());
    }
    Ok(())
}
