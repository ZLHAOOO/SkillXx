use crate::models::update::{DownloadProgress, DownloadStatus, GithubRelease, UpdateInfo};
use semver::Version;
use serde::Deserialize;
use std::error::Error;
use std::path::PathBuf;

const REPO_OWNER: &str = "ZLHAOOO";
const REPO_NAME: &str = "SkillX";

#[derive(Debug, Deserialize)]
struct GithubErrorBody {
    message: Option<String>,
}

/// Find the DMG download URL from release assets
fn find_dmg_asset(release: &GithubRelease) -> Option<String> {
    release.assets.as_ref().and_then(|assets| {
        assets
            .iter()
            .find(|a| a.name.ends_with(".dmg"))
            .map(|a| a.browser_download_url.clone())
    })
}

pub async fn check_for_updates(
    current_version: &str,
    github_token: Option<&str>,
) -> Result<UpdateInfo, Box<dyn Error>> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()?;
    let url = format!(
        "https://api.github.com/repos/{}/{}/releases/latest",
        REPO_OWNER, REPO_NAME
    );

    let mut request = client
        .get(&url)
        .header("User-Agent", "SkillX-App")
        .header("Accept", "application/vnd.github+json");

    if let Some(token) = github_token.map(|t| t.trim()).filter(|t| !t.is_empty()) {
        request = request.bearer_auth(token);
    }

    let response = request.send().await?;
    let status = response.status();
    let body = response.text().await?;

    if !status.is_success() {
        let message = serde_json::from_str::<GithubErrorBody>(&body)
            .ok()
            .and_then(|err| err.message)
            .unwrap_or_else(|| body.clone());
        let hint = match status.as_u16() {
            403 if message.to_lowercase().contains("rate limit") => {
                " (configure a GitHub token in settings to raise the limit)"
            }
            404 => " (no published release found for this repository)",
            401 => " (invalid or expired GitHub token)",
            _ => "",
        };
        return Err(format!("GitHub API {}: {}{}", status, message, hint).into());
    }

    let resp: GithubRelease = serde_json::from_str(&body)
        .map_err(|e| format!("failed to parse GitHub release response: {}", e))?;

    let clean_latest = resp.tag_name.trim_start_matches('v');
    let latest_v = Version::parse(clean_latest)?;
    let current_v = Version::parse(current_version)?;

    let asset_url = find_dmg_asset(&resp);

    Ok(UpdateInfo {
        has_update: latest_v > current_v,
        latest_version: resp.tag_name,
        download_url: resp.html_url,
        release_notes: resp.body,
        asset_download_url: asset_url,
    })
}

/// Download the update DMG to a temp file, then install it
pub async fn download_and_install_update(
    download_url: String,
    app_handle: tauri::AppHandle,
) -> Result<(), Box<dyn Error>> {
    use std::io::Write;

    // Emit initial progress
    let _ = app_handle.emit(
        "update:progress",
        DownloadProgress {
            percent: 0.0,
            downloaded: 0,
            total: 0,
            status: DownloadStatus::Downloading,
        },
    );

    // Determine download target path
    let temp_dir = std::env::temp_dir();
    let dmg_path = temp_dir.join("SkillX-update.dmg");

    // Download the DMG
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(300)) // 5 minutes for large downloads
        .build()?;
    let response = client
        .get(&download_url)
        .header("User-Agent", "SkillX-App")
        .send()
        .await?;

    let total_size = response.content_length().unwrap_or(0);
    let mut downloaded: u64 = 0;

    let mut file = std::fs::File::create(&dmg_path)?;
    let mut stream = response.bytes_stream();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk?;
        file.write_all(&chunk)?;
        downloaded += chunk.len() as u64;

        if total_size > 0 {
            let percent = (downloaded as f64 / total_size as f64) * 100.0;
            let _ = app_handle.emit(
                "update:progress",
                DownloadProgress {
                    percent,
                    downloaded,
                    total: total_size,
                    status: DownloadStatus::Downloading,
                },
            );
        }
    }

    // Emit installing status
    let _ = app_handle.emit(
        "update:progress",
        DownloadProgress {
            percent: 100.0,
            downloaded,
            total: total_size,
            status: DownloadStatus::Installing,
        },
    );

    // Install the DMG (macOS only)
    install_dmg(&dmg_path, &app_handle)?;

    // Emit done
    let _ = app_handle.emit(
        "update:progress",
        DownloadProgress {
            percent: 100.0,
            downloaded,
            total: total_size,
            status: DownloadStatus::Done,
        },
    );

    Ok(())
}

