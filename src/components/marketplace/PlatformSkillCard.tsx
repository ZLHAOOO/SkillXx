import type { PlatformSkill } from "@/types";

interface PlatformSkillCardProps {
  skill: PlatformSkill;
  onInstall: (skill: PlatformSkill) => void;
  installing: boolean;
}

export function PlatformSkillCard({ skill, onInstall, installing }: PlatformSkillCardProps) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      padding: "16px",
      backgroundColor: "var(--secondary)",
      borderRadius: "10px",
      border: "1px solid var(--border)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: "14px",
            fontWeight: 600,
            color: "var(--foreground)",
            marginBottom: "4px",
          }}>
            {skill.name}
          </div>
          <div style={{
            fontSize: "12px",
            color: "var(--muted-foreground)",
            marginBottom: "8px",
          }}>
            by {skill.author}
          </div>
        </div>
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
          fontSize: "11px",
          color: "var(--muted-foreground)",
          padding: "4px 8px",
          backgroundColor: "var(--background)",
          borderRadius: "6px",
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          {skill.downloads.toLocaleString()}
        </div>
      </div>

      <p style={{
        fontSize: "12px",
        color: "var(--muted-foreground)",
        margin: "0 0 12px 0",
        lineHeight: 1.5,
        display: "-webkit-box",
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
      }}>
        {skill.description || "No description available"}
      </p>

      <button
        onClick={() => onInstall(skill)}
        disabled={installing}
        style={{
          alignSelf: "flex-start",
          padding: "6px 14px",
          fontSize: "12px",
          fontWeight: 500,
          color: "var(--primary-foreground)",
          backgroundColor: "var(--primary)",
          border: "none",
          borderRadius: "6px",
          cursor: installing ? "not-allowed" : "pointer",
          opacity: installing ? 0.6 : 1,
          transition: "opacity 0.15s",
        }}
      >
        {installing ? "安装中..." : "安装"}
      </button>
    </div>
  );
}
