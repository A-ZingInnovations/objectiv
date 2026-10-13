use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

use base64::Engine;
use serde::{Deserialize, Serialize};

#[derive(Serialize)]
pub struct AzingHttpResponse {
    pub status: u16,
    pub body: String,
}

fn objectiv_dir() -> Result<PathBuf, String> {
    let home = crate::workspace::user_home()?;
    Ok(PathBuf::from(home).join(".objectiv"))
}

fn session_path() -> Result<PathBuf, String> {
    Ok(objectiv_dir()?.join("azing-session.json"))
}

fn device_path() -> Result<PathBuf, String> {
    Ok(objectiv_dir()?.join("azing-device.json"))
}

#[tauri::command]
pub fn azing_session_read() -> Result<Option<String>, String> {
    let path = session_path()?;
    if !path.is_file() {
        return Ok(None);
    }
    fs::read_to_string(&path)
        .map(Some)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn azing_session_write(content: String) -> Result<(), String> {
    let dir = objectiv_dir()?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    fs::write(session_path()?, content.as_bytes()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn azing_session_clear() -> Result<(), String> {
    let path = session_path()?;
    if path.is_file() {
        fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn azing_device_read() -> Result<Option<String>, String> {
    let path = device_path()?;
    if !path.is_file() {
        return Ok(None);
    }
    fs::read_to_string(&path)
        .map(Some)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn azing_device_write(content: String) -> Result<(), String> {
    let dir = objectiv_dir()?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    fs::write(device_path()?, content.as_bytes()).map_err(|e| e.to_string())
}

/// HTTPS from the desktop shell (avoids webview CORS on Bearer API calls).
#[tauri::command]
pub fn azing_http_request(
    method: String,
    url: String,
    headers: Option<HashMap<String, String>>,
    body: Option<String>,
) -> Result<AzingHttpResponse, String> {
    let m = method.trim().to_uppercase();
    let mut req = match m.as_str() {
        "GET" => ureq::get(&url),
        "POST" => ureq::post(&url),
        "PUT" => ureq::put(&url),
        "DELETE" => ureq::delete(&url),
        "PATCH" => ureq::patch(&url),
        _ => return Err(format!("unsupported method: {m}")),
    };
    if let Some(map) = headers {
        for (k, v) in map {
            if !k.trim().is_empty() {
                req = req.set(k.trim(), v.trim());
            }
        }
    }
    let resp = if let Some(b) = body {
        req.send_string(&b).map_err(|e| e.to_string())?
    } else {
        req.call().map_err(|e| e.to_string())?
    };
    let status = resp.status();
    let body = resp.into_string().map_err(|e| e.to_string())?;
    Ok(AzingHttpResponse { status, body })
}

#[derive(Debug, Deserialize)]
pub struct FormFilePart {
    pub field: String,
    pub filename: String,
    pub content_base64: String,
    #[serde(default)]
    pub mime: Option<String>,
}

fn build_multipart_body(
    boundary: &str,
    fields: Option<&HashMap<String, String>>,
    files: Option<&[FormFilePart]>,
) -> Result<Vec<u8>, String> {
    let mut out = Vec::new();
    if let Some(map) = fields {
        for (k, v) in map {
            if k.trim().is_empty() {
                continue;
            }
            out.extend_from_slice(format!("--{boundary}\r\n").as_bytes());
            out.extend_from_slice(
                format!(
                    "Content-Disposition: form-data; name=\"{}\"\r\n\r\n",
                    k.trim()
                )
                .as_bytes(),
            );
            out.extend_from_slice(v.as_bytes());
            out.extend_from_slice(b"\r\n");
        }
    }
    if let Some(parts) = files {
        for part in parts {
            let bytes = base64::engine::general_purpose::STANDARD
                .decode(part.content_base64.trim())
                .map_err(|e| e.to_string())?;
            let mime = part
                .mime
                .as_deref()
                .filter(|m| !m.is_empty())
                .unwrap_or("application/octet-stream");
            out.extend_from_slice(format!("--{boundary}\r\n").as_bytes());
            out.extend_from_slice(
                format!(
                    "Content-Disposition: form-data; name=\"{}\"; filename=\"{}\"\r\n",
                    part.field.trim(),
                    part.filename.trim()
                )
                .as_bytes(),
            );
            out.extend_from_slice(format!("Content-Type: {mime}\r\n\r\n").as_bytes());
            out.extend_from_slice(&bytes);
            out.extend_from_slice(b"\r\n");
        }
    }
    out.extend_from_slice(format!("--{boundary}--\r\n").as_bytes());
    Ok(out)
}

#[tauri::command]
pub fn azing_http_multipart(
    url: String,
    headers: Option<HashMap<String, String>>,
    fields: Option<HashMap<String, String>>,
    files: Option<Vec<FormFilePart>>,
) -> Result<AzingHttpResponse, String> {
    let boundary = format!("objectiv-{}", uuid::Uuid::new_v4());
    let body = build_multipart_body(&boundary, fields.as_ref(), files.as_deref())?;
    let mut req = ureq::post(url.trim()).set(
        "Content-Type",
        &format!("multipart/form-data; boundary={boundary}"),
    );
    if let Some(map) = headers {
        for (k, v) in map {
            if !k.trim().is_empty() {
                req = req.set(k.trim(), v.trim());
            }
        }
    }
    let resp = req.send_bytes(&body).map_err(|e| e.to_string())?;
    let status = resp.status();
    let body = resp.into_string().map_err(|e| e.to_string())?;
    Ok(AzingHttpResponse { status, body })
}

#[derive(Serialize)]
pub struct AzingHttpBytesResponse {
    pub status: u16,
    pub body_base64: String,
}

#[tauri::command]
pub fn azing_http_get_bytes(
    url: String,
    headers: Option<HashMap<String, String>>,
) -> Result<AzingHttpBytesResponse, String> {
    let mut req = ureq::get(url.trim());
    if let Some(map) = headers {
        for (k, v) in map {
            if !k.trim().is_empty() {
                req = req.set(k.trim(), v.trim());
            }
        }
    }
    let resp = req.call().map_err(|e| e.to_string())?;
    let status = resp.status();
    let mut reader = resp.into_reader();
    let mut bytes = Vec::new();
    std::io::Read::read_to_end(&mut reader, &mut bytes).map_err(|e| e.to_string())?;
    let body_base64 = base64::engine::general_purpose::STANDARD.encode(bytes);
    Ok(AzingHttpBytesResponse { status, body_base64 })
}
