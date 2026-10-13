use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read, Write};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;

use tauri::{AppHandle, Emitter, State};

pub struct LspPool {
    inner: Mutex<HashMap<String, LspSession>>,
}

struct LspSession {
    _child: Child,
    stdin: Arc<Mutex<std::process::ChildStdin>>,
}

impl LspPool {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(HashMap::new()),
        }
    }
}

fn read_lsp_message<R: BufRead>(reader: &mut R) -> Result<String, String> {
    let mut content_length: Option<usize> = None;
    loop {
        let mut line = String::new();
        reader
            .read_line(&mut line)
            .map_err(|e| format!("lsp read header: {e}"))?;
        let line = line.trim_end();
        if line.is_empty() {
            break;
        }
        if let Some(rest) = line.strip_prefix("Content-Length:") {
            content_length = Some(
                rest.trim()
                    .parse()
                    .map_err(|_| "invalid Content-Length".to_string())?,
            );
        }
    }
    let len = content_length.ok_or("missing Content-Length")?;
    let mut body = vec![0u8; len];
    reader
        .read_exact(&mut body)
        .map_err(|e| format!("lsp read body: {e}"))?;
    String::from_utf8(body).map_err(|e| format!("lsp utf8: {e}"))
}

fn write_lsp_message(stdin: &mut impl Write, body: &str) -> Result<(), String> {
    write!(
        stdin,
        "Content-Length: {}\r\n\r\n{}",
        body.as_bytes().len(),
        body
    )
    .map_err(|e| e.to_string())
}

fn spawn_server(root: &str, language: &str) -> Result<Child, String> {
    let mut cmd = match language {
        "typescript" | "javascript" => {
            let mut c = Command::new("npx");
            c.args(["-y", "typescript-language-server", "--stdio"]);
            c
        }
        "python" => {
            let mut c = Command::new("npx");
            c.args(["-y", "pyright", "langserver", "--stdio"]);
            c
        }
        other => return Err(format!("unsupported LSP language: {other}")),
    };
    cmd.current_dir(root)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null());
    cmd.spawn().map_err(|e| format!("spawn lsp: {e}"))
}

#[tauri::command]
pub fn lsp_start(
    app: AppHandle,
    pool: State<'_, Arc<LspPool>>,
    session_id: String,
    root: String,
    language: String,
) -> Result<(), String> {
    let mut map = pool.inner.lock().map_err(|e| e.to_string())?;
    if map.contains_key(&session_id) {
        return Ok(());
    }
    let mut child = spawn_server(&root, &language)?;
    let stdout = child
        .stdout
        .take()
        .ok_or("lsp stdout unavailable")?;
    let stdin = child
        .stdin
        .take()
        .ok_or("lsp stdin unavailable")?;
    let stdin = Arc::new(Mutex::new(stdin));
    let event = format!("lsp://{session_id}");
    let app_handle = app.clone();
    thread::spawn(move || {
        let mut reader = BufReader::new(stdout);
        loop {
            match read_lsp_message(&mut reader) {
                Ok(body) => {
                    let _ = app_handle.emit(&event, body);
                }
                Err(_) => break,
            }
        }
    });
    map.insert(
        session_id,
        LspSession {
            _child: child,
            stdin,
        },
    );
    Ok(())
}

#[tauri::command]
pub fn lsp_send(pool: State<'_, Arc<LspPool>>, session_id: String, message: String) -> Result<(), String> {
    let map = pool.inner.lock().map_err(|e| e.to_string())?;
    let session = map
        .get(&session_id)
        .ok_or_else(|| format!("unknown lsp session: {session_id}"))?;
    let mut stdin = session.stdin.lock().map_err(|e| e.to_string())?;
    write_lsp_message(&mut *stdin, &message)
}

#[tauri::command]
pub fn lsp_stop(pool: State<'_, Arc<LspPool>>, session_id: String) -> Result<(), String> {
    let mut map = pool.inner.lock().map_err(|e| e.to_string())?;
    if let Some(mut session) = map.remove(&session_id) {
        let _ = session._child.kill();
    }
    Ok(())
}
