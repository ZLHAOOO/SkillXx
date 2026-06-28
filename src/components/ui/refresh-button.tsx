import { useState } from "react";
import { useTranslation } from "../../i18n";

interface RefreshButtonProps {
  onClick: () => void;
  loading?: boolean;
}

export function RefreshButton({ onClick, loading = false }: RefreshButtonProps) {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState(false);

  return (
    <div style={{ position: "relative", display: "inline-flex" }}>
      <button
        onClick={onClick}
        disabled={loading}
        onMouseEnter={(e) => {
          setHovered(true);
          if (!loading) {
            e.currentTarget.style.color = "var(--foreground)";
          }
        }}
        onMouseLeave={(e) => {
          setHovered(false);
          e.currentTarget.style.color = "var(--muted-foreground)";
        }}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "32px",
          height: "32px",
          fontSize: "13px",
          fontWeight: 400,
          color: "var(--muted-foreground)",
          background: "transparent",
          border: "none",
          borderRadius: "8px",
          cursor: loading ? "not-allowed" : "pointer",
          transition: "color 0.15s, background-color 0.15s",
          opacity: loading ? 0.6 : 1,
        }}
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          style={{
            animation: loading ? "spin 1s linear infinite" : "none",
          }}
        >
          <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16M8 16H3v5" />
        </svg>
      </button>
      {/* Tooltip */}
      {hovered && !loading && (
        <div
          style={{
            position: "absolute",
            bottom: "-28px",
            left: "50%",
            transform: "translateX(-50%)",
            padding: "3px 8px",
            fontSize: "11px",
            fontWeight: 500,
            color: "var(--background)",
            backgroundColor: "var(--foreground)",
            borderRadius: "4px",
            whiteSpace: "nowrap",
            pointerEvents: "none",
            zIndex: 100,
          }}
        >
          {t("common.refresh")}
        </div>
      )}
    </div>
  );
}
