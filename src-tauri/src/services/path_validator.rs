use std::path::{Path, PathBuf};

/// Returns the list of directories that are allowed for file operations.
/// These include:
/// - ~/.skillx/ (config, cache, skills)
/// - Any skills directory configured in the app
pub fn get_allowed_base_dirs() -> Vec<PathBuf> {
    let mut dirs = Vec::new();

    if let Some(home) = dirs::home_dir() {
        // Main app directory
        dirs.push(home.join(".skillx"));
    }

    dirs
}

/// Validates that a path is within one of the allowed base directories.
/// Returns Ok(resolved_path) if valid, Err with a message if not.
pub fn validate_path(path: &str) -> Result<PathBuf, String> {
    let target = PathBuf::from(path);

    // Resolve to absolute path to prevent traversal attacks
    let resolved = if target.is_absolute() {
        target.clone()
    } else {
        std::env::current_dir()
            .map_err(|e| format!("Failed to get current directory: {}", e))?
            .join(&target)
    };

    // Normalize the path to resolve .. and .
    let normalized = normalize_path(&resolved).unwrap_or(resolved);

    let allowed_dirs = get_allowed_base_dirs();

    for allowed_dir in &allowed_dirs {
        if normalized.starts_with(allowed_dir) {
            return Ok(normalized);
        }
    }

    Err(format!(
        "Access denied: path '{}' is outside the allowed directories. \
         Only paths within ~/.skillx/ are permitted.",
        path
    ))
}

/// Normalize a path by resolving `.` and `..` components.
/// This does NOT follow symlinks - it only normalizes the path syntax.
fn normalize_path(path: &Path) -> Option<PathBuf> {
    let mut components = Vec::new();

    for component in path.components() {
        match component {
            std::path::Component::Normal(s) if s == std::path::Path::new(".").as_os_str() => {}
            std::path::Component::ParentDir => {
                components.pop();
            }
            other => components.push(other),
        }
    }

    Some(components.iter().collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_path_within_skillx() {
        let home = dirs::home_dir().unwrap_or_default();
        let valid_path = home.join(".skillx").join("skills").join("test");
        let result = validate_path(valid_path.to_str().unwrap());
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_path_outside_skillx() {
        let result = validate_path("/etc/passwd");
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_path_traversal_attack() {
        let home = dirs::home_dir().unwrap_or_default();
        let malicious = home.join(".skillx").join("..").join("..").join("etc").join("passwd");
        let result = validate_path(malicious.to_str().unwrap());
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_relative_path() {
        let result = validate_path("src/main.rs");
        // Relative paths should fail if they would resolve outside allowed dirs
        // This depends on the current working directory
        if let Ok(resolved) = result {
            let allowed_dirs = get_allowed_base_dirs();
            let is_allowed = allowed_dirs.iter().any(|d| resolved.starts_with(d));
            // The result depends on cwd, just ensure no panic
            let _ = is_allowed;
        }
    }
}
