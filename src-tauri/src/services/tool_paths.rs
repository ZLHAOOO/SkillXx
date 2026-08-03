use std::path::{Path, PathBuf};

use crate::models::ToolDefinition;
use crate::services::linker::normalize_path;

/// Resolve the default `(config_path, skills_path)` for a builtin tool under `home`.
///
/// The default config directory wins; alternatives are only consulted when it doesn't
/// exist. The skills directory is the tool's skills subdirectory, which is `skills` for
/// everything except the few tools that use a different layout.
pub fn resolve_builtin_tool_paths(definition: &ToolDefinition, home: &Path) -> (PathBuf, PathBuf) {
    // Normalize after join to fix mixed separators (e.g. ".config/opencode" on Windows)
    let mut config_dir = normalize_path(&home.join(definition.config_dir));

    if !config_dir.exists() {
        for alt in definition.alt_config_dirs {
            let alt_dir = normalize_path(&home.join(alt));
            if alt_dir.exists() {
                config_dir = alt_dir;
                break;
            }
        }
    }

    let skills_dir = config_dir.join(definition.skills_subdir());
    (config_dir, skills_dir)
}

#[cfg(test)]
mod tests {
    use super::resolve_builtin_tool_paths;
    use crate::models::{ToolDefinition, SUPPORTED_TOOLS};
    use std::fs;
    use tempfile::tempdir;

    fn definition(id: &str) -> &'static ToolDefinition {
        SUPPORTED_TOOLS
            .iter()
            .find(|def| def.id == id)
            .unwrap_or_else(|| panic!("{} should exist in supported tools", id))
    }

    #[test]
    fn qwenpaw_installs_resolve_to_their_own_skill_pool() {
        let home = tempdir().unwrap();
        fs::create_dir_all(home.path().join(".qwenpaw")).unwrap();
        fs::create_dir_all(home.path().join(".copaw")).unwrap();

        let (qwenpaw_config, qwenpaw_skills) =
            resolve_builtin_tool_paths(definition("qwenpaw"), home.path());
        let (copaw_config, copaw_skills) =
            resolve_builtin_tool_paths(definition("copaw"), home.path());

        assert_eq!(qwenpaw_config, home.path().join(".qwenpaw"));
        assert_eq!(qwenpaw_skills, home.path().join(".qwenpaw").join("skill_pool"));
        assert_eq!(copaw_config, home.path().join(".copaw"));
        assert_eq!(copaw_skills, home.path().join(".copaw").join("skill_pool"));
    }

    #[test]
    fn default_tools_keep_the_plain_skills_layout() {
        let home = tempdir().unwrap();
        fs::create_dir_all(home.path().join(".claude")).unwrap();

        let (config_path, skills_path) =
            resolve_builtin_tool_paths(definition("claude-code"), home.path());

        assert_eq!(config_path, home.path().join(".claude"));
        assert_eq!(skills_path, home.path().join(".claude").join("skills"));
    }

    #[test]
    fn alternative_config_dirs_are_used_only_when_the_default_is_missing() {
        let home = tempdir().unwrap();
        // `droid` defaults to `.factory` and falls back to the legacy `.droid`.
        fs::create_dir_all(home.path().join(".droid")).unwrap();

        let (config_path, skills_path) = resolve_builtin_tool_paths(definition("droid"), home.path());
        assert_eq!(config_path, home.path().join(".droid"));
        assert_eq!(skills_path, home.path().join(".droid").join("skills"));

        fs::create_dir_all(home.path().join(".factory")).unwrap();
        let (config_path, _) = resolve_builtin_tool_paths(definition("droid"), home.path());
        assert_eq!(config_path, home.path().join(".factory"));
    }
}
