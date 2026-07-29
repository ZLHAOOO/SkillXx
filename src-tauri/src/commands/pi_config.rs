use crate::models::config::LlmProviderConfig;
use serde_json::Value;

/// Read Pi's `models.json`. Returns the full JSON so UI can display it if
/// needed. Missing file returns an empty object.
#[tauri::command]
pub fn read_pi_providers() -> Result<Value, String> {
    crate::services::pi_config::read_config()
}

/// Apply a SkillX provider to Pi's `models.json` (upsert `providers.skillx`).
///
/// `protocol` should be `"openai"` (default) or `"anthropic"`; picked up from
/// the front-end `ApplyModelInfo.protocol`.
#[tauri::command]
pub fn apply_pi_provider(
    provider: LlmProviderConfig,
    protocol: String,
) -> Result<String, String> {
    crate::services::pi_config::apply_provider(&provider, &protocol)
}

/// Remove SkillX-managed provider entry from Pi's `models.json`.
#[tauri::command]
pub fn clear_pi_provider() -> Result<String, String> {
    crate::services::pi_config::clear_provider()
}

/// List available Pi config backups.
#[tauri::command]
pub fn list_pi_backups() -> Result<Vec<String>, String> {
    crate::services::pi_config::backup_dir()
        .map(|dir| {
            std::fs::read_dir(&dir)
                .map(|entries| {
                    entries
                        .filter_map(|e| e.ok())
                        .filter(|e| {
                            e.file_name()
                                .to_string_lossy()
                                .starts_with("models.json.bak-")
                        })
                        .map(|e| e.file_name().to_string_lossy().into_owned())
                        .collect()
                })
                .unwrap_or_default()
        })
        .map_err(|e| format!("Failed to list Pi backups: {e}"))
}
