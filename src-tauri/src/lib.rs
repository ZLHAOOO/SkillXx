mod commands;
mod models;
mod services;
#[cfg(test)]
mod test_support;

use commands::{
    batch_set_skill_tools, check_cli_installed, check_marketplace_updates_if_stale, check_sync_status,
    check_update, apply_claude_provider, apply_codex_provider, clear_claude_provider, clear_codex_provider, clear_llm_provider, clear_translation_cache,
    create_custom_tool, create_skill, delete_custom_tool, delete_llm_provider, delete_skill,
    detect_available_editors, detect_tools, disable_skill, download_and_install, enable_skill,
    fetch_marketplace_skill_descriptions, fetch_marketplace_skills, fetch_skill_file_content,
    fetch_skill_files, fix_sync_issues, get_active_provider, get_available_editors,
    get_cached_marketplace_translations, get_cached_skill_translations, get_cached_text_translation,
    get_config, get_llm_provider, get_llm_providers, fetch_models_for_config, get_translation_provider, get_marketplace_sources, get_tool_bindings,
    get_tool_status, import_skills_to_hub, install_cli_tool, install_from_platform,
    install_marketplace_skill, install_marketplace_skill_by_ref, install_skill_package_from_path,
    is_initialized, list_skill_packages, list_skills, mark_initialized, multi_switch_llm_provider,
    open_in_editor, read_claude_env, read_codex_env, read_directory_tree, read_file, refresh_editors,
    refresh_skills, refresh_tools, remove_skill_package, restart_claude_code_cmd, restart_codex_cmd, save_config,
    save_llm_provider, save_llm_provider_multi, save_tool_bindings, save_tools_order,
    scan_existing_skills, search_marketplace, set_tool_enabled, submit_feedback,
    sync_marketplace_installed_skills, test_llm_provider, toggle_marketplace_source,
    translate_skill, translate_skill_files, translate_skill_name_desc,
    translate_skill_name_desc_custom, translate_skills_batch, translate_text_content,
    update_custom_tool, update_tool_paths, write_claude_env, write_file,
};
use services::{AppCache, MarketplaceCache};
use tauri::{Emitter, Manager};
use tauri_plugin_deep_link::DeepLinkExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, mut argv, _cwd| {
            if matches!(argv.first(), Some(arg) if arg.contains("://")) {
                argv.insert(0, String::new());
            }
            let _ = app.emit("auth:deep-link-argv", argv.clone());
            app.deep_link().handle_cli_arguments(argv.into_iter());
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_deep_link::init())
        .setup(|app| {
            #[cfg(desktop)]
            {
                match app.deep_link().register_all() {
                    Ok(_) => {}
                    Err(err) => {
                        eprintln!("Failed to register deep link schemes: {}", err);
                    }
                }
                for scheme in ["skillx"] {
                    match app.deep_link().is_registered(scheme) {
                        Ok(is_registered) => {
                            if !is_registered {
                                eprintln!("Deep link scheme '{}' is not registered", scheme);
                            }
                        }
                        Err(err) => {
                            eprintln!("Failed to check deep link registration for '{}': {}", scheme, err);
                        }
                    }
                }
            }
            Ok(())
        })
        .manage(AppCache::default())
        .manage(MarketplaceCache::default())
        .invoke_handler(tauri::generate_handler![
            get_config,
            save_config,
            is_initialized,
            mark_initialized,
            list_skills,
            refresh_skills,
            list_skill_packages,
            enable_skill,
            disable_skill,
            batch_set_skill_tools,
            delete_skill,
            create_skill,
            install_skill_package_from_path,
            remove_skill_package,
            detect_tools,
            refresh_tools,
            get_tool_status,
            set_tool_enabled,
            update_tool_paths,
            create_custom_tool,
            update_custom_tool,
            delete_custom_tool,
            check_sync_status,
            fix_sync_issues,
            scan_existing_skills,
            import_skills_to_hub,
            detect_available_editors,
            refresh_editors,
            get_available_editors,
            open_in_editor,
            read_directory_tree,
            read_file,
            write_file,
            fetch_marketplace_skills,
            fetch_marketplace_skill_descriptions,
            fetch_skill_files,
            fetch_skill_file_content,
            install_marketplace_skill,
            install_marketplace_skill_by_ref,
            sync_marketplace_installed_skills,
            check_marketplace_updates_if_stale,
            get_marketplace_sources,
            toggle_marketplace_source,
            check_update,
            submit_feedback,
            get_llm_provider,
            save_llm_provider,
            clear_llm_provider,
            test_llm_provider,
            translate_skill,
            translate_skill_files,
            translate_skill_name_desc,
            translate_skills_batch,
            translate_text_content,
            clear_translation_cache,
            get_cached_skill_translations,
            get_cached_marketplace_translations,
            get_cached_text_translation,
            get_translation_provider,
            download_and_install,
            search_marketplace,
            install_from_platform,
            check_cli_installed,
            install_cli_tool,
            save_tools_order,
            translate_skill_name_desc_custom,
            get_llm_providers,
            fetch_models_for_config,
            save_llm_provider_multi,
            delete_llm_provider,
            multi_switch_llm_provider,
            get_active_provider,
            get_tool_bindings,
            save_tool_bindings,
            read_claude_env,
            apply_claude_provider,
            write_claude_env,
            clear_claude_provider,
            restart_claude_code_cmd,
            read_codex_env,
            apply_codex_provider,
            clear_codex_provider,
            restart_codex_cmd,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
