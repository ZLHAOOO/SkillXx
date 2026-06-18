import { useState, useMemo } from "react";
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
  searchQuery?: string; // 可选的外部搜索查询（用于防抖）
  t: (key: TranslationPath) => string;
}

interface UseSkillFilterReturn {
  // Filter states
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  selectedTags: string[];
  setSelectedTags: React.Dispatch<React.SetStateAction<string[]>>;
  untaggedOnly: boolean;
  setUntaggedOnly: React.Dispatch<React.SetStateAction<boolean>>;
  scopeFilter: "all" | "global" | "project";
  setScopeFilter: React.Dispatch<React.SetStateAction<"all" | "global" | "project">>;
  
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
  searchQuery: externalSearchQuery,
  t,
}: UseSkillFilterProps): UseSkillFilterReturn {
  // 如果没有外部搜索查询，使用内部状态
  const [internalSearchQuery, setInternalSearchQuery] = useState("");
  const searchQuery = externalSearchQuery ?? internalSearchQuery;
  const setSearchQuery = externalSearchQuery ? () => {} : setInternalSearchQuery;
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [untaggedOnly, setUntaggedOnly] = useState(false);
  const [scopeFilter, setScopeFilter] = useState<"all" | "global" | "project">("all");

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
    searchQuery,
    setSearchQuery,
    selectedTags,
    setSelectedTags,
    untaggedOnly,
    setUntaggedOnly,
    scopeFilter,
    setScopeFilter,
    unifiedItems,
    sortedUnifiedItems,
    hasActiveSkillFilters,
    allTagSummaries,
    untaggedSkillsCount,
    showTagFilterControl,
  };
}
