import { type TranslationPath } from "@/i18n";

type TFunction = (key: TranslationPath) => string;

/**
 * Parse a Tauri 2 invoke error (which may be an Error object with JSON message)
 * into a structured { kind, info } representation.
 */
function parseTauriError(err: unknown): { kind?: string; info?: unknown } | null {
  // Tauri 2 throws the serialized error object directly (not wrapped in Error)
  if (typeof err === "object" && err !== null && "kind" in err) {
    return err as { kind?: string; info?: unknown };
  }
  let message = "";
  if (err instanceof Error) {
    message = err.message;
  } else if (typeof err === "string") {
    message = err;
  } else {
    return null;
  }
  try {
    const parsed = JSON.parse(message);
    if (typeof parsed === "object" && parsed !== null && "kind" in parsed) {
      return parsed as { kind?: string; info?: unknown };
    }
  } catch {
    // Not JSON — fall through
  }
  return null;
}

/**
 * Formats LLM/translation errors into user-friendly messages.
 * This function is shared across Skills, Marketplace, Editor, and SkillDetailModal.
 */
export function formatTranslationError(err: unknown, t: TFunction): string {
  const parsed = parseTauriError(err);
  if (parsed && parsed.kind) {
    switch (parsed.kind) {
      case "not_configured":
        return t("settings.llmErrorNotConfigured");
      case "bad_base_url":
        return t("settings.llmErrorBadBaseUrl");
      case "network_error":
        return t("settings.llmErrorNetwork");
      case "unauthorized":
        return t("settings.llmErrorUnauthorized");
      case "rate_limited":
        return t("settings.llmErrorRateLimited");
      case "server_error": {
        const info = parsed.info as { status?: number } | undefined;
        return t("settings.llmErrorServer").replace(
          "{code}",
          String(info?.status ?? 0)
        );
      }
      case "timeout":
        return t("settings.llmErrorTimeout");
      case "parse_error":
        return t("settings.llmErrorParse");
      case "content_too_large":
        return t("settings.llmErrorTooLarge");
    }
  }
  return typeof err === "string" ? err : String(err);
}
