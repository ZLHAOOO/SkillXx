import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { FontFamilyPreset, getFontFamilyStack } from "@/lib/fontFamily";

export type ThemeStyle = "default" | "apple" | "cyberpunk" | "neumorphism" | "comic";
export const THEME_STYLES: ThemeStyle[] = ["default", "apple", "cyberpunk", "neumorphism", "comic"];
export const THEME_STYLE_LABELS: Record<ThemeStyle, string> = {
  default: "默认",
  apple: "简约",
  cyberpunk: "科幻",
  neumorphism: "轻拟",
  comic: "漫画",
};

type Theme = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  themeStyle: ThemeStyle;
  fontFamily: FontFamilyPreset;
  setTheme: (theme: Theme) => void;
  setThemeStyle: (style: ThemeStyle) => void;
  setFontFamily: (fontFamily: FontFamilyPreset) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolveTheme(theme: Theme): ResolvedTheme {
  return theme === "system" ? getSystemTheme() : theme;
}

function themeHref(style: ThemeStyle, mode: ResolvedTheme): string {
  return `/src/themes/${style}-${mode}/theme.css`;
}

interface ThemeProviderProps {
  children: ReactNode;
  theme: Theme;
  themeStyle: ThemeStyle;
  fontFamily: FontFamilyPreset;
  onThemeChange?: (theme: Theme) => void;
  onThemeStyleChange?: (style: ThemeStyle) => void;
  onFontFamilyChange?: (fontFamily: FontFamilyPreset) => void;
}

export function ThemeProvider({
  children,
  theme,
  themeStyle,
  fontFamily,
  onThemeChange,
  onThemeStyleChange,
  onFontFamilyChange,
}: ThemeProviderProps) {
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolveTheme(theme));

  // Sync <html class="dark"> + <html data-theme-style="...">
  useEffect(() => {
    const resolved = resolveTheme(theme);
    setResolvedTheme(resolved);

    const root = document.documentElement;
    if (resolved === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    root.setAttribute("data-theme-style", themeStyle);
    root.setAttribute("data-mode", resolved);
  }, [theme, themeStyle]);

  // Swap the theme stylesheet link
  useEffect(() => {
    const resolved = resolveTheme(theme);
    const href = themeHref(themeStyle, resolved);
    let link = document.getElementById("theme-style") as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.id = "theme-style";
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    if (link.getAttribute("href") !== href) {
      link.setAttribute("href", href);
    }
  }, [theme, themeStyle]);

  // Ensure the enhance layer is loaded once. It provides high-specificity
  // overrides for shadcn components' hardcoded Tailwind classes
  // (rounded-xl border bg-white etc.) so the theme's visual tokens can win.
  useEffect(() => {
    if (!document.getElementById("theme-enhance")) {
      const enhance = document.createElement("link");
      enhance.id = "theme-enhance";
      enhance.rel = "stylesheet";
      enhance.href = "/src/themes/_enhance.css";
      document.head.appendChild(enhance);
    }
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty("--app-font-family", getFontFamilyStack(fontFamily));
  }, [fontFamily]);

  // Listen for system theme changes when theme is "system"
  useEffect(() => {
    if (theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      const resolved = getSystemTheme();
      setResolvedTheme(resolved);
      const root = document.documentElement;
      if (resolved === "dark") {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
      root.setAttribute("data-mode", resolved);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  const setTheme = useCallback((newTheme: Theme) => {
    onThemeChange?.(newTheme);
  }, [onThemeChange]);

  const setThemeStyle = useCallback((newStyle: ThemeStyle) => {
    onThemeStyleChange?.(newStyle);
  }, [onThemeStyleChange]);

  const setFontFamily = useCallback((newFontFamily: FontFamilyPreset) => {
    onFontFamilyChange?.(newFontFamily);
  }, [onFontFamilyChange]);

  return (
    <ThemeContext.Provider
      value={{ theme, resolvedTheme, themeStyle, fontFamily, setTheme, setThemeStyle, setFontFamily }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
