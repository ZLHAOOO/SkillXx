//! Bundled ("default") skills shipped with the SkillX app.
//!
//! A default skill is owned by the app itself: it's embedded at compile time,
//! bootstrapped into the hub on first launch, and auto-linked to every enabled
//! agent — but the user can still remove the link from any specific agent, and
//! that choice is remembered (see [`removed_default_skills`] in `AppConfig`).
//!
//! To add a new default skill:
//! 1. Drop the SKILL.md under `src/assets/skills/<id>/`.
//! 2. Add a `BundledSkill` entry to [`BUNDLED_SKILLS`] below.

use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

use crate::models::AppConfig;
use crate::services::{ConfigManager, LinkerService};

/// Compile-time embedded content for a default skill.
struct BundledSkill {
    id: &'static str,
    /// Embedded at compile time. From `src-tauri/src/services/`, `../../../src/...`
    /// walks up three levels to the project root and into `src/assets/...`.
    skill_md: &'static str,
}

/// Default skills bundled with SkillX. Order does not matter.
const BUNDLED_SKILLS: &[BundledSkill] = &[
    BundledSkill {
        id: "skillx-find",
        skill_md: include_str!("../../../src/assets/skills/skillx-find/SKILL.md"),
    },
];

/// Returns the static list of default skill IDs.
pub fn default_skill_ids() -> &'static [&'static str] {
    &BUNDLED_SKILLS_SLICE
}

// Compile-time slice of just the IDs, for cheap iteration.
static BUNDLED_SKILLS_SLICE: &[&str] = {
    // Build at compile time by mapping over BUNDLED_SKILLS.
    // const fn map isn't stable, so we manually list them.
    // Keep in sync with BUNDLED_SKILLS above.
    &["skillx-find"]
};

/// `true` if the given skill id is one of the bundled defaults.
pub fn is_default_skill(skill_id: &str) -> bool {
    BUNDLED_SKILLS.iter().any(|b| b.id == skill_id)
}

/// Path of the bundled SKILL.md on disk for a default skill (used for bootstrap
/// from source rather than the embedded content — useful for development).
fn bundled_source_path(skill_id: &str) -> Option<PathBuf> {
    BUNDLED_SKILLS
        .iter()
        .find(|b| b.id == skill_id)
        .map(|b| PathBuf::from(b.skill_md))
}

/// Returns the embedded SKILL.md content for a default skill.
fn embedded_skill_md(skill_id: &str) -> Option<&'static str> {
    BUNDLED_SKILLS
        .iter()
        .find(|b| b.id == skill_id)
        .map(|b| b.skill_md)
}

/// Ensure every default skill exists in the user's hub. Idempotent: if the
/// destination SKILL.md already exists, it's left untouched (the user may have
/// edited it).
///
/// This is meant to be called once at app startup, before any tool detection.
pub fn ensure_all_default_skills_in_hub(hub_dir: &Path) -> Result<(), String> {
    fs::create_dir_all(hub_dir)
        .map_err(|e| format!("Failed to create hub directory: {}", e))?;

    for skill in BUNDLED_SKILLS {
        ensure_default_skill_in_hub(skill.id, hub_dir)?;
    }
    Ok(())
}

/// Ensure a single default skill exists in the hub. Idempotent: if the
/// destination SKILL.md already exists, the function is a no-op.
pub fn ensure_default_skill_in_hub(skill_id: &str, hub_dir: &Path) -> Result<(), String> {
    if !is_default_skill(skill_id) {
        return Err(format!("Not a default skill: {}", skill_id));
    }

    let dest = hub_dir.join(skill_id);
    let dest_md = dest.join("SKILL.md");

    if dest_md.exists() {
        return Ok(());
    }

    // Prefer the on-disk source during development (so live edits to
    // `src/assets/skills/<id>/SKILL.md` propagate without a rebuild). Fall back
    // to the embedded content if the source file is missing.
    let content = match bundled_source_path(skill_id) {
        Some(src) if src.exists() => fs::read_to_string(&src).map_err(|e| {
            format!(
                "Failed to read bundled skill source {}: {}",
                src.display(),
                e
            )
        })?,
        _ => embedded_skill_md(skill_id)
            .ok_or_else(|| format!("Missing embedded content for default skill: {}", skill_id))?
            .to_string(),
    };

    fs::create_dir_all(&dest)
        .map_err(|e| format!("Failed to create skill directory: {}", e))?;
    fs::write(&dest_md, content)
        .map_err(|e| format!("Failed to write SKILL.md: {}", e))?;

    Ok(())
}

