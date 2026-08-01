//! Format translation between the Codex Responses API and OpenAI Chat
//! Completions, in both directions.
//!
//! Split out of `mod.rs`, which now only owns the HTTP/TCP plumbing. The two
//! concerns share nothing but the function signatures below, and keeping the
//! translation in one file makes the request and response directions readable
//! side by side.

use serde_json::{Value, json};

pub(super) fn responses_to_chat_completions(body: &str, default_model: &str) -> Result<Value, String> {
    let req: Value = serde_json::from_str(body).map_err(|e| e.to_string())?;
    let mut result = json!({});

    // Model
    let model = req.get("model").and_then(Value::as_str).filter(|s| !s.is_empty());
    result["model"] = Value::String(model.unwrap_or(default_model).to_string());

    // Build messages array
    let mut messages = Vec::new();

    // instructions → system message
    if let Some(instr) = req.get("instructions") {
        let text = extract_text(instr);
        if !text.is_empty() {
            messages.push(json!({ "role": "system", "content": text }));
        }
    }

    // input → messages
    if let Some(input) = req.get("input") {
        if let Some(arr) = input.as_array() {
            for item in arr {
                append_input_item(item, &mut messages);
            }
        }
    }

    result["messages"] = Value::Array(messages);

    // max_output_tokens
    if let Some(v) = req.get("max_output_tokens") {
        result["max_tokens"] = v.clone();
    }

    // Passthrough common fields
    for key in ["temperature", "top_p", "stream"] {
        if let Some(v) = req.get(key) {
            result[key] = v.clone();
        }
    }

    // Tools
    if let Some(tools) = req.get("tools").and_then(Value::as_array) {
        let converted: Vec<Value> = tools
            .iter()
            .filter_map(responses_tool_to_chat_tool)
            .collect();
        if !converted.is_empty() {
            result["tools"] = Value::Array(converted);
        }
    }

    // tool_choice
    if let Some(tc) = req.get("tool_choice") {
        if let Some(converted) = responses_tool_choice_to_chat(tc) {
            result["tool_choice"] = converted;
        }
    }

    // Reasoning
    if let Some(reasoning) = req.get("reasoning") {
        if let Some(effort) = reasoning.get("effort").and_then(Value::as_str) {
            if matches!(effort, "high" | "medium" | "low") {
                result["reasoning_effort"] = Value::String(effort.to_string());
            }
        }
    }

    // stream_options
    if req.get("stream").and_then(Value::as_bool).unwrap_or(false) {
        let mut so = json!({ "include_usage": true });
        if let Some(usage) = req.get("stream_options").and_then(|v| v.get("include_usage")) {
            so["include_usage"] = usage.clone();
        }
        result["stream_options"] = so;
    }

    // Extra passthrough fields
    for key in [
        "frequency_penalty", "presence_penalty", "seed",
        "stop", "user", "response_format",
    ] {
        if let Some(v) = req.get(key) {
            result[key] = v.clone();
        }
    }

    Ok(result)
}

fn extract_text(value: &Value) -> String {
    match value {
        Value::String(s) => s.clone(),
        Value::Array(arr) => arr
            .iter()
            .filter_map(|item| {
                item.get("type").and_then(Value::as_str).and_then(|t| {
                    if t == "input_text" || t == "text" {
                        item.get("text").and_then(Value::as_str)
                    } else {
                        None
                    }
                })
            })
            .collect::<Vec<_>>()
            .join("\n"),
        _ => Value::to_string(value),
    }
}

