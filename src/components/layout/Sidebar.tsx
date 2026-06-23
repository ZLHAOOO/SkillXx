import { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { useTranslation } from "@/i18n";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { openUrl } from "@tauri-apps/plugin-opener";
import { checkUpdate } from "@/services/updater";
import { UpdateInfo } from "@/types";
import { getSidebarChromeMetrics } from "./sidebarChrome";
import { Sparkles, Bot, Store, Cog, Brain, ChevronLeft, ChevronRight, type LucideIcon } from "lucide-react";
import logoImg from "../../../assets/logo.png";

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

function SidebarNavButton({ item, label, collapsed }: { item: NavItem; label: string; collapsed: boolean }) {
  const [hovered, setHovered] = useState(false);
  const Icon = item.icon;

  return (
    <NavLink
      to={item.path}
      end={item.path === "/"}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={collapsed ? label : undefined}
      style={({ isActive }) => {
        const backgroundColor = isActive
          ? "color-mix(in srgb, var(--foreground) 10%, transparent)"
          : hovered
            ? "color-mix(in srgb, var(--foreground) 6%, transparent)"
            : "transparent";
        return {
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: collapsed ? "9px" : "9px 14px",
          justifyContent: collapsed ? "center" : "flex-start",
          width: collapsed ? "36px" : undefined,
          fontSize: "13px",
          fontWeight: isActive ? 600 : 500,
          color: isActive
            ? "var(--primary)"
            : hovered
              ? "var(--foreground)"
              : "var(--muted-foreground)",
          backgroundColor,
          borderRadius: "9999px",
          textDecoration: "none",
          boxShadow: "none",
          transition: "background-color 0.15s ease, color 0.15s ease",
          cursor: "pointer",
        };
      }}
    >
      {({ isActive }) => (
        <>
          <Icon
            size={18}
            strokeWidth={isActive ? 2.2 : 1.8}
            style={{ flexShrink: 0 }}
          />
          {!collapsed && (
            <span
              style={{
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {label}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
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
      className="flex flex-col h-full shrink-0 glass-sidebar"
      style={{
        width: collapsed ? 56 : 180,
        minWidth: collapsed ? 56 : 180,
        transition: "width 0.2s ease, min-width 0.2s ease",
      }}
    >
      {/* Draggable titlebar region for macOS — empty spacer for traffic lights */}
      <div
        onMouseDown={() => getCurrentWindow().startDragging()}
        style={{
          height: chromeMetrics.topSpacerHeight,
          minHeight: chromeMetrics.topSpacerHeight,
          cursor: "grab",
        }}
      />

      {/* Brand: icon + name (expanded) / icon only (collapsed) */}
      <div
        className="flex items-center gap-2"
        style={{
          padding: collapsed ? "8px 0" : "6px 14px",
          justifyContent: collapsed ? "center" : "flex-start",
        }}
      >
        <img
          src={logoImg}
          alt="SkillX"
          style={{
            width: collapsed ? 42 : 48,
            height: collapsed ? 42 : 48,
            flexShrink: 0,
            borderRadius: "4px",
          }}
        />
        {!collapsed && (
          <span style={{ fontSize: "15px", fontWeight: 700, fontFamily: "'Inter', sans-serif", letterSpacing: "-0.02em" }}>SkillX</span>
        )}
      </div>

      {!collapsed && updateInfo?.has_update && (
        <div style={{ padding: "0 14px 4px 14px", marginTop: -4 }}>
          <button
            onClick={handleUpdateClick}
            className="text-[10px] px-2 py-0.5 rounded-full font-medium hover:opacity-80 transition-opacity cursor-pointer"
            style={{
              background: "color-mix(in srgb, var(--primary) 15%, transparent)",
              color: "var(--primary)",
            }}
            title={`New version available: ${updateInfo.latest_version}`}
          >
            Update
          </button>
        </div>
      )}

      {/* Navigation — centered, shifted up ~2 icon heights */}
      <div className="flex-1 relative flex items-center justify-center">
        <nav
          className="flex flex-col"
          style={{
            padding: collapsed ? "8px 10px" : "6px 14px",
            gap: "6px",
            width: "100%",
            marginTop: "-56px",
            alignItems: collapsed ? "center" : "stretch",
          }}
        >
          {navItems.map((item) => (
            <SidebarNavButton key={item.path} item={item} label={t(item.labelKey)} collapsed={collapsed} />
          ))}
        </nav>
      </div>

      {/* Collapse/Expand toggle */}
      <div
        className="flex items-center justify-center py-2 cursor-pointer"
        style={{ padding: collapsed ? "8px 0" : "8px 14px" }}
        onClick={onToggle}
      >
        {collapsed ? (
          <ChevronRight size={16} style={{ color: "var(--muted-foreground)" }} />
        ) : (
          <ChevronLeft size={16} style={{ color: "var(--muted-foreground)" }} />
        )}
      </div>
    </aside>
  );
}
