import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  AppConfig,
  UserPreferences,
  DetectedEditor,
  UpdateInfo,
  MarketplaceSource,
} from "@/types";
import { defaultPreferences } from "@/constants/preferences";
import { checkUpdate, downloadAndInstall } from "@/services/updater";
import { useTranslation, Language } from "@/i18n";
import { useTheme } from "@/hooks/useTheme";
import { resolveTelemetryConsent } from "@/telemetry/consent";
import { getEditorIcon } from "@/assets/editors";
import { FontFamilyPreset, normalizeFontFamilyPreset } from "@/lib/fontFamily";

import { Toggle } from "@/components/ui/toggle";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/page-header";
import { ToastContainer, useToast } from "@/components/ui/toast";
import { SunIcon, MoonIcon, MonitorIcon } from "@/components/icons/theme-icons";
import { ChevronDown } from "lucide-react";
import { resolveActiveProjectId } from "./projectBindings";

export function Settings() {
  const { t, language, setLanguage } = useTranslation();
  const { setTheme, setThemeStyle, setFontFamily } = useTheme();
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [editorDropdownOpen, setEditorDropdownOpen] = useState(false);
  const [availableEditors, setAvailableEditors] = useState<DetectedEditor[]>([]);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<{ percent: number; status: string } | null>(null);
  const [llmProviders, setLlmProviders] = useState<Array<{ id: string; name: string; model: string }>>([]);
  const { toasts, addToast, removeToast } = useToast();

  const tRef = useRef(t);
  const addToastRef = useRef(addToast);
  useEffect(() => {
    tRef.current = t;
    addToastRef.current = addToast;
  });

  const fetchConfig = useCallback(async () => {
    setError(null);
    try {
      const configResult = await invoke<AppConfig>("get_config");
      configResult.preferences = {
        ...defaultPreferences,
        ...(configResult.preferences ?? {}),
      };
      const nextActiveProjectId = resolveActiveProjectId(configResult.active_project_id, configResult.projects ?? []);
      if (nextActiveProjectId !== configResult.active_project_id) {
        addToastRef.current(tRef.current("settings.currentProjectMissing"), "info");
      }
      setConfig({ ...configResult, active_project_id: nextActiveProjectId });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  useEffect(() => {
    async function loadEditors() {
      try {
        const editors = await invoke<DetectedEditor[]>("get_available_editors");
        setAvailableEditors(editors);
      } catch (err) {
        // Error handled silently - editors list will remain empty
      }
    }
    loadEditors();
  }, []);

  // Load LLM providers for translation provider selector
  useEffect(() => {
    async function loadProviders() {
      try {
        const providers = await invoke<Array<{ id: string; name: string; model: string }>>("get_llm_providers");
        setLlmProviders(providers);
      } catch {
        // silently ignore - dropdown will show empty
      }
    }
    loadProviders();
  }, []);

  // Auto-check for updates on mount
  useEffect(() => {
    async function autoCheckUpdate() {
      try {
        const info = await checkUpdate();
        if (info.has_update) {
          setUpdateInfo(info);
        }
      } catch (err) {
        console.error("Failed to auto-check update:", err);
      }
    }
    autoCheckUpdate();
  }, []);

  const updatePreference = useCallback(<K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) => {
    if (!config) return;

    const newConfig = {
      ...config,
      preferences: {
        ...defaultPreferences,
        ...config.preferences,
        [key]: value,
      },
    };
    setConfig(newConfig);

    // If language changed, update the app language immediately
    if (key === "language") {
      setLanguage(value as Language);
    }

    // If theme changed, update the app theme immediately
    if (key === "theme") {
      setTheme(value as "light" | "dark" | "system");
    }

    if (key === "theme_style") {
      setThemeStyle(value as "default" | "apple" | "cyberpunk" | "neumorphism" | "comic");
    }

    if (key === "font_family") {
      setFontFamily(value as FontFamilyPreset);
    }

    // Auto-save to disk (debounced)
    void autoSaveConfig(newConfig);
  }, [config, setLanguage, setTheme, setThemeStyle, setFontFamily]);

  const updateMarketplaceSource = useCallback((
    sourceId: string,
    updates: Partial<MarketplaceSource>
  ) => {
    if (!config) return;
    const sources = config.marketplace_sources || [];
    const updatedSources = sources.map((source) =>
      source.id === sourceId ? { ...source, ...updates } : source
    );
    const newConfig = {
      ...config,
      marketplace_sources: updatedSources,
    };
    setConfig(newConfig);

    // Auto-save to disk (debounced)
    void autoSaveConfig(newConfig);
  }, [config]);

  // Debounced auto-save function
  const autoSaveTimeoutRef = useRef<number | null>(null);
  const saveStatusTimeoutRef = useRef<number | null>(null);
  const autoSaveConfig = useCallback(async (configToSave: AppConfig) => {
    // Clear previous timeout
    if (autoSaveTimeoutRef.current !== null) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    if (saveStatusTimeoutRef.current !== null) {
      clearTimeout(saveStatusTimeoutRef.current);
    }

    // Show saving status immediately
    setSaveStatus('saving');

    // Set new timeout (800ms debounce)
    autoSaveTimeoutRef.current = window.setTimeout(async () => {
      try {
        await invoke("save_config", { config: configToSave });

        // Handle telemetry consent
        const prefs = configToSave.preferences || defaultPreferences;
        const telemetryConsent = resolveTelemetryConsent(prefs.telemetry_consent);
        if (telemetryConsent === "granted") {
          void invoke("telemetry_initialize").catch((err) => {
            console.warn("Failed to initialize telemetry after auto-save:", err);
          });
        } else if (telemetryConsent === "denied") {
          void invoke("telemetry_clear_local_data").catch((err) => {
            console.warn("Failed to clear telemetry after auto-save:", err);
          });
        }

        // Show saved status
        setSaveStatus('saved');

        // Reset to idle after 2 seconds
        saveStatusTimeoutRef.current = window.setTimeout(() => {
          setSaveStatus('idle');
        }, 2000);
      } catch (err) {
        console.error("Auto-save failed:", err);
        setSaveStatus('idle');
        // Show error toast
        addToast(
          err instanceof Error ? err.message : t("settings.saveFailed"),
          "error"
        );
      }
    }, 800);
  }, [addToast, t]);

  const handleCheckUpdate = async () => {
    // If update is already found, start download & install
    if (updateInfo) {
      if (updateInfo.asset_download_url) {
        setDownloadProgress({ percent: 0, status: "downloading" });
        try {
          await downloadAndInstall(updateInfo.asset_download_url, (percent, status) => {
            setDownloadProgress({ percent, status });
          });
          // If downloadAndInstall returns, something went wrong (e.g. non-macOS)
          setDownloadProgress(null);
        } catch (err) {
          setDownloadProgress(null);
          addToast(
            t("settings.updateFailed").replace("{error}", err instanceof Error ? err.message : String(err)),
            "error",
          );
        }
      } else if (updateInfo.download_url) {
        await openUrl(updateInfo.download_url);
      }
      return;
    }

    setCheckingUpdate(true);
    try {
      const info = await checkUpdate();
      if (info.has_update) {
        setUpdateInfo(info);
        addToast(`${t("settings.updateAvailable")}: ${info.latest_version}`, "success");
      } else {
        addToast(t("settings.latestVersion"), "success");
      }
    } catch (err) {
      addToast(err instanceof Error ? err.message : String(err), "error");
    } finally {
      setCheckingUpdate(false);
    }
  };

  if (error) {
    return (
      <div style={{ padding: '24px 32px' }}>
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!config) {
    return (
      <div style={{ padding: '24px 32px', color: 'var(--muted-foreground)' }}>
        {t("common.loading")}
      </div>
    );
  }

  const prefs = config.preferences || defaultPreferences;
  const selectedEditor = availableEditors.find(e => e.id === prefs.default_editor) || availableEditors[0];
  const FallbackEditorIcon = selectedEditor ? getEditorIcon(selectedEditor.id) : null;
  const marketplaceSources = config.marketplace_sources || [];
  const marketplaceRows = marketplaceSources;

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
      backgroundColor: 'var(--background)',
    }}>
      <PageHeader
        title={t("settings.title")}
        actions={
          saveStatus !== 'idle' ? (
            <div style={{
              fontSize: '12px',
              color: saveStatus === 'saved' ? 'var(--color-success)' : 'var(--muted-foreground)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              backgroundColor: saveStatus === 'saved' ? 'rgba(34, 197, 94, 0.1)' : 'var(--muted)',
              borderRadius: '6px',
              transition: 'all 0.2s ease',
            }}>
              {saveStatus === 'saving' ? (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  {t("common.saving")}
                </>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 6L9 17l-5-5"/>
                  </svg>
                  {t("common.saved")}
                </>
              )}
            </div>
          ) : null
        }
      />

      {/* Content */}
      <main style={{
        flex: 1,
        overflow: 'auto',
        padding: '32px',
      }}>
        <div style={{ maxWidth: '680px' }}>
          {/* General Section */}
          <SectionTitle>{t("settings.general")}</SectionTitle>
          <SettingsCard>
            <SettingsRow
              label={t("settings.skillsDirectory")}
              description={t("settings.skillsDirectoryDesc")}
              isLast={false}
            >
              <div style={{ flex: 1, minWidth: 0, display: 'flex', justifyContent: 'flex-end' }}>
                <code
                  title={config.skills_dir}
                  style={{
                  display: 'block',
                  width: '100%',
                  fontSize: '12px',
                  color: 'var(--muted-foreground)',
                  backgroundColor: 'var(--secondary)',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  whiteSpace: 'normal',
                  overflowWrap: 'anywhere',
                  lineHeight: 1.5,
                }}
                >
                  {config.skills_dir}
                </code>
              </div>
            </SettingsRow>

            <SettingsRow
              label={t("settings.defaultEditor")}
              description={t("settings.defaultEditorDesc")}
              isLast={false}
            >
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setEditorDropdownOpen(!editorDropdownOpen)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 12px',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: 'var(--foreground)',
                    backgroundColor: editorDropdownOpen ? 'var(--secondary)' : 'var(--background)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    minWidth: '140px',
                    justifyContent: 'space-between',
                  }}
                >
                  {selectedEditor?.icon_data ? (
                    <img
                      src={selectedEditor.icon_data}
                      alt={selectedEditor.name}
                      style={{ width: 24, height: 24, borderRadius: 6 }}
                    />
                  ) : (
                    FallbackEditorIcon && <FallbackEditorIcon />
                  )}
                  <span>{selectedEditor?.name || t("editors.builtin")}</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 9l6 6 6-6"/>
                  </svg>
                </button>

                {editorDropdownOpen && (
                  <>
                    <div
                      style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 10,
                      }}
                      onClick={() => setEditorDropdownOpen(false)}
                    />
                    <div style={{
                      position: 'absolute',
                      top: 'calc(100% + 4px)',
                      right: 0,
                      backgroundColor: 'var(--background)',
                      border: '1px solid var(--border)',
                      borderRadius: '10px',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                      zIndex: 20,
                      minWidth: '180px',
                      padding: '4px',
                      overflow: 'hidden',
                    }}>
                      {availableEditors.map((editor) => {
                        const FallbackIcon = getEditorIcon(editor.id);
                        return (
                          <button
                            key={editor.id}
                            onClick={() => {
                              updatePreference("default_editor", editor.id);
                              setEditorDropdownOpen(false);
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              width: '100%',
                              padding: '6px 10px',
                              fontSize: '13px',
                              color: 'var(--foreground)',
                              backgroundColor: prefs.default_editor === editor.id ? 'var(--secondary)' : 'transparent',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              textAlign: 'left',
                            }}
                          >
                            {editor.icon_data ? (
                              <img
                                src={editor.icon_data}
                                alt={editor.name}
                                style={{ width: 24, height: 24, borderRadius: 6 }}
                              />
                            ) : (
                              <FallbackIcon />
                            )}
                            <span>{editor.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </SettingsRow>

            <SettingsRow
              label={t("settings.autoSync")}
              description={t("settings.autoSyncDesc")}
              isLast={false}
            >
              <Toggle
                checked={prefs.auto_sync}
                onChange={(v) => updatePreference("auto_sync", v)}
              />
            </SettingsRow>

            <SettingsRow
              label={t("settings.removeLinksWhenDisablingTool")}
              description={t("settings.removeLinksWhenDisablingToolDesc")}
              isLast={false}
            >
              <Toggle
                checked={prefs.remove_links_when_disabling_tool}
                onChange={(v) => updatePreference("remove_links_when_disabling_tool", v)}
              />
            </SettingsRow>

            <SettingsRow
              label={t("settings.syncNotifications")}
              description={t("settings.syncNotificationsDesc")}
              isLast={true}
            >
              <Toggle
                checked={prefs.show_sync_notifications}
                onChange={(v) => updatePreference("show_sync_notifications", v)}
              />
            </SettingsRow>
          </SettingsCard>

          {/* Skill Display Language Section */}
          <SectionTitle>{t("settings.skillDisplayLanguage")}</SectionTitle>
          <SettingsCard>
            <SettingsRow
              label={t("settings.skillDisplayNameLang")}
              description={t("settings.skillDisplayNameLangDesc")}
              isLast={false}
            >
              <div style={{ display: 'flex', gap: '4px', backgroundColor: 'var(--muted)', borderRadius: '6px', padding: '2px' }}>
                {(["original", "zh", "en"] as const).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => updatePreference("skill_display_name_lang", lang)}
                    style={{
                      padding: '5px 10px',
                      fontSize: '12px',
                      fontWeight: 500,
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      backgroundColor: prefs.skill_display_name_lang === lang ? 'var(--background)' : 'transparent',
                      color: prefs.skill_display_name_lang === lang ? 'var(--foreground)' : 'var(--muted-foreground)',
                      boxShadow: prefs.skill_display_name_lang === lang ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                      transition: 'all 0.15s',
                    }}
                  >
                    {lang === "original" ? t("settings.langOriginal") : lang === "zh" ? t("settings.langChinese") : t("settings.langEnglish")}
                  </button>
                ))}
              </div>
            </SettingsRow>

            <SettingsRow
              label={t("settings.skillDisplayDescLang")}
              description={t("settings.skillDisplayDescLangDesc")}
              isLast={false}
            >
              <div style={{ display: 'flex', gap: '4px', backgroundColor: 'var(--muted)', borderRadius: '6px', padding: '2px' }}>
                {(["original", "zh", "en"] as const).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => updatePreference("skill_display_desc_lang", lang)}
                    style={{
                      padding: '5px 10px',
                      fontSize: '12px',
                      fontWeight: 500,
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      backgroundColor: prefs.skill_display_desc_lang === lang ? 'var(--background)' : 'transparent',
                      color: prefs.skill_display_desc_lang === lang ? 'var(--foreground)' : 'var(--muted-foreground)',
                      boxShadow: prefs.skill_display_desc_lang === lang ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                      transition: 'all 0.15s',
                    }}
                  >
                    {lang === "original" ? t("settings.langOriginal") : lang === "zh" ? t("settings.langChinese") : t("settings.langEnglish")}
                  </button>
                ))}
              </div>
            </SettingsRow>

            <SettingsRow
              label={t("settings.translationProvider")}
              description={t("settings.translationProviderDesc")}
              isLast={true}
            >
              <select
                value={prefs.translation_provider_id ?? ""}
                onChange={(e) => updatePreference("translation_provider_id", e.target.value || null)}
                style={{
                  padding: '6px 28px 6px 10px',
                  fontSize: '12px',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  backgroundColor: 'var(--background)',
                  color: 'var(--foreground)',
                  outline: 'none',
                  appearance: 'none',
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 8px center',
                  minWidth: '160px',
                }}
              >
                <option value="">{t("settings.translationProviderNone")}</option>
                {llmProviders.map((p) => (
                  <option key={p.id} value={p.id}>{p.name || p.id}</option>
                ))}
              </select>
            </SettingsRow>
          </SettingsCard>

          {/* Marketplace Section */}
          <SectionTitle>{t("settings.marketplace")}</SectionTitle>
          <SettingsCard>
            <SettingsRow
              label={t("settings.githubToken")}
              description={t("settings.githubTokenDesc")}
              isLast={marketplaceRows.length === 0}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="password"
                  value={prefs.github_token || ""}
                  onChange={(e) => updatePreference("github_token", e.target.value)}
                  placeholder={t("settings.githubTokenPlaceholder")}
                  style={{
                    width: '220px',
                    padding: '8px 10px',
                    fontSize: '12px',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    backgroundColor: 'var(--background)',
                    color: 'var(--foreground)',
                    outline: 'none',
                  }}
                />
                <span style={{
                  fontSize: '12px',
                  color: (prefs.github_token || "").trim() ? 'var(--color-success)' : 'var(--muted-foreground)',
                }}>
                  {(prefs.github_token || "").trim()
                    ? t("settings.marketplaceKeySaved")
                    : t("settings.marketplaceKeyMissing")}
                </span>
              </div>
            </SettingsRow>

            {marketplaceRows.length === 0 ? (
              <div style={{
                padding: '16px 0',
                fontSize: '13px',
                color: 'var(--muted-foreground)',
              }}>
                {t("settings.marketplaceEmpty")}
              </div>
            ) : (
              marketplaceRows.map((source, index) => {
                const isLast = index === marketplaceRows.length - 1;
                const typeLabel = source.source_type === "github_repo"
                  ? t("settings.marketplaceSourceTypeGithub")
                  : source.source_type === "crawler"
                    ? t("settings.marketplaceSourceTypeCrawler")
                    : t("settings.marketplaceSourceTypeApi");
                const isSkillHub = source.id === "skillhub";
                const isRedSkill = source.id === "redskill";
                return (
                  <SettingsRow
                    key={`${source.id}-source`}
                    label={source.name}
                    description={`${typeLabel} · ${source.url}`}
                    isLast={isLast}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {(isSkillHub || isRedSkill) && <CliInstallCell tool={source.id} label={source.name} />}
                      <Toggle
                        checked={source.enabled}
                        onChange={(v) => updateMarketplaceSource(source.id, { enabled: v })}
                      />
                    </div>
                  </SettingsRow>
                );
              })
            )}
          </SettingsCard>

          {/* Appearance Section */}
          <SectionTitle>{t("settings.appearance")}</SectionTitle>
          <SettingsCard>
            <SettingsRow
              label={t("settings.theme")}
              description={t("settings.themeDesc")}
              isLast={false}
            >
              <ThemeSelector
                value={prefs.theme}
                onChange={(v) => updatePreference("theme", v)}
              />
            </SettingsRow>

            <SettingsRow
              label="主题风格"
              description="选择一套视觉主题（5 套可选）"
              isLast={false}
            >
              <SegmentedControl
                value={prefs.theme_style || "default"}
                onChange={(v) => updatePreference("theme_style", v as "default" | "apple" | "cyberpunk" | "neumorphism" | "comic")}
                options={[
                  { value: "default", label: "默认" },
                  { value: "apple", label: "简约" },
                  { value: "cyberpunk", label: "科幻" },
                  { value: "neumorphism", label: "轻拟" },
                  { value: "comic", label: "漫画" },
                ]}
              />
            </SettingsRow>

            <SettingsRow
              label={t("settings.fontFamily")}
              description={t("settings.fontFamilyDesc")}
              isLast={false}
            >
              <SegmentedControl
                value={normalizeFontFamilyPreset(prefs.font_family)}
                onChange={(v) => updatePreference("font_family", normalizeFontFamilyPreset(v))}
                options={[
                  { value: "system", label: t("settings.fontFamilySystem") },
                  { value: "rounded", label: t("settings.fontFamilyRounded") },
                  { value: "serif", label: t("settings.fontFamilySerif") },
                ]}
              />
            </SettingsRow>

            <SettingsRow
              label={t("settings.language")}
              description={t("settings.languageDesc")}
              isLast={false}
            >
              <SegmentedControl
                value={language}
                onChange={(v) => updatePreference("language", v as "en" | "zh")}
                options={[
                  { value: "en", label: "English" },
                  { value: "zh", label: "中文" },
                ]}
              />
            </SettingsRow>
          </SettingsCard>


          {/* Feedback */}
          <SectionTitle>{t("feedback.title")}</SectionTitle>
          <SettingsCard>
            <div style={{ padding: "12px 0" }}>
              <p style={{
                margin: "0 0 16px 0",
                fontSize: "13px",
                lineHeight: 1.7,
                color: "var(--muted-foreground)",
              }}>
                {t("feedback.description")}
              </p>

              <div style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: "16px",
                padding: "14px 0",
              }}>
                <div>
                  <div style={{
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "var(--foreground)",
                    marginBottom: "4px",
                  }}>
                    {t("feedback.issueGithubTitle")}
                  </div>
                  <div style={{
                    fontSize: "13px",
                    lineHeight: 1.6,
                    color: "var(--muted-foreground)",
                  }}>
                    {t("feedback.issueGithubDesc")}
                  </div>
                </div>
                <button
                  onClick={() => void openUrl("https://github.com/ZLHAOOO/SkillXx/issues/new/choose")}
                  style={{
                    padding: "8px 14px",
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "var(--primary-foreground)",
                    backgroundColor: "var(--primary)",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {t("feedback.issueGithubAction")}
                </button>
              </div>

              <FeedbackInlineForm addToast={addToast} t={t} language={language} />

              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                paddingTop: "14px",
                marginTop: "14px",
                borderTop: "1px solid var(--border)",
              }}>
                <span style={{ color: "var(--muted-foreground)", fontSize: "13px", minWidth: "52px" }}>
                  {t("feedback.contact.emailLabel")}
                </span>
                <a
                  href="mailto:zlhaooo@foxmail.com"
                  style={{
                    color: "var(--primary)",
                    textDecoration: "none",
                    fontWeight: 500,
                    fontSize: "13px",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.textDecoration = "underline"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.textDecoration = "none"; }}
                >
                  zlhaooo@foxmail.com
                </a>
              </div>
            </div>
          </SettingsCard>

          {/* About Section */}
          <SectionTitle>{t("settings.about")}</SectionTitle>
          <SettingsCard>
            <div style={{ padding: '16px 0' }}>
              {/* First row: App info and version */}
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                marginBottom: '12px',
              }}>
                <div>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: 500,
                    color: 'var(--foreground)',
                    marginBottom: '2px',
                  }}>
                    <a
                      href="https://github.com/ZLHAOOO/SkillXx"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'inherit', textDecoration: 'none', cursor: 'pointer' }}
                      onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                      onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                    >
                      {t("settings.appName")}
                    </a>
                  </div>
                  <div style={{
                    fontSize: '13px',
                    color: 'var(--muted-foreground)',
                  }}>
                    {t("settings.appDescription")}
                  </div>
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '13px',
                  color: 'var(--muted-foreground)',
                  flexShrink: 0,
                  marginLeft: '16px',
                }}>
                  <span>v{config.version}</span>
                  <button
                    onClick={handleCheckUpdate}
                    disabled={checkingUpdate}
                    style={{
                      padding: '4px 8px',
                      fontSize: '11px',
                      fontWeight: 500,
                      color: updateInfo ? 'var(--primary-foreground)' : 'var(--primary)',
                      backgroundColor: updateInfo ? 'var(--primary)' : 'color-mix(in srgb, var(--primary) 10%, transparent)',
                      border: updateInfo ? 'none' : '1px solid color-mix(in srgb, var(--primary) 20%, transparent)',
                      borderRadius: '4px',
                      cursor: checkingUpdate ? 'wait' : 'pointer',
                      opacity: checkingUpdate ? 0.7 : 1,
                    }}
                  >
                    {checkingUpdate
                      ? t("common.checking")
                      : updateInfo
                        ? t("settings.downloadAndInstall")
                        : t("settings.checkUpdate")
                    }
                  </button>
                </div>
              </div>

              {/* Second row: Privacy policy link */}
              <div style={{ marginBottom: '12px' }}>
                <a
                  href={language === 'zh'
                    ? "https://github.com/ZLHAOOO/SkillXx/blob/main/PRIVACY_CN.md"
                    : "https://github.com/ZLHAOOO/SkillXx/blob/main/PRIVACY.md"
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: '12px',
                    color: 'var(--primary)',
                    textDecoration: 'none',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                  onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                >
                  {t("settings.privacyPolicy")}
                </a>
              </div>

              {/* Third row: Star on GitHub CTA */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                paddingTop: '12px',
                borderTop: '1px solid var(--border)',
              }}>
                <div style={{
                  fontSize: '12px',
                  color: 'var(--muted-foreground)',
                  flex: 1,
                }}>
                  {t("settings.starOnGithubDesc")}
                </div>
                <a
                  href="https://github.com/ZLHAOOO/SkillXx"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: 'var(--primary-foreground)',
                    backgroundColor: 'var(--primary)',
                    border: 'none',
                    borderRadius: '6px',
                    textDecoration: 'none',
                    cursor: 'pointer',
                    transition: 'opacity 0.2s',
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                >
                  <span>⭐</span>
                  <span>{t("settings.starOnGithub")}</span>
                </a>
              </div>
            </div>
          </SettingsCard>
        </div>
      </main>
      {/* Download Progress Dialog */}
      {downloadProgress && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
        }}>
          <div style={{
            backgroundColor: 'var(--card)', borderRadius: '12px', padding: '32px',
            width: '380px', textAlign: 'center', boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          }}>
            <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--foreground)', marginBottom: '16px' }}>
              {downloadProgress.status === 'installing'
                ? t("settings.installingUpdate")
                : t("settings.downloadingUpdate")}
            </div>
            <div style={{
              width: '100%', height: '8px', backgroundColor: 'var(--muted)',
              borderRadius: '4px', overflow: 'hidden', marginBottom: '12px',
            }}>
              <div style={{
                width: `${Math.min(downloadProgress.percent, 100)}%`, height: '100%',
                backgroundColor: 'var(--primary)', borderRadius: '4px',
                transition: 'width 0.3s ease',
              }} />
            </div>
            <div style={{ fontSize: '13px', color: 'var(--muted-foreground)' }}>
              {downloadProgress.status === 'installing'
                ? t("settings.installingUpdate")
                : t("settings.updateProgress").replace("{percent}", Math.round(downloadProgress.percent).toString())}
            </div>
          </div>
        </div>
      )}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}


