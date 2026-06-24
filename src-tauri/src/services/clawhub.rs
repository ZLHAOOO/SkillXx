use reqwest::Client;
use serde::Deserialize;
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use urlencoding;
use zip::ZipArchive;

const CLAWHUB_API_BASE: &str = "https://clawhub.ai/api/v1";
const CLAWHUB_SOURCE_ID: &str = "clawhub";

#[derive(Debug, Clone, Deserialize)]
struct ClawHubSearchResult {
    score: Option<f64>,
    slug: Option<String>,
    #[serde(rename = "displayName")]
    display_name: Option<String>,
    summary: Option<String>,
    #[serde(rename = "version")]
    latest_version: Option<String>,
    #[serde(rename = "updatedAt")]
    updated_at: Option<i64>,
    #[serde(rename = "ownerHandle")]
    owner_handle: Option<String>,
    owner: Option<ClawHubOwner>,
}

#[derive(Debug, Clone, Deserialize)]
struct ClawHubOwner {
    #[serde(rename = "displayName")]
    display_name: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
struct ClawHubSkillListItem {
    slug: String,
    #[serde(rename = "displayName")]
    display_name: Option<String>,
    summary: Option<String>,
    description: Option<String>,
    tags: Option<serde_json::Value>,
    stats: Option<ClawHubStats>,
    #[serde(rename = "createdAt")]
    created_at: Option<i64>,
    #[serde(rename = "updatedAt")]
    updated_at: Option<i64>,
    #[serde(rename = "latestVersion")]
    latest_version: Option<ClawHubLatestVersion>,
}

#[derive(Debug, Clone, Deserialize)]
struct ClawHubStats {
    #[serde(rename = "downloads")]
    downloads: Option<u64>,
    #[serde(rename = "installsAllTime")]
    installs_all_time: Option<u64>,
    #[serde(rename = "installsCurrent")]
    installs_current: Option<u64>,
    versions: Option<u64>,
}

#[derive(Debug, Clone, Deserialize)]
struct ClawHubLatestVersion {
    version: Option<String>,
    #[serde(rename = "createdAt")]
    created_at: Option<i64>,
    changelog: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
struct ClawHubSkillResponse {
    skill: Option<ClawHubSkillDetail>,
    #[serde(rename = "latestVersion")]
    latest_version: Option<ClawHubLatestVersion>,
    owner: Option<ClawHubOwner>,
}

#[derive(Debug, Clone, Deserialize)]
struct ClawHubSkillDetail {
    slug: String,
    #[serde(rename = "displayName")]
    display_name: Option<String>,
    summary: Option<String>,
    tags: Option<serde_json::Value>,
    stats: Option<ClawHubStats>,
    #[serde(rename = "createdAt")]
    created_at: Option<i64>,
    #[serde(rename = "updatedAt")]
    updated_at: Option<i64>,
}

#[derive(Debug, Clone, Deserialize)]
struct ClawHubSkillListResponse {
    items: Vec<ClawHubSkillListItem>,
    #[serde(rename = "nextCursor")]
    next_cursor: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
struct ClawHubSearchResponse {
    results: Vec<ClawHubSearchResult>,
}

pub struct ClawHubService;

impl ClawHubService {
    fn build_client() -> Client {
        Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .connect_timeout(std::time::Duration::from_secs(10))
            .build()
            .expect("Failed to build HTTP client")
    }

    async fn api_get<T: serde::de::DeserializeOwned>(
        client: &Client,
        path: &str,
        params: &[(&str, String)],
    ) -> Result<T, String> {
        let url = format!("{}{}", CLAWHUB_API_BASE, path);
        let mut request = client.get(&url).header("User-Agent", "SkillX-App/1.0");

        for (key, value) in params {
            request = request.query(&[(key, value.as_str())]);
        }

        let response = request
            .send()
            .await
            .map_err(|e| format!("ClawHub API request failed: {}", e))?;

        let status = response.status();
        if !status.is_success() {
            let body = response
                .text()
                .await
                .unwrap_or_else(|_| "No response body".to_string());
            return Err(format!("ClawHub API error {}: {}", status, body));
        }

        response
            .json::<T>()
            .await
            .map_err(|e| format!("Failed to parse ClawHub response: {}", e))
    }

