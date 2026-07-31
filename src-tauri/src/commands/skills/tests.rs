use std::collections::HashMap;
use std::path::PathBuf;

use crate::models::{InstalledSkillPackage, SkillScope, SkillSource, ToolConfig};
use crate::test_support::with_temp_home;
use std::fs;

use super::*;

fn create_skill(id: &str, enabled: &[(&str, bool)]) -> Skill {
    Skill {
        id: id.to_string(),
        instance_id: Skill::global_instance_id(id),
        scope: SkillScope::Global,
        project_id: None,
        project_name: None,
        name: id.to_string(),
        description: None,
        version: "1.0.0".to_string(),
        source: SkillSource::Local,
        marketplace_meta: None,
        vault_meta: None,
        package_meta: None,
        enabled: enabled
            .iter()
            .map(|(tool_id, value)| (tool_id.to_string(), *value))
            .collect(),
        path: PathBuf::from(format!("/tmp/{id}")),
        is_default: false,
    }
}

fn create_nested_skill(id: &str, path: &str, enabled: &[(&str, bool)]) -> Skill {
    Skill {
        id: id.to_string(),
        instance_id: Skill::global_instance_id(id),
        scope: SkillScope::Global,
        project_id: None,
        project_name: None,
        name: id.to_string(),
        description: None,
        version: "1.0.0".to_string(),
        source: SkillSource::Local,
        marketplace_meta: None,
        vault_meta: None,
        package_meta: None,
        enabled: enabled
            .iter()
            .map(|(tool_id, value)| (tool_id.to_string(), *value))
            .collect(),
        path: PathBuf::from(path),
        is_default: false,
    }
}

#[test]
fn resolve_skill_source_path_uses_skill_path_for_nested_group_member() {
    let config = create_config(&[("claude", true)]);
    let skill = create_nested_skill(
        "baoyu-translate",
        "/tmp/skills/baoyu-skills/baoyu-translate",
        &[("claude", false)],
    );

    assert_eq!(
        resolve_skill_source_path(&config, &skill),
        PathBuf::from("/tmp/skills/baoyu-skills/baoyu-translate")
    );
}

#[test]
fn resolve_skill_source_path_keeps_top_level_skill_path_stable() {
    let config = create_config(&[("claude", true)]);
    let skill = create_skill("plain-skill", &[("claude", false)]);

    assert_eq!(
        resolve_skill_source_path(&config, &skill),
        PathBuf::from("/tmp/plain-skill")
    );
}

fn create_package(package_id: &str, installed_members: &[&str]) -> InstalledSkillPackage {
    InstalledSkillPackage {
        package_id: package_id.to_string(),
        name: package_id.to_string(),
        version: "1.0.0".to_string(),
        installed_members: installed_members
            .iter()
            .map(|item| item.to_string())
            .collect(),
        selected_members: installed_members
            .iter()
            .map(|item| item.to_string())
            .collect(),
        path: None,
        manifest_hash: None,
        installed_at: 0,
        updated_at: 0,
    }
}

fn create_config(tool_states: &[(&str, bool)]) -> AppConfig {
    let tools = tool_states
        .iter()
        .map(|(tool_id, enabled)| {
            (
                tool_id.to_string(),
                ToolConfig {
                    enabled: *enabled,
                    detected: true,
                    skills_path: PathBuf::from(format!("/tmp/{tool_id}/skills")),
                    config_path: PathBuf::from(format!("/tmp/{tool_id}/config")),
                },
            )
        })
        .collect();

    AppConfig {
        version: "2.0.1".to_string(),
        skills_dir: PathBuf::from("/tmp/skills"),
        tools,
        custom_tools: HashMap::new(),
        skill_metadata: HashMap::new(),
        preferences: None,
        marketplace_sources: None,
        projects: Vec::new(),
        active_project_id: None,
        llm_provider: None,
        auth_session: None,
        initialized: true,
        ..Default::default()
    }
}

#[test]
fn apply_skill_tool_enabled_enables_nested_group_member_from_real_skill_path() {
    with_temp_home(|home| {
        let skills_dir = home.join(".skillx").join("skills");
        let nested_skill_dir = skills_dir.join("baoyu-skills").join("baoyu-translate");
        fs::create_dir_all(&nested_skill_dir).expect("create nested skill dir");
        fs::write(
            nested_skill_dir.join("SKILL.md"),
            "---\nname: baoyu-translate\n---\n",
        )
        .expect("write SKILL.md");

        let tool_skills_dir = home.join(".claude").join("skills");
        let config = AppConfig {
            version: "2.0.1".to_string(),
            skills_dir: skills_dir.clone(),
            tools: HashMap::from([(
                "claude".to_string(),
                ToolConfig {
                    enabled: true,
                    detected: true,
                    skills_path: tool_skills_dir.clone(),
                    config_path: home.join(".claude"),
                },
            )]),
            custom_tools: HashMap::new(),
            skill_metadata: HashMap::new(),
            preferences: None,
            marketplace_sources: None,
            projects: Vec::new(),
            active_project_id: None,
            llm_provider: None,
            auth_session: None,
            initialized: true,
            ..Default::default()
        };

        apply_skill_tool_enabled(&config, "global:baoyu-translate", "claude", true, None)
            .expect("enable nested group member");

        let link_path = tool_skills_dir.join("baoyu-translate");
        assert!(link_path.exists() || link_path.symlink_metadata().is_ok());
        let target = fs::read_link(&link_path).expect("read created symlink");
        assert_eq!(target, nested_skill_dir);
    });
}

