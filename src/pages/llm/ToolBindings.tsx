// @ts-nocheck
import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "@/i18n";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/loading";

export interface LlmProviderConfig {
  id: string;
  name: string;
  base_url: string;
  base_url_openai: string;
  base_url_anthropic: string;
  api_format: string;
  api_key: string;
  model: string;
  temperature?: number;
  max_tokens?: number;
  timeout_secs?: number;
}

export interface ToolInfo {
  id: string;
  name: string;
  detected: boolean;
}

const TOOL_IDS = ["claude-code", "codex", "gemini", "opencode", "openclaw", "hermes"] as const;

const TOOL_NAMES: Record<string, string> = {
  "claude-code": "Claude Code",
  "codex": "Codex",
  "gemini": "Gemini CLI",
  "opencode": "OpenCode",
  "openclaw": "OpenClaw",
  "hermes": "Hermes",
};

const TOOL_COLORS: Record<string, string> = {
  "claude-code": "#d4a574",
  "codex": "#6b7280",
  "gemini": "#4285f4",
  "opencode": "#10b981",
  "openclaw": "#8b5cf6",
  "hermes": "#f59e0b",
};

type ToolBindings = Record<string, string>;

export function ToolBindings() {
  const { t } = useTranslation();
  const { addToast, removeToast } = useToast();

  const [providers, setProviders] = useState<LlmProviderConfig[]>([]);
  const [bindings, setBindings] = useState<ToolBindings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Claude Code config write state
  const [writingClaudeConfig, setWritingClaudeConfig] = useState(false);
  const [claudeConfigWritten, setClaudeConfigWritten] = useState(false);
  const [restartingClaude, setRestartingClaude] = useState(false);

  // Codex config write state
  const [writingCodexConfig, setWritingCodexConfig] = useState(false);
  const [codexConfigWritten, setCodexConfigWritten] = useState(false);
  const [restartingCodex, setRestartingCodex] = useState(false);

  // Backup/restore state
  const [restoringClaude, setRestoringClaude] = useState(false);
  const [restoringCodex, setRestoringCodex] = useState(false);

  const [tools, setTools] = useState<ToolInfo[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [providerList, currentBindings, toolList] = await Promise.all([
        invoke<LlmProviderConfig[]>("get_llm_providers"),
        invoke<ToolBindings>("get_tool_bindings"),
        invoke<ToolInfo[]>("detect_tools"),
      ]);
      setProviders(providerList);
      setBindings(currentBindings);
      // Filter tools: only show main tools + hermes profiles
      const filteredTools = toolList.filter(
        (tool) => TOOL_IDS.includes(tool.id as any) || tool.id.startsWith("hermes-")
      );
      setTools(filteredTools);
      setClaudeConfigWritten(false);
    } catch (err) {
      addToast(t("llmProviders.bindings.loadFailed"), "error");
      console.error("Failed to load tool bindings:", err);
    } finally {
      setLoading(false);
    }
  }, [t, addToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleBindingChange = (toolId: string, providerId: string) => {
    setBindings((prev) => {
      const next = { ...prev, [toolId]: providerId };
      setHasChanges(true);
      if (toolId === "claude-code") {
        setClaudeConfigWritten(false);
      }
      if (toolId === "codex") {
        setCodexConfigWritten(false);
      }
      return next;
    });
  };

  const getProviderLabel = (providerId: string): string => {
    const provider = providers.find((p) => p.id === providerId);
    if (!provider) return t("llmProviders.bindings.noProviders");
    return `${provider.name} → ${provider.model}`;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await invoke("save_tool_bindings", { bindings: bindings });
      setHasChanges(false);
      addToast(t("llmProviders.bindings.saved"), "success");
    } catch (err) {
      addToast(t("llmProviders.bindings.saveFailed"), "error");
      console.error("Failed to save tool bindings:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleWriteClaudeConfig = async () => {
    const providerId = bindings["claude-code"];
    if (!providerId) return;

    const provider = providers.find((p) => p.id === providerId);
    if (!provider) return;

    setWritingClaudeConfig(true);
    try {
      const result = await invoke<string>("apply_claude_provider", { provider: {
        id: provider.id,
        name: provider.name,
        base_url: provider.base_url,
        base_url_openai: provider.base_url_openai || "",
        base_url_anthropic: provider.base_url_anthropic || "",
        api_format: provider.api_format || "",
        api_key: provider.api_key,
        model: provider.model,
        temperature: provider.temperature,
        max_tokens: provider.max_tokens,
        timeout_secs: provider.timeout_secs,
      }});
      setClaudeConfigWritten(true);
      addToast(result || "Claude Code 配置已写入", "success");
    } catch (err) {
      addToast("写入 Claude Code 配置失败: " + String(err), "error");
      console.error("Failed to write Claude config:", err);
    } finally {
      setWritingClaudeConfig(false);
    }
  };

  const handleRestartClaudeCode = async () => {
    setRestartingClaude(true);
    try {
      const result = await invoke<string>("restart_claude_code_cmd");
      addToast(result || "Claude Code 已重启", "success");
      setClaudeConfigWritten(false);
    } catch (err) {
      addToast("重启 Claude Code 失败: " + String(err), "error");
      console.error("Failed to restart Claude Code:", err);
    } finally {
      setRestartingClaude(false);
    }
  };

  const handleWriteCodexConfig = async () => {
    const providerId = bindings["codex"];
    if (!providerId) return;

    const provider = providers.find((p) => p.id === providerId);
    if (!provider) return;

    setWritingCodexConfig(true);
    try {
      const result = await invoke<string>("apply_codex_provider", { provider: {
        id: provider.id,
        name: provider.name,
        base_url: provider.base_url,
        base_url_openai: provider.base_url_openai || "",
        base_url_anthropic: provider.base_url_anthropic || "",
        api_format: provider.api_format || "",
        api_key: provider.api_key,
        model: provider.model,
        temperature: provider.temperature,
        max_tokens: provider.max_tokens,
        timeout_secs: provider.timeout_secs,
      }});
      setCodexConfigWritten(true);
      addToast(result || "Codex 配置已写入", "success");
    } catch (err) {
      addToast("写入 Codex 配置失败: " + String(err), "error");
      console.error("Failed to write Codex config:", err);
    } finally {
      setWritingCodexConfig(false);
    }
  };

  const handleRestartCodex = async () => {
    setRestartingCodex(true);
    try {
      const result = await invoke<string>("restart_codex_cmd");
      addToast(result || "Codex 已重启", "success");
      setCodexConfigWritten(false);
    } catch (err) {
      addToast("重启 Codex 失败: " + String(err), "error");
      console.error("Failed to restart Codex:", err);
    } finally {
      setRestartingCodex(false);
    }
  };

  const handleRestoreClaude = async () => {
    setRestoringClaude(true);
    try {
      const result = await invoke<string>("clear_claude_provider");
      addToast(result || "Claude Code 配置已恢复", "success");
      setClaudeConfigWritten(false);
    } catch (err) {
      addToast("恢复 Claude Code 配置失败: " + String(err), "error");
      console.error("Failed to restore Claude config:", err);
    } finally {
      setRestoringClaude(false);
    }
  };

  const handleRestoreCodex = async () => {
    setRestoringCodex(true);
    try {
      const result = await invoke<string>("restore_codex_original");
      addToast(result || "Codex 已恢复为原始 OpenAI 配置", "success");
      setCodexConfigWritten(false);
    } catch (err) {
      addToast("恢复 Codex 配置失败: " + String(err), "error");
      console.error("Failed to restore Codex config:", err);
    } finally {
      setRestoringCodex(false);
    }
  };

  const claudeCodeBinding = bindings["claude-code"];
  const claudeCodeProvider = providers.find((p) => p.id === claudeCodeBinding);
  const codexBinding = bindings["codex"];
  const codexProvider = providers.find((p) => p.id === codexBinding);

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px 24px",
        }}
      >
        <Spinner size={24} />
      </div>
    );
  }

  if (providers.length === 0) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "48px 24px",
          color: "var(--muted-foreground)",
        }}
      >
        <p style={{ fontSize: "14px", margin: 0 }}>
          {t("llmProviders.bindings.noProviders")}
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div
        style={{
          fontSize: "13px",
          color: "var(--muted-foreground)",
          lineHeight: "1.5",
        }}
      >
        {t("llmProviders.bindings.description")}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {tools.map((tool) => {
          const toolId = tool.id;
          const toolName = tool.name;
          const isHermesProfile = toolId.startsWith("hermes-");
          const toolColor = isHermesProfile ? "#f59e0b" : (TOOL_COLORS[toolId] ?? "#6b7280");
          const initial = toolName.charAt(0).toUpperCase();
          const currentBinding = bindings[toolId] ?? "";
          const currentLabel = currentBinding ? getProviderLabel(currentBinding) : "—";

          return (
            <div
              key={toolId}
              style={{
                borderRadius: "8px",
                border: "1px solid var(--border)",
                backgroundColor: "var(--background)",
                padding: "14px 16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    backgroundColor: toolColor,
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: "14px",
                    flexShrink: 0,
                  }}
                >
                  {initial}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: "14px",
                      color: "var(--foreground)",
                    }}
                  >
                    {toolName}
                  </div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "var(--muted-foreground)",
                      marginTop: "2px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {currentLabel}
                  </div>
                </div>
              </div>

              <div style={{ flexShrink: 0, minWidth: "180px" }}>
                <select
                  value={currentBinding}
                  onChange={(e) => handleBindingChange(toolId, e.target.value)}
                  style={{
                    width: "100%",
                    padding: "6px 28px 6px 10px",
                    borderRadius: "6px",
                    border: "1px solid var(--input)",
                    backgroundColor: "var(--background)",
                    color: "var(--foreground)",
                    fontSize: "13px",
                    appearance: "none",
                    backgroundImage:
                      'url(\'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="%23737373" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>\')',
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "right 8px center",
                    cursor: "pointer",
                    outline: "none",
                  }}
                >
                  <option value="">—</option>
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.model})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          );
        })}
      </div>

      {/* Claude Code config section */}
      {claudeCodeBinding && claudeCodeProvider && (
        <div
          style={{
            marginTop: "8px",
            padding: "16px",
            borderRadius: "8px",
            border: "1px solid var(--border)",
            backgroundColor: "var(--secondary)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "8px",
            }}
          >
            <div
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "50%",
                backgroundColor: TOOL_COLORS["claude-code"],
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: "12px",
                flexShrink: 0,
              }}
            >
              C
            </div>
            <span style={{ fontWeight: 600, fontSize: "14px" }}>
              Claude Code 配置
            </span>
            <Badge
              style={{
                fontSize: "11px",
                backgroundColor: "var(--primary)",
                color: "var(--primary-foreground)",
              }}
            >
              {claudeCodeProvider.name}
            </Badge>
          </div>

          <div
            style={{
              fontSize: "12px",
              color: "var(--muted-foreground)",
              marginBottom: "12px",
              lineHeight: "1.5",
            }}
          >
            将当前选中的大模型配置写入 Claude Code 的 settings.json，修改后需要重启 Claude Code 才能生效。
            <br />
            <span style={{ color: "var(--muted-foreground)", opacity: 0.7 }}>
              写入前会自动备份原始配置，支持一键恢复。
            </span>
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {!claudeConfigWritten ? (
              <Button
                onClick={handleWriteClaudeConfig}
                disabled={writingClaudeConfig}
                variant="default"
                size="sm"
              >
                {writingClaudeConfig ? "写入中..." : "写入 Claude Code 配置"}
              </Button>
            ) : (
              <>
                <Button
                  onClick={handleRestartClaudeCode}
                  disabled={restartingClaude}
                  variant="default"
                  size="sm"
                >
                  {restartingClaude ? "重启中..." : "重启 Claude Code"}
                </Button>
                <span
                  style={{
                    fontSize: "12px",
                    color: "var(--muted-foreground)",
                    alignSelf: "center",
                  }}
                >
                  配置已写入，重启后生效
                </span>
              </>
            )}
            <Button
              onClick={handleRestoreClaude}
              disabled={restoringClaude}
              variant="outline"
              size="sm"
              style={{ borderColor: "#d4a574", color: "#d4a574" }}
            >
              {restoringClaude ? "恢复中..." : "恢复原始配置"}
            </Button>
          </div>
        </div>
      )}

      {/* Codex config section */}
      {codexBinding && codexProvider && (
        <div
          style={{
            marginTop: "8px",
            padding: "16px",
            borderRadius: "8px",
            border: "1px solid var(--border)",
            backgroundColor: "var(--secondary)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "8px",
            }}
          >
            <div
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "50%",
                backgroundColor: TOOL_COLORS["codex"],
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: "12px",
                flexShrink: 0,
              }}
            >
              C
            </div>
            <span style={{ fontWeight: 600, fontSize: "14px" }}>
              Codex 配置
            </span>
            <Badge
              style={{
                fontSize: "11px",
                backgroundColor: "var(--primary)",
                color: "var(--primary-foreground)",
              }}
            >
              {codexProvider.name}
            </Badge>
          </div>

          <div
            style={{
              fontSize: "12px",
              color: "var(--muted-foreground)",
              marginBottom: "12px",
              lineHeight: "1.5",
            }}
          >
            将当前选中的大模型配置写入 Codex 的 config.toml + auth.json，修改后需要重启 Codex 才能生效。
            <br />
            <span style={{ color: "var(--muted-foreground)", opacity: 0.7 }}>
              写入前会自动备份原始配置，支持一键恢复为 OpenAI 官方配置。
            </span>
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {!codexConfigWritten ? (
              <Button
                onClick={handleWriteCodexConfig}
                disabled={writingCodexConfig}
                variant="default"
                size="sm"
              >
                {writingCodexConfig ? "写入中..." : "写入 Codex 配置"}
              </Button>
            ) : (
              <>
                <Button
                  onClick={handleRestartCodex}
                  disabled={restartingCodex}
                  variant="default"
                  size="sm"
                >
                  {restartingCodex ? "重启中..." : "重启 Codex"}
                </Button>
                <span
                  style={{
                    fontSize: "12px",
                    color: "var(--muted-foreground)",
                    alignSelf: "center",
                  }}
                >
                  配置已写入，重启后生效
                </span>
              </>
            )}
            <Button
              onClick={handleRestoreCodex}
              disabled={restoringCodex}
              variant="outline"
              size="sm"
              style={{ borderColor: "#6b7280", color: "#6b7280" }}
            >
              {restoringCodex ? "恢复中..." : "恢复 OpenAI 官方配置"}
            </Button>
          </div>
        </div>
      )}

      {/* Save bindings button */}
      {hasChanges && (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button onClick={handleSave} disabled={saving} variant="default" size="sm">
            {saving ? "保存中..." : "保存绑定"}
          </Button>
        </div>
      )}
    </div>
  );
}
