use crate::services::clawhub::ClawHubService;
use crate::services::config_manager::ConfigManager;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Command;

use crate::models::marketplace::MarketplaceSkillsResponse;
use crate::services::marketplace::MarketplaceService;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlatformSkill {
    pub name: String,
    pub slug: String,
    pub author: String,
    pub description: String,
    pub downloads: u64,
    pub platform: String,
    pub repo_url: Option<String>,
    pub skill_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstallResult {
    pub success: bool,
    pub message: String,
}

/// Check if a CLI tool is installed
#[tauri::command]
pub async fn check_cli_installed(tool: String) -> Result<bool, String> {
    // Use bash -c to check PATH properly
    let output = match tool.as_str() {
        "skillhub" => Command::new("bash")
            .args(["-c", "which skillhub 2>/dev/null || echo not_found"])
            .output(),
        "clawhub" => Command::new("bash")
            .args(["-c", "which clawhub 2>/dev/null || echo not_found"])
            .output(),
        "redskill" => Command::new("bash")
            .args(["-c", "which redskill 2>/dev/null || echo not_found"])
            .output(),
        _ => return Err(format!("Unknown tool: {}", tool)),
    };

    match output {
        Ok(result) => {
            let stdout = String::from_utf8_lossy(&result.stdout);
            Ok(!stdout.contains("not_found") && result.status.success())
        }
        Err(_) => Ok(false),
    }
}

const SKILLS_SH_SOURCE_ID: &str = "src_skills_sh_home";
const AWESOME_CLAUDE_SKILLS_SOURCE_ID: &str = "src_composio_awesome_claude_skills";

/// Install CLI tool (skillhub or clawhub)
#[tauri::command]
pub async fn install_cli_tool(tool: String) -> Result<InstallResult, String> {
    match tool.as_str() {
        "skillhub" => {
            // SkillHub uses curl script installation
            let output = Command::new("bash")
                .args(["-c", "curl -fsSL https://skillhub-1388575217.cos.ap-guangzhou.myqcloud.com/install/install.sh | bash -s -- --cli-only"])
                .output()
                .map_err(|e| format!("Failed to run installation script: {}", e))?;

            if output.status.success() {
                return Ok(InstallResult {
                    success: true,
                    message: "SkillHub CLI installed successfully".to_string(),
                });
            }

            let stderr = String::from_utf8_lossy(&output.stderr);
            Ok(InstallResult {
                success: false,
                message: format!("Failed to install SkillHub CLI: {}", stderr),
            })
        }
        "clawhub" => {
            // ClawHub uses npm global installation
            let output = Command::new("npm")
                .args(["install", "-g", "clawhub"])
                .output()
                .map_err(|e| format!("Failed to run npm: {}", e))?;

            if output.status.success() {
                // Verify installation by checking if clawhub is in PATH
                let verify_output = Command::new("bash")
                    .args(["-c", "which clawhub || echo not_found"])
                    .output()
                    .map_err(|e| format!("Failed to verify installation: {}", e))?;

                let verify_str = String::from_utf8_lossy(&verify_output.stdout);
                if verify_str.contains("not_found") {
                    // Try to find npm global bin path
                    let npm_root_output = Command::new("npm")
                        .args(["root", "-g"])
                        .output()
                        .map_err(|e| format!("Failed to get npm root: {}", e))?;

                    let npm_root = String::from_utf8_lossy(&npm_root_output.stdout).trim().to_string();
                    let npm_bin = npm_root.replace("node_modules", "bin");

                    return Ok(InstallResult {
                        success: true,
                        message: format!("ClawHub CLI installed. You may need to restart your terminal or add {} to your PATH", npm_bin),
                    });
                }

                return Ok(InstallResult {
                    success: true,
                    message: "ClawHub CLI installed successfully".to_string(),
                });
            }

            let stderr = String::from_utf8_lossy(&output.stderr);
            Ok(InstallResult {
                success: false,
                message: format!("Failed to install ClawHub CLI: {}", stderr),
            })
        }
        "redskill" => {
            // RedSkill uses curl script installation
            let output = Command::new("bash")
                .args(["-c", "curl -fsSL https://fe-video-qc.xhscdn.com/fe-platform-file/104101b8320fbjem2620653u0hejenq0004pf88g6ask5i.sh | bash -s -- --cli-only"])
                .output()
                .map_err(|e| format!("Failed to run installation script: {}", e))?;

            if output.status.success() {
                return Ok(InstallResult {
                    success: true,
                    message: "RedSkill CLI installed successfully".to_string(),
                });
            }

            let stderr = String::from_utf8_lossy(&output.stderr);
            Ok(InstallResult {
                success: false,
                message: format!("Failed to install RedSkill CLI: {}", stderr),
            })
        }
        _ => Err(format!("Unknown tool: {}", tool)),
    }
}

fn is_clawhub_enabled() -> Result<bool, String> {
    let manager = ConfigManager::new();
    let config = manager.load().map_err(|e| e.to_string())?;
    let sources = config.marketplace_sources.unwrap_or_default();
    Ok(sources.iter().any(|s| s.id == "clawhub" && s.enabled))
}

/// Search for skills on a platform (SkillHub, ClawHub, skills.sh, awesome-claude-skills)
#[tauri::command]
pub async fn search_marketplace(
    platform: String,
    query: String,
) -> Result<Vec<PlatformSkill>, String> {
    if query.trim().is_empty() {
        return Err("Search query cannot be empty".to_string());
    }

    match platform.as_str() {
        "skillhub" => {
            let output = Command::new("skillhub")
                .arg("search")
                .arg(&query)
                .output()
                .map_err(|e| format!("Failed to execute skillhub CLI: {}", e))?;

            if !output.status.success() {
                let stderr = String::from_utf8_lossy(&output.stderr);
                if stderr.contains("No skills found") || stderr.is_empty() {
                    return Ok(Vec::new());
                }
                return Err(format!("Search failed: {}", stderr));
            }

            let stdout = String::from_utf8_lossy(&output.stdout);
            parse_search_results(&stdout, &platform)
        }
        "redskill" => {
            let output = Command::new("redskill")
                .arg("search")
                .arg(&query)
                .output()
                .map_err(|e| format!("Failed to execute redskill CLI: {}", e))?;

            if !output.status.success() {
                let stderr = String::from_utf8_lossy(&output.stderr);
                if stderr.contains("No skills found") || stderr.is_empty() {
                    return Ok(Vec::new());
                }
                return Err(format!("Search failed: {}", stderr));
            }

            let stdout = String::from_utf8_lossy(&output.stdout);
            parse_search_results(&stdout, &platform)
        }
        "clawhub" => {
            if !is_clawhub_enabled()? {
                return Err("ClawHub is disabled in settings".to_string());
            }
            let skills = ClawHubService::search(&query, Some(20))
                .await
                .map_err(|e| format!("ClawHub API search failed: {}", e))?;
            Ok(skills)
        }
        "skills.sh" | "awesome-claude-skills" => {
            let source_id = match platform.as_str() {
                "skills.sh" => SKILLS_SH_SOURCE_ID,
                "awesome-claude-skills" => AWESOME_CLAUDE_SKILLS_SOURCE_ID,
                _ => return Err(format!("Unsupported platform: {}", platform)),
            };

            let response: MarketplaceSkillsResponse =
                MarketplaceService::fetch_marketplace_skills_by_source(source_id, Some(&query), 1)
                    .await
                    .map_err(|e| format!("Market API search failed: {}", e))?;

            let skills: Vec<PlatformSkill> = response
                .skills
                .into_iter()
                .map(|s| PlatformSkill {
                    name: s.name,
                    slug: s.slug.unwrap_or_else(|| s.id.clone()),
                    author: s.author.unwrap_or_default(),
                    description: s.description.unwrap_or_default(),
                    downloads: s.install_count.unwrap_or(0),
                    platform: platform.clone(),
                    repo_url: s.repo_url,
                    skill_path: s.skill_path,
                })
                .collect();

            Ok(skills)
        }
        _ => Err(format!("Unsupported platform: {}", platform)),
    }
}

/// Parse search results from CLI output (JSON format)
fn parse_search_results(output: &str, platform: &str) -> Result<Vec<PlatformSkill>, String> {
    // Try to parse as JSON first
    if let Ok(json_value) = serde_json::from_str::<serde_json::Value>(output) {
        let default_items: Vec<serde_json::Value> = Vec::new();
        let items = json_value.as_array().unwrap_or(&default_items);
        let skills: Vec<PlatformSkill> = items
            .iter()
            .filter_map(|item| {
                let name = item.get("name")?.as_str()?.to_string();
                let slug = item.get("slug").or_else(|| item.get("id")).and_then(|v| v.as_str()).unwrap_or(&name).to_string();
                let author = item.get("author").and_then(|v| v.as_str()).unwrap_or("Unknown").to_string();
                let description = item.get("description").and_then(|v| v.as_str()).unwrap_or("").to_string();
                let downloads = item.get("downloads").or_else(|| item.get("download_count")).and_then(|v| v.as_u64()).unwrap_or(0);
                
                Some(PlatformSkill {
                    name,
                    slug,
                    author,
                    description,
                    downloads,
                    platform: platform.to_string(),
                    repo_url: None,
                    skill_path: None,
                })
            })
            .collect();
        return Ok(skills);
    }

    // Fallback to line-by-line parsing
    let mut skills = Vec::new();
    for line in output.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') || line.starts_with("Name") || line.starts_with("⚠") || line.starts_with("-") {
            continue;
        }

        // ClawHub format: "slug  @author  description  (score)"
        // SkillHub format may differ; we try to extract what we can
        if let Some(skill) = parse_text_line(line, platform) {
            skills.push(skill);
        }
    }

    Ok(skills)
}