#[test]
fn delete_skill_from_disk_removes_nested_group_member_from_real_path() {
    with_temp_home(|home| {
        let skills_dir = home.join(".skillx").join("skills");
        let nested_skill_dir = skills_dir.join("baoyu-skills").join("baoyu-translate");
        fs::create_dir_all(&nested_skill_dir).expect("create nested skill dir");
        fs::write(
            nested_skill_dir.join("SKILL.md"),
            "---\nname: baoyu-translate\n---\n",
        )
        .expect("write SKILL.md");

        let tool_skills_dir = home.join(".claude").join("skills");
        fs::create_dir_all(&tool_skills_dir).expect("create tool skills dir");
        LinkerService::enable_skill_for_tool(
            &nested_skill_dir,
            &tool_skills_dir,
            "baoyu-translate",
            "claude",
        )
        .expect("create tool link");

        let config = AppConfig {
            version: "2.0.1".to_string(),
            skills_dir: skills_dir.clone(),
            tools: HashMap::from([(
                "claude".to_string(),
                ToolConfig {
                    enabled: true,
                    detected: true,
                    skills_path: tool_skills_dir.clone(),
                    config_path: home.join(".claude"),
                },
            )]),
            custom_tools: HashMap::new(),
            skill_metadata: HashMap::new(),
            preferences: None,
            marketplace_sources: None,
            projects: Vec::new(),
            active_project_id: None,
            llm_provider: None,
            auth_session: None,
            initialized: true,
            ..Default::default()
        };

        delete_skill_from_disk(&config, "global:baoyu-translate").expect("delete nested skill");

        assert!(!nested_skill_dir.exists());
        assert!(tool_skills_dir
            .join("baoyu-translate")
            .symlink_metadata()
            .is_err());
    });
}

#[test]
fn resolve_batch_targets_expands_groups_and_reports_missing_members() {
    let skills_by_id = HashMap::from([
        ("skill-a".to_string(), create_skill("skill-a", &[])),
        ("skill-b".to_string(), create_skill("skill-b", &[])),
    ]);
    let packages_by_id = HashMap::from([(
        "group-one".to_string(),
        create_package("group-one", &["skill-a", "missing-skill"]),
    )]);

    let (resolved, failures) = resolve_batch_targets(
        &[BatchSkillToolTarget {
            kind: BatchSkillToolTargetKind::Group,
            id: "group-one".to_string(),
        }],
        &skills_by_id,
        &packages_by_id,
    );

    assert_eq!(resolved.len(), 1);
    assert_eq!(resolved[0].skill_id, "global:skill-a");
    assert_eq!(failures.len(), 1);
    assert_eq!(failures[0].skill_id.as_deref(), Some("missing-skill"));
}

#[test]
fn build_batch_operations_deduplicates_overlapping_skill_and_group_targets() {
    let skills_by_id = HashMap::from([(
        "skill-a".to_string(),
        create_skill("skill-a", &[("claude", false)]),
    )]);
    let config = create_config(&[("claude", true)]);
    let resolved_targets = vec![
        ResolvedBatchSkillTarget {
            target_kind: BatchSkillToolTargetKind::Skill,
            target_id: "skill-a".to_string(),
            skill_id: "skill-a".to_string(),
        },
        ResolvedBatchSkillTarget {
            target_kind: BatchSkillToolTargetKind::Group,
            target_id: "group-one".to_string(),
            skill_id: "skill-a".to_string(),
        },
    ];

    let (plan, failures) = build_batch_operations(
        &resolved_targets,
        &["claude".to_string()],
        &skills_by_id,
        &config,
        &BatchSkillToolAction::Enable,
    );

    assert!(failures.is_empty());
    assert_eq!(plan.operations.len(), 1);
    assert_eq!(plan.skipped_count, 0);
}

#[test]
fn build_batch_operations_skips_already_enabled_and_reports_disabled_tools() {
    let skills_by_id = HashMap::from([(
        "skill-a".to_string(),
        create_skill("skill-a", &[("claude", true)]),
    )]);
    let config = create_config(&[("claude", true), ("codex", false)]);
    let resolved_targets = vec![ResolvedBatchSkillTarget {
        target_kind: BatchSkillToolTargetKind::Skill,
        target_id: "skill-a".to_string(),
        skill_id: "skill-a".to_string(),
    }];

    let (plan, failures) = build_batch_operations(
        &resolved_targets,
        &["claude".to_string(), "codex".to_string()],
        &skills_by_id,
        &config,
        &BatchSkillToolAction::Enable,
    );

    assert_eq!(plan.operations.len(), 0);
    assert_eq!(plan.skipped_count, 1);
    assert_eq!(failures.len(), 1);
    assert_eq!(failures[0].tool_id.as_deref(), Some("codex"));
}

