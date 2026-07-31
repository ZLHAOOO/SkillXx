/**
 * Provider logo SVGs imported via Vite ?raw.
 *
 * Theme-aware SVGs use `fill="currentColor"` — the caller strips the XML
 * header / DOCTYPE and overrides the root fill based on the active scheme.
 * Branded-color SVGs carry their own hardcoded fills and work as-is.
 * A few providers (e.g. LongCat) only have PNG logos and are served via
 * the public path instead.
 */

// ── Theme-aware SVGs (white in dark, dark in light) ──────────────────────
import openaiLightRaw from "@/assets/providers/light/openai.svg?raw";
import openaiDarkRaw from "@/assets/providers/dark/openai.svg?raw";
import grokLightRaw from "@/assets/providers/light/grok.svg?raw";
import grokDarkRaw from "@/assets/providers/dark/grok.svg?raw";
import groqLightRaw from "@/assets/providers/light/groq.svg?raw";
import groqDarkRaw from "@/assets/providers/dark/groq.svg?raw";
import kimiLightRaw from "@/assets/providers/light/kimi.svg?raw";
import kimiDarkRaw from "@/assets/providers/dark/kimi.svg?raw";
import openrouterLightRaw from "@/assets/providers/light/openrouter.svg?raw";
import openrouterDarkRaw from "@/assets/providers/dark/openrouter.svg?raw";
import glmLightRaw from "@/assets/providers/light/glm.svg?raw";
import glmDarkRaw from "@/assets/providers/dark/glm.svg?raw";

// ── Branded-color SVGs (same file for both themes) ───────────────────────
import anthropicRaw from "@/assets/providers/anthropic.svg?raw";
import deepseekRaw from "@/assets/providers/deepseek.svg?raw";
import geminiRaw from "@/assets/providers/gemini.svg?raw";
import hunyuanRaw from "@/assets/providers/hunyuan.svg?raw";
import xiaomiRaw from "@/assets/providers/xiaomi.svg?raw";
import minimaxRaw from "@/assets/providers/minimax-cn.svg?raw";
import mistralRaw from "@/assets/providers/mistral.svg?raw";
import nvidiaRaw from "@/assets/providers/nvidia.svg?raw";
import perplexityRaw from "@/assets/providers/perplexity.svg?raw";
import qwenRaw from "@/assets/providers/qwen.svg?raw";
import stepfunRaw from "@/assets/providers/stepfun.svg?raw";
import volcengineRaw from "@/assets/providers/volcengine.svg?raw";
import cohereRaw from "@/assets/providers/cohere.svg?raw";

type SvgVariant = {
  light: string;
  dark: string;
};

type IconEntry = {
  keywords: string[];
  svg: SvgVariant;
};

const ICON_MAP: IconEntry[] = [
  // Theme-aware (light/dark variants)
  { keywords: ["openai", "gpt", "chatgpt"], svg: { light: openaiLightRaw, dark: openaiDarkRaw } },
  { keywords: ["glm", "智谱", "bigmodel"], svg: { light: glmLightRaw, dark: glmDarkRaw } },
  { keywords: ["kimi", "moonshot"], svg: { light: kimiLightRaw, dark: kimiDarkRaw } },
  { keywords: ["grok", "x.ai"], svg: { light: grokLightRaw, dark: grokDarkRaw } },
  { keywords: ["openrouter"], svg: { light: openrouterLightRaw, dark: openrouterDarkRaw } },
  { keywords: ["groq"], svg: { light: groqLightRaw, dark: groqDarkRaw } },
  { keywords: ["zai", "z.ai"], svg: { light: grokLightRaw, dark: grokDarkRaw } },

  // Branded-color (same for both themes)
  { keywords: ["anthropic", "claude"], svg: { light: anthropicRaw, dark: anthropicRaw } },
  { keywords: ["deepseek"], svg: { light: deepseekRaw, dark: deepseekRaw } },
  { keywords: ["gemini", "google"], svg: { light: geminiRaw, dark: geminiRaw } },
  { keywords: ["hunyuan", "混元", "腾讯"], svg: { light: hunyuanRaw, dark: hunyuanRaw } },
  { keywords: ["xiaomi", "小米", "mimo"], svg: { light: xiaomiRaw, dark: xiaomiRaw } },
  { keywords: ["minimax"], svg: { light: minimaxRaw, dark: minimaxRaw } },
  { keywords: ["mistral"], svg: { light: mistralRaw, dark: mistralRaw } },
  { keywords: ["nvidia", "nemotron"], svg: { light: nvidiaRaw, dark: nvidiaRaw } },
  { keywords: ["perplexity"], svg: { light: perplexityRaw, dark: perplexityRaw } },
  { keywords: ["qwen", "通义"], svg: { light: qwenRaw, dark: qwenRaw } },
  { keywords: ["stepfun", "阶跃"], svg: { light: stepfunRaw, dark: stepfunRaw } },
  { keywords: ["volcengine", "火山", "ark", "字节"], svg: { light: volcengineRaw, dark: volcengineRaw } },
  { keywords: ["bailian", "百炼", "dashscope"], svg: { light: qwenRaw, dark: qwenRaw } },
  { keywords: ["bai", "baidu", "千帆", "百度"], svg: { light: qwenRaw, dark: qwenRaw } },
  { keywords: ["ernie", "文心", "yiyan"], svg: { light: cohereRaw, dark: cohereRaw } },
  { keywords: ["cohere"], svg: { light: cohereRaw, dark: cohereRaw } },
];

// Providers that use PNG instead of SVG (served as static assets).
const PNG_PROVIDERS: [string[], string][] = [
  [["longcat"], "longcat.png"],
];

/**
 * Look up the raw SVG content for a provider by name/id and color scheme.
 * Returns null if no match (caller should show the letter fallback).
 */
export function getProviderSvgContent(name: string, id: string | undefined, colorScheme: "dark" | "light"): string | null {
  const lowerName = name.toLowerCase();
  const lowerId = (id || "").toLowerCase();

  for (const { keywords, svg } of ICON_MAP) {
    if (keywords.some((kw) => lowerName.includes(kw) || lowerId.includes(kw))) {
      return colorScheme === "dark" ? svg.dark : svg.light;
    }
  }
  return null;
}

/**
 * Check if a provider uses a PNG logo (served as static asset via <img>).
 */
export function isProviderPng(name: string, id?: string): boolean {
  const lowerName = name.toLowerCase();
  const lowerId = (id || "").toLowerCase();

  return PNG_PROVIDERS.some(([keywords]) =>
    keywords.some((kw) => lowerName.includes(kw) || lowerId.includes(kw)),
  );
}

/**
 * Get the public path for a provider's PNG logo.
 * Returns null if the provider doesn't use PNG.
 */
export function getProviderPngPath(name: string, id?: string): string | null {
  const lowerName = name.toLowerCase();
  const lowerId = (id || "").toLowerCase();

  for (const [keywords, filename] of PNG_PROVIDERS) {
    if (keywords.some((kw) => lowerName.includes(kw) || lowerId.includes(kw))) {
      return `/icons/providers/${filename}`;
    }
  }
  return null;
}