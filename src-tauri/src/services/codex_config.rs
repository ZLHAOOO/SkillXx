use serde_json::{json, Value};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use toml_edit::{DocumentMut, Item, Table};

/// Maximum number of backups to keep
const MAX_BACKUPS: usize = 5;

/// CodexPlusPlus uses "custom" as the relay provider ID
const RELAY_PROVIDER: &str = "custom";

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
        .map_err(|e| format!("Failed to copy {} to backup: {}", src.display(), e))?;

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
/// Codex appends `/responses` or `/chat/completions` to the base_url, so:
/// - If the URL already ends with `/v1`, use as-is
/// - If the URL is origin-only (no path), append `/v1`
/// - If the URL has a known non-standard API prefix (`/openai`, `/openai/v1`,
///   `/openai/responses`), strip it and treat as origin-only (append `/v1`)
/// - Otherwise, use as-is (custom path like `/api/v1`, `/step_plan/v1`, etc.)
fn normalize_codex_base_url(url: &str) -> String {
    let trimmed = url.trim_end_matches('/');
    if trimmed.ends_with("/v1") {
        return trimmed.to_string();
    }

    // Strip known non-standard API path prefixes that providers sometimes
    // include in base_url_openai. These are NOT part of the server origin.
    // After stripping, treat as origin-only (append /v1).
    let without_prefix = trimmed
        .strip_prefix("/openai/responses")
        .or_else(|| trimmed.strip_prefix("/openai"))
        .unwrap_or(trimmed);

    if without_prefix.contains('/') {
        // Standard custom path (e.g. /api/v1, /step_plan/v1) — keep as-is
        without_prefix.to_string()
    } else {
        // Origin-only, append /v1
        format!("{}/v1", without_prefix)
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

// =========================================================================
// TOML helpers (following CodexPlusPlus's toml_edit pattern)
// =========================================================================

/// Parse a TOML string into a mutable document. Empty string → empty document.
fn parse_toml_document(contents: &str) -> Result<DocumentMut, String> {
    if contents.trim().is_empty() {
        return Ok(DocumentMut::new());
    }
    contents
        .parse::<DocumentMut>()
        .map_err(|e| format!("config.toml TOML parse error: {e}"))
}

/// Ensure a table exists at the given key, return mutable reference.
fn table_mut_or_insert<'a>(doc: &'a mut DocumentMut, key: &str) -> Result<&'a mut Table, String> {
    if !doc.as_table().contains_key(key) {
        doc[key] = toml_edit::table();
    }
    doc.get_mut(key)
        .and_then(Item::as_table_mut)
        .ok_or_else(|| format!("{} must be a TOML table", key))
}

/// Ensure the provider table exists under model_providers.<provider_id>
fn ensure_provider_table<'a>(
    doc: &'a mut DocumentMut,
    provider_id: &str,
) -> Result<&'a mut Table, String> {
    let providers = table_mut_or_insert(doc, "model_providers")?;
    if !providers.contains_key(provider_id)
        || providers
            .get(provider_id)
            .and_then(Item::as_table)
            .is_none()
    {
        providers.insert(provider_id, toml_edit::table());
    }
    providers
        .get_mut(provider_id)
        .and_then(Item::as_table_mut)
        .ok_or_else(|| format!("model_providers.{} must be a TOML table", provider_id))
}

/// Remove a provider table from model_providers. Remove the entire
/// model_providers section if it becomes empty.
fn remove_provider_table(doc: &mut DocumentMut, provider_id: &str) {
    if let Some(providers) = doc.get_mut("model_providers").and_then(Item::as_table_mut) {
        providers.remove(provider_id);
        if providers.is_empty() {
            doc.as_table_mut().remove("model_providers");
        }
    }
}

/// Set model_provider root key.
fn set_provider_id(doc: &mut DocumentMut, provider_id: &str) {
    doc["model_provider"] = toml_edit::value(provider_id);
}

/// Remove a root-level key from the TOML document.
fn remove_root_key(doc: &mut DocumentMut, key: &str) {
    doc.as_table_mut().remove(key);
}

/// Ensure trailing newline.
fn ensure_trailing_newline(mut contents: String) -> String {
    if !contents.ends_with('\n') {
        contents.push('\n');
    }
    contents
}

