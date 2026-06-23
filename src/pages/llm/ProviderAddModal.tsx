import { useState, useEffect } from "react";
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

interface ProviderAddFormData {
  id: string;
  name: string;
  base_url: string;
  api_key: string;
  model: string;
  models: string[];
  api_format: string;
  website_url: string;
}

const emptyAddForm: Omit<ProviderAddFormData, "id"> = {
  name: "",
  base_url: "",
  api_key: "",
  model: "",
  models: [],
  api_format: "openai",
  website_url: "",
};

export function ProviderAddModal({
  entry,
  onClose,
  onSaved,
}: {
  entry: ProviderDirectoryEntry | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const { addToast, removeToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Omit<ProviderAddFormData, "id">>(emptyAddForm);

  useEffect(() => {
    if (!entry) return;
    if (entry.id === "__custom__") {
      setForm({
        ...emptyAddForm,
        api_format: "openai",
      });
      return;
    }
    const apiFormat = entry.base_url_openai ? "openai" : "anthropic";
    const url = entry.base_url_openai || entry.base_url_anthropic;
    setForm({
      name: entry.name,
      base_url: url,
      api_key: "",
      model: entry.model,
      models: [entry.model],
      api_format: apiFormat,
      website_url: entry.website_url,
    });
  }, [entry]);

  if (!entry) return null;

  const isCustom = entry.id === "__custom__";
  const title = isCustom ? "自定义模型" : `添加 ${entry.name}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.base_url.trim() || !form.api_key.trim() || !form.model.trim()) {
      return;
    }

    setSaving(true);
    const toastId = addToast(t("common.saving"), "info");
    try {
      const payload = {
        id: isCustom ? `custom_${Date.now()}` : entry.id,
        name: form.name.trim(),
        base_url: form.base_url.trim(),
        api_key: form.api_key.trim(),
        model: form.model.trim(),
        models: form.models,
        api_format: form.api_format,
        website_url: form.website_url.trim() || null,
        temperature: null as number | null,
        max_tokens: null as number | null,
        timeout_secs: null as number | null,
      };

      await invoke("save_llm_provider_multi", { provider: payload });
      removeToast(toastId);
      addToast(t("llmProviders.addSuccess").replace("{name}", form.name.trim()), "success");
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
            {title}
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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "var(--foreground)",
                }}
              >
                名称
              </span>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                readOnly={!isCustom}
                placeholder={isCustom ? "输入模型名称" : undefined}
                required
                style={{
                  padding: "8px 10px",
                  borderRadius: "6px",
                  border: "1px solid var(--input)",
                  backgroundColor: isCustom ? "var(--background)" : "var(--muted)",
                  color: "var(--foreground)",
                  fontSize: "13px",
                  outline: "none",
                  cursor: isCustom ? "text" : "default",
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
                Base URL
              </span>
              <input
                type="url"
                value={form.base_url}
                onChange={(e) => setForm({ ...form, base_url: e.target.value })}
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
                API Key
              </span>
              <input
                type="password"
                value={form.api_key}
                onChange={(e) => setForm({ ...form, api_key: e.target.value })}
                placeholder={t("llmProviders.apiKeyPlaceholder")}
                required
                autoFocus
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
                Model
              </span>
              <input
                type="text"
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
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
              取消
            </Button>
            <Button type="submit" variant="default" disabled={saving}>
              {saving ? "保存中..." : "保存"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