// --- Feedback Inline Form (embedded in Settings) ---

import { FormEvent } from "react";
import { submitFeedback } from "@/services/feedback";
import {
  FEEDBACK_CONTACT_TYPES,
  FEEDBACK_CONTACT_TYPE_LABEL_KEY_MAP,
  getFeedbackContactValuePlaceholderKey,
  validateFeedbackContact,
} from "@/services/feedbackContact";
import type { FeedbackContactType } from "@/types";

function FeedbackInlineForm({ addToast, t, language }: {
  addToast: (msg: string, type: "error" | "success" | "info", persistent?: boolean) => string;
  t: (key: any) => string;
  language: string;
}) {
  const [contactType, setContactType] = useState<FeedbackContactType | "">("");
  const [contactValue, setContactValue] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedContent = content.trim();
    const contactValidation = validateFeedbackContact(contactType, contactValue);
    if (!contactValidation.ok) {
      addToast(t(contactValidation.errorKey), "error");
      return;
    }
    if (!trimmedContent) {
      addToast(t("feedback.form.contentRequired"), "error");
      return;
    }
    setSubmitting(true);
    try {
      await submitFeedback({
        contact_type: contactValidation.contactType,
        contact_value: contactValidation.contactValue,
        content: trimmedContent,
        source: "desktop-settings",
        language,
      });
      setContactType("");
      setContactValue("");
      setContent("");
      addToast(t("feedback.form.submitSuccess"), "success");
    } catch (err) {
      addToast(
        err instanceof Error ? err.message : t("feedback.form.submitFailed"),
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ padding: "14px 0 18px 0" }}>
      <div style={{
        fontSize: "14px",
        fontWeight: 600,
        color: "var(--foreground)",
        marginBottom: "4px",
      }}>
        {t("feedback.issueDirectTitle")}
      </div>
      <div style={{
        fontSize: "13px",
        lineHeight: 1.6,
        color: "var(--muted-foreground)",
        marginBottom: "12px",
      }}>
        {t("feedback.issueDirectDesc")}
      </div>

      <div style={{
        display: "flex",
        gap: "12px",
        flexWrap: "wrap",
        marginBottom: "8px",
      }}>
        <div style={{ flex: "0 0 180px", minWidth: "180px" }}>
          <label
            htmlFor="feedback-contact-type"
            style={{
              display: "block",
              fontSize: "12px",
              fontWeight: 500,
              color: "var(--foreground)",
              marginBottom: "6px",
            }}
          >
            {t("feedback.form.contactTypeLabel")}
            <span style={{ color: "var(--color-error)", marginLeft: "4px" }}>*</span>
          </label>
          <div style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            borderRadius: "12px",
            border: "1px solid var(--border)",
            background: "linear-gradient(180deg, var(--background) 0%, var(--secondary) 100%)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.55), 0 10px 24px rgba(15,23,42,0.04)",
            minHeight: "44px",
          }}>
            <select
              id="feedback-contact-type"
              value={contactType}
              onChange={(e) => {
                setContactType(e.target.value as FeedbackContactType | "");
                setContactValue("");
              }}
              style={{
                width: "100%",
                padding: "11px 42px 11px 12px",
                fontSize: "13px",
                fontWeight: 500,
                color: "var(--foreground)",
                background: "transparent",
                border: "none",
                outline: "none",
                appearance: "none",
                WebkitAppearance: "none",
                cursor: "pointer",
              }}
            >
              <option value="">{t("feedback.form.contactTypePlaceholder")}</option>
              {FEEDBACK_CONTACT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(FEEDBACK_CONTACT_TYPE_LABEL_KEY_MAP[type])}
                </option>
              ))}
            </select>
            <div style={{
              position: "absolute",
              top: "50%",
              right: "10px",
              transform: "translateY(-50%)",
              width: "24px",
              height: "24px",
              borderRadius: "999px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "var(--secondary)",
              color: "var(--muted-foreground)",
              pointerEvents: "none",
            }}>
              <ChevronDown size={14} strokeWidth={2.1} />
            </div>
          </div>
        </div>

        <div style={{ flex: "1 1 280px", minWidth: "240px" }}>
          <label
            htmlFor="feedback-contact-value"
            style={{
              display: "block",
              fontSize: "12px",
              fontWeight: 500,
              color: "var(--foreground)",
              marginBottom: "6px",
            }}
          >
            {t("feedback.form.contactValueLabel")}
            <span style={{ color: "var(--color-error)", marginLeft: "4px" }}>*</span>
          </label>
          <div style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            borderRadius: "12px",
            border: "1px solid var(--border)",
            background: contactType
              ? "linear-gradient(180deg, var(--background) 0%, var(--secondary) 100%)"
              : "var(--secondary)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.55), 0 10px 24px rgba(15,23,42,0.04)",
            minHeight: "44px",
            opacity: contactType ? 1 : 0.74,
          }}>
            <input
              id="feedback-contact-value"
              type={contactType === "email" ? "email" : "text"}
              inputMode={contactType === "email" ? "email" : "text"}
              disabled={!contactType}
              value={contactValue}
              onChange={(e) => setContactValue(e.target.value)}
              placeholder={t(getFeedbackContactValuePlaceholderKey(contactType))}
              style={{
                width: "100%",
                padding: "11px 12px",
                fontSize: "13px",
                fontWeight: 500,
                color: "var(--foreground)",
                background: "transparent",
                border: "none",
                outline: "none",
                cursor: contactType ? "text" : "not-allowed",
              }}
            />
          </div>
        </div>
      </div>

      <div style={{
        fontSize: "12px",
        lineHeight: 1.6,
        color: "var(--muted-foreground)",
        marginBottom: "12px",
      }}>
        {t("feedback.form.contactHelp")}
      </div>

      <label
        htmlFor="feedback-content"
        style={{
          display: "block",
          fontSize: "12px",
          fontWeight: 500,
          color: "var(--foreground)",
          marginBottom: "6px",
        }}
      >
        {t("feedback.form.contentLabel")}
        <span style={{ color: "var(--color-error)", marginLeft: "4px" }}>*</span>
      </label>
      <textarea
        id="feedback-content"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={t("feedback.form.contentPlaceholder")}
        rows={5}
        style={{
          width: "100%",
          padding: "10px 12px",
          fontSize: "13px",
          lineHeight: 1.6,
          border: "1px solid var(--border)",
          borderRadius: "12px",
          background: "linear-gradient(180deg, var(--background) 0%, var(--secondary) 100%)",
          color: "var(--foreground)",
          outline: "none",
          resize: "vertical",
          minHeight: "110px",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.55), 0 10px 24px rgba(15,23,42,0.04)",
        }}
      />

      <div style={{
        display: "flex",
        justifyContent: "flex-end",
        marginTop: "14px",
      }}>
        <button
          type="submit"
          disabled={submitting}
          style={{
            padding: "8px 16px",
            fontSize: "13px",
            fontWeight: 500,
            color: "var(--primary-foreground)",
            backgroundColor: "var(--foreground)",
            border: "none",
            borderRadius: "8px",
            cursor: submitting ? "wait" : "pointer",
            opacity: submitting ? 0.7 : 1,
          }}
        >
          {submitting ? t("feedback.form.submitting") : t("feedback.form.submit")}
        </button>
      </div>
    </form>
  );
}