/// Build the config.toml content with the relay provider config.
/// Uses toml_edit to preserve all existing config (MCP servers, projects, etc.)
/// and only modify/insert the relay-related keys.
///
/// This follows CodexPlusPlus's `upsert_model_provider_config` pattern exactly.
fn build_relay_config_toml(existing: &str, base_url: &str, bearer_token: &str) -> Result<String, String> {
    let mut doc = parse_toml_document(existing)?;

    // Determine provider ID: use existing if it's a custom (non-reserved) provider,
    // otherwise default to "custom"
    let active_id = doc.get("model_provider")
        .and_then(Item::as_str)
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .filter(|s| {
            let reserved = ["openai", "amazon-bedrock", "ollama", "lmstudio", "oss", "ollama-chat"];
            !reserved.contains(&*s)
        })
        .map(|s| s.to_string())
        .unwrap_or_else(|| RELAY_PROVIDER.to_string());

    // Set the provider ID
    set_provider_id(&mut doc, &active_id);

    // Remove legacy provider tables (from previous CodexPlusPlus installs)
    for legacy in ["CodexPlusPlus", "CodexPP"] {
        remove_provider_table(&mut doc, legacy);
    }
    // Remove "custom" table if we're using a different provider ID
    if active_id != RELAY_PROVIDER {
        remove_provider_table(&mut doc, RELAY_PROVIDER);
    }

    // Set provider table fields
    let provider = ensure_provider_table(&mut doc, &active_id)?;
    provider["name"] = toml_edit::value(&active_id);
    provider["wire_api"] = toml_edit::value("responses");
    provider["requires_openai_auth"] = toml_edit::value(true);
    provider["base_url"] = toml_edit::value(base_url);
    provider["experimental_bearer_token"] = toml_edit::value(bearer_token);

    // Set model and disable_response_storage
    doc["disable_response_storage"] = toml_edit::value(true);

    Ok(ensure_trailing_newline(doc.to_string()))
}

/// Remove the custom relay provider config from config.toml.
/// Preserves all other config (MCP servers, projects, etc.).
/// Follows CodexPlusPlus's `clear_relay_config` pattern.
fn clear_relay_config_toml(existing: &str) -> String {
    let mut doc = match parse_toml_document(existing) {
        Ok(d) => d,
        Err(_) => return existing.to_string(),
    };

    // Remove provider tables
    remove_provider_table(&mut doc, RELAY_PROVIDER);
    for legacy in ["CodexPlusPlus", "CodexPP"] {
        remove_provider_table(&mut doc, legacy);
    }

    // Remove root-level relay keys
    for key in [
        "OPENAI_API_KEY",
        "model_provider",
        "model_catalog_json",
        "base_url",
    ] {
        remove_root_key(&mut doc, key);
    }

    ensure_trailing_newline(doc.to_string())
}

// =========================================================================
// Write helpers
// =========================================================================

/// Atomically write config.toml and auth.json with backup.
/// Follows CodexPlusPlus's `write_codex_live_atomic` pattern.
fn write_codex_live(
    codex_dir: &PathBuf,
    config_text: Option<&str>,
    auth_bytes: Option<&[u8]>,
) -> Result<(String, String), String> {
    fs::create_dir_all(codex_dir)
        .map_err(|e| format!("Failed to create Codex dir: {e}"))?;

    let config_path = get_codex_config_path();
    let auth_path = get_codex_auth_path();

    // Backup existing files
    let config_backup = if config_path.exists() {
        Some(create_backup(&config_path, "config")?)
    } else {
        None
    };
    let auth_backup = if auth_path.exists() {
        Some(create_backup(&auth_path, "auth")?)
    } else {
        None
    };

    let mut auth_written = false;

    // Write auth.json
    if let Some(auth_bytes) = auth_bytes {
        fs::write(&auth_path, auth_bytes)
            .map_err(|e| format!("Failed to write {}: {}", auth_path.display(), e))?;
        auth_written = true;
    }

    // Write config.toml
    if let Some(config_text) = config_text {
        if let Err(e) = fs::write(&config_path, config_text.as_bytes()) {
            // Rollback auth.json if config write failed
            if auth_written {
                if let Some(ref old_auth) = auth_backup {
                    let _ = restore_backup("auth", old_auth);
                }
            }
            if let Some(ref old_config) = config_backup {
                let _ = restore_backup("config", old_config);
            }
            return Err(format!("Failed to write {}: {}", config_path.display(), e));
        }
    }

    let auth_name = auth_backup.unwrap_or_else(|| "none".to_string());
    let config_name = config_backup.unwrap_or_else(|| "none".to_string());
    Ok((auth_name, config_name))
}