#[test]
fn build_batch_operations_ignores_duplicate_skips_and_failures_for_overlapping_targets() {
    let skills_by_id = HashMap::from([(
        "skill-a".to_string(),
        create_skill("skill-a", &[("claude", true)]),
    )]);
    let config = create_config(&[("claude", true), ("codex", false)]);
    let resolved_targets = vec![
        ResolvedBatchSkillTarget {
            target_kind: BatchSkillToolTargetKind::Skill,
            target_id: "skill-a".to_string(),
            skill_id: "skill-a".to_string(),
        },
        ResolvedBatchSkillTarget {
            target_kind: BatchSkillToolTargetKind::Group,
            target_id: "group-one".to_string(),
            skill_id: "skill-a".to_string(),
        },
    ];

    let (plan, failures) = build_batch_operations(
        &resolved_targets,
        &["claude".to_string(), "codex".to_string()],
        &skills_by_id,
        &config,
        &BatchSkillToolAction::Enable,
    );

    assert!(plan.operations.is_empty());
    assert_eq!(plan.skipped_count, 1);
    assert_eq!(failures.len(), 1);
    assert_eq!(failures[0].tool_id.as_deref(), Some("codex"));
}

#[test]
fn resolve_batch_targets_uses_instance_ids_for_skills() {
    let global_skill = create_skill("shared-skill", &[]);
    let project_skill = create_skill("shared-skill", &[]).with_scope(
        SkillScope::Project,
        Some("project-alpha".to_string()),
        Some("Project Alpha".to_string()),
    ).unwrap();
    let skills_by_instance_id = HashMap::from([
        (global_skill.instance_id.clone(), global_skill.clone()),
        (project_skill.instance_id.clone(), project_skill.clone()),
    ]);
    let packages_by_id = HashMap::new();

    let (resolved, failures) = resolve_batch_targets(
        &[BatchSkillToolTarget {
            kind: BatchSkillToolTargetKind::Skill,
            id: project_skill.instance_id.clone(),
        }],
        &skills_by_instance_id,
        &packages_by_id,
    );

    assert!(failures.is_empty());
    assert_eq!(resolved.len(), 1);
    assert_eq!(resolved[0].skill_id, project_skill.instance_id);
}

#[test]
fn resolve_batch_targets_prefers_global_instance_for_group_members() {
    let global_skill = create_skill("shared-skill", &[]);
    let project_skill = create_skill("shared-skill", &[]).with_scope(
        SkillScope::Project,
        Some("project-alpha".to_string()),
        Some("Project Alpha".to_string()),
    ).unwrap();
    let skills_by_instance_id = HashMap::from([
        (global_skill.instance_id.clone(), global_skill.clone()),
        (project_skill.instance_id.clone(), project_skill.clone()),
    ]);
    let packages_by_id = HashMap::from([(
        "group-one".to_string(),
        create_package("group-one", &["shared-skill"]),
    )]);

    let (resolved, failures) = resolve_batch_targets(
        &[BatchSkillToolTarget {
            kind: BatchSkillToolTargetKind::Group,
            id: "group-one".to_string(),
        }],
        &skills_by_instance_id,
        &packages_by_id,
    );

    assert!(failures.is_empty());
    assert_eq!(resolved.len(), 1);
    assert_eq!(resolved[0].skill_id, global_skill.instance_id);
}

#[test]
fn load_skill_by_id_rejects_ambiguous_legacy_skill_ids() {
    with_temp_home(|home| {
        let global_skills_dir = home.join(".skillx").join("skills");
        let project_root = home.join("code").join("project-alpha");
        let project_skills_dir = project_root.join(".claude").join("skills");
        fs::create_dir_all(global_skills_dir.join("shared-skill"))
            .expect("create global shared skill");
        fs::create_dir_all(project_skills_dir.join("shared-skill"))
            .expect("create project shared skill");
        fs::write(
            global_skills_dir.join("shared-skill").join("SKILL.md"),
            "---\nname: shared-skill\n---\n",
        )
        .expect("write global skill");
        fs::write(
            project_skills_dir.join("shared-skill").join("SKILL.md"),
            "---\nname: shared-skill\n---\n",
        )
        .expect("write project skill");

        let config: AppConfig = serde_json::from_value(serde_json::json!({
            "version": "2.0.1",
            "skills_dir": global_skills_dir,
            "tools": {},
            "custom_tools": {},
            "skill_metadata": {},
            "preferences": null,
            "marketplace_sources": null,
            "projects": [{
                "id": "project-alpha",
                "name": "Project Alpha",
                "root_path": project_root,
                "skills_dir": project_skills_dir,
            }],
            "active_project_id": "project-alpha",
            "initialized": true,
        }))
        .expect("deserialize config");

        let error = load_skill_by_id(&config, "shared-skill")
            .expect_err("legacy skill id should be ambiguous");

        assert!(error.contains("Ambiguous skill id: shared-skill"));
    });
}
