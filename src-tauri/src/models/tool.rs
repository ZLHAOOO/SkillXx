use super::config::ToolConfig;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ToolSource {
    Builtin,
    Custom,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tool {
    pub id: String,
    pub name: String,
    pub detected: bool,
    pub config: ToolConfig,
    pub source: ToolSource,
    #[serde(default)]
    pub icon_path: Option<PathBuf>,
}

impl Tool {
    #[allow(dead_code)]
    pub fn new(id: String, name: String, config: ToolConfig) -> Self {
        Self {
            id,
            name,
            detected: false,
            config,
            source: ToolSource::Builtin,
            icon_path: None,
        }
    }
}

#[derive(Debug, Clone, Copy)]
pub struct ToolDefinition {
    pub id: &'static str,
    pub name: &'static str,
    pub config_dir: &'static str,
    pub alt_config_dirs: &'static [&'static str],
}

/// Tools that keep their skills in a subdirectory of `config_dir` other than `skills`.
/// Everything not listed here uses the default `<config_dir>/skills` layout.
const SKILLS_SUBDIR_OVERRIDES: &[(&str, &str)] = &[
    // QwenPaw exposes a shared skill pool instead of a plain `skills` directory.
    ("qwenpaw", "skill_pool"),
    ("copaw", "skill_pool"),
];

pub const DEFAULT_SKILLS_SUBDIR: &str = "skills";

impl ToolDefinition {
    /// Subdirectory of the tool's config dir that holds its skills.
    pub fn skills_subdir(&self) -> &'static str {
        SKILLS_SUBDIR_OVERRIDES
            .iter()
            .find(|(id, _)| *id == self.id)
            .map(|(_, subdir)| *subdir)
            .unwrap_or(DEFAULT_SKILLS_SUBDIR)
    }
}

