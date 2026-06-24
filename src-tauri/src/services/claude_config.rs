use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ClaudeConfig {
    #[serde(flatten)]
    pub other: HashMap<String, Value>,
    #[serde(default)]
    pub env: HashMap<String, String>,
}

/// Maximum number of backups to keep
const MAX_BACKUPS: usize = 5;

/// Directory for storing config backups
fn backup_dir() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("Failed to get home directory")?;
    Ok(home.join(".claude").join("backups"))
}

/// Generate a timestamped backup filename
fn backup_filename() -> String {
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    format!("settings.json.bak-{}", ts)
}

/// List all available backups, sorted newest first
pub fn list_backups() -> Result<Vec<String>, String> {
    let dir = backup_dir()?;
    if !dir.exists() {
        return Ok(vec![]);
    }
    let mut backups: Vec<String> = fs::read_dir(&dir)
        .map_err(|e| format!("Failed to read backup dir: {e}"))?
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let name = entry.file_name().to_string_lossy().into_owned();
            if name.starts_with("settings.json.bak-") {
                Some(name)
            } else {
                None
            }
        })
        .collect();
    backups.sort_by(|a, b| b.cmp(a)); // newest first
    Ok(backups)
}

/// Path to Claude Code's settings.json (reusable)
fn settings_path() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("Failed to get home directory")?;
    Ok(home.join(".claude").join("settings.json"))
}

/// Create a backup of the current settings.json
fn create_backup() -> Result<String, String> {
    let settings_path = settings_path()?;
    if !settings_path.exists() {
        return Err("settings.json does not exist, nothing to backup".to_string());
    }

    let dir = backup_dir()?;
    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create backup dir: {e}"))?;

    let backup_name = backup_filename();
    let backup_path = dir.join(&backup_name);

    fs::copy(&settings_path, &backup_path)
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

    // Sort by modification time, newest first
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

    let settings_path = settings_path()?;
    fs::copy(&backup_path, &settings_path)
        .map_err(|e| format!("Failed to restore from backup: {e}"))?;

    Ok(())
}

impl ClaudeConfig {
    /// Path to Claude Code's settings.json
    pub fn settings_path() -> Result<PathBuf, String> {
        let home = dirs::home_dir().ok_or("Failed to get home directory")?;
        Ok(home.join(".claude").join("settings.json"))
    }

    /// Read the current Claude Code settings.json
    pub fn read() -> Result<Self, String> {
        let path = Self::settings_path()?;
        if !path.exists() {
            return Ok(ClaudeConfig::default());
        }

        let content = fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read {}: {}", path.display(), e))?;

        // Parse as generic Value first to handle unknown fields
        let value: Value = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse JSON from {}: {}", path.display(), e))?;

        // Extract env section if present
        let env = value
            .get("env")
            .and_then(|e| {
                if e.is_object() {
                    serde_json::from_value(e.clone()).ok()
                } else {
                    None
                }
            })
            .unwrap_or_default();

        // Collect all non-env fields
        let mut other: HashMap<String, Value> = HashMap::new();
        if let Some(obj) = value.as_object() {
            for (key, val) in obj {
                if key != "env" {
                    other.insert(key.clone(), val.clone());
                }
            }
        }

        Ok(ClaudeConfig { other, env })
    }

    /// Write the config back to settings.json, preserving all non-env fields
    pub fn write(&self) -> Result<(), String> {
        let path = Self::settings_path()?;

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
        let obj = value
            .as_object_mut()
            .ok_or("Settings file is not a JSON object")?;

        // Update only the env section
        obj.insert(
            "env".to_string(),
            serde_json::to_value(&self.env).unwrap(),
        );

        // Write back with pretty formatting
        let json = serde_json::to_string_pretty(&value)
            .map_err(|e| format!("Failed to serialize config: {e}"))?;

        fs::write(&path, json)
            .map_err(|e| format!("Failed to write {}: {}", path.display(), e))?;

        Ok(())
    }