    /// Search skills on ClawHub
    pub async fn search(query: &str, limit: Option<u32>) -> Result<Vec<crate::commands::platform_marketplace::PlatformSkill>, String> {
        let client = Self::build_client();
        let limit_val = limit.unwrap_or(20).min(50);

        let response: ClawHubSearchResponse = Self::api_get(
            &client,
            "/search",
            &[("q", query.to_string()), ("limit", limit_val.to_string())],
        )
        .await?;

        let skills: Vec<crate::commands::platform_marketplace::PlatformSkill> = response
            .results
            .into_iter()
            .filter_map(|r| {
                let slug = r.slug.unwrap_or_else(|| r.display_name.clone().unwrap_or_default());
                let name = r.display_name.clone().unwrap_or_else(|| slug.clone());
                let description = r.summary.clone().unwrap_or_default();
                let author = r
                    .owner
                    .as_ref()
                    .and_then(|o| o.display_name.clone())
                    .or_else(|| r.owner_handle.clone())
                    .unwrap_or_default();

                Some(crate::commands::platform_marketplace::PlatformSkill {
                    name,
                    slug,
                    author,
                    description,
                    downloads: 0,
                    platform: CLAWHUB_SOURCE_ID.to_string(),
                    repo_url: None,
                    skill_path: None,
                })
            })
            .collect();

        Ok(skills)
    }

    /// List skills from ClawHub (paginated)
    pub async fn list_skills(
        limit: Option<u32>,
        cursor: Option<&str>,
    ) -> Result<(Vec<crate::commands::platform_marketplace::PlatformSkill>, Option<String>), String> {
        let client = Self::build_client();
        let limit_val = limit.unwrap_or(20).min(50);

        let mut params = vec![("limit", limit_val.to_string())];
        if let Some(c) = cursor {
            params.push(("cursor", c.to_string()));
        }

        let response: ClawHubSkillListResponse =
            Self::api_get(&client, "/skills", &params).await?;

        let skills: Vec<crate::commands::platform_marketplace::PlatformSkill> = response
            .items
            .into_iter()
            .map(|item| {
                let name = item
                    .display_name
                    .clone()
                    .unwrap_or_else(|| item.slug.clone());
                let description = item
                    .summary
                    .clone()
                    .or_else(|| item.description.clone())
                    .unwrap_or_default();
                let downloads = item
                    .stats
                    .as_ref()
                    .and_then(|s| s.downloads.or(s.installs_all_time).or(s.installs_current))
                    .unwrap_or(0);

                crate::commands::platform_marketplace::PlatformSkill {
                    name,
                    slug: item.slug.clone(),
                    author: String::new(),
                    description,
                    downloads,
                    platform: CLAWHUB_SOURCE_ID.to_string(),
                    repo_url: None,
                    skill_path: None,
                }
            })
            .collect();

        Ok((skills, response.next_cursor))
    }

    /// Get skill detail from ClawHub
    pub async fn get_skill_detail(slug: &str) -> Result<crate::commands::platform_marketplace::PlatformSkill, String> {
        let client = Self::build_client();

        let response: ClawHubSkillResponse =
            Self::api_get(&client, &format!("/skills/{}", slug), &[]).await?;

        let skill = response
            .skill
            .ok_or_else(|| format!("Skill '{}' not found on ClawHub", slug))?;

        let name = skill
            .display_name
            .clone()
            .unwrap_or_else(|| skill.slug.clone());
        let description = skill.summary.clone().unwrap_or_default();
        let downloads = skill
            .stats
            .as_ref()
            .and_then(|s| s.downloads.or(s.installs_all_time).or(s.installs_current))
            .unwrap_or(0);

        Ok(crate::commands::platform_marketplace::PlatformSkill {
            name,
            slug: skill.slug,
            author: response
                .owner
                .as_ref()
                .and_then(|o| o.display_name.clone())
                .unwrap_or_default(),
            description,
            downloads,
            platform: CLAWHUB_SOURCE_ID.to_string(),
            repo_url: None,
            skill_path: None,
        })
    }

    /// Get skill file content from ClawHub
    pub async fn get_skill_file(slug: &str, path: &str) -> Result<String, String> {
        let client = Self::build_client();

        let response = client
            .get(format!("{}/skills/{}/file", CLAWHUB_API_BASE, slug))
            .query(&[("path", path)])
            .header("User-Agent", "SkillX-App/1.0")
            .send()
            .await
            .map_err(|e| format!("Failed to fetch skill file: {}", e))?;

        let status = response.status();
        if !status.is_success() {
            return Err(format!(
                "ClawHub file API error {}: Failed to fetch '{}'",
                status, path
            ));
        }

        response
            .text()
            .await
            .map_err(|e| format!("Failed to read file content: {}", e))
    }

