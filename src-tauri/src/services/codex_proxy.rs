//! Local HTTP proxy that converts Codex Responses API calls to OpenAI Chat
//! Completions format. This allows third-party providers that only support the
//! Chat Completions API to work with Codex (which speaks Responses API).
//!
//! Codex thinks it's talking to a Responses API endpoint at localhost, but the
//! proxy translates everything to Chat Completions behind the scenes.

use serde_json::{json, Value};
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::RwLock;

/// Default port for the local protocol proxy
pub const DEFAULT_PROXY_PORT: u16 = 9337;

/// Proxy state shared across connections — can be updated dynamically
/// when the user switches providers without restarting the proxy.
#[derive(Debug, Clone)]
pub(crate) struct ProxyState {
    upstream_base_url: String,
    upstream_api_key: String,
    upstream_model: String,
}

/// Global proxy state. Initialized on first call to `start_proxy`.
/// Subsequent calls update the inner state without rebinding the port.
static GLOBAL_PROXY_STATE: std::sync::OnceLock<Arc<RwLock<ProxyState>>> =
    std::sync::OnceLock::new();

/// Build the proxy base URL that Codex should use in its config.toml
pub fn proxy_base_url(port: u16) -> String {
    format!("http://127.0.0.1:{port}/v1")
}

/// Postel-parse the first line of an HTTP request into (method, path, _version)
fn parse_request_line(line: &str) -> Option<(&str, &str)> {
    let mut parts = line.split_whitespace();
    let method = parts.next()?;
    let path = parts.next()?;
    Some((method, path))
}

/// Very basic header parser: collect key-value pairs
fn parse_headers(lines: &[String]) -> Vec<(String, String)> {
    lines
        .iter()
        .filter_map(|line| {
            let (name, value) = line.split_once(':')?;
            Some((name.trim().to_ascii_lowercase(), value.trim().to_string()))
        })
        .collect()
}

/// Find header value (case-insensitive lookup)
fn header_value<'a>(headers: &'a [(String, String)], name: &str) -> Option<&'a str> {
    headers
        .iter()
        .find(|(k, _)| k == name)
        .map(|(_, v)| v.as_str())
}

/// Simple GET request with auth header
async fn get_json(client: &reqwest::Client, url: &str, api_key: &str) -> Result<(u16, String), String> {
    let resp = client
        .get(url)
        .header("Authorization", format!("Bearer {}", api_key))
        .send()
        .await
        .map_err(|e| format!("Upstream request failed: {e}"))?;
    let status = resp.status().as_u16();
    let body_text = resp.text().await.map_err(|e| format!("Failed to read response: {e}"))?;
    Ok((status, body_text))
}

