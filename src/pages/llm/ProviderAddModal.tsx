import { useState, useEffect, useRef } from "react";
import { X, ExternalLink } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "@/i18n";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";

interface ProviderDirectoryEntry {
  id: string;
  name: string;
  base_url_openai: string;
  base_url_anthropic: string;
  model: string;
  website_url: string;
  icon: string;
}

interface LlmProviderConfig {
  id: string;
  name: string;
  base_url: string;
  base_url_openai: string;
  base_url_anthropic: string;
  api_key: string;
  model: string;
  models: string[];
  website_url?: string | null;
  temperature?: number | null;
  max_tokens?: number | null;
  timeout_secs?: number | null;
  api_format?: string;
}

interface ProviderFormData {
  name: string;
  base_url: string;
  base_url_openai: string;
  base_url_anthropic: string;
  api_key: string;
  model: string;
  models: string[];
  api_format: string;
  website_url: string;
  temperature: string;
  max_tokens: string;
  timeout_secs: string;
}

interface ModelInfo {
  id: string;
  owned_by: string | null;
}

const emptyForm: ProviderFormData = {
  name: "",
  base_url: "",
  base_url_openai: "",
  base_url_anthropic: "",
  api_key: "",
  model: "",
  models: [],
  api_format: "openai",
  website_url: "",
  temperature: "",
  max_tokens: "",
  timeout_secs: "",
};

