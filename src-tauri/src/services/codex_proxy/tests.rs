use super::*;

/// Extract the JSON payload of every `data: {...}` frame, skipping `[DONE]`.
fn parse_frames(sse: &str) -> Vec<Value> {
    sse.lines()
        .filter_map(|line| line.strip_prefix("data: "))
        .filter(|data| *data != "[DONE]")
        .map(|data| serde_json::from_str::<Value>(data).expect("frame should be valid JSON"))
        .collect()
}

/// The terminal `response` event, i.e. the full snapshot the client relies on.
fn terminal_response(sse: &str) -> Value {
    parse_frames(sse)
        .into_iter()
        .find(|frame| frame.get("type").and_then(Value::as_str) == Some("response"))
        .expect("stream should end with a `response` frame")
}

fn output_items(response: &Value) -> &Vec<Value> {
    response
        .get("output")
        .and_then(Value::as_array)
        .expect("response should carry an output array")
}

fn tool_call(name: &str, arguments: &str, call_id: &str) -> Value {
    json!({
        "type": "function_call",
        "name": name,
        "arguments": arguments,
        "call_id": call_id
    })
}

fn chunk(text: &str) -> Result<bytes::Bytes, reqwest::Error> {
    Ok(bytes::Bytes::from(text.to_string()))
}

async fn translate(chunks: Vec<&str>) -> String {
    let stream = futures_util::stream::iter(
        chunks.into_iter().map(chunk).collect::<Vec<_>>(),
    );
    chat_sse_to_responses_sse(stream)
        .await
        .expect("translation should succeed")
}

#[test]
fn final_frames_carry_both_text_and_tool_calls() {
    let sse = final_response_frames(
        "hello",
        &[tool_call("read_file", "{\"path\":\"a.txt\"}", "call_1")],
        "gpt-4o-mini",
        "tool_calls",
        None,
    );

    let response = terminal_response(&sse);
    let items = output_items(&response);
    assert_eq!(items.len(), 2, "expected a message and a function_call");
    assert_eq!(items[0]["type"], "message");
    assert_eq!(items[1]["type"], "function_call");
    assert_eq!(items[1]["name"], "read_file");
    assert_eq!(response["model"], "gpt-4o-mini");
    assert_eq!(response["status"], "completed");
    assert!(sse.ends_with("data: [DONE]\n\n"));
}

#[test]
fn final_frames_skip_tool_call_slots_that_never_got_a_name() {
    // Slots are pre-allocated by delta index, so a truncated stream can leave
    // an empty one behind. Emitting it would produce an uncallable tool call.
    let sse = final_response_frames(
        "",
        &[tool_call("", "", ""), tool_call("read_file", "{}", "call_1")],
        "",
        "stop",
        None,
    );

    let response = terminal_response(&sse);
    let items = output_items(&response);
    assert_eq!(items.len(), 1);
    assert_eq!(items[0]["name"], "read_file");
    assert!(
        response.get("model").is_none(),
        "an unknown model should be omitted rather than sent as an empty string"
    );
}

#[test]
fn final_frames_prefer_upstream_usage_over_the_zero_placeholder() {
    let usage = json!({ "input_tokens": 11, "output_tokens": 22 });
    let sse = final_response_frames("hi", &[], "m", "stop", Some(&usage));

    assert_eq!(terminal_response(&sse)["usage"], usage);
}

/// Regression guard: on a normal completion (upstream sends `[DONE]`) the
/// terminal snapshot used to be built by a separate copy of the assembly logic
/// that never appended the accumulated tool calls, so every tool call the model
/// requested was silently dropped.
#[tokio::test]
async fn done_terminated_stream_keeps_tool_calls() {
    let sse = translate(vec![
        "data: {\"model\":\"gpt-4o-mini\",\"choices\":[{\"delta\":{\"tool_calls\":[{\"index\":0,\"id\":\"call_1\",\"type\":\"function\",\"function\":{\"name\":\"read_file\",\"arguments\":\"{\\\"path\\\":\"}}]},\"finish_reason\":null}]}\n\n",
        "data: {\"choices\":[{\"delta\":{\"tool_calls\":[{\"index\":0,\"function\":{\"arguments\":\"\\\"a.txt\\\"}\"}}]},\"finish_reason\":\"tool_calls\"}]}\n\n",
        "data: [DONE]\n\n",
    ])
    .await;

    let response = terminal_response(&sse);
    let items = output_items(&response);
    assert_eq!(items.len(), 1, "the function_call must survive to the snapshot");
    assert_eq!(items[0]["name"], "read_file");
    assert_eq!(items[0]["call_id"], "call_1");
    // Arguments arrive split across chunks and must be concatenated.
    assert_eq!(items[0]["arguments"], "{\"path\":\"a.txt\"}");
    assert_eq!(response["model"], "gpt-4o-mini");
}

/// The upstream delta's `"type":"function"` (Chat Completions vocabulary) used
/// to overwrite the slot's `"function_call"` (Responses vocabulary), leaving an
/// item type Codex does not recognise.
#[tokio::test]
async fn tool_call_items_keep_the_responses_item_type() {
    let sse = translate(vec![
        "data: {\"choices\":[{\"delta\":{\"tool_calls\":[{\"index\":0,\"id\":\"call_1\",\"type\":\"function\",\"function\":{\"name\":\"read_file\",\"arguments\":\"{}\"}}]},\"finish_reason\":\"tool_calls\"}]}\n\n",
        "data: [DONE]\n\n",
    ])
    .await;

    let items = output_items(&terminal_response(&sse)).clone();
    assert_eq!(items[0]["type"], "function_call");
}

/// The two stream endings must agree. Only the terminating signal differs here.
#[tokio::test]
async fn stream_ending_without_done_matches_the_done_path() {
    let deltas = "data: {\"model\":\"m\",\"choices\":[{\"delta\":{\"content\":\"hi\",\"tool_calls\":[{\"index\":0,\"id\":\"call_1\",\"type\":\"function\",\"function\":{\"name\":\"read_file\",\"arguments\":\"{}\"}}]},\"finish_reason\":\"tool_calls\"}]}\n\n";

    let with_done = translate(vec![deltas, "data: [DONE]\n\n"]).await;
    let without_done = translate(vec![deltas]).await;

    let strip_id = |sse: &str| {
        let mut response = terminal_response(sse);
        // Ids are generated per call, so they cannot be compared directly.
        response.as_object_mut().unwrap().remove("id");
        response
    };

    assert_eq!(strip_id(&with_done), strip_id(&without_done));
}

#[tokio::test]
async fn text_only_stream_produces_a_single_message_item() {
    let sse = translate(vec![
        "data: {\"model\":\"m\",\"choices\":[{\"delta\":{\"content\":\"Hel\"},\"finish_reason\":null}]}\n\n",
        "data: {\"choices\":[{\"delta\":{\"content\":\"lo\"},\"finish_reason\":\"stop\"}]}\n\n",
        "data: [DONE]\n\n",
    ])
    .await;

    let items = output_items(&terminal_response(&sse)).clone();
    assert_eq!(items.len(), 1);
    assert_eq!(items[0]["type"], "message");
    assert_eq!(items[0]["content"][0]["text"], "Hello");
}

#[tokio::test]
async fn empty_stream_still_terminates_the_sse_body() {
    let sse = translate(vec![]).await;
    assert_eq!(sse, "data: [DONE]\n\n");
}
