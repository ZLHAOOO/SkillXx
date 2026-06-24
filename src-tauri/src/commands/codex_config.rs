use crate::models::config::LlmProviderConfig;

/// Read Codex's current config (auth.json + config.toml)
#[tauri::command]
pub fn read_codex_env() -> Result<std::collections::HashMap<String, String>, String> {
    crate::services::codex_config::read_codex_live()
}

/// Write a provider's config into Codex's auth.json and config.toml.
///
/// For providers with api_format="openai" (which don't natively speak the
/// Responses API), a local protocol proxy translates Responses ↔ Chat
/// Completions. The config.toml base_url points to localhost instead of
/// the real upstream.
#[tauri::command]
pub async fn apply_codex_provider(provider: LlmProviderConfig) -> Result<(), String> {
    // Determine whether we need the protocol proxy.
    // Providers with api_format="openai" speak Chat Completions, but Codex
    // only speaks Responses API. The local proxy bridges this gap.
    let needs_proxy = provider.api_format == "openai"
        || (provider.api_format.is_empty() && !provider.base_url_openai.is_empty());

    if needs_proxy {
        let upstream_url = if !provider.base_url_openai.is_empty() {
            provider.base_url_openai.clone()
        } else {
            provider.base_url.clone()
        };

        // Start or update the local proxy
        let port = crate::services::codex_proxy::ensure_proxy_running(
            upstream_url,
            provider.api_key.clone(),
            provider.model.clone(),
        )
        .await?;

        // Write config pointing to local proxy
        let proxy_url = crate::services::codex_proxy::proxy_base_url(port);
        crate::services::codex_config::apply_codex_provider(
            &provider.api_key,
            &proxy_url,
            &provider.model,
            &provider.name,
        )?;
    } else {
        // Direct mode: provider speaks Responses API natively
        let base_url = if !provider.base_url_openai.is_empty() {
            provider.base_url_openai
        } else {
            provider.base_url
        };

        crate::services::codex_config::apply_codex_provider(
            &provider.api_key,
            &base_url,
            &provider.model,
            &provider.name,
        )?;
    }

    Ok(())
}

/// Clear Codex provider config
#[tauri::command]
pub fn clear_codex_provider() -> Result<(), String> {
    crate::services::codex_config::clear_codex_provider()
}

/// Restart Codex (kills and relaunches the process)
#[tauri::command]
pub fn restart_codex_cmd() -> Result<String, String> {
    crate::services::codex_config::restart_codex()
}
