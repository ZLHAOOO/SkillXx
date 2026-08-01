//! Local HTTP proxy that converts Codex Responses API calls to OpenAI Chat
//! Completions format. This allows third-party providers that only support the
//! Chat Completions API to work with Codex (which speaks Responses API natively).
//!
//! Architecture:
//!   Codex ──Responses──> Proxy (localhost:port) ──ChatCompletions──> Upstream
//!
//! The proxy translates the request/response format in both directions.
//!
//! This file owns the HTTP/TCP plumbing only; the format translation lives in
//! [`translate`].

use serde_json::Value;
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::RwLock;

mod translate;

use translate::{
    chat_completion_to_response, chat_sse_to_responses_sse, responses_to_chat_completions,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone)]
struct ProxyState {
    upstream_base_url: String,
    upstream_api_key: String,
    upstream_model: String,
}

/// Default port for the protocol proxy
pub const DEFAULT_PROXY_PORT: u16 = 9337;

static GLOBAL_PROXY_STATE: std::sync::OnceLock<Arc<RwLock<ProxyState>>> =
    std::sync::OnceLock::new();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/// Build the proxy base URL that Codex should use in its config.toml
pub fn proxy_base_url(port: u16) -> String {
    format!("http://127.0.0.1:{port}/v1")
}

/// Start the proxy server on the given port. Safe to call multiple times —
/// subsequent calls update the provider config without rebinding.
pub async fn start_proxy(
    port: u16,
    upstream_base_url: String,
    upstream_api_key: String,
    upstream_model: String,
) -> Result<(), String> {
    let state = ProxyState {
        upstream_base_url,
        upstream_api_key,
        upstream_model,
    };

    // Initialize or update the global state
    let global = GLOBAL_PROXY_STATE.get_or_init(|| {
        let arc = Arc::new(RwLock::new(state.clone()));
        arc
    });

    // Update config
    {
        let mut g = global.write().await;
        g.upstream_base_url.clone_from(&state.upstream_base_url);
        g.upstream_api_key.clone_from(&state.upstream_api_key);
        g.upstream_model.clone_from(&state.upstream_model);
    }

    // Bind and serve (only once — first caller binds the port)
    if let Ok(listener) = TcpListener::bind(("127.0.0.1", port)).await {
        let _ = listener.local_addr();
        tokio::spawn(accept_loop(listener, global.clone()));
    }

    Ok(())
}

/// Update provider config on the running proxy without rebinding
pub async fn update_proxy_config(
    upstream_base_url: String,
    upstream_api_key: String,
    upstream_model: String,
) {
    if let Some(global) = GLOBAL_PROXY_STATE.get() {
        let mut g = global.write().await;
        g.upstream_base_url = upstream_base_url;
        g.upstream_api_key = upstream_api_key;
        g.upstream_model = upstream_model;
    }
}

/// Stop the proxy by clearing global state.
/// The TCP listener will accept no new connections once existing ones drain.
pub fn stop_proxy() {
    if let Some(global) = GLOBAL_PROXY_STATE.get() {
        let state = ProxyState {
            upstream_base_url: String::new(),
            upstream_api_key: String::new(),
            upstream_model: String::new(),
        };
        let rt = tokio::runtime::Handle::try_current();
        if let Ok(rt) = rt {
            rt.spawn(async move {
                let mut g = global.write().await;
                *g = state;
            });
        }
    }
}

// ---------------------------------------------------------------------------
// Accept loop
// ---------------------------------------------------------------------------

async fn accept_loop(listener: TcpListener, state: Arc<RwLock<ProxyState>>) {
    loop {
        match listener.accept().await {
            Ok((stream, _)) => {
                let s = state.clone();
                tokio::spawn(handle_connection(stream, s));
            }
            Err(_) => break,
        }
    }
}

// ---------------------------------------------------------------------------
// Connection handler
// ---------------------------------------------------------------------------

