use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct GeminiConfig {
    #[serde(flatten)]
    pub other: HashMap<String, Value>,
    #[serde(default)]
    pub env: HashMap<String, String>,
}

/// Maximum number of backups to keep
const MAX_BACKUPS: usize = 5;

/// Directory for storing config backups
pub fn backup_dir() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("Failed to get home directory")?;
    Ok(home.join(".gemini").join("backups"))
}

/// Generate a timestamped backup filename
fn backup_filename() -> String {
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    format!("settings.json.bak-{}", ts)
}

/// Path to Gemini CLI's settings.json
pub fn settings_path() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("Failed to get home directory")?;
    Ok(home.join(".gemini").join("settings.json"))
}

/// Create a backup of the current settings.json
fn create_backup() -> Result<String, String> {
    let path = settings_path()?;
    if !path.exists() {
        return Err("settings.json does not exist, nothing to backup".to_string());
    }

    let dir = backup_dir()?;
    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create backup dir: {e}"))?;

    let backup_name = backup_filename();
    let backup_path = dir.join(&backup_name);

    fs::copy(&path, &backup_path)
        .map_err(|e| format!("Failed to copy settings.json to backup: {e}"))?;

    // Prune old backups (keep only MAX_BACKUPS)
    let mut existing: Vec<fs::DirEntry> = fs::read_dir(&dir)
        .map_err(|e| format!("Failed to read backup dir: {e}"))?
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.file_name()
                .to_string_lossy()
                .starts_with("settings.json.bak-")
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

/// Restore settings.json from a specific backup file
pub fn restore_backup(backup_name: &str) -> Result<(), String> {
    let dir = backup_dir()?;
    let backup_path = dir.join(backup_name);

    if !backup_path.exists() {
        return Err(format!("Backup file not found: {backup_name}"));
    }

    let path = settings_path()?;
    fs::copy(&backup_path, &path)
        .map_err(|e| format!("Failed to restore from backup: {e}"))?;

    Ok(())
}

/// Read the current Gemini CLI settings.json
pub fn read_config() -> Result<GeminiConfig, String> {
    let path = settings_path()?;
    if !path.exists() {
        return Ok(GeminiConfig::default());
    }

    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read {}: {}", path.display(), e))?;

    if content.trim().is_empty() {
        return Ok(GeminiConfig::default());
    }

    serde_json::from_str(&content).map_err(|e| format!("Failed to parse config: {e}"))
}

/// Write the config back to settings.json
pub fn write_config(config: &GeminiConfig) -> Result<(), String> {
    let path = settings_path()?;

    // Read existing config to preserve non-env fields we don't know about
    let mut value: Value = if path.exists() {
        let content = fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read {}: {}", path.display(), e))?;
        serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse JSON from {}: {}", path.display(), e))?
    } else {
        Value::Object(serde_json::Map::new())
    };

    // Ensure it's an object
    if let Value::Object(ref mut map) = value {
        // Merge env fields
        if let Some(env_obj) = map.get_mut("env").and_then(|e| e.as_object_mut()) {
            for (key, val) in &config.env {
                env_obj.insert(key.clone(), Value::String(val.clone()));
            }
        } else {
            let mut env_obj = serde_json::Map::new();
            for (key, val) in &config.env {
                env_obj.insert(key.clone(), Value::String(val.clone()));
            }
            map.insert("env".to_string(), Value::Object(env_obj));
        }
    }

    let json = serde_json::to_string_pretty(&value)
        .map_err(|e| format!("Failed to serialize config: {e}"))?;
    fs::write(&path, json).map_err(|e| format!("Failed to write config: {e}"))?;

    Ok(())
}

/// Apply a provider's config to Gemini CLI's settings.json
/// Gemini CLI uses env vars: GEMINI_API_KEY, GEMINI_BASE_URL, GEMINI_MODEL
pub fn apply_provider(api_key: &str, base_url: &str, model: &str) -> Result<String, String> {
    let backup_name = create_backup()?;

    let mut config = read_config()?;

    config
        .env
        .insert("GEMINI_API_KEY".to_string(), api_key.to_string());
    config
        .env
        .insert("GEMINI_BASE_URL".to_string(), base_url.to_string());
    config
        .env
        .insert("GEMINI_MODEL".to_string(), model.to_string());

    write_config(&config)?;

    Ok(format!(
        "Backup: {}. Gemini CLI configured (model: {}, base_url: {}).",
        backup_name, model, base_url
    ))
}

/// Clear Gemini CLI provider config (with auto-backup)
pub fn clear_provider() -> Result<String, String> {
    let backup_name = create_backup()?;

    let mut config = read_config()?;

    let keys_to_remove: Vec<String> = config
        .env
        .keys()
        .filter(|k| k.starts_with("GEMINI_"))
        .cloned()
        .collect();

    for key in keys_to_remove {
        config.env.remove(&key);
    }

    write_config(&config)?;

    Ok(format!(
        "Backup: {}. Gemini CLI config cleared.",
        backup_name
    ))
}
