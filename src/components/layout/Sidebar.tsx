import { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { useTranslation } from "@/i18n";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { openUrl } from "@tauri-apps/plugin-opener";
import { checkUpdate } from "@/services/updater";
import { AuthButton } from "@/components/auth/AuthButton";
import { UpdateInfo } from "@/types";
import { getSidebarChromeMetrics } from "./sidebarChrome";
import { Sparkles, Wrench, Store, Cog, MessageCircle } from "lucide-react";

const navItems = [
  { path: "/", labelKey: "nav.skills" as const, icon: Sparkles },
  { path: "/tools", labelKey: "nav.tools" as const, icon: Wrench },
  { path: "/marketplace", labelKey: "nav.marketplace" as const, icon: Store },
  { path: "/settings", labelKey: "nav.settings" as const, icon: Cog },
  { path: "/feedback", labelKey: "nav.feedback" as const, icon: MessageCircle },
];

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
      className="flex flex-col h-full bg-sidebar border-r border-sidebar-border shrink-0"
      style={{ width: 180, minWidth: 180 }}
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
        <span className="text-sm font-semibold text-foreground tracking-tight">SkillX</span>
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
      <nav className="flex-1 px-2" style={{ padding: chromeMetrics.navPadding }}>
        <ul className="list-none m-0 p-0 space-y-0.5">
          {navItems.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] no-underline transition-all duration-150 ${
                    isActive
                      ? "font-medium text-foreground bg-sidebar-accent"
                      : "text-muted-foreground hover:text-foreground hover:bg-black/[0.03]"
                  }`
                }
              >
                <item.icon size={15} strokeWidth={1.8} />
                <span>{t(item.labelKey)}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Bottom section */}
      <div className="px-2 py-3 border-t border-sidebar-border">
        <AuthButton variant="sidebar" />
      </div>
    </aside>
  );
}
