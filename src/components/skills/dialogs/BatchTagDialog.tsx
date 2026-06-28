import { useState, useCallback } from "react";
import { MODAL_LAYER_Z_INDEX, MODAL_OVERLAY_COLOR } from "@/constants/modal";
import type { TranslationPath } from "@/i18n";

interface BatchTagDialogProps {
  open: boolean;
  count: number;
  existingTags: string[];
  onClose: () => void;
  onConfirm: (action: "append" | "override", tags: string[]) => void;
  t: (key: TranslationPath) => string;
}

export function BatchTagDialog({
  open,
  count,
  existingTags,
  onClose,
  onConfirm,
  t,
}: BatchTagDialogProps) {
  const [mode, setMode] = useState<"append" | "override">("append");
  const [tags, setTags] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");

  if (!open) return null;

  const handleAddTag = useCallback(() => {
    const trimmed = inputValue.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed)) {
      setTags((prev) => [...prev, trimmed]);
    }
    setInputValue("");
  }, [inputValue, tags]);

  const handleRemoveTag = (tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  };

  const handleSelectExisting = (tag: string) => {
    if (!tags.includes(tag)) {
      setTags((prev) => [...prev, tag]);
    }
  };

  const handleConfirm = () => {
    if (tags.length === 0) return;
    onConfirm(mode, tags);
    setTags([]);
    setInputValue("");
  };

  const handleClose = () => {
    setTags([]);
    setInputValue("");
    onClose();
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
      onClick={handleClose}
    >
      <div
        style={{
          width: "min(420px, calc(100vw - 48px))",
          backgroundColor: "var(--background)",
          borderRadius: "16px",
          border: "1px solid var(--border)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.24)",
          padding: "24px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ marginBottom: "20px" }}>
          <h3 style={{ margin: "0 0 4px 0", fontSize: "16px", fontWeight: 600, color: "var(--foreground)" }}>
            {t("skills.batchTagTitle")}
          </h3>
          <p style={{ margin: 0, fontSize: "13px", color: "var(--muted-foreground)" }}>
            {t("skills.batchTagDesc").replace("{count}", String(count))}
          </p>
        </div>

        {/* Mode toggle */}
        <div style={{ display: "flex", gap: "6px", marginBottom: "16px" }}>
          <button
            type="button"
            onClick={() => setMode("append")}
            style={{
              padding: "6px 14px",
              fontSize: "12px",
              fontWeight: mode === "append" ? 600 : 400,
              color: mode === "append" ? "var(--background)" : "var(--foreground)",
              backgroundColor: mode === "append" ? "var(--foreground)" : "var(--secondary)",
              border: "1px solid " + (mode === "append" ? "var(--foreground)" : "var(--border)"),
              borderRadius: "8px",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            {t("skills.batchTagAppend")}
          </button>
          <button
            type="button"
            onClick={() => setMode("override")}
            style={{
              padding: "6px 14px",
              fontSize: "12px",
              fontWeight: mode === "override" ? 600 : 400,
              color: mode === "override" ? "var(--background)" : "var(--foreground)",
              backgroundColor: mode === "override" ? "var(--foreground)" : "var(--secondary)",
              border: "1px solid " + (mode === "override" ? "var(--foreground)" : "var(--border)"),
              borderRadius: "8px",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            {t("skills.batchTagOverride")}
          </button>
        </div>

        {/* Tag input */}
        <div style={{ marginBottom: "12px" }}>
          <div style={{ display: "flex", gap: "6px" }}>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddTag();
                }
              }}
              placeholder={t("skills.batchTagInputPlaceholder")}
              style={{
                flex: 1,
                padding: "8px 12px",
                fontSize: "13px",
                color: "var(--foreground)",
                backgroundColor: "var(--secondary)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                outline: "none",
              }}
            />
            <button
              type="button"
              onClick={handleAddTag}
              disabled={!inputValue.trim()}
              style={{
                padding: "8px 12px",
                fontSize: "13px",
                fontWeight: 500,
                color: "var(--background)",
                backgroundColor: inputValue.trim() ? "var(--foreground)" : "var(--muted-foreground)",
                border: "none",
                borderRadius: "8px",
                cursor: inputValue.trim() ? "pointer" : "not-allowed",
                opacity: inputValue.trim() ? 1 : 0.5,
                transition: "all 0.15s ease",
              }}
            >
              {t("common.add")}
            </button>
          </div>
        </div>

        {/* Current tags */}
        {tags.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "12px" }}>
            {tags.map((tag) => (
              <span
                key={tag}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "4px 10px",
                  fontSize: "12px",
                  color: "var(--primary-foreground)",
                  backgroundColor: "var(--primary)",
                  borderRadius: "999px",
                }}
              >
                #{tag}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "inherit",
                    cursor: "pointer",
                    padding: "0 2px",
                    fontSize: "12px",
                    lineHeight: 1,
                    opacity: 0.7,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.7"; }}
                >
                  x
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Existing tags */}
        {existingTags.length > 0 && (
          <div style={{ marginBottom: "20px" }}>
            <div style={{ fontSize: "11px", color: "var(--muted-foreground)", marginBottom: "6px" }}>
              {"已有标签（点击添加）"}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
              {existingTags.slice(0, 20).map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleSelectExisting(tag)}
                  style={{
                    padding: "3px 8px",
                    fontSize: "11px",
                    color: "var(--muted-foreground)",
                    backgroundColor: "transparent",
                    border: "1px solid var(--border)",
                    borderRadius: "999px",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--primary)";
                    e.currentTarget.style.color = "var(--primary)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--border)";
                    e.currentTarget.style.color = "var(--muted-foreground)";
                  }}
                >
                  #{tag}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button
            type="button"
            onClick={handleClose}
            style={{
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: 500,
              color: "var(--foreground)",
              backgroundColor: "transparent",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={tags.length === 0}
            style={{
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: 500,
              color: "var(--background)",
              backgroundColor: tags.length > 0 ? "var(--foreground)" : "var(--muted-foreground)",
              border: "none",
              borderRadius: "8px",
              cursor: tags.length > 0 ? "pointer" : "not-allowed",
              opacity: tags.length > 0 ? 1 : 0.5,
              transition: "all 0.15s ease",
            }}
          >
            {t("common.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
