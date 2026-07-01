// @ts-nocheck
import { useState, useEffect, useMemo, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "@/i18n";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/loading";

/* ================================================================
   Types
   ================================================================ */
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

type ToolBindings = Record<string, string>;

const TOOL_IDS = ["claude-code", "codex", "gemini", "opencode", "openclaw", "hermes"] as const;

const TOOL_COLORS: Record<string, string> = {
  "claude-code": "#d4a574",
  "codex": "#6b7280",
  "gemini": "#4285f4",
  "opencode": "#10b981",
  "openclaw": "#8b5cf6",
  "hermes": "#f59e0b",
};

/* ================================================================
   ProviderInfo – label + protocol badge
   ================================================================ */
function ProviderInfo({ provider, toolId, isUnavailable }: {
  provider: LlmProviderConfig;
  toolId: string;
  isUnavailable: boolean;
}) {
  const protocol = toolId === "claude-code" ? "anthropic" : "openai";
  return (
    <>
      {!isUnavailable && (
        <span style={{
          fontSize: "10px", fontWeight: 500, padding: "0px 5px",
          borderRadius: "9999px", lineHeight: "16px", flexShrink: 0,
          ...(protocol === "anthropic"
            ? { backgroundColor: "color-mix(in srgb, #d97757 15%, transparent)", color: "#d97757" }
            : { backgroundColor: "color-mix(in srgb, #10a37f 15%, transparent)", color: "#10a37f" }),
        }}>
          {protocol === "anthropic" ? "Anthropic" : "OpenAI"}
        </span>
      )}
      <span style={{
        fontSize: "12px",
        color: isUnavailable ? "#d97757" : "var(--muted-foreground)",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {provider.name}
        {provider.model && <span style={{ opacity: 0.7 }}> · {provider.model}</span>}
        {isUnavailable && <span style={{ opacity: 0.7 }}>（缺少 Anthropic URL）</span>}
      </span>
    </>
  );
}

/* ================================================================
   ConfigSection – shared write / restart / restore buttons
   ================================================================ */
function ConfigSection({
  icon, iconBg, title, badge, description, accent,
  onWrite, onRestart, onRestore,
  writeLabel, restartLabel, restoreLabel,
  writing, restarting, restoring, configWritten, writeDisabled,
  unavailable, unavailableMsg,
  extra,
}: {
  icon: string;
  iconBg: string;
  title: string;
  badge: string;
  description: string;
  accent: string;
  onWrite: () => void;
  onRestart: () => void;
  onRestore: () => void;
  writeLabel: string;
  restartLabel: string;
  restoreLabel: string;
  writing: boolean;
  restarting: boolean;
  restoring: boolean;
  configWritten: boolean;
  writeDisabled: boolean;
  unavailable: boolean;
  unavailableMsg?: string;
  extra?: React.ReactNode;
}) {
  return (
    <div style={{ marginTop: "8px", padding: "16px", borderRadius: "8px", border: "1px solid var(--border)", backgroundColor: "var(--secondary)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
        <div style={{
          width: "28px", height: "28px", borderRadius: "50%",
          backgroundColor: iconBg, color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontWeight: 700, fontSize: "12px", flexShrink: 0,
        }}>{icon}</div>
        <span style={{ fontWeight: 600, fontSize: "14px" }}>{title}</span>
        <Badge style={{ fontSize: "11px", backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>{badge}</Badge>
      </div>
      <div style={{ fontSize: "12px", color: "var(--muted-foreground)", marginBottom: "12px", lineHeight: "1.5" }}>
        {description}
        <br /><span style={{ opacity: 0.7 }}>写入前会自动备份原始配置，支持一键恢复。</span>
      </div>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
        {unavailable && unavailableMsg && (
          <span style={{ fontSize: "12px", color: "#d97757" }}>{unavailableMsg}</span>
        )}
        {!configWritten ? (
          <Button onClick={onWrite} disabled={writing || writeDisabled} variant="default" size="sm">
            {writing ? "写入中..." : writeLabel}
          </Button>
        ) : (
          <>
            <Button onClick={onRestart} disabled={restarting || writeDisabled} variant="default" size="sm">
              {restarting ? "重启中..." : restartLabel}
            </Button>
            <span style={{ fontSize: "12px", color: "var(--muted-foreground)", alignSelf: "center" }}>
              配置已写入，重启后生效
            </span>
          </>
        )}
        <Button onClick={onRestore} disabled={restoring} variant="outline" size="sm" style={{ borderColor: accent, color: accent }}>
          {restoring ? "恢复中..." : restoreLabel}
        </Button>
      </div>
      {extra}
    </div>
  );
}

/* ================================================================
   ToolBindings
   ================================================================ */
export function ToolBindings() {
  const { t } = useTranslation();
  const toast = useToast();
  // Stable t: avoid re-creating fetchData when context value object changes
  const stableT = useMemo(() => t, [t]);
  // Stable toast reference (useToast returns new object each render)
  const addToastRef = useRef(toast.addToast);
  addToastRef.current = toast.addToast;

  const [providers, setProviders] = useState<LlmProviderConfig[]>([]);
  const [bindings, setBindings] = useState<ToolBindings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Claude Code
  const [writingClaude, setWritingClaude] = useState(false);
  const [claudeWritten, setClaudeWritten] = useState(false);
  const [restartingClaude, setRestartingClaude] = useState(false);
  const [restoringClaude, setRestoringClaude] = useState(false);

  // Codex
  const [writingCodex, setWritingCodex] = useState(false);
  const [codexWritten, setCodexWritten] = useState(false);
  const [restartingCodex, setRestartingCodex] = useState(false);
  const [restoringCodex, setRestoringCodex] = useState(false);

  // Hermes
  const [hermesProfile, setHermesProfile] = useState("");
  const [writingHermes, setWritingHermes] = useState(false);
  const [hermesWritten, setHermesWritten] = useState(false);
  const [restartingHermes, setRestartingHermes] = useState(false);

  const [tools, setTools] = useState<ToolInfo[]>([]);

  /* ---- data loading (simple useEffect, no useCallback) ---- */

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [providerList, currentBindings, toolList] = await Promise.all([
          invoke<LlmProviderConfig[]>("get_llm_providers"),
          invoke<ToolBindings>("get_tool_bindings"),
          invoke<ToolInfo[]>("detect_tools"),
        ]);
        if (cancelled) return;
        setProviders(providerList);
        setBindings(currentBindings);
        setTools(toolList.filter(
          (tool) => TOOL_IDS.includes(tool.id as any) || tool.id.startsWith("hermes-")
        ));
      } catch (err) {
        if (!cancelled) {
          addToastRef.current(stableT("llmProviders.bindings.loadFailed"), "error");
          console.error("Failed to load tool bindings:", err);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [stableT]);

  /* ---- binding change ---- */

  const handleBindingChange = (toolId: string, providerId: string) => {
    setBindings((prev) => {
      const next = { ...prev, [toolId]: providerId };
      setHasChanges(true);
      if (toolId === "claude-code") setClaudeWritten(false);
      if (toolId === "codex") setCodexWritten(false);
      return next;
    });
  };

  /* ---- save ---- */

  const handleSave = async () => {
    setSaving(true);
    try {
      await invoke("save_tool_bindings", { bindings });
      setHasChanges(false);
      addToastRef.current(stableT("llmProviders.bindings.saved"), "success");
    } catch (err) {
      addToastRef.current(stableT("llmProviders.bindings.saveFailed"), "error");
      console.error("Failed to save:", err);
    } finally {
      setSaving(false);
    }
  };

  /* ---- helper: build provider payload for Tauri commands ---- */

  function buildProviderPayload(p: LlmProviderConfig) {
    return {
      id: p.id, name: p.name,
      base_url: p.base_url,
      base_url_openai: p.base_url_openai || "",
      base_url_anthropic: p.base_url_anthropic || "",
      api_format: p.api_format || "",
      api_key: p.api_key, model: p.model,
      temperature: p.temperature, max_tokens: p.max_tokens, timeout_secs: p.timeout_secs,
    };
  }

  /* ---- Claude Code ---- */

  const handleWriteClaude = async () => {
    const provider = providers.find((p) => p.id === bindings["claude-code"]);
    if (!provider) return;
    setWritingClaude(true);
    try {
      const result = await invoke<string>("apply_claude_provider", { provider: buildProviderPayload(provider) });
      setClaudeWritten(true);
      addToastRef.current(result || "Claude Code 配置已写入", "success");
    } catch (err) {
      addToastRef.current("写入 Claude Code 配置失败: " + String(err), "error");
    } finally {
      setWritingClaude(false);
    }
  };

  const handleRestartClaude = async () => {
    setRestartingClaude(true);
    try {
      const result = await invoke<string>("restart_claude_code_cmd");
      addToastRef.current(result || "Claude Code 已重启", "success");
      setClaudeWritten(false);
    } catch (err) {
      addToastRef.current("重启 Claude Code 失败: " + String(err), "error");
    } finally {
      setRestartingClaude(false);
    }
  };

  const handleRestoreClaude = async () => {
    setRestoringClaude(true);
    try {
      const result = await invoke<string>("clear_claude_provider");
      addToastRef.current(result || "Claude Code 配置已恢复", "success");
      setClaudeWritten(false);
    } catch (err) {
      addToastRef.current("恢复 Claude Code 配置失败: " + String(err), "error");
    } finally {
      setRestoringClaude(false);
    }
  };

  /* ---- Codex ---- */

  const handleWriteCodex = async () => {
    const provider = providers.find((p) => p.id === bindings["codex"]);
    if (!provider) return;
    setWritingCodex(true);
    try {
      const result = await invoke<string>("apply_codex_provider", { provider: buildProviderPayload(provider) });
      setCodexWritten(true);
      addToastRef.current(result || "Codex 配置已写入", "success");
    } catch (err) {
      addToastRef.current("写入 Codex 配置失败: " + String(err), "error");
    } finally {
      setWritingCodex(false);
    }
  };

  const handleRestartCodex = async () => {
    setRestartingCodex(true);
    try {
      const result = await invoke<string>("restart_codex_cmd");
      addToastRef.current(result || "Codex 已重启", "success");
      setCodexWritten(false);
    } catch (err) {
      addToastRef.current("重启 Codex 失败: " + String(err), "error");
    } finally {
      setRestartingCodex(false);
    }
  };

  const handleRestoreCodex = async () => {
    setRestoringCodex(true);
    try {
      const result = await invoke<string>("restore_codex_original");
      addToastRef.current(result || "Codex 已恢复为原始 OpenAI 配置", "success");
      setCodexWritten(false);
    } catch (err) {
      addToastRef.current("恢复 Codex 配置失败: " + String(err), "error");
    } finally {
      setRestoringCodex(false);
    }
  };

  /* ---- Hermes ---- */

  const handleWriteHermes = async () => {
    if (!hermesProfile) return;
    const provider = providers.find((p) => p.id === bindings["hermes-" + hermesProfile]);
    if (!provider) return;
    setWritingHermes(true);
    try {
      const result = await invoke<string>("apply_hermes_provider", {
        profileName: hermesProfile,
        provider: buildProviderPayload(provider),
      });
      setHermesWritten(true);
      addToastRef.current(result || `Hermes profile "${hermesProfile}" 配置已写入`, "success");
    } catch (err) {
      addToastRef.current("写入 Hermes 配置失败: " + String(err), "error");
    } finally {
      setWritingHermes(false);
    }
  };

  const handleRestartHermes = async () => {
    setRestartingHermes(true);
    try {
      const result = await invoke<string>("restart_hermes_cmd");
      addToastRef.current(result || "Hermes 已重启", "success");
      setHermesWritten(false);
    } catch (err) {
      addToastRef.current("重启 Hermes 失败: " + String(err), "error");
    } finally {
      setRestartingHermes(false);
    }
  };

  const handleRestoreHermes = async () => {
    if (!hermesProfile) return;
    setWritingHermes(true);
    try {
      const result = await invoke<string>("clear_hermes_provider", { profileName: hermesProfile });
      addToastRef.current(result || `Hermes profile "${hermesProfile}" 配置已清除`, "success");
      setHermesWritten(false);
    } catch (err) {
      addToastRef.current("清除 Hermes 配置失败: " + String(err), "error");
    } finally {
      setWritingHermes(false);
    }
  };

  /* ---- computed ---- */

  const claudeBinding = bindings["claude-code"];
  const claudeProvider = claudeBinding ? providers.find((p) => p.id === claudeBinding) : null;
  const claudeUnavailable = claudeProvider !== null && claudeProvider.base_url_anthropic.trim().length === 0;

  const codexBinding = bindings["codex"];
  const codexProvider = codexBinding ? providers.find((p) => p.id === codexBinding) : null;

  const hermesTools = tools.filter((t) => t.id.startsWith("hermes-"));
  const hermesProfileNames = hermesTools.map((t) => t.id.slice("hermes-".length));
  const hermesBoundProfile = hermesTools.find((t) => bindings[t.id]);
  const hermesBoundProviderId = hermesBoundProfile ? bindings[hermesBoundProfile.id] : "";
  const hermesBoundProvider = providers.find((p) => p.id === hermesBoundProviderId);

  /* ---- render ---- */

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 24px" }}>
        <Spinner size={24} />
      </div>
    );
  }

  if (providers.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--muted-foreground)" }}>
        <p style={{ fontSize: "14px", margin: 0 }}>{stableT("llmProviders.bindings.noProviders")}</p>
      </div>
    );
  }

  const renderProviderLabel = (providerId: string, toolId: string) => {
    const provider = providers.find((p) => p.id === providerId);
    if (!provider) return null;
    const requiresAnthropic = toolId === "claude-code";
    const isUnavailable = requiresAnthropic && provider.base_url_anthropic.trim().length === 0;
    return (
      <ProviderInfo provider={provider} toolId={toolId} isUnavailable={isUnavailable} />
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ fontSize: "13px", color: "var(--muted-foreground)", lineHeight: "1.5" }}>
        {stableT("llmProviders.bindings.description")}
      </div>

      {/* ---- tool rows ---- */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {tools.map((tool) => {
          const toolId = tool.id;
          const toolName = tool.name;
          const isHermes = toolId.startsWith("hermes-");
          const toolColor = isHermes ? "#f59e0b" : (TOOL_COLORS[toolId] ?? "#6b7280");
          const currentBinding = bindings[toolId] ?? "";
          const requiresAnthropic = toolId === "claude-code";
          const currentProvider = currentBinding ? providers.find((p) => p.id === currentBinding) : null;
          const isUnavailable = requiresAnthropic && currentProvider !== null && currentProvider.base_url_anthropic.trim().length === 0;

          return (
            <div
              key={toolId}
              style={{
                borderRadius: "8px",
                border: isUnavailable ? "1px solid #d97757" : "1px solid var(--border)",
                backgroundColor: "var(--background)",
                padding: "14px 16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
                opacity: isUnavailable ? 0.8 : 1,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1, minWidth: 0 }}>
                <div style={{
                  width: "36px", height: "36px", borderRadius: "50%",
                  backgroundColor: toolColor, color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 700, fontSize: "14px", flexShrink: 0,
                }}>
                  {toolName.charAt(0).toUpperCase()}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: "14px", color: "var(--foreground)" }}>
                    {toolName}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "3px", overflow: "hidden" }}>
                    {isUnavailable && (
                      <span style={{
                        fontSize: "10px", fontWeight: 600, padding: "1px 6px",
                        borderRadius: "9999px", lineHeight: "16px", flexShrink: 0,
                        backgroundColor: "color-mix(in srgb, #d97757 20%, transparent)",
                        color: "#d97757", border: "1px solid #d97757",
                      }}>不可用</span>
                    )}
                    {currentBinding ? renderProviderLabel(currentBinding, toolId) : (
                      <span style={{ fontSize: "12px", color: "var(--muted-foreground)" }}>—</span>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ flexShrink: 0, minWidth: "180px" }}>
                {isUnavailable ? (
                  <select disabled value={currentBinding} style={{
                    width: "100%", padding: "6px 28px 6px 10px", borderRadius: "6px",
                    border: "1px solid #d97757",
                    backgroundColor: "color-mix(in srgb, #d97757 8%, var(--background))",
                    color: "#d97757", fontSize: "13px", appearance: "none",
                    cursor: "not-allowed", outline: "none",
                  }}>
                    <option value="">不可用</option>
                  </select>
                ) : (
                  <select value={currentBinding} onChange={(e) => handleBindingChange(toolId, e.target.value)} style={{
                    width: "100%", padding: "6px 28px 6px 10px", borderRadius: "6px",
                    border: "1px solid var(--input)", backgroundColor: "var(--background)",
                    color: "var(--foreground)", fontSize: "13px", appearance: "none",
                    backgroundImage: 'url(\'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="%23737373" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>\')',
                    backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center",
                    cursor: "pointer", outline: "none",
                  }}>
                    <option value="">—</option>
                    {providers.map((p) => {
                      const unavailable = requiresAnthropic && p.base_url_anthropic.trim().length === 0;
                      return (
                        <option key={p.id} value={p.id} disabled={unavailable} style={unavailable ? { color: "#999" } : undefined}>
                          {unavailable ? "✗ " : ""}{p.name} · {p.model || p.id}
                        </option>
                      );
                    })}
                  </select>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ---- Claude Code ---- */}
      {claudeBinding && claudeProvider && (
        <ConfigSection
          icon="C" iconBg={TOOL_COLORS["claude-code"]}
          title="Claude Code 配置" badge={claudeProvider.name}
          description="将当前选中的大模型配置写入 Claude Code 的 settings.json，修改后需要重启 Claude Code 才能生效。"
          accent="#d4a574"
          onWrite={handleWriteClaude} onRestart={handleRestartClaude} onRestore={handleRestoreClaude}
          writeLabel="写入 Claude Code 配置" restartLabel="重启 Claude Code" restoreLabel="恢复原始配置"
          writing={writingClaude} restarting={restartingClaude} restoring={restoringClaude}
          configWritten={claudeWritten} writeDisabled={claudeUnavailable}
          unavailable={claudeUnavailable} unavailableMsg="当前供应商缺少 Anthropic URL，无法写入 Claude Code 配置"
        />
      )}

      {/* ---- Codex ---- */}
      {codexBinding && codexProvider && (
        <ConfigSection
          icon="C" iconBg={TOOL_COLORS["codex"]}
          title="Codex 配置" badge={codexProvider.name}
          description="将当前选中的大模型配置写入 Codex 的 config.toml + auth.json，修改后需要重启 Codex 才能生效。"
          accent="#6b7280"
          onWrite={handleWriteCodex} onRestart={handleRestartCodex} onRestore={handleRestoreCodex}
          writeLabel="写入 Codex 配置" restartLabel="重启 Codex" restoreLabel="恢复 OpenAI 官方配置"
          writing={writingCodex} restarting={restartingCodex} restoring={restoringCodex}
          configWritten={codexWritten} writeDisabled={false}
        />
      )}

      {/* ---- Hermes ---- */}
      {hermesBoundProvider && hermesProfileNames.length > 0 && (
        <ConfigSection
          icon="H" iconBg={TOOL_COLORS["hermes"]}
          title="Hermes 配置" badge={hermesBoundProvider.name}
          description="将当前选中的大模型配置写入 Hermes profile 的 settings.json，修改后需要重启 Hermes 才能生效。"
          accent="#f59e0b"
          onWrite={handleWriteHermes} onRestart={handleRestartHermes} onRestore={handleRestoreHermes}
          writeLabel="写入 Hermes 配置" restartLabel="重启 Hermes" restoreLabel="清除 Hermes 配置"
          writing={writingHermes} restarting={restartingHermes} restoring={false}
          configWritten={hermesWritten} writeDisabled={!hermesProfile}
          extra={
            hermesProfileNames.length > 0 ? (
              <div style={{ marginTop: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "12px", color: "var(--muted-foreground)", whiteSpace: "nowrap" }}>
                  配置 Profile:
                </span>
                <select
                  value={hermesProfile}
                  onChange={(e) => { setHermesProfile(e.target.value); setHermesWritten(false); }}
                  style={{
                    padding: "4px 10px", borderRadius: "4px", border: "1px solid var(--input)",
                    backgroundColor: "var(--background)", color: "var(--foreground)",
                    fontSize: "12px", minWidth: "140px",
                  }}
                >
                  <option value="">-- 选择 Profile --</option>
                  {hermesProfileNames.map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
              </div>
            ) : undefined
          }
        />
      )}

      {/* ---- Save ---- */}
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
