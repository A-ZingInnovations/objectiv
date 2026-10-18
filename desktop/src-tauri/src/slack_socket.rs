use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tungstenite::{connect, Message};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SlackSocketEvent {
    pub kind: String,
    pub team_id: String,
    pub channel_id: String,
    pub ts: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reaction: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SlackSocketStatus {
    connected: bool,
    detail: String,
}

pub struct SlackSocketService {
    inner: Mutex<Inner>,
}

struct Inner {
    stop: Arc<AtomicBool>,
    handle: Option<JoinHandle<()>>,
}

impl SlackSocketService {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(Inner {
                stop: Arc::new(AtomicBool::new(true)),
                handle: None,
            }),
        }
    }

    fn stop_locked(inner: &mut Inner) {
        inner.stop.store(true, Ordering::SeqCst);
        if let Some(h) = inner.handle.take() {
            let _ = h.join();
        }
    }

    pub fn stop(&self) {
        let mut inner = self.inner.lock().expect("slack socket lock");
        Self::stop_locked(&mut inner);
    }

    pub fn start(&self, app: AppHandle, app_token: String) -> Result<(), String> {
        let token = app_token.trim();
        if token.is_empty() {
            return Err("Missing Slack app token (xapp-…) for Socket Mode".into());
        }
        if !token.starts_with("xapp-") {
            return Err("Slack app token must start with xapp-".into());
        }

        let mut inner = self.inner.lock().expect("slack socket lock");
        Self::stop_locked(&mut inner);

        let stop = Arc::new(AtomicBool::new(false));
        inner.stop = stop.clone();
        let token = token.to_string();
        let handle = thread::spawn(move || socket_loop(app, token, stop));
        inner.handle = Some(handle);
        Ok(())
    }

    pub fn is_running(&self) -> bool {
        let inner = self.inner.lock().expect("slack socket lock");
        inner.handle.is_some() && !inner.stop.load(Ordering::SeqCst)
    }
}

fn emit_status(app: &AppHandle, connected: bool, detail: impl Into<String>) {
    let payload = SlackSocketStatus {
        connected,
        detail: detail.into(),
    };
    let _ = app.emit("slack-socket-status", payload);
}

fn emit_event(app: &AppHandle, event: SlackSocketEvent) {
    let _ = app.emit("slack-socket-event", event);
}

#[derive(Debug, Deserialize)]
struct ConnectionsOpenResponse {
    ok: bool,
    error: Option<String>,
    url: Option<String>,
}

fn connections_open(app_token: &str) -> Result<String, String> {
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;
    let resp = client
        .post("https://slack.com/api/apps.connections.open")
        .header("Authorization", format!("Bearer {app_token}"))
        .header("Content-Type", "application/x-www-form-urlencoded")
        .send()
        .map_err(|e| e.to_string())?;
    let body: ConnectionsOpenResponse = resp.json().map_err(|e| e.to_string())?;
    if !body.ok {
        return Err(body
            .error
            .unwrap_or_else(|| "apps.connections.open failed".into()));
    }
    body.url
        .filter(|u| !u.is_empty())
        .ok_or_else(|| "apps.connections.open missing url".into())
}

#[derive(Debug, Deserialize)]
struct SocketEnvelope {
    #[serde(rename = "type")]
    envelope_type: String,
    envelope_id: Option<String>,
    payload: Option<serde_json::Value>,
}

fn ack(ws: &mut tungstenite::WebSocket<tungstenite::stream::MaybeTlsStream<std::net::TcpStream>>, envelope_id: &str) {
    let body = serde_json::json!({ "envelope_id": envelope_id });
    let _ = ws.send(Message::Text(body.to_string()));
}

fn str_field(v: &serde_json::Value, key: &str) -> Option<String> {
    v.get(key).and_then(|x| x.as_str()).map(|s| s.to_string())
}