fn append_input_item(item: &Value, messages: &mut Vec<Value>) {
    let item_type = item.get("type").and_then(Value::as_str).unwrap_or("");

    match item_type {
        "message" => {
            let role = item.get("role").and_then(Value::as_str).unwrap_or("user");
            let content = item
                .get("content")
                .and_then(|c| {
                    if c.is_string() {
                        Some(c.as_str().unwrap_or("").to_string())
                    } else if let Some(arr) = c.as_array() {
                        Some(
                            arr.iter()
                                .filter_map(|block| {
                                    block.get("type").and_then(Value::as_str).and_then(|t| {
                                        if t == "input_text" || t == "text" {
                                            block.get("text").and_then(Value::as_str)
                                        } else {
                                            None
                                        }
                                    })
                                })
                                .collect::<Vec<_>>()
                                .join("\n"),
                        )
                    } else {
                        None
                    }
                })
                .unwrap_or_default();

            if role == "tool_call" || role == "function_call" {
                // Convert function_call role to assistant with tool_calls
                let mut msg = json!({ "role": "assistant", "content": null });
                if let Some(calls) = item.get("content").and_then(Value::as_array) {
                    let tool_calls: Vec<Value> = calls
                        .iter()
                        .filter_map(|call| {
                            let name = call.get("name")?.as_str()?;
                            let args = call.get("arguments")?;
                            let call_id = call.get("call_id").and_then(Value::as_str).unwrap_or(name);
                            Some(json!({
                                "id": call_id,
                                "type": "function",
                                "function": {
                                    "name": name,
                                    "arguments": args.to_string()
                                }
                            }))
                        })
                        .collect();
                    if !tool_calls.is_empty() {
                        msg["tool_calls"] = Value::Array(tool_calls);
                    }
                }
                messages.push(msg);
            } else if role == "function_call_output" {
                let call_id = item.get("call_id").and_then(Value::as_str).unwrap_or("");
                let content = item
                    .get("content")
                    .and_then(|c| {
                        if c.is_string() {
                            Some(c.as_str().unwrap_or("").to_string())
                        } else if let Some(arr) = c.as_array() {
                            Some(
                                arr.iter()
                                    .filter_map(|b| {
                                        b.get("type").and_then(Value::as_str).and_then(|t| {
                                            if t == "output_text" || t == "text" {
                                                b.get("text").and_then(Value::as_str)
                                            } else {
                                                None
                                            }
                                        })
                                    })
                                    .collect::<Vec<_>>()
                                    .join("\n"),
                            )
                        } else {
                            None
                        }
                    })
                    .unwrap_or_default();
                messages.push(json!({
                    "role": "tool",
                    "tool_call_id": call_id,
                    "content": content
                }));
            } else if role == "reasoning" {
                let content = item
                    .get("content")
                    .and_then(|c| {
                        if c.is_string() {
                            Some(c.as_str().unwrap_or("").to_string())
                        } else if let Some(arr) = c.as_array() {
                            Some(
                                arr.iter()
                                    .filter_map(|b| {
                                        b.get("type").and_then(Value::as_str).and_then(|t| {
                                            if t == "reasoning_text" || t == "text" || t == "input_text" {
                                                b.get("text").and_then(Value::as_str)
                                            } else {
                                                None
                                            }
                                        })
                                    })
                                    .collect::<Vec<_>>()
                                    .join("\n"),
                            )
                        } else {
                            None
                        }
                    })
                    .unwrap_or_default();
                // Reasoning items become assistant messages with redacted thinking tags
                if !content.is_empty() {
                    messages.push(json!({
                        "role": "assistant",
                        "content": content
                    }));
                }
            } else {
                messages.push(json!({ "role": role, "content": content }));
            }
        }
        "function_call" => {
            let name = item.get("name").and_then(Value::as_str).unwrap_or("");
            let arguments = item.get("arguments").cloned().unwrap_or(Value::String("{}".into()));
            let call_id = item.get("call_id").and_then(Value::as_str).unwrap_or(name);
            messages.push(json!({
                "role": "assistant",
                "tool_calls": [json!({
                    "id": call_id,
                    "type": "function",
                    "function": {
                        "name": name,
                        "arguments": arguments.to_string()
                    }
                })]
            }));
        }
        "function_call_output" => {
            let call_id = item.get("call_id").and_then(Value::as_str).unwrap_or("");
            let content = item.get("content").cloned().unwrap_or(Value::String("".into()));
            let text = if content.is_string() {
                content.as_str().unwrap_or("").to_string()
            } else if let Some(arr) = content.as_array() {
                arr.iter()
                    .filter_map(|b| b.get("text").and_then(Value::as_str))
                    .collect::<Vec<_>>()
                    .join("\n")
            } else {
                content.to_string()
            };
            messages.push(json!({
                "role": "tool",
                "tool_call_id": call_id,
                "content": text
            }));
        }
        "reasoning" => {
            let text = item
                .get("content")
                .and_then(|c| {
                    if c.is_string() {
                        Some(c.as_str().unwrap_or("").to_string())
                    } else if let Some(arr) = c.as_array() {
                        Some(
                            arr.iter()
                                .filter_map(|b| {
                                    b.get("text")
                                        .and_then(Value::as_str)
                                        .or_else(|| b.get("content").and_then(Value::as_str))
                                })
                                .collect::<Vec<_>>()
                                .join("\n"),
                        )
                    } else {
                        None
                    }
                })
                .unwrap_or_default();
            if !text.is_empty() {
                messages.push(json!({ "role": "assistant", "content": text }));
            }
        }
        _ => {}
    }
}

