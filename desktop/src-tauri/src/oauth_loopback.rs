use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::AppHandle;

static LOOPBACK_RUNNING: AtomicBool = AtomicBool::new(false);
static LOOPBACK_PORT: Mutex<Option<u16>> = Mutex::new(None);

struct LoopbackGuard;
impl Drop for LoopbackGuard {
    fn drop(&mut self) {
        LOOPBACK_RUNNING.store(false, Ordering::SeqCst);
    }
}

fn write_http_response(stream: &mut TcpStream, status: &str, body: &str) {
    let bytes = body.as_bytes();
    let header = format!(
        "HTTP/1.1 {status}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
        bytes.len()
    );
    let _ = stream.write_all(header.as_bytes());
    let _ = stream.write_all(bytes);
}

fn handle_connection(stream: &mut TcpStream, port: u16, app: &AppHandle) -> bool {
    let mut buf = vec![0u8; 32_768];
    let n = match stream.read(&mut buf) {
        Ok(0) => return false,
        Ok(n) => n,
        Err(_) => return false,
    };
    let req = String::from_utf8_lossy(&buf[..n]);
    let first = match req.lines().next() {
        Some(line) => line,
        None => return false,
    };
    let mut parts = first.split_whitespace();
    if parts.next().unwrap_or("") != "GET" {
        write_http_response(stream, "405 Method Not Allowed", "Method not allowed");
        return false;
    }
    let path = parts.next().unwrap_or("/");
    let path_only = path.split('?').next().unwrap_or(path);
    let allowed = matches!(path_only, "/" | "/callback" | "/cb" | "/auth/callback");
    if !allowed {
        write_http_response(stream, "404 Not Found", "Not found");
        return false;
    }
    if !path.contains("access_token=") {
        write_http_response(stream, "400 Bad Request", "Missing tokens");
        return false;
    }

    let callback_url = format!("http://127.0.0.1:{port}{path}");
    super::deliver_objectiv_oauth_callback(app, &callback_url);

    let body = r#"<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>Objectiv</title></head>
<body style="font-family:system-ui,sans-serif;padding:2rem;text-align:center">
<p>Signed in. Return to Objectiv.</p>
<p>You can close this tab.</p>
</body></html>"#;
    write_http_response(stream, "200 OK", body);
    true
}

#[tauri::command]
pub fn start_objectiv_oauth_loopback(app: AppHandle) -> Result<u16, String> {
    if LOOPBACK_RUNNING.load(Ordering::SeqCst) {
        if let Ok(guard) = LOOPBACK_PORT.lock() {
            if let Some(port) = *guard {
                return Ok(port);
            }
        }
        return Err("oauth_loopback_busy".into());
    }
    LOOPBACK_RUNNING.store(true, Ordering::SeqCst);

    let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();
    if let Ok(mut guard) = LOOPBACK_PORT.lock() {
        *guard = Some(port);
    }
    listener.set_nonblocking(true).map_err(|e| e.to_string())?;

    std::thread::spawn(move || {
        let _guard = LoopbackGuard;
        let deadline = Instant::now() + Duration::from_secs(600);
        while Instant::now() < deadline {
            match listener.accept() {
                Ok((mut stream, _)) => {
                    if handle_connection(&mut stream, port, &app) {
                        break;
                    }
                }
                Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                    std::thread::sleep(Duration::from_millis(40));
                }
                Err(_) => break,
            }
        }
    });

    Ok(port)
}
