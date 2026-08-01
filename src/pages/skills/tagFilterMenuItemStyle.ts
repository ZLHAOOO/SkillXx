import type { CSSProperties } from "react";

/** Style for one entry in the tag filter dropdown, highlighted when selected. */
export function buildTagFilterMenuItemStyle(active: boolean): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    width: "100%",
    padding: "8px 10px",
    fontSize: "12px",
    fontWeight: 500,
    color: active ? "var(--primary)" : "var(--foreground)",
    backgroundColor: active ? "color-mix(in srgb, var(--primary) 8%, transparent)" : "var(--background)",
    border: active ? "1px solid color-mix(in srgb, var(--primary) 28%, transparent)" : "1px solid var(--border)",
    borderRadius: "8px",
    cursor: "pointer",
    textAlign: "left",
  };
}
