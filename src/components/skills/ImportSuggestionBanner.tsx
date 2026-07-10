import { useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Sparkles, X, Loader2 } from "lucide-react";
import { useTranslation } from "@/i18n";
import type { AppConfig } from "@/types";

interface ScannedSkill {
  id: string;
  name: string;
  path: string;
}

/**
 * Post-onboarding replacement for the old "Import existing skills" wizard step.
 *
 * Behavior:
 *  - Mounts silently. On first launch, scans for skills already installed under
 *    users' existing AI tools (Claude Code, Codex, etc.).
 *  - If none found, or user previously dismissed permanently, renders nothing.
 *  - Otherwise renders a top banner with three actions: import all, hide for
 *    this session, or never show again (persisted in preferences).
 *  - After a successful import, fires a `skillx:skills-changed` event so the
 *    Skills grid reloads without needing a manual refresh.
 */
export function ImportSuggestionBanner() {
  const { t } = useTranslation();
  const [skills, setSkills] = useState<ScannedSkill[]>([]);
  const [visible, setVisible] = useState(false);
  const [importing, setImporting] = useState(false);

  // Session-only hide (Later button); persistent hide (Don't show again)
  // lives in preferences.import_suggestion_dismissed.
  const [sessionHidden, setSessionHidden] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function scan() {
      try {
        const config = await invoke<AppConfig>("get_config");
        if (config.preferences?.import_suggestion_dismissed) return;

        const found = await invoke<ScannedSkill[]>("scan_existing_skills");
        const filtered = found.filter((s) => !s.name.startsWith("."));
        if (cancelled) return;
        if (filtered.length > 0) {
          setSkills(filtered);
          setVisible(true);
        }
      } catch (err) {
        // Silent — scanning is best-effort; if it fails the user can trigger
        // it later from Settings.
        console.warn("[ImportSuggestionBanner] scan failed:", err);
      }
    }
    void scan();
    return () => {
      cancelled = true;
    };
  }, []);

  const persistDismiss = useCallback(async () => {
    try {
      const config = await invoke<AppConfig>("get_config");
      const nextConfig = {
        ...config,
        preferences: {
          ...config.preferences,
          import_suggestion_dismissed: true,
        },
      };
      await invoke("save_config", { config: nextConfig });
    } catch (err) {
      console.warn("[ImportSuggestionBanner] could not persist dismiss:", err);
    }
  }, []);

  const handleImport = useCallback(async () => {
    if (skills.length === 0) return;
    setImporting(true);
    try {
      await invoke("import_skills_to_hub", {
        skillPaths: skills.map((s) => s.path),
      });
      await persistDismiss();
      setVisible(false);
      window.dispatchEvent(new Event("skillx:skills-changed"));
    } catch (err) {
      console.error("Failed to import skills:", err);
      alert(t("importBanner.importFailed") + ": " + String(err));
    } finally {
      setImporting(false);
    }
  }, [skills, persistDismiss, t]);

  const handleLater = () => setSessionHidden(true);

  const handleNeverShow = async () => {
    await persistDismiss();
    setVisible(false);
  };

  if (!visible || sessionHidden) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        margin: "12px 20px 0",
        padding: "10px 14px",
        borderRadius: "10px",
        border: "1px solid color-mix(in srgb, var(--primary) 30%, transparent)",
        backgroundColor: "color-mix(in srgb, var(--primary) 8%, transparent)",
        fontSize: "13px",
        color: "var(--foreground)",
      }}
    >
      <Sparkles style={{ width: 18, height: 18, color: "var(--primary)", flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 500, marginBottom: 2 }}>
          {t("importBanner.title").replace("{count}", String(skills.length))}
        </div>
        <div style={{ fontSize: "12px", color: "var(--muted-foreground)" }}>
          {t("importBanner.subtitle")}
        </div>
      </div>
      <button
        onClick={handleImport}
        disabled={importing}
        style={{
          height: 32,
          padding: "0 14px",
          fontSize: 13,
          fontWeight: 500,
          color: "var(--primary-foreground)",
          backgroundColor: "var(--primary)",
          border: "none",
          borderRadius: 8,
          cursor: importing ? "not-allowed" : "pointer",
          opacity: importing ? 0.6 : 1,
          display: "flex",
          alignItems: "center",
          gap: 6,
          flexShrink: 0,
        }}
      >
        {importing && <Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} />}
        {importing ? t("importBanner.importing") : t("importBanner.importAll")}
      </button>
      <button
        onClick={handleLater}
        disabled={importing}
        style={{
          height: 32,
          padding: "0 12px",
          fontSize: 13,
          color: "var(--muted-foreground)",
          background: "transparent",
          border: "1px solid var(--border)",
          borderRadius: 8,
          cursor: importing ? "not-allowed" : "pointer",
          flexShrink: 0,
        }}
      >
        {t("importBanner.later")}
      </button>
      <button
        onClick={handleNeverShow}
        disabled={importing}
        title={t("importBanner.neverShow")}
        aria-label={t("importBanner.neverShow")}
        style={{
          width: 28,
          height: 28,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
          border: "none",
          borderRadius: 6,
          cursor: importing ? "not-allowed" : "pointer",
          color: "var(--muted-foreground)",
          flexShrink: 0,
        }}
      >
        <X style={{ width: 16, height: 16 }} />
      </button>
    </div>
  );
}
