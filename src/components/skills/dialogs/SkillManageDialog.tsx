import { useState } from "react";
import { type TranslationPath } from "@/i18n";
import { MODAL_LAYER_Z_INDEX, MODAL_OVERLAY_COLOR } from "@/constants/modal";
import { Toggle } from "@/components/ui/toggle";
import { normalizeSkillTags } from "@/pages/skills/skillTags";
import { Pencil, X, Check, Sparkles, Loader2 } from "lucide-react";

type SkillEditorTab = "tools" | "tags";

export function SkillManageDialog({
  skillName,
  skillDescription,
  displayName,
  displayDescription,
  displayNameLang,
  displayDescLang,
  activeTab,
  availableTabs = ["tools", "tags"],
  onTabChange,
  onClose,
  doneLabel,
  toolsTitle,
  toolsDescription,
  query,
  enabledOnly,
  searchPlaceholder,
  enabledOnlyLabel,
  bulkToggleLabel,
  bulkToggleDisabled,
  bulkToggleTitle,
  items,
  emptyLabel,
  onQueryChange,
  onEnabledOnlyChange,
  onToggle,
  onBulkToggle,
  tags,
  tagDraft,
  onTagDraftChange,
  onAddTag,
  onRemoveTag,
  tagSuggestions,
  onSelectTagSuggestion,
  savingTags,
  onSaveDisplayName,
  onTranslateSkill,
  t,
}: {
  skillName: string;
  skillDescription: string;
  displayName?: string | null;
  displayDescription?: string | null;
  displayNameLang?: "original" | "zh" | "en";  // 当前显示的是哪个"本子"
  displayDescLang?: "original" | "zh" | "en";
  activeTab: SkillEditorTab;
  availableTabs?: SkillEditorTab[];
  onTabChange: (tab: SkillEditorTab) => void;
  onClose: () => void;
  doneLabel: string;
  toolsTitle: string;
  toolsDescription: string;
  query: string;
  enabledOnly: boolean;
  searchPlaceholder: string;
  enabledOnlyLabel: string;
  bulkToggleLabel: string;
  bulkToggleDisabled: boolean;
  bulkToggleTitle?: string;
  items: Array<{
    id: string;
    label: string;
    enabled: boolean;
    disabled: boolean;
    tooltip?: string;
    dimmed?: boolean;
  }>;
  emptyLabel: string;
  onQueryChange: (query: string) => void;
  onEnabledOnlyChange: (enabledOnly: boolean) => void;
  onToggle: (itemId: string, enabled: boolean) => void;
  onBulkToggle: () => void;
  tags: string[];
  tagDraft: string;
  onTagDraftChange: (value: string) => void;
  onAddTag: () => void;
  onRemoveTag: (tag: string) => void;
  tagSuggestions: string[];
  onSelectTagSuggestion: (tag: string) => void;
  savingTags: boolean;
  onSaveDisplayName?: (name: string, description: string, targetNameLang: "original" | "zh" | "en", targetDescLang: "original" | "zh" | "en") => void | Promise<void>;
  onTranslateSkill?: () => Promise<{ name: string; description: string; targetNameLang: "original" | "zh" | "en"; targetDescLang: "original" | "zh" | "en" }>;
  t: (key: TranslationPath) => string;
}) {
  const canAddTag = normalizeSkillTags([tagDraft]).length > 0;

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
    } catch (err) {
      // Error is handled by parent via toast
    } finally {
      setIsTranslating(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: MODAL_OVERLAY_COLOR,
        zIndex: MODAL_LAYER_Z_INDEX,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "min(680px, calc(100vw - 48px))",
          maxHeight: "calc(100vh - 72px)",
          backgroundColor: "var(--background)",
          borderRadius: "14px",
          border: "1px solid var(--border)",
          boxShadow: "0 20px 56px rgba(0,0,0,0.22)",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
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
                    style={{
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
                    }}
                  >
                    <Pencil style={{ width: 12, height: 12 }} />
                  </button>
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

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "4px",
            backgroundColor: "var(--secondary)",
            border: "1px solid var(--border)",
            borderRadius: "10px",
            width: "fit-content",
          }}
        >
          {availableTabs.map((tab) => {
            const active = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => onTabChange(tab)}
                style={{
                  padding: "7px 12px",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: active ? "var(--primary-foreground)" : "var(--foreground)",
                  backgroundColor: active ? "var(--foreground)" : "transparent",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                }}
              >
                {tab === "tools" ? t("skills.manageToolsTab") : t("skills.manageTagsTab")}
              </button>
            );
          })}
        </div>

        {activeTab === "tools" ? (
          <>
            <div style={{ fontSize: "12px", color: "var(--muted-foreground)", lineHeight: 1.5 }}>
              <strong style={{ color: "var(--foreground)" }}>{toolsTitle}</strong>
              <div>{toolsDescription}</div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              <div style={{ position: "relative", flex: "1 1 280px", minWidth: "200px" }}>
                <svg
                  style={{
                    position: "absolute",
                    left: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--muted-foreground)",
                    pointerEvents: "none",
                  }}
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => onQueryChange(e.target.value)}
                  placeholder={searchPlaceholder}
                  style={{
                    width: "100%",
                    padding: "8px 10px 8px 32px",
                    fontSize: "12px",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    backgroundColor: "var(--secondary)",
                    color: "var(--foreground)",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "12px",
                  color: "var(--muted-foreground)",
                  userSelect: "none",
                }}
              >
                <Toggle
                  checked={enabledOnly}
                  onChange={(checked) => onEnabledOnlyChange(checked)}
                />
                {enabledOnlyLabel}
              </label>

              <button
                type="button"
                onClick={onBulkToggle}
                disabled={bulkToggleDisabled}
                title={bulkToggleTitle}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 10px",
                  fontSize: "12px",
                  fontWeight: 500,
                  color: "var(--foreground)",
                  backgroundColor: "var(--secondary)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  cursor: bulkToggleDisabled ? "not-allowed" : "pointer",
                  opacity: bulkToggleDisabled ? 0.6 : 1,
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16M8 16H3v5" />
                </svg>
                {bulkToggleLabel}
              </button>
            </div>

            <div
              style={{
                border: "1px solid var(--border)",
                borderRadius: "10px",
                backgroundColor: "var(--secondary)",
                overflow: "hidden",
              }}
            >
              <div style={{ maxHeight: "360px", overflow: "auto", padding: "6px" }}>
                {items.length === 0 ? (
                  <div
                    style={{
                      padding: "30px 14px",
                      textAlign: "center",
                      fontSize: "12px",
                      color: "var(--muted-foreground)",
                    }}
                  >
                    {emptyLabel}
                  </div>
                ) : (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                      gap: "8px",
                    }}
                  >
                    {items.map((item) => (
                      <div
                        key={item.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "10px",
                          minHeight: "48px",
                          padding: "10px 12px",
                          borderRadius: "8px",
                          border: "1px solid var(--border)",
                          backgroundColor: item.enabled ? "rgba(9, 105, 218, 0.08)" : "var(--background)",
                          opacity: item.dimmed ? 0.6 : 1,
                        }}
                        title={item.tooltip}
                      >
                        <div
                          style={{
                            fontSize: "14px",
                            fontWeight: 500,
                            color: "var(--foreground)",
                            lineHeight: 1.35,
                            minWidth: 0,
                            overflow: "hidden",
                            whiteSpace: "nowrap",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {item.label}
                        </div>
                        <Toggle
                          checked={item.enabled}
                          disabled={item.disabled}
                          onChange={(checked) => onToggle(item.id, checked)}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              border: "1px solid var(--border)",
              borderRadius: "12px",
              backgroundColor: "var(--secondary)",
              padding: "14px",
            }}
          >
            <div style={{ fontSize: "12px", color: "var(--muted-foreground)", lineHeight: 1.5 }}>
              {t("skills.tagEditorHint")}
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", minHeight: "30px" }}>
              {tags.length === 0 ? (
                <span style={{ fontSize: "12px", color: "var(--muted-foreground)" }}>
                  {t("skills.noTags")}
                </span>
              ) : (
                tags.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      fontSize: "11px",
                      fontWeight: 500,
                      color: "rgba(17, 24, 39, 0.72)",
                      backgroundColor: "rgba(9, 105, 218, 0.04)",
                      border: "1px solid rgba(9, 105, 218, 0.14)",
                      borderRadius: "999px",
                      padding: "3px 5px 3px 8px",
                    }}
                  >
                    <span>#{tag}</span>
                    <button
                      type="button"
                      onClick={() => onRemoveTag(tag)}
                      disabled={savingTags}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "18px",
                        height: "18px",
                        padding: 0,
                        color: "var(--muted-foreground)",
                        backgroundColor: "transparent",
                        border: "none",
                        borderRadius: "999px",
                        cursor: savingTags ? "wait" : "pointer",
                      }}
                      title={t("skills.removeTag")}
                    >
                      ×
                    </button>
                  </span>
                ))
              )}
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <input
                type="text"
                value={tagDraft}
                placeholder={t("skills.tagInputPlaceholder")}
                onChange={(e) => onTagDraftChange(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.key === "Enter" || e.key === ",") && !savingTags) {
                    e.preventDefault();
                    onAddTag();
                  }
                }}
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: "8px 10px",
                  fontSize: "12px",
                  color: "var(--foreground)",
                  backgroundColor: "var(--background)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  outline: "none",
                }}
              />
              <button
                type="button"
                onClick={onAddTag}
                disabled={savingTags || !canAddTag}
                style={{
                  padding: "8px 12px",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "var(--primary-foreground)",
                  backgroundColor: "var(--foreground)",
                  border: "none",
                  borderRadius: "8px",
                  cursor: savingTags || !canAddTag ? "not-allowed" : "pointer",
                  opacity: savingTags || !canAddTag ? 0.5 : 1,
                }}
              >
                {t("skills.addTag")}
              </button>
            </div>

            {tagSuggestions.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--muted-foreground)" }}>
                  {t("skills.commonTags")}
                </span>
                {tagSuggestions.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => onSelectTagSuggestion(tag)}
                    disabled={savingTags}
                    style={{
                      padding: "5px 10px",
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "var(--foreground)",
                      backgroundColor: "var(--background)",
                      border: "1px solid var(--border)",
                      borderRadius: "999px",
                      cursor: savingTags ? "wait" : "pointer",
                    }}
                  >
                    + {tag}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              fontSize: "12px",
              fontWeight: 500,
              color: "var(--primary-foreground)",
              backgroundColor: "var(--foreground)",
              border: "none",
              borderRadius: "8px",
              padding: "7px 12px",
              cursor: "pointer",
            }}
          >
            {doneLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

