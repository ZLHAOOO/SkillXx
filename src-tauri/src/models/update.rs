use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UpdateInfo {
    pub has_update: bool,
    pub latest_version: String,
    pub download_url: String,
    pub release_notes: Option<String>,
    pub asset_download_url: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct GithubRelease {
    pub tag_name: String,
    pub html_url: String,
    pub body: Option<String>,
    pub assets: Option<Vec<GithubAsset>>,
}

#[derive(Debug, Deserialize)]
pub struct GithubAsset {
    pub name: String,
    pub browser_download_url: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DownloadProgress {
    pub percent: f64,
    pub downloaded: u64,
    pub total: u64,
    pub status: DownloadStatus,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum DownloadStatus {
    Downloading,
    Installing,
    Done,
    Failed(String),
}
