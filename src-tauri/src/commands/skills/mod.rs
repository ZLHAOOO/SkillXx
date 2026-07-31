use std::collections::{HashMap, HashSet};
use std::path::Path;

use crate::models::{AppConfig, InstalledSkillPackage, Skill, SkillScope};
use crate::services::{
    clear_default_skill_removed, is_default_skill, is_symlink_or_junction, mark_default_skill_removed,
    AppCache, ConfigManager, LinkerService, ScannerService, SkillPackageService,
};
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum BatchSkillToolTargetKind {
    Skill,
    Group,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum BatchSkillToolAction {
    Enable,
    Disable,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct BatchSkillToolTarget {
    pub kind: BatchSkillToolTargetKind,
    pub id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct BatchSetSkillToolsRequest {
    pub targets: Vec<BatchSkillToolTarget>,
    pub tool_ids: Vec<String>,
    pub action: BatchSkillToolAction,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct BatchSetSkillToolsFailure {
    pub target_kind: BatchSkillToolTargetKind,
    pub target_id: String,
    pub skill_id: Option<String>,
    pub tool_id: Option<String>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct BatchSetSkillToolsResponse {
    pub requested_target_count: usize,
    pub requested_tool_count: usize,
    pub resolved_skill_count: usize,
    pub attempted_operation_count: usize,
    pub applied_count: usize,
    pub skipped_count: usize,
    pub failed_count: usize,
    pub failures: Vec<BatchSetSkillToolsFailure>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct ResolvedBatchSkillTarget {
    target_kind: BatchSkillToolTargetKind,
    target_id: String,
    skill_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct BatchSkillToolOperation {
    target_kind: BatchSkillToolTargetKind,
    target_id: String,
    skill_id: String,
    tool_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct BatchOperationPlan {
    operations: Vec<BatchSkillToolOperation>,
    skipped_count: usize,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct BatchFailureContext {
    target_kind: BatchSkillToolTargetKind,
    target_id: String,
    skill_id: Option<String>,
    tool_id: Option<String>,
    message: String,
}

impl BatchFailureContext {
    fn into_failure(self) -> BatchSetSkillToolsFailure {
        BatchSetSkillToolsFailure {
            target_kind: self.target_kind,
            target_id: self.target_id,
            skill_id: self.skill_id,
            tool_id: self.tool_id,
            message: self.message,
        }
    }
}

fn batch_failure(
    target_kind: BatchSkillToolTargetKind,
    target_id: impl Into<String>,
    skill_id: Option<String>,
    tool_id: Option<String>,
    message: impl Into<String>,
) -> BatchFailureContext {
    BatchFailureContext {
        target_kind,
        target_id: target_id.into(),
        skill_id,
        tool_id,
        message: message.into(),
    }
}

fn resolve_skill_source_path(_config: &AppConfig, skill: &Skill) -> std::path::PathBuf {
    skill.path.clone()
}

#[cfg(test)]
fn load_skill_by_id(config: &AppConfig, skill_id: &str) -> Result<Skill, String> {
    let mut matches = ScannerService::scan_scoped_skills(config)?
        .into_iter()
        .filter(|item| item.id == skill_id)
        .collect::<Vec<_>>();

    if matches.len() > 1 {
        return Err(format!("Ambiguous skill id: {}", skill_id));
    }

    matches
        .pop()
        .ok_or_else(|| format!("Skill not found: {}", skill_id))
}

fn load_skill_by_instance_id(config: &AppConfig, instance_id: &str) -> Result<Skill, String> {
    ScannerService::scan_scoped_skills(config)?
        .into_iter()
        .find(|item| item.instance_id == instance_id)
        .ok_or_else(|| format!("Skill not found: {}", instance_id))
}

fn apply_skill_tool_enabled(
    config: &AppConfig,
    instance_id: &str,
    tool_id: &str,
    enabled: bool,
    skill_path: Option<&Path>,
) -> Result<(), String> {
    let tool_config = config
        .get_tool_config(tool_id)
        .ok_or_else(|| format!("Tool not found: {}", tool_id))?;

    if !tool_config.enabled {
        return Err(format!("Tool is disabled: {}", tool_id));
    }

    if enabled {
        let skill = load_skill_by_instance_id(config, instance_id)?;
        let skill_path = match skill_path {
            Some(path) => path.to_path_buf(),
            None => resolve_skill_source_path(config, &skill),
        };
        if !skill_path.exists() {
            return Err(format!("Skill not found: {}", instance_id));
        }

        return LinkerService::enable_skill_for_tool(
            &skill_path,
            &tool_config.skills_path,
            &skill.id,
            tool_id,
        );
    }

    let skill = load_skill_by_instance_id(config, instance_id)?;
    match LinkerService::check_link_for_scoped_skill(
        &skill.path,
        &tool_config.skills_path,
        &skill.id,
        tool_id,
        &skill.scope,
    ) {
        crate::services::LinkStatus::Valid => {
            LinkerService::disable_skill_for_tool(&tool_config.skills_path, &skill.id, tool_id)
        }
        crate::services::LinkStatus::Missing => Ok(()),
        _ => Err(format!(
            "Skill target belongs to another instance: {}",
            instance_id
        )),
    }
}

fn delete_skill_from_disk(config: &AppConfig, instance_id: &str) -> Result<(), String> {
    let skill = load_skill_by_instance_id(config, instance_id)?;
    let skill_path = resolve_skill_source_path(config, &skill);
    if !skill_path.exists() {
        return Err(format!("Skill not found: {}", instance_id));
    }

    for (tool_id, tool_config) in config.collect_tool_configs() {
        match LinkerService::check_link_for_scoped_skill(
            &skill.path,
            &tool_config.skills_path,
            &skill.id,
            &tool_id,
            &skill.scope,
        ) {
            crate::services::LinkStatus::Valid => {
                let _ = LinkerService::disable_skill_for_tool(
                    &tool_config.skills_path,
                    &skill.id,
                    &tool_id,
                );
            }
            crate::services::LinkStatus::Missing => {}
            _ => {}
        }
    }
    std::fs::remove_dir_all(&skill_path)
        .map_err(|e| format!("Failed to delete skill folder: {}", e))?;

    Ok(())
}

fn resolve_batch_targets(
    targets: &[BatchSkillToolTarget],
    skills_by_instance_id: &HashMap<String, Skill>,
    packages_by_id: &HashMap<String, InstalledSkillPackage>,
) -> (Vec<ResolvedBatchSkillTarget>, Vec<BatchFailureContext>) {
    let mut resolved = Vec::new();
    let mut failures = Vec::new();

    for target in targets {
        match target.kind {
            BatchSkillToolTargetKind::Skill => {
                if skills_by_instance_id.contains_key(&target.id) {
                    resolved.push(ResolvedBatchSkillTarget {
                        target_kind: BatchSkillToolTargetKind::Skill,
                        target_id: target.id.clone(),
                        skill_id: target.id.clone(),
                    });
                } else {
                    failures.push(batch_failure(
                        BatchSkillToolTargetKind::Skill,
                        target.id.clone(),
                        Some(target.id.clone()),
                        None,
                        format!("Skill not found: {}", target.id),
                    ));
                }
            }
            BatchSkillToolTargetKind::Group => {
                let Some(skill_package) = packages_by_id.get(&target.id) else {
                    failures.push(batch_failure(
                        BatchSkillToolTargetKind::Group,
                        target.id.clone(),
                        None,
                        None,
                        format!("Skill group not found: {}", target.id),
                    ));
                    continue;
                };

                for skill_id in &skill_package.installed_members {
                    let matching_skills = skills_by_instance_id
                        .values()
                        .filter(|skill| &skill.id == skill_id)
                        .collect::<Vec<_>>();

                    if matching_skills.is_empty() {
                        failures.push(batch_failure(
                            BatchSkillToolTargetKind::Group,
                            target.id.clone(),
                            Some(skill_id.clone()),
                            None,
                            format!("Skill not found: {}", skill_id),
                        ));
                        continue;
                    }

                    let Some(preferred_skill) = matching_skills
                        .iter()
                        .find(|skill| skill.scope == SkillScope::Global)
                    else {
                        failures.push(batch_failure(
                            BatchSkillToolTargetKind::Group,
                            target.id.clone(),
                            Some(skill_id.clone()),
                            None,
                            format!("Global skill not found for group member: {}", skill_id),
                        ));
                        continue;
                    };

                    resolved.push(ResolvedBatchSkillTarget {
                        target_kind: BatchSkillToolTargetKind::Group,
                        target_id: target.id.clone(),
                        skill_id: preferred_skill.instance_id.clone(),
                    });
                }
            }
        }
    }

    (resolved, failures)
}

fn build_batch_operations(
    resolved_targets: &[ResolvedBatchSkillTarget],
    tool_ids: &[String],
    skills_by_instance_id: &HashMap<String, Skill>,
    config: &AppConfig,
    action: &BatchSkillToolAction,
) -> (BatchOperationPlan, Vec<BatchFailureContext>) {
    let mut failures = Vec::new();
    let mut seen = HashSet::new();
    let mut operations = Vec::new();
    let mut skipped_count = 0;
    let should_enable = matches!(action, BatchSkillToolAction::Enable);

    for resolved_target in resolved_targets {
        let Some(skill) = skills_by_instance_id.get(&resolved_target.skill_id) else {
            failures.push(batch_failure(
                resolved_target.target_kind.clone(),
                resolved_target.target_id.clone(),
                Some(resolved_target.skill_id.clone()),
                None,
                format!("Skill not found: {}", resolved_target.skill_id),
            ));
            continue;
        };

        for tool_id in tool_ids {
            if !seen.insert((resolved_target.skill_id.clone(), tool_id.clone())) {
                continue;
            }

            let Some(tool_config) = config.get_tool_config(tool_id) else {
                failures.push(batch_failure(
                    resolved_target.target_kind.clone(),
                    resolved_target.target_id.clone(),
                    Some(resolved_target.skill_id.clone()),
                    Some(tool_id.clone()),
                    format!("Tool not found: {}", tool_id),
                ));
                continue;
            };

            if !tool_config.enabled {
                failures.push(batch_failure(
                    resolved_target.target_kind.clone(),
                    resolved_target.target_id.clone(),
                    Some(resolved_target.skill_id.clone()),
                    Some(tool_id.clone()),
                    format!("Tool is disabled: {}", tool_id),
                ));
                continue;
            }

            if skill.is_enabled_for(tool_id) == should_enable {
                skipped_count += 1;
                continue;
            }

            operations.push(BatchSkillToolOperation {
                target_kind: resolved_target.target_kind.clone(),
                target_id: resolved_target.target_id.clone(),
                skill_id: resolved_target.skill_id.clone(),
                tool_id: tool_id.clone(),
            });
        }
    }

    (
        BatchOperationPlan {
            operations,
            skipped_count,
        },
        failures,
    )
}

#[tauri::command]
pub fn batch_set_skill_tools(
    request: BatchSetSkillToolsRequest,
    cache: State<AppCache>,
) -> Result<BatchSetSkillToolsResponse, String> {
    let manager = ConfigManager::new();
    let config = manager.load()?;
    let skills = ScannerService::scan_scoped_skills(&config)?;
    let skill_packages = SkillPackageService::list_discovered_packages(&config.skills_dir)?;
    let skills_by_instance_id: HashMap<String, Skill> = skills
        .into_iter()
        .map(|skill| (skill.instance_id.clone(), skill))
        .collect();
    let packages_by_id: HashMap<String, InstalledSkillPackage> = skill_packages
        .into_iter()
        .map(|skill_package| (skill_package.package_id.clone(), skill_package))
        .collect();

    let requested_target_count = request.targets.len();
    let requested_tool_count = request.tool_ids.len();
    let (resolved_targets, mut failures) =
        resolve_batch_targets(&request.targets, &skills_by_instance_id, &packages_by_id);
    let resolved_skill_ids: HashSet<String> = resolved_targets
        .iter()
        .map(|target| target.skill_id.clone())
        .collect();
    let (operation_plan, operation_failures) = build_batch_operations(
        &resolved_targets,
        &request.tool_ids,
        &skills_by_instance_id,
        &config,
        &request.action,
    );
    failures.extend(operation_failures);

    let mut applied_count = 0;
    let should_enable = matches!(request.action, BatchSkillToolAction::Enable);

    for operation in &operation_plan.operations {
        let skill_path = skills_by_instance_id
            .get(&operation.skill_id)
            .map(|skill| skill.path.as_path());
        if let Err(message) = apply_skill_tool_enabled(
            &config,
            &operation.skill_id,
            &operation.tool_id,
            should_enable,
            skill_path,
        ) {
            failures.push(batch_failure(
                operation.target_kind.clone(),
                operation.target_id.clone(),
                Some(operation.skill_id.clone()),
                Some(operation.tool_id.clone()),
                message,
            ));
            continue;
        }

        applied_count += 1;
    }

    if applied_count > 0 {
        cache.invalidate_skills();
    }

    let failures: Vec<BatchSetSkillToolsFailure> = failures
        .into_iter()
        .map(BatchFailureContext::into_failure)
        .collect();
    let failed_count = failures.len();

    Ok(BatchSetSkillToolsResponse {
        requested_target_count,
        requested_tool_count,
        resolved_skill_count: resolved_skill_ids.len(),
        attempted_operation_count: operation_plan.operations.len(),
        applied_count,
        skipped_count: operation_plan.skipped_count,
        failed_count,
        failures,
    })
}

#[cfg(test)]
mod tests;

#[tauri::command]
pub fn list_skills(cache: State<AppCache>) -> Result<Vec<Skill>, String> {
    // Try to get from cache first
    if let Some(skills) = cache.get_skills() {
        return Ok(skills);
    }

    // Cache miss - scan and cache
    let manager = ConfigManager::new();
    let config = manager.load()?;
    let skills = ScannerService::scan_scoped_skills(&config)?;
    cache.set_skills(skills.clone());
    Ok(skills)
}

#[tauri::command]
pub fn enable_skill(
    instance_id: String,
    tool_id: String,
    cache: State<AppCache>,
) -> Result<(), String> {
    let manager = ConfigManager::new();
    let config = manager.load()?;

    let skill = load_skill_by_instance_id(&config, &instance_id)?;
    let skill_id = skill.id.clone();
    apply_skill_tool_enabled(
        &config,
        &instance_id,
        &tool_id,
        true,
        Some(skill.path.as_path()),
    )?;

    // Re-enabling a default skill that the user previously removed clears the
    // opt-out so future auto-link cycles pick it up again.
    if is_default_skill(&skill_id) {
        clear_default_skill_removed(&skill_id, &tool_id)?;
    }

    // Invalidate cache after modification
    cache.invalidate_skills();
    Ok(())
}

#[tauri::command]
pub fn disable_skill(
    instance_id: String,
    tool_id: String,
    cache: State<AppCache>,
) -> Result<(), String> {
    let manager = ConfigManager::new();
    let config = manager.load()?;

    let skill = load_skill_by_instance_id(&config, &instance_id)?;
    let skill_id = skill.id.clone();
    apply_skill_tool_enabled(&config, &instance_id, &tool_id, false, None)?;

    // Record the user opt-out so auto-link won't re-add the default skill on
    // future detections. This only matters if the skill is one of the bundled
    // defaults; for normal skills it's a no-op.
    if is_default_skill(&skill_id) {
        mark_default_skill_removed(&skill_id, &tool_id)?;
    }

    // Invalidate cache after modification
    cache.invalidate_skills();
    Ok(())
}

#[tauri::command]
pub fn scan_existing_skills() -> Result<Vec<crate::models::Skill>, String> {
    crate::services::ScannerService::scan_all_tools()
}

#[tauri::command]
pub fn import_skills_to_hub(
    skill_paths: Vec<String>,
    cache: State<AppCache>,
) -> Result<(), String> {
    for path in skill_paths {
        crate::services::LinkerService::import_to_hub(&path)?;
    }
    // Invalidate cache after import
    cache.invalidate_skills();
    Ok(())
}

#[tauri::command]
pub fn delete_skill(instance_id: String, cache: State<AppCache>) -> Result<(), String> {
    let manager = ConfigManager::new();
    let config = manager.load()?;

    delete_skill_from_disk(&config, &instance_id)?;

    // Invalidate cache after deletion
    cache.invalidate_skills();
    Ok(())
}

#[tauri::command]
pub fn create_skill(
    name: String,
    description: Option<String>,
    cache: State<AppCache>,
) -> Result<Skill, String> {
    let manager = ConfigManager::new();
    let config = manager.load()?;

    // Convert name to a valid folder ID: lowercase, spaces to hyphens, remove special chars
    let id: String = name
        .trim()
        .to_lowercase()
        .chars()
        .map(|c| if c == ' ' { '-' } else { c })
        .filter(|c| c.is_alphanumeric() || *c == '-' || *c == '_')
        .collect();

    if id.is_empty() {
        return Err("Invalid skill name".to_string());
    }

    let skill_path = config.skills_dir.join(&id);
    if skill_path.exists() {
        return Err(format!("Skill \"{}\" already exists", id));
    }

    // Create the skill folder
    std::fs::create_dir_all(&skill_path)
        .map_err(|e| format!("Failed to create skill folder: {}", e))?;

    // Generate initial SKILL.md with frontmatter (follows official template)
    let desc = description
        .as_deref()
        .filter(|d| !d.is_empty())
        .unwrap_or("Replace with description of the skill and when Claude should use it.");
    let content = format!(
        "---\nname: {}\ndescription: {}\n---\n\n# Insert instructions below\n",
        id, desc
    );

    let skill_md_path = skill_path.join("SKILL.md");
    std::fs::write(&skill_md_path, &content)
        .map_err(|e| format!("Failed to write SKILL.md: {}", e))?;

    // Load and return the new Skill object
    let skill = ScannerService::load_skill_with_config(&skill_path, &config)?;

    // Invalidate cache
    cache.invalidate_skills();

    Ok(skill)
}

#[tauri::command]
pub fn refresh_skills(cache: State<AppCache>) -> Result<Vec<Skill>, String> {
    let manager = ConfigManager::new();
    let config = manager.load()?;

    // Scan all tool directories for new skills and import them to hub
    // Use rayon for parallel processing to speed up IO on Windows
    use rayon::prelude::*;

    let tools = config.collect_tool_configs();

    tools.par_iter().for_each(|(_tool_id, tool_config)| {
        if tool_config.skills_path.exists() {
            if let Ok(entries) = std::fs::read_dir(&tool_config.skills_path) {
                // Use par_bridge to iterate over directory entries in parallel
                entries.flatten().par_bridge().for_each(|entry| {
                    let path = entry.path();
                    // Skip hidden directories and non-directories
                    if !path.is_dir() {
                        return;
                    }
                    if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                        if name.starts_with('.') {
                            return;
                        }
                    }
                    // Skip if it's already a symlink or Junction (managed by us)
                    if is_symlink_or_junction(&path) {
                        return;
                    }
                    // Import this skill to hub
                    let _ = LinkerService::import_to_hub(path.to_string_lossy().as_ref());
                });
            }
        }
    });

    // Scan and update cache
    let skills = ScannerService::scan_scoped_skills(&config)?;
    cache.set_skills(skills.clone());
    Ok(skills)
}
