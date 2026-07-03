use crate::models::config::LlmProviderConfig;
use crate::services::{claude_config::ProviderEnvConfig, gemini_config, hermes_config};

/// Unified model info payload used by the apply_model_to_tool command
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ApplyModelInfo {
    pub id: String,
    pub name: String,
    pub base_url: String,
    pub base_url_anthropic: String,
    pub base_url_openai: String,
    pub api_key: String,
    pub model: String,
    pub protocol: String,
    pub relay_mode: Option<bool>,
    pub responses_passthrough: Option<bool>,
    pub one_m_context: Option<bool>,
}

/// Write a provider's model config to any supported tool in one call.
///
/// Dispatches based on `tool_id`:
/// - "claude-code"  → Claude Code settings.json
/// - "codex"        → Codex auth.json + config.toml
/// - "hermes-{profile}" → Hermes profile settings.json
/// - "hermes-default" → Default Hermes profile
/// - "gemini"       → Gemini CLI settings.json
#[tauri::command]
pub async fn apply_model_to_tool(
    tool_id: String,
    model_info: ApplyModelInfo,
) -> Result<String, String> {
    match tool_id.as_str() {
        "claude-code" => {
            // Claude Code always uses Anthropic URL
            let base_url = if !model_info.base_url_anthropic.is_empty() {
                model_info.base_url_anthropic.clone()
            } else {
                model_info.base_url.clone()
            };
            let env_config = ProviderEnvConfig {
                api_key: model_info.api_key.clone(),
                base_url: base_url.clone(),
                base_url_anthropic: base_url,
                model: model_info.model.clone(),
            };
            let config = crate::services::claude_config::ClaudeConfig::read()?;
            config.apply_provider(&env_config)
        }
        "codex" => {
            // Codex supports two modes:
            // 1. Proxy mode (default): local proxy translates Responses → Chat Completions
            //    for providers that don't support Responses API (Agnes, LongCat, etc.)
            // 2. Passthrough mode: write real URL directly, no proxy, for providers
            //    that natively support Responses API (StepFun, etc.)
            let use_passthrough = model_info.responses_passthrough.unwrap_or(false);
            if use_passthrough {
                crate::services::codex_config::apply_codex_provider_passthrough(
                    &model_info.api_key,
                    &model_info.base_url,
                    &model_info.model,
                    &model_info.name,
                )
            } else {
                crate::services::codex_config::apply_codex_provider(
                    &model_info.api_key,
                    &model_info.base_url,
                    &model_info.model,
                    &model_info.name,
                )
            }
        }
        "hermes-default" => {
            let base_url = if !model_info.base_url_openai.is_empty() {
                model_info.base_url_openai.clone()
            } else {
                model_info.base_url.clone()
            };
            let provider = LlmProviderConfig {
                id: model_info.id.clone(),
                name: model_info.name.clone(),
                base_url: base_url.clone(),
                base_url_openai: model_info.base_url_openai.clone(),
                base_url_anthropic: model_info.base_url_anthropic.clone(),
                api_key: model_info.api_key.clone(),
                model: model_info.model.clone(),
                models: vec![],
                api_format: model_info.protocol.clone(),
                temperature: None,
                max_tokens: None,
                timeout_secs: None,
                website_url: None,
            };
            hermes_config::apply_provider("default", &provider)
        }
        name if name.starts_with("hermes-") => {
            let profile_name = name.strip_prefix("hermes-").unwrap_or("default");
            let base_url = if !model_info.base_url_openai.is_empty() {
                model_info.base_url_openai.clone()
            } else {
                model_info.base_url.clone()
            };
            let provider = LlmProviderConfig {
                id: model_info.id.clone(),
                name: model_info.name.clone(),
                base_url: base_url.clone(),
                base_url_openai: model_info.base_url_openai.clone(),
                base_url_anthropic: model_info.base_url_anthropic.clone(),
                api_key: model_info.api_key.clone(),
                model: model_info.model.clone(),
                models: vec![],
                api_format: model_info.protocol.clone(),
                temperature: None,
                max_tokens: None,
                timeout_secs: None,
                website_url: None,
            };
            hermes_config::apply_provider(profile_name, &provider)
        }
        "gemini" => {
            let base_url = if !model_info.base_url_openai.is_empty() {
                model_info.base_url_openai.clone()
            } else {
                model_info.base_url.clone()
            };
            gemini_config::apply_provider(
                &model_info.api_key,
                &base_url,
                &model_info.model,
            )
        }
        _ => Err(format!("Unsupported tool: {}", tool_id)),
    }
}
