use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::Manager;

struct UserMapCache {
    token: String,
    users: HashMap<String, String>,
    bots: HashMap<String, bool>,
    at: Instant,
}

static USER_MAP_CACHE: Mutex<Option<UserMapCache>> = Mutex::new(None);
const USER_MAP_CACHE_TTL: Duration = Duration::from_secs(300);

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SlackConversation {
    pub id: String,
    pub title: String,
    pub section: String,
    pub preview: String,
    pub unread: u32,
    pub latest_ts: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SlackMessageAttachment {
    pub id: String,
    pub name: String,
    pub mime_type: String,
    pub is_image: bool,
    pub permalink: String,
    pub media_url: String,
    pub requires_auth: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SlackMessage {
    pub id: String,
    pub author: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub author_user_id: Option<String>,
    pub body: String,
    pub at: i64,
    pub in_thread: bool,
    #[serde(default)]
    pub attachments: Vec<SlackMessageAttachment>,
    #[serde(default)]
    pub reactions: Vec<SlackMessageReaction>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SlackMessageReaction {
    pub name: String,
    pub count: u32,
    pub user_ids: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct AuthTestResponse {
    ok: bool,
    error: Option<String>,
    team_id: Option<String>,
    team: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SlackWorkspaceSnapshot {
    pub team_id: String,
    pub team_name: String,
    pub conversations: Vec<SlackConversation>,
}

#[derive(Debug, Deserialize)]
struct ConversationsListResponse {
    ok: bool,
    error: Option<String>,
    channels: Option<Vec<SlackChannel>>,
    response_metadata: Option<ResponseMetadata>,
}

#[derive(Debug, Deserialize)]
struct ResponseMetadata {
    next_cursor: Option<String>,
}

#[derive(Debug, Deserialize)]
struct SlackChannel {
    id: String,
    name: Option<String>,
    is_im: Option<bool>,
    is_mpim: Option<bool>,
    is_private: Option<bool>,
    is_channel: Option<bool>,
    user: Option<String>,
    unread_count_display: Option<u32>,
    purpose: Option<SlackPurpose>,
    topic: Option<SlackPurpose>,
    latest: Option<SlackLatestMessage>,
}

#[derive(Debug, Deserialize)]
struct SlackLatestMessage {
    text: Option<String>,
    user: Option<String>,
    #[serde(default)]
    ts: String,
}

#[derive(Debug, Deserialize)]
struct SlackPurpose {
    value: Option<String>,
}

#[derive(Debug, Deserialize)]
struct UsersListResponse {
    ok: bool,
    error: Option<String>,
    members: Option<Vec<SlackUser>>,
    response_metadata: Option<ResponseMetadata>,
}

#[derive(Debug, Deserialize)]
struct SlackUser {
    id: String,
    deleted: Option<bool>,
    is_bot: Option<bool>,
    profile: Option<SlackProfile>,
    real_name: Option<String>,
    name: Option<String>,
}

#[derive(Debug, Deserialize)]
struct SlackProfile {
    display_name: Option<String>,
    real_name: Option<String>,
}

#[derive(Debug, Deserialize)]
struct HistoryResponse {
    ok: bool,
    error: Option<String>,
    messages: Option<Vec<SlackHistoryMessage>>,
    #[allow(dead_code)]
    has_more: Option<bool>,
    response_metadata: Option<ResponseMetadata>,
}

#[derive(Debug, Deserialize)]
struct SlackHistoryMessage {
    #[serde(default)]
    ts: String,
    user: Option<String>,
    text: Option<String>,
    subtype: Option<String>,
    thread_ts: Option<String>,
    bot_id: Option<String>,
    file: Option<SlackFile>,
    files: Option<Vec<SlackFile>>,
    attachments: Option<Vec<SlackMsgAttachment>>,
    reactions: Option<Vec<SlackReaction>>,
}

#[derive(Debug, Deserialize)]
struct SlackReaction {
    name: String,
    count: Option<u32>,
    users: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
struct SlackFile {
    id: Option<String>,
    name: Option<String>,
    title: Option<String>,
    mimetype: Option<String>,
    filetype: Option<String>,
    permalink: Option<String>,
    url_private: Option<String>,
    url_private_download: Option<String>,
    thumb_360: Option<String>,
    thumb_480: Option<String>,
    thumb_720: Option<String>,
}

#[derive(Debug, Deserialize)]
struct SlackMsgAttachment {
    fallback: Option<String>,
    title: Option<String>,
    title_link: Option<String>,
    image_url: Option<String>,
    thumb_url: Option<String>,
}

fn is_slack_protected_url(url: &str) -> bool {
    url.starts_with("https://files.slack.com/") || url.starts_with("https://slack-files.com/")
}

fn file_is_image(f: &SlackFile) -> bool {
    if f.mimetype
        .as_ref()
        .is_some_and(|m| m.starts_with("image/"))
    {
        return true;
    }
    matches!(
        f.filetype.as_deref(),
        Some("png" | "jpg" | "jpeg" | "gif" | "webp" | "bmp" | "svg")
    )
}

fn slack_file_to_attachment(f: &SlackFile) -> Option<SlackMessageAttachment> {
    let id = f
        .id
        .clone()
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| format!("file-{}", f.name.as_deref().unwrap_or("unknown")));
    let name = f
        .name
        .clone()
        .or_else(|| f.title.clone())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "File".into());
    let mime_type = f
        .mimetype
        .clone()
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "application/octet-stream".into());
    let is_image = file_is_image(f);
    let permalink = f.permalink.clone().unwrap_or_default();
    let media_url = if is_image {
        f.thumb_720
            .clone()
            .or_else(|| f.thumb_480.clone())
            .or_else(|| f.thumb_360.clone())
            .or_else(|| f.url_private_download.clone())
            .or_else(|| f.url_private.clone())
            .unwrap_or_default()
    } else {
        f.url_private_download
            .clone()
            .or_else(|| f.url_private.clone())
            .unwrap_or_default()
    };
    if media_url.is_empty() && permalink.is_empty() {
        return None;
    }
    let requires_auth = is_slack_protected_url(&media_url);
    Some(SlackMessageAttachment {
        id,
        name,
        mime_type,
        is_image,
        permalink,
        media_url,
        requires_auth,
    })
}

fn legacy_attachment_to_out(i: usize, a: &SlackMsgAttachment) -> Option<SlackMessageAttachment> {
    let image = a
        .image_url
        .as_ref()
        .or(a.thumb_url.as_ref())
        .filter(|u| !u.is_empty());
    let title = a
        .title
        .clone()
        .or_else(|| a.fallback.clone())
        .filter(|s| !s.is_empty());
    if let Some(url) = image {
        let name = title.unwrap_or_else(|| "Image".into());
        return Some(SlackMessageAttachment {
            id: format!("legacy-{i}"),
            name,
            mime_type: "image/*".into(),
            is_image: true,
            permalink: a.title_link.clone().unwrap_or_default(),
            media_url: url.clone(),
            requires_auth: is_slack_protected_url(url),
        });
    }
    let link = a.title_link.as_ref().filter(|u| !u.is_empty())?;
    Some(SlackMessageAttachment {
        id: format!("legacy-{i}"),
        name: title.unwrap_or_else(|| "Link".into()),
        mime_type: "text/html".into(),
        is_image: false,
        permalink: link.clone(),
        media_url: link.clone(),
        requires_auth: false,
    })
}

fn scan_slack_text_links(text: &str) -> Vec<(String, String)> {
    let mut out = Vec::new();
    let chars: Vec<char> = text.chars().collect();
    let mut i = 0;
    while i < chars.len() {
        if chars[i] == '<' {
            if let Some(rel) = chars[i + 1..].iter().position(|&c| c == '>') {
                let inner: String = chars[i + 1..i + 1 + rel].iter().collect();
                let (url, label) = if let Some(p) = inner.find('|') {
                    (inner[..p].to_string(), inner[p + 1..].to_string())
                } else {
                    (inner.clone(), inner)
                };
                if url.starts_with("http://") || url.starts_with("https://") {
                    out.push((url, label));
                }
                i += rel + 2;
                continue;
            }
        }
        i += 1;
    }
    out
}

fn attachment_from_text_link(url: &str, label: &str) -> Option<SlackMessageAttachment> {
    let url = url.trim();
    if url.is_empty() {
        return None;
    }
    let lower = url.to_lowercase();
    let is_slack_file =
        lower.contains("files.slack.com") || lower.contains("slack-files.com");
    let name = if label.trim().is_empty() || label == url {
        url.rsplit('/').next().unwrap_or("File").to_string()
    } else {
        label.trim().to_string()
    };
    let ext = name.rsplit('.').next().unwrap_or("").to_lowercase();
    let is_image = matches!(
        ext.as_str(),
        "png" | "jpg" | "jpeg" | "gif" | "webp" | "bmp" | "svg"
    );
    let is_pdf = ext == "pdf";
    if !is_slack_file && !is_image && !is_pdf {
        return None;
    }
    let mime_type = if is_image {
        "image/*".into()
    } else if is_pdf {
        "application/pdf".into()
    } else {
        "application/octet-stream".into()
    };
    Some(SlackMessageAttachment {
        id: format!("text-{}", url.len()),
        name,
        mime_type,
        is_image,
        permalink: url.to_string(),
        media_url: url.to_string(),
        requires_auth: is_slack_protected_url(url),
    })
}

fn collect_message_attachments(m: &SlackHistoryMessage) -> Vec<SlackMessageAttachment> {
    let mut out = Vec::new();
    if let Some(files) = &m.files {
        for f in files {
            if let Some(a) = slack_file_to_attachment(f) {
                out.push(a);
            }
        }
    }
    if let Some(f) = &m.file {
        if let Some(a) = slack_file_to_attachment(f) {
            out.push(a);
        }
    }
    if let Some(atts) = &m.attachments {
        for (i, a) in atts.iter().enumerate() {
            if let Some(item) = legacy_attachment_to_out(i, a) {
                out.push(item);
            }
        }
    }
    if let Some(text) = m.text.as_deref() {
        for (url, label) in scan_slack_text_links(text) {
            if out.iter().any(|a| a.media_url == url || a.permalink == url) {
                continue;
            }
            if let Some(item) = attachment_from_text_link(&url, &label) {
                out.push(item);
            }
        }
    }
    out
}

fn map_message_reactions(m: &SlackHistoryMessage) -> Vec<SlackMessageReaction> {
    m.reactions
        .as_ref()
        .map(|list| {
            list.iter()
                .map(|r| SlackMessageReaction {
                    name: r.name.clone(),
                    count: r.count.unwrap_or_else(|| r.users.as_ref().map(|u| u.len() as u32).unwrap_or(0)),
                    user_ids: r.users.clone().unwrap_or_default(),
                })
                .collect()
        })
        .unwrap_or_default()
}

fn message_display_body(m: &SlackHistoryMessage, attachments: &[SlackMessageAttachment]) -> String {
    if let Some(text) = m.text.as_ref().map(|s| s.trim()).filter(|s| !s.is_empty()) {
        return text.to_string();
    }
    if !attachments.is_empty() {
        let names: Vec<&str> = attachments.iter().map(|a| a.name.as_str()).collect();
        return format!("📎 {}", names.join(", "));
    }
    String::new()
}

fn slack_get<T: for<'de> Deserialize<'de>>(
    token: &str,
    method: &str,
    params: &[(&str, String)],
) -> Result<T, String> {
    let client = slack_http_client()?;
    let url = format!("https://slack.com/api/{method}");
    let resp = client
        .get(&url)
        .bearer_auth(token.trim())
        .query(params)
        .send()
        .map_err(|e| e.to_string())?;
    let body: T = resp.json().map_err(|e| e.to_string())?;
    Ok(body)
}

fn slack_http_client() -> Result<reqwest::blocking::Client, String> {
    reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(45))
        .build()
        .map_err(|e| e.to_string())
}

fn slack_post<T: for<'de> Deserialize<'de>>(
    token: &str,
    method: &str,
    params: &[(&str, String)],
) -> Result<T, String> {
    let client = slack_http_client()?;
    let url = format!("https://slack.com/api/{method}");
    let resp = client
        .post(&url)
        .bearer_auth(token.trim())
        .form(params)
        .send()
        .map_err(|e| e.to_string())?;
    let body: T = resp.json().map_err(|e| e.to_string())?;
    Ok(body)
}

#[derive(Debug, Deserialize)]
struct AuthTestUserResponse {
    ok: bool,
    error: Option<String>,
    user_id: Option<String>,
}

#[derive(Debug, Deserialize)]
struct PostMessageResponse {
    ok: bool,
    error: Option<String>,
    ts: Option<String>,
}

#[derive(Debug, Deserialize)]
struct UpdateMessageResponse {
    ok: bool,
    error: Option<String>,
    ts: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SlackSelfUser {
    pub user_id: String,
    pub name: String,
}

fn load_user_map(token: &str) -> (HashMap<String, String>, HashMap<String, bool>) {
    let token = token.trim();
    if let Ok(guard) = USER_MAP_CACHE.lock() {
        if let Some(c) = guard.as_ref() {
            if c.token == token && c.at.elapsed() < USER_MAP_CACHE_TTL {
                return (c.users.clone(), c.bots.clone());
            }
        }
    }
    let (users, bots) = load_user_map_paginated(token);
    if let Ok(mut guard) = USER_MAP_CACHE.lock() {
        *guard = Some(UserMapCache {
            token: token.to_string(),
            users: users.clone(),
            bots: bots.clone(),
            at: Instant::now(),
        });
    }
    (users, bots)
}

fn load_user_map_paginated(token: &str) -> (HashMap<String, String>, HashMap<String, bool>) {
    let mut map = HashMap::new();
    let mut bots = HashMap::new();
    let mut cursor = String::new();
    loop {
        let mut params = vec![("limit", "200".to_string())];
        if !cursor.is_empty() {
            params.push(("cursor", cursor.clone()));
        }
        let page: UsersListResponse = match slack_get(token, "users.list", &params) {
            Ok(p) => p,
            Err(_) => break,
        };
        if !page.ok {
            break;
        }
        for m in page.members.unwrap_or_default() {
            if m.deleted.unwrap_or(false) {
                continue;
            }
            let label = m
                .profile
                .as_ref()
                .and_then(|p| p.display_name.clone().filter(|s| !s.is_empty()))
                .or_else(|| m.profile.as_ref().and_then(|p| p.real_name.clone()))
                .or(m.real_name.clone())
                .or(m.name.clone())
                .unwrap_or_else(|| m.id.clone());
            if m.is_bot.unwrap_or(false) {
                bots.insert(m.id.clone(), true);
            }
            map.insert(m.id, label);
        }
        cursor = page
            .response_metadata
            .and_then(|m| m.next_cursor)
            .filter(|c| !c.is_empty())
            .unwrap_or_default();
        if cursor.is_empty() {
            break;
        }
    }
    (map, bots)
}

fn conversation_title(ch: &SlackChannel, users: &HashMap<String, String>) -> String {
    if ch.is_im.unwrap_or(false) {
        if let Some(uid) = &ch.user {
            let name = users.get(uid).cloned().unwrap_or_else(|| uid.clone());
            return name;
        }
    }
    if ch.is_mpim.unwrap_or(false) {
        return ch
            .name
            .clone()
            .map(|n| format!("{n} (group)"))
            .unwrap_or_else(|| "Group DM".into());
    }
    let name = ch.name.clone().unwrap_or_else(|| "channel".into());
    if ch.is_private.unwrap_or(false) {
        format!("#{name}")
    } else {
        format!("#{name}")
    }
}

fn conversation_section(ch: &SlackChannel, bot_users: &HashMap<String, bool>) -> &'static str {
    if ch.is_im.unwrap_or(false) {
        if let Some(uid) = &ch.user {
            if bot_users.get(uid).copied().unwrap_or(false) {
                return "apps";
            }
        }
        "dms"
    } else if ch.is_mpim.unwrap_or(false) {
        "groups"
    } else {
        "channels"
    }
}

fn conversation_preview(ch: &SlackChannel, users: &HashMap<String, String>) -> String {
    if let Some(latest) = &ch.latest {
        if let Some(text) = latest.text.as_ref().map(|s| s.trim()).filter(|s| !s.is_empty()) {
            let who = latest
                .user
                .as_ref()
                .and_then(|u| users.get(u))
                .map(|n| format!("{n}: "))
                .unwrap_or_default();
            let line = format!("{who}{text}");
            if line.chars().count() > 80 {
                return format!("{}…", line.chars().take(77).collect::<String>());
            }
            return line;
        }
    }
    ch.topic
        .as_ref()
        .and_then(|t| t.value.clone())
        .filter(|s| !s.is_empty())
        .or_else(|| {
            ch.purpose
                .as_ref()
                .and_then(|p| p.value.clone())
                .filter(|s| !s.is_empty())
        })
        .unwrap_or_else(|| "Open in Slack".into())
}

#[tauri::command]
pub fn slack_fetch_workspace(token: String) -> Result<SlackWorkspaceSnapshot, String> {
    let token = token.trim();
    if token.is_empty() {
        return Err("Missing Slack token".into());
    }

    let auth: AuthTestResponse = slack_get(token, "auth.test", &[])?;
    if !auth.ok {
        return Err(auth.error.unwrap_or_else(|| "auth.test failed".into()));
    }
    let team_id = auth
        .team_id
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "auth.test missing team_id".to_string())?;
    let team_name = auth.team.unwrap_or_else(|| "Slack".into());

    let (users, bot_users) = load_user_map(token);

    // Request by type group so missing mpim:read does not zero out the whole workspace.
    let type_batches = [
        "im",
        "public_channel,private_channel",
        "mpim",
    ];
    let mut seen: std::collections::HashSet<String> = std::collections::HashSet::new();
    let mut all = Vec::new();
    let mut scope_notes: Vec<String> = Vec::new();

    for types in type_batches {
        let mut cursor = String::new();
        loop {
            let mut params = vec![("types", types.to_string()), ("limit", "200".to_string())];
            if !cursor.is_empty() {
                params.push(("cursor", cursor.clone()));
            }
            params.push(("exclude_archived", "true".to_string()));

            let page: ConversationsListResponse =
                match slack_get(token, "conversations.list", &params) {
                    Ok(p) => p,
                    Err(e) => {
                        if types == "mpim" {
                            scope_notes.push(format!("Group DMs skipped: {e}"));
                        } else {
                            return Err(e);
                        }
                        break;
                    }
                };
            if !page.ok {
                let err = page.error.unwrap_or_else(|| "conversations.list failed".into());
                if types == "mpim" {
                    scope_notes.push(format!("Group DMs skipped ({err}) — add mpim:read"));
                    break;
                }
                return Err(err);
            }

            for ch in page.channels.unwrap_or_default() {
                if !seen.insert(ch.id.clone()) {
                    continue;
                }
                let latest_ts = ch
                    .latest
                    .as_ref()
                    .map(|l| l.ts.clone())
                    .filter(|s| !s.is_empty())
                    .unwrap_or_default();
                all.push(SlackConversation {
                    id: ch.id.clone(),
                    title: conversation_title(&ch, &users),
                    section: conversation_section(&ch, &bot_users).to_string(),
                    preview: conversation_preview(&ch, &users),
                    unread: ch.unread_count_display.unwrap_or(0),
                    latest_ts,
                });
            }

            cursor = page
                .response_metadata
                .and_then(|m| m.next_cursor)
                .filter(|c| !c.is_empty())
                .unwrap_or_default();
            if cursor.is_empty() {
                break;
            }
        }
    }

    if all.is_empty() && !scope_notes.is_empty() {
        return Err(scope_notes.join("; "));
    }

    all.sort_by(|a, b| {
        slack_ts_sort_key(&b.latest_ts)
            .partial_cmp(&slack_ts_sort_key(&a.latest_ts))
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| a.title.to_lowercase().cmp(&b.title.to_lowercase()))
    });
    Ok(SlackWorkspaceSnapshot {
        team_id,
        team_name,
        conversations: all,
    })
}