/// Simple POST JSON request/response.
/// If the upstream returns SSE (text/event-stream) despite stream:false,
/// collect all data chunks into a single JSON string.
async fn post_json(client: &reqwest::Client, url: &str, api_key: &str, body: &Value) -> Result<(u16, String), String> {
    let resp = client
        .post(url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(body)
        .send()
        .await
        .map_err(|e| format!("Upstream request failed: {e}"))?;
    let status = resp.status().as_u16();
    let content_type = resp
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    if content_type.contains("text/event-stream") {
        // Upstream returned SSE despite our stream:false — collect chunks
        let bytes = resp.bytes().await.map_err(|e| format!("Failed to read SSE bytes: {e}"))?;
        let raw = String::from_utf8_lossy(&bytes);
        let mut collected = String::new();
        for line in raw.lines() {
            if let Some(data) = line.strip_prefix("data: ") {
                let data = data.trim();
                if data == "[DONE]" {
                    break;
                }
                collected.push_str(data);
            }
        }
        Ok((status, collected))
    } else {
        let body_text = resp.text().await.map_err(|e| format!("Failed to read response: {e}"))?;
        Ok((status, body_text))
    }
}

/// Convert a Responses API request to a Chat Completions API request.
fn responses_to_chat_completions(body: &Value, model: &str) -> Value {
    let mut chat = json!({
        "model": model,
        "messages": [],
        "stream": false  // always use non-streaming for proxy
    });

    // Build messages from instructions + input
    let mut messages: Vec<Value> = Vec::new();

    if let Some(instructions) = body.get("instructions") {
        let text = match instructions {
            Value::String(s) => s.clone(),
            Value::Array(parts) => parts
                .iter()
                .filter_map(|p| p.get("text").and_then(Value::as_str))
                .collect::<Vec<_>>()
                .join("\n"),
            _ => String::new(),
        };
        if !text.is_empty() {
            messages.push(json!({"role": "system", "content": text}));
        }
    }

    // Convert input items to messages
    if let Some(input) = body.get("input").and_then(Value::as_array) {
        for item in input {
            if let Some(role) = item.get("role").and_then(Value::as_str) {
                let content = item.get("content").cloned().unwrap_or(Value::Null);
                messages.push(json!({"role": role, "content": content}));
            }
        }
    }

    chat["messages"] = json!(messages);

    // Copy common parameters (but NOT stream — we force false above)
    if let Some(v) = body.get("max_output_tokens") {
        chat["max_tokens"] = v.clone();
    }
    if let Some(v) = body.get("temperature") {
        chat["temperature"] = v.clone();
    }
    if let Some(v) = body.get("top_p") {
        chat["top_p"] = v.clone();
    }

    // Convert tools if present
    if let Some(tools) = body.get("tools").and_then(Value::as_array) {
        let chat_tools: Vec<Value> = tools
            .iter()
            .filter_map(|tool| {
                let ttype = tool.get("type").and_then(Value::as_str)?;
                match ttype {
                    "function" => Some(json!({
                        "type": "function",
                        "function": {
                            "name": tool.get("name").cloned().unwrap_or(Value::Null),
                            "description": tool.get("description").cloned().unwrap_or(Value::Null),
                            "parameters": tool.get("parameters").cloned().unwrap_or(json!({})),
                        }
                    })),
                    _ => None,
                }
            })
            .collect();
        if !chat_tools.is_empty() {
            chat["tools"] = json!(chat_tools);
        }
    }

    chat
}

/// Convert a Chat Completions response back to a Responses API response.
fn chat_completion_to_response(body: &Value, request_model: &str) -> Value {
    let choices = body.get("choices").and_then(Value::as_array);
    let first_choice = choices.and_then(|c| c.first());
    let message = first_choice.and_then(|c| c.get("message"));

    let response_id = body
        .get("id")
        .and_then(Value::as_str)
        .map(|id| format!("resp_{id}"))
        .unwrap_or_else(|| "resp_compat".to_string());

    let mut output: Vec<Value> = Vec::new();

    if let Some(msg) = message {
        // Text content
        if let Some(content) = msg.get("content").and_then(Value::as_str) {
            if !content.is_empty() {
                output.push(json!({
                    "id": format!("msg_{response_id}"),
                    "type": "message",
                    "role": "assistant",
                    "status": "completed",
                    "content": [{
                        "type": "output_text",
                        "text": content,
                    }]
                }));
            }
        }

        // Tool calls
        if let Some(tool_calls) = msg.get("tool_calls").and_then(Value::as_array) {
            for tc in tool_calls {
                let function = tc.get("function");
                output.push(json!({
                    "id": tc.get("id").cloned().unwrap_or(Value::Null),
                    "type": "function_call",
                    "call_id": tc.get("id").cloned().unwrap_or(Value::Null),
                    "name": function.and_then(|f| f.get("name")).cloned().unwrap_or(Value::Null),
                    "arguments": function.and_then(|f| f.get("arguments")).and_then(Value::as_str).unwrap_or(""),
                    "status": "completed",
                }));
            }
        }
    }

    let finish_reason = first_choice
        .and_then(|c| c.get("finish_reason"))
        .and_then(Value::as_str);

    let status = match finish_reason {
        Some("stop") => "completed",
        Some("length") => "incomplete",
        Some("tool_calls") => "completed",
        _ => "completed",
    };

    let mut response = json!({
        "id": response_id,
        "object": "response",
        "created_at": body.get("created").and_then(Value::as_u64).unwrap_or(0),
        "status": status,
        "model": request_model,
        "output": output,
    });

    // Usage
    if let Some(usage) = body.get("usage") {
        response["usage"] = json!({
            "input_tokens": usage.get("prompt_tokens").cloned().unwrap_or(Value::Null),
            "output_tokens": usage.get("completion_tokens").cloned().unwrap_or(Value::Null),
            "total_tokens": usage.get("total_tokens").cloned().unwrap_or(Value::Null),
        });
    }

    if finish_reason == Some("length") {
        response["incomplete_details"] = json!({"reason": "max_output_tokens"});
    }

    response
}

/// Handle a single proxy connection.
/// Uses the same pattern as Codex++: read request, write response, shutdown.
async fn handle_connection(mut stream: TcpStream, state: Arc<RwLock<ProxyState>>) {
    let mut buf_reader = BufReader::new(&mut stream);

    // Read request line
    let mut request_line = String::new();
    if buf_reader.read_line(&mut request_line).await.is_err() {
        return;
    }
    let request_line = request_line.trim().to_string();

    // Read headers
    let mut headers: Vec<String> = Vec::new();
    loop {
        let mut line = String::new();
        if buf_reader.read_line(&mut line).await.is_err() {
            return;
        }
        let line = line.trim().to_string();
        if line.is_empty() {
            break;
        }
        headers.push(line);
    }
    let parsed_headers = parse_headers(&headers);
    let content_length: usize = header_value(&parsed_headers, "content-length")
        .and_then(|v| v.parse().ok())
        .unwrap_or(0);

    // Read body
    let mut body_bytes = vec![0u8; content_length];
    if content_length > 0 {
        if buf_reader.read_exact(&mut body_bytes).await.is_err() {
            return;
        }
    }

    // Drop the BufReader borrow so we can write to stream
    drop(buf_reader);

    let state = state.read().await;
    let client = reqwest::Client::new();

    let (status_line, response_body) = match parse_request_line(&request_line) {
        None => (
            "400 Bad Request",
            json!({"error": {"message": "Bad request"}}).to_string(),
        ),
        Some((method, path)) => {
            match (method, path) {
                // GET /v1/models — pass through
                (_, p) if p == "/v1/models" || p == "/models" => {
                    let url = format!("{}/models", state.upstream_base_url.trim_end_matches('/'));
                    match get_json(&client, &url, &state.upstream_api_key).await {
                        Ok((s, b)) => (status_line(s), b),
                        Err(e) => ("502 Bad Gateway", json!({"error": {"message": e}}).to_string()),
                    }
                }

                // POST /v1/responses or /responses — convert and forward
                (_, p) if p == "/v1/responses" || p == "/responses" => {
                    handle_responses_proxy(
                        &client,
                        &state,
                        &body_bytes,
                    ).await
                }

                // Health check
                (_, p) if p == "/health" || p == "/v1/health" => (
                    "200 OK",
                    json!({"status": "ok"}).to_string(),
                ),

                // Anything else — 404
                _ => (
                    "404 Not Found",
                    json!({"error": {"message": "Not found"}}).to_string(),
                ),
            }
        }
    };

    // Write HTTP response (same pattern as Codex++ write_http_response)
    let resp = format!(
        "HTTP/1.1 {status_line}\r\nContent-Type: application/json; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{response_body}",
        response_body.len()
    );
    let _ = stream.write_all(resp.as_bytes()).await;
    let _ = stream.flush().await;
    let _ = stream.shutdown().await;
}

fn status_line(status: u16) -> &'static str {
    match status {
        200 => "200 OK",
        400 => "400 Bad Request",
        404 => "404 Not Found",
        502 => "502 Bad Gateway",
        _ => "500 Internal Server Error",
    }
}