/// Link every default skill to a given tool, unless the user has previously
/// removed it. Returns the list of skill IDs that were (re-)linked; an empty
/// Vec means either the tool is not enabled, or every default is already
/// linked or was user-removed.
pub fn ensure_default_skills_linked_for_tool(
    tool_id: &str,
    tool_enabled: bool,
    tool_skills_path: &Path,
    hub_dir: &Path,
    config: &AppConfig,
) -> Result<Vec<String>, String> {
    if !tool_enabled {
        return Ok(Vec::new());
    }

    let removed: HashSet<&str> = config
        .removed_default_skills
        .get(tool_id)
        .map(|v| v.iter().map(String::as_str).collect())
        .unwrap_or_default();

    let mut linked = Vec::new();
    for skill in BUNDLED_SKILLS {
        if removed.contains(skill.id) {
            continue;
        }

        let source = hub_dir.join(skill.id);
        if !source.join("SKILL.md").exists() {
            // Hub hasn't been bootstrapped yet — skip silently; the startup
            // hook will copy it in and a later detection will pick it up.
            continue;
        }

        match LinkerService::enable_skill_for_tool(&source, tool_skills_path, skill.id, tool_id) {
            Ok(_) => linked.push(skill.id.to_string()),
            Err(err) => {
                eprintln!(
                    "[skillx] failed to link default skill {} to tool {}: {}",
                    skill.id, tool_id, err
                );
            }
        }
    }

    Ok(linked)
}

/// Record that the user has removed a default skill for a given tool, so the
/// auto-link logic will skip it on future detections.
pub fn mark_default_skill_removed(skill_id: &str, tool_id: &str) -> Result<(), String> {
    if !is_default_skill(skill_id) {
        return Ok(());
    }
    let manager = ConfigManager::new();
    let mut config = manager.load()?;
    let entry = config.removed_default_skills.entry(tool_id.to_string()).or_default();
    if !entry.iter().any(|s| s == skill_id) {
        entry.push(skill_id.to_string());
    }
    manager.save(&config)
}

/// Clear the "user-removed" record for a default skill, so future detections
/// will re-link it.
pub fn clear_default_skill_removed(skill_id: &str, tool_id: &str) -> Result<(), String> {
    if !is_default_skill(skill_id) {
        return Ok(());
    }
    let manager = ConfigManager::new();
    let mut config = manager.load()?;
    if let Some(entry) = config.removed_default_skills.get_mut(tool_id) {
        entry.retain(|s| s != skill_id);
        if entry.is_empty() {
            config.removed_default_skills.remove(tool_id);
        }
    }
    manager.save(&config)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_support::with_temp_home;
    use std::path::PathBuf;

    #[test]
    fn skillx_find_is_a_default_skill() {
        assert!(is_default_skill("skillx-find"));
        assert!(!is_default_skill("not-a-default"));
    }

    #[test]
    fn default_skill_ids_lists_skillx_find() {
        let ids = default_skill_ids();
        assert!(ids.contains(&"skillx-find"));
    }

    #[test]
    fn ensure_default_skill_in_hub_is_idempotent() {
        with_temp_home(|home| {
            let hub: PathBuf = home.join(".skillx").join("skills");
            fs::create_dir_all(&hub).unwrap();

            ensure_default_skill_in_hub("skillx-find", &hub).unwrap();
            let first = fs::read_to_string(hub.join("skillx-find").join("SKILL.md")).unwrap();

            // Second call should not overwrite.
            ensure_default_skill_in_hub("skillx-find", &hub).unwrap();
            let second = fs::read_to_string(hub.join("skillx-find").join("SKILL.md")).unwrap();
            assert_eq!(first, second);
        });
    }

    #[test]
    fn ensure_default_skill_rejects_unknown_id() {
        with_temp_home(|home| {
            let hub: PathBuf = home.join(".skillx").join("skills");
            fs::create_dir_all(&hub).unwrap();
            let result = ensure_default_skill_in_hub("not-a-default", &hub);
            assert!(result.is_err());
        });
    }
}
