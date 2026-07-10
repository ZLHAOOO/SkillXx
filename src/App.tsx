import { useState, useEffect, useCallback } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { Layout } from "@/components/layout/Layout";
import { MinimalLayout } from "@/components/layout/MinimalLayout";
import { Skills } from "@/pages/Skills";
import { Tools } from "@/pages/Tools";
import { Marketplace } from "@/pages/Marketplace";
import { Settings } from "@/pages/Settings";
import { EditorPage } from "@/pages/Editor";
import { LlmModel } from "@/pages/LlmModel";
import { ImportSuggestionBanner } from "@/components/skills/ImportSuggestionBanner";
import { useInitialization } from "@/hooks/useInitialization";
import { useScrollIndicator } from "@/hooks/useScrollIndicator";
import { ThemeProvider, ThemeStyle } from "@/hooks/useTheme";
import { SkillTranslationProvider } from "@/hooks/useSkillTranslation";
import { I18nProvider, Language } from "@/i18n";
import { FontFamilyPreset, normalizeFontFamilyPreset } from "@/lib/fontFamily";
import { AppConfig, MarketplaceUpdateCheckResult } from "@/types";
import { ToastContainer, useToast } from "@/components/ui/toast";

type Theme = "light" | "dark" | "system";

function App() {
  const { isInitialized, isLoading: initLoading, markInitialized } = useInitialization();
  useScrollIndicator();
  const [language, setLanguage] = useState<Language>("en");
  const [theme, setTheme] = useState<Theme>("system");
  const [themeStyle, setThemeStyle] = useState<ThemeStyle>("default");
  const [fontFamily, setFontFamily] = useState<FontFamilyPreset>("system");
  const [configLoaded, setConfigLoaded] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { toasts, removeToast } = useToast();

  // Load preferences from config on mount
  useEffect(() => {
    async function loadPreferences() {
      try {
        const config = await invoke<AppConfig>("get_config");
        if (config.preferences?.language) {
          setLanguage(config.preferences.language as Language);
        }
        if (config.preferences?.theme) {
          setTheme(config.preferences.theme as Theme);
        }
        if (config.preferences?.theme_style) {
          setThemeStyle(config.preferences.theme_style as ThemeStyle);
        }
        setFontFamily(normalizeFontFamilyPreset(config.preferences?.font_family));
        } catch {
        // Use defaults on error
      }
      setConfigLoaded(true);
    }
    loadPreferences();
  }, []);

  const handleLanguageChange = useCallback((lang: Language) => {
    setLanguage(lang);
  }, []);

  const handleThemeChange = useCallback((newTheme: Theme) => {
    setTheme(newTheme);
  }, []);

  const handleThemeStyleChange = useCallback((newStyle: ThemeStyle) => {
    setThemeStyle(newStyle);
  }, []);

  const handleFontFamilyChange = useCallback((newFontFamily: FontFamilyPreset) => {
    setFontFamily(newFontFamily);
  }, []);

  // Silently initialize on first launch — no welcome wizard, straight into the app.
  // Backend defaults handle skills_dir (~/.skillx/skills); the "import existing skills"
  // step surfaces later as a dismissible banner on the Skills page.
  useEffect(() => {
    if (initLoading || !configLoaded) return;
    if (isInitialized === false) {
      void markInitialized().catch(() => {
        // If marking fails, the app still works; it'll retry on next launch.
      });
    }
  }, [initLoading, configLoaded, isInitialized, markInitialized]);

  useEffect(() => {
    if (!isInitialized || !configLoaded) {
      return;
    }

    const timer = window.setTimeout(() => {
      void invoke<MarketplaceUpdateCheckResult>("check_marketplace_updates_if_stale").catch(
        () => {
          // keep startup check silent on failures
        },
      );
    }, 20_000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [configLoaded, isInitialized]);


  // Wait for initialization check, config load, and the silent init handshake.
  if (initLoading || !configLoaded || !isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse" style={{ color: "var(--muted-foreground)" }}>Loading...</div>
      </div>
    );
  }

  return (
    <ThemeProvider
      theme={theme}
      themeStyle={themeStyle}
      fontFamily={fontFamily}
      onThemeChange={handleThemeChange}
      onThemeStyleChange={handleThemeStyleChange}
      onFontFamilyChange={handleFontFamilyChange}
    >
      <I18nProvider language={language} onLanguageChange={handleLanguageChange}>
        <BrowserRouter>
          <SkillTranslationProvider>
            <Routes>
              <Route path="/" element={<Layout collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((v) => !v)} />}>
                <Route
                  index
                  element={
                    <>
                      <ImportSuggestionBanner />
                      <Skills />
                    </>
                  }
                />
                <Route path="tools" element={<Tools />} />
                <Route path="marketplace" element={<Marketplace />} />
                <Route path="settings" element={<Settings />} />
              </Route>
              <Route element={<MinimalLayout collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((v) => !v)} />}>
                <Route path="llm-model" element={<LlmModel />} />
                <Route path="/editor" element={<EditorPage />} />
              </Route>
            </Routes>
            <ToastContainer toasts={toasts} onRemove={removeToast} />
          </SkillTranslationProvider>
        </BrowserRouter>
      </I18nProvider>
    </ThemeProvider>
  );
}

export default App;
