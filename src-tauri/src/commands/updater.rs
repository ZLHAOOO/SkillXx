use crate::models::update::UpdateInfo;
use crate::services::{updater, ConfigManager};
use serde::Serialize;

#[tauri::command]
pub async fn check_update(app_handle: tauri::AppHandle) -> Result<UpdateInfo, String> {
    let package_info = app_handle.package_info();
    let current_version = &package_info.version;
    let v_str = format!(
        "{}.{}.{}",
        current_version.major, current_version.minor, current_version.patch
    );

    let github_token = ConfigManager::new()
        .load()
        .ok()
        .and_then(|cfg| cfg.preferences.and_then(|prefs| prefs.github_token))
        .map(|token| token.trim().to_string())
        .filter(|token| !token.is_empty());

    updater::check_for_updates(&v_str, github_token.as_deref())
        .await
        .map_err(|e| e.to_string())
}

#[derive(Serialize)]
#[allow(dead_code)]
pub struct DownloadProgressEvent {
    percent: f64,
    downloaded: u64,
    total: u64,
    status: String,
}

#[tauri::command]
pub async fn download_and_install(
    app_handle: tauri::AppHandle,
    download_url: String,
) -> Result<(), String> {
    // Validate URL is from trusted source using proper domain checking
    validate_download_url(&download_url)?;

    updater::download_and_install_update(download_url, app_handle)
        .await
        .map_err(|e| e.to_string())
}

/// Validates that a download URL is from a trusted domain.
/// Uses proper URL parsing to prevent bypass attacks like:
/// - https://evil.com/?github.com
/// - https://github.com.attacker.com
fn validate_download_url(url: &str) -> Result<(), String> {
    let parsed = url::Url::parse(url).map_err(|_| "Invalid URL format".to_string())?;

    let host = parsed.host_str().ok_or("URL has no host")?;

    // Check for exact domain match or subdomain of trusted domains
    let trusted_domains = ["github.com", "githubusercontent.com"];

    let is_trusted = trusted_domains.iter().any(|domain| {
        host == *domain || host.ends_with(&format!(".{}", domain))
    });

    if !is_trusted {
        return Err(format!(
            "Untrusted download URL: host '{}' is not from a trusted domain",
            host
        ));
    }

    // Ensure HTTPS is used
    if parsed.scheme() != "https" {
        return Err("Download URL must use HTTPS".to_string());
    }

    Ok(())
}
