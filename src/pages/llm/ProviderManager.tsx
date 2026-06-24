import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "@/i18n";
import { useToast } from "@/components/ui/toast";
import { SkeletonList } from "@/components/ui/loading";
import { MoreHorizontal } from "lucide-react";
import { getProviderIcon, getProviderInitial } from "@/utils/providerIcon";
import { ProviderAddModal } from "./ProviderAddModal";

export interface LlmProviderConfig {
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

interface Preset {
  id: string;
  name: string;
  base_url_openai: string;
  base_url_anthropic: string;
  model: string;
  website_url: string;
  color: string;
}

const DEFAULT_PRESETS: Preset[] = [
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
  {
    id: "qwen",
    name: "Qwen",
    base_url_openai: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    base_url_anthropic: "https://dashscope.aliyuncs.com/apps/anthropic",
    model: "qwen3-coder-plus",
    website_url: "https://dashscope.aliyuncs.com",
    color: "#ff6a00",
  },
  {
    id: "gemini",
    name: "Gemini",
    base_url_openai: "https://generativelanguage.googleapis.com/v1beta/openai",
    base_url_anthropic: "",
    model: "gemini-3-flash-preview",
    website_url: "https://aistudio.google.com",
    color: "#4285f4",
  },
  {
    id: "grok",
    name: "Grok",
    base_url_openai: "https://api.x.ai/v1",
    base_url_anthropic: "",
    model: "grok-4",
    website_url: "https://x.ai",
    color: "#000000",
  },
  {
    id: "perplexity",
    name: "Perplexity",
    base_url_openai: "https://api.perplexity.ai",
    base_url_anthropic: "",
    model: "sonar-pro",
    website_url: "https://perplexity.ai",
    color: "#20808d",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    base_url_openai: "https://openrouter.ai/api/v1",
    base_url_anthropic: "https://openrouter.ai/api/anthropic",
    model: "openrouter/auto",
    website_url: "https://openrouter.ai",
    color: "#6366f1",
  },
  {
    id: "nvidia",
    name: "NVIDIA",
    base_url_openai: "https://integrate.api.nvidia.com/v1",
    base_url_anthropic: "",
    model: "nvidia/llama-3.1-nemotron-70b-instruct",
    website_url: "https://integrate.api.nvidia.com",
    color: "#76b900",
  },
  {
    id: "longcat",
    name: "LongCat",
    base_url_openai: "https://api.longcat.chat/v1",
    base_url_anthropic: "",
    model: "longcat-v3",
    website_url: "https://longcat.chat/platform",
    color: "#6c5ce7",
  },
  {
    id: "stepfun",
    name: "阶跃星辰",
    base_url_openai: "https://api.stepfun.com/v1",
    base_url_anthropic: "",
    model: "step-3",
    website_url: "https://www.stepfun.com",
    color: "#00b4d8",
  },
  {
    id: "hunyuan",
    name: "腾讯混元",
    base_url_openai: "https://api.hunyuan.cloud.tencent.com/v1",
    base_url_anthropic: "",
    model: "hunyuan-turbos-latest",
    website_url: "https://hunyuan.tencent.com",
    color: "#0052d9",
  },
  {
    id: "agnes",
    name: "Agnes",
    base_url_openai: "https://api.agnes.chat/v1",
    base_url_anthropic: "",
    model: "agnes-3",
    website_url: "https://agnes.chat",
    color: "#7c3aed",
  },
];

function ProviderLogo({ name, id, size = 40 }: { name: string; id?: string; size?: number }) {
  const iconPath = getProviderIcon(name, id);
  const [failed, setFailed] = useState(false);

  if (iconPath && !failed) {
    return (
      <img
        src={iconPath}
        alt={name}
        width={size}
        height={size}
        style={{ borderRadius: "6px", objectFit: "contain", flexShrink: 0 }}
        onError={() => setFailed(true)}
      />
    );
  }

  const initial = getProviderInitial(name);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "6px",
        backgroundColor: "var(--muted)",
        color: "var(--muted-foreground)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.4,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {initial}
    </div>
  );
}

