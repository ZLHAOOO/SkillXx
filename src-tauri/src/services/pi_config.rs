//! Pi (`@earendil-works/pi-coding-agent`) provider integration.
//!
//! Pi reads custom providers from `~/.pi/agent/models.json`. We add / update a
//! single entry keyed `providers.skillx`; Pi picks up changes the next time
//! `pi` starts or `/model` is opened (see the vendored docs at
//! `~/.local/lib/node_modules/@earendil-works/pi-coding-agent/docs/models.md`).

use crate::models::config::LlmProviderConfig;
use serde_json::{Map, Value};
use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

/// Key used inside `models.json` -> `providers` for the SkillX-managed entry.
const SKILLX_PROVIDER_KEY: &str = "skillx";

/// Maximum number of backups to keep.
const MAX_BACKUPS: usize = 5;

fn home() -> Result<PathBuf, String> {
    dirs::home_dir().ok_or_else(|| "Failed to get home directory".to_string())
}

/// Path to Pi's `models.json` (`~/.pi/agent/models.json`).
pub fn models_path() -> Result<PathBuf, String> {
    Ok(home()?.join(".pi").join("agent").join("models.json"))
}

/// Directory for storing Pi config backups.
pub fn backup_dir() -> Result<PathBuf, String> {
    Ok(home()?.join(".pi").join("agent").join("backups"))
}

fn backup_filename() -> String {
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    format!("models.json.bak-{}", ts)
}

/// Create a backup of the current `models.json` if it exists.
/// Returns the backup file name, or an empty string when there was nothing to
/// back up. Never fails if the file simply does not exist yet.
fn create_backup() -> Result<String, String> {
    let path = models_path()?;
    if !path.exists() {
        return Ok(String::new());
    }

    let dir = backup_dir()?;
    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create backup dir: {e}"))?;

    let backup_name = backup_filename();
    let backup_path = dir.join(&backup_name);

    fs::copy(&path, &backup_path)
        .map_err(|e| format!("Failed to copy models.json to backup: {e}"))?;

    // Prune old backups (keep only MAX_BACKUPS)
    let mut existing: Vec<fs::DirEntry> = fs::read_dir(&dir)
        .map_err(|e| format!("Failed to read backup dir: {e}"))?
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.file_name()
                .to_string_lossy()
                .starts_with("models.json.bak-")
        })
        .collect();

    existing.sort_by(|a, b| {
        let ta = a.metadata().ok().and_then(|m| m.modified().ok());
        let tb = b.metadata().ok().and_then(|m| m.modified().ok());
        tb.cmp(&ta)
    });

    for entry in existing.iter().skip(MAX_BACKUPS) {
        let _ = fs::remove_file(entry.path());
    }

    Ok(backup_name)
}

/// Read `models.json` into a `serde_json::Value`. Missing / empty file returns
/// an empty object.
pub fn read_config() -> Result<Value, String> {
    let path = models_path()?;
    if !path.exists() {
        return Ok(Value::Object(Map::new()));
    }
    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read {}: {}", path.display(), e))?;
    if content.trim().is_empty() {
        return Ok(Value::Object(Map::new()));
    }
    serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse {}: {}", path.display(), e))
}

fn write_config(value: &Value) -> Result<(), String> {
    let path = models_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create {}: {}", parent.display(), e))?;
    }
    let mut json = serde_json::to_string_pretty(value)
        .map_err(|e| format!("Failed to serialize models.json: {e}"))?;
    json.push('\n');
    fs::write(&path, json).map_err(|e| format!("Failed to write models.json: {e}"))?;
    Ok(())
}

/// Pick the base URL that matches the requested protocol, falling back to the
/// primary `base_url` when the protocol-specific field is empty.
fn resolve_base_url(provider: &LlmProviderConfig, protocol: &str) -> String {
    let candidate = if protocol.eq_ignore_ascii_case("anthropic") {
        &provider.base_url_anthropic
    } else {
        &provider.base_url_openai
    };
    if !candidate.is_empty() {
        candidate.clone()
    } else {
        provider.base_url.clone()
    }
}

fn resolve_api(protocol: &str) -> &'static str {
    if protocol.eq_ignore_ascii_case("anthropic") {
        "anthropic-messages"
    } else {
        "openai-completions"
    }
}

