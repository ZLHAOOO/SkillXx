// @ts-nocheck
import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "@/i18n";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner, SkeletonList } from "@/components/ui/loading";
import { Plus, Download, X, ChevronDown, ExternalLink, Pencil } from "lucide-react";

export interface LlmProviderConfig {
  id: string;
  name: string;
  base_url: string;
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
  api_key: string;
  model: string;
  models: string[];
  website_url: string;
  api_format: "openai" | "anthropic";
  temperature: string;
  max_tokens: string;
  timeout_secs: string;
}

const emptyForm: ProviderFormData = {
  name: "",
  base_url: "",
  api_key: "",
  model: "",
  models: [],
  website_url: "",
  api_format: "openai",
  temperature: "",
  max_tokens: "",
  timeout_secs: "",
};

const PROVIDER_PRESETS: {
  id: string;
  name: string;
  base_url_openai: string;
  base_url_anthropic: string;
  model: string;
  website_url: string;
  color: string;
}[] = [
  {
    id: "anthropic",
    name: "Anthropic",
    base_url_openai: "",
    base_url_anthropic: "https://api.anthropic.com",
    model: "claude-sonnet-4-20250514",
    website_url: "https://www.anthropic.com/claude-code",
    color: "#d97757",
  },
  {
    id: "openai",
    name: "OpenAI",
    base_url_openai: "https://api.openai.com/v1",
    base_url_anthropic: "",
    model: "gpt-5.5",
    website_url: "https://platform.openai.com",
    color: "#10a37f",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    base_url_openai: "https://api.deepseek.com",
    base_url_anthropic: "https://api.deepseek.com/anthropic",
    model: "deepseek-v4-pro",
    website_url: "https://platform.deepseek.com",
    color: "#4d6bfe",
  },
  {
    id: "kimi",
    name: "Kimi",
    base_url_openai: "https://api.moonshot.cn/v1",
    base_url_anthropic: "https://api.moonshot.cn/anthropic",
    model: "kimi-k2.7-code",
    website_url: "https://platform.moonshot.cn",
    color: "#6366f1",
  },
  {
    id: "minimax",
    name: "MiniMax",
    base_url_openai: "https://api.minimaxi.com/v1",
    base_url_anthropic: "https://api.minimaxi.com/anthropic",
    model: "MiniMax-M2.7",
    website_url: "https://platform.minimaxi.com",
    color: "#ff6b6b",
  },
  {
    id: "glm",
    name: "GLM",
    base_url_openai: "https://open.bigmodel.cn/v4",
    base_url_anthropic: "https://open.bigmodel.cn/api/anthropic",
    model: "glm-5.1",
    website_url: "https://open.bigmodel.cn",
    color: "#0f62fe",
  },
  {
    id: "volcengine",
    name: "火山引擎",
    base_url_openai: "https://ark.cn-beijing.volces.com/api/coding/v3",
    base_url_anthropic: "https://ark.cn-beijing.volces.com/api/coding",
    model: "ark-code-latest",
    website_url: "https://www.volcengine.com",
    color: "#3370ff",
  },
  {
    id: "bailian",
    name: "阿里百炼",
    base_url_openai: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    base_url_anthropic: "https://dashscope.aliyuncs.com/apps/anthropic",
    model: "qwen3-coder-plus",
    website_url: "https://bailian.console.aliyun.com",
    color: "#ff6a00",
  },
  {
    id: "mimo",
    name: "MiMo",
    base_url_openai: "https://api.xiaomimimo.com/v1",
    base_url_anthropic: "https://api.xiaomimimo.com/anthropic",
    model: "mimo-v2.5-pro",
    website_url: "https://platform.xiaomimimo.com",
    color: "#ff6900",
  },
];

const PRESET_VISIBLE_COUNT = 10; // 2 rows × 5 cols

