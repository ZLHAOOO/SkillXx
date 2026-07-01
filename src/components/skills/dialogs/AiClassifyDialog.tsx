import { MODAL_LAYER_Z_INDEX, MODAL_OVERLAY_COLOR } from "@/constants/modal";
import type { TranslationPath } from "@/i18n";

interface AiClassifyDialogProps {
  open: boolean;
  totalCount: number;
  processedCount: number;
  currentName: string;
  classifying: boolean;
  done: boolean;
  error: string | null;
  onClose: () => void;
  onRetry: () => void;
  t: (key: TranslationPath) => string;
}

export function AiClassifyDialog({
  open,
  totalCount,
  processedCount,
  currentName,
  classifying,
  done,
  error,
  onClose,
  onRetry,
  t,
}: AiClassifyDialogProps) {
  if (!open) return null;

  const progress = totalCount > 0 ? Math.round((processedCount / totalCount) * 100) : 0;

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
          width: "min(400px, calc(100vw - 48px))",
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
            {t("skills.aiClassifyTitle")}
          </h3>
          <p style={{ margin: 0, fontSize: "13px", color: "var(--muted-foreground)" }}>
            {classifying
              ? t("skills.aiClassifyProcessing")
              : done
                ? t("skills.aiClassifyDone")
                : error
                  ? t("skills.aiClassifyError")
                  : "准备开始..."}
          </p>
        </div>

        {/* Progress bar */}
        {(classifying || done) && (
          <div style={{ marginBottom: "16px" }}>
            <div
              style={{
                width: "100%",
                height: "8px",
                backgroundColor: "var(--secondary)",
                borderRadius: "4px",
                overflow: "hidden",
                marginBottom: "8px",
              }}
            >
              <div
                style={{
                  width: `${progress}%`,
                  height: "100%",
                  backgroundColor: error ? "var(--destructive, #ef4444)" : "var(--primary)",
                  borderRadius: "4px",
                  transition: "width 0.3s ease",
                }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--muted-foreground)" }}>
              <span>
                {processedCount}/{totalCount}
              </span>
              <span>{progress}%</span>
            </div>
          </div>
        )}

        {/* Current item */}
        {classifying && currentName && (
          <div
            style={{
              padding: "10px 12px",
              fontSize: "12px",
              color: "var(--muted-foreground)",
              backgroundColor: "var(--secondary)",
              borderRadius: "8px",
              marginBottom: "16px",
            }}
          >
              正在处理：<span style={{ color: "var(--foreground)", fontWeight: 500 }}>{currentName}</span>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div
            style={{
              padding: "10px 12px",
              fontSize: "12px",
              color: "var(--destructive, #ef4444)",
              backgroundColor: "color-mix(in srgb, var(--destructive, #ef4444) 10%, var(--background))",
              borderRadius: "8px",
              marginBottom: "16px",
            }}
          >
            {error}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          {error && (
            <button
              type="button"
              onClick={onRetry}
              style={{
                padding: "8px 16px",
                fontSize: "13px",
                fontWeight: 500,
                color: "var(--foreground)",
                backgroundColor: "var(--secondary)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                cursor: "pointer",
              }}
            >
              {t("common.retry")}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: 500,
              color: "var(--background)",
              backgroundColor: "var(--foreground)",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            {classifying ? "后台运行中" : t("common.done")}
          </button>
        </div>
      </div>
    </div>
  );
}