fn responses_tool_to_chat_tool(tool: &Value) -> Option<Value> {
    let name = tool.get("name")?.as_str()?;
    let description = tool.get("description").and_then(Value::as_str).unwrap_or("");
    let input_schema = tool.get("input_schema").cloned().unwrap_or_else(|| json!({"type": "object"}));
    Some(json!({
        "type": "function",
        "function": {
            "name": name,
            "description": description,
            "parameters": input_schema
        }
    }))
}

fn responses_tool_choice_to_chat(tc: &Value) -> Option<Value> {
    match tc.get("type").and_then(Value::as_str)? {
        "auto" | "required" => Some(Value::String(tc.get("type")?.as_str()?.to_string())),
        "function" => {
            let name = tc.get("name")?.as_str()?;
            Some(json!({
                "type": "function",
                "function": { "name": name }
            }))
        }
        _ => Some(tc.clone()),
    }
}

// ---------------------------------------------------------------------------
// Format translation: Chat Completions → Responses (non-streaming)
// ---------------------------------------------------------------------------

pub(super) fn chat_completion_to_response(chat: Value) -> Result<Value, String> {
    let mut result = json!({
        "model": "",
        "output": [],
        "usage": {
            "input_tokens": 0,
            "output_tokens": 0
        }
    });

    if let Some(m) = chat.get("model").and_then(Value::as_str) {
        result["model"] = Value::String(m.to_string());
    }

    let mut output_items = Vec::new();
    let mut stop_reason = "in_progress";

    if let Some(choices) = chat.get("choices").and_then(Value::as_array) {
        for choice in choices {
            let finish_reason = choice.get("finish_reason").and_then(Value::as_str).unwrap_or("");
            if !finish_reason.is_empty() {
                stop_reason = map_finish_reason(finish_reason);
            }

            if let Some(msg) = choice.get("message") {
                // Text content
                if let Some(content) = msg.get("content").and_then(Value::as_str) {
                    if !content.is_empty() {
                        output_items.push(json!({
                            "type": "message",
                            "role": "assistant",
                            "content": [{
                                "type": "output_text",
                                "text": content
                            }]
                        }));
                    }
                }
                // Tool calls
                if let Some(tool_calls) = msg.get("tool_calls").and_then(Value::as_array) {
                    for tc in tool_calls {
                        let func = tc.get("function").ok_or_else(|| "missing function field".to_string())?;
                        let name = func.get("name")
                            .ok_or_else(|| "missing name field".to_string())?
                            .as_str()
                            .ok_or_else(|| "name not a string".to_string())?;
                        let args_str = func.get("arguments").and_then(Value::as_str).unwrap_or("{}");
                        let call_id = tc.get("id").and_then(Value::as_str).unwrap_or(name);
                        let mut args: Value = serde_json::from_str(args_str).unwrap_or_else(|_| Value::String(args_str.into()));
                        if args.is_string() {
                            args = Value::String(args.as_str().unwrap().into());
                        }
                        output_items.push(json!({
                            "type": "function_call",
                            "name": name,
                            "arguments": args,
                            "call_id": call_id
                        }));
                    }
                }
            }
        }
    }

    result["output"] = Value::Array(output_items);
    result["status"] = Value::String(stop_reason.to_string());

    // Usage
    if let Some(usage) = chat.get("usage") {
        if let Some(it) = usage.get("prompt_tokens").and_then(Value::as_u64) {
            result["usage"]["input_tokens"] = Value::Number(it.into());
        }
        if let Some(ot) = usage.get("completion_tokens").and_then(Value::as_u64) {
            result["usage"]["output_tokens"] = Value::Number(ot.into());
        }
        if let Some(it) = usage.get("prompt_tokens_details").and_then(|v| v.get("cached_tokens")).and_then(Value::as_u64) {
            result["usage"]["cache_creation_input_tokens"] = Value::Number(it.into());
        }
    }

    Ok(result)
}

fn map_finish_reason(reason: &str) -> &'static str {
    match reason {
        "length" => "max_tokens_reached",
        "content_filter" => "censored",
        "tool_calls" | "stop" => "completed",
        _ => "completed",
    }
}

// ---------------------------------------------------------------------------
// Format translation: Chat Completions SSE → Responses SSE (streaming)
// ---------------------------------------------------------------------------