/// Build the Pi provider entry for the given SkillX provider.
fn build_provider_entry(provider: &LlmProviderConfig, protocol: &str) -> Value {
    let mut model_entry = Map::new();
    let model_id = if provider.model.is_empty() {
        provider.id.clone()
    } else {
        provider.model.clone()
    };
    let model_name = if provider.name.is_empty() {
        model_id.clone()
    } else {
        format!("{} {}", provider.name, model_id)
    };
    model_entry.insert("id".to_string(), Value::String(model_id));
    model_entry.insert("name".to_string(), Value::String(model_name));
    model_entry.insert(
        "contextWindow".to_string(),
        Value::Number(128_000.into()),
    );
    model_entry.insert("maxTokens".to_string(), Value::Number(16_384.into()));

    let mut entry = Map::new();
    let display_name = if provider.name.is_empty() {
        "SkillX".to_string()
    } else {
        format!("SkillX ({})", provider.name)
    };
    entry.insert("name".to_string(), Value::String(display_name));
    entry.insert(
        "baseUrl".to_string(),
        Value::String(resolve_base_url(provider, protocol)),
    );
    entry.insert(
        "api".to_string(),
        Value::String(resolve_api(protocol).to_string()),
    );
    entry.insert(
        "apiKey".to_string(),
        Value::String(provider.api_key.clone()),
    );
    entry.insert(
        "models".to_string(),
        Value::Array(vec![Value::Object(model_entry)]),
    );

    Value::Object(entry)
}

/// Upsert the SkillX provider entry into Pi's `models.json`.
pub fn apply_provider(
    provider: &LlmProviderConfig,
    protocol: &str,
) -> Result<String, String> {
    let backup_name = create_backup()?;

    let mut root = read_config()?;
    if !root.is_object() {
        // If someone hand-wrote a non-object at the root, replace with an
        // empty object so we can move on.
        root = Value::Object(Map::new());
    }
    let root_obj = root.as_object_mut().unwrap();

    let providers = root_obj
        .entry("providers".to_string())
        .or_insert_with(|| Value::Object(Map::new()));
    if !providers.is_object() {
        *providers = Value::Object(Map::new());
    }
    let providers_map = providers.as_object_mut().unwrap();

    let entry = build_provider_entry(provider, protocol);
    providers_map.insert(SKILLX_PROVIDER_KEY.to_string(), entry);

    write_config(&root)?;

    let base = resolve_base_url(provider, protocol);
    if backup_name.is_empty() {
        Ok(format!(
            "Pi models.json 已写入 (model: {}, base_url: {})。下次打开 pi 或在会话中调 /model 时自动加载。",
            provider.model, base
        ))
    } else {
        Ok(format!(
            "备份: {}。Pi models.json 已写入 (model: {}, base_url: {})。下次打开 pi 或在会话中调 /model 时自动加载。",
            backup_name, provider.model, base
        ))
    }
}

/// Remove the SkillX-managed provider entry from Pi's `models.json`.
pub fn clear_provider() -> Result<String, String> {
    let path = models_path()?;
    if !path.exists() {
        return Ok("Pi models.json 不存在，无需清理。".to_string());
    }

    let backup_name = create_backup()?;

    let mut root = read_config()?;
    if let Some(root_obj) = root.as_object_mut() {
        if let Some(providers) = root_obj.get_mut("providers").and_then(|v| v.as_object_mut()) {
            providers.remove(SKILLX_PROVIDER_KEY);
        }
    }

    write_config(&root)?;

    if backup_name.is_empty() {
        Ok("Pi 配置已清除。".to_string())
    } else {
        Ok(format!("备份: {}。Pi 配置已清除。", backup_name))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn provider() -> LlmProviderConfig {
        LlmProviderConfig {
            id: "deepseek".to_string(),
            name: "DeepSeek".to_string(),
            base_url: "https://api.deepseek.com/v1".to_string(),
            base_url_anthropic: String::new(),
            base_url_openai: "https://api.deepseek.com/v1".to_string(),
            api_key: "sk-test".to_string(),
            model: "deepseek-chat".to_string(),
            models: vec![],
            api_format: "openai".to_string(),
            temperature: None,
            max_tokens: None,
            timeout_secs: None,
            website_url: None,
        }
    }

    #[test]
    fn builds_openai_completions_entry() {
        let entry = build_provider_entry(&provider(), "openai");
        let obj = entry.as_object().unwrap();
        assert_eq!(obj["baseUrl"], "https://api.deepseek.com/v1");
        assert_eq!(obj["api"], "openai-completions");
        assert_eq!(obj["apiKey"], "sk-test");
        let models = obj["models"].as_array().unwrap();
        assert_eq!(models.len(), 1);
        assert_eq!(models[0]["id"], "deepseek-chat");
    }

    #[test]
    fn anthropic_protocol_maps_to_anthropic_messages() {
        let mut p = provider();
        p.base_url_anthropic = "https://api.example.com/anthropic".to_string();
        let entry = build_provider_entry(&p, "anthropic");
        let obj = entry.as_object().unwrap();
        assert_eq!(obj["api"], "anthropic-messages");
        assert_eq!(obj["baseUrl"], "https://api.example.com/anthropic");
    }

    #[test]
    fn base_url_falls_back_when_specific_empty() {
        let p = provider();
        // p.base_url_anthropic is empty; asking for anthropic should fall back
        // to base_url.
        assert_eq!(
            resolve_base_url(&p, "anthropic"),
            "https://api.deepseek.com/v1"
        );
    }
}
