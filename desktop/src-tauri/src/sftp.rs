use std::collections::HashMap;
use std::fs;
use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Duration;

use serde::Serialize;
use ssh2::Session;
use tauri::State;
use uuid::Uuid;

pub struct SftpPool {
    inner: Mutex<HashMap<String, Session>>,
}

impl SftpPool {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(HashMap::new()),
        }
    }
}

#[derive(Clone, Serialize)]
pub struct FsEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
}

fn connect_session(
    host: &str,
    port: u16,
    user: &str,
    password: Option<&str>,
    key_path: Option<&str>,
) -> Result<Session, String> {
    let host = host.trim();
    let user = user.trim();
    if host.is_empty() || user.is_empty() {
        return Err("host and user are required".into());
    }
    let addr = format!("{host}:{port}");
    let tcp = TcpStream::connect(&addr).map_err(|e| format!("connect {addr}: {e}"))?;
    tcp.set_read_timeout(Some(Duration::from_secs(120)))
        .map_err(|e| e.to_string())?;
    tcp.set_write_timeout(Some(Duration::from_secs(120)))
        .map_err(|e| e.to_string())?;

    let mut sess = Session::new().map_err(|e| e.to_string())?;
    sess.set_tcp_stream(tcp);
    sess.handshake().map_err(|e| e.to_string())?;

    let key = key_path.map(|s| s.trim()).filter(|s| !s.is_empty());
    let pw = password.map(|s| s.trim()).filter(|s| !s.is_empty());

    if let Some(path) = key {
        let expanded = expand_tilde(path)?;
        sess.userauth_pubkey_file(user, None, Path::new(&expanded), None)
            .map_err(|e| format!("key auth: {e}"))?;
    } else if let Some(password) = pw {
        sess.userauth_password(user, password)
            .map_err(|e| format!("password auth: {e}"))?;
    } else {
        let _ = sess.userauth_agent(user);
    }

    if !sess.authenticated() {
        return Err("SSH authentication failed".into());
    }
    Ok(sess)
}

fn expand_tilde(path: &str) -> Result<String, String> {
    if path == "~" {
        return crate::workspace::user_home();
    }
    if let Some(rest) = path.strip_prefix("~/") {
        let home = crate::workspace::user_home()?;
        return Ok(format!("{home}/{rest}"));
    }
    Ok(path.to_string())
}

fn lock_sessions<'a>(
    pool: &'a SftpPool,
) -> Result<std::sync::MutexGuard<'a, HashMap<String, Session>>, String> {
    pool.inner
        .lock()
        .map_err(|_| "SFTP session lock poisoned".to_string())
}

fn with_session<F, T>(pool: &SftpPool, session_id: &str, f: F) -> Result<T, String>
where
    F: FnOnce(&Session) -> Result<T, String>,
{
    let guard = lock_sessions(pool)?;
    let sess = guard
        .get(session_id)
        .ok_or_else(|| "SFTP session not connected".to_string())?;
    f(sess)
}

fn normalize_remote_path(path: &str) -> String {
    let t = path.trim();
    if t.is_empty() || t == "." {
        return ".".to_string();
    }
    if t.starts_with('/') {
        t.to_string()
    } else {
        format!("/{t}")
    }
}

fn entry_name(path: &Path) -> String {
    path.file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_string()
}

#[tauri::command]
pub fn sftp_connect(
    pool: State<'_, std::sync::Arc<SftpPool>>,
    host: String,
    port: Option<u16>,
    user: String,
    password: Option<String>,
    key_path: Option<String>,
) -> Result<String, String> {
    let port = port.unwrap_or(22);
    let sess = connect_session(
        &host,
        port,
        &user,
        password.as_deref(),
        key_path.as_deref(),
    )?;
    let id = Uuid::new_v4().to_string();
    let mut guard = lock_sessions(&pool)?;
    guard.insert(id.clone(), sess);
    Ok(id)
}

#[tauri::command]
pub fn sftp_disconnect(
    pool: State<'_, std::sync::Arc<SftpPool>>,
    session_id: String,
) -> Result<(), String> {
    let mut guard = lock_sessions(&pool)?;
    guard.remove(&session_id);
    Ok(())
}