// Build a ProviderDirectoryEntry from a preset for the modal
function presetToEntry(preset: Preset) {
  return {
    id: preset.id,
    name: preset.name,
    base_url_openai: preset.base_url_openai,
    base_url_anthropic: preset.base_url_anthropic,
    model: preset.model,
    website_url: preset.website_url,
    icon: "",
  };
}

type ModalMode =
  | { type: "preset"; presetId: string }
  | { type: "custom" }
  | { type: "edit"; provider: LlmProviderConfig };

export function ProviderManager() {
  const { t } = useTranslation();
  const { addToast } = useToast();

  const [providers, setProviders] = useState<LlmProviderConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [presets, setPresets] = useState(DEFAULT_PRESETS);
  const [showAllPresets, setShowAllPresets] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragIndexRef = useRef<number | null>(null);
  const justDroppedRef = useRef(false);

  const fetchProviders = useCallback(async () => {
    setLoading(true);
    try {
      const result = await invoke<LlmProviderConfig[]>("get_llm_providers");
      setProviders(result);
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

  // Close dropdown menu on outside click
  useEffect(() => {
    if (!openMenuId) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-provider-menu]")) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openMenuId]);

  const handleAddPreset = (presetId: string) => {
    setModalMode({ type: "preset", presetId });
  };

  const handleAddCustom = () => {
    setModalMode({ type: "custom" });
  };

  const handleDragStart = (index: number) => {
    justDroppedRef.current = false;
    dragIndexRef.current = index;
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    const from = dragIndexRef.current;
    if (from === null || from === index) {
      setDragIndex(null);
      setDragOverIndex(null);
      dragIndexRef.current = null;
      return;
    }
    const newPresets = [...presets];
    const [moved] = newPresets.splice(from, 1);
    newPresets.splice(index, 0, moved);
    setPresets(newPresets);
    justDroppedRef.current = true;
    setDragIndex(null);
    setDragOverIndex(null);
    dragIndexRef.current = null;
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
    dragIndexRef.current = null;
  };

  const handleEdit = (provider: LlmProviderConfig) => {
    setModalMode({ type: "edit", provider });
    setOpenMenuId(null);
  };

  const handleModalClose = () => {
    setModalMode(null);
  };

  const handleModalSaved = () => {
    setModalMode(null);
    fetchProviders();
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

  // Build the entry/provider props for ProviderAddModal
  const getModalProps = () => {
    if (!modalMode) return null;

    if (modalMode.type === "edit") {
      return { provider: modalMode.provider };
    }

    if (modalMode.type === "custom") {
      return { entry: { id: "__custom__", name: "", base_url_openai: "", base_url_anthropic: "", model: "", website_url: "", icon: "" } as any };
    }

    const preset = presets.find((p) => p.id === modalMode.presetId);
    if (!preset) return null;
    return { entry: presetToEntry(preset) as any };
  };

  const modalProps = modalMode ? getModalProps()! : null;

  if (loading) {
    return <SkeletonList count={3} />;
  }

  return (
    <div style={{ maxWidth: "1200px" }}>
      {providers.length === 0 && !modalMode ? (
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
        <>
          {/* Preset quick-select + Add buttons */}
          <div
            style={{ marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}
          >
            <button
              type="button"
              onClick={handleAddCustom}
              style={{
                padding: "3px 12px",
                fontSize: "12px",
                fontWeight: 500,
                color: "var(--primary)",
                backgroundColor: "transparent",
                border: "1px dashed var(--primary)",
                borderRadius: "9999px",
                cursor: "pointer",
                lineHeight: "18px",
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "color-mix(in srgb, var(--primary) 8%, transparent)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              + 自定义
            </button>
            {presets.slice(
              0,
              showAllPresets
                ? presets.length
                : 12,
            ).map((preset, index) => (
              <button
                key={preset.id}
                type="button"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = "move";
                  handleDragStart(index);
                }}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                onClick={() => {
                  if (!justDroppedRef.current) {
                    handleAddPreset(preset.id);
                  }
                  justDroppedRef.current = false;
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "3px 10px 3px 6px",
                  fontSize: "12px",
                  fontWeight: 500,
                  color: dragIndex === index ? "var(--muted-foreground)" : "var(--foreground)",
                  backgroundColor: dragOverIndex === index && dragIndex !== index
                    ? "color-mix(in srgb, var(--primary) 10%, var(--secondary))"
                    : "var(--secondary)",
                  border: dragOverIndex === index && dragIndex !== index
                    ? "1px solid var(--primary)"
                    : "1px solid var(--border)",
                  borderRadius: "9999px",
                  cursor: "grab",
                  transition: "background-color 0.15s, border-color 0.15s, opacity 0.15s",
                  opacity: dragIndex === index ? 0.4 : 1,
                  lineHeight: "18px",
                }}
              >
                {preset.name}
              </button>
            ))}
            {presets.length > 12 && (
              <button
                type="button"
                onClick={() => setShowAllPresets(!showAllPresets)}
                style={{
                  padding: "3px 10px",
                  fontSize: "12px",
                  fontWeight: 500,
                  color: "var(--muted-foreground)",
                  backgroundColor: "transparent",
                  border: "1px dashed var(--border)",
                  borderRadius: "9999px",
                  cursor: "pointer",
                  lineHeight: "18px",
                }}
              >
                {showAllPresets ? "收起" : `+${presets.length - 12}`}
              </button>
            )}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: "16px",
            }}
          >
            {providers.map((provider) => (
              <div
                key={provider.id}
                style={{
                  borderRadius: "10px",
                  border: "1px solid var(--border)",
                  backgroundColor: "var(--secondary)",
                  padding: "16px",
                  position: "relative",
                }}
              >
                {/* Header: logo left + model name right, provider name as subtitle */}
                <div style={{ display: "flex", gap: "14px", marginBottom: "8px", alignItems: "flex-start" }}>
                  <ProviderLogo name={provider.name} id={provider.id} size={40} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
                      <span style={{ fontSize: "16px", fontWeight: 600, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {provider.model}
                      </span>
                    </div>
                    <div style={{ fontSize: "13px", color: "var(--muted-foreground)", lineHeight: 1.8 }}>
                      <div>{t("llmProviders.vendor")}: {provider.name}</div>
                      {provider.website_url && (
                        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          <span>{t("llmProviders.website")}: </span>
                          <a
                            href={provider.website_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontSize: "13px",
                              color: "var(--primary)",
                              textDecoration: "none",
                              opacity: 0.8,
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                            onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.8")}
                          >
                            {provider.website_url}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 右上角操作按钮 */}
                <div style={{ position: "absolute", top: "12px", right: "12px" }} data-provider-menu>
                  <button
                    onClick={() => setOpenMenuId(openMenuId === provider.id ? null : provider.id)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: "4px",
                      borderRadius: "6px",
                      color: "var(--muted-foreground)",
                      display: "flex",
                      alignItems: "center",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--muted)")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    <MoreHorizontal style={{ width: 18, height: 18 }} />
                  </button>
                  {openMenuId === provider.id && (
                    <div
                      style={{
                        position: "absolute",
                        top: "100%",
                        right: 0,
                        marginTop: "4px",
                        backgroundColor: "var(--background)",
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                        zIndex: 50,
                        minWidth: "120px",
                        overflow: "hidden",
                      }}
                    >
                      <button
                        onClick={() => handleEdit(provider)}
                        style={{
                          display: "block",
                          width: "100%",
                          padding: "8px 14px",
                          fontSize: "13px",
                          textAlign: "left",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "var(--foreground)",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--muted)")}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                      >
                        {t("common.edit")}
                      </button>
                      <button
                        onClick={() => { handleDelete(provider.id); setOpenMenuId(null); }}
                        style={{
                          display: "block",
                          width: "100%",
                          padding: "8px 14px",
                          fontSize: "13px",
                          textAlign: "left",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "var(--destructive)",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--muted)")}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                      >
                        {t("common.delete")}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Modal */}
          {modalProps && (
            <ProviderAddModal
              {...modalProps}
              onClose={handleModalClose}
              onSaved={handleModalSaved}
            />
          )}
        </>
      )}
    </div>
  );
}
