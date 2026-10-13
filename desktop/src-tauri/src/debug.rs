use std::collections::HashMap;
use std::process::{Command, Stdio};
use std::sync::Mutex;

use serde::Serialize;
use tauri::State;

pub struct DebugPool {
    sessions: Mutex<HashMap<String, DebugSession>>,
}

struct DebugSession {
    child: std::process::Child,
    inspect_port: u16,
}

#[derive(Serialize)]
pub struct DebugLaunchResult {
    pid: u32,
    inspect_port: u16,
    hint: String,
}

impl DebugPool {
    pub fn new() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
        }
    }
}

#[tauri::command]
pub fn debug_launch_node(
    pool: State<'_, std::sync::Arc<DebugPool>>,
    session_id: String,
    root: String,
    program: String,
    inspect_port: Option<u16>,
) -> Result<DebugLaunchResult, String> {
    let port = inspect_port.unwrap_or(9229);
    if program.trim().is_empty() {
        return Err("launch program is required".into());
    }
    let root = std::path::PathBuf::from(&root)
        .canonicalize()
        .map_err(|e| e.to_string())?;
    let program = program.trim();
    let mut child = Command::new("node");
    child
        .arg(format!("--inspect-brk={port}"))
        .arg(program)
        .current_dir(&root)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    let child = child.spawn().map_err(|e| format!("debug spawn: {e}"))?;
    let pid = child.id();
    pool.sessions.lock().map_err(|e| e.to_string())?.insert(
        session_id,
        DebugSession {
            child,
            inspect_port: port,
        },
    );
    Ok(DebugLaunchResult {
        pid,
        inspect_port: port,
        hint: format!(
            "Node paused on start (PID {pid}). Open chrome://inspect or resume in DevTools on port {port}."
        ),
    })
}

fn resolve_python(root: &std::path::Path) -> String {
    for rel in [
        ".venv/bin/python",
        ".venv/bin/python3",
        "venv/bin/python",
        "venv/bin/python3",
    ] {
        let p = root.join(rel);
        if p.is_file() {
            return p.to_string_lossy().to_string();
        }
    }
    "python3".into()
}

#[tauri::command]
pub fn debug_launch_python(
    pool: State<'_, std::sync::Arc<DebugPool>>,
    session_id: String,
    root: String,
    program: String,
    runtime_args: Option<Vec<String>>,
    args: Option<Vec<String>>,
    python: Option<String>,
    listen_port: Option<u16>,
) -> Result<DebugLaunchResult, String> {
    let port = listen_port.unwrap_or(5678);
    let root = std::path::PathBuf::from(&root)
        .canonicalize()
        .map_err(|e| e.to_string())?;
    let py_raw = python
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| resolve_python(&root));
    let py = {
        let p = std::path::PathBuf::from(&py_raw);
        if p.is_absolute() {
            py_raw
        } else if py_raw.contains('/') || py_raw.contains('\\') {
            root.join(p).to_string_lossy().to_string()
        } else {
            py_raw
        }
    };

    let runtime_args = runtime_args.unwrap_or_default();
    let args = args.unwrap_or_default();
    let program = program.trim().to_string();

    // debugpy listen/wait — attach from VS Code / debugpy client. Install hint on spawn fail.
    let mut child = Command::new(&py);
    child
        .arg("-m")
        .arg("debugpy")
        .arg("--listen")
        .arg(format!("127.0.0.1:{port}"))
        .arg("--wait-for-client");
    for a in &runtime_args {
        child.arg(a);
    }
    if !program.is_empty() {
        child.arg(&program);
    }
    for a in &args {
        child.arg(a);
    }
    child
        .current_dir(&root)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let child = child.spawn().map_err(|e| {
        format!(
            "debugpy spawn failed ({e}). Install with: {py} -m pip install debugpy"
        )
    })?;
    let pid = child.id();
    pool.sessions.lock().map_err(|e| e.to_string())?.insert(
        session_id,
        DebugSession {
            child,
            inspect_port: port,
        },
    );

    let target = if !program.is_empty() {
        program
    } else {
        runtime_args.join(" ")
    };
    Ok(DebugLaunchResult {
        pid,
        inspect_port: port,
        hint: format!(
            "Python waiting for debugger (PID {pid}, port {port}). Target: {target}. \
Attach with debugpy / VS Code Python debugger to 127.0.0.1:{port}. \
If attach fails, run: {py} -m pip install debugpy"
        ),
    })
}

#[tauri::command]
pub fn debug_stop(pool: State<'_, std::sync::Arc<DebugPool>>, session_id: String) -> Result<(), String> {
    let mut map = pool.sessions.lock().map_err(|e| e.to_string())?;
    if let Some(mut session) = map.remove(&session_id) {
        let _ = session.child.kill();
    }
    Ok(())
}
