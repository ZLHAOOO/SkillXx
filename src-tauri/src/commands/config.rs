use crate::models::{AppConfig, MarketplaceSource, SourceType};
use crate::services::ConfigManager;

fn ensure_default_marketplace_sources(config: &mut AppConfig) {
    let defaults: Vec<MarketplaceSource> = AppConfig::default()
        .marketplace_sources
        .unwrap_or_default();
    let existing: Vec<MarketplaceSource> = config
        .marketplace_sources
        .clone()
        .unwrap_or_default();

    let mut changed = false;
    let existing_ids: std::collections::HashSet<String> =
        existing.iter().map(|s| s.id.clone()).collect();

    // Build a map of existing sources by id for in-place updates
    let mut existing_map: std::collections::HashMap<String, MarketplaceSource> =
        existing.into_iter().map(|s| (s.id.clone(), s)).collect();

    for default_source in &defaults {
        if let Some(existing_source) = existing_map.get_mut(&default_source.id) {
            // Migrate fields that may have changed in newer versions
            if existing_source.source_type != default_source.source_type {
                existing_source.source_type = default_source.source_type.clone();
                changed = true;
            }
            if existing_source.name != default_source.name {
                existing_source.name = default_source.name.clone();
                changed = true;
            }
            if existing_source.url != default_source.url {
                existing_source.url = default_source.url.clone();
                changed = true;
            }
            if existing_source.builtin != default_source.builtin {
                existing_source.builtin = default_source.builtin;
                changed = true;
            }
        } else {
            existing_map.insert(default_source.id.clone(), default_source.clone());
            changed = true;
        }
    }

    if changed {
        let merged: Vec<MarketplaceSource> = existing_map.into_values().collect();
        config.marketplace_sources = Some(merged);
        let _ = ConfigManager::new().save(config);
    }
}

#[tauri::command]
pub fn get_config() -> Result<AppConfig, String> {
    let manager = ConfigManager::new();
    let mut config = manager.load()?;
    ensure_default_marketplace_sources(&mut config);
    Ok(config)
}

#[tauri::command]
pub fn save_config(config: AppConfig) -> Result<(), String> {
    let manager = ConfigManager::new();
    manager.save(&config)
}

#[tauri::command]
pub fn is_initialized() -> bool {
    let manager = ConfigManager::new();
    manager.is_initialized()
}

#[tauri::command]
pub fn mark_initialized() -> Result<(), String> {
    let manager = ConfigManager::new();
    let mut config = manager.load()?;
    config.initialized = true;
    manager.save(&config)
}

/// Save only the tools order to config
#[tauri::command]
pub fn save_tools_order(tools_order: Vec<String>) -> Result<(), String> {
    let manager = ConfigManager::new();
    let mut config = manager.load()?;
    config.tools_order = tools_order;
    manager.save(&config)
}
