//! Persistent Python kernel for Objectiv notebooks (JSON-lines protocol).

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::Mutex;

struct KernelProc {
    child: Child,
    stdin: ChildStdin,
    reader: BufReader<std::process::ChildStdout>,
}

pub struct NotebookKernelPool {
    inner: Mutex<HashMap<String, KernelProc>>,
}

impl NotebookKernelPool {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(HashMap::new()),
        }
    }
}

fn canonicalize_root(root: &str) -> Result<PathBuf, String> {
    PathBuf::from(root)
        .canonicalize()
        .map_err(|e| format!("workspace root: {e}"))
}

fn resolve_python(root: &Path) -> String {
    for rel in [
        ".venv/bin/python",
        ".venv/bin/python3",
        "vllm_venv/bin/python",
        "venv/bin/python3",
    ] {
        let p = root.join(rel);
        if p.is_file() {
            return p.to_string_lossy().to_string();
        }
    }
    "python3".into()
}

fn helper_script_path() -> Result<PathBuf, String> {
    // Dev: next to Cargo.toml (src-tauri/scripts/...)
    let candidates = [
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("scripts/objectiv_notebook_kernel.py"),
        PathBuf::from("scripts/objectiv_notebook_kernel.py"),
    ];
    for c in candidates {
        if c.is_file() {
            return Ok(c);
        }
    }
    Err("objectiv_notebook_kernel.py not found".into())
}

fn spawn_kernel(root: &Path) -> Result<KernelProc, String> {
    let python = resolve_python(root);
    let script = helper_script_path()?;
    let mut child = Command::new(&python)
        .arg("-u")
        .arg(&script)
        .current_dir(root)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("failed to start python kernel ({python}): {e}"))?;

    let stdin = child.stdin.take().ok_or("kernel stdin missing")?;
    let stdout = child.stdout.take().ok_or("kernel stdout missing")?;
    let mut proc = KernelProc {
        child,
        stdin,
        reader: BufReader::new(stdout),
    };

    // Warm ping
    let _ = request(&mut proc, &serde_json::json!({"op": "ping"}))?;
    Ok(proc)
}

fn request(proc: &mut KernelProc, msg: &Value) -> Result<Value, String> {
    let line = format!("{}\n", msg);
    proc.stdin
        .write_all(line.as_bytes())
        .map_err(|e| format!("kernel write: {e}"))?;
    proc.stdin.flush().map_err(|e| format!("kernel flush: {e}"))?;

    let mut response = String::new();
    loop {
        match proc.reader.read_line(&mut response) {
            Ok(0) => return Err("kernel exited".into()),
            Ok(_) => break,
            Err(e) if e.kind() == std::io::ErrorKind::Interrupted => continue,
            Err(e) => return Err(format!("kernel read: {e}")),
        }
    }
    serde_json::from_str(response.trim())
        .map_err(|e| format!("kernel bad response: {e} ({response})"))
}

fn with_kernel<F, T>(pool: &NotebookKernelPool, root: &str, f: F) -> Result<T, String>
where
    F: FnOnce(&mut KernelProc) -> Result<T, String>,
{
    let key = canonicalize_root(root)?.to_string_lossy().to_string();
    let mut map = pool.inner.lock().map_err(|_| "kernel lock poisoned")?;
    if !map.contains_key(&key) {
        let proc = spawn_kernel(Path::new(&key))?;
        map.insert(key.clone(), proc);
    }
    let proc = map.get_mut(&key).ok_or("kernel missing")?;
    match f(proc) {
        Ok(v) => Ok(v),
        Err(e) => {
            // Drop dead kernel so next call respawns
            if let Some(mut dead) = map.remove(&key) {
                let _ = dead.child.kill();
            }
            Err(e)
        }
    }
}

#[derive(Serialize, Deserialize)]
pub struct KernelExecResult {
    pub ok: bool,
    pub outputs: Value,
    pub execution_count: Option<i64>,
    pub error: Option<String>,
}

#[tauri::command]
pub fn notebook_kernel_ensure(
    pool: tauri::State<'_, std::sync::Arc<NotebookKernelPool>>,
    root: String,
) -> Result<String, String> {
    let key = canonicalize_root(&root)?.to_string_lossy().to_string();
    let mut map = pool.inner.lock().map_err(|_| "kernel lock poisoned")?;
    if !map.contains_key(&key) {
        let proc = spawn_kernel(Path::new(&key))?;
        map.insert(key.clone(), proc);
    }
    Ok(key)
}

#[tauri::command]
pub fn notebook_kernel_exec(
    pool: tauri::State<'_, std::sync::Arc<NotebookKernelPool>>,
    root: String,
    code: String,
) -> Result<KernelExecResult, String> {
    with_kernel(&pool, &root, |proc| {
        let resp = request(proc, &serde_json::json!({"op": "exec", "code": code}))?;
        Ok(KernelExecResult {
            ok: resp.get("ok").and_then(|v| v.as_bool()).unwrap_or(false),
            outputs: resp.get("outputs").cloned().unwrap_or(Value::Array(vec![])),
            execution_count: resp.get("execution_count").and_then(|v| v.as_i64()),
            error: resp
                .get("error")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
        })
    })
}

#[tauri::command]
pub fn notebook_kernel_interrupt(
    pool: tauri::State<'_, std::sync::Arc<NotebookKernelPool>>,
    root: String,
) -> Result<(), String> {
    // Line-oriented kernel can't soft-interrupt mid-exec; kill & respawn.
    notebook_kernel_restart(pool, root)
}

#[tauri::command]
pub fn notebook_kernel_restart(
    pool: tauri::State<'_, std::sync::Arc<NotebookKernelPool>>,
    root: String,
) -> Result<(), String> {
    let key = canonicalize_root(&root)?.to_string_lossy().to_string();
    let mut map = pool.inner.lock().map_err(|_| "kernel lock poisoned")?;
    if let Some(mut dead) = map.remove(&key) {
        let _ = dead.child.kill();
        let _ = dead.child.wait();
    }
    let proc = spawn_kernel(Path::new(&key))?;
    map.insert(key, proc);
    Ok(())
}

#[tauri::command]
pub fn notebook_kernel_shutdown(
    pool: tauri::State<'_, std::sync::Arc<NotebookKernelPool>>,
    root: String,
) -> Result<(), String> {
    let key = canonicalize_root(&root)?.to_string_lossy().to_string();
    let mut map = pool.inner.lock().map_err(|_| "kernel lock poisoned")?;
    if let Some(mut proc) = map.remove(&key) {
        let _ = request(&mut proc, &serde_json::json!({"op": "shutdown"}));
        let _ = proc.child.kill();
        let _ = proc.child.wait();
    }
    Ok(())
}
