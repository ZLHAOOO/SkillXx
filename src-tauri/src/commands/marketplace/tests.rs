use std::collections::HashMap;
use std::path::PathBuf;
use std::time::{Duration, SystemTime};

use crate::models::{
    InstallStatus, MarketplaceMeta, MarketplaceSkill, MarketplaceSkillsResponse,
    MarketplaceSource, Skill, SkillFileNode, SkillSource, SourceType,
};
use crate::services::marketplace::{DIRECT_GITHUB_SOURCE_ID, DIRECT_GITHUB_SOURCE_NAME};
use crate::test_support::with_temp_home;

use super::{
    build_marketplace_skill_from_reference, collect_installed_marketplace_skills,
    expand_skill_group_reference, load_last_update_check_time, persist_update_check_time,
    prepend_missing_installed_marketplace_skills, resolve_cache_source_scope,
    should_hydrate_missing_installed_marketplace_skill, should_run_marketplace_update_check,
    MarketplaceSkillReference, MARKETPLACE_UPDATE_CHECK_INTERVAL,
};

fn make_source(id: &str, enabled: bool) -> MarketplaceSource {
    MarketplaceSource {
        id: id.to_string(),
        name: id.to_string(),
        url: format!("https://{id}.example.com"),
        source_type: SourceType::Api,
        enabled,
        builtin: true,
        api_key: None,
    }
}

fn make_marketplace_skill(
    id: &str,
    source_id: &str,
    name: &str,
    description: Option<&str>,
) -> Skill {
    Skill {
        id: format!("local-{id}"),
        instance_id: Skill::global_instance_id(&format!("local-{id}")),
        scope: crate::models::SkillScope::Global,
        project_id: None,
        project_name: None,
        name: name.to_string(),
        description: description.map(str::to_string),
        version: "1.0.0".to_string(),
        source: SkillSource::Marketplace,
        marketplace_meta: Some(MarketplaceMeta {
            marketplace_source_id: Some(source_id.to_string()),
            marketplace_skill_id: Some(id.to_string()),
            marketplace_skill_slug: Some(name.to_lowercase()),
            repo_url: Some("https://github.com/example/repo".to_string()),
            skill_path: Some(format!(".claude/skills/{}", name.to_lowercase())),
            remote_revision: Some("rev-local".to_string()),
        }),
        vault_meta: None,
        package_meta: None,
        enabled: HashMap::new(),
        path: PathBuf::from(format!("/tmp/{id}")),
        is_default: false,
    }
}

fn make_listing_skill(id: &str, install_status: InstallStatus) -> MarketplaceSkill {
    MarketplaceSkill {
        id: id.to_string(),
        slug: Some(id.to_string()),
        name: id.to_string(),
        description: None,
        author: None,
        source_id: "src_skills".to_string(),
        source_name: "src_skills".to_string(),
        install_count: None,
        install_url: None,
        created_at: None,
        repo_url: Some("https://github.com/example/repo".to_string()),
        skill_path: Some(format!(".claude/skills/{id}")),
        external_url: None,
        remote_revision: Some("rev-remote".to_string()),
        tags: Vec::new(),
        install_status,
    }
}

#[test]
fn should_run_marketplace_update_check_respects_interval() {
    let now = SystemTime::now();
    let just_checked = now
        .checked_sub(Duration::from_secs(60))
        .expect("time should be valid");
    let stale_checked = now
        .checked_sub(MARKETPLACE_UPDATE_CHECK_INTERVAL + Duration::from_secs(1))
        .expect("time should be valid");

    assert!(
        !should_run_marketplace_update_check(Some(just_checked), now),
        "recent check should be skipped"
    );
    assert!(
        should_run_marketplace_update_check(Some(stale_checked), now),
        "stale check should run"
    );
    assert!(
        should_run_marketplace_update_check(None, now),
        "missing check timestamp should run"
    );
}

#[test]
fn update_check_time_round_trip_persists() {
    with_temp_home(|_| {
        let now = SystemTime::now();
        persist_update_check_time(now);
        let loaded = load_last_update_check_time();
        assert!(loaded.is_some(), "expected persisted timestamp");
    });
}

#[test]
fn resolve_cache_source_scope_defaults_to_enabled_sources() {
    let sources = vec![
        make_source("src_skills", true),
        make_source("src_awesome", false),
    ];

    let scope = resolve_cache_source_scope(&None, &sources);

    assert_eq!(
        scope,
        Some(vec!["src_skills".to_string()]),
        "no explicit filter should cache by enabled sources"
    );
}

