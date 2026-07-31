use super::ScannerService;
use crate::models::{AppConfig, SkillSource};
use crate::test_support::with_temp_home;
use serde_json::json;
use std::fs;

#[test]
fn load_skill_with_config_falls_back_to_skill_md_description_when_meta_is_null() {
    with_temp_home(|home| {
        let config = AppConfig::default();
        let skill_dir = home
            .join(".skillx")
            .join("skills")
            .join("marketplace-test-skill");
        fs::create_dir_all(&skill_dir).expect("create skill dir");

        let meta_content = r#"{
  "name": "marketplace-test-skill",
  "description": null,
  "version": "1.0"
}"#;
        fs::write(skill_dir.join("meta.json"), meta_content).expect("write meta.json");

        let skill_md = r#"---
name: marketplace-test-skill
description: "Description from SKILL.md"
---

# marketplace-test-skill
"#;
        fs::write(skill_dir.join("SKILL.md"), skill_md).expect("write SKILL.md");

        let skill =
            ScannerService::load_skill_with_config(&skill_dir, &config).expect("load skill");
        assert_eq!(
            skill.description,
            Some("Description from SKILL.md".to_string())
        );
    });
}

#[test]
fn load_skill_with_config_keeps_meta_description_when_present() {
    with_temp_home(|home| {
        let config = AppConfig::default();
        let skill_dir = home
            .join(".skillx")
            .join("skills")
            .join("marketplace-test-skill");
        fs::create_dir_all(&skill_dir).expect("create skill dir");

        let meta_content = r#"{
  "name": "marketplace-test-skill",
  "description": "Description from meta",
  "version": "1.0"
}"#;
        fs::write(skill_dir.join("meta.json"), meta_content).expect("write meta.json");

        let skill_md = r#"---
name: marketplace-test-skill
description: "Description from SKILL.md"
---

# marketplace-test-skill
"#;
        fs::write(skill_dir.join("SKILL.md"), skill_md).expect("write SKILL.md");

        let skill =
            ScannerService::load_skill_with_config(&skill_dir, &config).expect("load skill");
        assert_eq!(skill.description, Some("Description from meta".to_string()));
    });
}

#[test]
fn load_skill_reads_marketplace_meta_fields() {
    with_temp_home(|home| {
        let config = AppConfig::default();
        let skill_dir = home
            .join(".skillx")
            .join("skills")
            .join("mkt-skill");
        fs::create_dir_all(&skill_dir).expect("create skill dir");

        let meta_content = r#"{
  "name": "mkt-skill",
  "version": "1.0",
  "source": "marketplace",
  "marketplace_skill_id": "mkt-123",
  "marketplace_skill_slug": "mkt-skill",
  "marketplace_source_id": "source-1",
  "repo_url": "https://github.com/acme/repo",
  "skill_path": ".claude/skills/mkt-skill"
}"#;
        fs::write(skill_dir.join("meta.json"), meta_content).expect("write meta.json");

        let skill =
            ScannerService::load_skill_with_config(&skill_dir, &config).expect("load skill");
        assert_eq!(skill.source, SkillSource::Marketplace);
        let marketplace = skill.marketplace_meta.expect("marketplace meta");
        assert_eq!(
            marketplace.marketplace_skill_id,
            Some("mkt-123".to_string())
        );
        assert_eq!(
            marketplace.marketplace_skill_slug,
            Some("mkt-skill".to_string())
        );
        assert_eq!(
            marketplace.marketplace_source_id,
            Some("source-1".to_string())
        );
        assert_eq!(
            marketplace.repo_url,
            Some("https://github.com/acme/repo".to_string())
        );
        assert_eq!(
            marketplace.skill_path,
            Some(".claude/skills/mkt-skill".to_string())
        );
    });
}

#[test]
fn load_skill_with_config_exposes_package_meta_from_meta_json() {
    with_temp_home(|home| {
        let config = AppConfig::default();
        let skill_dir = home
            .join(".skillx")
            .join("skills")
            .join("superpowers--brainstorming");
        fs::create_dir_all(&skill_dir).expect("create skill dir");

        let meta_content = r#"{
  "name": "brainstorming",
  "description": "Use before creative work",
  "version": "1.0.0",
  "package_id": "superpowers",
  "package_name": "Superpowers",
  "package_member_id": "brainstorming",
  "package_version": "1.0.0"
}"#;
        fs::write(skill_dir.join("meta.json"), meta_content).expect("write meta.json");

        let skill =
            ScannerService::load_skill_with_config(&skill_dir, &config).expect("load skill");
        let serialized = serde_json::to_value(skill).expect("serialize skill");

        assert_eq!(
            serialized.get("package_meta"),
            Some(&json!({
                "package_id": "superpowers",
                "package_name": "Superpowers",
                "package_member_id": "brainstorming",
                "package_version": "1.0.0"
            }))
        );
    });
}