#[tauri::command]
pub fn sftp_list(
    pool: State<'_, std::sync::Arc<SftpPool>>,
    session_id: String,
    remote_path: String,
) -> Result<Vec<FsEntry>, String> {
    let remote = normalize_remote_path(&remote_path);
    with_session(&pool, &session_id, |sess| {
        let sftp = sess.sftp().map_err(|e| e.to_string())?;
        let path = Path::new(&remote);
        let read = sftp.readdir(path).map_err(|e| e.to_string())?;
        let mut out: Vec<FsEntry> = read
            .into_iter()
            .filter_map(|(p, stat)| {
                let name = entry_name(&p);
                if name.is_empty() || name == "." || name == ".." {
                    return None;
                }
                let full = if remote == "." {
                    name.clone()
                } else if remote.ends_with('/') {
                    format!("{remote}{name}")
                } else {
                    format!("{remote}/{name}")
                };
                Some(FsEntry {
                    name,
                    path: full,
                    is_dir: stat.is_dir(),
                    size: stat.size.unwrap_or(0) as u64,
                })
            })
            .collect();
        out.sort_by(|a, b| b.is_dir.cmp(&a.is_dir).then(a.name.to_lowercase().cmp(&b.name.to_lowercase())));
        Ok(out)
    })
}

#[tauri::command]
pub fn sftp_upload(
    pool: State<'_, std::sync::Arc<SftpPool>>,
    session_id: String,
    local_path: String,
    remote_path: String,
) -> Result<(), String> {
    let local = PathBuf::from(local_path.trim());
    let meta = fs::metadata(&local).map_err(|e| e.to_string())?;
    if meta.is_dir() {
        return Err("upload one file at a time (not directories)".into());
    }
    let remote = normalize_remote_path(&remote_path);
    with_session(&pool, &session_id, |sess| {
        let sftp = sess.sftp().map_err(|e| e.to_string())?;
        let mut local_file = fs::File::open(&local).map_err(|e| e.to_string())?;
        let mut remote_file = sftp
            .create(Path::new(&remote))
            .map_err(|e| e.to_string())?;
        std::io::copy(&mut local_file, &mut remote_file).map_err(|e| e.to_string())?;
        Ok(())
    })
}

#[tauri::command]
pub fn sftp_download(
    pool: State<'_, std::sync::Arc<SftpPool>>,
    session_id: String,
    remote_path: String,
    local_path: String,
) -> Result<(), String> {
    let remote = normalize_remote_path(&remote_path);
    let local = PathBuf::from(local_path.trim());
    if let Some(parent) = local.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    with_session(&pool, &session_id, |sess| {
        let sftp = sess.sftp().map_err(|e| e.to_string())?;
        let mut remote_file = sftp.open(Path::new(&remote)).map_err(|e| e.to_string())?;
        let mut local_file = fs::File::create(&local).map_err(|e| e.to_string())?;
        std::io::copy(&mut remote_file, &mut local_file).map_err(|e| e.to_string())?;
        Ok(())
    })
}

#[tauri::command]
pub fn sftp_local_list_dir(path: String) -> Result<Vec<FsEntry>, String> {
    let p = PathBuf::from(path.trim());
    if !p.is_dir() {
        return Err("not a directory".into());
    }
    let mut out = Vec::new();
    for ent in fs::read_dir(&p).map_err(|e| e.to_string())? {
        let ent = ent.map_err(|e| e.to_string())?;
        let meta = ent.metadata().map_err(|e| e.to_string())?;
        let name = ent.file_name().to_string_lossy().into_owned();
        if name == "." || name == ".." {
            continue;
        }
        out.push(FsEntry {
            path: ent.path().to_string_lossy().into_owned(),
            name,
            is_dir: meta.is_dir(),
            size: meta.len(),
        });
    }
    out.sort_by(|a, b| b.is_dir.cmp(&a.is_dir).then(a.name.to_lowercase().cmp(&b.name.to_lowercase())));
    Ok(out)
}