    /// Download and install a skill from ClawHub
    pub async fn install_skill(slug: &str, install_dir: &Path) -> Result<crate::commands::platform_marketplace::InstallResult, String> {
        let client = Self::build_client();

        // Clean up existing installation
        if install_dir.exists() {
            fs::remove_dir_all(install_dir).map_err(|e| format!("无法删除已有 Skill 目录: {}", e))?;
        }

        fs::create_dir_all(install_dir).map_err(|e| format!("无法创建 Skills 目录: {}", e))?;

        // Download the ZIP from ClawHub
        let download_url = format!("{}/download?slug={}", CLAWHUB_API_BASE, urlencoding::encode(slug));
        let response = client
            .get(&download_url)
            .header("User-Agent", "SkillX-App/1.0")
            .send()
            .await
            .map_err(|e| format!("下载 Skill 失败: {}", e))?;

        let status = response.status();
        if !status.is_success() {
            let body = response
                .text()
                .await
                .unwrap_or_else(|_| "No response body".to_string());
            return Err(format!("ClawHub 下载失败 ({}): {}", status, body));
        }

        let bytes = response
            .bytes()
            .await
            .map_err(|e| format!("读取下载内容失败: {}", e))?;

        // Extract ZIP
        let reader = std::io::Cursor::new(bytes);
        let mut zip = ZipArchive::new(reader)
            .map_err(|e| format!("无效的 ZIP 文件: {}", e))?;

        for i in 0..zip.len() {
            let mut file = zip
                .by_index(i)
                .map_err(|e| format!("读取 ZIP 条目失败: {}", e))?;
            let file_name = file.name().to_string();

            // Skip directory entries and macOS metadata
            if file_name.ends_with('/') || file_name.starts_with("__MACOSX") || file_name.starts_with(".") {
                continue;
            }

            let target_path = install_dir.join(&file_name);

            // Security: prevent path traversal
            if !target_path.starts_with(install_dir) {
                return Err(format!("非法文件路径 (路径遍历攻击): {}", file_name));
            }

            if let Some(parent) = target_path.parent() {
                fs::create_dir_all(parent)
                    .map_err(|e| format!("无法创建目录 {}: {}", parent.display(), e))?;
            }

            let mut output = fs::File::create(&target_path)
                .map_err(|e| format!("无法创建文件 {}: {}", target_path.display(), e))?;
            std::io::copy(&mut file, &mut output)
                .map_err(|e| format!("无法写入文件 {}: {}", target_path.display(), e))?;
        }

        // Write meta.json
        write_clawhub_meta(install_dir, slug)?;

        Ok(crate::commands::platform_marketplace::InstallResult {
            success: true,
            message: format!("Successfully installed {}", slug),
        })
    }