fn ts_to_ms(ts: &str) -> i64 {
    ts.split('.')
        .next()
        .and_then(|s| s.parse::<i64>().ok())
        .map(|s| s * 1000)
        .unwrap_or(0)
}

fn slack_ts_sort_key(ts: &str) -> f64 {
    ts.trim().parse::<f64>().unwrap_or(0.0)
}

#[tauri::command]
pub fn slack_conversation_history(
    token: String,
    channel_id: String,
    cursor: Option<String>,
) -> Result<(Vec<SlackMessage>, Option<String>), String> {
    let token = token.trim();
    if token.is_empty() {
        return Err("Missing Slack token".into());
    }
    let channel_id = channel_id.trim();
    if channel_id.is_empty() {
        return Err("Missing channel id".into());
    }

    let (users, _) = load_user_map(token);

    let mut params = vec![
        ("channel", channel_id.to_string()),
        ("limit", "50".to_string()),
    ];
    if let Some(c) = cursor.filter(|s| !s.is_empty()) {
        params.push(("cursor", c));
    }

    let page: HistoryResponse = slack_get(token, "conversations.history", &params)?;
    if !page.ok {
        return Err(page
            .error
            .unwrap_or_else(|| "conversations.history failed".into()));
    }

    let mut out = Vec::new();
    for m in page.messages.unwrap_or_default().into_iter().rev() {
        if m.subtype.as_deref() == Some("channel_join") {
            continue;
        }
        let attachments = collect_message_attachments(&m);
        let reactions = map_message_reactions(&m);
        let body = message_display_body(&m, &attachments);
        if body.is_empty() && attachments.is_empty() && reactions.is_empty() {
            continue;
        }
        let author = m
            .user
            .as_ref()
            .and_then(|u| users.get(u).cloned())
            .unwrap_or_else(|| m.bot_id.clone().unwrap_or_else(|| "Slack".into()));
        let in_thread = m.thread_ts.as_ref().map(|t| t != &m.ts).unwrap_or(false);
        out.push(SlackMessage {
            id: m.ts.clone(),
            author,
            author_user_id: m.user.clone(),
            body,
            at: ts_to_ms(&m.ts),
            in_thread,
            attachments,
            reactions,
        });
    }

    let next = page
        .response_metadata
        .and_then(|m| m.next_cursor)
        .filter(|c| !c.is_empty());
    Ok((out, next))
}