// --- Sub-components ---

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      fontSize: '13px',
      fontWeight: 600,
      color: 'var(--muted-foreground)',
      margin: '0 0 12px 0',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
    }}>
      {children}
    </h2>
  );
}

function SettingsCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      backgroundColor: 'var(--background)',
      borderRadius: '10px',
      border: '1px solid var(--border)',
      padding: '0 16px',
      marginBottom: '24px',
    }}>
      {children}
    </div>
  );
}



interface SettingsRowProps {
  label: string;
  description: string;
  children: React.ReactNode;
  isLast?: boolean;
}

function SettingsRow({ label, description, children, isLast = false }: SettingsRowProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '14px 0',
      borderBottom: isLast ? 'none' : '1px solid var(--border)',
    }}>
      <div style={{ flex: 1, marginRight: '16px' }}>
        <div style={{
          fontSize: '13px',
          fontWeight: 500,
          color: 'var(--foreground)',
          marginBottom: '2px',
        }}>
          {label}
        </div>
        <div style={{
          fontSize: '12px',
          color: 'var(--muted-foreground)',
        }}>
          {description}
        </div>
      </div>
      {children}
    </div>
  );
}

interface ThemeSelectorProps {
  value: "light" | "dark" | "system";
  onChange: (value: "light" | "dark" | "system") => void;
}

