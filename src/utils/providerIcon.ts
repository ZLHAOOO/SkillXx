/**
 * Smart icon matching for LLM providers
 * Tries /icons/providers/{filename} based on provider id/name.
 * Returns null if no match (caller should fall back to first-letter placeholder).
 */

const ICON_MAP: [string[], string][] = [
  // Chinese providers (match on Chinese name or pinyin)
  [["xiaomi", "小米", "mimo"], "xiaomi.svg"],
  [["volcengine", "火山", "ark", "字节"], "volcengine.svg"],
  [["bailian", "百炼", "dashscope", "qwen", "通义"], "qwen.svg"],
  [["hunyuan", "混元", "腾讯"], "hunyuan.svg"],
  [["stepfun", "阶跃"], "stepfun.svg"],
  [["longcat"], "longcat.png"],  // PNG (from .icns)
  [["worldrouter"], "worldrouter.png"],
  [["zai", "z.ai"], "zai.svg"],
  [["bai", "baidu", "千帆", "百度"], "qwen.svg"],  // fallback to qwen icon
  [["ernie", "文心", "yiyan"], "longcat.png"],     // fallback to longcat icon

  // International providers (match on English name)
  [["anthropic", "claude"], "anthropic.svg"],
  [["openai", "gpt", "chatgpt"], "openai.svg"],
  [["deepseek"], "deepseek.svg"],
  [["kimi", "moonshot"], "kimi-cn.svg"],
  [["minimax"], "minimax-cn.svg"],
  [["glm", "智谱", "bigmodel"], "glm.svg"],
  [["gemini", "google"], "gemini.svg"],
  [["grok", "x.ai"], "grok.svg"],
  [["groq"], "groq.svg"],
  [["mistral"], "mistral.svg"],
  [["cohere"], "cohere.svg"],
  [["perplexity"], "perplexity.svg"],
  [["openrouter"], "openrouter.svg"],
  [["nvidia", "nemotron"], "nvidia.svg"],
];

/**
 * Try to find an icon file for a provider by name or id.
 * Returns the path from ICON_MAP or null.
 */
export function getProviderIcon(name: string, id?: string): string | null {
  const lowerName = name.toLowerCase();
  const lowerId = (id || "").toLowerCase();

  for (const [keywords, filename] of ICON_MAP) {
    const match = keywords.some(
      (kw) => lowerName.includes(kw) || lowerId.includes(kw),
    );
    if (match) {
      return `/icons/providers/${filename}`;
    }
  }
  return null;
}

/**
 * Get the first letter of a provider name for fallback display.
 * Used as fallback when no icon is available.
 */
export function getProviderInitial(name: string): string {
  if (!name) return "?";
  // Try to find first ASCII letter
  for (const ch of name) {
    if (/[a-zA-Z]/.test(ch)) return ch.toUpperCase();
  }
  // For pure CJK names, return first character
  return name.charAt(0);
}