/// Parse a single line of CLI output into a PlatformSkill
/// Supports formats like:
///   "slug  @author  description  (score)"
///   "slug<TAB>author<TAB>description<TAB>downloads"
fn parse_text_line(line: &str, platform: &str) -> Option<PlatformSkill> {
    // Try ClawHub format: split by 2+ spaces
    let parts: Vec<&str> = line.split("  ").map(|s| s.trim()).filter(|s| !s.is_empty()).collect();
    if parts.len() >= 2 {
        let slug = parts[0].to_string();
        let author = if parts.len() >= 2 && parts[1].starts_with('@') {
            parts[1].trim_start_matches('@').to_string()
        } else {
            "Unknown".to_string()
        };
        // Description is everything except the score in parentheses
        let mut description = if parts.len() >= 3 {
            parts[2..parts.len()].join(" ")
        } else {
            String::new()
        };
        // Remove trailing score like "(3.690)"
        if let Some(idx) = description.rfind('(') {
            if description.ends_with(')') {
                description = description[..idx].trim().to_string();
            }
        }

        return Some(PlatformSkill {
            name: slug.clone(),
            slug,
            author,
            description,
            downloads: 0,
            platform: platform.to_string(),
            repo_url: None,
            skill_path: None,
        });
    }

    // Try tab-separated format
    let tab_parts: Vec<&str> = line.split('\t').collect();
    if tab_parts.len() >= 2 {
        return Some(PlatformSkill {
            name: tab_parts[0].to_string(),
            slug: tab_parts.get(1).unwrap_or(&tab_parts[0]).to_string(),
            author: tab_parts.get(2).unwrap_or(&"Unknown").to_string(),
            description: tab_parts.get(3).unwrap_or(&"").to_string(),
            downloads: tab_parts.get(4).and_then(|v| v.parse().ok()).unwrap_or(0),
            platform: platform.to_string(),
            repo_url: None,
            skill_path: None,
        });
    }

    None
}

