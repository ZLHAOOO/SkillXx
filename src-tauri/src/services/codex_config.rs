use serde_json::{json, Value};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

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
    let origin_only = match trimmed.split_once("://") {
        Some((_scheme, rest)) => !rest.contains('/'),
        None => !trimmed.contains('/'),
    };
    if trimmed.ends_with("/v1") {
        trimmed.to_string()
    } else if origin_only {
        format!("{trimmed}/v1")
    } else {
        trimmed.to_string()
    }
}

/// Write provider config into Codex's auth.json and config.toml
pub fn apply_codex_provider(
    api_key: &str,
    base_url: &str,
    model: &str,
    provider_name: &str,
) -> Result<(), String> {
    let codex_dir = get_codex_dir();
    fs::create_dir_all(&codex_dir)
        .map_err(|e| format!("Failed to create Codex dir: {}", e))?;

    // Write auth.json
    let auth: Value = json!({
        "OPENAI_API_KEY": api_key,
    });
    let auth_json = serde_json::to_string_pretty(&auth)
        .map_err(|e| format!("Failed to serialize auth.json: {}", e))?;
    let auth_path = get_codex_auth_path();
    // Read old auth for rollback
    let old_auth = if auth_path.exists() {
        Some(fs::read(&auth_path).map_err(|e| format!("Failed to read old auth: {}", e))?)
    } else {
        None
    };
    fs::write(&auth_path, auth_json.as_bytes())
        .map_err(|e| format!("Failed to write {}: {}", auth_path.display(), e))?;

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
    let config_path = get_codex_config_path();
    // Read old config for rollback
    let old_config = if config_path.exists() {
        Some(fs::read(&config_path).map_err(|e| format!("Failed to read old config: {}", e))?)
    } else {
        None
    };

    if let Err(e) = fs::write(&config_path, &config_toml) {
        // Rollback auth.json
        if let Some(old) = old_auth {
            let _ = fs::write(&auth_path, old);
        } else {
            let _ = fs::remove_file(&auth_path);
        }
        return Err(format!("Failed to write {}: {}", config_path.display(), e));
    }

    // If this is the first write, and old config didn't exist, no rollback needed.
    // If it was an update, restore old config on failure (already handled above).
    drop(old_config);

    Ok(())
}

/// Clear Codex provider config — remove OPENAI_API_KEY from auth.json
/// and remove [model_providers.custom] section from config.toml
pub fn clear_codex_provider() -> Result<(), String> {
    // Clear auth.json
    let auth_path = get_codex_auth_path();
    if auth_path.exists() {
        let auth: Value = json!({});
        let auth_json = serde_json::to_string_pretty(&auth)
            .map_err(|e| format!("Failed to serialize auth.json: {}", e))?;
        fs::write(&auth_path, auth_json.as_bytes())
            .map_err(|e| format!("Failed to write {}: {}", auth_path.display(), e))?;
    }

    // Set model_provider back to "openai" and clear custom section
    let config_path = get_codex_config_path();
    if config_path.exists() {
        let content = fs::read_to_string(&config_path)
            .map_err(|e| format!("Failed to read {}: {}", config_path.display(), e))?;
        // Replace model_provider = "custom" with model_provider = "openai"
        let updated = content.replace("model_provider = \"custom\"", "model_provider = \"openai\"");
        fs::write(&config_path, updated)
            .map_err(|e| format!("Failed to write {}: {}", config_path.display(), e))?;
    }

    Ok(())
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
    let _ = Command::new("killall")
        .args(["-9", "Codex"])
        .output();
    let _ = Command::new("killall")
        .args(["-9", "codex"])
        .output();

    std::thread::sleep(std::time::Duration::from_millis(500));

    // Try desktop app first, fall back to CLI
    let app_path = std::path::Path::new("/Applications/Codex.app");
    if app_path.exists() {
        let output = Command::new("open")
            .args(["-a", "Codex"])
            .output()
            .map_err(|e| format!("Failed to relaunch Codex: {}", e))?;
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

    let _ = Command::new("pkill")
        .args(["-f", "codex"])
        .output();

    std::thread::sleep(std::time::Duration::from_millis(500));

    let _ = Command::new("codex")
        .spawn()
        .map_err(|e| format!("Failed to relaunch Codex: {}", e))?;

    Ok("Codex restarted successfully".to_string())
}

#[cfg(not(any(target_os = "macos", target_os = "linux")))]
pub fn restart_codex() -> Result<String, String> {
    Err("Restart not supported on this platform. Please manually restart Codex.".to_string())
}
