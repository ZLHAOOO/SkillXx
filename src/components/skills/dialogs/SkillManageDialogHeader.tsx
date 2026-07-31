import { useState } from "react";
import { type TranslationPath } from "@/i18n";
import { Pencil, X, Check, Sparkles, Loader2, FileCode } from "lucide-react";

export type SkillDisplayLang = "original" | "zh" | "en";

export interface SkillManageDialogHeaderProps {
  skillName: string;
  skillDescription: string;
  displayName?: string | null;
  displayDescription?: string | null;
  /** Which "notebook" the currently shown name comes from. */
  displayNameLang?: SkillDisplayLang;
  displayDescLang?: SkillDisplayLang;
  onClose: () => void;
  onSaveDisplayName?: (
    name: string,
    description: string,
    targetNameLang: SkillDisplayLang,
    targetDescLang: SkillDisplayLang,
  ) => void | Promise<void>;
  onTranslateSkill?: () => Promise<{
    name: string;
    description: string;
    targetNameLang: SkillDisplayLang;
    targetDescLang: SkillDisplayLang;
  }>;
  /** Opens the SKILL.md content editor. Omitted when the item has no path. */
  onOpenContent?: () => void;
  t: (key: TranslationPath) => string;
}

const ICON_BUTTON_STYLE = {
  width: "24px",
  height: "24px",
  borderRadius: "6px",
  border: "1px solid var(--border)",
  backgroundColor: "var(--secondary)",
  color: "var(--muted-foreground)",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
} as const;

