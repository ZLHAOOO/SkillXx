use crate::models::config::LlmProviderConfig;

/// Read Gemini CLI's current environment config (GEMINI_* env vars)
#[tauri::command]
pub fn read_gemini_env() -> Result<std::collections::HashMap<String, String>, String> {
    crate::services::gemini_config::read_config()
        .map(|c| c.env)
        .map_err(|e| format!("Failed to read Gemini config: {e}"))
}

/// Apply a provider's config to Gemini CLI's settings.json
/// Gemini CLI uses env vars: GEMINI_API_KEY, GEMINI_BASE_URL, GEMINI_MODEL
#[tauri::command]
pub fn apply_gemini_provider(provider: LlmProviderConfig) -> Result<String, String> {
    crate::services::gemini_config::apply_provider(
        &provider.api_key,
        &provider.base_url,
        &provider.model,
    )
}

/// Clear Gemini CLI provider config (with auto-backup)
#[tauri::command]
pub fn clear_gemini_provider() -> Result<String, String> {
    crate::services::gemini_config::clear_provider()
}

/// List all available Gemini config backups
#[tauri::command]
pub fn list_gemini_backups() -> Result<Vec<String>, String> {
    crate::services::gemini_config::backup_dir()
        .map(|dir| {
            std::fs::read_dir(&dir)
                .map(|entries| {
                    entries
                        .filter_map(|e| e.ok())
                        .filter(|e| {
                            e.file_name()
                                .to_string_lossy()
                                .starts_with("settings.json.bak-")
                        })
                        .map(|e| e.file_name().to_string_lossy().into_owned())
                        .collect()
                })
                .unwrap_or_default()
        })
        .map_err(|e| format!("Failed to list Gemini backups: {e}"))
}