function ThemeSelector({ value, onChange }: ThemeSelectorProps) {
  const { t } = useTranslation();

  const options = [
    { value: "light" as const, labelKey: "settings.themeLight" as const, icon: <SunIcon /> },
    { value: "dark" as const, labelKey: "settings.themeDark" as const, icon: <MoonIcon /> },
    { value: "system" as const, labelKey: "settings.themeSystem" as const, icon: <MonitorIcon /> },
  ];

  return (
    <div style={{
      display: 'flex',
      backgroundColor: 'var(--muted)',
      borderRadius: '6px',
      padding: '2px',
    }}>
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            padding: '5px 10px',
            fontSize: '12px',
            fontWeight: 500,
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            backgroundColor: value === option.value ? 'var(--background)' : 'transparent',
            color: value === option.value ? 'var(--foreground)' : 'var(--muted-foreground)',
            boxShadow: value === option.value ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
            transition: 'all 0.15s',
          }}
        >
          {option.icon}
          {t(option.labelKey)}
        </button>
      ))}
    </div>
  );
}

interface SegmentedControlProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}

function SegmentedControl({ value, onChange, options }: SegmentedControlProps) {
  return (
    <div style={{
      display: 'flex',
      backgroundColor: 'var(--background)',
      borderRadius: '8px',
      padding: '3px',
      border: '1px solid var(--border)',
    }}>
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          style={{
            padding: '6px 12px',
            fontSize: '12px',
            fontWeight: 500,
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            backgroundColor: value === option.value ? 'var(--secondary)' : 'transparent',
            color: value === option.value ? 'var(--foreground)' : 'var(--muted-foreground)',
            transition: 'all 0.15s',
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function CliInstallCell({ tool, label }: { tool: string; label: string }) {
  const { addToast } = useToast();
  const [installed, setInstalled] = useState<boolean | null>(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    checkInstalled();
  }, []);

  const checkInstalled = async () => {
    try {
      const result = await invoke<boolean>("check_cli_installed", { tool });
      setInstalled(result);
    } catch {
      setInstalled(false);
    }
  };

  const handleInstall = async () => {
    setInstalling(true);
    try {
      const result = await invoke<{ success: boolean; message: string }>("install_cli_tool", { tool });
      if (result.success) {
        addToast(`${label} CLI 安装成功`, "success");
        setInstalled(true);
      } else {
        addToast(result.message, "error");
      }
    } catch (err) {
      addToast(err instanceof Error ? err.message : String(err), "error");
    } finally {
      setInstalling(false);
    }
  };

  if (installed === null) {
    return (
      <span style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}>检查中...</span>
    );
  }

  if (installed) {
    return (
      <span style={{ fontSize: '12px', color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 6L9 17l-5-5"/>
        </svg>
        已安装
      </span>
    );
  }

  return (
    <button
      onClick={handleInstall}
      disabled={installing}
      style={{
        padding: '4px 10px',
        fontSize: '11px',
        fontWeight: 500,
        color: 'var(--primary-foreground)',
        backgroundColor: 'var(--primary)',
        border: 'none',
        borderRadius: '4px',
        cursor: installing ? 'not-allowed' : 'pointer',
        opacity: installing ? 0.6 : 1,
        whiteSpace: 'nowrap',
      }}
    >
      {installing ? '安装中...' : '安装 CLI'}
    </button>
  );
}
