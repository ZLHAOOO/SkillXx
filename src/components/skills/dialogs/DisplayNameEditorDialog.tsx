import { type TranslationPath } from "@/i18n";
import { MODAL_LAYER_Z_INDEX, MODAL_OVERLAY_COLOR } from "@/constants/modal";

interface DisplayNameEditorDialogProps {
  skillName: string;
  skillDescription: string;
  displayNameDraft: string;
  displayDescDraft: string;
  saving: boolean;
  onDisplayNameChange: (value: string) => void;
  onDisplayDescChange: (value: string) => void;
  onSave: () => void;
  onClose: () => void;
  t: (key: TranslationPath) => string;
}

export function DisplayNameEditorDialog({
  skillName,
  skillDescription,
  displayNameDraft,
  displayDescDraft,
  saving,
  onDisplayNameChange,
  onDisplayDescChange,
  onSave,
  onClose,
  t,
}: DisplayNameEditorDialogProps) {
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
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "420px",
          maxWidth: "90vw",
          backgroundColor: "var(--background)",
          border: "1px solid var(--border)",
          borderRadius: "12px",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
          padding: "24px",
        }}
      >
        <h3 style={{ margin: "0 0 8px 0", fontSize: "16px", fontWeight: 600, color: "var(--foreground)" }}>
          {t("skills.editDisplayName")}
        </h3>
        <p style={{ margin: "0 0 20px 0", fontSize: "13px", color: "var(--muted-foreground)" }}>
          {t("skills.editDisplayNameDesc")}
        </p>

        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "var(--foreground)", marginBottom: "6px" }}>
            {t("skills.displayNameLabel")}
          </label>
          <input
            type="text"
            placeholder={skillName}
            value={displayNameDraft}
            onChange={(e) => onDisplayNameChange(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px",
              fontSize: "13px",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              backgroundColor: "var(--background)",
              color: "var(--foreground)",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
          <p style={{ margin: "4px 0 0 0", fontSize: "11px", color: "var(--muted-foreground)" }}>
            {t("skills.displayNameHint")} <span style={{ fontStyle: "italic" }}>{skillName}</span>
          </p>
        </div>

        <div style={{ marginBottom: "20px" }}>
          <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "var(--foreground)", marginBottom: "6px" }}>
            {t("skills.displayDescLabel")}
          </label>
          <textarea
            placeholder={skillDescription || t("skills.noDescription")}
            value={displayDescDraft}
            onChange={(e) => onDisplayDescChange(e.target.value)}
            rows={3}
            style={{
              width: "100%",
              padding: "8px 12px",
              fontSize: "13px",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              backgroundColor: "var(--background)",
              color: "var(--foreground)",
              outline: "none",
              boxSizing: "border-box",
              resize: "vertical",
              minHeight: "80px",
              fontFamily: "inherit",
              lineHeight: 1.5,
            }}
          />
          <p style={{ margin: "4px 0 0 0", fontSize: "11px", color: "var(--muted-foreground)" }}>
            {t("skills.displayDescHint")}
          </p>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button
            onClick={onClose}
            disabled={saving}
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
            {t("common.cancel")}
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            style={{
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: 500,
              color: "var(--primary-foreground)",
              backgroundColor: "var(--primary)",
              border: "none",
              borderRadius: "8px",
              cursor: saving ? "wait" : "pointer",
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? t("common.saving") : t("common.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