#[cfg(target_os = "macos")]
fn install_dmg(dmg_path: &PathBuf, app_handle: &tauri::AppHandle) -> Result<(), Box<dyn Error>> {
    use std::process::Command;

    // Mount the DMG
    let mount_output = Command::new("hdiutil")
        .args([
            "attach",
            dmg_path.to_str().unwrap(),
            "-nobrowse",
            "-quiet",
        ])
        .output()?;

    if !mount_output.status.success() {
        return Err(format!(
            "Failed to mount DMG: {}",
            String::from_utf8_lossy(&mount_output.stderr)
        )
        .into());
    }

    // Find the mount point
    let attach_output = Command::new("hdiutil")
        .args([
            "attach",
            dmg_path.to_str().unwrap(),
            "-nobrowse",
        ])
        .output()?;

    let attach_str = String::from_utf8_lossy(&attach_output.stdout);
    let mount_point = attach_str
        .lines()
        .find(|l| l.contains("/Volumes/"))
        .and_then(|l| l.split('\t').last())
        .map(|s| s.trim())
        .ok_or("Could not find DMG mount point")?;

    // Find the .app in the mounted volume
    let app_name = "SkillX.app";
    let source_app = PathBuf::from(mount_point).join(app_name);

    if !source_app.exists() {
        // Try to find any .app
        let entries = std::fs::read_dir(mount_point)?;
        let found_app = entries
            .filter_map(|e| e.ok())
            .find(|e| e.file_name().to_string_lossy().ends_with(".app"));

        let source_app = found_app
            .map(|e| e.path())
            .ok_or("Could not find .app in DMG")?;

        return copy_app_and_restart(&source_app, dmg_path, mount_point, app_handle);
    }

    copy_app_and_restart(&source_app, dmg_path, mount_point, app_handle)
}

#[cfg(target_os = "macos")]
fn copy_app_and_restart(
    source_app: &PathBuf,
    dmg_path: &PathBuf,
    mount_point: &str,
    app_handle: &tauri::AppHandle,
) -> Result<(), Box<dyn Error>> {
    use std::process::Command;

    let target_path = PathBuf::from("/Applications/SkillX.app");

    // Remove existing app if present
    if target_path.exists() {
        std::fs::remove_dir_all(&target_path)?;
    }

    // Copy the new app
    let copy_output = Command::new("cp")
        .args([
            "-R",
            source_app.to_str().unwrap(),
            target_path.to_str().unwrap(),
        ])
        .output()?;

    if !copy_output.status.success() {
        return Err(format!(
            "Failed to copy app: {}",
            String::from_utf8_lossy(&copy_output.stderr)
        )
        .into());
    }

    // Unmount the DMG
    let _ = Command::new("hdiutil")
        .args(["detach", mount_point, "-quiet"])
        .output();

    // Clean up the DMG file
    let _ = std::fs::remove_file(dmg_path);

    // Restart the app
    let _ = Command::new("open")
        .arg(target_path.to_str().unwrap())
        .spawn();

    // Exit current instance gracefully (allows destructors to run)
    app_handle.exit(0);

    Ok(())
}

#[cfg(not(target_os = "macos"))]
fn install_dmg(_dmg_path: &PathBuf, _app_handle: &tauri::AppHandle) -> Result<(), Box<dyn Error>> {
    Err("Auto-update is currently only supported on macOS".into())
}