pub const SUPPORTED_TOOLS: &[ToolDefinition] = &[
    ToolDefinition {
        id: "claude-code",
        name: "Claude Code",
        config_dir: ".claude",
        alt_config_dirs: &[],
    },
    ToolDefinition {
        id: "codex",
        name: "Codex",
        config_dir: ".codex",
        alt_config_dirs: &[],
    },
    ToolDefinition {
        id: "codebuddy",
        name: "CodeBuddy",
        config_dir: ".codebuddy",
        alt_config_dirs: &[],
    },
    ToolDefinition {
        id: "opencode",
        name: "OpenCode",
        config_dir: ".config/opencode",
        alt_config_dirs: &[".opencode"],
    },
    ToolDefinition {
        id: "cursor",
        name: "Cursor",
        config_dir: ".cursor",
        alt_config_dirs: &[],
    },
    ToolDefinition {
        id: "gemini",
        name: "Gemini CLI",
        config_dir: ".gemini",
        alt_config_dirs: &[],
    },
    ToolDefinition {
        id: "antigravity",
        name: "Antigravity",
        config_dir: ".antigravity",
        alt_config_dirs: &[],
    },
    ToolDefinition {
        id: "windsurf",
        name: "Windsurf",
        config_dir: ".windsurf",
        alt_config_dirs: &[],
    },
    ToolDefinition {
        id: "trae",
        name: "Trae",
        config_dir: ".trae",
        alt_config_dirs: &[],
    },
    ToolDefinition {
        id: "droid",
        name: "Droid",
        config_dir: ".factory",
        alt_config_dirs: &[".droid"],
    },
    ToolDefinition {
        id: "augment",
        name: "Augment",
        config_dir: ".augment",
        alt_config_dirs: &[],
    },
    ToolDefinition {
        id: "openclaw",
        name: "OpenClaw",
        config_dir: ".openclaw",
        alt_config_dirs: &[],
    },
    ToolDefinition {
        id: "cline",
        name: "Cline",
        config_dir: ".cline",
        alt_config_dirs: &[],
    },
    ToolDefinition {
        id: "vercel-skills",
        name: "Vercel Skills",
        config_dir: ".agents",
        alt_config_dirs: &[".vercel", ".vercel-skills"],
    },
    ToolDefinition {
        id: "commandcode",
        name: "CommandCode",
        config_dir: ".commandcode",
        alt_config_dirs: &[],
    },
    ToolDefinition {
        id: "continue",
        name: "Continue",
        config_dir: ".continue",
        alt_config_dirs: &[],
    },
    ToolDefinition {
        id: "crush",
        name: "Crush",
        config_dir: ".config/crush",
        alt_config_dirs: &[".crush"],
    },
    ToolDefinition {
        id: "goose",
        name: "Goose",
        config_dir: ".config/goose",
        alt_config_dirs: &[".goose"],
    },
    ToolDefinition {
        id: "iflow",
        name: "iFlow",
        config_dir: ".iflow",
        alt_config_dirs: &[],
    },
    ToolDefinition {
        id: "junie",
        name: "Junie",
        config_dir: ".junie",
        alt_config_dirs: &[],
    },
    ToolDefinition {
        id: "kilo-code",
        name: "Kilo Code",
        config_dir: ".kilocode",
        alt_config_dirs: &[],
    },
    ToolDefinition {
        id: "kiro",
        name: "Kiro",
        config_dir: ".kiro",
        alt_config_dirs: &[],
    },
    ToolDefinition {
        id: "qoder",
        name: "Qoder",
        config_dir: ".qoder",
        alt_config_dirs: &[],
    },
    ToolDefinition {
        id: "qwen-code",
        name: "Qwen Code",
        config_dir: ".qwen",
        alt_config_dirs: &[],
    },
    ToolDefinition {
        id: "roo-code",
        name: "Roo Code",
        config_dir: ".roo",
        alt_config_dirs: &[],
    },
    ToolDefinition {
        id: "zencoder",
        name: "Zencoder",
        config_dir: ".zencoder",
        alt_config_dirs: &[],
    },
    ToolDefinition {
        id: "pi",
        name: "Pi",
        config_dir: ".pi/agent",
        alt_config_dirs: &[],
    },
    ToolDefinition {
        id: "trae-cn",
        name: "Trae CN",
        config_dir: ".trae-cn",
        alt_config_dirs: &[],
    },
    ToolDefinition {
        id: "hermes",
        name: "Hermes",
        config_dir: ".hermes",
        alt_config_dirs: &[],
    },
    // ---- Lobster / Chinese agent family ----
    ToolDefinition {
        id: "qclaw",
        name: "QClaw (千爪)",
        config_dir: ".qclaw",
        alt_config_dirs: &[],
    },
    ToolDefinition {
        id: "easyclaw",
        name: "EasyClaw (简爪)",
        config_dir: ".easyclaw",
        alt_config_dirs: &[".easyclaw-20260322-01"],
    },
    ToolDefinition {
        id: "autoclaw",
        name: "AutoClaw",
        config_dir: ".openclaw-autoclaw",
        alt_config_dirs: &[".autoclaw"],
    },
    ToolDefinition {
        id: "workbuddy",
        name: "WorkBuddy (打工搭子)",
        // WorkBuddy stores skills under a `skills-marketplace` subdirectory. We point config_dir
        // at that subdirectory so detection + skills path both resolve correctly with the default
        // `<config_dir>/skills` layout.
        config_dir: ".workbuddy/skills-marketplace",
        alt_config_dirs: &[".workbuddy"],
    },
    ToolDefinition {
        id: "qwenpaw",
        name: "QwenPaw",
        // QwenPaw was renamed from CoPaw. Both working directories are registered as
        // separate tools sharing one name and icon, because a machine can genuinely hold
        // two independent installs and each needs its own skill pool managed. Undetected
        // builtin tools are hidden from the tools page, so only the installs that exist
        // show up. Skills live in the shared `skill_pool` subdirectory (see
        // SKILLS_SUBDIR_OVERRIDES), whose manifest QwenPaw rebuilds from disk, so a plain
        // symlink is enough to register a skill.
        config_dir: ".qwenpaw",
        alt_config_dirs: &[],
    },
    ToolDefinition {
        id: "copaw",
        name: "QwenPaw",
        config_dir: ".copaw",
        alt_config_dirs: &[],
    },
    // ---- Well-known Western agents ----
    ToolDefinition {
        id: "amp",
        name: "Amp",
        config_dir: ".amp",
        alt_config_dirs: &[],
    },
    ToolDefinition {
        id: "aider",
        name: "Aider",
        config_dir: ".aider",
        alt_config_dirs: &[],
    },
    ToolDefinition {
        id: "copilot",
        name: "GitHub Copilot",
        config_dir: ".copilot",
        alt_config_dirs: &[".config/gh-copilot"],
    },
    ToolDefinition {
        id: "grok",
        name: "Grok",
        config_dir: ".grok",
        alt_config_dirs: &[],
    },
    ToolDefinition {
        id: "ob1",
        name: "OB1",
        config_dir: ".ob1",
        alt_config_dirs: &[],
    },
];

#[cfg(test)]
mod tests {
    use super::SUPPORTED_TOOLS;

    #[test]
    fn qwenpaw_and_copaw_are_registered_as_separate_installs() {
        let qwenpaw = SUPPORTED_TOOLS
            .iter()
            .find(|tool| tool.id == "qwenpaw")
            .expect("qwenpaw should exist in supported tools");
        let copaw = SUPPORTED_TOOLS
            .iter()
            .find(|tool| tool.id == "copaw")
            .expect("copaw should exist in supported tools");

        assert_eq!(qwenpaw.config_dir, ".qwenpaw");
        assert_eq!(copaw.config_dir, ".copaw");
        // Neither may list the other as an alternative, otherwise a machine with only one
        // install would surface two cards managing the same directory.
        assert!(qwenpaw.alt_config_dirs.is_empty());
        assert!(copaw.alt_config_dirs.is_empty());
        // Same product, so the UI shows one name and one icon for both.
        assert_eq!(qwenpaw.name, copaw.name);
        assert_eq!(qwenpaw.skills_subdir(), "skill_pool");
        assert_eq!(copaw.skills_subdir(), "skill_pool");
    }