// =========================================================================
// Public API
// =========================================================================

/// Write provider config into Codex's auth.json and config.toml
/// Automatically creates backups before writing.
///
/// Uses a local protocol proxy to translate Codex's Responses API calls
/// into Chat Completions calls for the upstream provider. This allows
/// third-party providers (Agnes, LongCat, etc.) that only support Chat
/// Completions to work with Codex.
///
/// The proxy URL (http://127.0.0.1:port/v1) is written to config.toml,
/// and the proxy translates Responses <-> Chat Completions transparently.
///
/// Follows CodexPlusPlus's `apply_relay_config_to_home_with_protocol` pattern,
/// but uses toml_edit read-modify-write instead of string concatenation.
pub fn apply_codex_provider(
    api_key: &str,
    base_url: &str,
    model: &str,
    _provider_name: &str,
) -> Result<String, String> {
    let codex_dir = get_codex_dir();

    // Read existing config before starting proxy (so we can preserve it)
    let config_path = get_codex_config_path();
    let existing_config = if config_path.exists() {
        fs::read_to_string(&config_path)
            .map_err(|e| format!("Failed to read {}: {}", config_path.display(), e))?
    } else {
        String::new()
    };

    // Build the config.toml using toml_edit (preserves user's MCP servers, projects, etc.)
    let updated_config = build_relay_config_toml(&existing_config, base_url, api_key)?;

    // Write auth.json — but only if there's no existing ChatGPT session
    // This protects the user's OpenAI ChatGPT login from being overwritten
    let auth_path = get_codex_auth_path();
    let auth_bytes = if has_codex_session_token(&auth_path) {
        None // Don't overwrite ChatGPT session
    } else {
        let auth_json = serde_json::to_string_pretty(&json!({
            "OPENAI_API_KEY": api_key
        }))
        .map_err(|e| format!("Failed to serialize auth.json: {e}"))?;
        Some(auth_json.into_bytes())
    };

    // Atomic write with backup
    let (auth_name, config_name) = write_codex_live(&codex_dir, Some(&updated_config), auth_bytes.as_deref())?;

    // Start (or update) the protocol proxy with the raw upstream URL.
    // The proxy will handle URL construction (appending /chat/completions).
    let proxy_url = start_proxy_for_codex(base_url, api_key, model)?;

    Ok(format!(
        "Backups: auth={}, config={}. Proxy started. Provider applied (upstream: {}, proxy: {}).",
        config_name, auth_name, base_url, proxy_url
    ))
}

/// Write provider config using Responses API passthrough (no proxy).
/// Writes the real upstream URL directly to config.toml. Only use this
/// for providers that natively support the Responses API (e.g., StepFun).
///
/// Follows CodexPlusPlus's `apply_pure_api_config_to_home` pattern,
/// but uses toml_edit read-modify-write.
pub fn apply_codex_provider_passthrough(
    api_key: &str,
    base_url: &str,
    _model: &str,
    _provider_name: &str,
) -> Result<String, String> {
    let codex_dir = get_codex_dir();

    // Read existing config to preserve it
    let config_path = get_codex_config_path();
    let existing_config = if config_path.exists() {
        fs::read_to_string(&config_path)
            .map_err(|e| format!("Failed to read {}: {}", config_path.display(), e))?
    } else {
        String::new()
    };

    // Build config.toml using toml_edit (preserves user's other config)
    let updated_config = build_relay_config_toml(&existing_config, base_url, api_key)?;

    // Write auth.json — skip if ChatGPT session exists
    let auth_path = get_codex_auth_path();
    let auth_bytes = if has_codex_session_token(&auth_path) {
        None
    } else {
        let auth_json = serde_json::to_string_pretty(&json!({
            "OPENAI_API_KEY": api_key
        }))
        .map_err(|e| format!("Failed to serialize auth.json: {e}"))?;
        Some(auth_json.into_bytes())
    };

    // Atomic write with backup
    let (auth_name, config_name) = write_codex_live(&codex_dir, Some(&updated_config), auth_bytes.as_deref())?;

    Ok(format!(
        "Backups: auth={}, config={}. Passthrough mode. Provider applied (base_url: {}).",
        config_name, auth_name, base_url
    ))
}

