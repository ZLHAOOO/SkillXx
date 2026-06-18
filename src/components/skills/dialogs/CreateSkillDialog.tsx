import { useState } from "react";
import { type TranslationPath } from "@/i18n";
import { CREATE_SKILL_MODAL_WIDTH, MODAL_LAYER_Z_INDEX, MODAL_OVERLAY_COLOR } from "@/constants/modal";

interface CreateSkillDialogProps {
  creating: boolean;
  existingIds: string[];
  onCancel: () => void;
  onCreate: (name: string, description: string) => void;
  t: (key: TranslationPath) => string;
}

export function CreateSkillDialog({
  creating,
  existingIds,
  onCancel,
  onCreate,
  t,
}: CreateSkillDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  const toId = (n: string): string =>
    n.trim().toLowerCase().replace(/ /g, "-").replace(/[^a-z0-9_-]/g, "");

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t("skills.nameRequired"));
      return;
    }
    const id = toId(trimmed);
    if (existingIds.includes(id)) {
      setError(t("skills.nameConflict").replace("{name}", trimmed));
      return;
    }
    onCreate(trimmed, description.trim());
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
      onClick={onCancel}
    >
      <div
        style={{
          width: CREATE_SKILL_MODAL_WIDTH,
          backgroundColor: "var(--background)",
          borderRadius: "14px",
          border: "1px solid var(--border)",
          boxShadow: "0 16px 48px rgba(0,0,0,0.2)",
          padding: "24px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ fontSize: "16px", fontWeight: 600, color: "var(--foreground)", margin: "0 0 4px 0" }}>
          {t("skills.createSkill")}
        </h2>
        <p style={{ fontSize: "13px", color: "var(--muted-foreground)", margin: "0 0 20px 0" }}>
          {t("skills.createSkillDesc")}
        </p>

        <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "var(--foreground)", marginBottom: "6px" }}>
          {t("skills.skillName")}
        </label>
        <input
          autoFocus
          type="text"
          placeholder={t("skills.skillNamePlaceholder")}
          value={name}
          onChange={(e) => { setName(e.target.value); setError(""); }}
          onKeyDown={(e) => { if (e.key === "Enter" && !creating) handleSubmit(); }}
          style={{
            width: "100%",
            padding: "8px 12px",
            fontSize: "13px",
            border: error ? "1px solid var(--color-error)" : "1px solid var(--border)",
            borderRadius: "8px",
            backgroundColor: "var(--background)",
            color: "var(--foreground)",
            outline: "none",
            boxSizing: "border-box",
            marginBottom: error ? "4px" : "16px",
          }}
        />
        {error && (
          <p style={{ fontSize: "12px", color: "var(--color-error)", margin: "0 0 12px 0" }}>{error}</p>
        )}

        <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "var(--foreground)", marginBottom: "6px" }}>
          {t("skills.skillDescription")}
        </label>
        <textarea
          placeholder={t("skills.skillDescriptionPlaceholder")}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
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
            marginBottom: "20px",
          }}
        />

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button
            onClick={onCancel}
            disabled={creating}
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
            onClick={handleSubmit}
            disabled={creating}
            style={{
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: 500,
              color: "var(--primary-foreground)",
              backgroundColor: "var(--primary)",
              border: "none",
              borderRadius: "8px",
              cursor: creating ? "wait" : "pointer",
              opacity: creating ? 0.7 : 1,
            }}
          >
            {creating ? t("common.creating") : t("skills.create")}
          </button>
        </div>
      </div>
    </div>
  );
}
