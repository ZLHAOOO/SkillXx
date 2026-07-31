import { useEffect, useState } from "react";
import type { Tool } from "@/types";
import { useTranslation } from "@/i18n";
import { getToolIconUrl, GenericToolIcon } from "@/assets/tools";
import { HermesProfilesDialog } from "./HermesProfilesDialog";

interface HermesGroupCardProps {
  /** Hermes profile tools (id === "hermes" or id starts with "hermes-"). */
  tools: Tool[];
  /** Open the per-tool skills editor for the given profile id. */
  onManageProfile: (profileId: string) => void;
  /** Toggle enabled state for a single profile. */
  onToggleProfile: (profileId: string, enabled: boolean) => void;
}

/**
 * Compact, single-card representation of every installed Hermes profile.
 * Replaces a row of visually-identical "hermes / …" cards with one entry
 * whose icon carries a count badge. The actual per-profile management
 * (enable/disable, skills editor) lives behind the "管理配置文件" dialog.
 */
export function HermesGroupCard({
  tools,
  onManageProfile,
  onToggleProfile,
}: HermesGroupCardProps) {
  const { t } = useTranslation();
  const [dialogOpen, setDialogOpen] = useState(false);

  // Order profiles by their directory suffix so the preview is stable.
  const sortedTools = [...tools].sort((a, b) => a.id.localeCompare(b.id));
  const count = sortedTools.length;
  const detected = sortedTools.some((tool) => tool.detected);
  const iconUrl = getToolIconUrl("hermes");

  // "Hermes / tianxuan" → "tianxuan"
  const profileNames = sortedTools.map((tool) => {
    const sep = tool.name.indexOf(" / ");
    return sep >= 0 ? tool.name.slice(sep + 3) : tool.name;
  });
  const preview = profileNames.slice(0, 3).join(", ");
  const hasMore = profileNames.length > 3;

  // Close the dialog on Escape.
  useEffect(() => {
    if (!dialogOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDialogOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialogOpen]);

  return (
    <>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          padding: "18px 20px",
          backgroundColor: "var(--secondary)",
          borderRadius: "14px",
          border: "1px solid var(--border)",
          transition: "box-shadow 0.2s, transform 0.2s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = "0 8px 25px rgba(0,0,0,0.12)";
          e.currentTarget.style.transform = "scale(1.02)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = "none";
          e.currentTarget.style.transform = "scale(1)";
        }}
      >
        {/* Top: Icon + Title + Manage button */}
        <div
          style={{
            display: "flex",
            gap: "14px",
            alignItems: "flex-start",
          }}
        >
          <div style={{ position: "relative", flexShrink: 0 }}>
            {iconUrl ? (
              <img
                src={iconUrl}
                alt="Hermes"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  objectFit: "cover",
                  display: "block",
                }}
              />
            ) : (
              <GenericToolIcon />
            )}
            {count > 0 && (
              <div
                aria-label={`${count} profiles`}
                style={{
                  position: "absolute",
                  top: -6,
                  right: -6,
                  minWidth: 20,
                  height: 20,
                  padding: "0 6px",
                  borderRadius: 10,
                  backgroundColor: "#000",
                  color: "#fff",
                  fontSize: "11px",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  lineHeight: 1,
                  boxShadow: "0 0 0 2px var(--secondary)",
                }}
              >
                {count}
              </div>
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "4px",
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  fontSize: "15px",
                  fontWeight: 600,
                  color: "var(--foreground)",
                  lineHeight: 1.3,
                }}
              >
                Hermes
              </span>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 500,
                  padding: "2px 8px",
                  borderRadius: "6px",
                  backgroundColor: detected
                    ? "var(--color-success-bg)"
                    : "var(--secondary)",
                  color: detected
                    ? "var(--color-success)"
                    : "var(--muted-foreground)",
                  border: detected
                    ? "1px solid var(--color-success-border)"
                    : "1px solid var(--border)",
                }}
              >
                {detected
                  ? t("tools.detectedStatus")
                  : t("tools.notDetected")}
              </span>
            </div>
            <p
              style={{
                fontSize: "13px",
                color: "var(--muted-foreground)",
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              {t("tools.hermesProfileCount").replace("{count}", String(count))}
              {preview ? ` · ${preview}${hasMore ? " …" : ""}` : ""}
            </p>
          </div>

          <button
            onClick={() => setDialogOpen(true)}
            title={t("tools.hermesManageProfiles")}
            aria-label={t("tools.hermesManageProfiles")}
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
              cursor: "pointer",
              flexShrink: 0,
              marginTop: "2px",
              transition: "background-color 0.15s, color 0.15s, border-color 0.15s",
            }}
            onMouseEnter={(e) => {
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
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {dialogOpen && (
        <HermesProfilesDialog
          tools={sortedTools}
          onClose={() => setDialogOpen(false)}
          onManageProfile={(profileId) => {
            setDialogOpen(false);
            onManageProfile(profileId);
          }}
          onToggleProfile={onToggleProfile}
        />
      )}
    </>
  );
}