/// Assemble the trailing SSE frames of a streamed response: the terminal
/// `response` event carrying the full output, followed by `[DONE]`.
///
/// A stream can end two ways — the upstream sends `data: [DONE]`, or the byte
/// stream simply runs out — and both must produce the same payload. They used
/// to be built by two copies of this logic, and they had drifted: the `[DONE]`
/// path never appended `acc_tool_calls`, so on a normal completion every tool
/// call the model asked for was dropped from the final snapshot. Funnelling
/// both endings through one function makes that class of divergence impossible.
fn final_response_frames(
    acc_content: &str,
    acc_tool_calls: &[Value],
    model: &str,
    finish_reason: &str,
    usage_info: Option<&Value>,
) -> String {
    let mut output_items: Vec<Value> = Vec::new();

    if !acc_content.is_empty() {
        output_items.push(json!({
            "type": "message",
            "role": "assistant",
            "content": [{ "type": "output_text", "text": acc_content }]
        }));
    }

    // Slots are pre-allocated by index as deltas arrive, so a slot may never
    // have received a name. Those are incomplete and must not be emitted.
    for tool_call in acc_tool_calls {
        if !tool_call
            .get("name")
            .and_then(Value::as_str)
            .unwrap_or("")
            .is_empty()
        {
            output_items.push(tool_call.clone());
        }
    }

    let mut resp = json!({
        "type": "response",
        "id": format!("resp_{}", uuid()),
        "status": map_finish_reason(finish_reason),
        "output": output_items,
        "usage": {
            "input_tokens": 0,
            "output_tokens": 0
        }
    });
    if !model.is_empty() {
        resp["model"] = Value::String(model.to_string());
    }
    if let Some(usage) = usage_info {
        resp["usage"] = usage.clone();
    }

    format!(
        "data: {}\n\ndata: [DONE]\n\n",
        serde_json::to_string(&resp).unwrap()
    )
}

