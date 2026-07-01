use crate::models::config::LlmProviderConfig;
use crate::services::config_manager::ConfigManager;
use reqwest::header::{AUTHORIZATION, CONTENT_TYPE};
use serde::{Deserialize, Serialize};
use std::time::Duration;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub id: String,
    #[serde(default)]
    pub owned_by: Option<String>,
}

#[tauri::command]
pub async fn fetch_models_for_config(
    base_url: String,
    api_key: String,
    is_full_url: bool,
    models_url: Option<String>,
) -> Result<Vec<ModelInfo>, String> {
    let trimmed_url = base_url.trim().trim_end_matches('/');
    if trimmed_url.is_empty() {
        return Err("Base URL is required".to_string());
    }

    let url = if let Some(murl) = models_url {
        if !murl.starts_with("http://") && !murl.starts_with("https://") {
            return Err("Invalid models URL".to_string());
        }
        murl
    } else if is_full_url {
        trimmed_url.to_string()
    } else {
        format!("{}/v1/models", trimmed_url)
    };

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .connect_timeout(Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    let response = client
        .get(&url)
        .header(CONTENT_TYPE, "application/json")
        .header(AUTHORIZATION, format!("Bearer {}", api_key))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let status = response.status();
    if !status.is_success() {
        let text = response.text().await.unwrap_or_default();
        return Err(format!("HTTP {}: {}", status.as_u16(), text));
    }

    #[derive(Deserialize)]
    struct ModelsResponse {
        data: Vec<RawModel>,
    }

    #[derive(Deserialize)]
    struct RawModel {
        id: String,
        owned_by: Option<String>,
    }

    let resp: ModelsResponse = response.json().await.map_err(|e| e.to_string())?;
    let models: Vec<ModelInfo> = resp
        .data
        .into_iter()
        .map(|m| ModelInfo {
            id: m.id,
            owned_by: m.owned_by,
        })
        .collect();

    Ok(models)
}

#[tauri::command]
pub fn get_llm_providers() -> Result<Vec<LlmProviderConfig>, String> {
    let manager = ConfigManager::new();
    let config = manager.load()?;
    let mut providers = config.llm_providers;
    for p in &mut providers {
        if p.api_format.is_empty() {
            p.api_format = "openai".to_string();
        }
    }
    Ok(providers)
}

#[tauri::command]
pub fn save_llm_provider_multi(mut provider: LlmProviderConfig) -> Result<LlmProviderConfig, String> {
    // Auto-detect api_format based on which URLs are configured
    // (only if not already set by the caller)
    if provider.api_format.is_empty() {
        provider.api_format = if !provider.base_url_anthropic.trim().is_empty() {
            "anthropic".to_string()
        } else {
            "openai".to_string()
        };
    }
    let manager = ConfigManager::new();
    let mut config = manager.load()?;

    // Check if provider with same id exists, update or push
    if let Some(pos) = config.llm_providers.iter().position(|p| p.id == provider.id) {
        config.llm_providers[pos] = provider.clone();
    } else {
        config.llm_providers.push(provider.clone());
    }

    // If this is the first provider, set it as active
    if config.active_provider_id.is_none() {
        config.active_provider_id = Some(provider.id.clone());
    }

    manager.save(&config)?;
    Ok(provider)
}

#[tauri::command]
pub fn delete_llm_provider(id: String) -> Result<bool, String> {
    let manager = ConfigManager::new();
    let mut config = manager.load()?;
    config.llm_providers.retain(|p| p.id != id);

    // If deleted provider was active, clear or switch
    if config.active_provider_id == Some(id.clone()) {
        config.active_provider_id = config.llm_providers.first().map(|p| p.id.clone());
    }

    manager.save(&config)?;
    Ok(true)
}

#[tauri::command]
pub fn multi_switch_llm_provider(id: String) -> Result<bool, String> {
    let manager = ConfigManager::new();
    let mut config = manager.load()?;

    // Verify provider exists
    if !config.llm_providers.iter().any(|p| p.id == id) {
        return Err(format!("Provider {} not found", id));
    }

    config.active_provider_id = Some(id);
    manager.save(&config)?;
    Ok(true)
}

#[tauri::command]
pub fn get_tool_bindings() -> Result<std::collections::HashMap<String, String>, String> {
    let manager = ConfigManager::new();
    let config = manager.load()?;
    Ok(config.tool_bindings)
}

#[tauri::command]
pub fn save_tool_bindings(
    bindings: std::collections::HashMap<String, String>,
) -> Result<bool, String> {
    let manager = ConfigManager::new();
    let mut config = manager.load()?;
    config.tool_bindings = bindings;
    manager.save(&config)?;
    Ok(true)
}

#[tauri::command]
pub fn get_active_provider() -> Result<Option<LlmProviderConfig>, String> {
    let manager = ConfigManager::new();
    let config = manager.load()?;

    let mut provider = if let Some(active_id) = &config.active_provider_id {
        config.llm_providers.iter().find(|p| &p.id == active_id).cloned()
    } else {
        config.llm_providers.first().cloned()
    };

    if let Some(ref mut p) = provider {
        if p.api_format.is_empty() {
            p.api_format = "openai".to_string();
        }
    }

    Ok(provider)
}