    /// Get skill file tree structure from ClawHub versions
    pub async fn get_skill_files(slug: &str) -> Result<Vec<crate::services::file_ops::FileNode>, String> {
        let client = Self::build_client();

        // Get the latest version first
        let detail_response: ClawHubSkillResponse =
            Self::api_get(&client, &format!("/skills/{}", slug), &[]).await?;

        let latest_version = detail_response
            .latest_version
            .as_ref()
            .and_then(|v| v.version.clone())
            .unwrap_or_else(|| "latest".to_string());

        // Get version details with file list
        let version_response: serde_json::Value = Self::api_get(
            &client,
            &format!("/skills/{}/versions/{}", slug, latest_version),
            &[],
        )
        .await?;

        let files = version_response
            .get("version")
            .and_then(|v| v.get("files"))
            .and_then(|f| f.as_array())
            .ok_or_else(|| "No file list available for this skill version".to_string())?;

        let flat_nodes: Vec<crate::services::file_ops::FileNode> = files
            .iter()
            .filter_map(|f| {
                let path = f.get("path")?.as_str()?.to_string();
                let name = path.split('/').last().unwrap_or("").to_string();

                Some(crate::services::file_ops::FileNode {
                    path,
                    name,
                    is_dir: false,
                    children: None,
                })
            })
            .collect();

        Ok(build_tree(flat_nodes))
    }
}

fn write_clawhub_meta(dir: &Path, slug: &str) -> Result<(), String> {
    let meta = serde_json::json!({
        "name": slug,
        "description": format!("Installed from ClawHub (slug: {})", slug),
        "version": "1.0",
        "source": "clawhub",
        "clawhub_slug": slug,
    });

    let content =
        serde_json::to_string_pretty(&meta).map_err(|e| format!("写入 meta.json 失败: {}", e))?;
    fs::write(dir.join("meta.json"), content).map_err(|e| format!("写入 meta.json 失败: {}", e))?;
    Ok(())
}

/// Build a tree of FileNode from a flat list of file paths.
/// Directories are inferred from path separators.
fn build_tree(mut nodes: Vec<crate::services::file_ops::FileNode>) -> Vec<crate::services::file_ops::FileNode> {
    if nodes.is_empty() {
        return Vec::new();
    }

    // Sort by path for consistent ordering
    nodes.sort_by(|a, b| a.path.cmp(&b.path));

    let mut root_dirs: HashMap<String, Vec<crate::services::file_ops::FileNode>> = HashMap::new();
    let mut root_files: Vec<crate::services::file_ops::FileNode> = Vec::new();

    for node in nodes {
        let parts: Vec<&str> = node.path.split('/').collect();
        if parts.len() == 1 {
            root_files.push(node);
        } else {
            let dir_path = parts[..parts.len() - 1].join("/");
            root_dirs.entry(dir_path).or_default().push(node);
        }
    }

    // Build directory tree from nested structure
    let mut tree: Vec<crate::services::file_ops::FileNode> = Vec::new();

    // Process root files
    tree.extend(root_files);

    // Process root directories
    for (dir_path, mut children) in root_dirs {
        let dir_node = build_dir_node(&dir_path, &mut children);
        tree.push(dir_node);
    }

    // Sort: directories first, then files, alphabetically
    sort_tree(&mut tree);

    tree
}

fn build_dir_node(
    dir_path: &str,
    children: &mut Vec<crate::services::file_ops::FileNode>,
) -> crate::services::file_ops::FileNode {
    sort_tree(children);

    let name = dir_path
        .rsplit('/')
        .next()
        .unwrap_or(dir_path)
        .to_string();

    crate::services::file_ops::FileNode {
        name: name.clone(),
        path: dir_path.to_string(),
        is_dir: true,
        children: Some(std::mem::take(children)),
    }
}

fn sort_tree(nodes: &mut [crate::services::file_ops::FileNode]) {
    nodes.sort_by(|a, b| {
        let a_is_dir = a.children.as_ref().map(|c| !c.is_empty()).unwrap_or(false);
        let b_is_dir = b.children.as_ref().map(|c| !c.is_empty()).unwrap_or(false);
        if a_is_dir && !b_is_dir {
            std::cmp::Ordering::Less
        } else if !a_is_dir && b_is_dir {
            std::cmp::Ordering::Greater
        } else {
            a.path.cmp(&b.path)
        }
    });
    for node in nodes.iter_mut() {
        if let Some(ref mut children) = node.children {
            sort_tree(children);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::file_ops::FileNode;

    #[test]
    fn build_tree_sorts_and_groups() {
        let nodes = vec![
            FileNode { path: "b/file.txt".into(), name: "file.txt".into(), is_dir: false, children: None },
            FileNode { path: "a/file.txt".into(), name: "file.txt".into(), is_dir: false, children: None },
            FileNode { path: "a/sub/inner.txt".into(), name: "inner.txt".into(), is_dir: false, children: None },
            FileNode { path: "top.md".into(), name: "top.md".into(), is_dir: false, children: None },
        ];
        let tree = build_tree(nodes);
        assert_eq!(tree.len(), 3);
        assert_eq!(tree[0].path, "a");
        assert_eq!(tree[1].path, "b");
        assert_eq!(tree[2].path, "top.md");
        assert_eq!(tree[0].children.as_ref().unwrap().len(), 2);
        assert_eq!(tree[0].children.as_ref().unwrap()[0].path, "a/file.txt");
        assert_eq!(tree[0].children.as_ref().unwrap()[1].path, "a/sub");
        assert_eq!(tree[0].children.as_ref().unwrap()[1].children.as_ref().unwrap()[0].path, "a/sub/inner.txt");
    }

    #[test]
    fn build_tree_empty() {
        let tree = build_tree(Vec::new());
        assert!(tree.is_empty());
    }

    #[test]
    fn build_tree_single_file() {
        let nodes = vec![
            FileNode { path: "README.md".into(), name: "README.md".into(), is_dir: false, children: None },
        ];
        let tree = build_tree(nodes);
        assert_eq!(tree.len(), 1);
        assert_eq!(tree[0].path, "README.md");
    }
}
