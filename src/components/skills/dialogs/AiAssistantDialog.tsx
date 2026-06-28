import { MODAL_LAYER_Z_INDEX, MODAL_OVERLAY_COLOR } from "@/constants/modal";
import type { TranslationPath } from "@/i18n";

interface AiAssistantDialogProps {
  open: boolean;
  onClose: () => void;
  onBatchTranslate: () => void;
  onAiClassify: () => void;
  t: (key: TranslationPath) => string;
}

export function AiAssistantDialog({
  open,
  onClose,
  onBatchTranslate,
  onAiClassify,
  t,
}: AiAssistantDialogProps) {
  if (!open) return null;

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
          width: "min(360px, calc(100vw - 48px))",
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
            AI 技能管家
          </h3>
          <p style={{ margin: 0, fontSize: "13px", color: "var(--muted-foreground)" }}>
            {t("skills.aiAssistantDesc")}
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {/* AI 批量翻译 */}
          <button
            type="button"
            onClick={() => { onClose(); onBatchTranslate(); }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              width: "100%",
              padding: "14px 16px",
              fontSize: "14px",
              fontWeight: 500,
              color: "var(--foreground)",
              backgroundColor: "var(--secondary)",
              border: "1px solid var(--border)",
              borderRadius: "12px",
              cursor: "pointer",
              transition: "all 0.15s ease",
              textAlign: "left",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--primary)";
              e.currentTarget.style.backgroundColor = "color-mix(in srgb, var(--primary) 8%, var(--secondary))";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border)";
              e.currentTarget.style.backgroundColor = "var(--secondary)";
            }}
          >
            <span style={{ fontSize: "20px", flexShrink: 0 }}>🌐</span>
            <div>
              <div style={{ fontWeight: 600, marginBottom: "2px" }}>{t("skills.batchTranslate")}</div>
              <div style={{ fontSize: "12px", color: "var(--muted-foreground)" }}>
                使用 AI 批量翻译技能名称和描述
              </div>
            </div>
          </button>

          {/* AI 分类管理 */}
          <button
            type="button"
            onClick={() => { onClose(); onAiClassify(); }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              width: "100%",
              padding: "14px 16px",
              fontSize: "14px",
              fontWeight: 500,
              color: "var(--foreground)",
              backgroundColor: "var(--secondary)",
              border: "1px solid var(--border)",
              borderRadius: "12px",
              cursor: "pointer",
              transition: "all 0.15s ease",
              textAlign: "left",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--primary)";
              e.currentTarget.style.backgroundColor = "color-mix(in srgb, var(--primary) 8%, var(--secondary))";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border)";
              e.currentTarget.style.backgroundColor = "var(--secondary)";
            }}
          >
            <span style={{ fontSize: "20px", flexShrink: 0 }}>🏷️</span>
            <div>
              <div style={{ fontWeight: 600, marginBottom: "2px" }}>{t("skills.aiClassify")}</div>
              <div style={{ fontSize: "12px", color: "var(--muted-foreground)" }}>
                {t("skills.aiClassifyDesc")}
              </div>
            </div>
          </button>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "20px" }}>
          <button
            type="button"
            onClick={onClose}
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
        </div>
      </div>
    </div>
  );
}