/// Start (or update) the protocol proxy and return the local proxy URL.
/// The proxy listens on DEFAULT_PROXY_PORT and translates Responses API
/// calls to Chat Completions for the upstream provider.
fn start_proxy_for_codex(
    upstream_base_url: &str,
    upstream_api_key: &str,
    upstream_model: &str,
) -> Result<String, String> {
    use crate::services::codex_proxy::DEFAULT_PROXY_PORT;

    // Clone into owned Strings before spawning (async move captures by reference)
    let base_url = upstream_base_url.to_string();
    let api_key = upstream_api_key.to_string();
    let model = upstream_model.to_string();

    // Try to start/update the proxy on the default port
    let rt = tokio::runtime::Handle::try_current();
    match rt {
        Ok(handle) => {
            handle.spawn(async move {
                let _ = crate::services::codex_proxy::start_proxy(
                    DEFAULT_PROXY_PORT,
                    base_url,
                    api_key,
                    model,
                )
                .await;
            });
        }
        Err(_) => {
            // No tokio runtime — start proxy on a background thread
            let base_url2 = base_url.clone();
            let api_key2 = api_key.clone();
            let model2 = model.clone();
            std::thread::spawn(move || {
                let rt = tokio::runtime::Runtime::new().unwrap();
                rt.block_on(async {
                    let _ = crate::services::codex_proxy::start_proxy(
                        DEFAULT_PROXY_PORT,
                        base_url2,
                        api_key2,
                        model2,
                    )
                    .await;
                });
            });
        }
    }

    // Small delay to let the proxy bind the port
    std::thread::sleep(std::time::Duration::from_millis(100));

    Ok(crate::services::codex_proxy::proxy_base_url(DEFAULT_PROXY_PORT))
}

/// Clear Codex provider config — remove OPENAI_API_KEY from auth.json
/// and remove [model_providers.custom] section from config.toml.
/// Automatically creates backups before clearing.
///
/// Follows CodexPlusPlus's `clear_relay_config_to_home_with_auth` pattern.
pub fn clear_codex_provider() -> Result<String, String> {
    let auth_path = get_codex_auth_path();
    let config_path = get_codex_config_path();

    // Backup both files first
    let _auth_backup = if auth_path.exists() {
        Some(create_backup(&auth_path, "auth")?)
    } else {
        None
    };
    let _config_backup = if config_path.exists() {
        Some(create_backup(&config_path, "config")?)
    } else {
        None
    };

    // Read existing config and clear relay config using toml_edit
    let existing_config = if config_path.exists() {
        fs::read_to_string(&config_path)
            .map_err(|e| format!("Failed to read {}: {}", config_path.display(), e))?
    } else {
        String::new()
    };
    let cleared_config = clear_relay_config_toml(&existing_config);

    // Clear auth.json — remove OPENAI_API_KEY but preserve other fields (e.g., session tokens)
    let auth_content = if auth_path.exists() {
        let content = fs::read_to_string(&auth_path)
            .map_err(|e| format!("Failed to read {}: {}", auth_path.display(), e))?;
        if let Ok(mut value) = serde_json::from_str::<Value>(&content) {
            if let Some(obj) = value.as_object_mut() {
                obj.remove("OPENAI_API_KEY");
            }
            serde_json::to_string_pretty(&value)
                .map_err(|e| format!("Failed to serialize auth.json: {e}"))?
        } else {
            "{}".to_string()
        }
    } else {
        "{}".to_string()
    };

    // Stop the protocol proxy
    let _ = crate::services::codex_proxy::stop_proxy();

    // Atomic write with backup
    let (auth_name, config_name) = write_codex_live(
        &get_codex_dir(),
        Some(&cleared_config),
        Some(auth_content.as_bytes()),
    )?;

    Ok(format!(
        "Backups: auth={}, config={}. Codex config cleared.",
        auth_name, config_name
    ))
}

/// Restart Codex by gracefully quitting and relaunching.
/// Both CLI and desktop app share the same config (~/.codex/), so this
/// quits any running Codex and relaunches via app bundle (macOS)
/// or CLI binary (Linux).
#[cfg(target_os = "macos")]
pub fn restart_codex() -> Result<String, String> {
    use std::process::Command;

    // Step 1: Gracefully quit the Codex desktop app via macOS AppleScript
    let _ = Command::new("osascript")
        .args(["-e", "tell application \"Codex\" to quit"])
        .output();

    // Step 2: Also kill CLI processes (codex CLI)
    let _ = Command::new("killall").arg("codex").output();

    // Step 3: Wait for processes to exit
    std::thread::sleep(std::time::Duration::from_millis(2000));

    // Step 4: Relaunch — open -a works because the app was gracefully quit
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
