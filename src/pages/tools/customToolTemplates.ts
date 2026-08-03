/**
 * Curated templates for well-known agents that aren't in the auto-detection list
 * (or whose auto-detection may miss non-standard install paths). Users pick one
 * from the "Add Custom Tool" dropdown to prefill name / id / paths.
 *
 * Templates that overlap with builtin SUPPORTED_TOOLS are filtered out at render
 * time so backend won't reject the create with a duplicate-id error.
 */
export interface CustomToolTemplate {
  id: string;
  name: string;
  /** Path relative to home directory, e.g. ".clawdbot" or ".config/zed" */
  configRel: string;
  /** Optional custom skills sub-path relative to config dir. Defaults to "skills". */
  skillsSubdir?: string;
}

export const CUSTOM_TOOL_TEMPLATES: CustomToolTemplate[] = [
  // ---- Builtin AI agents (mirrors src-tauri/src/models/tool.rs SUPPORTED_TOOLS) ----
  { id: "claude-code", name: "Claude Code", configRel: ".claude" },
  { id: "codex", name: "Codex", configRel: ".codex" },
  { id: "codebuddy", name: "CodeBuddy", configRel: ".codebuddy" },
  { id: "opencode", name: "OpenCode", configRel: ".config/opencode" },
  { id: "cursor", name: "Cursor", configRel: ".cursor" },
  { id: "gemini", name: "Gemini CLI", configRel: ".gemini" },
  { id: "antigravity", name: "Antigravity", configRel: ".antigravity" },
  { id: "windsurf", name: "Windsurf", configRel: ".windsurf" },
  { id: "trae", name: "Trae", configRel: ".trae" },
  { id: "droid", name: "Droid", configRel: ".factory" },
  { id: "augment", name: "Augment", configRel: ".augment" },
  { id: "openclaw", name: "OpenClaw", configRel: ".openclaw" },
  { id: "cline", name: "Cline", configRel: ".cline" },
  { id: "vercel-skills", name: "Vercel Skills", configRel: ".agents" },
  { id: "commandcode", name: "CommandCode", configRel: ".commandcode" },
  { id: "continue", name: "Continue", configRel: ".continue" },
  { id: "crush", name: "Crush", configRel: ".config/crush" },
  { id: "goose", name: "Goose", configRel: ".config/goose" },
  { id: "iflow", name: "iFlow", configRel: ".iflow" },
  { id: "junie", name: "Junie", configRel: ".junie" },
  { id: "kilo-code", name: "Kilo Code", configRel: ".kilocode" },
  { id: "kiro", name: "Kiro", configRel: ".kiro" },
  { id: "qoder", name: "Qoder", configRel: ".qoder" },
  { id: "qwen-code", name: "Qwen Code", configRel: ".qwen" },
  { id: "roo-code", name: "Roo Code", configRel: ".roo" },
  { id: "zencoder", name: "Zencoder", configRel: ".zencoder" },
  { id: "pi", name: "Pi", configRel: ".pi/agent" },
  { id: "trae-cn", name: "Trae CN", configRel: ".trae-cn" },
  { id: "hermes", name: "Hermes", configRel: ".hermes" },
  { id: "qclaw", name: "QClaw", configRel: ".qclaw" },
  { id: "easyclaw", name: "EasyClaw", configRel: ".easyclaw" },
  { id: "autoclaw", name: "AutoClaw", configRel: ".openclaw-autoclaw" },
  { id: "workbuddy", name: "WorkBuddy", configRel: ".workbuddy/skills-marketplace" },
  { id: "qwenpaw", name: "QwenPaw", configRel: ".qwenpaw", skillsSubdir: "skill_pool" },
  { id: "copaw", name: "QwenPaw", configRel: ".copaw", skillsSubdir: "skill_pool" },
  { id: "amp", name: "Amp", configRel: ".amp" },
  { id: "aider", name: "Aider", configRel: ".aider" },
  { id: "copilot", name: "GitHub Copilot", configRel: ".copilot" },
  { id: "grok", name: "Grok", configRel: ".grok" },
  { id: "ob1", name: "OB1", configRel: ".ob1" },
  // ---- Extra well-known agents not in auto-detection ----
  { id: "clawdbot", name: "Clawdbot", configRel: ".clawdbot" },
  { id: "zed", name: "Zed", configRel: ".config/zed" },
  { id: "void-editor", name: "Void Editor", configRel: ".void" },
  { id: "roo-cline", name: "Roo Cline", configRel: ".roo-cline" },
  { id: "cursor-agent", name: "Cursor Agent", configRel: ".cursor-agent" },
  { id: "cody", name: "Cody (Sourcegraph)", configRel: ".sourcegraph/cody" },
  { id: "tabby", name: "Tabby", configRel: ".tabby" },
  { id: "sweep", name: "Sweep", configRel: ".sweep" },
];