fn parse_events_api(app: &AppHandle, payload: &serde_json::Value) {
    let team_id = str_field(payload, "team_id").unwrap_or_default();
    let event = match payload.get("event") {
        Some(e) => e,
        None => return,
    };
    let event_type = event
        .get("type")
        .and_then(|t| t.as_str())
        .unwrap_or("")
        .to_string();

    match event_type.as_str() {
        "message" => {
            if event.get("subtype").and_then(|s| s.as_str()) == Some("message_changed") {
                return;
            }
            let channel_id = str_field(event, "channel").unwrap_or_default();
            let ts = str_field(event, "ts").unwrap_or_default();
            if channel_id.is_empty() || ts.is_empty() {
                return;
            }
            emit_event(
                app,
                SlackSocketEvent {
                    kind: "message".into(),
                    team_id,
                    channel_id,
                    ts,
                    user_id: str_field(event, "user"),
                    text: str_field(event, "text"),
                    reaction: None,
                },
            );
        }
        "message_changed" => {
            let channel_id = str_field(event, "channel").unwrap_or_default();
            let msg = event.get("message").unwrap_or(event);
            let ts = str_field(msg, "ts").unwrap_or_default();
            if channel_id.is_empty() || ts.is_empty() {
                return;
            }
            emit_event(
                app,
                SlackSocketEvent {
                    kind: "message_changed".into(),
                    team_id,
                    channel_id,
                    ts,
                    user_id: str_field(msg, "user"),
                    text: str_field(msg, "text"),
                    reaction: None,
                },
            );
        }
        "reaction_added" | "reaction_removed" => {
            let item = match event.get("item") {
                Some(i) => i,
                None => return,
            };
            if item.get("type").and_then(|t| t.as_str()) != Some("message") {
                return;
            }
            let channel_id = str_field(item, "channel").unwrap_or_default();
            let ts = str_field(item, "ts").unwrap_or_default();
            if channel_id.is_empty() || ts.is_empty() {
                return;
            }
            emit_event(
                app,
                SlackSocketEvent {
                    kind: event_type,
                    team_id,
                    channel_id,
                    ts,
                    user_id: str_field(event, "user"),
                    text: None,
                    reaction: str_field(event, "reaction"),
                },
            );
        }
        _ => {}
    }
}

fn handle_envelope(app: &AppHandle, ws: &mut tungstenite::WebSocket<tungstenite::stream::MaybeTlsStream<std::net::TcpStream>>, raw: &str) {
    let envelope: SocketEnvelope = match serde_json::from_str(raw) {
        Ok(v) => v,
        Err(_) => return,
    };

    if let Some(id) = envelope.envelope_id.as_deref() {
        ack(ws, id);
    }

    match envelope.envelope_type.as_str() {
        "hello" => emit_status(app, true, "Socket Mode connected"),
        "disconnect" => emit_status(app, false, "Socket Mode disconnected"),
        "events_api" => {
            if let Some(payload) = envelope.payload {
                parse_events_api(app, &payload);
            }
        }
        _ => {}
    }
}

fn socket_session(app: &AppHandle, app_token: &str, stop: &Arc<AtomicBool>) -> Result<(), String> {
    let url = connections_open(app_token)?;
    let (mut ws, _) = connect(url).map_err(|e| e.to_string())?;

    emit_status(app, true, "Socket Mode live");

    while !stop.load(Ordering::SeqCst) {
        match ws.read() {
            Ok(Message::Text(text)) => handle_envelope(app, &mut ws, &text),
            Ok(Message::Ping(data)) => {
                let _ = ws.send(Message::Pong(data));
            }
            Ok(Message::Close(_)) => return Err("WebSocket closed".into()),
            Ok(_) => {}
            Err(e) => return Err(e.to_string()),
        }
    }
    let _ = ws.close(None);
    Ok(())
}

fn socket_loop(app: AppHandle, app_token: String, stop: Arc<AtomicBool>) {
    let mut backoff_secs = 2u64;
    while !stop.load(Ordering::SeqCst) {
        emit_status(&app, false, "Connecting Socket Mode…");
        match socket_session(&app, &app_token, &stop) {
            Ok(()) => break,
            Err(e) => {
                if stop.load(Ordering::SeqCst) {
                    break;
                }
                let detail = if e.to_lowercase().contains("ratelimit") {
                    "Slack rate limit — Socket Mode retrying…".to_string()
                } else {
                    format!("Socket Mode: {e} — retrying…")
                };
                emit_status(&app, false, detail);
                thread::sleep(Duration::from_secs(backoff_secs));
                backoff_secs = (backoff_secs * 2).min(60);
            }
        }
    }
    emit_status(&app, false, "Socket Mode stopped");
}

#[tauri::command]
pub fn slack_socket_start(
    app: AppHandle,
    service: tauri::State<'_, Arc<SlackSocketService>>,
    app_token: String,
) -> Result<(), String> {
    service.start(app, app_token)
}

#[tauri::command]
pub fn slack_socket_stop(service: tauri::State<'_, Arc<SlackSocketService>>) {
    service.stop();
}

#[tauri::command]
pub fn slack_socket_is_running(service: tauri::State<'_, Arc<SlackSocketService>>) -> bool {
    service.is_running()
}
