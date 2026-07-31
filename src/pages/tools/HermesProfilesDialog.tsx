import { useEffect } from "react";
import type { Tool } from "@/types";
import { useTranslation } from "@/i18n";
import { Toggle } from "@/components/ui/toggle";

interface HermesProfilesDialogProps {
  tools: Tool[];
  onClose: () => void;
  /** Open the per-tool skills editor for the given profile id. */
  onManageProfile: (profileId: string) => void;
  /** Toggle enabled state for a single profile. */
  onToggleProfile: (profileId: string, enabled: boolean) => void;
}

/**
 * Modal listing every Hermes profile. Each row exposes the profile's
 * own enable toggle and a "管理 Skills" button that hands control back
 * up to the parent (which closes this dialog and opens the skills editor).
 */
export function HermesProfilesDialog({
  tools,
  onClose,
  onManageProfile,
  onToggleProfile,
}: HermesProfilesDialogProps) {
  const { t } = useTranslation();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

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
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(560px, 92vw)",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          background: "var(--background)",
          border: "1px solid var(--border)",
          borderRadius: "16px",
          boxShadow: "0 24px 64px -12px rgba(0, 0, 0, 0.25)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 600, color: "var(--foreground)" }}>
            {t("tools.hermesManageProfiles")}
          </h2>
          <button
            onClick={onClose}
            title={t("common.cancel")}
            aria-label={t("common.cancel")}
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
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div style={{ overflow: "auto", padding: "8px 8px" }}>
          {tools.map((tool) => {
            const sep = tool.name.indexOf(" / ");
            const profileLabel = sep >= 0 ? tool.name.slice(sep + 3) : tool.name;
            return (
              <div
                key={tool.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "10px 12px",
                  borderRadius: "10px",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "13px", fontWeight: 500, color: "var(--foreground)" }}>
                    {profileLabel}
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--muted-foreground)", marginTop: "2px", wordBreak: "break-all" }}>
                    ID: {tool.id}
                  </div>
                </div>
                <Toggle
                  checked={tool.config.enabled}
                  onChange={(enabled) => onToggleProfile(tool.id, enabled)}
                />
                <button
                  onClick={() => onManageProfile(tool.id)}
                  disabled={!tool.detected || !tool.config.enabled}
                  title={
                    !tool.detected
                      ? t("skills.toolNotDetected")
                      : !tool.config.enabled
                        ? t("tools.skillsManageDisabled")
                        : t("tools.manageSkills")
                  }
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "28px",
                    height: "28px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    background: "var(--background)",
                    color: "var(--muted-foreground)",
                    cursor: !tool.detected || !tool.config.enabled ? "not-allowed" : "pointer",
                    opacity: !tool.detected || !tool.config.enabled ? 0.5 : 1,
                    flexShrink: 0,
                    transition: "background-color 0.15s, color 0.15s, border-color 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    if (!tool.detected || !tool.config.enabled) return;
                    e.currentTarget.style.backgroundColor = "var(--muted)";
                    e.currentTarget.style.color = "var(--foreground)";
                    e.currentTarget.style.borderColor = "var(--ring)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--background)";
                    e.currentTarget.style.color = "var(--muted-foreground)";
                    e.currentTarget.style.borderColor = "var(--border)";
                  }}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M12 3L13.5 8.5L19 10L13.5 11.5L12 17L10.5 11.5L5 10L10.5 8.5L12 3Z" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