pub(super) async fn chat_sse_to_responses_sse(
    byte_stream: impl futures_util::Stream<Item = Result<bytes::Bytes, reqwest::Error>> + Unpin,
) -> Result<String, String> {
    use futures_util::StreamExt;

    let mut acc_content = String::new();
    let mut acc_tool_calls: Vec<Value> = Vec::new();
    let mut model = String::new();
    let mut finish_reason = String::new();
    let mut usage_info: Option<Value> = None;
    let mut is_first = true;
    let mut output = String::new();

    let mut stream = byte_stream;

    while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result.map_err(|e| e.to_string())?;
        let text = String::from_utf8_lossy(&chunk);

        for line in text.lines() {
            let line = line.trim();
            if !line.starts_with("data: ") {
                continue;
            }
            let data = &line[6..];
            if data == "[DONE]" {
                output.push_str(&final_response_frames(
                    &acc_content,
                    &acc_tool_calls,
                    &model,
                    &finish_reason,
                    usage_info.as_ref(),
                ));
                return Ok(output);
            }

            if data.is_empty() || data == "data: [DONE]" {
                continue;
            }

            let Ok(cc_event) = serde_json::from_str::<Value>(data) else {
                continue;
            };

            // Extract model from first chunk
            if model.is_empty() {
                if let Some(m) = cc_event.get("model").and_then(Value::as_str) {
                    model = m.to_string();
                }
            }

            // Extract usage
            if let Some(u) = cc_event.get("usage") {
                usage_info = Some(u.clone());
            }

            let choices = match cc_event.get("choices").and_then(Value::as_array) {
                Some(c) if !c.is_empty() => c,
                _ => continue,
            };
            let delta = &choices[0].get("delta").unwrap_or(&Value::Null);
            let fr = choices[0].get("finish_reason").and_then(Value::as_str).unwrap_or("");

            if !fr.is_empty() {
                finish_reason = fr.to_string();
            }

            // Process content delta
            if let Some(text) = delta.get("content").and_then(Value::as_str) {
                if !text.is_empty() {
                    acc_content.push_str(text);
                    // Send as output_text delta
                    let chunk_resp = json!({
                        "type": "response_output_text.delta",
                        "delta": text,
                        "output_index": 0
                    });
                    output.push_str(&format!("data: {}\n\n", serde_json::to_string(&chunk_resp).unwrap()));
                }
            }

            // Process reasoning content
            if let Some(reasoning) = delta.get("reasoning_content").and_then(Value::as_str) {
                if !reasoning.is_empty() {
                    // Same output block as regular content: both stream into the
                    // single assistant message, which is always item 0.
                    let chunk_resp = json!({
                        "type": "response_output_text.delta",
                        "delta": reasoning,
                        "output_index": 0
                    });
                    output.push_str(&format!("data: {}\n\n", serde_json::to_string(&chunk_resp).unwrap()));
                }
            }

            // Process tool call deltas
            if let Some(tc_deltas) = delta.get("tool_calls").and_then(Value::as_array) {
                for (idx, tc_delta) in tc_deltas.iter().enumerate() {
                    // Ensure we have enough accumulator slots
                    while acc_tool_calls.len() <= idx {
                        acc_tool_calls.push(json!({
                            "type": "function_call",
                            "name": "",
                            "arguments": "",
                            "call_id": ""
                        }));
                    }

                    if let Some(name) = tc_delta.get("function").and_then(|f| f.get("name")).and_then(Value::as_str) {
                        if !name.is_empty() {
                            acc_tool_calls[idx]["name"] = Value::String(name.to_string());
                        }
                    }
                    if let Some(args) = tc_delta.get("function").and_then(|f| f.get("arguments")).and_then(Value::as_str) {
                        if !args.is_empty() {
                            let current = acc_tool_calls[idx]["arguments"].as_str().unwrap_or("");
                            acc_tool_calls[idx]["arguments"] = Value::String(format!("{}{}", current, args));
                        }
                    }
                    if let Some(id) = tc_delta.get("id").and_then(Value::as_str) {
                        if !id.is_empty() {
                            acc_tool_calls[idx]["call_id"] = Value::String(id.to_string());
                        }
                    }
                    // NOTE: the upstream delta's `type` is deliberately not copied.
                    // Chat Completions labels tool calls `"function"`; the Responses
                    // format this accumulator is building calls them
                    // `"function_call"`, which is how the slot is initialised above.
                    // Copying the field across formats overwrote a valid item type
                    // with one Codex does not recognise.

                    // Send function_call_arguments.delta event
                    let args_delta = tc_delta
                        .get("function")
                        .and_then(|f| f.get("arguments"))
                        .and_then(Value::as_str)
                        .unwrap_or("");
                    if !args_delta.is_empty() {
                        let chunk_resp = json!({
                            "type": "response_function_call_arguments.delta",
                            "delta": args_delta,
                            "item_index": idx
                        });
                        output.push_str(&format!("data: {}\n\n", serde_json::to_string(&chunk_resp).unwrap()));
                    }
                }
            }

            if is_first && !finish_reason.is_empty() {
                is_first = false;
                // Send item.created events for accumulated output
                if !acc_content.is_empty() {
                    let item = json!({
                        "type": "message",
                        "role": "assistant",
                        "content": [{ "type": "output_text", "text": "" }]
                    });
                    let event = json!({
                        "type": "response.created",
                        "response": {
                            "id": format!("resp_{}", uuid()),
                            "status": "in_progress",
                            "output": [item]
                        }
                    });
                    output.push_str(&format!("data: {}\n\n", serde_json::to_string(&event).unwrap()));
                }
                for tc in acc_tool_calls.iter() {
                    if !tc.get("name").and_then(Value::as_str).unwrap_or("").is_empty() {
                        let item = json!({
                            "type": "function_call",
                            "name": tc["name"].as_str().unwrap_or(""),
                            "arguments": "",
                            "call_id": tc["call_id"].as_str().unwrap_or("")
                        });
                        let event = json!({
                            "type": "response.created",
                            "response": {
                                "id": format!("resp_{}", uuid()),
                                "status": "in_progress",
                                "output": [item]
                            }
                        });
                        output.push_str(&format!("data: {}\n\n", serde_json::to_string(&event).unwrap()));
                    }
                }
            }
        }
    }

    // If stream ended without [DONE], emit final response
    if !output.is_empty() && !output.contains("[DONE]") {
        output.push_str(&final_response_frames(
            &acc_content,
            &acc_tool_calls,
            &model,
            &finish_reason,
            usage_info.as_ref(),
        ));
    }

    if output.is_empty() {
        Ok("data: [DONE]\n\n".to_string())
    } else {
        Ok(output)
    }
}

// ---------------------------------------------------------------------------
// HTTP utilities
// ---------------------------------------------------------------------------

fn uuid() -> String {
    use std::sync::atomic::{AtomicU64, Ordering};
    static COUNTER: AtomicU64 = AtomicU64::new(0);
    let id = COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("{:016x}", id)
}

#[cfg(test)]
mod tests;