/// Handle a Responses API proxy request: convert → forward → convert back
async fn handle_responses_proxy(
    client: &reqwest::Client,
    state: &ProxyState,
    body_bytes: &[u8],
) -> (&'static str, String) {
    let request_body: Value = match serde_json::from_slice(body_bytes) {
        Ok(v) => v,
        Err(e) => {
            return (
                "400 Bad Request",
                json!({"error": {"message": format!("Invalid JSON: {e}")}}).to_string(),
            );
        }
    };

    let request_model = request_body
        .get("model")
        .and_then(Value::as_str)
        .unwrap_or(&state.upstream_model)
        .to_string();

    let chat_body = responses_to_chat_completions(&request_body, &request_model);

    let up_url = format!(
        "{}/chat/completions",
        state.upstream_base_url.trim_end_matches('/')
    );

    match post_json(client, &up_url, &state.upstream_api_key, &chat_body).await {
        Ok((status, body_text)) => {
            if status == 200 {
                match serde_json::from_str::<Value>(&body_text) {
                    Ok(chat_resp) => {
                        let resp = chat_completion_to_response(&chat_resp, &request_model);
                        ("200 OK", resp.to_string())
                    }
                    Err(_) => (status_line(status), body_text),
                }
            } else {
                (status_line(status), body_text)
            }
        }
        Err(e) => (
            "502 Bad Gateway",
            json!({"error": {"message": format!("Upstream error: {e}")}}).to_string(),
        ),
    }
}