    #[test]
    fn tools_without_an_override_use_the_default_skills_subdir() {
        let claude_code = SUPPORTED_TOOLS
            .iter()
            .find(|tool| tool.id == "claude-code")
            .expect("claude-code should exist in supported tools");

        assert_eq!(claude_code.skills_subdir(), "skills");
    }

    #[test]
    fn supported_tools_include_recent_builtins() {
        let ids: Vec<&str> = SUPPORTED_TOOLS.iter().map(|tool| tool.id).collect();

        assert!(ids.contains(&"droid"));
        assert!(ids.contains(&"augment"));
        assert!(ids.contains(&"openclaw"));
        assert!(ids.contains(&"cline"));
        assert!(ids.contains(&"vercel-skills"));
        assert!(ids.contains(&"commandcode"));
        assert!(ids.contains(&"continue"));
        assert!(ids.contains(&"crush"));
        assert!(ids.contains(&"goose"));
        assert!(ids.contains(&"iflow"));
        assert!(ids.contains(&"junie"));
        assert!(ids.contains(&"kilo-code"));
        assert!(ids.contains(&"kiro"));
        assert!(ids.contains(&"qoder"));
        assert!(ids.contains(&"qwen-code"));
        assert!(ids.contains(&"roo-code"));
        assert!(ids.contains(&"zencoder"));
        assert!(ids.contains(&"pi"));
        assert!(ids.contains(&"trae-cn"));
        assert!(ids.contains(&"hermes"));
    }

    #[test]
    fn droid_and_vercel_skills_use_expected_base_directories() {
        let droid = SUPPORTED_TOOLS
            .iter()
            .find(|tool| tool.id == "droid")
            .expect("droid should exist in supported tools");
        let vercel_skills = SUPPORTED_TOOLS
            .iter()
            .find(|tool| tool.id == "vercel-skills")
            .expect("vercel-skills should exist in supported tools");

        assert_eq!(droid.config_dir, ".factory");
        assert_eq!(vercel_skills.config_dir, ".agents");
    }

    #[test]
    fn newly_added_tools_use_expected_base_directories() {
        let commandcode = SUPPORTED_TOOLS
            .iter()
            .find(|tool| tool.id == "commandcode")
            .expect("commandcode should exist in supported tools");
        let continue_tool = SUPPORTED_TOOLS
            .iter()
            .find(|tool| tool.id == "continue")
            .expect("continue should exist in supported tools");
        let crush = SUPPORTED_TOOLS
            .iter()
            .find(|tool| tool.id == "crush")
            .expect("crush should exist in supported tools");
        let goose = SUPPORTED_TOOLS
            .iter()
            .find(|tool| tool.id == "goose")
            .expect("goose should exist in supported tools");
        let iflow = SUPPORTED_TOOLS
            .iter()
            .find(|tool| tool.id == "iflow")
            .expect("iflow should exist in supported tools");

        assert_eq!(commandcode.config_dir, ".commandcode");
        assert_eq!(continue_tool.config_dir, ".continue");
        assert_eq!(crush.config_dir, ".config/crush");
        assert_eq!(goose.config_dir, ".config/goose");
        assert_eq!(iflow.config_dir, ".iflow");
    }

    #[test]
    fn newly_added_tools_batch_two_use_expected_base_directories() {
        let junie = SUPPORTED_TOOLS
            .iter()
            .find(|tool| tool.id == "junie")
            .expect("junie should exist in supported tools");
        let kilo_code = SUPPORTED_TOOLS
            .iter()
            .find(|tool| tool.id == "kilo-code")
            .expect("kilo-code should exist in supported tools");
        let kiro = SUPPORTED_TOOLS
            .iter()
            .find(|tool| tool.id == "kiro")
            .expect("kiro should exist in supported tools");
        let qoder = SUPPORTED_TOOLS
            .iter()
            .find(|tool| tool.id == "qoder")
            .expect("qoder should exist in supported tools");
        let qwen_code = SUPPORTED_TOOLS
            .iter()
            .find(|tool| tool.id == "qwen-code")
            .expect("qwen-code should exist in supported tools");
        let roo_code = SUPPORTED_TOOLS
            .iter()
            .find(|tool| tool.id == "roo-code")
            .expect("roo-code should exist in supported tools");
        let zencoder = SUPPORTED_TOOLS
            .iter()
            .find(|tool| tool.id == "zencoder")
            .expect("zencoder should exist in supported tools");
        let pi = SUPPORTED_TOOLS
            .iter()
            .find(|tool| tool.id == "pi")
            .expect("pi should exist in supported tools");

        assert_eq!(junie.config_dir, ".junie");
        assert_eq!(kilo_code.config_dir, ".kilocode");
        assert_eq!(kiro.config_dir, ".kiro");
        assert_eq!(qoder.config_dir, ".qoder");
        assert_eq!(qwen_code.config_dir, ".qwen");
        assert_eq!(roo_code.config_dir, ".roo");
        assert_eq!(zencoder.config_dir, ".zencoder");
        assert_eq!(pi.config_dir, ".pi/agent");
    }
}