#[test]
fn load_skill_with_config_keeps_package_meta_absent_for_plain_skill() {
    with_temp_home(|home| {
        let config = AppConfig::default();
        let skill_dir = home
            .join(".skillx")
            .join("skills")
            .join("plain-skill");
        fs::create_dir_all(&skill_dir).expect("create skill dir");

        fs::write(
            skill_dir.join("meta.json"),
            r#"{
  "name": "plain-skill",
  "description": "A plain skill",
  "version": "1.0.0"
}"#,
        )
        .expect("write meta.json");

        let skill =
            ScannerService::load_skill_with_config(&skill_dir, &config).expect("load skill");
        let serialized = serde_json::to_value(skill).expect("serialize skill");

        assert_eq!(serialized.get("package_meta"), None);
    });
}

#[test]
fn scan_skills_with_config_ignores_container_dirs_without_skill_files() {
    with_temp_home(|home| {
        let config = AppConfig::default();
        let skills_dir = home.join(".skillx").join("skills");
        fs::create_dir_all(&skills_dir).expect("create skills root");

        let valid_skill_dir = skills_dir.join("valid-skill");
        fs::create_dir_all(&valid_skill_dir).expect("create valid skill dir");
        fs::write(
            valid_skill_dir.join("SKILL.md"),
            "---\nname: valid-skill\n---\n",
        )
        .expect("write valid SKILL.md");

        for container_dir in [".skill-studio", "learned", "superpowers"] {
            fs::create_dir_all(skills_dir.join(container_dir)).expect("create container dir");
        }

        let mut skills =
            ScannerService::scan_skills_with_config(&skills_dir, &config).expect("scan skills");
        skills.sort_by(|a, b| a.id.cmp(&b.id));

        let ids: Vec<&str> = skills.iter().map(|skill| skill.id.as_str()).collect();
        assert_eq!(ids, vec!["valid-skill"]);
    });
}

#[test]
fn scan_skills_with_config_includes_legacy_group_member_skills() {
    with_temp_home(|home| {
        let config = AppConfig::default();
        let skills_dir = home.join(".skillx").join("skills");
        fs::create_dir_all(&skills_dir).expect("create skills root");

        let translate_dir = skills_dir.join("baoyu-skills").join("baoyu-translate");
        fs::create_dir_all(&translate_dir).expect("create translate dir");
        fs::write(
            translate_dir.join("SKILL.md"),
            "---\nname: baoyu-translate\n---\n",
        )
        .expect("write translate skill");

        let slide_dir = skills_dir.join("baoyu-skills").join("baoyu-slide-deck");
        fs::create_dir_all(&slide_dir).expect("create slide dir");
        fs::write(
            slide_dir.join("SKILL.md"),
            "---\nname: baoyu-slide-deck\n---\n",
        )
        .expect("write slide skill");

        let mut skills =
            ScannerService::scan_skills_with_config(&skills_dir, &config).expect("scan skills");
        skills.sort_by(|a, b| a.id.cmp(&b.id));

        let ids: Vec<&str> = skills.iter().map(|skill| skill.id.as_str()).collect();
        assert_eq!(ids, vec!["baoyu-slide-deck", "baoyu-translate"]);
    });
}

