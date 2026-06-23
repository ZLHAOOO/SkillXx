import { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { useTranslation } from "@/i18n";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { openUrl } from "@tauri-apps/plugin-opener";
import { checkUpdate } from "@/services/updater";
import { UpdateInfo } from "@/types";
import { getSidebarChromeMetrics } from "./sidebarChrome";
import { Sparkles, Bot, Store, Cog, Brain, type LucideIcon } from "lucide-react";

interface NavItem {
  path: string;
  labelKey: "nav.skills" | "nav.agents" | "nav.marketplace" | "nav.llmModel" | "nav.settings";
  icon: LucideIcon;
}

const navItems: NavItem[] = [
  { path: "/tools", labelKey: "nav.agents", icon: Bot },
  { path: "/", labelKey: "nav.skills", icon: Sparkles },
  { path: "/llm-model", labelKey: "nav.llmModel", icon: Brain },
  { path: "/marketplace", labelKey: "nav.marketplace", icon: Store },
  { path: "/settings", labelKey: "nav.settings", icon: Cog },
];

function SidebarNavButton({ item, label }: { item: NavItem; label: string }) {
  const [hovered, setHovered] = useState(false);
  const Icon = item.icon;

  return (
    <NavLink
      to={item.path}
      end={item.path === "/"}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={({ isActive }) => {
        const backgroundColor = isActive
          ? "var(--foreground)"
          : hovered
            ? "color-mix(in srgb, var(--foreground) 6%, transparent)"
            : "transparent";
        return {
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "9px 12px",
          fontSize: "13px",
          fontWeight: isActive ? 600 : 500,
          color: isActive
            ? "var(--primary-foreground)"
            : hovered
              ? "var(--foreground)"
              : "var(--muted-foreground)",
          backgroundColor,
          borderRadius: "9999px",
          textDecoration: "none",
          boxShadow: isActive ? "0 1px 2px rgba(15, 23, 42, 0.12)" : "none",
          transition: "background-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease",
          cursor: "pointer",
        };
      }}
    >
      {({ isActive }) => (
        <>
          <Icon
            size={16}
            strokeWidth={isActive ? 2.2 : 1.8}
            style={{ flexShrink: 0 }}
          />
          <span
            style={{
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {label}
          </span>
        </>
      )}
    </NavLink>
  );
}

export function Sidebar() {
  const { t } = useTranslation();
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    checkUpdate()
      .then((info) => {
        if (info.has_update) setUpdateInfo(info);
      })
      .catch((err) => console.warn("Failed to check for updates:", err));
  }, []);

  const handleUpdateClick = async () => {
    if (updateInfo?.download_url) await openUrl(updateInfo.download_url);
  };

  const chromeMetrics = getSidebarChromeMetrics(
    typeof navigator === "undefined" ? "" : navigator.userAgent,
  );

  return (
    <aside
      className="flex flex-col h-full shrink-0"
      style={{
        width: 180,
        minWidth: 180,
        backgroundColor: "var(--sidebar)",
      }}
    >
      {/* Draggable titlebar region for macOS */}
      <div
        onMouseDown={() => getCurrentWindow().startDragging()}
        style={{
          height: chromeMetrics.topSpacerHeight,
          minHeight: chromeMetrics.topSpacerHeight,
          cursor: "grab",
        }}
      />

      {/* App name */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ padding: chromeMetrics.brandPadding }}
      >
        <span style={{ fontSize: "15px", fontWeight: 700, fontFamily: "'Inter', sans-serif", letterSpacing: "-0.02em" }}>SkillX</span>
        {updateInfo?.has_update && (
          <button
            onClick={handleUpdateClick}
            className="text-[10px] px-2 py-0.5 bg-primary text-primary-foreground rounded-full font-medium hover:opacity-90 transition-opacity cursor-pointer"
            title={`New version available: ${updateInfo.latest_version}`}
          >
            Update
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav
        className="flex-1 flex flex-col"
        style={{ padding: chromeMetrics.navPadding, gap: "6px" }}
      >
        {navItems.map((item) => (
          <SidebarNavButton key={item.path} item={item} label={t(item.labelKey)} />
        ))}
      </nav>
    </aside>
  );
}
