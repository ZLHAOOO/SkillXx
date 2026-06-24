use serde_json::{json, Value};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

/// Maximum number of backups to keep
const MAX_BACKUPS: usize = 5;

/// Directory for storing config backups
fn backup_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_default()
        .join(".codex")
        .join("backups")
}

/// Generate a timestamped backup filename
fn backup_filename(prefix: &str) -> String {
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    format!("{}.bak-{}", prefix, ts)
}

/// List all available backups for a given file (auth or config), sorted newest first
pub fn list_backups(file_prefix: &str) -> Result<Vec<String>, String> {
    let dir = backup_dir();
    if !dir.exists() {
        return Ok(vec![]);
    }
    let mut backups: Vec<String> = fs::read_dir(&dir)
        .map_err(|e| format!("Failed to read backup dir: {e}"))?
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let name = entry.file_name().to_string_lossy().into_owned();
            if name.starts_with(&format!("{}.bak-", file_prefix)) {
                Some(name)
            } else {
                None
            }
        })
        .collect();
    backups.sort_by(|a, b| b.cmp(a)); // newest first
    Ok(backups)
}

/// Create a backup of a specific file
fn create_backup(src: &PathBuf, file_prefix: &str) -> Result<String, String> {
    if !src.exists() {
        return Err(format!("{} does not exist, nothing to backup", src.display()));
    }

    let dir = backup_dir();
    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create backup dir: {e}"))?;

    let backup_name = backup_filename(file_prefix);
    let backup_path = dir.join(&backup_name);

    fs::copy(src, &backup_path)
        .map_err(|e| format!("Failed to copy {} to backup: {e}", src.display()))?;

    // Prune old backups (keep only MAX_BACKUPS per prefix)
    let prefix_pattern = format!("{}.bak-", file_prefix);
    let mut existing: Vec<fs::DirEntry> = fs::read_dir(&dir)
        .map_err(|e| format!("Failed to read backup dir: {e}"))?
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.file_name()
                .to_string_lossy()
                .starts_with(&prefix_pattern)
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

/// Restore a specific file from a backup
pub fn restore_backup(file_prefix: &str, backup_name: &str) -> Result<(), String> {
    let dir = backup_dir();
    let backup_path = dir.join(backup_name);

    if !backup_path.exists() {
        return Err(format!("Backup file not found: {backup_name}"));
    }

    let target = match file_prefix {
        "auth" => get_codex_auth_path(),
        "config" => get_codex_config_path(),
        _ => return Err(format!("Unknown file prefix: {file_prefix}")),
    };

    fs::copy(&backup_path, &target)
        .map_err(|e| format!("Failed to restore from backup: {e}"))?;

    Ok(())
}

/// Restore Codex to original OpenAI configuration
/// This removes the custom model provider and restores the default OpenAI setup
pub fn restore_codex_original() -> Result<String, String> {
    let config_path = get_codex_config_path();
    let auth_path = get_codex_auth_path();

    // Backup both files first
    let auth_backup = if auth_path.exists() {
        Some(create_backup(&auth_path, "auth")?)
    } else {
        None
    };
    let config_backup = if config_path.exists() {
        Some(create_backup(&config_path, "config")?)
    } else {
        None
    };

    // Write original config.toml
    let original_config = r#"model_provider = "openai"
model = "o4-mini"
disable_response_storage = true
"#;
    fs::write(&config_path, original_config.as_bytes())
        .map_err(|e| format!("Failed to write original config.toml: {e}"))?;

    // Write original auth.json (empty OPENAI_API_KEY placeholder — user must fill in)
    let original_auth: Value = json!({
        "OPENAI_API_KEY": ""
    });
    let auth_json = serde_json::to_string_pretty(&original_auth)
        .map_err(|e| format!("Failed to serialize original auth.json: {e}"))?;
    fs::write(&auth_path, auth_json.as_bytes())
        .map_err(|e| format!("Failed to write original auth.json: {e}"))?;

    let auth_name = auth_backup.unwrap_or_else(|| "none".to_string());
    let config_name = config_backup.unwrap_or_else(|| "none".to_string());
    Ok(format!(
        "Restored to original OpenAI config. Backups: auth={}, config={}. Please set your OpenAI_API_KEY in auth.json.",
        auth_name, config_name
    ))
}

/// Path to Codex config directory
pub fn get_codex_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_default()
        .join(".codex")
}

/// Path to Codex auth.json
pub fn get_codex_auth_path() -> PathBuf {
    get_codex_dir().join("auth.json")
}

