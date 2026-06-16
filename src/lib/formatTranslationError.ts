import { type TranslationPath } from "@/i18n";

type TFunction = (key: TranslationPath) => string;

/**
 * Formats LLM/translation errors into user-friendly messages.
 * This function is shared across Skills, Marketplace, Editor, and SkillDetailModal.
 */
export function formatTranslationError(err: unknown, t: TFunction): string {
  if (typeof err === "object" && err !== null && "kind" in err) {
    const e = err as { kind?: string; info?: unknown };
    switch (e.kind) {
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
        const info = e.info as { status?: number } | undefined;
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