#[tauri::command]
pub fn slack_fetch_protected_media(token: String, url: String) -> Result<String, String> {
    let token = token.trim();
    if token.is_empty() {
        return Err("Missing Slack token".into());
    }
    let url = url.trim();
    if url.is_empty() {
        return Err("Missing media URL".into());
    }
    if !is_slack_protected_url(url) {
        return Err("Media URL is not from Slack files".into());
    }

    let client = slack_http_client()?;
    let resp = client
        .get(url)
        .bearer_auth(token)
        .send()
        .map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("Slack media HTTP {}", resp.status()));
    }
    let mime = resp
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("application/octet-stream")
        .split(';')
        .next()
        .unwrap_or("application/octet-stream")
        .to_string();
    let bytes = resp.bytes().map_err(|e| e.to_string())?;
    use base64::{engine::general_purpose::STANDARD, Engine as _};
    Ok(format!("data:{mime};base64,{}", STANDARD.encode(bytes)))
}

fn slack_cache_file(app: &tauri::AppHandle, team_id: &str) -> Result<PathBuf, String> {
    let safe: String = team_id
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect();
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("slack-cache");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join(format!("{safe}.json")))
}

#[tauri::command]
pub fn slack_cache_read(app: tauri::AppHandle, team_id: String) -> Result<Option<String>, String> {
    let path = slack_cache_file(&app, team_id.trim())?;
    if !path.is_file() {
        return Ok(None);
    }
    std::fs::read_to_string(&path)
        .map(Some)
        .map_err(|e| e.to_string())
}