/// Path to Codex config.toml
pub fn get_codex_config_path() -> PathBuf {
    get_codex_dir().join("config.toml")
}

/// Read the current Codex live configuration (auth.json + config.toml)
pub fn read_codex_live() -> Result<HashMap<String, String>, String> {
    let auth_path = get_codex_auth_path();
    let config_path = get_codex_config_path();

    let mut result = HashMap::new();

    if auth_path.exists() {
        let auth_content = fs::read_to_string(&auth_path)
            .map_err(|e| format!("Failed to read {}: {}", auth_path.display(), e))?;
        result.insert("auth".to_string(), auth_content);
    } else {
        result.insert("auth".to_string(), String::new());
    }

    if config_path.exists() {
        let config_content = fs::read_to_string(&config_path)
            .map_err(|e| format!("Failed to read {}: {}", config_path.display(), e))?;
        result.insert("config".to_string(), config_content);
    } else {
        result.insert("config".to_string(), String::new());
    }

    Ok(result)
}

/// Normalize a base URL for Codex config.toml.
///
/// Codex appends `/chat/completions` (or `/responses`) to the base_url, so:
/// - If the URL already ends with `/v1`, use as-is
/// - If the URL is origin-only (no path), append `/v1`
/// - Otherwise, use as-is (user has a custom path)
fn normalize_codex_base_url(url: &str) -> String {
    let trimmed = url.trim_end_matches('/');
    if trimmed.ends_with("/v1") {
        trimmed.to_string()
    } else if trimmed.contains('/') {
        // Has a path component, use as-is
        trimmed.to_string()
    } else {
        // Origin-only, append /v1
        format!("{}/v1", trimmed)
    }
}

/// Check if auth.json contains a non-OpenAI session token (e.g., ChatGPT login).
/// If so, we should NOT overwrite auth.json to preserve the user's login.
fn has_codex_session_token(auth_path: &PathBuf) -> bool {
    if !auth_path.exists() {
        return false;
    }
    if let Ok(content) = fs::read_to_string(auth_path) {
        if let Ok(auth) = serde_json::from_str::<Value>(&content) {
            // Check for OpenAI session token pattern (starts with "sess-")
            if let Some(key) = auth.get("OPENAI_API_KEY").and_then(|v| v.as_str()) {
                if key.starts_with("sess-") {
                    return true;
                }
            }
            // Check for experimental_bearer_token (ChatGPT Plus login)
            if auth.get("experimental_bearer_token").is_some() {
                return true;
            }
        }
    }
    false
}

/// Write provider config into Codex's auth.json and config.toml
/// Automatically creates backups before writing.
/// Uses the OpenAI-compatible base_url.
///
/// If Codex has an existing ChatGPT login session (auth.json contains a
/// session token), we skip writing auth.json to preserve the user's login.
/// This matches CCSwitch's behavior and EchoBird's relayMode approach.
pub fn apply_codex_provider(
    api_key: &str,
    base_url: &str,
    model: &str,
    provider_name: &str,
) -> Result<String, String> {
    let codex_dir = get_codex_dir();
    fs::create_dir_all(&codex_dir)
        .map_err(|e| format!("Failed to create Codex dir: {e}"))?;

    let auth_path = get_codex_auth_path();
    let config_path = get_codex_config_path();

    // Backup auth.json
    let auth_backup = if auth_path.exists() {
        Some(create_backup(&auth_path, "auth")?)
    } else {
        None
    };

    // Backup config.toml
    let config_backup = if config_path.exists() {
        Some(create_backup(&config_path, "config")?)
    } else {
        None
    };

    // Write auth.json — but only if there's no existing ChatGPT session
    // This protects the user's OpenAI ChatGPT login from being overwritten
    if has_codex_session_token(&auth_path) {
        // Skip auth.json write, user has a ChatGPT session we shouldn't destroy
    } else {
        let auth: Value = json!({ "OPENAI_API_KEY": api_key });
        let auth_json = serde_json::to_string_pretty(&auth)
            .map_err(|e| format!("Failed to serialize auth.json: {e}"))?;
        fs::write(&auth_path, auth_json.as_bytes())
            .map_err(|e| format!("Failed to write {}: {}", auth_path.display(), e))?;
    }

    let normalized_base_url = normalize_codex_base_url(base_url);

    // Write config.toml
    let config_toml = format!(
        r#"model_provider = "custom"
model = "{model}"
disable_response_storage = true

[model_providers.custom]
name = "{provider_name}"
base_url = "{normalized_base_url}"
wire_api = "responses"
requires_openai_auth = true"#
    );

    fs::write(&config_path, &config_toml)
        .map_err(|e| format!("Failed to write {}: {}", config_path.display(), e))?;

    let auth_name = auth_backup.unwrap_or_else(|| "none".to_string());
    let config_name = config_backup.unwrap_or_else(|| "none".to_string());
    Ok(format!(
        "Backups: auth={}, config={}. Provider applied (base_url: {}).",
        auth_name, config_name, normalized_base_url
    ))
}

