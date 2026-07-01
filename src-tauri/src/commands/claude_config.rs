use crate::models::config::LlmProviderConfig;

/// Read Claude Code's current environment config (the ANTHROPIC_* vars)
#[tauri::command]
pub fn read_claude_env() -> Result<std::collections::HashMap<String, String>, String> {
    use crate::services::claude_config::ClaudeConfig;
    let config = ClaudeConfig::read()?;
    Ok(config.env)
}

/// Write a provider's config into Claude Code's settings.json env section
/// Automatically creates a backup before writing.
/// Claude Code always uses Anthropic protocol, so we always write the
/// Anthropic URL regardless of the provider's api_format setting.
#[tauri::command]
pub fn apply_claude_provider(provider: LlmProviderConfig) -> Result<String, String> {
    use crate::services::claude_config::{ClaudeConfig, ProviderEnvConfig};

    // Claude Code is an Anthropic product — always use Anthropic URL
    let base_url = if !provider.base_url_anthropic.is_empty() {
        provider.base_url_anthropic.clone()
    } else {
        provider.base_url.clone()
    };

    let config = ClaudeConfig::read()?;
    let env_config = ProviderEnvConfig {
        api_key: provider.api_key,
        base_url: base_url.clone(),
        base_url_anthropic: base_url,
        model: provider.model,
    };
    config.apply_provider(&env_config)
}

/// Write raw provider config into Claude Code's settings.json
#[tauri::command]
pub fn write_claude_env(
    env_config: crate::services::claude_config::ProviderEnvConfig,
) -> Result<String, String> {
    use crate::services::claude_config::ClaudeConfig;
    let config = ClaudeConfig::read()?;
    config.apply_provider(&env_config)
}

/// Clear all ANTHROPIC_* env vars from Claude Code's settings
/// Automatically creates a backup before clearing.
#[tauri::command]
pub fn clear_claude_provider() -> Result<String, String> {
    use crate::services::claude_config::ClaudeConfig;
    ClaudeConfig::clear_provider()
}

/// List all available Claude Code config backups
#[tauri::command]
pub fn list_claude_backups() -> Result<Vec<String>, String> {
    crate::services::claude_config::list_backups()
}

/// Restore Claude Code config from a specific backup
#[tauri::command]
pub fn restore_claude_backup(backup_name: String) -> Result<(), String> {
    crate::services::claude_config::restore_backup(&backup_name)
}

/// Restart Claude Code (kills and relaunches the process)
#[tauri::command]
pub fn restart_claude_code_cmd() -> Result<String, String> {
    crate::services::claude_config::restart_claude_code()
}
