use crate::models::{AppConfig, MarketplaceSource};
use crate::services::ConfigManager;

/// Bring the stored marketplace sources up to date with the built-in defaults:
/// re-apply fields that changed in newer versions, and add defaults the user
/// does not have yet.
///
/// The list is migrated in place so the stored order is preserved. An earlier
/// version routed it through a `HashMap` keyed by id, which meant every
/// migration rewrote `config.json` with a randomly permuted list — Rust hashes
/// with a fresh random seed per process, so the order was not even stable
/// across restarts.
fn ensure_default_marketplace_sources(config: &mut AppConfig) {
    let defaults: Vec<MarketplaceSource> = AppConfig::default()
        .marketplace_sources
        .unwrap_or_default();
    let mut sources: Vec<MarketplaceSource> = config
        .marketplace_sources
        .clone()
        .unwrap_or_default();

    let mut changed = false;

    for default_source in &defaults {
        match sources.iter_mut().find(|s| s.id == default_source.id) {
            // Migrate fields that may have changed in newer versions.
            Some(existing) => {
                if existing.source_type != default_source.source_type {
                    existing.source_type = default_source.source_type.clone();
                    changed = true;
                }
                if existing.name != default_source.name {
                    existing.name = default_source.name.clone();
                    changed = true;
                }
                if existing.url != default_source.url {
                    existing.url = default_source.url.clone();
                    changed = true;
                }
                if existing.builtin != default_source.builtin {
                    existing.builtin = default_source.builtin;
                    changed = true;
                }
            }
            // Missing defaults are appended, so user-added sources keep their
            // position rather than being pushed around.
            None => {
                sources.push(default_source.clone());
                changed = true;
            }
        }
    }

    if changed {
        config.marketplace_sources = Some(sources);
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::SourceType;
    use crate::test_support::with_temp_home;

    fn custom_source(id: &str) -> MarketplaceSource {
        MarketplaceSource {
            id: id.to_string(),
            name: id.to_string(),
            url: format!("https://example.com/{}", id),
            source_type: SourceType::GithubRepo,
            enabled: true,
            builtin: false,
            api_key: None,
        }
    }

    fn ids(config: &AppConfig) -> Vec<String> {
        config
            .marketplace_sources
            .as_ref()
            .map(|list| list.iter().map(|s| s.id.clone()).collect())
            .unwrap_or_default()
    }

    /// The migration must not reorder what the user already has. This is the
    /// regression guard for the old HashMap-based implementation, which
    /// permuted the list on every run.
    #[test]
    fn migration_preserves_existing_order_and_appends_defaults() {
        with_temp_home(|_| {
            let default_ids = ids(&AppConfig::default());
            assert!(
                default_ids.len() >= 2,
                "test needs at least two built-in sources to detect reordering"
            );

            // Start from the defaults in reverse, plus two user sources in
            // between, so any reshuffle is visible.
            let mut existing: Vec<MarketplaceSource> = AppConfig::default()
                .marketplace_sources
                .unwrap_or_default();
            existing.reverse();
            existing.insert(1, custom_source("user-a"));
            existing.push(custom_source("user-b"));

            let expected = existing.iter().map(|s| s.id.clone()).collect::<Vec<_>>();

            let mut config = AppConfig::default();
            config.marketplace_sources = Some(existing);

            ensure_default_marketplace_sources(&mut config);

            assert_eq!(ids(&config), expected);
        });
    }

    #[test]
    fn migration_adds_missing_defaults_after_user_sources() {
        with_temp_home(|_| {
            let mut config = AppConfig::default();
            config.marketplace_sources = Some(vec![custom_source("user-a")]);

            ensure_default_marketplace_sources(&mut config);

            let result = ids(&config);
            assert_eq!(result.first().map(String::as_str), Some("user-a"));

            let mut expected = vec!["user-a".to_string()];
            expected.extend(ids(&AppConfig::default()));
            assert_eq!(result, expected);
        });
    }

    #[test]
    fn migration_reapplies_changed_default_fields() {
        with_temp_home(|_| {
            let mut existing: Vec<MarketplaceSource> = AppConfig::default()
                .marketplace_sources
                .unwrap_or_default();
            let target_id = existing[0].id.clone();
            let expected_url = existing[0].url.clone();
            existing[0].url = "https://stale.example.com".to_string();
            existing[0].name = "Stale name".to_string();

            let mut config = AppConfig::default();
            config.marketplace_sources = Some(existing);

            ensure_default_marketplace_sources(&mut config);

            let migrated = config
                .marketplace_sources
                .as_ref()
                .unwrap()
                .iter()
                .find(|s| s.id == target_id)
                .expect("default source should still be present");
            assert_eq!(migrated.url, expected_url);
        });
    }
}