/// Get or create the global proxy state.
/// Call this before starting the proxy or updating provider config.
pub fn update_proxy_state(
    upstream_base_url: String,
    upstream_api_key: String,
    upstream_model: String,
) -> &'static Arc<RwLock<ProxyState>> {
    let new_state = ProxyState {
        upstream_base_url,
        upstream_api_key,
        upstream_model,
    };

    match GLOBAL_PROXY_STATE.get() {
        Some(existing) => {
            // Update existing state (proxy is already running)
            let arc = existing.clone();
            tokio::task::spawn(async move {
                let mut state = arc.write().await;
                *state = new_state;
            });
            existing
        }
        None => {
            // First time: initialize global state
            GLOBAL_PROXY_STATE.get_or_init(|| Arc::new(RwLock::new(new_state)))
        }
    }
}

/// Start the local protocol proxy server (if not already running).
/// Returns the port it's listening on.
pub async fn ensure_proxy_running(
    upstream_base_url: String,
    upstream_api_key: String,
    upstream_model: String,
) -> Result<u16, String> {
    // Always update the shared state (or create it)
    update_proxy_state(upstream_base_url, upstream_api_key, upstream_model);

    let addr = format!("127.0.0.1:{}", DEFAULT_PROXY_PORT);

    // If the port is already bound (proxy running from a previous call),
    // just return the port — the state has already been updated above.
    match TcpListener::bind(&addr).await {
        Ok(listener) => {
            // First time: proxy wasn't running, start it now
            let state = GLOBAL_PROXY_STATE
                .get()
                .cloned()
                .expect("proxy state just initialized");

            tokio::spawn(async move {
                loop {
                    let state = state.clone();
                    match listener.accept().await {
                        Ok((stream, _addr)) => {
                            tokio::spawn(async move {
                                handle_connection(stream, state).await;
                            });
                        }
                        Err(_) => break,
                    }
                }
            });

            Ok(DEFAULT_PROXY_PORT)
        }
        Err(_) => {
            // Port already in use — proxy is running, state was updated above
            Ok(DEFAULT_PROXY_PORT)
        }
    }
}