/// Install a skill from a platform
#[tauri::command]
pub async fn install_from_platform(
    platform: String,
    slug: String,
) -> Result<InstallResult, String> {
    match platform.as_str() {
        "skillhub" => {
            let output = Command::new("skillhub")
                .arg("install")
                .arg(&slug)
                .output()
                .map_err(|e| format!("Failed to execute skillhub CLI: {}", e))?;

            if output.status.success() {
                Ok(InstallResult {
                    success: true,
                    message: format!("Successfully installed {}", slug),
                })
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr);
                Ok(InstallResult {
                    success: false,
                    message: format!("Installation failed: {}", stderr),
                })
            }
        }
        "redskill" => {
            let output = Command::new("redskill")
                .arg("install")
                .arg(&slug)
                .output()
                .map_err(|e| format!("Failed to execute redskill CLI: {}", e))?;

            if output.status.success() {
                Ok(InstallResult {
                    success: true,
                    message: format!("Successfully installed {}", slug),
                })
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr);
                Ok(InstallResult {
                    success: false,
                    message: format!("Installation failed: {}", stderr),
                })
            }
        }
        "clawhub" => {
            if !is_clawhub_enabled()? {
                return Ok(InstallResult {
                    success: false,
                    message: "ClawHub is disabled in settings".to_string(),
                });
            }
            let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
            let skills_dir = PathBuf::from(home).join(".skillx").join("skills");
            let install_dir = skills_dir.join(&slug);

            match ClawHubService::install_skill(&slug, &install_dir).await {
                Ok(result) => Ok(result),
                Err(e) => Ok(InstallResult {
                    success: false,
                    message: format!("Installation failed: {}", e),
                }),
            }
        }
        "skills.sh" | "awesome-claude-skills" => {
            // Use market API to install: first search for the skill, then install
            let source_id = match platform.as_str() {
                "skills.sh" => SKILLS_SH_SOURCE_ID,
                "awesome-claude-skills" => AWESOME_CLAUDE_SKILLS_SOURCE_ID,
                _ => return Err(format!("Unsupported platform: {}", platform)),
            };

            let skills_dir = std::env::current_dir().unwrap_or_default();
            let manager = crate::services::config_manager::ConfigManager::new();
            let config = manager.load().map_err(|e| e.to_string())?;
            let github_token = config
                .preferences
                .as_ref()
                .and_then(|prefs| prefs.github_token.clone())
                .map(|token| token.trim().to_string());

            // Search for the skill by slug
            let response = MarketplaceService::fetch_marketplace_skills_by_source(source_id, Some(&slug), 1)
                .await
                .map_err(|e| format!("Failed to search skill: {}", e))?;

            let skill = response.skills.into_iter().find(|s| {
                s.slug.as_deref().unwrap_or(&s.id) == slug
                    || s.name.to_lowercase() == slug.to_lowercase()
            });

            let skill = match skill {
                Some(s) => s,
                None => return Ok(InstallResult {
                    success: false,
                    message: format!("Skill '{}' not found on {}", slug, platform),
                }),
            };

            match MarketplaceService::install_skill(&skill, &skills_dir, github_token.as_deref()).await {
                Ok(_result) => Ok(InstallResult {
                    success: true,
                    message: format!("Successfully installed {}", slug),
                }),
                Err(e) => Ok(InstallResult {
                    success: false,
                    message: format!("Installation failed: {}", e),
                }),
            }
        }
        _ => Err(format!("Unsupported platform: {}", platform)),
    }
}
