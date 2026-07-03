use crate::services::codex_proxy;

/// Start the protocol proxy for Codex. The proxy translates Responses API
/// calls from Codex into Chat Completions calls for the upstream provider.
#[tauri::command]
pub async fn start_codex_proxy(
    port: u16,
    upstream_base_url: String,
    upstream_api_key: String,
    upstream_model: String,
) -> Result<String, String> {
    codex_proxy::start_proxy(port, upstream_base_url, upstream_api_key, upstream_model)
        .await?;
    Ok(codex_proxy::proxy_base_url(port))
}

/// Update the upstream config on the running proxy without rebinding.
#[tauri::command]
pub async fn update_codex_proxy_config(
    upstream_base_url: String,
    upstream_api_key: String,
    upstream_model: String,
) -> Result<(), String> {
    codex_proxy::update_proxy_config(upstream_base_url, upstream_api_key, upstream_model)
        .await;
    Ok(())
}

/// Stop the protocol proxy.
#[tauri::command]
pub fn stop_codex_proxy() -> Result<(), String> {
    codex_proxy::stop_proxy();
    Ok(())
}