export function ProviderAddModal({
  entry,
  provider,
  onClose,
  onSaved,
}: {
  entry?: ProviderDirectoryEntry | null;
  provider?: LlmProviderConfig;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t, language } = useTranslation();
  const { addToast, removeToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ProviderFormData>(emptyForm);

  const isEdit = !!provider;

  // Fetched models dropdown
  const [fetchedModels, setFetchedModels] = useState<ModelInfo[]>([]);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const modelInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Pre-fill form when entry or provider changes
  const sourceId = provider?.id ?? entry?.id ?? null;

  useEffect(() => {
    if (!sourceId) return;

    if (isEdit && provider) {
      const models = provider.models && provider.models.length > 0 ? provider.models : [provider.model];
      setForm({
        name: provider.name,
        base_url: provider.base_url,
        base_url_openai: provider.base_url_openai || "",
        base_url_anthropic: provider.base_url_anthropic || "",
        api_key: provider.api_key,
        model: provider.model,
        models: models,
        api_format: provider.api_format || "openai",
        website_url: provider.website_url || "",
        temperature: provider.temperature != null ? String(provider.temperature) : "",
        max_tokens: provider.max_tokens != null ? String(provider.max_tokens) : "",
        timeout_secs: provider.timeout_secs != null ? String(provider.timeout_secs) : "",
      });
    } else if (entry) {
      if (entry.id === "__custom__") {
        setForm({ ...emptyForm, api_format: "openai" });
      } else {
        const apiFormat = entry.base_url_openai ? "openai" : "anthropic";
        const url = entry.base_url_openai || entry.base_url_anthropic;
        setForm({
          name: entry.name,
          base_url: url,
          base_url_openai: entry.base_url_openai,
          base_url_anthropic: entry.base_url_anthropic,
          api_key: "",
          model: entry.model,
          models: [entry.model],
          api_format: apiFormat,
          website_url: entry.website_url,
          temperature: "",
          max_tokens: "",
          timeout_secs: "",
        });
      }
    }
    setFetchedModels([]);
    setShowModelDropdown(false);
  }, [sourceId]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        modelInputRef.current &&
        !modelInputRef.current.contains(e.target as Node)
      ) {
        setShowModelDropdown(false);
      }
    };
    if (showModelDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showModelDropdown]);

  if (!sourceId) return null;

  const isCustom = !isEdit && entry?.id === "__custom__";
  const isAnthropicPreset = !isEdit && entry?.id === "anthropic";
  const isOpenaiPreset = !isEdit && entry?.id === "openai";

  // 编辑模式始终显示两个按钮；添加模式下 Anthropic/OpenAI 供应商只显示对应按钮
  const showOpenaiBtn = isEdit || isCustom || !isAnthropicPreset;
  const showAnthropicBtn = isEdit || isCustom || !isOpenaiPreset;

  // Platform toggle is no longer needed — both URLs are shown as separate inputs.
  // This function is kept as a no-op for backward compatibility.

  const handleFetchModels = async () => {
    if (!form.base_url.trim() || !form.api_key.trim()) {
      addToast(t("llmProviders.fetchModelsNeedConfig"), "error");
      return;
    }

    setIsFetching(true);
    setFetchedModels([]);
    setShowModelDropdown(false);

    try {
      // Use the URL matching the current api_format
      const fetchUrl = form.api_format === "anthropic"
        ? (form.base_url_anthropic.trim() || form.base_url.trim())
        : (form.base_url_openai.trim() || form.base_url.trim());
      const result = await invoke<ModelInfo[]>("fetch_models_for_config", {
        base_url: fetchUrl,
        api_key: form.api_key.trim(),
        is_full_url: false,
        models_url: null,
      });
      setFetchedModels(result);
      if (result.length > 0) {
        setShowModelDropdown(true);
      } else {
        addToast(t("llmProviders.noModelsFound"), "error");
      }
    } catch (err) {
      const errMsg = String(err);
      if (errMsg.includes("401") || errMsg.includes("403")) {
        addToast(t("llmProviders.fetchModelsAuthFailed"), "error");
      } else if (errMsg.includes("timeout")) {
        addToast(t("llmProviders.fetchModelsTimeout"), "error");
      } else if (errMsg.includes("All candidates failed")) {
        addToast(t("llmProviders.fetchModelsEndpointNotFound"), "error");
      } else {
        addToast(t("llmProviders.fetchModelsFailed"), "error");
      }
      console.error("Fetch models failed:", err);
    } finally {
      setIsFetching(false);
    }
  };

  const handleSelectModel = (modelId: string) => {
    setForm({ ...form, model: modelId });
    setShowModelDropdown(false);
  };

  const handleOpenApiKeyPage = () => {
    if (form.website_url) {
      window.open(form.website_url, "_blank");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.base_url.trim() || !form.api_key.trim() || !form.model.trim()) {
      return;
    }

    setSaving(true);
    const toastId = addToast(t("common.saving"), "info");
    try {
      const models = form.models.length > 0 ? form.models : [form.model.trim()];
      const temperature = form.temperature ? parseFloat(form.temperature) : null;
      const maxTokens = form.max_tokens ? parseInt(form.max_tokens, 10) : null;
      const timeoutSecs = form.timeout_secs ? parseInt(form.timeout_secs, 10) : null;

      if (isEdit && provider) {
        const payload: LlmProviderConfig = {
          id: provider.id,
          name: form.name.trim(),
          base_url: form.base_url.trim(),
          base_url_openai: form.base_url_openai.trim(),
          base_url_anthropic: form.base_url_anthropic.trim(),
          api_key: form.api_key.trim(),
          model: form.model.trim(),
          models: models,
          api_format: form.api_format,
          website_url: form.website_url.trim() || null,
          temperature,
          max_tokens: maxTokens,
          timeout_secs: timeoutSecs,
        };
        await invoke("save_llm_provider_multi", { provider: payload });
        addToast(t("llmProviders.saveSuccess"), "success");
      } else {
        const payload = {
          id: isCustom ? `custom_${Date.now()}` : `${entry!.id}_${Date.now()}`,
          name: form.name.trim(),
          base_url: form.base_url.trim(),
          base_url_openai: form.base_url_openai.trim(),
          base_url_anthropic: form.base_url_anthropic.trim(),
          api_key: form.api_key.trim(),
          model: form.model.trim(),
          models: models,
          api_format: form.api_format,
          website_url: form.website_url.trim() || null,
          temperature,
          max_tokens: maxTokens,
          timeout_secs: timeoutSecs,
        };
        await invoke("save_llm_provider_multi", { provider: payload });
        addToast(t("llmProviders.addSuccess").replace("{name}", form.name.trim()), "success");
      }

      removeToast(toastId);
      onSaved();
    } catch (err) {
      removeToast(toastId);
      addToast(t("llmProviders.saveFailed"), "error");
      console.error("Save provider failed:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "20px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: "var(--background)",
          border: "1px solid var(--border)",
          borderRadius: "12px",
          padding: "24px",
          width: "100%",
          maxWidth: "480px",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "20px",
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: "16px",
              fontWeight: 600,
              color: "var(--foreground)",
            }}
          >
            {isEdit
              ? t("llmProviders.editTitle")
              : isCustom
                ? "自定义模型"
                : `添加 ${entry!.name}`}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px",
              borderRadius: "6px",
              color: "var(--muted-foreground)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--muted)")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            <X style={{ width: "16px", height: "16px" }} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {/* Name */}
            <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "var(--foreground)",
                }}
              >
                {t("llmProviders.name")}
              </span>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={t("llmProviders.namePlaceholder")}
                required
                style={{
                  padding: "8px 10px",
                  borderRadius: "6px",
                  border: "1px solid var(--input)",
                  backgroundColor: "var(--background)",
                  color: "var(--foreground)",
                  fontSize: "13px",
                  outline: "none",
                }}
              />
            </label>

            {/* Website URL */}
            <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "var(--foreground)",
                  }}
                >
                  "官网链接"
                </span>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleOpenApiKeyPage}
                  disabled={!form.website_url}
                  style={{ whiteSpace: "nowrap", fontSize: "12px", padding: "2px 8px", height: "24px", lineHeight: "18px" }}
                >
                  <ExternalLink style={{ width: "13px", height: "13px", marginRight: "3px" }} />
                  {t("llmProviders.getApiKey")}
                </Button>
              </div>
              <input
                type="url"
                value={form.website_url}
                onChange={(e) => setForm({ ...form, website_url: e.target.value })}
                placeholder="https://example.com"
                style={{
                  padding: "8px 10px",
                  borderRadius: "6px",
                  border: "1px solid var(--input)",
                  backgroundColor: "var(--background)",
                  color: "var(--foreground)",
                  fontSize: "13px",
                  outline: "none",
                }}
              />
            </label>

            {/* Base URLs: OpenAI + Anthropic (side by side when both visible) */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {/* OpenAI Base URL */}
              {(showOpenaiBtn || isEdit) && (
                <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span
                    style={{
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "var(--foreground)",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <span style={{ color: "#f97316" }}>●</span>
                    OpenAI Base URL
                  </span>
                  <input
                    type="url"
                    value={form.base_url_openai}
                    onChange={(e) => setForm({ ...form, base_url_openai: e.target.value })}
                    placeholder="https://api.openai.com/v1"
                    style={{
                      padding: "8px 10px",
                      borderRadius: "6px",
                      border: "1px solid var(--input)",
                      backgroundColor: "var(--background)",
                      color: "var(--foreground)",
                      fontSize: "13px",
                      outline: "none",
                    }}
                  />
                </label>
              )}

              {/* Anthropic Base URL */}
              {(showAnthropicBtn || isEdit) && (
                <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span
                    style={{
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "var(--foreground)",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <span style={{ color: "#6366f1" }}>●</span>
                    Anthropic Base URL
                  </span>
                  <input
                    type="url"
                    value={form.base_url_anthropic}
                    onChange={(e) => setForm({ ...form, base_url_anthropic: e.target.value })}
                    placeholder="https://api.anthropic.com"
                    style={{
                      padding: "8px 10px",
                      borderRadius: "6px",
                      border: "1px solid var(--input)",
                      backgroundColor: "var(--background)",
                      color: "var(--foreground)",
                      fontSize: "13px",
                      outline: "none",
                    }}
                  />
                </label>
              )}

              {/* Fallback: show single base_url if neither platform button is shown */}
              {!showOpenaiBtn && !showAnthropicBtn && !isEdit && (
                <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span
                    style={{
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "var(--foreground)",
                    }}
                  >
                    {t("llmProviders.baseUrl")}
                  </span>
                  <input
                    type="url"
                    value={form.base_url}
                    onChange={(e) => setForm({ ...form, base_url: e.target.value })}
                    placeholder="https://api.openai.com/v1"
                    style={{
                      padding: "8px 10px",
                      borderRadius: "6px",
                      border: "1px solid var(--input)",
                      backgroundColor: "var(--background)",
                      color: "var(--foreground)",
                      fontSize: "13px",
                      outline: "none",
                    }}
                  />
                </label>
              )}
            </div>

            {/* API Key */}
            <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "var(--foreground)",
                }}
              >
                {t("llmProviders.apiKey")}
              </span>
              <input
                type="password"
                value={form.api_key}
                onChange={(e) => setForm({ ...form, api_key: e.target.value })}
                required
                style={{
                  padding: "8px 10px",
                  borderRadius: "6px",
                  border: "1px solid var(--input)",
                  backgroundColor: "var(--background)",
                  color: "var(--foreground)",
                  fontSize: "13px",
                  outline: "none",
                }}
              />
            </label>

            {/* Model with fetch + dropdown */}
            <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "var(--foreground)",
                }}
              >
                {language === "zh" ? "模型" : "Model"}
              </span>
              <div style={{ position: "relative" }}>
                <div style={{ display: "flex", gap: "8px" }}>
                  <div style={{ flex: 1, position: "relative" }}>
                    <input
                      ref={modelInputRef}
                      type="text"
                      value={form.model}
                      onChange={(e) => setForm({ ...form, model: e.target.value })}
                      onFocus={() => fetchedModels.length > 0 && setShowModelDropdown(true)}
                      required
                      placeholder={t("llmProviders.modelPlaceholder")}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "6px",
                        border: "1px solid var(--input)",
                        backgroundColor: "var(--background)",
                        color: "var(--foreground)",
                        fontSize: "13px",
                        outline: "none",
                      }}
                    />
                    {showModelDropdown && fetchedModels.length > 0 && (
                      <div
                        ref={dropdownRef}
                        style={{
                          position: "absolute",
                          top: "100%",
                          left: 0,
                          right: 0,
                          marginTop: "4px",
                          backgroundColor: "var(--background)",
                          border: "1px solid var(--border)",
                          borderRadius: "6px",
                          maxHeight: "200px",
                          overflowY: "auto",
                          zIndex: 10,
                          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                        }}
                      >
                        {fetchedModels.map((m) => (
                          <div
                            key={m.id}
                            onClick={() => handleSelectModel(m.id)}
                            style={{
                              padding: "8px 10px",
                              cursor: "pointer",
                              fontSize: "13px",
                              color: "var(--foreground)",
                              borderBottom: "1px solid var(--border)",
                              transition: "background-color 0.1s",
                            }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.backgroundColor = "var(--muted)")
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.backgroundColor = "transparent")
                            }
                          >
                            {m.id}
                            {m.owned_by && (
                              <span
                                style={{
                                  marginLeft: "8px",
                                  fontSize: "11px",
                                  color: "var(--muted-foreground)",
                                }}
                              >
                                {m.owned_by}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleFetchModels}
                    disabled={isFetching || !form.base_url.trim() || !form.api_key.trim()}
                    style={{ whiteSpace: "nowrap", fontSize: "13px" }}
                  >
                    {isFetching ? t("common.loading") : t("llmProviders.fetchModelsBtn")}
                  </Button>
                </div>
              </div>
            </label>

            {/* Temperature / Max Tokens / Timeout */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "10px",
              }}
            >
              <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "var(--foreground)",
                  }}
                >
                  {t("llmProviders.temperature")}
                </span>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="2"
                  value={form.temperature}
                  onChange={(e) => setForm({ ...form, temperature: e.target.value })}
                  placeholder="0.7"
                  style={{
                    padding: "8px 10px",
                    borderRadius: "6px",
                    border: "1px solid var(--input)",
                    backgroundColor: "var(--background)",
                    color: "var(--foreground)",
                    fontSize: "13px",
                    outline: "none",
                  }}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "var(--foreground)",
                  }}
                >
                  {t("llmProviders.maxTokens")}
                </span>
                <input
                  type="number"
                  min="1"
                  value={form.max_tokens}
                  onChange={(e) => setForm({ ...form, max_tokens: e.target.value })}
                  placeholder="4096"
                  style={{
                    padding: "8px 10px",
                    borderRadius: "6px",
                    border: "1px solid var(--input)",
                    backgroundColor: "var(--background)",
                    color: "var(--foreground)",
                    fontSize: "13px",
                    outline: "none",
                  }}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "var(--foreground)",
                  }}
                >
                  {t("llmProviders.timeout")}
                </span>
                <input
                  type="number"
                  min="1"
                  value={form.timeout_secs}
                  onChange={(e) => setForm({ ...form, timeout_secs: e.target.value })}
                  placeholder="120"
                  style={{
                    padding: "8px 10px",
                    borderRadius: "6px",
                    border: "1px solid var(--input)",
                    backgroundColor: "var(--background)",
                    color: "var(--foreground)",
                    fontSize: "13px",
                    outline: "none",
                  }}
                />
              </label>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "8px",
              marginTop: "20px",
            }}
          >
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" variant="default" disabled={saving}>
              {saving ? t("common.saving") : isEdit ? t("llmProviders.save") : "添加"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
