/**
 * Smart icon matching for LLM providers
 * Tries /icons/providers/{id}.svg based on provider id/name.
 * Returns null if no match (caller should fall back to first-letter placeholder).
 */

const ICON_MAP: [string[], string][] = [
  // Chinese providers (match on Chinese name or pinyin)
  [["xiaomi", "小米", "mimo"], "xiaomi"],
  [["volcengine", "火山", "ark", "字节"], "volcengine"],
  [["bailian", "百炼", "dashscope", "qwen", "通义"], "qwen"],
  [["hunyuan", "混元", "腾讯"], "hunyuan"],
  [["stepfun", "阶跃"], "stepfun"],
  [["longcat"], "longcat"],
  [["worldrouter"], "worldrouter"],
  [["zai", "z.ai"], "zai"],
  [["bai", "baidu", "千帆", "百度"], "qwen"],  // fallback to qwen icon
  [["ernie", "文心", "yiyan"], "longcat"],     // fallback to longcat icon

  // International providers (match on English name)
  [["anthropic", "claude"], "anthropic"],
  [["openai", "gpt", "chatgpt"], "openai"],
  [["deepseek"], "deepseek"],
  [["kimi", "moonshot"], "kimi-cn"],
  [["minimax"], "minimax-cn"],
  [["glm", "智谱", "bigmodel"], "glm"],
  [["gemini", "google", "gemini"], "gemini"],
  [["grok", "x.ai"], "grok"],
  [["groq"], "groq"],
  [["mistral"], "mistral"],
  [["cohere"], "cohere"],
  [["perplexity"], "perplexity"],
  [["openrouter"], "openrouter"],
  [["nvidia", "nemotron"], "nvidia"],
  [["agnes"], "agnes"],
];

/**
 * Try to find an icon file for a provider by name or id.
 * Checks /icons/providers/{match}.svg and returns the first match.
 */
export function getProviderIcon(name: string, id?: string): string | null {
  const lowerName = name.toLowerCase();
  const lowerId = (id || "").toLowerCase();

  for (const [keywords, iconId] of ICON_MAP) {
    const match = keywords.some(
      (kw) => lowerName.includes(kw) || lowerId.includes(kw),
    );
    if (match) {
      return `/icons/providers/${iconId}.svg`;
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