#[test]
fn scan_skills_with_config_returns_global_and_active_project_skill_instances() {
    with_temp_home(|home| {
        let global_skills_dir = home.join(".skillx").join("skills");
        fs::create_dir_all(&global_skills_dir).expect("create global skills root");

        let project_root = home.join("code").join("project-alpha");
        let project_skills_dir = project_root.join(".claude").join("skills");
        fs::create_dir_all(&project_skills_dir).expect("create project skills root");

        for skill_dir in [
            global_skills_dir.join("shared-skill"),
            global_skills_dir.join("global-only-skill"),
            project_skills_dir.join("shared-skill"),
            project_skills_dir.join("project-only-skill"),
        ] {
            fs::create_dir_all(&skill_dir).expect("create skill dir");
            let skill_name = skill_dir
                .file_name()
                .and_then(|name| name.to_str())
                .expect("skill dir name");
            fs::write(
                skill_dir.join("SKILL.md"),
                format!("---\nname: {}\n---\n", skill_name),
            )
            .expect("write SKILL.md");
        }

        let mut config = AppConfig::default();
        config.skills_dir = global_skills_dir.clone();
        let config_value = json!({
            "version": config.version,
            "skills_dir": config.skills_dir,
            "tools": config.tools,
            "custom_tools": config.custom_tools,
            "skill_metadata": config.skill_metadata,
            "preferences": config.preferences,
            "marketplace_sources": config.marketplace_sources,
            "initialized": config.initialized,
            "projects": [
                {
                    "id": "project-alpha",
                    "name": "Project Alpha",
                    "root_path": project_root,
                    "skills_dir": project_skills_dir
                }
            ],
            "active_project_id": "project-alpha"
        });
        let config: AppConfig =
            serde_json::from_value(config_value).expect("deserialize config with projects");

        let mut skills =
            ScannerService::scan_scoped_skills(&config).expect("scan scoped skills");
        skills.sort_by(|a, b| a.instance_id.cmp(&b.instance_id));

        assert_eq!(skills.len(), 4);
        assert_eq!(
            skills
                .iter()
                .map(|skill| skill.instance_id.as_str())
                .collect::<Vec<_>>(),
            vec![
                "global:global-only-skill",
                "global:shared-skill",
                "project:project-alpha:project-only-skill",
                "project:project-alpha:shared-skill",
            ]
        );

        let global_shared = skills
            .iter()
            .find(|skill| skill.instance_id == "global:shared-skill")
            .expect("global shared skill");
        assert_eq!(global_shared.id, "shared-skill");
        assert_eq!(
            serde_json::to_value(global_shared)
                .expect("serialize global")
                .get("scope"),
            Some(&json!("global"))
        );
        assert_eq!(global_shared.project_id, None);
        assert_eq!(global_shared.project_name, None);

        let project_shared = skills
            .iter()
            .find(|skill| skill.instance_id == "project:project-alpha:shared-skill")
            .expect("project shared skill");
        assert_eq!(project_shared.id, "shared-skill");
        assert_eq!(
            serde_json::to_value(project_shared)
                .expect("serialize project")
                .get("scope"),
            Some(&json!("project"))
        );
        assert_eq!(project_shared.project_id.as_deref(), Some("project-alpha"));
        assert_eq!(
            project_shared.project_name.as_deref(),
            Some("Project Alpha")
        );
    });
}

#[test]
fn scan_scoped_skills_does_not_mark_same_id_instances_both_enabled() {
    with_temp_home(|home| {
        let global_skills_dir = home.join(".skillx").join("skills");
        let global_skill_dir = global_skills_dir.join("shared-skill");
        fs::create_dir_all(&global_skill_dir).expect("create global skill dir");
        fs::write(
            global_skill_dir.join("SKILL.md"),
            "---\nname: shared-skill\n---\n",
        )
        .expect("write global skill");

        let project_root = home.join("code").join("project-alpha");
        let project_skills_dir = project_root.join(".claude").join("skills");
        let project_skill_dir = project_skills_dir.join("shared-skill");
        fs::create_dir_all(&project_skill_dir).expect("create project skill dir");
        fs::write(
            project_skill_dir.join("SKILL.md"),
            "---\nname: shared-skill\n---\n",
        )
        .expect("write project skill");

        let tool_skills_dir = home.join(".claude").join("skills");
        fs::create_dir_all(&tool_skills_dir).expect("create tool skills dir");
        std::os::unix::fs::symlink(&project_skill_dir, tool_skills_dir.join("shared-skill"))
            .expect("link project skill");

        let config: AppConfig = serde_json::from_value(json!({
            "version": "2.0.1",
            "skills_dir": global_skills_dir,
            "tools": {
                "claude": {
                    "enabled": true,
                    "detected": true,
                    "skills_path": tool_skills_dir,
                    "config_path": home.join(".claude")
                }
            },
            "custom_tools": {},
            "projects": [{
                "id": "project-alpha",
                "name": "Project Alpha",
                "root_path": project_root,
                "skills_dir": project_skills_dir
            }],
            "active_project_id": "project-alpha",
            "initialized": true
        }))
        .expect("deserialize config");

        let skills = ScannerService::scan_scoped_skills(&config).expect("scan scoped skills");
        let global = skills
            .iter()
            .find(|skill| skill.instance_id == "global:shared-skill")
            .expect("global instance");
        let project = skills
            .iter()
            .find(|skill| skill.instance_id == "project:project-alpha:shared-skill")
            .expect("project instance");

        assert_eq!(global.enabled.get("claude").copied(), Some(false));
        assert_eq!(project.enabled.get("claude").copied(), Some(true));
    });
}

