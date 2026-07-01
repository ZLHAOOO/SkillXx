use crate::models::config::LlmProviderConfig;

/// Read Hermes profile config (env section)
#[tauri::command]
pub fn read_hermes_env(
    profile_name: String,
) -> Result<std::collections::HashMap<String, String>, String> {
    crate::services::hermes_config::read_profile_config(&profile_name)
        .map(|c| c.env)
}

/// Write a provider's config into Hermes profile settings.json
#[tauri::command]
pub fn apply_hermes_provider(
    profile_name: String,
    provider: LlmProviderConfig,
) -> Result<String, String> {
    crate::services::hermes_config::apply_provider(&profile_name, &provider)
}

/// Clear Hermes provider config (with auto-backup)
#[tauri::command]
pub fn clear_hermes_provider(
    profile_name: String,
) -> Result<String, String> {
    crate::services::hermes_config::clear_provider(&profile_name)
}

/// List all available Hermes config backups
#[tauri::command]
pub fn list_hermes_backups(
    profile_name: String,
) -> Result<Vec<String>, String> {
    crate::services::hermes_config::list_backups(&profile_name)
}

/// Restart Hermes (kills and relaunches the process)
#[tauri::command]
pub fn restart_hermes_cmd() -> Result<String, String> {
    crate::services::hermes_config::restart_hermes()
}