async fn handle_connection(mut stream: TcpStream, state: Arc<RwLock<ProxyState>>) {
    let mut reader = BufReader::new(&mut stream);
    let mut request_buf = Vec::new();

    // Read request headers + body
    let mut header_lines: Vec<String> = Vec::new();
    loop {
        let mut line = String::new();
        if reader.read_line(&mut line).await.is_err() {
            return;
        }
        if line == "\r\n" {
            break;
        }
        header_lines.push(line.clone());
        request_buf.extend_from_slice(line.as_bytes());
    }

    // Parse headers from collected lines
    let headers: Vec<(String, String)> = header_lines
        .iter()
        .skip(1) // skip request line
        .filter_map(|line| {
            let (name, value) = line.split_once(':')?;
            Some((name.trim().to_ascii_lowercase(), value.trim().to_string()))
        })
        .collect();

    let content_length = headers
        .iter()
        .find(|(k, _)| k == "content-length")
        .and_then(|(_, v)| v.parse::<usize>().ok())
        .unwrap_or(0);

    // Read body
    if content_length > 0 {
        let mut body = vec![0u8; content_length];
        if reader.read_exact(&mut body).await.is_err() {
            return;
        }
        request_buf.extend_from_slice(&body);
    }

    let request_body = String::from_utf8_lossy(&request_buf);

    // Determine request path from first header line
    let first_line = header_lines.first().map(|s| s.as_str()).unwrap_or("");
    let path = first_line.split_whitespace().nth(1).unwrap_or("/");

    // Check if this is a Responses API request we should proxy
    if is_responses_path(path) {
        let result = handle_responses_proxy(&request_body, &state).await;
        match result {
            Ok(response_str) => {
                let _ = stream.write_all(response_str.as_bytes()).await;
            }
            Err(_) => {
                let err_resp = http_response(502, "Bad Gateway", "{\"error\":\"upstream error\"}");
                let _ = stream.write_all(err_resp.as_bytes()).await;
            }
        }
        return;
    }

    // For non-Responses paths, return 404
    let resp = http_response(404, "Not Found", "{\"error\":\"not found\"}");
    let _ = stream.write_all(resp.as_bytes()).await;
}

// ---------------------------------------------------------------------------
// Core proxy logic
// ---------------------------------------------------------------------------

async fn handle_responses_proxy(
    request_body: &str,
    state: &Arc<RwLock<ProxyState>>,
) -> Result<String, String> {
    let g = state.read().await;
    let upstream_url = format!("{}/chat/completions", g.upstream_base_url.trim_end_matches('/'));

    // Translate Responses request → Chat Completions
    let chat_body = responses_to_chat_completions(request_body, &g.upstream_model)?;

    // Forward to upstream
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client
        .post(&upstream_url)
        .header("Authorization", format!("Bearer {}", g.upstream_api_key))
        .header("Content-Type", "application/json")
        .json(&chat_body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let status = resp.status().as_u16();
    let content_type = resp
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    if content_type.contains("text/event-stream") {
        // Streaming response — translate SSE from ChatCompletions → Responses
        let byte_stream = resp.bytes_stream();
        let sse_str = chat_sse_to_responses_sse(byte_stream).await?;
        Ok(http_response_with_body(status, "application/json", &sse_str))
    } else {
        // Non-streaming
        let resp_bytes = resp.bytes().await.map_err(|e| e.to_string())?;
        let resp_str = String::from_utf8_lossy(&resp_bytes);
        let chat_resp: Value = serde_json::from_str(&resp_str)
            .map_err(|e| format!("Failed to parse upstream response: {e}"))?;
        let responses_resp = chat_completion_to_response(chat_resp)?;
        let body = serde_json::to_string(&responses_resp)
            .map_err(|e| e.to_string())?;
        Ok(http_response_with_body(status, "application/json", &body))
    }
}

fn http_response(status: u16, reason: &str, body: &str) -> String {
    format!(
        "HTTP/1.1 {} {}\r\nContent-Length: {}\r\nContent-Type: application/json\r\nConnection: close\r\n\r\n{}",
        status, reason, body.len(), body
    )
}

fn http_response_with_body(status: u16, content_type: &str, body: &str) -> String {
    format!(
        "HTTP/1.1 {} OK\r\nContent-Length: {}\r\nContent-Type: {}\r\nConnection: close\r\n\r\n{}",
        status, body.len(), content_type, body
    )
}

fn parse_headers(lines: std::str::Lines) -> Vec<(String, String)> {
    lines
        .skip(1) // skip request line
        .take_while(|line| !line.is_empty() && *line != "\r\n")
        .filter_map(|line| {
            let (name, value) = line.split_once(':')?;
            Some((name.trim().to_ascii_lowercase(), value.trim().to_string()))
        })
        .collect()
}

fn header_value<'a>(headers: &'a [(String, String)], name: &str) -> Option<&'a str> {
    headers
        .iter()
        .find(|(k, _)| k == name)
        .map(|(_, v)| v.as_str())
}

fn is_responses_path(path: &str) -> bool {
    path == "/v1/responses" || path.ends_with("/responses")
}
