// @ts-nocheck
import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "@/i18n";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/loading";
import { getToolIconUrl } from "@/assets/tools";

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

export interface ApplyModelInfo {
  id: string;
  name: string;
  base_url: string;
  base_url_anthropic: string;
  base_url_openai: string;
  api_key: string;
  model: string;
  protocol: string;
  relay_mode?: boolean;
  responses_passthrough?: boolean;
  one_m_context?: boolean;
}

export interface ToolInfo {
  id: string;
  name: string;
  detected: boolean;
}

type ToolBindings = Record<string, string>;

const TOOL_IDS = ["claude-code", "codex", "gemini", "hermes"] as const;

const TOOL_COLORS: Record<string, string> = {
  "claude-code": "#d4a574",
  "codex": "#6b7280",
  "gemini": "#4285f4",
  "hermes": "#f59e0b",
};

/* ================================================================
   Checkbox – matches project's Toggle style
   ================================================================ */
function Checkbox({ checked, onChange, disabled, children }: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label
      onClick={(e) => {
        if (!disabled) {
          e.preventDefault();
          onChange(!checked);
        }
      }}
      className={`flex items-center gap-2 select-none ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
    >
      <div
        className={`w-4 h-4 border rounded-[3px] flex items-center justify-center transition-all flex-shrink-0 ${
          checked
            ? "border-[var(--primary)] bg-[var(--primary)]"
            : "border-[var(--input)] bg-transparent hover:border-[var(--primary)] hover:bg-[var(--primary)]/10"
        } ${disabled ? "opacity-40" : ""}`}
      >
        {checked && (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="text-white">
            <path d="M2 5L4 7L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <span className={`text-xs transition-colors ${checked ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]"}`}>
        {children}
      </span>
    </label>
  );
}

/* ================================================================
   ToolBindings
   ================================================================ */
