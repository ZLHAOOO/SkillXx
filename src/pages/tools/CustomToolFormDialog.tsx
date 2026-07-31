import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { homeDir } from "@tauri-apps/api/path";
import { FolderOpen, X } from "lucide-react";

import type { Tool } from "@/types";
import { useTranslation } from "@/i18n";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CUSTOM_TOOL_TEMPLATES } from "./customToolTemplates";

interface CustomToolFormDialogProps {
  open: boolean;
  /** Null = creating a new tool; non-null = editing the tool with this id. */
  editingToolId: string | null;
  /** Already-known tools — used to detect duplicate ids and to prefill the
   *  edit form. Should be the latest detected/custom list from the parent. */
  existingTools: Tool[];
  onClose: () => void;
  onSaved: () => void;
  onError: (msg: string) => void;
}

export function CustomToolFormDialog({
  open,
  editingToolId,
  existingTools,
  onClose,
  onSaved,
  onError,
}: CustomToolFormDialogProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    name: "",
    id: "",
    configPath: "",
    skillsPath: "",
    iconPath: "",
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [idManuallyEdited, setIdManuallyEdited] = useState(false);

  const formInputStyle: React.CSSProperties = {
    height: "40px",
    backgroundColor: "var(--background)",
    borderRadius: "8px",
    border: "1px solid var(--border)",
    padding: "0 12px",
    boxShadow: "none",
    color: "var(--foreground)",
    caretColor: "var(--foreground)",
    flex: 1,
    fontSize: "13px",
  };
  const fieldLabelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "12px",
    fontWeight: 500,
    color: "var(--muted-foreground)",
    marginBottom: "6px",
    letterSpacing: "0.01em",
  };
  const pickerButtonStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "40px",
    height: "40px",
    borderRadius: "8px",
    border: "1px solid var(--border)",
    background: "var(--secondary)",
    color: "var(--muted-foreground)",
    cursor: "pointer",
    flexShrink: 0,
    transition: "background-color 0.15s, color 0.15s, border-color 0.15s",
  };

  // Reset / initialize form whenever the dialog opens.
  useEffect(() => {
    if (!open) return;
    if (editingToolId) {
      const tool = existingTools.find((t) => t.id === editingToolId);
      if (tool) {
        setForm({
          name: tool.name,
          id: tool.id,
          configPath: tool.config.config_path,
          skillsPath: tool.config.skills_path,
          iconPath: tool.icon_path || "",
        });
        setIdManuallyEdited(true);
      }
    } else {
      setForm({ name: "", id: "", configPath: "", skillsPath: "", iconPath: "" });
      setIdManuallyEdited(false);
    }
    setFormError(null);
    setSelectedTemplateId("");
  }, [open, editingToolId, existingTools]);

  // Esc closes the dialog.
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  const slugify = (value: string) =>
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  const handleSelectTemplate = useCallback(async (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (!templateId) {
      setForm({ name: "", id: "", configPath: "", skillsPath: "", iconPath: "" });
      setIdManuallyEdited(false);
      return;
    }
    const template = CUSTOM_TOOL_TEMPLATES.find((tpl) => tpl.id === templateId);
    if (!template) return;
    try {
      const home = await homeDir();
      const trimmedHome = home.replace(/[\\/]+$/, "");
      const configPath = `${trimmedHome}/${template.configRel}`;
      const skillsPath = `${configPath}/${template.skillsSubdir ?? "skills"}`;
      setForm({
        name: template.name,
        id: template.id,
        configPath,
        skillsPath,
        iconPath: "",
      });
      setIdManuallyEdited(true);
    } catch (err) {
      console.error("Failed to resolve home directory for template:", err);
      setFormError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const handleCustomNameChange = useCallback((value: string) => {
    setForm((prev) => ({
      ...prev,
      name: value,
      id: idManuallyEdited ? prev.id : slugify(value),
    }));
  }, [idManuallyEdited]);

  const handleCustomIdChange = useCallback((value: string) => {
    setIdManuallyEdited(true);
    setForm((prev) => ({ ...prev, id: value }));
  }, []);

  const handleSelectCustomConfigPath = useCallback(async () => {
    const selected = await openDialog({
      directory: true,
      multiple: false,
      title: t("tools.selectConfigPath"),
    });
    if (selected && typeof selected === "string") {
      setForm((prev) => ({
        ...prev,
        configPath: selected,
        skillsPath: `${selected}/skills`,
      }));
    }
  }, [t]);

  const handleSelectCustomSkillsPath = useCallback(async () => {
    const selected = await openDialog({
      directory: true,
      multiple: false,
      title: t("tools.selectSkillsPath"),
    });
    if (selected && typeof selected === "string") {
      setForm((prev) => ({ ...prev, skillsPath: selected }));
    }
  }, [t]);

  const handleSelectCustomIconPath = useCallback(async () => {
    const selected = await openDialog({
      directory: false,
      multiple: false,
      title: t("tools.selectIconPath"),
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "svg", "ico"] }],
    });
    if (selected && typeof selected === "string") {
      setForm((prev) => ({ ...prev, iconPath: selected }));
    }
  }, [t]);

  const handleSave = useCallback(async () => {
    const trimmedName = form.name.trim();
    const trimmedId = form.id.trim();
    const trimmedConfig = form.configPath.trim();
    const trimmedSkills = form.skillsPath.trim();

    if (!trimmedName || !trimmedId || !trimmedConfig || !trimmedSkills) {
      setFormError(t("tools.customErrorRequired"));
      return;
    }

    if (!editingToolId) {
      const existingBuiltin = existingTools.find(
        (tool) => tool.id === trimmedId && tool.source !== "custom"
      );
      const existingCustom = existingTools.find(
        (tool) => tool.id === trimmedId && tool.source === "custom"
      );
      if (existingCustom || (existingBuiltin && existingBuiltin.detected)) {
        setFormError(t("tools.customErrorConflict"));
        return;
      }
    }

    setFormError(null);
    onError("");

    try {
      if (editingToolId) {
        const currentTool = existingTools.find((tool) => tool.id === editingToolId);
        await invoke("update_custom_tool", {
          toolId: editingToolId,
          name: trimmedName,
          configPath: trimmedConfig,
          skillsPath: trimmedSkills,
          iconPath: form.iconPath.trim() ? form.iconPath.trim() : null,
          enabled: currentTool?.config.enabled ?? false,
        });
      } else {
        const matchesBuiltin = existingTools.some(
          (tool) => tool.id === trimmedId && tool.source !== "custom"
        );
        if (matchesBuiltin) {
          await invoke("update_tool_paths", {
            toolId: trimmedId,
            configPath: trimmedConfig,
            skillsPath: trimmedSkills,
          });
        } else {
          await invoke("create_custom_tool", {
            toolId: trimmedId,
            name: trimmedName,
            configPath: trimmedConfig,
            skillsPath: trimmedSkills,
            iconPath: form.iconPath.trim() ? form.iconPath.trim() : null,
          });
        }
      }

      onSaved();
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    }
  }, [editingToolId, existingTools, form, onClose, onError, onSaved, t]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.5)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        padding: "24px",
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <Card
        style={{
          width: "min(720px, 92vw)",
          maxHeight: "88vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          background: "var(--background)",
          border: "1px solid var(--border)",
          borderRadius: "16px",
          boxShadow: "0 24px 64px -12px rgba(0, 0, 0, 0.25)",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <CardHeader style={{ padding: "18px 20px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <CardTitle style={{ fontSize: "16px" }}>
              {editingToolId ? t("tools.customEditTitle") : t("tools.customCreateTitle")}
            </CardTitle>
            <button
              onClick={onClose}
              title={t("common.cancel")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                background: "var(--background)",
                color: "var(--muted-foreground)",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "var(--muted)";
                e.currentTarget.style.color = "var(--foreground)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "var(--background)";
                e.currentTarget.style.color = "var(--muted-foreground)";
              }}
            >
              <X style={{ width: "14px", height: "14px" }} />
            </button>
          </div>
        </CardHeader>

        <CardContent style={{ padding: "18px 20px", overflow: "auto" }}>
          {formError && (
            <div style={{ marginBottom: "16px" }}>
              <Alert variant="destructive">
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            </div>
          )}

          {!editingToolId && (() => {
            const visibleIds = new Set(
              existingTools
                .filter((tool) => tool.detected || tool.source === "custom")
                .map((tool) => tool.id)
            );
            const availableTemplates = CUSTOM_TOOL_TEMPLATES
              .filter((tpl) => !visibleIds.has(tpl.id))
              .sort((a, b) => a.name.localeCompare(b.name));
            if (availableTemplates.length === 0) return null;
            return (
              <div style={{ marginBottom: "14px" }}>
                <label style={fieldLabelStyle}>选择模板</label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => handleSelectTemplate(e.target.value)}
                  style={{
                    ...formInputStyle,
                    width: "100%",
                    appearance: "none",
                    backgroundImage:
                      'url(\'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="%23737373" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>\')',
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "right 12px center",
                    paddingRight: "32px",
                    cursor: "pointer",
                  }}
                >
                  <option value="">— 自定义 —</option>
                  {availableTemplates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.name}
                    </option>
                  ))}
                </select>
                <span style={{ display: "block", marginTop: "4px", fontSize: "11px", color: "var(--muted-foreground)" }}>
                  选择模板可快速填充路径；也可选择"自定义"手动输入。
                </span>
              </div>
            );
          })()}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: "14px 16px",
            }}
          >
            <div>
              <label style={fieldLabelStyle}>{t("tools.customNameLabel")}</label>
              <Input
                value={form.name}
                onChange={(e) => handleCustomNameChange(e.target.value)}
                placeholder={t("tools.customNamePlaceholder")}
                style={formInputStyle}
              />
            </div>
            <div>
              <label style={fieldLabelStyle}>{t("tools.customIdLabel")}</label>
              <Input
                value={form.id}
                onChange={(e) => handleCustomIdChange(e.target.value)}
                placeholder={t("tools.customIdPlaceholder")}
                disabled={!!editingToolId}
                style={{
                  ...formInputStyle,
                  opacity: editingToolId ? 0.7 : 1,
                  cursor: editingToolId ? "not-allowed" : "text",
                  color: editingToolId ? "var(--muted-foreground)" : "var(--foreground)",
                  WebkitTextFillColor: editingToolId ? "var(--muted-foreground)" : "var(--foreground)",
                }}
              />
              {editingToolId && (
                <span style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>
                  {t("tools.customIdLocked")}
                </span>
              )}
            </div>
            <div>
              <label style={fieldLabelStyle}>{t("tools.customConfigPathLabel")}</label>
              <div style={{ display: "flex", gap: "8px" }}>
                <Input
                  value={form.configPath}
                  onChange={(e) => setForm((prev) => ({ ...prev, configPath: e.target.value }))}
                  placeholder={t("tools.customConfigPathPlaceholder")}
                  style={formInputStyle}
                />
                <button
                  onClick={handleSelectCustomConfigPath}
                  title={t("tools.selectConfigPath")}
                  style={pickerButtonStyle}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--muted)";
                    e.currentTarget.style.color = "var(--foreground)";
                    e.currentTarget.style.borderColor = "var(--ring)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--secondary)";
                    e.currentTarget.style.color = "var(--muted-foreground)";
                    e.currentTarget.style.borderColor = "var(--border)";
                  }}
                >
                  <FolderOpen style={{ width: "16px", height: "16px" }} />
                </button>
              </div>
            </div>
            <div>
              <label style={fieldLabelStyle}>{t("tools.customSkillsPathLabel")}</label>
              <div style={{ display: "flex", gap: "8px" }}>
                <Input
                  value={form.skillsPath}
                  onChange={(e) => setForm((prev) => ({ ...prev, skillsPath: e.target.value }))}
                  placeholder={t("tools.customSkillsPathPlaceholder")}
                  style={formInputStyle}
                />
                <button
                  onClick={handleSelectCustomSkillsPath}
                  title={t("tools.selectSkillsPath")}
                  style={pickerButtonStyle}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--muted)";
                    e.currentTarget.style.color = "var(--foreground)";
                    e.currentTarget.style.borderColor = "var(--ring)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--secondary)";
                    e.currentTarget.style.color = "var(--muted-foreground)";
                    e.currentTarget.style.borderColor = "var(--border)";
                  }}
                >
                  <FolderOpen style={{ width: "16px", height: "16px" }} />
                </button>
              </div>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={fieldLabelStyle}>{t("tools.customIconPathLabel")}</label>
              <div style={{ display: "flex", gap: "8px" }}>
                <Input
                  value={form.iconPath}
                  onChange={(e) => setForm((prev) => ({ ...prev, iconPath: e.target.value }))}
                  placeholder={t("tools.customIconPathPlaceholder")}
                  style={formInputStyle}
                />
                <button
                  onClick={handleSelectCustomIconPath}
                  title={t("tools.selectIconPath")}
                  style={pickerButtonStyle}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--muted)";
                    e.currentTarget.style.color = "var(--foreground)";
                    e.currentTarget.style.borderColor = "var(--ring)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--secondary)";
                    e.currentTarget.style.color = "var(--muted-foreground)";
                    e.currentTarget.style.borderColor = "var(--border)";
                  }}
                >
                  <FolderOpen style={{ width: "16px", height: "16px" }} />
                </button>
              </div>
            </div>
          </div>
        </CardContent>

        <CardFooter
          style={{
            padding: "16px 20px",
            borderTop: "1px solid var(--border)",
            justifyContent: "flex-end",
            gap: "10px",
          }}
        >
          <button
            onClick={onClose}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 16px",
              borderRadius: "8px",
              border: "1px solid var(--border)",
              background: "var(--background)",
              color: "var(--foreground)",
              cursor: "pointer",
              fontSize: "13px",
            }}
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={handleSave}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 18px",
              borderRadius: "8px",
              border: "none",
              background: "var(--foreground)",
              color: "var(--primary-foreground)",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: 500,
            }}
          >
            {t("common.save")}
          </button>
        </CardFooter>
      </Card>
    </div>
  );
}
