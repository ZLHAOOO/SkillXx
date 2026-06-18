use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlatformSkill {
    pub name: String,
    pub slug: String,
    pub author: String,
    pub description: String,
    pub downloads: u64,
    pub platform: String,
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
        _ => Err(format!("Unknown tool: {}", tool)),
    }
}

/// Search for skills on a platform (SkillHub or ClawHub)
#[tauri::command]
pub async fn search_marketplace(
    platform: String,
    query: String,
) -> Result<Vec<PlatformSkill>, String> {
    if query.trim().is_empty() {
        return Err("Search query cannot be empty".to_string());
    }

    let output = match platform.as_str() {
        "skillhub" => {
            Command::new("skillhub")
                .arg("search")
                .arg(&query)
                .output()
                .map_err(|e| format!("Failed to execute skillhub CLI: {}", e))?
        }
        "clawhub" => {
            Command::new("clawhub")
                .arg("search")
                .arg(&query)
                .output()
                .map_err(|e| format!("Failed to execute clawhub CLI: {}", e))?
        }
        _ => return Err(format!("Unsupported platform: {}", platform)),
    };

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        // Don't return error for empty results, just return empty list
        if stderr.contains("No skills found") || stderr.is_empty() {
            return Ok(Vec::new());
        }
        return Err(format!("Search failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    parse_search_results(&stdout, &platform)
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
    let output = match platform.as_str() {
        "skillhub" => {
            Command::new("skillhub")
                .arg("install")
                .arg(&slug)
                .output()
                .map_err(|e| format!("Failed to execute skillhub CLI: {}", e))?
        }
        "clawhub" => {
            // ClawHub installs to <workdir>/<dir>/<slug> by default
            // We want to install to ~/.skillx/skills/<slug>
            // Use --workdir ~/.skillx and --dir skills
            let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
            let workdir = format!("{}/.skillx", home);
            Command::new("clawhub")
                .arg("install")
                .arg("--workdir")
                .arg(&workdir)
                .arg("--dir")
                .arg("skills")
                .arg(&slug)
                .output()
                .map_err(|e| format!("Failed to execute clawhub CLI: {}", e))?
        }
        _ => return Err(format!("Unsupported platform: {}", platform)),
    };

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
