import { useState } from "react";
import { MODAL_LAYER_Z_INDEX, MODAL_OVERLAY_COLOR } from "@/constants/modal";
import type { SkillCategoryDimension } from "@/types";
import type { TranslationPath } from "@/i18n";
import { DEFAULT_LEVEL1_CATEGORIES } from "@/constants/categories";

interface BatchCategoryDialogProps {
  open: boolean;
  count: number;
  dimensions: SkillCategoryDimension[];
  onClose: () => void;
  onConfirm: (level1: string, level2: string | null) => void;
  t: (key: TranslationPath) => string;
}

const LEVEL1_OPTIONS = DEFAULT_LEVEL1_CATEGORIES.filter((c) => c.id !== "all");

export function BatchCategoryDialog({
  open,
  count,
  dimensions,
  onClose,
  onConfirm,
  t,
}: BatchCategoryDialogProps) {
  const [selectedLevel1, setSelectedLevel1] = useState<string | null>(null);
  const [selectedLevel2, setSelectedLevel2] = useState<string | null>(null);

  if (!open) return null;

  const handleConfirm = () => {
    if (!selectedLevel1) return;
    onConfirm(selectedLevel1, selectedLevel2);
    setSelectedLevel1(null);
    setSelectedLevel2(null);
  };

  const handleClose = () => {
    setSelectedLevel1(null);
    setSelectedLevel2(null);
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
            {t("skills.batchCategoryTitle")}
          </h3>
          <p style={{ margin: 0, fontSize: "13px", color: "var(--muted-foreground)" }}>
            {t("skills.batchCategoryDesc").replace("{count}", String(count))}
          </p>
        </div>

        {/* Level 1 */}
        <div style={{ marginBottom: "16px" }}>
          <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--muted-foreground)", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Level 1
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {LEVEL1_OPTIONS.map((cat) => {
              const label = t(cat.labelKey as TranslationPath);
              const isActive = selectedLevel1 === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setSelectedLevel1(cat.id);
                    setSelectedLevel2(null);
                  }}
                  style={{
                    padding: "8px 16px",
                    fontSize: "13px",
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? "var(--background)" : "var(--foreground)",
                    backgroundColor: isActive ? "var(--foreground)" : "var(--secondary)",
                    border: "1px solid " + (isActive ? "var(--foreground)" : "var(--border)"),
                    borderRadius: "8px",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Level 2 */}
        {selectedLevel1 && dimensions.length > 0 && (
          <div style={{ marginBottom: "20px" }}>
            <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--muted-foreground)", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Level 2
            </div>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setSelectedLevel2(null)}
                style={{
                  padding: "6px 12px",
                  fontSize: "12px",
                  fontWeight: selectedLevel2 === null ? 600 : 400,
                  color: selectedLevel2 === null ? "var(--background)" : "var(--muted-foreground)",
                  backgroundColor: selectedLevel2 === null ? "var(--foreground)" : "transparent",
                  border: "1px solid " + (selectedLevel2 === null ? "var(--foreground)" : "var(--border)"),
                  borderRadius: "999px",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {t("skills.categoryNone")}
              </button>
              {dimensions[0].values.map((val) => {
                const isActive = selectedLevel2 === val;
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setSelectedLevel2(val)}
                    style={{
                      padding: "6px 12px",
                      fontSize: "12px",
                      fontWeight: isActive ? 600 : 400,
                      color: isActive ? "var(--background)" : "var(--muted-foreground)",
                      backgroundColor: isActive ? "var(--foreground)" : "transparent",
                      border: "1px solid " + (isActive ? "var(--foreground)" : "var(--border)"),
                      borderRadius: "999px",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {val}
                  </button>
                );
              })}
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
            disabled={!selectedLevel1}
            style={{
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: 500,
              color: "var(--background)",
              backgroundColor: selectedLevel1 ? "var(--foreground)" : "var(--muted-foreground)",
              border: "none",
              borderRadius: "8px",
              cursor: selectedLevel1 ? "pointer" : "not-allowed",
              opacity: selectedLevel1 ? 1 : 0.5,
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