export function ToolBindings() {
  const { t } = useTranslation();
  const toast = useToast();
  const addToastRef = useRef(toast.addToast);
  addToastRef.current = toast.addToast;

  const [providers, setProviders] = useState<LlmProviderConfig[]>([]);
  const [bindings, setBindings] = useState<ToolBindings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Per-tool operation state
  const [writing, setWriting] = useState<Record<string, boolean>>({});
  const [written, setWritten] = useState<Record<string, boolean>>({});
  const [restarting, setRestarting] = useState<Record<string, boolean>>({});
  const [restoring, setRestoring] = useState<Record<string, boolean>>({});

  const [tools, setTools] = useState<ToolInfo[]>([]);

  // ---- Selection state (EchoBird pattern) ----
  const [selectedTool, setSelectedTool] = useState<string | null>(null);

  // ---- Bottom bar checkboxes ----
  const readBool = (key: string, fallback: boolean): boolean => {
    try {
      const v = localStorage.getItem(key);
      return v === null ? fallback : v === "true";
    } catch {
      return fallback;
    }
  };
  const writeBool = (key: string, v: boolean) => {
    try {
      localStorage.setItem(key, String(v));
    } catch {
      // private mode
    }
  };

  const [modifyConfig, setModifyConfig] = useState<boolean>(() =>
    readBool("skillx_bottom_modify_config", true)
  );
  const [launchAfterApply, setLaunchAfterApply] = useState<boolean>(() =>
    readBool("skillx_bottom_launch_after", true)
  );
  // Responses passthrough for Codex — NOT persisted.
  // Reset to provider default each time the Codex binding changes.
  // StepFun → true (passthrough), others → false (proxy).
  const [responsesPassthrough, setResponsesPassthrough] = useState<boolean>(false);
  const [currentCodexProviderId, setCurrentCodexProviderId] = useState<string>("");

  const getResponsesPassthroughDefault = useCallback((providerName: string): boolean => {
    const name = providerName.toLowerCase();
    return name.includes("step") || name.includes("阶跃");
  }, []);
  const [isLaunching, setIsLaunching] = useState(false);

  // ---- Data loading ----
  const loadData = useCallback(async () => {
    let cancelled = false;
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
      setTools(
        toolList
          .filter((tool) => TOOL_IDS.includes(tool.id as any) || tool.id.startsWith("hermes-"))
          // Detected tools first; undetected fall to the end. Keep original relative order otherwise.
          .sort((a, b) => Number(b.detected) - Number(a.detected))
      );
    } catch (err) {
      if (!cancelled) {
        addToastRef.current(t("llmProviders.bindings.loadFailed"), "error");
        console.error("Failed to load tool bindings:", err);
      }
    } finally {
      if (!cancelled) {
        setLoading(false);
      }
    }
  }, [t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Initialize Responses passthrough when Codex binding is present
  // (covers the case where page loads with existing Codex binding)
  useEffect(() => {
    if (selectedTool === "codex") {
      const binding = bindings["codex"];
      if (binding) {
        const provider = providers.find((p) => p.id === binding);
        if (provider && currentCodexProviderId !== provider.id) {
          const defaultPassthrough = getResponsesPassthroughDefault(provider.name);
          setResponsesPassthrough(defaultPassthrough);
          setCurrentCodexProviderId(provider.id);
        }
      }
    }
  }, [selectedTool, bindings, providers, currentCodexProviderId, getResponsesPassthroughDefault]);

  // ---- Binding change (auto-save to SkillX config) ----
  const handleBindingChange = (toolId: string, providerId: string) => {
    // Auto-select this tool so the bottom bar acts on it without an extra click
    setSelectedTool(toolId);

    setBindings((prev) => {
      const next = { ...prev, [toolId]: providerId };
      setHasChanges(true);
      setWritten((w) => ({ ...w, [toolId]: false }));
      return next;
    });

    // When switching Codex binding, reset Responses passthrough to provider default
    if (toolId === "codex" && providerId) {
      const provider = providers.find((p) => p.id === providerId);
      if (provider) {
        const defaultPassthrough = getResponsesPassthroughDefault(provider.name);
        setResponsesPassthrough(defaultPassthrough);
        setCurrentCodexProviderId(provider.id);
      }
    }
  };

  // ---- Save bindings to SkillX config ----
  const handleSave = async () => {
    setSaving(true);
    try {
      await invoke("save_tool_bindings", { bindings });
      setHasChanges(false);
      addToastRef.current(t("llmProviders.bindings.saved"), "success");
    } catch (err) {
      addToastRef.current(t("llmProviders.bindings.saveFailed"), "error");
      console.error("Failed to save:", err);
    } finally {
      setSaving(false);
    }
  };

  // ---- Bottom bar: write config + launch ----
  const selectedToolBinding = selectedTool ? bindings[selectedTool] : "";
  const selectedHasBinding = !!selectedToolBinding;

  const handleBottomBarAction = async () => {
    if (!selectedTool || isLaunching) return;
    setIsLaunching(true);

    const toolBinding = bindings[selectedTool];
    const hasBinding = !!toolBinding;

    // Auto-save pending binding changes first
    if (hasChanges) {
      await handleSave();
    }

    let writeOk = true;

    try {
      // Step 1: Write config (if enabled and tool has a binding)
      if (modifyConfig && hasBinding) {
        setWriting((prev) => ({ ...prev, [selectedTool]: true }));
        try {
          const provider = providers.find((p) => p.id === toolBinding);
          if (!provider) {
            addToastRef.current("未找到对应的模型配置", "error");
            writeOk = false;
          } else {
            const result = await invoke<string>("apply_model_to_tool", {
              toolId: selectedTool,
              modelInfo: {
                id: provider.id,
                name: provider.name,
                base_url: provider.base_url,
                base_url_anthropic: provider.base_url_anthropic || "",
                base_url_openai: provider.base_url_openai || "",
                api_key: provider.api_key,
                model: provider.model,
                protocol: selectedTool === "claude-code" ? "anthropic" : "openai",
                responses_passthrough: selectedTool === "codex" ? responsesPassthrough : false,
              },
            });
            setWritten((prev) => ({ ...prev, [selectedTool]: true }));
            const tool = tools.find((t) => t.id === selectedTool);
            addToastRef.current(result || `${tool?.name || selectedTool} 配置已写入`, "success");
          }
        } catch (err) {
          addToastRef.current(`写入 ${selectedTool} 配置失败: ${String(err)}`, "error");
          writeOk = false;
        } finally {
          setWriting((prev) => ({ ...prev, [selectedTool]: false }));
        }
      }

      // Step 2: Launch tool (if enabled)
      if (launchAfterApply && writeOk) {
        try {
          let restartResult: string;
          if (selectedTool === "claude-code") {
            restartResult = await invoke<string>("restart_claude_code_cmd");
          } else if (selectedTool.startsWith("hermes-")) {
            restartResult = await invoke<string>("restart_hermes_cmd");
          } else if (selectedTool === "codex") {
            restartResult = await invoke<string>("restart_codex_cmd");
          } else if (selectedTool === "gemini") {
            addToastRef.current("Gemini CLI 配置已写入，下次启动时自动加载", "success");
            return;
          } else {
            return;
          }
          addToastRef.current(restartResult || `${selectedTool} 已重启`, "success");
        } catch (err) {
          addToastRef.current(`重启 ${selectedTool} 失败: ${String(err)}`, "error");
        }
      }
    } finally {
      setIsLaunching(false);
    }
  };

  // ---- Tool selection ----
  const handleSelectTool = (toolId: string) => {
    setSelectedTool((prev) => (prev === toolId ? null : toolId));
  };

  // ---- Restart / Restore handlers ----
  const handleRestartClaude = async () => {
    setRestarting((prev) => ({ ...prev, ["claude-code"]: true }));
    try {
      const result = await invoke<string>("restart_claude_code_cmd");
      addToastRef.current(result || "Claude Code 已重启", "success");
      setWritten((prev) => ({ ...prev, ["claude-code"]: false }));
    } catch (err) {
      addToastRef.current("重启 Claude Code 失败: " + String(err), "error");
    } finally {
      setRestarting((prev) => ({ ...prev, ["claude-code"]: false }));
    }
  };

  const handleRestartCodex = async () => {
    setRestarting((prev) => ({ ...prev, ["codex"]: true }));
    try {
      const result = await invoke<string>("restart_codex_cmd");
      addToastRef.current(result || "Codex 已重启", "success");
      setWritten((prev) => ({ ...prev, ["codex"]: false }));
    } catch (err) {
      addToastRef.current("重启 Codex 失败: " + String(err), "error");
    } finally {
      setRestarting((prev) => ({ ...prev, ["codex"]: false }));
    }
  };

  const handleRestartHermes = async (toolId: string) => {
    setRestarting((prev) => ({ ...prev, [toolId]: true }));
    try {
      const result = await invoke<string>("restart_hermes_cmd");
      addToastRef.current(result || "Hermes 已重启", "success");
      setWritten((prev) => ({ ...prev, [toolId]: false }));
    } catch (err) {
      addToastRef.current("重启 Hermes 失败: " + String(err), "error");
    } finally {
      setRestarting((prev) => ({ ...prev, [toolId]: false }));
    }
  };

  const handleRestoreClaude = async () => {
    setRestoring((prev) => ({ ...prev, ["claude-code"]: true }));
    try {
      const result = await invoke<string>("clear_claude_provider");
      addToastRef.current(result || "Claude Code 配置已恢复", "success");
      setWritten((prev) => ({ ...prev, ["claude-code"]: false }));
    } catch (err) {
      addToastRef.current("恢复 Claude Code 配置失败: " + String(err), "error");
    } finally {
      setRestoring((prev) => ({ ...prev, ["claude-code"]: false }));
    }
  };

  const handleRestoreCodex = async () => {
    setRestoring((prev) => ({ ...prev, ["codex"]: true }));
    try {
      const result = await invoke<string>("restore_codex_original");
      addToastRef.current(result || "Codex 已恢复为原始 OpenAI 配置", "success");
      setWritten((prev) => ({ ...prev, ["codex"]: false }));
    } catch (err) {
      addToastRef.current("恢复 Codex 配置失败: " + String(err), "error");
    } finally {
      setRestoring((prev) => ({ ...prev, ["codex"]: false }));
    }
  };

  const handleRestoreHermes = async (toolId: string) => {
    const profileName = toolId.slice("hermes-".length);
    setRestoring((prev) => ({ ...prev, [toolId]: true }));
    try {
      const result = await invoke<string>("clear_hermes_provider", { profileName });
      addToastRef.current(result || `Hermes profile "${profileName}" 配置已清除`, "success");
      setWritten((prev) => ({ ...prev, [toolId]: false }));
    } catch (err) {
      addToastRef.current(`清除 Hermes 配置失败: ${String(err)}`, "error");
    } finally {
      setRestoring((prev) => ({ ...prev, [toolId]: false }));
    }
  };

  const handleRestoreGemini = async () => {
    setRestoring((prev) => ({ ...prev, ["gemini"]: true }));
    try {
      const result = await invoke<string>("clear_gemini_provider");
      addToastRef.current(result || "Gemini 配置已恢复", "success");
      setWritten((prev) => ({ ...prev, ["gemini"]: false }));
    } catch (err) {
      addToastRef.current("恢复 Gemini 配置失败: " + String(err), "error");
    } finally {
      setRestoring((prev) => ({ ...prev, ["gemini"]: false }));
    }
  };

  // ---- Bottom bar button logic ----
  const willWrite = modifyConfig && selectedHasBinding;
  const willLaunch = launchAfterApply;
  const buttonAction = willWrite && willLaunch ? "write_launch"
    : willWrite ? "write"
    : willLaunch ? "launch"
    : "none";
  const bottomDisabled = !selectedTool || buttonAction === "none" || isLaunching;

  const getButtonText = () => {
    if (isLaunching) return "执行中...";
    if (!selectedTool) return "请先选择工具";
    if (buttonAction === "write_launch") return "写入并启动";
    if (buttonAction === "write") return "写入配置";
    if (buttonAction === "launch") return "启动应用";
    return "启动应用";
  };

  // ---- Render ----
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
        <p style={{ fontSize: "14px", margin: 0 }}>{t("llmProviders.bindings.noProviders")}</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px", minHeight: "100%" }}>
      <div style={{ fontSize: "13px", color: "var(--muted-foreground)", lineHeight: "1.5" }}>
        {t("llmProviders.bindings.description")}
      </div>

      {/* ---- Tool cards grid (3-col) ---- */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
        {tools.map((tool) => {
          const toolId = tool.id;
          const toolName = tool.name;
          const isHermes = toolId.startsWith("hermes-");
          const toolColor = isHermes ? "#f59e0b" : (TOOL_COLORS[toolId] ?? "#6b7280");
          const isSelected = selectedTool === toolId;
          const currentBinding = bindings[toolId] ?? "";
          const currentProvider = currentBinding ? providers.find((p) => p.id === currentBinding) : null;

          return (
            <div key={toolId} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {/* Card: icon | name+dropdown */}
              <div
                onClick={() => handleSelectTool(toolId)}
                style={{
                  borderRadius: "8px",
                  border: isSelected ? "1px solid var(--primary)" : "1px solid var(--border)",
                  backgroundColor: isSelected
                    ? "color-mix(in srgb, var(--primary) 6%, var(--background))"
                    : "var(--background)",
                  padding: "12px",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  cursor: "pointer",
                  transition: "border-color 0.15s, background-color 0.15s",
                }}
              >
                {/* Icon */}
                <div style={{ flexShrink: 0 }}>
                  {(() => {
                    const iconUrl = getToolIconUrl(toolId) || (isHermes ? getToolIconUrl("hermes") : null);
                    if (iconUrl) {
                      return (
                        <img
                          src={iconUrl}
                          alt={toolName}
                          style={{
                            width: "36px", height: "36px", borderRadius: "8px",
                            objectFit: "contain",
                          }}
                        />
                      );
                    }
                    return (
                      <div style={{
                        width: "36px", height: "36px", borderRadius: "50%",
                        backgroundColor: toolColor, color: "#fff",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontWeight: 700, fontSize: "15px",
                      }}>
                        {toolName.charAt(0).toUpperCase()}
                      </div>
                    );
                  })()}
                </div>

                {/* Right column: name + dropdown */}
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "5px" }}>
                  {/* Name row */}
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontWeight: 700, fontSize: "15px", color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {toolName}
                    </span>
                    {currentBinding && (
                      <span style={{
                        fontSize: "10px", fontWeight: 500, padding: "1px 6px",
                        borderRadius: "9999px", lineHeight: "15px", flexShrink: 0,
                        ...(toolId === "claude-code"
                          ? { backgroundColor: "color-mix(in srgb, #d97757 15%, transparent)", color: "#d97757" }
                          : { backgroundColor: "color-mix(in srgb, #10a37f 15%, transparent)", color: "#10a37f" }),
                      }}>
                        {toolId === "claude-code" ? "Anthropic" : "OpenAI"}
                      </span>
                    )}
                  </div>
                  {/* Dropdown */}
                  <div onClick={(e) => e.stopPropagation()}>
                    <select value={currentBinding} onChange={(e) => handleBindingChange(toolId, e.target.value)} style={{
                      width: "100%", padding: "4px 24px 4px 8px", borderRadius: "5px",
                      border: "1px solid var(--input)", backgroundColor: "var(--background)",
                      color: "var(--foreground)", fontSize: "12px", appearance: "none",
                      backgroundImage: 'url(\'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="%23737373" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>\')',
                      backgroundRepeat: "no-repeat", backgroundPosition: "right 6px center",
                      cursor: "pointer", outline: "none",
                    }}>
                      <option value="">— 选择模型 —</option>
                      {providers.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} · {p.model || p.id}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Config card (expand when selected) */}
              {isSelected && currentBinding && currentProvider && (
                <div style={{
                  marginTop: "2px", padding: "10px 14px", borderRadius: "8px",
                  border: "1px solid var(--border)", backgroundColor: "var(--secondary)",
                }}>
                  <div style={{ fontSize: "11px", color: "var(--muted-foreground)", lineHeight: "1.5", marginBottom: "6px" }}>
                    选中后通过底部操作栏写入配置并启动。
                    <br />
                    <span style={{ opacity: 0.7 }}>也可点击「恢复原始配置」快速清除该工具的模型配置。</span>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <Button
                      onClick={() => {
                        if (toolId === "claude-code") handleRestoreClaude();
                        else if (toolId === "codex") handleRestoreCodex();
                        else if (toolId.startsWith("hermes-")) handleRestoreHermes(toolId);
                        else if (toolId === "gemini") handleRestoreGemini();
                      }}
                      disabled={restoring[toolId] || restoring["claude-code"] || restoring["codex"] || restoring["gemini"]}
                      variant="outline"
                      size="sm"
                    >
                      恢复原始配置
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ---- Bottom bar (EchoBird pattern) ---- */}
      <div style={{
        flexShrink: 0,
        position: "sticky",
        bottom: 0,
        marginTop: "auto",
        borderTop: "1px solid var(--border)",
        padding: "12px 16px 8px",
        backgroundColor: "var(--background)",
        zIndex: 10,
        minHeight: "56px",
        height: "56px",
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        overflow: "hidden",
      }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
          width: "100%",
          flexWrap: "nowrap",
        }}>
          {/* Checkboxes */}
          <div style={{ display: "flex", gap: "16px", alignItems: "center", flexShrink: 1, minWidth: 0 }}>
            <Checkbox
              checked={modifyConfig}
              onChange={(v) => {
                setModifyConfig(v);
                writeBool("skillx_bottom_modify_config", v);
              }}
              disabled={!selectedTool || !selectedHasBinding}
            >
              修改模型配置
            </Checkbox>
            <Checkbox
              checked={launchAfterApply}
              onChange={(v) => {
                setLaunchAfterApply(v);
                writeBool("skillx_bottom_launch_after", v);
              }}
              disabled={!selectedTool}
            >
              启动应用
            </Checkbox>
            {selectedTool === "codex" && currentCodexProviderId && (
              <Checkbox
                checked={responsesPassthrough}
                onChange={(v) => {
                  setResponsesPassthrough(v);
                }}
                disabled={!selectedTool}
              >
                Responses 直连
              </Checkbox>
            )}
          </div>

          {/* Action button */}
          <button
            onClick={handleBottomBarAction}
            disabled={bottomDisabled}
            style={{
              height: "36px",
              padding: "0 24px",
              fontSize: "14px",
              fontWeight: 600,
              borderRadius: "8px",
              border: "none",
              cursor: bottomDisabled ? "not-allowed" : "pointer",
              transition: "all 0.15s",
              fontFamily: "inherit",
              whiteSpace: "nowrap",
              flexShrink: 0,
              ...(bottomDisabled
                ? {
                    backgroundColor: "var(--muted)",
                    color: "var(--muted-foreground)",
                  }
                : {
                    backgroundColor: "var(--primary)",
                    color: "var(--primary-foreground)",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                  }
              ),
            }}
          >
            {getButtonText()}
          </button>
        </div>
      </div>
    </div>
  );
}
