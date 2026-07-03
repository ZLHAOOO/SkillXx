use crate::models::config::LlmProviderConfig;

/// Read Codex's current config (auth.json + config.toml)
#[tauri::command]
pub fn read_codex_env() -> Result<std::collections::HashMap<String, String>, String> {
    crate::services::codex_config::read_codex_live()
}

/// Write a provider's config into Codex's auth.json and config.toml.
///
/// Uses a local protocol proxy to translate Codex Responses API calls into
/// Chat Completions calls for the upstream provider. This supports both
/// Responses-native providers (StepFun) and Chat-only providers (Agnes,
/// LongCat, etc.) transparently.
#[tauri::command]
pub async fn apply_codex_provider(provider: LlmProviderConfig) -> Result<String, String> {
    // Pass the raw base_url — the proxy handles URL construction
    crate::services::codex_config::apply_codex_provider(
        &provider.api_key,
        &provider.base_url,
        &provider.model,
        &provider.name,
    )
}

/// Write a provider's config using Responses API passthrough (no proxy).
/// Only for providers that natively support the Responses API (e.g., StepFun).
#[tauri::command]
pub async fn apply_codex_provider_passthrough(provider: LlmProviderConfig) -> Result<String, String> {
    crate::services::codex_config::apply_codex_provider_passthrough(
        &provider.api_key,
        &provider.base_url,
        &provider.model,
        &provider.name,
    )
}

/// Clear Codex provider config (with auto-backup)
#[tauri::command]
pub fn clear_codex_provider() -> Result<String, String> {
    crate::services::codex_config::clear_codex_provider()
}

/// Restore Codex to original OpenAI configuration
#[tauri::command]
pub fn restore_codex_original() -> Result<String, String> {
    crate::services::codex_config::restore_codex_original()
}

/// List all available Codex config backups (auth and config separately)
#[tauri::command]
pub fn list_codex_backups(
    file_prefix: String,
) -> Result<Vec<String>, String> {
    crate::services::codex_config::list_backups(&file_prefix)
}

/// Restore Codex config from a specific backup
#[tauri::command]
pub fn restore_codex_backup(
    file_prefix: String,
    backup_name: String,
) -> Result<(), String> {
    crate::services::codex_config::restore_backup(&file_prefix, &backup_name)
}

/// Restart Codex (kills and relaunches the process)
#[tauri::command]
pub fn restart_codex_cmd() -> Result<String, String> {
    crate::services::codex_config::restart_codex()
}
