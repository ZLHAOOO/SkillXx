#[allow(dead_code)]
pub mod apply_model_to_tool;
pub mod auth;
pub mod claude_config;
pub mod codex_config;
pub mod codex_proxy;
pub mod config;
pub mod editors;
pub mod feedback;
pub mod files;
pub mod gemini_config;
pub mod hermes_config;
pub mod llm;
pub mod llm_providers;
pub mod marketplace;
pub mod platform_marketplace;
pub mod skill_packages;
pub mod skills;
pub mod sync;
pub mod tools;
pub mod updater;

pub use config::{get_config, is_initialized, mark_initialized, save_config, save_tools_order};
pub use editors::{
    detect_available_editors, get_available_editors, open_in_editor, refresh_editors,
};
pub use feedback::submit_feedback;
pub use files::{read_directory_tree, read_file, write_file};
pub use llm::{
    clear_llm_provider, clear_translation_cache, get_cached_marketplace_translations,
    get_cached_skill_translations, get_cached_text_translation, get_llm_provider,
    ai_classify_skills, get_translation_provider, save_llm_provider, test_llm_provider,
    translate_skill, translate_skill_files, translate_skill_name_desc,
    translate_skill_name_desc_custom, translate_skills_batch, translate_text_content,
};
pub use llm_providers::{
    delete_llm_provider, fetch_models_for_config, get_active_provider, get_llm_providers, get_tool_bindings,
    multi_switch_llm_provider, save_llm_provider_multi, save_tool_bindings,
};
pub use apply_model_to_tool::{apply_model_to_tool, ApplyModelInfo};
pub use claude_config::{apply_claude_provider, clear_claude_provider, read_claude_env, restart_claude_code_cmd, write_claude_env, list_claude_backups, restore_claude_backup};
pub use codex_config::{apply_codex_provider, apply_codex_provider_passthrough, clear_codex_provider, read_codex_env, restart_codex_cmd, list_codex_backups, restore_codex_backup, restore_codex_original};
pub use codex_proxy::{start_codex_proxy, update_codex_proxy_config, stop_codex_proxy};
pub use hermes_config::{apply_hermes_provider, clear_hermes_provider, list_hermes_backups, read_hermes_env, restart_hermes_cmd};
pub use gemini_config::{apply_gemini_provider, clear_gemini_provider, list_gemini_backups, read_gemini_env};
pub use marketplace::{
    check_marketplace_updates_if_stale, fetch_marketplace_skill_descriptions,
    fetch_marketplace_skills, fetch_skill_file_content, fetch_skill_files, get_marketplace_sources,
    install_marketplace_skill, install_marketplace_skill_by_ref, sync_marketplace_installed_skills,
    toggle_marketplace_source,
};
pub use platform_marketplace::{
    check_cli_installed, install_cli_tool, install_from_platform, search_marketplace,
};
pub use skill_packages::{
    install_skill_package_from_path, list_skill_packages, remove_skill_package,
};
pub use skills::{
    batch_set_skill_tools, create_skill, delete_skill, disable_skill, enable_skill,
    import_skills_to_hub, list_skills, refresh_skills, scan_existing_skills,
};
pub use sync::{check_sync_status, fix_sync_issues};
pub use tools::{
    create_custom_tool, delete_custom_tool, detect_tools, get_tool_status, refresh_tools,
    set_tool_enabled, update_custom_tool, update_tool_paths,
};
pub use updater::{check_update, download_and_install};