#[test]
fn resolve_cache_source_scope_intersects_with_enabled_sources() {
    let sources = vec![
        make_source("src_skills", true),
        make_source("src_awesome", false),
    ];
    let explicit = Some(vec![
        "src_awesome".to_string(),
        "src_skills".to_string(),
        "src_skills".to_string(),
    ]);

    let scope = resolve_cache_source_scope(&explicit, &sources);

    assert_eq!(
        scope,
        Some(vec!["src_skills".to_string()]),
        "explicit filter should drop disabled source ids and deduplicate"
    );
}

#[test]
fn build_marketplace_skill_from_reference_requires_repo_url() {
    let reference = MarketplaceSkillReference {
        name: "S1".to_string(),
        marketplace_source_id: Some("source-1".to_string()),
        marketplace_skill_id: Some("source-1::s1".to_string()),
        marketplace_skill_slug: Some("s1".to_string()),
        repo_url: None,
        skill_path: Some(".claude/skills/s1".to_string()),
        remote_revision: None,
    };

    let err = build_marketplace_skill_from_reference(reference).unwrap_err();
    assert!(err.contains("repo_url"));
}

#[test]
fn build_marketplace_skill_from_reference_distinguishes_github_direct_skills_by_repo() {
    let first = build_marketplace_skill_from_reference(MarketplaceSkillReference {
        name: "Demo".to_string(),
        marketplace_source_id: Some("github_direct".to_string()),
        marketplace_skill_id: None,
        marketplace_skill_slug: None,
        repo_url: Some("https://github.com/acme/skills-one".to_string()),
        skill_path: Some("skills/demo".to_string()),
        remote_revision: None,
    })
    .expect("first skill should build");

    let second = build_marketplace_skill_from_reference(MarketplaceSkillReference {
        name: "Demo".to_string(),
        marketplace_source_id: Some("github_direct".to_string()),
        marketplace_skill_id: None,
        marketplace_skill_slug: None,
        repo_url: Some("https://github.com/acme/skills-two".to_string()),
        skill_path: Some("skills/demo".to_string()),
        remote_revision: None,
    })
    .expect("second skill should build");

    assert_ne!(
        first.id, second.id,
        "direct GitHub installs must stay distinct even when skill_path matches"
    );
}

#[test]
fn expand_skill_group_reference_returns_direct_child_skills_when_root_is_container() {
    let skill = MarketplaceSkill {
        id: "github-direct-baoyu-skills".to_string(),
        slug: Some("skills".to_string()),
        name: "skills".to_string(),
        description: None,
        author: None,
        source_id: DIRECT_GITHUB_SOURCE_ID.to_string(),
        source_name: DIRECT_GITHUB_SOURCE_NAME.to_string(),
        install_count: None,
        install_url: None,
        created_at: None,
        repo_url: Some("https://github.com/JimLiu/baoyu-skills".to_string()),
        skill_path: Some("skills".to_string()),
        external_url: Some(
            "https://github.com/JimLiu/baoyu-skills/tree/main/skills".to_string(),
        ),
        remote_revision: None,
        tags: Vec::new(),
        install_status: InstallStatus::NotInstalled,
    };
    let tree = SkillFileNode {
        name: "skills".to_string(),
        path: "skills".to_string(),
        is_dir: true,
        download_url: None,
        sha: None,
        children: Some(vec![
            SkillFileNode {
                name: "baoyu-translate".to_string(),
                path: "skills/baoyu-translate".to_string(),
                is_dir: true,
                download_url: None,
                sha: None,
                children: Some(vec![SkillFileNode {
                    name: "SKILL.md".to_string(),
                    path: "skills/baoyu-translate/SKILL.md".to_string(),
                    is_dir: false,
                    download_url: Some("https://example.com/translate".to_string()),
                    sha: None,
                    children: None,
                }]),
            },
            SkillFileNode {
                name: "baoyu-slide-deck".to_string(),
                path: "skills/baoyu-slide-deck".to_string(),
                is_dir: true,
                download_url: None,
                sha: None,
                children: Some(vec![SkillFileNode {
                    name: "SKILL.md".to_string(),
                    path: "skills/baoyu-slide-deck/SKILL.md".to_string(),
                    is_dir: false,
                    download_url: Some("https://example.com/slides".to_string()),
                    sha: None,
                    children: None,
                }]),
            },
        ]),
    };

    let expanded = expand_skill_group_reference(&skill, &tree);

    assert_eq!(expanded.len(), 2);
    assert_eq!(
        expanded
            .iter()
            .map(|item| item.skill_path.as_deref().unwrap_or_default())
            .collect::<Vec<_>>(),
        vec!["skills/baoyu-translate", "skills/baoyu-slide-deck"]
    );
    assert_eq!(
        expanded
            .iter()
            .map(|item| item.name.as_str())
            .collect::<Vec<_>>(),
        vec!["baoyu-translate", "baoyu-slide-deck"]
    );
}

