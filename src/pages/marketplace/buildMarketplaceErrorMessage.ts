/** Rate limiting is worth its own wording, since the fix is "wait and retry". */
function isRateLimited(rawMessage: string): boolean {
  return /(^|[^0-9])429([^0-9]|$)/.test(rawMessage)
    || /too many requests/i.test(rawMessage)
    || /rate limit/i.test(rawMessage)
    || /请求过于频繁/.test(rawMessage);
}

/**
 * Turn a rejected marketplace request into the message shown to the user.
 *
 * The backend already returns readable causes ("Skill 缺少仓库地址",
 * "下载文件失败: 404", ...). Those used to be dropped in favour of a generic
 * fallback, which made every failure look identical — a marketplace entry with
 * a bogus repo URL was indistinguishable from a network outage.
 *
 * The separator is locale-neutral so this needs no new i18n key.
 */
export function buildMarketplaceErrorMessage(
  err: unknown,
  fallbackMessage: string,
  rateLimitedMessage: string,
): string {
  const rawMessage = err instanceof Error ? err.message : String(err);

  if (isRateLimited(rawMessage)) return rateLimitedMessage;

  // `String(err)` crosses the Tauri IPC boundary, where a non-Error rejection
  // stringifies to something useless.
  const detail = rawMessage.trim();
  if (!detail || detail === "[object Object]") return fallbackMessage;

  return `${fallbackMessage} — ${detail}`;
}