fn slack_self_user(token: &str) -> Result<SlackSelfUser, String> {
    let auth: AuthTestUserResponse = slack_get(token, "auth.test", &[])?;
    if !auth.ok {
        return Err(auth
            .error
            .unwrap_or_else(|| "auth.test failed".into()));
    }
    let user_id = auth
        .user_id
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "auth.test missing user_id".to_string())?;
    let (users, _) = load_user_map(token);
    Ok(SlackSelfUser {
        name: users
            .get(&user_id)
            .cloned()
            .unwrap_or_else(|| "You".into()),
        user_id,
    })
}

fn slack_author_name(token: &str) -> Result<String, String> {
    Ok(slack_self_user(token)?.name)
}

fn scope_hint(err: &str, scope: &str) -> String {
    if err == "missing_scope" {
        format!(
            "Missing {scope} scope on your Slack token — add it at api.slack.com, then update Settings → Integrations."
        )
    } else {
        err.to_string()
    }
}

#[derive(Debug, Deserialize)]
struct UploadResponse {
    ok: bool,
    error: Option<String>,
}

fn slack_upload_file(
    token: &str,
    channel_id: &str,
    path: &str,
    initial_comment: &str,
) -> Result<(), String> {
    use reqwest::blocking::multipart::{Form, Part};

    let bytes = std::fs::read(path).map_err(|e| format!("Read {}: {e}", path))?;
    let filename = std::path::Path::new(path)
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("file")
        .to_string();
    let part = Part::bytes(bytes).file_name(filename);
    let mut form = Form::new()
        .text("channels", channel_id.to_string())
        .part("file", part);
    if !initial_comment.trim().is_empty() {
        form = form.text("initial_comment", initial_comment.trim().to_string());
    }

    let client = slack_http_client()?;
    let resp = client
        .post("https://slack.com/api/files.upload")
        .bearer_auth(token.trim())
        .multipart(form)
        .send()
        .map_err(|e| e.to_string())?;
    let body: UploadResponse = resp.json().map_err(|e| e.to_string())?;
    if !body.ok {
        let err = body
            .error
            .unwrap_or_else(|| "files.upload failed".into());
        return Err(scope_hint(&err, "files:write"));
    }
    Ok(())
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SlackUserRef {
    pub id: String,
    pub name: String,
}

#[tauri::command]
pub fn slack_list_users(token: String) -> Result<Vec<SlackUserRef>, String> {
    let token = token.trim();
    if token.is_empty() {
        return Err("Missing Slack token".into());
    }
    let (users, _) = load_user_map(token);
    let mut list: Vec<SlackUserRef> = users
        .into_iter()
        .map(|(id, name)| SlackUserRef { id, name })
        .collect();
    list.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(list)
}

#[tauri::command]
pub fn slack_post_message(
    token: String,
    channel_id: String,
    text: String,
) -> Result<SlackMessage, String> {
    let token = token.trim();
    if token.is_empty() {
        return Err("Missing Slack token".into());
    }
    let channel_id = channel_id.trim();
    if channel_id.is_empty() {
        return Err("Missing channel id".into());
    }
    let text = text.trim();
    if text.is_empty() {
        return Err("Message is empty".into());
    }

    let author = slack_author_name(token)?;

    let params = vec![
        ("channel", channel_id.to_string()),
        ("text", text.to_string()),
    ];
    let posted: PostMessageResponse = slack_post(token, "chat.postMessage", &params)?;
    if !posted.ok {
        let err = posted
            .error
            .unwrap_or_else(|| "chat.postMessage failed".into());
        return Err(scope_hint(&err, "chat:write"));
    }
    let ts = posted
        .ts
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "chat.postMessage missing ts".to_string())?;

    let self_user = slack_self_user(token)?;
    Ok(SlackMessage {
        id: ts.clone(),
        author,
        author_user_id: Some(self_user.user_id),
        body: text.to_string(),
        at: ts_to_ms(&ts),
        in_thread: false,
        attachments: Vec::new(),
        reactions: Vec::new(),
    })
}

