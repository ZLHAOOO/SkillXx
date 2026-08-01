import type { TranslationPath } from "../../i18n/index.tsx";
import type { UnifiedSkillListItem } from "./buildUnifiedSkillItems.ts";

/**
 * The one-line summary under a row in the skills list: member count for a
 * group, otherwise how many tools the skill is enabled for.
 */
export function getUnifiedItemMetaLabel(
  item: UnifiedSkillListItem,
  t: (key: TranslationPath) => string,
): string {
  if (item.kind === "group") {
    return t("skills.groupMembersCount").replace("{count}", String(item.memberCount ?? 0));
  }

  const summary = item.toolSummary;
  if (!summary || summary.state === "none") {
    return t("skills.noToolsEnabled");
  }

  if (summary.state === "all") {
    return t("skills.allEnabled");
  }

  return `${t("skills.enableFor")} ${summary.enabledCount}/${summary.totalCount}`;
}
