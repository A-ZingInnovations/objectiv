use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde::Serialize;
use tauri::State;

pub struct OpenVsCodePool {
    inner: Mutex<Option<OpenVsCodeSession>>,
}

struct OpenVsCodeSession {
    child: Child,
    url: String,
}

#[derive(Serialize)]
pub struct OpenVsCodeStatus {
    running: bool,
    url: Option<String>,
}

impl OpenVsCodePool {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(None),
        }
    }
}

fn home_dir() -> Result<PathBuf, String> {
    std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map(PathBuf::from)
        .map_err(|_| "cannot resolve home directory".to_string())
}

fn resolve_openvscode_bin() -> Result<PathBuf, String> {
    if let Ok(p) = std::env::var("OBJECTIV_OPENVSCODE_SERVER") {
        let path = PathBuf::from(p);
        if path.is_file() {
            return Ok(path);
        }
        return Err(format!("OBJECTIV_OPENVSCODE_SERVER not found: {}", path.display()));
    }
    let home = home_dir()?;
    let root = home.join(".objectiv/openvscode-server/current/bin");
    #[cfg(windows)]
    {
        let exe = root.join("openvscode-server.exe");
        if exe.is_file() {
            return Ok(exe);
        }
    }
    #[cfg(not(windows))]
    {
        let bin = root.join("openvscode-server");
        if bin.is_file() {
            return Ok(bin);
        }
    }
    #[cfg(target_os = "macos")]
    {
        return Err(
            "OpenVSCode Server not installed. On macOS it runs via Docker — start Docker Desktop, then run: bash scripts/install-openvscode-server.sh"
                .into(),
        );
    }
    #[cfg(not(target_os = "macos"))]
    {
        Err(
            "OpenVSCode Server not installed. Run: bash scripts/install-openvscode-server.sh"
                .into(),
        )
    }
}

fn wait_for_port(host: &str, port: u16, timeout: Duration) -> Result<(), String> {
    let deadline = Instant::now() + timeout;
    let addr = format!("{host}:{port}");
    loop {
        if TcpStream::connect(&addr).is_ok() {
            return Ok(());
        }
        if Instant::now() >= deadline {
            return Err(format!("OpenVSCode Server did not listen on {addr} in time"));
        }
        std::thread::sleep(Duration::from_millis(250));
    }
}

#[tauri::command]
pub fn openvscode_start(
    pool: State<'_, std::sync::Arc<OpenVsCodePool>>,
    root: String,
    port: Option<u16>,
) -> Result<String, String> {
    let port = port.unwrap_or(9888);
    let root = PathBuf::from(&root)
        .canonicalize()
        .map_err(|e| format!("workspace root: {e}"))?;
    if !root.is_dir() {
        return Err("workspace root is not a directory".into());
    }

    {
        let mut guard = pool.inner.lock().map_err(|e| e.to_string())?;
        if let Some(mut session) = guard.take() {
            let _ = session.child.kill();
        }
    }

    let bin = resolve_openvscode_bin()?;
    let child = Command::new(&bin)
        .arg("--host")
        .arg("127.0.0.1")
        .arg("--port")
        .arg(port.to_string())
        .arg("--without-connection-token")
        .arg("--accept-server-license-terms")
        .arg("--default-folder")
        .arg(root.as_os_str())
        .current_dir(&root)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("spawn OpenVSCode: {e}"))?;

    wait_for_port("127.0.0.1", port, Duration::from_secs(90))?;

    let url = format!("http://127.0.0.1:{port}/");
    let mut guard = pool.inner.lock().map_err(|e| e.to_string())?;
    *guard = Some(OpenVsCodeSession { child, url: url.clone() });
    Ok(url)
}

#[tauri::command]
pub fn openvscode_stop(pool: State<'_, std::sync::Arc<OpenVsCodePool>>) -> Result<(), String> {
    let mut guard = pool.inner.lock().map_err(|e| e.to_string())?;
    if let Some(mut session) = guard.take() {
        let _ = session.child.kill();
    }
    Ok(())
}

#[tauri::command]
pub fn openvscode_status(pool: State<'_, std::sync::Arc<OpenVsCodePool>>) -> Result<OpenVsCodeStatus, String> {
    let guard = pool.inner.lock().map_err(|e| e.to_string())?;
    if let Some(session) = guard.as_ref() {
        Ok(OpenVsCodeStatus {
            running: true,
            url: Some(session.url.clone()),
        })
    } else {
        Ok(OpenVsCodeStatus {
            running: false,
            url: None,
        })
    }
}

#[allow(dead_code)]
fn _server_data_hint(_root: &Path) -> Option<PathBuf> {
    home_dir()
        .ok()
        .map(|h| h.join(".objectiv/openvscode-server-data"))
}