    /// Write provider config into the env section
    /// Automatically creates a backup before writing.
    /// Uses base_url_anthropic (Anthropic format) if available, otherwise base_url.
    pub fn apply_provider(&self, provider: &ProviderEnvConfig) -> Result<String, String> {
        // Auto-backup before any write
        let backup_name = create_backup()?;

        let mut config = Self::read()?;

        // Determine the base URL to use
        // If the provider has a dedicated anthropic URL, use it for ANTHROPIC_BASE_URL
        // Otherwise fall back to base_url
        let base_url = if !provider.base_url_anthropic.is_empty() {
            provider.base_url_anthropic.clone()
        } else {
            provider.base_url.clone()
        };

        // Set authentication
        config.env.insert(
            "ANTHROPIC_AUTH_TOKEN".to_string(),
            provider.api_key.clone(),
        );

        // Set base URL
        config.env.insert(
            "ANTHROPIC_BASE_URL".to_string(),
            base_url.clone(),
        );

        // Set current model (the one user selected)
        config.env.insert(
            "ANTHROPIC_MODEL".to_string(),
            provider.model.clone(),
        );

        // Note: We do NOT set ANTHROPIC_DEFAULT_SONNET_MODEL, OPUS_MODEL, etc.
        // EchoBird's approach: only set ANTHROPIC_MODEL, let Claude Code discover
        // the full model list from the API. This prevents model selector confusion.

        config.write()?;

        Ok(format!(
            "Backup created: {}. Provider applied (base_url: {}).",
            backup_name, base_url
        ))
    }

    /// Clear all ANTHROPIC env vars from the config (restore clean state)
    /// Automatically creates a backup before clearing.
    pub fn clear_provider() -> Result<String, String> {
        let backup_name = create_backup()?;

        let mut config = Self::read()?;

        let keys_to_remove: Vec<String> = config
            .env
            .keys()
            .filter(|k| k.starts_with("ANTHROPIC_"))
            .cloned()
            .collect();

        for key in keys_to_remove {
            config.env.remove(&key);
        }

        config.write()?;

        Ok(format!(
            "Backup created: {}. All ANTHROPIC env vars cleared.",
            backup_name
        ))
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderEnvConfig {
    pub api_key: String,
    pub base_url: String,
    pub base_url_anthropic: String,
    pub model: String,
}

/// Restart Claude Code by killing and relaunching the process
/// This only works on macOS/Linux where `claude` is in PATH
#[cfg(target_os = "macos")]
pub fn restart_claude_code() -> Result<String, String> {
    use std::process::Command;

    // First, kill any running claude processes
    let _ = Command::new("pkill").args(["-f", "claude"]).output();

    std::thread::sleep(std::time::Duration::from_millis(500));

    // Relaunch claude in background
    let output = Command::new("open")
        .args(["-a", "Claude Code"])
        .output()
        .map_err(|e| format!("Failed to relaunch Claude Code: {e}"))?;

    if output.status.success() {
        Ok("Claude Code restarted successfully".to_string())
    } else {
        Ok("Claude Code kill signal sent. Please manually restart the application.".to_string())
    }
}

#[cfg(target_os = "linux")]
pub fn restart_claude_code() -> Result<String, String> {
    use std::process::Command;

    let _ = Command::new("pkill").args(["-f", "claude"]).output();

    std::thread::sleep(std::time::Duration::from_millis(500));

    let _ = Command::new("claude")
        .spawn()
        .map_err(|e| format!("Failed to relaunch Claude Code: {e}"))?;

    Ok("Claude Code restarted successfully".to_string())
}

#[cfg(not(any(target_os = "macos", target_os = "linux")))]
pub fn restart_claude_code() -> Result<String, String> {
    Err("Restart not supported on this platform. Please manually restart Claude Code.".to_string())
}
