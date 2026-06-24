use crate::models::config::LlmProviderConfig;

/// Read Claude Code's current environment config (the ANTHROPIC_* vars)
#[tauri::command]
pub fn read_claude_env() -> Result<std::collections::HashMap<String, String>, String> {
    use crate::services::claude_config::ClaudeConfig;
    let config = ClaudeConfig::read()?;
    Ok(config.env)
}

/// Write a provider's config into Claude Code's settings.json env section
#[tauri::command]
pub fn apply_claude_provider(provider: LlmProviderConfig) -> Result<(), String> {
    use crate::services::claude_config::{ClaudeConfig, ProviderEnvConfig};
    let config = ClaudeConfig::read()?;
    // Always use Anthropic-format URL for Claude Code, since Claude Code
    // communicates using Anthropic's API protocol. If the provider was configured
    // with OpenAI format, base_url would contain the wrong URL.
    let base_url = if !provider.base_url_anthropic.is_empty() {
        provider.base_url_anthropic
    } else {
        provider.base_url
    };
    let env_config = ProviderEnvConfig {
        api_key: provider.api_key,
        base_url,
        model: provider.model,
    };
    config.apply_provider(&env_config)
}

/// Write raw provider config into Claude Code's settings.json
#[tauri::command]
pub fn write_claude_env(env_config: crate::services::claude_config::ProviderEnvConfig) -> Result<(), String> {
    use crate::services::claude_config::ClaudeConfig;
    let config = ClaudeConfig::read()?;
    config.apply_provider(&env_config)
}

/// Clear all ANTHROPIC_* env vars from Claude Code's settings
#[tauri::command]
pub fn clear_claude_provider() -> Result<(), String> {
    use crate::services::claude_config::ClaudeConfig;
    ClaudeConfig::clear_provider()
}

/// Restart Claude Code (kills and relaunches the process)
#[tauri::command]
pub fn restart_claude_code_cmd() -> Result<String, String> {
    crate::services::claude_config::restart_claude_code()
}