/// Clear Codex provider config — remove OPENAI_API_KEY from auth.json
/// and remove [model_providers.custom] section from config.toml.
/// Automatically creates backups before clearing.
pub fn clear_codex_provider() -> Result<String, String> {
    let auth_path = get_codex_auth_path();
    let config_path = get_codex_config_path();

    // Backup
    let auth_backup = if auth_path.exists() {
        Some(create_backup(&auth_path, "auth")?)
    } else {
        None
    };
    let config_backup = if config_path.exists() {
        Some(create_backup(&config_path, "config")?)
    } else {
        None
    };

    // Clear auth.json
    let auth: Value = json!({});
    let auth_json = serde_json::to_string_pretty(&auth)
        .map_err(|e| format!("Failed to serialize auth.json: {e}"))?;
    fs::write(&auth_path, auth_json.as_bytes())
        .map_err(|e| format!("Failed to write {}: {}", auth_path.display(), e))?;

    // Restore model_provider to "openai" and remove custom section
    if config_path.exists() {
        let content = fs::read_to_string(&config_path)
            .map_err(|e| format!("Failed to read {}: {}", config_path.display(), e))?;
        let updated = content
            .replace("model_provider = \"custom\"", "model_provider = \"openai\"");
        fs::write(&config_path, updated)
            .map_err(|e| format!("Failed to write {}: {}", config_path.display(), e))?;
    }

    let auth_name = auth_backup.unwrap_or_else(|| "none".to_string());
    let config_name = config_backup.unwrap_or_else(|| "none".to_string());
    Ok(format!(
        "Backups: auth={}, config={}. Codex config cleared (reverted to openai provider).",
        auth_name, config_name
    ))
}

/// Restart Codex by killing and relaunching the process.
/// Both CLI and desktop app share the same config (~/.codex/), so this
/// kills any running codex process and relaunches via app bundle (macOS)
/// or CLI binary (Linux).
#[cfg(target_os = "macos")]
pub fn restart_codex() -> Result<String, String> {
    use std::process::Command;

    // Use `killall` with exact process name instead of `pkill -f` which
    // matches too broadly. Send SIGTERM first, then SIGKILL if needed.
    let _ = Command::new("killall").arg("Codex").output();
    let _ = Command::new("killall").arg("codex").output();

    std::thread::sleep(std::time::Duration::from_millis(1000));

    // Force kill any stragglers
    let _ = Command::new("killall").args(["-9", "Codex"]).output();
    let _ = Command::new("killall").args(["-9", "codex"]).output();

    std::thread::sleep(std::time::Duration::from_millis(500));

    // Try desktop app first, fall back to CLI
    let app_path = std::path::Path::new("/Applications/Codex.app");
    if app_path.exists() {
        let output = Command::new("open")
            .args(["-a", "Codex"])
            .output()
            .map_err(|e| format!("Failed to relaunch Codex: {e}"))?;
        if output.status.success() {
            return Ok("Codex restarted successfully".to_string());
        }
    }

    // Fallback: try CLI
    match Command::new("codex").spawn() {
        Ok(_) => Ok("Codex CLI restarted successfully".to_string()),
        Err(_) => Ok(
            "Codex processes killed. Please manually restart Codex (desktop app or CLI)."
                .to_string(),
        ),
    }
}

#[cfg(target_os = "linux")]
pub fn restart_codex() -> Result<String, String> {
    use std::process::Command;

    let _ = Command::new("pkill").args(["-f", "codex"]).output();

    std::thread::sleep(std::time::Duration::from_millis(500));

    let _ = Command::new("codex")
        .spawn()
        .map_err(|e| format!("Failed to relaunch Codex: {e}"))?;

    Ok("Codex restarted successfully".to_string())
}

#[cfg(not(any(target_os = "macos", target_os = "linux")))]
pub fn restart_codex() -> Result<String, String> {
    Err("Restart not supported on this platform. Please manually restart Codex.".to_string())
}