#[tauri::command]
pub fn slack_auth_self(token: String) -> Result<SlackSelfUser, String> {
    let token = token.trim();
    if token.is_empty() {
        return Err("Missing Slack token".into());
    }
    slack_self_user(token)
}

#[tauri::command]
pub fn slack_update_message(
    token: String,
    channel_id: String,
    message_ts: String,
    text: String,
) -> Result<SlackMessage, String> {
    let token = token.trim();
    if token.is_empty() {
        return Err("Missing Slack token".into());
    }
    let channel_id = channel_id.trim();
    if channel_id.is_empty() {
        return Err("Missing channel id".into());
    }
    let message_ts = message_ts.trim();
    if message_ts.is_empty() {
        return Err("Missing message timestamp".into());
    }
    let text = text.trim();
    if text.is_empty() {
        return Err("Message is empty".into());
    }

    let self_user = slack_self_user(token)?;
    let params = vec![
        ("channel", channel_id.to_string()),
        ("ts", message_ts.to_string()),
        ("text", text.to_string()),
    ];
    let updated: UpdateMessageResponse = slack_post(token, "chat.update", &params)?;
    if !updated.ok {
        let err = updated
            .error
            .unwrap_or_else(|| "chat.update failed".into());
        return Err(scope_hint(&err, "chat:write"));
    }

    Ok(SlackMessage {
        id: message_ts.to_string(),
        author: self_user.name,
        author_user_id: Some(self_user.user_id),
        body: text.to_string(),
        at: ts_to_ms(message_ts),
        in_thread: false,
        attachments: Vec::new(),
        reactions: Vec::new(),
    })
}

