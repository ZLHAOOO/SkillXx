use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct HermesProfileConfig {
    #[serde(flatten)]
    pub other: HashMap<String, Value>,
    #[serde(default)]
    pub env: HashMap<String, String>,
}

const MAX_BACKUPS: usize = 5;

fn backup_dir() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("Failed to get home directory")?;
    Ok(home.join(".hermes").join("backups"))
}

fn backup_filename() -> String {
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    format!("settings.json.bak-{}", ts)
}

pub fn list_backups(profile_name: &str) -> Result<Vec<String>, String> {
    let dir = backup_dir()?;
    if !dir.exists() {
        return Ok(vec![]);
    }
    let prefix = format!("settings.json.bak-{}-", profile_name);
    let mut backups: Vec<String> = fs::read_dir(&dir)
        .map_err(|e| format!("Failed to read backup dir: {e}"))?
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let name = entry.file_name().to_string_lossy().into_owned();
            if name.starts_with(&prefix) {
                Some(name)
            } else {
                None
            }
        })
        .collect();
    backups.sort_by(|a, b| b.cmp(a));
    Ok(backups)
}

pub fn settings_path(profile_name: &str) -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("Failed to get home directory")?;
    Ok(home
        .join(".hermes")
        .join("profiles")
        .join(profile_name)
        .join("settings.json"))
}

pub fn create_backup(profile_name: &str) -> Result<String, String> {
    let path = settings_path(profile_name)?;
    if !path.exists() {
        return Ok("no_existing_config".to_string());
    }

    let dir = backup_dir()?;
    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create backup dir: {e}"))?;

    let backup_name = backup_filename();
    let backup_path = dir.join(format!("{}-{}", backup_name, profile_name));
    fs::copy(&path, &backup_path).map_err(|e| format!("Failed to create backup: {e}"))?;

    // Prune old backups
    prune_backups(profile_name)?;

    Ok(backup_name)
}

fn prune_backups(profile_name: &str) -> Result<(), String> {
    let dir = backup_dir()?;
    if !dir.exists() {
        return Ok(());
    }
    let prefix = format!("settings.json.bak-{}-", profile_name);
    let mut backups: Vec<_> = fs::read_dir(&dir)
        .map_err(|e| format!("Failed to read backup dir: {e}"))?
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let name = entry.file_name().to_string_lossy().into_owned();
            if name.starts_with(&prefix) {
                Some(name)
            } else {
                None
            }
        })
        .collect();
    backups.sort_by(|a, b| b.cmp(a));
    for old in backups.iter().skip(MAX_BACKUPS) {
        let _ = fs::remove_file(dir.join(old));
    }
    Ok(())
}

pub fn read_profile_config(profile_name: &str) -> Result<HermesProfileConfig, String> {
    let path = settings_path(profile_name)?;
    if !path.exists() {
        return Ok(HermesProfileConfig::default());
    }
    let content = fs::read_to_string(&path).map_err(|e| format!("Failed to read config: {e}"))?;
    if content.trim().is_empty() {
        return Ok(HermesProfileConfig::default());
    }
    serde_json::from_str(&content).map_err(|e| format!("Failed to parse config: {e}"))
}

pub fn apply_provider(
    profile_name: &str,
    provider: &crate::models::config::LlmProviderConfig,
) -> Result<String, String> {
    let backup_name = create_backup(profile_name)?;

    let mut config = read_profile_config(profile_name)?;

    // Use OpenAI-compatible URL for Hermes
    let base_url = if !provider.base_url_openai.is_empty() {
        provider.base_url_openai.clone()
    } else {
        provider.base_url.clone()
    };

    // Set OpenAI-compatible environment variables
    config.env.insert("OPENAI_BASE_URL".to_string(), base_url.clone());
    config.env.insert("OPENAI_API_KEY".to_string(), provider.api_key.clone());
    config.env.insert("OPENAI_MODEL".to_string(), provider.model.clone());

    let path = settings_path(profile_name)?;
    let json = serde_json::to_string_pretty(&config).map_err(|e| format!("Failed to serialize: {e}"))?;
    fs::write(&path, json).map_err(|e| format!("Failed to write config: {e}"))?;

    Ok(format!(
        "Backup: {}. Hermes profile '{}' configured (base_url: {}).",
        backup_name, profile_name, base_url
    ))
}

pub fn clear_provider(profile_name: &str) -> Result<String, String> {
    let backup_name = create_backup(profile_name)?;

    let mut config = read_profile_config(profile_name)?;

    let keys_to_remove: Vec<String> = config
        .env
        .keys()
        .filter(|k| k.starts_with("OPENAI_"))
        .cloned()
        .collect();

    for key in keys_to_remove {
        config.env.remove(&key);
    }

    let path = settings_path(profile_name)?;
    let json = serde_json::to_string_pretty(&config).map_err(|e| format!("Failed to serialize: {e}"))?;
    fs::write(&path, json).map_err(|e| format!("Failed to write config: {e}"))?;

    Ok(format!(
        "Backup: {}. Hermes profile '{}' cleared.",
        backup_name, profile_name
    ))
}

#[cfg(target_os = "macos")]
pub fn restart_hermes() -> Result<String, String> {
    use std::process::Command;

    let _ = Command::new("pkill")
        .args(["-f", "hermes"])
        .output();

    std::thread::sleep(std::time::Duration::from_millis(500));

    let _ = Command::new("open")
        .args(["-a", "Hermes"])
        .output();

    Ok("Hermes restarted".to_string())
}

#[cfg(target_os = "linux")]
pub fn restart_hermes() -> Result<String, String> {
    use std::process::Command;

    let _ = Command::new("pkill")
        .args(["-f", "hermes"])
        .output();

    std::thread::sleep(std::time::Duration::from_millis(500));

    let _ = Command::new("hermes").spawn();

    Ok("Hermes restarted".to_string())
}

#[cfg(target_os = "windows")]
pub fn restart_hermes() -> Result<String, String> {
    use std::process::Command;

    let _ = Command::new("taskkill")
        .args(["/F", "/IM", "Hermes.exe"])
        .output();

    std::thread::sleep(std::time::Duration::from_millis(500));

    let _ = Command::new("cmd")
        .args(["/C", "start", "Hermes"])
        .output();

    Ok("Hermes restarted".to_string())
}
