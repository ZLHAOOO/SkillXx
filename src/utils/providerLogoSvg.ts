/**
 * Inline SVG content for provider logos.
 *
 * These SVGs use `fill="currentColor"` so their color is controlled by the
 * parent element's CSS `color` property — enabling theme-aware rendering
 * (dark = white, light = near-black) without touching the image files.
 */

// Vite ?raw imports — pulls the SVG file content as a string at build time.
import openaiRaw from "../assets/providers/openai.svg?raw";
import glmRaw from "../assets/providers/glm.svg?raw";
import kimiRaw from "../assets/providers/kimi-cn.svg?raw";
import grokRaw from "../assets/providers/grok.svg?raw";
import openrouterRaw from "../assets/providers/openrouter.svg?raw";
import groqRaw from "../assets/providers/groq.svg?raw";
import zaiRaw from "../assets/providers/zai.svg?raw";

// Fallbacks for providers whose SVGs use hardcoded branded colors (no currentColor).
// These are rendered as-is — their brand color works on both light and dark.
import anthropicRaw from "../assets/providers/anthropic.svg?raw";
import deepseekRaw from "../assets/providers/deepseek.svg?raw";
import geminiRaw from "../assets/providers/gemini.svg?raw";
import hunyuanRaw from "../assets/providers/hunyuan.svg?raw";
import longcatRaw from "../assets/providers/longcat.svg?raw";
import minimaxRaw from "../assets/providers/minimax-cn.svg?raw";
import mistralRaw from "../assets/providers/mistral.svg?raw";
import nvidiaRaw from "../assets/providers/nvidia.svg?raw";
import perplexityRaw from "../assets/providers/perplexity.svg?raw";
import qwenRaw from "../assets/providers/qwen.svg?raw";
import stepfunRaw from "../assets/providers/stepfun.svg?raw";
import volcengineRaw from "../assets/providers/volcengine.svg?raw";
import xiaomiRaw from "../assets/providers/xiaomi.svg?raw";
import cohereRaw from "../assets/providers/cohere.svg?raw";

/**
 * Ordered list of (keyword list, svg content) pairs.
 * Matches are tried in order; first hit wins.
 */
export const PROVIDER_SVG_MAP: [string[], string][] = [
  // Theme-aware (uses currentColor — rendered with CSS color for light/dark)
  [["openai", "gpt", "chatgpt"], openaiRaw],
  [["glm", "智谱", "bigmodel"], glmRaw],
  [["kimi", "moonshot"], kimiRaw],
  [["grok", "x.ai"], grokRaw],
  [["openrouter"], openrouterRaw],
  [["groq"], groqRaw],
  [["zai", "z.ai"], zaiRaw],

  // Branded-color SVGs (hardcoded fills — look fine on both backgrounds)
  [["anthropic", "claude"], anthropicRaw],
  [["deepseek"], deepseekRaw],
  [["gemini", "google"], geminiRaw],
  [["hunyuan", "混元", "腾讯"], hunyuanRaw],
  [["longcat"], longcatRaw],
  [["xiaomi", "小米", "mimo"], xiaomiRaw],
  [["minimax"], minimaxRaw],
  [["mistral"], mistralRaw],
  [["nvidia", "nemotron"], nvidiaRaw],
  [["perplexity"], perplexityRaw],
  [["qwen", "通义"], qwenRaw],
  [["stepfun", "阶跃"], stepfunRaw],
  [["volcengine", "火山", "ark", "字节"], volcengineRaw],
  [["bailian", "百炼", "dashscope"], qwenRaw],
  [["bai", "baidu", "千帆", "百度"], qwenRaw],
  [["ernie", "文心", "yiyan"], longcatRaw],
  [["cohere"], cohereRaw],
];

/**
 * Look up the inline SVG string for a provider by name/id.
 * Returns null if no match (caller should show the letter fallback).
 */
export function getProviderSvgContent(name: string, id?: string): string | null {
  const lowerName = name.toLowerCase();
  const lowerId = (id || "").toLowerCase();

  for (const [keywords, svg] of PROVIDER_SVG_MAP) {
    if (keywords.some((kw) => lowerName.includes(kw) || lowerId.includes(kw))) {
      return svg;
    }
  }
  return null;
}