#[derive(Debug, Deserialize)]
struct ReactionResponse {
    ok: bool,
    error: Option<String>,
}

fn normalize_reaction_name(raw: &str) -> Result<String, String> {
    let name = raw.trim().trim_matches(':');
    if name.is_empty() {
        return Err("Missing emoji name".into());
    }
    Ok(name.to_string())
}

#[tauri::command]
pub fn slack_add_reaction(
    token: String,
    channel_id: String,
    message_ts: String,
    name: String,
) -> Result<(), String> {
    let token = token.trim();
    if token.is_empty() {
        return Err("Missing Slack token".into());
    }
    let channel_id = channel_id.trim();
    if channel_id.is_empty() {
        return Err("Missing channel id".into());
    }
    let message_ts = message_ts.trim();
    if message_ts.is_empty() {
        return Err("Missing message timestamp".into());
    }
    let name = normalize_reaction_name(&name)?;
    let params = vec![
        ("channel", channel_id.to_string()),
        ("timestamp", message_ts.to_string()),
        ("name", name),
    ];
    let resp: ReactionResponse = slack_post(token, "reactions.add", &params)?;
    if !resp.ok {
        let err = resp
            .error
            .unwrap_or_else(|| "reactions.add failed".into());
        return Err(scope_hint(&err, "reactions:write"));
    }
    Ok(())
}

