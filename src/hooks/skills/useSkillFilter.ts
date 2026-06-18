import { useMemo } from "react";
import { type TranslationPath } from "@/i18n";
import { type UnifiedSkillListItem } from "@/pages/skills/buildUnifiedSkillItems";
import {
  buildUnifiedSkillItems,
  buildUnifiedItemTagSummaries,
  filterUnifiedSkillItems,
  sortUnifiedSkillItems,
} from "@/pages/skills/buildUnifiedSkillItems";
import { getUntaggedSkillsCount, hasSelectableTagFilters } from "@/pages/skills/skillTags";
import { type Skill, type InstalledSkillPackage, type Tool, type AppConfig } from "@/types";

interface UseSkillFilterProps {
  skills: Skill[];
  skillPackages: InstalledSkillPackage[];
  tools: Tool[];
  config: AppConfig | null;
  searchQuery: string;
  selectedTags: string[];
  untaggedOnly: boolean;
  scopeFilter: "all" | "global" | "project";
  t: (key: TranslationPath) => string;
}

interface UseSkillFilterReturn {
  // Computed data
  unifiedItems: UnifiedSkillListItem[];
  sortedUnifiedItems: UnifiedSkillListItem[];
  hasActiveSkillFilters: boolean;

  // Tag filter helpers
  allTagSummaries: ReturnType<typeof buildUnifiedItemTagSummaries>;
  untaggedSkillsCount: number;
  showTagFilterControl: boolean;
}

export function useSkillFilter({
  skills,
  skillPackages,
  tools,
  config,
  searchQuery,
  selectedTags,
  untaggedOnly,
  scopeFilter,
  t,
}: UseSkillFilterProps): UseSkillFilterReturn {
  const skillMetadata = config?.skill_metadata;

  const unifiedItems = useMemo(() => buildUnifiedSkillItems({
    skills,
    skillPackages,
    tools,
    skillMetadata,
    groupBadgeLabel: t("skills.groupBadge"),
    displayNameLang: config?.preferences?.skill_display_name_lang || "original",
    displayDescLang: config?.preferences?.skill_display_desc_lang || "original",
  }), [skillMetadata, skillPackages, skills, t, tools, config]);

  const allTagSummaries = useMemo(
    () => buildUnifiedItemTagSummaries(unifiedItems),
    [unifiedItems],
  );

  const untaggedSkillsCount = useMemo(
    () => getUntaggedSkillsCount(skills, skillMetadata),
    [skillMetadata, skills],
  );

  const showTagFilterControl = useMemo(
    () => hasSelectableTagFilters(allTagSummaries),
    [allTagSummaries],
  );

  const hasActiveSkillFilters = Boolean(searchQuery.trim()) ||
    selectedTags.length > 0 || untaggedOnly || scopeFilter !== "all";

  const filteredUnifiedItems = useMemo(() => filterUnifiedSkillItems(unifiedItems, {
    searchQuery,
    selectedTags,
    untaggedOnly,
    scopeFilter,
  }), [searchQuery, selectedTags, unifiedItems, untaggedOnly, scopeFilter]);

  const sortedUnifiedItems = useMemo(
    () => sortUnifiedSkillItems(filteredUnifiedItems, searchQuery),
    [filteredUnifiedItems, searchQuery],
  );

  return {
    unifiedItems,
    sortedUnifiedItems,
    hasActiveSkillFilters,
    allTagSummaries,
    untaggedSkillsCount,
    showTagFilterControl,
  };
}