export function SkillManageDialogHeader({
  skillName,
  skillDescription,
  displayName,
  displayDescription,
  displayNameLang,
  displayDescLang,
  onClose,
  onSaveDisplayName,
  onTranslateSkill,
  onOpenContent,
  t,
}: SkillManageDialogHeaderProps) {
  // Inline editing state - use displayName/displayDescription if available
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingName, setEditingName] = useState(displayName || skillName);
  const [editingDescription, setEditingDescription] = useState(displayDescription || skillDescription);

  // AI translation state
  const [isTranslating, setIsTranslating] = useState(false);

  const handleStartEdit = () => {
    // Use the current language version (displayName/displayDescription) instead of original
    setEditingName(displayName || skillName);
    setEditingDescription(displayDescription || skillDescription);
    setIsEditingName(true);
  };

  const handleCancelEdit = () => {
    setIsEditingName(false);
  };

  const handleSaveEdit = async () => {
    const trimmedName = editingName.trim();
    const trimmedDesc = editingDescription.trim();

    // 获取当前显示的语言版本，保存到对应的"本子"
    const currentNameLang = displayNameLang || "original";
    const currentDescLang = displayDescLang || "original";

    // Compare against current language version
    const currentName = displayName || skillName;
    const currentDesc = displayDescription || skillDescription;

    if (trimmedName && (trimmedName !== currentName || trimmedDesc !== currentDesc)) {
      // IMPORTANT: Must await the save to ensure it completes before page navigation
      await onSaveDisplayName?.(trimmedName, trimmedDesc || currentDesc, currentNameLang, currentDescLang);
    }
    setIsEditingName(false);
  };

  // AI translation handler - 翻译并保存到对应的"本子"
  const handleAITranslate = async () => {
    if (!onTranslateSkill || isTranslating) return;

    setIsTranslating(true);
    try {
      const result = await onTranslateSkill();

      // 翻译结果和目标"本子"
      const newName = result.name || displayName || skillName;
      const newDesc = result.description || displayDescription || skillDescription;
      const targetNameLang = result.targetNameLang || "original";
      const targetDescLang = result.targetDescLang || "original";

      // Update editing state so when user clicks pencil, they see the translated values
      setEditingName(newName);
      setEditingDescription(newDesc);

      // 保存到对应的"本子"（根据用户设置的语言）
      await onSaveDisplayName?.(newName, newDesc, targetNameLang, targetDescLang);
    } catch {
      // Error is handled by parent via toast
    } finally {
      setIsTranslating(false);
    }
  };

  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        {isEditingName ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: "var(--muted-foreground)", marginBottom: "4px" }}>
                {t("skills.displayNameLabel")}
              </label>
              <input
                type="text"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                style={{
                  width: "100%",
                  padding: "6px 10px",
                  fontSize: "14px",
                  fontWeight: 600,
                  border: "1px solid var(--border)",
                  borderRadius: "6px",
                  backgroundColor: "var(--background)",
                  color: "var(--foreground)",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: "var(--muted-foreground)", marginBottom: "4px" }}>
                {t("skills.displayDescLabel")}
              </label>
              <textarea
                value={editingDescription}
                onChange={(e) => setEditingDescription(e.target.value)}
                rows={2}
                style={{
                  width: "100%",
                  padding: "6px 10px",
                  fontSize: "12px",
                  border: "1px solid var(--border)",
                  borderRadius: "6px",
                  backgroundColor: "var(--background)",
                  color: "var(--foreground)",
                  outline: "none",
                  boxSizing: "border-box",
                  resize: "vertical",
                  fontFamily: "inherit",
                  lineHeight: 1.4,
                }}
              />
            </div>
            <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
              <button
                onClick={handleCancelEdit}
                style={{
                  padding: "6px 12px",
                  fontSize: "12px",
                  fontWeight: 500,
                  color: "var(--foreground)",
                  backgroundColor: "var(--secondary)",
                  border: "1px solid var(--border)",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleSaveEdit}
                style={{
                  padding: "6px 12px",
                  fontSize: "12px",
                  fontWeight: 500,
                  color: "var(--primary-foreground)",
                  backgroundColor: "var(--primary)",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <Check style={{ width: 14, height: 14 }} />
                {t("common.save")}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600, color: "var(--foreground)" }}>
                {displayName || skillName}
              </h3>
              <button
                onClick={handleStartEdit}
                title={t("skills.editDisplayName")}
                style={ICON_BUTTON_STYLE}
              >
                <Pencil style={{ width: 12, height: 12 }} />
              </button>
              {onOpenContent && (
                <button
                  onClick={onOpenContent}
                  title={t("skills.editContent")}
                  aria-label={t("skills.editContent")}
                  style={ICON_BUTTON_STYLE}
                >
                  <FileCode style={{ width: 12, height: 12 }} />
                </button>
              )}
              {onTranslateSkill && (
                <button
                  onClick={handleAITranslate}
                  disabled={isTranslating}
                  title={t("skills.aiTranslate")}
                  style={{
                    height: "24px",
                    borderRadius: "6px",
                    border: "1px solid var(--border)",
                    backgroundColor: "var(--secondary)",
                    color: isTranslating ? "var(--muted-foreground)" : "var(--primary)",
                    cursor: isTranslating ? "wait" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "4px",
                    padding: "0 8px",
                    fontSize: "12px",
                    fontWeight: 500,
                    opacity: isTranslating ? 0.7 : 1,
                  }}
                >
                  {isTranslating ? (
                    <Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} />
                  ) : (
                    <Sparkles style={{ width: 14, height: 14 }} />
                  )}
                  <span>{t("skills.aiTranslate")}</span>
                </button>
              )}
            </div>
            <p style={{ margin: 0, fontSize: "12px", color: "var(--muted-foreground)", lineHeight: 1.5 }}>
              {displayDescription || skillDescription}
            </p>
          </div>
        )}
      </div>
      <button
        onClick={onClose}
        style={{
          width: "30px",
          height: "30px",
          borderRadius: "8px",
          border: "1px solid var(--border)",
          backgroundColor: "var(--secondary)",
          color: "var(--muted-foreground)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
          flexShrink: 0,
        }}
      >
        <X style={{ width: 14, height: 14 }} />
      </button>
    </div>
  );
}