#[test]
fn expand_skill_group_reference_returns_empty_for_regular_skill_root() {
    let skill = MarketplaceSkill {
        id: "github-direct-demo".to_string(),
        slug: Some("skills/demo".to_string()),
        name: "demo".to_string(),
        description: None,
        author: None,
        source_id: DIRECT_GITHUB_SOURCE_ID.to_string(),
        source_name: DIRECT_GITHUB_SOURCE_NAME.to_string(),
        install_count: None,
        install_url: None,
        created_at: None,
        repo_url: Some("https://github.com/example/demo".to_string()),
        skill_path: Some("skills/demo".to_string()),
        external_url: Some("https://github.com/example/demo/tree/main/skills/demo".to_string()),
        remote_revision: None,
        tags: Vec::new(),
        install_status: InstallStatus::NotInstalled,
    };
    let tree = SkillFileNode {
        name: "demo".to_string(),
        path: "skills/demo".to_string(),
        is_dir: true,
        download_url: None,
        sha: None,
        children: Some(vec![SkillFileNode {
            name: "SKILL.md".to_string(),
            path: "skills/demo/SKILL.md".to_string(),
            is_dir: false,
            download_url: Some("https://example.com/demo".to_string()),
            sha: None,
            children: None,
        }]),
    };

    assert!(expand_skill_group_reference(&skill, &tree).is_empty());
}

#[test]
fn collect_installed_marketplace_skills_respects_source_filter_and_query() {
    let skills = vec![
        make_marketplace_skill("src_skills::alpha", "src_skills", "Alpha", Some("useful")),
        make_marketplace_skill("src_other::beta", "src_other", "Beta", Some("other")),
        Skill {
            id: "local-only".to_string(),
            instance_id: Skill::global_instance_id("local-only"),
            scope: crate::models::SkillScope::Global,
            project_id: None,
            project_name: None,
            name: "Local".to_string(),
            description: Some("ignore".to_string()),
            version: "1.0.0".to_string(),
            source: SkillSource::Local,
            marketplace_meta: None,
            vault_meta: None,
            package_meta: None,
            enabled: HashMap::new(),
            path: PathBuf::from("/tmp/local-only"),
            is_default: false,
        },
    ];
    let sources = vec![
        make_source("src_skills", true),
        make_source("src_other", true),
    ];
    let source_filter = Some(vec!["src_skills".to_string()]);

    let collected =
        collect_installed_marketplace_skills(&skills, &sources, Some("alp"), &source_filter);

    assert_eq!(collected.len(), 1);
    assert_eq!(collected[0].id, "src_skills::alpha");
    assert_eq!(collected[0].install_status, InstallStatus::Installed);
    assert_eq!(collected[0].source_name, "src_skills");
}

#[test]
fn prepend_missing_installed_marketplace_skills_prepends_only_missing_entries() {
    let response = MarketplaceSkillsResponse {
        skills: vec![
            make_listing_skill("src_skills::alpha", InstallStatus::UpdateAvailable),
            make_listing_skill("src_skills::gamma", InstallStatus::NotInstalled),
        ],
        has_more: true,
    };

    let merged = prepend_missing_installed_marketplace_skills(
        response,
        vec![
            make_listing_skill("src_skills::beta", InstallStatus::Installed),
            make_listing_skill("src_skills::alpha", InstallStatus::Installed),
        ],
    );

    assert_eq!(
        merged
            .skills
            .iter()
            .map(|skill| skill.id.as_str())
            .collect::<Vec<_>>(),
        vec!["src_skills::beta", "src_skills::alpha", "src_skills::gamma"]
    );
    assert_eq!(
        merged.skills[1].install_status,
        InstallStatus::UpdateAvailable
    );
    assert!(merged.has_more);
}

#[test]
fn only_direct_github_installs_are_hydrated_when_missing_from_listing() {
    let builtin = make_listing_skill("src_skills::alpha", InstallStatus::Installed);
    assert!(
        !should_hydrate_missing_installed_marketplace_skill(&builtin),
        "builtin marketplace skills already have remote metadata in listing and should not block page load"
    );

    let direct = MarketplaceSkill {
        source_id: DIRECT_GITHUB_SOURCE_ID.to_string(),
        source_name: DIRECT_GITHUB_SOURCE_NAME.to_string(),
        repo_url: Some("https://github.com/example/repo".to_string()),
        skill_path: Some("skills/demo".to_string()),
        ..make_listing_skill("github-direct-demo", InstallStatus::Installed)
    };
    assert!(
        should_hydrate_missing_installed_marketplace_skill(&direct),
        "direct GitHub installs still need remote hydration for update tracking"
    );
}