export function ProviderManager() {
  const { t } = useTranslation();
  const { addToast, removeToast } = useToast();

  const [providers, setProviders] = useState<LlmProviderConfig[]>([]);
  const [activeProviderId, setActiveProviderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showAllPresets, setShowAllPresets] = useState(false);
  const [form, setForm] = useState<ProviderFormData>(emptyForm);
  // Model fetching state
  const [fetchedModels, setFetchedModels] = useState<{ id: string; ownedBy: string | null }[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [editingWebsite, setEditingWebsite] = useState(false);
  const [tempWebsite, setTempWebsite] = useState("");

  const fetchProviders = useCallback(async () => {
    setLoading(true);
    try {
      const result = await invoke<LlmProviderConfig[]>("get_llm_providers");
      setProviders(result);
      const active = await invoke<LlmProviderConfig | null>("get_active_provider");
      setActiveProviderId(active?.id ?? null);
    } catch (err) {
      addToast(t("llmProviders.loadFailed"), "error");
      console.error("Failed to load providers:", err);
    } finally {
      setLoading(false);
    }
  }, [t, addToast]);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  const handleAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowAllPresets(false);
    setShowForm(true);
  };

  const applyPreset = (preset: typeof PROVIDER_PRESETS[0]) => {
    const url = preset.base_url_openai || preset.base_url_anthropic;
    const apiFormat = preset.base_url_openai ? "openai" : "anthropic";
    setForm({
      ...emptyForm,
      name: preset.name,
      base_url: url,
      model: preset.model,
      models: [preset.model],
      website_url: preset.website_url,
      api_format: apiFormat,
    });
    setEditingId(null);
    setShowForm(true);
  };

  const handleFormatToggle = (fmt: "openai" | "anthropic") => {
    if (form.api_format === fmt) return;

    // Try to find a matching preset URL for the new format
    const matchingPreset = PROVIDER_PRESETS.find(
      (p) =>
        form.base_url === p.base_url_openai ||
        form.base_url === p.base_url_anthropic,
    );

    let newUrl = form.base_url;
    if (matchingPreset) {
      if (fmt === "openai" && matchingPreset.base_url_openai) {
        newUrl = matchingPreset.base_url_openai;
      } else if (fmt === "anthropic" && matchingPreset.base_url_anthropic) {
        newUrl = matchingPreset.base_url_anthropic;
      }
    }

    setForm({ ...form, api_format: fmt, base_url: newUrl });
  };

  const handleFetchModels = async () => {
    if (!form.base_url.trim() || !form.api_key.trim()) {
      addToast(t("llmProviders.fetchModelsNeedConfig"), "error");
      return;
    }

    setIsFetchingModels(true);
    setFetchedModels([]);
    setShowModelDropdown(false);

    try {
      const result = await invoke<{ id: string; ownedBy: string | null }[]>(
        "fetch_models_for_config",
        {
          base_url: form.base_url.trim(),
          api_key: form.api_key.trim(),
          is_full_url: false,
          models_url: null,
        },
      );
      setFetchedModels(result);
      if (result.length > 0) {
        setShowModelDropdown(true);
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
      setIsFetchingModels(false);
    }
  };

  const handleSelectFetchedModel = (modelId: string) => {
    if (!form.models.includes(modelId)) {
      const newModels = [...form.models, modelId];
      setForm({ ...form, models: newModels, model: modelId });
    } else {
      setForm({ ...form, model: modelId });
    }
    setShowModelDropdown(false);
  };

  const handleAddModel = () => {
    const trimmed = prompt(t("llmProviders.addModelPrompt"));
    if (trimmed && trimmed.trim()) {
      const modelId = trimmed.trim();
      const newModels = [...form.models, modelId];
      setForm({ ...form, models: newModels, model: modelId });
    }
  };

  const handleRemoveModel = (modelId: string) => {
    const newModels = form.models.filter((m) => m !== modelId);
    let newPrimary = form.model;
    if (form.model === modelId && newModels.length > 0) {
      newPrimary = newModels[0];
    }
    setForm({ ...form, models: newModels, model: newPrimary });
  };

  const handleSelectModel = (modelId: string) => {
    setForm({ ...form, model: modelId });
  };

  const handleWebsiteEdit = () => {
    setTempWebsite(form.website_url);
    setEditingWebsite(true);
  };

  const handleWebsiteSave = () => {
    setForm({ ...form, website_url: tempWebsite });
    setEditingWebsite(false);
  };

  const handleWebsiteCancel = () => {
    setEditingWebsite(false);
    setTempWebsite("");
  };

  const handleEdit = (provider: LlmProviderConfig) => {
    setEditingId(provider.id);
    const models = provider.models && provider.models.length > 0 ? provider.models : [provider.model];
    setForm({
      name: provider.name,
      base_url: provider.base_url,
      api_key: provider.api_key,
      model: provider.model,
      models: models,
      website_url: provider.website_url || "",
      api_format: provider.api_format === "anthropic" ? "anthropic" : "openai",
      temperature: provider.temperature != null ? String(provider.temperature) : "",
      max_tokens: provider.max_tokens != null ? String(provider.max_tokens) : "",
      timeout_secs: provider.timeout_secs != null ? String(provider.timeout_secs) : "",
    });
    setFetchedModels([]);
    setShowModelDropdown(false);
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.name.trim() || !form.base_url.trim() || !form.api_key.trim() || !form.model.trim()) {
      return;
    }

    setSaving(true);
    try {
      const models = form.models.length > 0 ? form.models : [form.model.trim()];
      const payload: LlmProviderConfig = {
        id: editingId ?? crypto.randomUUID(),
        name: form.name.trim(),
        base_url: form.base_url.trim(),
        api_key: form.api_key.trim(),
        model: form.model.trim(),
        models: models,
        website_url: form.website_url.trim() || null,
        api_format: form.api_format,
        temperature: form.temperature ? parseFloat(form.temperature) : undefined,
        max_tokens: form.max_tokens ? parseInt(form.max_tokens, 10) : undefined,
        timeout_secs: form.timeout_secs ? parseInt(form.timeout_secs, 10) : undefined,
      };

      await invoke("save_llm_provider_multi", { provider: payload });

      if (editingId) {
        setProviders((prev) => prev.map((p) => (p.id === editingId ? payload : p)));
      } else {
        setProviders((prev) => [...prev, payload]);
      }

      handleCancel();
      addToast(t("llmProviders.saveSuccess"), "success");
    } catch (err) {
      addToast(t("llmProviders.saveFailed"), "error");
      console.error("Save provider failed:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const provider = providers.find((p) => p.id === id);
    if (!provider) return;

    const confirmed = window.confirm(
      t("llmProviders.deleteConfirm").replace("{name}", provider.name)
    );
    if (!confirmed) return;

    try {
      await invoke<boolean>("delete_llm_provider", { id });
      setProviders((prev) => prev.filter((p) => p.id !== id));
      addToast(t("llmProviders.deleteSuccess").replace("{name}", provider.name), "success");
    } catch (err) {
      addToast(t("llmProviders.saveFailed"), "error");
      console.error("Delete provider failed:", err);
    }
  };

  const handleSwitch = async (id: string) => {
    const toastId = addToast(t("common.saving"), "info");
    try {
      await invoke<boolean>("multi_switch_llm_provider", { id });
      setActiveProviderId(id);
      const provider = providers.find((p) => p.id === id);
      removeToast(toastId);
      if (provider) {
        addToast(t("llmProviders.switchSuccess").replace("{name}", provider.name), "success");
      }
    } catch (err) {
      removeToast(toastId);
      addToast(t("llmProviders.saveFailed"), "error");
      console.error("Switch provider failed:", err);
    }
  };

  if (loading) {
    return <SkeletonList count={3} />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "8px 16px",
            fontSize: "14px",
            fontWeight: 500,
            color: "var(--primary-foreground)",
            backgroundColor: "var(--foreground)",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            transition: "opacity 0.15s",
          }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = "0.9"}
          onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
          onClick={handleAdd}
        >
          <Plus style={{ width: "14px", height: "14px" }} />
          {t("llmProviders.addProvider")}
        </button>
      </div>

      {providers.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "48px 24px",
            color: "var(--muted-foreground)",
          }}
        >
          <p style={{ fontSize: "14px", margin: 0 }}>{t("llmProviders.noProviders")}</p>
          <p style={{ fontSize: "13px", margin: "8px 0 0", opacity: 0.7 }}>
            {t("llmProviders.noProvidersHint")}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {providers.map((provider) => (
            <div
              key={provider.id}
              style={{
                borderRadius: "8px",
                border: "1px solid var(--border)",
                backgroundColor: "var(--background)",
                padding: "16px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: "12px",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      marginBottom: "4px",
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 600,
                        fontSize: "15px",
                        color: "var(--foreground)",
                      }}
                    >
                      {provider.name}
                    </span>
                    {provider.website_url && (
                      <a
                        href={provider.website_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: "11px",
                          color: "var(--primary)",
                          textDecoration: "none",
                          opacity: 0.8,
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                        onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.8")}
                      >
                        🔗 {t("llmProviders.website")}
                      </a>
                    )}
                    <span
                      style={{
                        fontSize: "11px",
                        padding: "1px 6px",
                        borderRadius: "4px",
                        backgroundColor: "var(--muted)",
                        color: "var(--muted-foreground)",
                      }}
                    >
                      {provider.api_format === "anthropic" ? "Anthropic" : "OpenAI"}
                    </span>
                    {provider.id === activeProviderId && (
                      <Badge variant="default" style={{ fontSize: "11px" }}>
                        {t("llmProviders.active")}
                      </Badge>
                    )}
                  </div>

                  <div
                    style={{
                      fontSize: "13px",
                      color: "var(--foreground)",
                      fontWeight: 500,
                      marginBottom: "2px",
                    }}
                  >
                    {provider.model}
                  </div>

                  {provider.models && provider.models.length > 0 && (
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "4px",
                        marginTop: "4px",
                      }}
                    >
                      {provider.models.map((m) => (
                        <span
                          key={m}
                          style={{
                            fontSize: "11px",
                            padding: "1px 5px",
                            borderRadius: "3px",
                            backgroundColor: "var(--secondary)",
                            color: "var(--muted-foreground)",
                          }}
                        >
                          {m}
                        </span>
                      ))}
                    </div>
                  )}

                  <div
                    style={{
                      fontSize: "12px",
                      color: "var(--muted-foreground)",
                      opacity: 0.8,
                    }}
                  >
                    {provider.base_url}
                  </div>

                  {provider.models && provider.models.length > 0 && (
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "4px",
                        marginTop: "4px",
                      }}
                    >
                      {provider.models.map((m) => (
                        <span
                          key={m}
                          style={{
                            fontSize: "11px",
                            padding: "1px 5px",
                            borderRadius: "3px",
                            backgroundColor: "var(--secondary)",
                            color: "var(--muted-foreground)",
                          }}
                        >
                          {m}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    flexShrink: 0,
                  }}
                >
                  {provider.id !== activeProviderId && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSwitch(provider.id)}
                    >
                      {t("llmProviders.switch")}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(provider)}
                  >
                    {t("common.edit")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(provider.id)}
                    style={{ color: "var(--destructive)" }}
                  >
                    {t("common.delete")}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          style={{
            borderRadius: "8px",
            border: "1px solid var(--border)",
            backgroundColor: "var(--background)",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: "15px",
              fontWeight: 600,
              color: "var(--foreground)",
            }}
          >
            {editingId ? t("llmProviders.editTitle") : t("llmProviders.addTitle")}
          </h3>

          {!editingId && (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 500,
                  color: "var(--muted-foreground)",
                }}
              >
                快速选择
              </span>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "6px",
                }}
              >
                {PROVIDER_PRESETS.slice(
                  0,
                  showAllPresets
                    ? PROVIDER_PRESETS.length
                    : PRESET_VISIBLE_COUNT,
                ).map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                      padding: "4px 10px",
                      fontSize: "12px",
                      fontWeight: 500,
                      color: "var(--foreground)",
                      backgroundColor: "var(--secondary)",
                      border: "1px solid var(--border)",
                      borderRadius: "6px",
                      cursor: "pointer",
                      transition: "background-color 0.15s, border-color 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "var(--muted)";
                      e.currentTarget.style.borderColor = preset.color;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "var(--secondary)";
                      e.currentTarget.style.borderColor = "var(--border)";
                    }}
                    onClick={() => applyPreset(preset)}
                  >
                    <span
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        backgroundColor: preset.color,
                        flexShrink: 0,
                      }}
                    />
                    {preset.name}
                  </button>
                ))}
                {PROVIDER_PRESETS.length > PRESET_VISIBLE_COUNT && (
                  <button
                    type="button"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "3px",
                      padding: "4px 8px",
                      fontSize: "12px",
                      fontWeight: 500,
                      color: "var(--muted-foreground)",
                      backgroundColor: "transparent",
                      border: "1px dashed var(--border)",
                      borderRadius: "6px",
                      cursor: "pointer",
                    }}
                    onClick={() => setShowAllPresets(!showAllPresets)}
                  >
                    {showAllPresets ? "收起" : `+${PROVIDER_PRESETS.length - PRESET_VISIBLE_COUNT}`}
                  </button>
                )}
              </div>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
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

            <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "var(--foreground)",
                    flexShrink: 0,
                  }}
                >
                  {t("llmProviders.baseUrl")}
                </span>
                <div style={{ display: "flex", gap: "4px" }}>
                  {(["openai", "anthropic"] as const).map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      style={{
                        padding: "2px 8px",
                        fontSize: "11px",
                        fontWeight: 500,
                        borderRadius: "4px",
                        cursor: "pointer",
                        border: "1px solid",
                        borderColor:
                          form.api_format === fmt
                            ? "var(--primary)"
                            : "var(--border)",
                        backgroundColor:
                          form.api_format === fmt
                            ? "var(--primary)"
                            : "transparent",
                        color:
                          form.api_format === fmt
                            ? "var(--primary-foreground)"
                            : "var(--muted-foreground)",
                        transition: "all 0.15s",
                      }}
                      onClick={() => handleFormatToggle(fmt)}
                    >
                      {fmt === "openai" ? "兼容 OpenAI" : "兼容 Anthropic"}
                    </button>
                  ))}
                </div>
              </div>
              <input
                type="url"
                value={form.base_url}
                onChange={(e) => setForm({ ...form, base_url: e.target.value })}
                placeholder={t("llmProviders.baseUrlPlaceholder")}
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
                placeholder={t("llmProviders.apiKeyPlaceholder")}
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

            <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "var(--foreground)",
                }}
              >
                {t("llmProviders.model")}
              </span>
              <input
                type="text"
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
                placeholder={t("llmProviders.modelPlaceholder")}
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

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "12px",
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
            }}
          >
            <Button type="button" variant="outline" onClick={handleCancel}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" variant="default" disabled={saving}>
              {saving ? t("llmProviders.saving") || t("common.saving") : t("llmProviders.save")}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
