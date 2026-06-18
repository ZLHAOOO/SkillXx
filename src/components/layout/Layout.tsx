import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { Sidebar } from "./Sidebar";
import { SyncReport, LinkReport } from "@/types";
import { useTranslation } from "@/i18n";

export function Layout() {
  const { t } = useTranslation();
  const [remainingIssues, setRemainingIssues] = useState<number>(0);
  const [autoFixedCount, setAutoFixedCount] = useState<number>(0);
  const [showBanner, setShowBanner] = useState(false);
  const [fixing, setFixing] = useState(false);

  useEffect(() => {
    void autoCheckAndFix();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function autoCheckAndFix() {
    try {
      const report = await invoke<SyncReport>("check_sync_status");
      if (report.issues_count === 0) return;

      const result = await invoke<LinkReport>("fix_sync_issues");
      if (result.failed.length === 0) return;

      setAutoFixedCount(result.success.length);
      setRemainingIssues(result.failed.length);
      setShowBanner(true);
    } catch (err) {
      console.error("Failed to auto-fix sync issues:", err);
    }
  }

  async function handleRetry() {
    setFixing(true);
    try {
      const result = await invoke<LinkReport>("fix_sync_issues");
      if (result.failed.length === 0) {
        setShowBanner(false);
      } else {
        setAutoFixedCount((prev) => prev + result.success.length);
        setRemainingIssues(result.failed.length);
      }
    } catch (err) {
      console.error("Failed to fix sync issues:", err);
    } finally {
      setFixing(false);
    }
  }

  return (
    <div
      className="flex h-screen relative"
      style={{ backgroundColor: "#f0f0f0" }}
    >
      {/* Drag region for macOS - covers entire top area including main content */}
      <div
        data-tauri-drag-region
        className="absolute top-0 left-0 right-0 pointer-events-none cursor-grab"
        style={{
          height: 52,
          zIndex: 100,
          WebkitAppRegion: "drag",
        } as React.CSSProperties}
      />

      {/* Sidebar - lower layer */}
      <Sidebar />

      {/* Main content - elevated card */}
      <main
        className="flex-1 overflow-auto relative"
        style={{
          margin: "8px 8px 8px 0",
          backgroundColor: "var(--background)",
          borderRadius: "12px",
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)",
        }}
      >
        {showBanner && (
          <div className="absolute top-0 left-0 right-0 px-6 py-3 bg-yellow-50 border-b border-yellow-200 flex items-center justify-between z-50" style={{ borderRadius: "12px 12px 0 0" }}>
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ca8a04" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span className="text-sm text-yellow-800">
                {autoFixedCount > 0
                  ? t("sync.autoFixPartial")
                      .replace("{success}", String(autoFixedCount))
                      .replace("{failed}", String(remainingIssues))
                  : t("sync.issuesDetected").replace("{count}", String(remainingIssues))}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleRetry}
                disabled={fixing}
                className="px-3 py-1.5 text-[13px] font-medium text-white bg-yellow-600 rounded-md cursor-pointer hover:bg-yellow-700 disabled:cursor-wait disabled:opacity-70"
              >
                {fixing ? t("sync.fixing") : t("sync.retryFix")}
              </button>
              <button
                onClick={() => setShowBanner(false)}
                className="p-1.5 bg-transparent border-none cursor-pointer text-yellow-800 opacity-60 hover:opacity-100"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}
        <Outlet />
      </main>
    </div>
  );
}