#[test]
fn scan_global_skills_keeps_legacy_copy_mode_skill_enabled_without_metadata() {
    with_temp_home(|home| {
        let global_skills_dir = home.join(".skillx").join("skills");
        let global_skill_dir = global_skills_dir.join("shared-skill");
        fs::create_dir_all(&global_skill_dir).expect("create global skill dir");
        fs::write(
            global_skill_dir.join("SKILL.md"),
            "---\nname: shared-skill\n---\n",
        )
        .expect("write global skill");

        let iflow_skills_dir = home.join(".iflow").join("skills");
        let copied_skill_dir = iflow_skills_dir.join("shared-skill");
        fs::create_dir_all(&copied_skill_dir).expect("create copied skill dir");
        fs::write(
            copied_skill_dir.join("SKILL.md"),
            "---\nname: shared-skill\n---\n",
        )
        .expect("write copied skill");

        let config: AppConfig = serde_json::from_value(json!({
            "version": "2.0.1",
            "skills_dir": global_skills_dir,
            "tools": {
                "iflow": {
                    "enabled": true,
                    "detected": true,
                    "skills_path": iflow_skills_dir,
                    "config_path": home.join(".iflow")
                }
            },
            "custom_tools": {},
            "initialized": true
        }))
        .expect("deserialize config");

        let skills = ScannerService::scan_global_skills(&config).expect("scan global skills");
        let global = skills
            .iter()
            .find(|skill| skill.instance_id == "global:shared-skill")
            .expect("global skill");

        assert_eq!(global.enabled.get("iflow").copied(), Some(true));
    });
}

#[test]
fn scan_skills_with_config_ignores_nested_duplicate_skill_dirs_in_container_folders() {
    with_temp_home(|home| {
        let config = AppConfig::default();
        let skills_dir = home.join(".skillx").join("skills");
        fs::create_dir_all(&skills_dir).expect("create skills root");

        let top_level_dir = skills_dir.join("academic-research-writer");
        fs::create_dir_all(&top_level_dir).expect("create top level skill dir");
        fs::write(
            top_level_dir.join("SKILL.md"),
            "---\nname: academic-research-writer\n---\n",
        )
        .expect("write top level skill");

        let nested_dir = skills_dir
            .join("openclaw-imports")
            .join("academic-research-writer");
        fs::create_dir_all(&nested_dir).expect("create nested skill dir");
        fs::write(
            nested_dir.join("SKILL.md"),
            "---\nname: academic-research-writer\n---\n",
        )
        .expect("write nested skill");

        let mut skills =
            ScannerService::scan_skills_with_config(&skills_dir, &config).expect("scan skills");
        skills.sort_by(|a, b| a.id.cmp(&b.id).then_with(|| a.path.cmp(&b.path)));

        assert_eq!(skills.len(), 1);
        assert_eq!(skills[0].id, "academic-research-writer");
        assert_eq!(skills[0].path, top_level_dir);
    });
}

#[test]
fn scan_skills_with_config_keeps_first_when_same_id_same_depth_different_containers() {
    with_temp_home(|home| {
        let config = AppConfig::default();
        let skills_dir = home.join(".skillx").join("skills");
        fs::create_dir_all(&skills_dir).expect("create skills root");

        let a = skills_dir.join("containerA").join("dup-skill");
        fs::create_dir_all(&a).expect("create A");
        fs::write(a.join("SKILL.md"), "---\nname: dup-skill\n---\n").expect("write A");

        let b = skills_dir.join("containerB").join("dup-skill");
        fs::create_dir_all(&b).expect("create B");
        fs::write(b.join("SKILL.md"), "---\nname: dup-skill\n---\n").expect("write B");

        let skills = ScannerService::scan_skills_with_config(&skills_dir, &config)
            .expect("scan should not fail on duplicates");
        let dup_skills: Vec<_> = skills.iter().filter(|s| s.id == "dup-skill").collect();
        assert_eq!(
            dup_skills.len(),
            1,
            "expected single deduped entry, got {dup_skills:?}"
        );
    });
}
