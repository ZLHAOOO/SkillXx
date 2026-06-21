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
  api_key: string;
  model: string;
  temperature?: number;
  max_tokens?: number;
  timeout_secs?: number;
}

const TOOL_IDS = ["claude-code", "codex", "gemini", "opencode", "openclaw", "hermes"] as const;

const TOOL_NAMES: Record<string, string> = {
  "claude-code": "Claude Code",
  "codex": "Codex CLI",
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

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [providerList, currentBindings] = await Promise.all([
        invoke<LlmProviderConfig[]>("get_llm_providers"),
        invoke<ToolBindings>("get_tool_bindings"),
      ]);
      setProviders(providerList);
      setBindings(currentBindings);
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
      return next;
    });
  };

  const getProviderLabel = (providerId: string): string => {
    const provider = providers.find((p) => p.id === providerId);
    if (!provider) return t("llmProviders.bindings.noProviders");
    return `${provider.name} \u2192 ${provider.model}`;
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
        {TOOL_IDS.map((toolId) => {
          const toolName = TOOL_NAMES[toolId] ?? toolId;
          const toolColor = TOOL_COLORS[toolId] ?? "#6b7280";
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

      {hasChanges && (
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            paddingTop: "4px",
          }}
        >
          <Button onClick={handleSave} variant="default" disabled={saving}>
            {saving ? t("llmProviders.bindings.saving") || t("common.saving") : t("llmProviders.bindings.save")}
          </Button>
        </div>
      )}
    </div>
  );
}