#[tauri::command]
pub fn slack_remove_reaction(
    token: String,
    channel_id: String,
    message_ts: String,
    name: String,
) -> Result<(), String> {
    let token = token.trim();
    if token.is_empty() {
        return Err("Missing Slack token".into());
    }
    let channel_id = channel_id.trim();
    if channel_id.is_empty() {
        return Err("Missing channel id".into());
    }
    let message_ts = message_ts.trim();
    if message_ts.is_empty() {
        return Err("Missing message timestamp".into());
    }
    let name = normalize_reaction_name(&name)?;
    let params = vec![
        ("channel", channel_id.to_string()),
        ("timestamp", message_ts.to_string()),
        ("name", name),
    ];
    let resp: ReactionResponse = slack_post(token, "reactions.remove", &params)?;
    if !resp.ok {
        let err = resp
            .error
            .unwrap_or_else(|| "reactions.remove failed".into());
        return Err(scope_hint(&err, "reactions:write"));
    }
    Ok(())
}

#[tauri::command]
pub fn slack_send_composer(
    token: String,
    channel_id: String,
    text: String,
    file_paths: Vec<String>,
) -> Result<SlackMessage, String> {
    let token = token.trim();
    if token.is_empty() {
        return Err("Missing Slack token".into());
    }
    let channel_id = channel_id.trim();
    if channel_id.is_empty() {
        return Err("Missing channel id".into());
    }
    let text = text.trim().to_string();
    let paths: Vec<String> = file_paths
        .into_iter()
        .map(|p| p.trim().to_string())
        .filter(|p| !p.is_empty())
        .collect();
    if text.is_empty() && paths.is_empty() {
        return Err("Nothing to send".into());
    }

    let author = slack_author_name(token)?;

    if paths.is_empty() {
        return slack_post_message(token.to_string(), channel_id.to_string(), text);
    }

    let mut comment = text.clone();
    let mut names = Vec::new();
    for path in &paths {
        slack_upload_file(token, channel_id, path, &comment)?;
        names.push(
            std::path::Path::new(path)
                .file_name()
                .and_then(|s| s.to_str())
                .unwrap_or("file")
                .to_string(),
        );
        comment.clear();
    }

    let body = if text.is_empty() {
        format!("📎 {}", names.join(", "))
    } else {
        format!("{}\n📎 {}", text, names.join(", "))
    };
    let at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0);

    let self_user = slack_self_user(token)?;
    Ok(SlackMessage {
        id: format!("upload-{at}"),
        author,
        author_user_id: Some(self_user.user_id),
        body,
        at,
        in_thread: false,
        attachments: Vec::new(),
        reactions: Vec::new(),
    })
}

#[tauri::command]
pub fn slack_cache_write(app: tauri::AppHandle, team_id: String, json: String) -> Result<(), String> {
    let path = slack_cache_file(&app, team_id.trim())?;
    std::fs::write(&path, json).map_err(|e| e.to_string())
}