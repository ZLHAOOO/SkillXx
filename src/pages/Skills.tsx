import { useState, useEffect, useCallback, useMemo, useRef, Suspense, lazy, type CSSProperties } from "react";
import { useDebouncedCallback } from "use-debounce";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { confirm, open } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import { ToastContainer, useToast } from "@/components/ui/toast";
import { RefreshButton } from "@/components/ui/refresh-button";
import { PageHeader } from "@/components/ui/page-header";
import { PageLoader } from "@/components/ui/loading";
import {
  MODAL_LAYER_Z_INDEX,
} from "@/constants/modal";
import {
  AppConfig,
  BatchSetSkillToolsRequest,
  BatchSetSkillToolsResponse,
  InstalledSkillPackage,
  ProjectBinding,
  Skill,
  SkillCategoryAssignment,
  SkillCategoryDimension,
  Tool,
  UserPreferences,
} from "@/types";
import { DEFAULT_LEVEL1_CATEGORIES, DEFAULT_DIMENSIONS } from "@/constants/categories";
import { AllIcon, PromptIcon, ToolIcon, KnowledgeIcon, SkillflowIcon } from "@/components/skills/CategoryIcons";
import { defaultPreferences } from "@/constants/preferences";
import { useTranslation, TranslationPath } from "@/i18n";
import {
  useSkillTranslation,
} from "@/hooks/useSkillTranslation";
import { formatTranslationError } from "@/lib/formatTranslationError";
import { generateTranslationPrompt } from "@/utils/skillTranslationPrompt";
import {
  applyTagFilterAction,
  getGroupMetadataKey,
  getGroupTags,
  getTagFilterSelectionSummary,
  getSkillMetadataKey,
  getSkillTagsForSkill,
  getUntaggedSkillsCount,
  hasSelectableTagFilters,
  normalizeSkillTags,
  updateMetadataTags,
  updateSkillTagsForSkill,
} from "./skills/skillTags";
import { orderToolIdsForSkill } from "./skills/orderToolIds";
import { getEnabledToolIds } from "./skills/getEnabledToolIds";
import { getSkillBulkToggleMode,
  getSkillBulkToggleTargets,
} from "./skills/bulkToggleSkillTools";
import {
  buildUnifiedSkillItems,
  buildUnifiedItemTagSummaries,
  filterUnifiedSkillItems,
  getGroupBulkModeState,
  getGroupToolLabel,
  getGroupToolVisualState,
  removeGroupSkillMetadataEntries,
  shouldShowGroupToolInEnabledOnly,
  type UnifiedSkillListItem,
  sortUnifiedSkillItems,
} from "./skills/buildUnifiedSkillItems";
import {
  saveSkillsListScrollOffset,
  takeSkillsListScrollOffset,
} from "./skills/skillsListScrollState";
import {
  buildBatchTargets,
  getSelectedBatchItems,
  pruneBatchSelectionToAvailable,
  selectVisibleBatchItems,
  summarizeBatchSelection,
  toggleBatchSelection,
} from "./skills/batchManageSelection";
import { getActionableToolIds } from "./skills/getActionableToolIds";
import { buildBatchToolStateSummaries } from "./skills/buildBatchToolStates";
import {
  buildGroupBulkToolActionPlan,
  buildGroupSingleToolActionRequest,
} from "./skills/groupToolBatchActions";
import {
  buildSkillsHeaderActionLayout,
  type SkillsHeaderActionId,
} from "./skills/headerActionLayout";
import {
  buildProjectBindingFromSkillsDir,
  hasProjectSkillsDirConflict,
  resolveActiveProjectId,
  resolveNextActiveProjectIdAfterAddition,
  resolveNextProjectBindingsAfterRemoval,
} from "./projectBindings";
// 懒加载大型组件 - 按需加载，提升初始加载速度
const ProjectBindingsDialog = lazy(() => import("./ProjectBindingsDialog").then(mod => ({ default: mod.ProjectBindingsDialog })));
const SkillManageDialog = lazy(() => import("@/components/skills/dialogs/SkillManageDialog").then(mod => ({ default: mod.SkillManageDialog })));
const CreateSkillDialog = lazy(() => import("@/components/skills/dialogs/CreateSkillDialog").then(mod => ({ default: mod.CreateSkillDialog })));
const BatchManageToolsDialog = lazy(() => import("./skills/BatchManageToolsDialog").then(mod => ({ default: mod.BatchManageToolsDialog })));
const CategoryEditDialog = lazy(() => import("@/components/skills/dialogs/CategoryEditDialog").then(mod => ({ default: mod.CategoryEditDialog })));
const BatchCategoryDialog = lazy(() => import("@/components/skills/dialogs/BatchCategoryDialog").then(mod => ({ default: mod.BatchCategoryDialog })));
const BatchTagDialog = lazy(() => import("@/components/skills/dialogs/BatchTagDialog").then(mod => ({ default: mod.BatchTagDialog })));
const AiAssistantDialog = lazy(() => import("@/components/skills/dialogs/AiAssistantDialog").then(mod => ({ default: mod.AiAssistantDialog })));
const AiClassifyDialog = lazy(() => import("@/components/skills/dialogs/AiClassifyDialog").then(mod => ({ default: mod.AiClassifyDialog })));
import { SkillCard } from "@/components/skills/SkillCard";
import { useSkillsData } from "@/hooks/skills/useSkillsData";
import { useSkillFilter } from "@/hooks/skills/useSkillFilter";
import { useSkillActions } from "@/hooks/skills/useSkillActions";

function getToolDisplayName(toolId: string, tools: Tool[]): string {
  const tool = tools.find((t) => t.id === toolId);
  if (tool) return tool.name;
  return toolId;
}

function buildTagFilterMenuItemStyle(active: boolean): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    width: "100%",
    padding: "8px 10px",
    fontSize: "12px",
    fontWeight: 500,
    color: active ? "var(--primary)" : "var(--foreground)",
    backgroundColor: active ? "color-mix(in srgb, var(--primary) 8%, transparent)" : "var(--background)",
    border: active ? "1px solid color-mix(in srgb, var(--primary) 28%, transparent)" : "1px solid var(--border)",
    borderRadius: "8px",
    cursor: "pointer",
    textAlign: "left",
  };
}

type SkillEditorTab = "tools" | "tags" | "category";

function getUnifiedItemMetaLabel(item: UnifiedSkillListItem, t: (key: TranslationPath) => string) {
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

export function Skills() {
  const { t, language } = useTranslation();
  const navigate = useNavigate();
  const translation = useSkillTranslation();
  const [batchTranslating, setBatchTranslating] = useState(false);
  const [batchTranslateProgress, setBatchTranslateProgress] = useState({ total: 0, current: 0 });
  const [skills, setSkills] = useState<Skill[]>([]);
  const [skillPackages, setSkillPackages] = useState<InstalledSkillPackage[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");

  // 搜索防抖 - 等用户停止输入 300ms 后再搜索
  const debouncedSearch = useDebouncedCallback(
    (value: string) => {
      setDebouncedSearchQuery(value);
    },
    300
  );
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [untaggedOnly, setUntaggedOnly] = useState(false);
  const [scopeFilter, setScopeFilter] = useState<"all" | "global" | "project">("all");
  // 分类系统状态
  const [activeLevel1Category, setActiveLevel1Category] = useState<string>("all");
  const [activeLevel2Category, setActiveLevel2Category] = useState<string | null>(null);
  const [activeDimensionId, setActiveDimensionId] = useState<string | null>(null);
  const [showCategoryEditDialog, setShowCategoryEditDialog] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const [toolEditorSkillId, setToolEditorSkillId] = useState<string | null>(null);
  const [toolEditorQuery, setToolEditorQuery] = useState("");
  const [toolEditorEnabledOnly, setToolEditorEnabledOnly] = useState(false);
  const [toolEditorPreserveOrder, setToolEditorPreserveOrder] = useState(false);
  const bulkTogglingSkillIdRef = useRef<string | null>(null);
  const [groupEditorPackageId, setGroupEditorPackageId] = useState<string | null>(null);
  const [groupEditorQuery, setGroupEditorQuery] = useState("");
  const [groupEditorEnabledOnly, setGroupEditorEnabledOnly] = useState(false);
  const [togglingGroupToolKey, setTogglingGroupToolKey] = useState<string | null>(null);
  const [bulkTogglingGroupId, setBulkTogglingGroupId] = useState<string | null>(null);
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showProjectBindingsDialog, setShowProjectBindingsDialog] = useState(false);
  const [pendingProjectBinding, setPendingProjectBinding] = useState<ProjectBinding | null>(null);
  const [projectBindingsSaving, setProjectBindingsSaving] = useState(false);
  const [showTagFilterMenu, setShowTagFilterMenu] = useState(false);
  const [skillEditorTab, setSkillEditorTab] = useState<SkillEditorTab>("tools");
  const [tagDraft, setTagDraft] = useState("");
  const [savingTagsSkillId, setSavingTagsSkillId] = useState<string | null>(null);
  const [isBatchManageMode, setIsBatchManageMode] = useState(false);
  const [selectedBatchItemKeys, setSelectedBatchItemKeys] = useState<Set<string>>(new Set());
  const [isBatchToolDialogOpen, setIsBatchToolDialogOpen] = useState(false);
  const [batchToolQuery, setBatchToolQuery] = useState("");
  const [batchSubmitting, setBatchSubmitting] = useState(false);
  const [showBatchCategoryDialog, setShowBatchCategoryDialog] = useState(false);
  const [showBatchTagDialog, setShowBatchTagDialog] = useState(false);
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [showAiAssistantDialog, setShowAiAssistantDialog] = useState(false);
  const [showAiClassifyDialog, setShowAiClassifyDialog] = useState(false);
  const [aiClassifying, setAiClassifying] = useState(false);
  const [aiClassifyProgress, setAiClassifyProgress] = useState({ total: 0, processed: 0, currentName: "" });
  const [aiClassifyError, setAiClassifyError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [aiAssistantHovered, setAiAssistantHovered] = useState(false);
  const { toasts, addToast, updateToast, removeToast } = useToast();

  // Custom hook for data management
  const {
    skills: dataSkills,
    skillPackages: dataSkillPackages,
    tools: dataTools,
    config: dataConfig,
    initialLoading,
    reloadData: dataReloadData,
    setSkills: hookSetSkills,
  } = useSkillsData();

  // 将useSkillsData加载的最新数据同步到本地状态
  // 使用ref追踪首次同步，确保初始加载时数据不会丢失
  const skillsSyncedRef = useRef(false);
  useEffect(() => {
    if (!skillsSyncedRef.current || dataSkills.length > 0) {
      setSkills(dataSkills);
      setSkillPackages(dataSkillPackages);
      setTools(dataTools);
      skillsSyncedRef.current = true;
    }
  }, [dataSkills, dataSkillPackages, dataTools]);

  useEffect(() => {
    if (dataConfig) {
      setConfig(dataConfig);
    }
  }, [dataConfig]);

  // Collapse search bar when clicking outside
  useEffect(() => {
    if (!searchExpanded) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchExpanded(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [searchExpanded]);

  // Custom hook for filtering and search (kept for side effects; local useMemo handles filtering)
  useSkillFilter({
    skills: dataSkills,
    skillPackages: dataSkillPackages,
    tools: dataTools,
    config: dataConfig,
    searchQuery: debouncedSearchQuery,
    selectedTags,
    untaggedOnly,
    scopeFilter,
    t,
  });

  // Custom hook for skill actions (create, delete, toggle)
  const {
    togglingSkill: actionTogglingSkill,
    deletingSkill: actionDeletingSkill,
    creating: actionCreating,
    handleCreateSkill: actionHandleCreateSkill,
    handleDelete: actionHandleDelete,
    handleToggle: actionHandleToggle,
    handleBulkToggle: actionHandleBulkToggle,
  } = useSkillActions({
    skills: dataSkills,
    tools: dataTools,
    config: dataConfig,
    addToast,
    refreshData: dataReloadData,
    t,
  });

  // Alias hook state for use in component
  const togglingSkill = actionTogglingSkill;
  const deletingSkill = actionDeletingSkill;
  const creating = actionCreating;

  const skillMetadata = config?.skill_metadata;
  const listContainerRef = useRef<HTMLElement | null>(null);
  const hasRestoredScrollRef = useRef(false);

  const handleOpenUnifiedItem = useCallback(async (item: UnifiedSkillListItem) => {
    if (!item.openPath) {
      return;
    }

    try {
      const editorId = config?.preferences?.default_editor || "builtin";

      if (editorId === "builtin") {
        const currentScrollOffset = listContainerRef.current?.scrollTop ?? 0;
        saveSkillsListScrollOffset(currentScrollOffset);
        navigate(`/editor?root=${encodeURIComponent(item.openPath)}`);
      } else {
        await invoke("open_in_editor", { editorId, path: item.openPath });
      }
    } catch (err) {
      addToast(err instanceof Error ? err.message : String(err), "error");
    }
  }, [config, navigate, addToast]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await dataReloadData();
      addToast(t("common.refreshSuccess"), "success");
    } catch (err) {
      addToast(err instanceof Error ? err.message : String(err), "error");
    } finally {
      setRefreshing(false);
    }
  }, [addToast, t, dataReloadData]);


  useEffect(() => {
    if (skills.length === 0) return;
    const ids = skills.map((s) => s.instance_id);
    void translation.preloadCachedSkills(ids, language);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skills, language, translation.preloadCachedSkills]);

  const persistMetadataTags = useCallback(async (metadataKey: string, nextTags: string[]) => {
    if (!config) {
      return;
    }

    const previousConfig = config;
    const nextSkillMetadata = updateMetadataTags(metadataKey, nextTags, config.skill_metadata);
    const nextConfig: AppConfig = {
      ...config,
      skill_metadata: nextSkillMetadata,
    };

    setConfig(nextConfig);
    setSavingTagsSkillId(metadataKey);

    try {
      await invoke("save_config", { config: nextConfig });
    } catch (err) {
      setConfig(previousConfig);
      addToast(err instanceof Error ? err.message : String(err), "error");
    } finally {
      setSavingTagsSkillId(null);
    }
  }, [addToast, config]);

  const persistSkillTags = useCallback(async (skill: Skill, nextTags: string[]) => {
    if (!config) {
      return;
    }

    const previousConfig = config;
    const nextSkillMetadata = updateSkillTagsForSkill(skill, nextTags, config.skill_metadata);
    const nextConfig: AppConfig = {
      ...config,
      skill_metadata: nextSkillMetadata,
    };

    setConfig(nextConfig);
    setSavingTagsSkillId(getSkillMetadataKey(skill));

    try {
      await invoke("save_config", { config: nextConfig });
    } catch (err) {
      setConfig(previousConfig);
      addToast(err instanceof Error ? err.message : String(err), "error");
    } finally {
      setSavingTagsSkillId(null);
    }
  }, [addToast, config]);

  const toggleTagFilter = useCallback((tag: string) => {
    const next = applyTagFilterAction(
      { selectedTags, untaggedOnly },
      { type: "toggle-tag", tag },
    );
    setSelectedTags(next.selectedTags);
    setUntaggedOnly(next.untaggedOnly);
    setShowTagFilterMenu(false);
  }, [selectedTags, untaggedOnly]);

  const handleToggleUntaggedOnly = useCallback(() => {
    const next = applyTagFilterAction(
      { selectedTags, untaggedOnly },
      { type: "toggle-untagged" },
    );
    setSelectedTags(next.selectedTags);
    setUntaggedOnly(next.untaggedOnly);
    setShowTagFilterMenu(false);
  }, [selectedTags, untaggedOnly]);

  const handleResetTagFilters = useCallback(() => {
    const next = applyTagFilterAction(
      { selectedTags, untaggedOnly },
      { type: "reset" },
    );
    setSelectedTags(next.selectedTags);
    setUntaggedOnly(next.untaggedOnly);
    setScopeFilter("all");
    setActiveLevel1Category("all");
    setActiveLevel2Category(null);
    setShowTagFilterMenu(false);
  }, [selectedTags, untaggedOnly]);

  const handleAddTag = useCallback(async (skill: Skill) => {
    const nextTag = normalizeSkillTags([tagDraft])[0];
    if (!nextTag) {
      return;
    }

    const currentTags = getSkillTagsForSkill(skill, skillMetadata);
    if (currentTags.includes(nextTag)) {
      setTagDraft("");
      return;
    }

    await persistSkillTags(skill, [...currentTags, nextTag]);
    setTagDraft("");
  }, [persistSkillTags, skillMetadata, tagDraft]);

  const handleRemoveTag = useCallback(async (skill: Skill, tag: string) => {
    const nextTags = getSkillTagsForSkill(skill, skillMetadata).filter((item: string) => item !== tag);
    await persistSkillTags(skill, nextTags);
  }, [persistSkillTags, skillMetadata]);

  // Inline display name editor handler for SkillManageDialog
  // 按照"三个本子"的思路：用户编辑哪个本子，就保存到哪个本子
  const handleSaveDisplayName = useCallback(async (
    skill: Skill,
    newName: string,
    newDescription: string,
    targetNameLang: "original" | "zh" | "en",  // 用户编辑的是哪个本子
    targetDescLang: "original" | "zh" | "en"
  ) => {
    if (!config) return;

    const metadataKey = getSkillMetadataKey(skill);
    const currentMetadata = skillMetadata?.[metadataKey] || { tags: [] };

    console.log("[handleSaveDisplayName] Saving to notebooks:", {
      targetNameLang,
      targetDescLang,
      newName,
      newDescription,
    });

    // 构建更新后的metadata，只修改目标本子
    const nextMetadata = { ...currentMetadata };

    // 保存到对应的"本子"
    if (targetNameLang === "original") {
      nextMetadata.display_name = newName.trim() || null;
    } else if (targetNameLang === "zh") {
      nextMetadata.translated_name_zh = newName.trim() || null;
    } else if (targetNameLang === "en") {
      nextMetadata.translated_name_en = newName.trim() || null;
    }

    if (targetDescLang === "original") {
      nextMetadata.display_description = newDescription.trim() || null;
    } else if (targetDescLang === "zh") {
      nextMetadata.translated_desc_zh = newDescription.trim() || null;
    } else if (targetDescLang === "en") {
      nextMetadata.translated_desc_en = newDescription.trim() || null;
    }

    // 检查是否有变化
    let hasChanges = false;
    if (targetNameLang === "original" && nextMetadata.display_name !== currentMetadata.display_name) {
      hasChanges = true;
    } else if (targetNameLang === "zh" && nextMetadata.translated_name_zh !== currentMetadata.translated_name_zh) {
      hasChanges = true;
    } else if (targetNameLang === "en" && nextMetadata.translated_name_en !== currentMetadata.translated_name_en) {
      hasChanges = true;
    }

    if (targetDescLang === "original" && nextMetadata.display_description !== currentMetadata.display_description) {
      hasChanges = true;
    } else if (targetDescLang === "zh" && nextMetadata.translated_desc_zh !== currentMetadata.translated_desc_zh) {
      hasChanges = true;
    } else if (targetDescLang === "en" && nextMetadata.translated_desc_en !== currentMetadata.translated_desc_en) {
      hasChanges = true;
    }

    if (!hasChanges) {
      return;
    }

    try {
      const nextSkillMetadata = {
        ...skillMetadata,
        [metadataKey]: nextMetadata,
      };
      const nextConfig: AppConfig = {
        ...config,
        skill_metadata: nextSkillMetadata,
      };
      setConfig(nextConfig);

      await invoke("save_config", { config: nextConfig });

      addToast(t("skills.displayNameSaved"), "success");
    } catch (err) {
      addToast(err instanceof Error ? err.message : String(err), "error");
    }
  }, [config, skillMetadata, addToast, t]);

  // AI translate skill name and description
  // 返回翻译结果和目标语言，让调用者知道应该保存到哪个"本子"
  const handleTranslateSkillNameDesc = useCallback(async (skill: Skill): Promise<{
    name: string;
    description: string;
    targetNameLang: "original" | "zh" | "en";
    targetDescLang: "original" | "zh" | "en";
  }> => {
    console.log("[AI Translate] Starting translation for:", skill.name);

    // Check if LLM is configured
    let configured = translation.isConfigured;
    if (!configured) {
      configured = await translation.refreshConfigured();
      if (!configured) {
        console.error("[AI Translate] LLM not configured");
        addToast(t("skills.llmNotConfigured"), "error");
        return {
          name: skill.name,
          description: skill.description || "",
          targetNameLang: "original",
          targetDescLang: "original",
        };
      }
    }

    try {
      // Read skill content (SKILL.md)
      const skillContent = await invoke<string>("read_file", {
        path: `${skill.path}/SKILL.md`,
      }).catch(() => "");

      // Get language preferences - 这就是用户想翻译到哪个"本子"
      const nameLang = config?.preferences?.skill_display_name_lang || "original";
      const descLang = config?.preferences?.skill_display_desc_lang || "original";

      // 分别判断名称和简介是否需要翻译
      const shouldTranslateName = nameLang !== "original";
      const shouldTranslateDesc = descLang !== "original";

      // 确定 LLM 翻译的目标语言
      const translateTargetLang = nameLang !== "original"
        ? nameLang
        : descLang !== "original"
          ? descLang
          : "zh";

      // 只有需要翻译的字段才加入 prompt
      const prompt = generateTranslationPrompt({
        originalName: skill.name,
        originalDescription: skill.description || "",
        skillContent: skillContent || "",
        targetLang: translateTargetLang,
        translateName: shouldTranslateName,
        translateDesc: shouldTranslateDesc,
      });

      // Call LLM for translation
      const result = await invoke<{ name: string; description: string }>("translate_skill_name_desc_custom", {
        prompt,
        targetLang: translateTargetLang,
      });

      addToast(t("skills.aiTranslateSuccess"), "success");
      return {
        name: shouldTranslateName ? result.name : skill.name,
        description: shouldTranslateDesc ? result.description : (skill.description || ""),
        targetNameLang: shouldTranslateName ? nameLang : "original",
        targetDescLang: shouldTranslateDesc ? descLang : "original",
      };
    } catch (err) {
      const detail = formatTranslationError(err, t);
      addToast(`${t("skills.aiTranslateFailed")}: ${detail}`, "error");
      return {
        name: skill.name,
        description: skill.description || "",
        targetNameLang: "original",
        targetDescLang: "original",
      };
    }
  }, [translation, config, addToast, t]);

  const handleToggle = actionHandleToggle;

  const openSkillEditor = useCallback((skillIdentity: string, tab: SkillEditorTab = "tools") => {
    setToolEditorSkillId(skillIdentity);
    setGroupEditorPackageId(null);
    setSkillEditorTab(tab);
    setToolEditorQuery("");
    setToolEditorEnabledOnly(false);
    setToolEditorPreserveOrder(false);
    setGroupEditorQuery("");
    setGroupEditorEnabledOnly(false);
    setTagDraft("");
    setShowTagFilterMenu(false);
  }, []);

  const openGroupEditor = useCallback((packageId: string) => {
    setGroupEditorPackageId(packageId);
    setToolEditorSkillId(null);
    setSkillEditorTab("tools");
    setToolEditorQuery("");
    setToolEditorEnabledOnly(false);
    setGroupEditorQuery("");
    setGroupEditorEnabledOnly(false);
    setTagDraft("");
    setShowTagFilterMenu(false);
  }, []);

  const closeSkillEditor = useCallback(() => {
    setToolEditorSkillId(null);
    setGroupEditorPackageId(null);
    setSkillEditorTab("tools");
    setToolEditorQuery("");
    setToolEditorEnabledOnly(false);
    setGroupEditorQuery("");
    setGroupEditorEnabledOnly(false);
    setTagDraft("");
  }, []);

  const handleBulkToggle = actionHandleBulkToggle;

  const handleBatchTranslate = useCallback(
    async (skillsToTranslate: Skill[]) => {
      let configured = translation.isConfigured;
      if (!configured) {
        configured = await translation.refreshConfigured();
      }
      if (!configured) {
        addToast(t("skills.llmNotConfigured"), "error");
        return;
      }

      const nameLang = config?.preferences?.skill_display_name_lang || "original";
      const pending = skillsToTranslate.filter((skill) => {
        const meta = skillMetadata?.[getSkillMetadataKey(skill)];
        if (nameLang === "original") {
          const hasAny = meta?.translated_name_zh || meta?.translated_name_en
            || meta?.translated_desc_zh || meta?.translated_desc_en;
          return !hasAny;
        }
        return nameLang === "zh" ? !meta?.translated_name_zh : !meta?.translated_name_en;
      });

      if (pending.length === 0) {
        addToast(t("skills.batchTranslateNoNew"), "info");
        return;
      }

      const skipped = skillsToTranslate.length - pending.length;
      const confirmMessage = skipped > 0
        ? t("skills.batchTranslateConfirmSkip")
            .replace("{new}", String(pending.length))
            .replace("{skipped}", String(skipped))
        : t("skills.batchTranslateConfirm").replace("{count}", String(pending.length));

      const confirmed = await confirm(confirmMessage, { title: t("skills.batchTranslate") });
      if (!confirmed) return;

      const translateTargetLang = nameLang !== "original" ? nameLang : language;
      const ids = pending.map((s) => s.instance_id);

      setBatchTranslating(true);
      setBatchTranslateProgress({ total: ids.length, current: 0 });

      let progressToastId: string | undefined;
      try {
        // Fire-and-forget: backend handles concurrent translation
        const resultPromise = translation.translateBatch(ids, translateTargetLang, (p) => {
          setBatchTranslateProgress({ total: p.total, current: p.current });
          const progressMsg = t("skills.batchTranslateProgress")
            .replace("{current}", String(p.current))
            .replace("{total}", String(p.total))
            .replace("{name}", p.skill_name);

          if (!progressToastId) {
            progressToastId = addToast(progressMsg, "info", true);
          } else {
            updateToast(progressToastId, progressMsg);
          }
        });

        // Wait for completion to refresh data
        const result = await resultPromise;

        if (progressToastId) {
          removeToast(progressToastId);
        }

        const fail = result.failed.length;
        const ok = result.succeeded.length;
        addToast(
          t("skills.batchTranslateDone")
            .replace("{ok}", String(ok))
            .replace("{total}", String(pending.length))
            .replace("{fail}", String(fail)),
          fail > 0 ? "error" : "success",
        );

        // Refresh config and skills data so UI reflects new translations
        const latestConfig = await invoke<AppConfig>("get_config");
        setConfig(latestConfig);
        await dataReloadData();
      } catch (err) {
        if (progressToastId) {
          removeToast(progressToastId);
        }
        const detail = err instanceof Error ? err.message : String(err);
        addToast(
          t("skills.batchTranslateFailed").replace("{error}", detail),
          "error",
        );
      } finally {
        setBatchTranslating(false);
        setBatchTranslateProgress({ total: 0, current: 0 });
      }
    },
    [addToast, config, language, skillMetadata, t, translation, updateToast, removeToast, dataReloadData]
  );

  const handleDelete = actionHandleDelete;

  const handleTogglePin = async (itemKey: string) => {
    if (!config) return;
    const pinnedKeys = [...(config.preferences?.pinned_keys ?? [])];
    const idx = pinnedKeys.indexOf(itemKey);
    if (idx >= 0) {
      pinnedKeys.splice(idx, 1);
    } else {
      pinnedKeys.push(itemKey);
    }
    const nextConfig = {
      ...config,
      preferences: {
        ...defaultPreferences,
        ...config.preferences,
        pinned_keys: pinnedKeys,
      } as UserPreferences,
    };
    setConfig(nextConfig);
    try {
      await invoke("save_config", { config: nextConfig });
    } catch (err) {
      setConfig(config);
      addToast(err instanceof Error ? err.message : String(err), "error");
    }
  };

  const handleCreateSkill = actionHandleCreateSkill;

  const unifiedItems = useMemo(() => buildUnifiedSkillItems({
    skills,
    skillPackages,
    tools,
    skillMetadata,
    groupBadgeLabel: t("skills.groupBadge"),
    displayNameLang: config?.preferences?.skill_display_name_lang || "original",
    displayDescLang: config?.preferences?.skill_display_desc_lang || "original",
    pinnedKeys: config?.preferences?.pinned_keys,
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

  const tagFilterSelection = useMemo(
    () => getTagFilterSelectionSummary(selectedTags, untaggedOnly),
    [selectedTags, untaggedOnly],
  );

  const tagFilterButtonLabel = useMemo(() => {
    if (scopeFilter !== "all") {
      return scopeFilter === "global" ? t("skills.scopeGlobal") : t("skills.scopeProject");
    }
    switch (tagFilterSelection.kind) {
      case "untagged":
        return t("skills.untagged");
      case "single":
        return `#${tagFilterSelection.tag}`;
      case "multiple":
        return t("skills.selectedTagsCountCompact").replace("{count}", String(tagFilterSelection.count));
      default:
        return t("skills.tagFilterButton");
    }
  }, [scopeFilter, tagFilterSelection, t]);

  const hasActiveSkillFilters = Boolean(searchQuery.trim()) || selectedTags.length > 0 || untaggedOnly || scopeFilter !== "all" || activeLevel1Category !== "all" || activeLevel2Category !== null;

  const scopeFilterCounts = useMemo(() => {
    const globalCount = unifiedItems.filter((item) => item.scopeLabel === "global").length;
    const projectCount = unifiedItems.filter((item) => item.scopeLabel === "project").length;
    return { global: globalCount, project: projectCount };
  }, [unifiedItems]);

  // scopeTabs removed — scope filter is now a dropdown in the category bar

  // ── 分类系统数据 ──
  const skillCategories = config?.skill_categories;
  const categoryDimensions = useMemo<SkillCategoryDimension[]>(() => {
    return config?.skill_category_dimensions?.length
      ? config.skill_category_dimensions
      : DEFAULT_DIMENSIONS;
  }, [config?.skill_category_dimensions]);
  const level1CategoryIds = useMemo(() => {
    return config?.skill_level1_categories?.length
      ? config.skill_level1_categories
      : DEFAULT_LEVEL1_CATEGORIES.map((c) => c.id);
  }, [config?.skill_level1_categories]);

  // 当前选中的维度
  const currentDimension = useMemo(() => {
    if (!activeDimensionId) return categoryDimensions[0] ?? null;
    return categoryDimensions.find((d) => d.id === activeDimensionId) ?? categoryDimensions[0] ?? null;
  }, [activeDimensionId, categoryDimensions]);

  // 一级分类计数
  const level1Counts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const id of level1CategoryIds) {
      if (id === "all") {
        counts[id] = unifiedItems.length;
        continue;
      }
      counts[id] = unifiedItems.filter((item) => {
        const key = item.kind === "skill" && item.skill
          ? item.skill.instance_id
          : `group:${item.id}`;
        return skillCategories?.[key]?.level1 === id;
      }).length;
    }
    return counts;
  }, [unifiedItems, skillCategories, level1CategoryIds]);

  // 二级分类过滤
  const filteredUnifiedItems = useMemo(() => {
    // 先执行原有的筛选
    const base = filterUnifiedSkillItems(unifiedItems, {
      searchQuery,
      selectedTags,
      untaggedOnly,
      scopeFilter,
    });

    // 一级分类过滤
    let afterLevel1 = base;
    if (activeLevel1Category !== "all") {
      afterLevel1 = base.filter((item) => {
        const key = item.kind === "skill" && item.skill
          ? item.skill.instance_id
          : `group:${item.id}`;
        return skillCategories?.[key]?.level1 === activeLevel1Category;
      });
    }

    // 二级分类过滤
    let afterLevel2 = afterLevel1;
    if (activeLevel2Category && currentDimension) {
      afterLevel2 = afterLevel1.filter((item) => {
        const key = item.kind === "skill" && item.skill
          ? item.skill.instance_id
          : `group:${item.id}`;
        return skillCategories?.[key]?.level2 === activeLevel2Category;
      });
    }

    return afterLevel2;
  }, [unifiedItems, searchQuery, selectedTags, untaggedOnly, scopeFilter, activeLevel1Category, activeLevel2Category, currentDimension, skillCategories]);

  const sortedUnifiedItems = useMemo(
    () => sortUnifiedSkillItems(filteredUnifiedItems, searchQuery),
    [filteredUnifiedItems, searchQuery],
  );

  // Container width tracking (value unused after virtualizer removal; kept for potential future layout)
  const containerWidthRef = useRef(1200);
  const setContainerWidth = (w: number) => { containerWidthRef.current = w; };

  useEffect(() => {
    const container = listContainerRef.current;
    if (!container) return;

    const updateWidth = () => {
      setContainerWidth(container.clientWidth);
    };

    updateWidth();
    const resizeObserver = new ResizeObserver(updateWidth);
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, []);

  const actionableToolIds = useMemo(
    () => getActionableToolIds(tools),
    [tools],
  );

  const visibleBatchItemKeys = useMemo(
    () => sortedUnifiedItems.map((item) => item.key),
    [sortedUnifiedItems],
  );

  const allBatchItemKeys = useMemo(
    () => unifiedItems.map((item) => item.key),
    [unifiedItems],
  );

  const selectedBatchItems = useMemo(
    () => getSelectedBatchItems(unifiedItems, selectedBatchItemKeys),
    [selectedBatchItemKeys, unifiedItems],
  );

  const allExistingTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const item of selectedBatchItems) {
      if (item.kind !== "skill" || !item.skill) continue;
      const meta = config?.skill_metadata?.[item.skill.instance_id];
      if (meta?.tags) {
        meta.tags.forEach((tag) => tagSet.add(tag));
      }
    }
    return Array.from(tagSet).sort();
  }, [config?.skill_metadata, selectedBatchItems]);

  const batchSelectionSummary = useMemo(
    () => summarizeBatchSelection(selectedBatchItems, skills),
    [selectedBatchItems, skills],
  );

  const batchToolStates = useMemo(
    () => buildBatchToolStateSummaries(selectedBatchItems, skills, tools),
    [selectedBatchItems, skills, tools],
  );

  const headerActionLayout = useMemo(
    () => buildSkillsHeaderActionLayout(isBatchManageMode),
    [isBatchManageMode],
  );

  const enterBatchManageMode = useCallback(() => {
    setIsBatchManageMode(true);
  }, []);

  const exitBatchManageMode = useCallback(() => {
    setIsBatchManageMode(false);
    setSelectedBatchItemKeys(new Set());
    setIsBatchToolDialogOpen(false);
    setBatchToolQuery("");
  }, []);

  const handleToggleBatchItemSelection = useCallback((itemKey: string) => {
    setSelectedBatchItemKeys((current) => toggleBatchSelection(current, itemKey));
  }, []);

  const handleSelectAllVisibleItems = useCallback(() => {
    setSelectedBatchItemKeys((current) => selectVisibleBatchItems(current, visibleBatchItemKeys));
  }, [visibleBatchItemKeys]);

  const handleClearBatchSelection = useCallback(() => {
    setSelectedBatchItemKeys(new Set());
  }, []);

  const handleOpenBatchToolDialog = useCallback(() => {
    if (selectedBatchItems.length === 0) {
      addToast(t("skills.batchNoSelection"), "error");
      return;
    }

    setIsBatchToolDialogOpen(true);
  }, [addToast, selectedBatchItems.length, t]);

  const renderHeaderActionButton = useCallback((actionId: SkillsHeaderActionId) => {
    switch (actionId) {
      case "batch-manage":
        return (
          <button
            key={actionId}
            type="button"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              fontSize: "13px",
              fontWeight: 500,
              color: isBatchManageMode ? "var(--primary-foreground)" : "var(--foreground)",
              backgroundColor: isBatchManageMode ? "var(--foreground)" : "var(--background)",
              border: isBatchManageMode ? "none" : "1px solid var(--border)",
              borderRadius: "8px",
              cursor: "pointer",
            }}
            onClick={isBatchManageMode ? exitBatchManageMode : enterBatchManageMode}
          >
            {isBatchManageMode ? t("skills.exitBatchManage") : t("skills.batchManage")}
          </button>
        );
      case "batch-configure":
        return (
          <button
            key={actionId}
            type="button"
            onClick={handleOpenBatchToolDialog}
            disabled={selectedBatchItems.length === 0}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              fontSize: "13px",
              fontWeight: 500,
              color: "var(--foreground)",
              backgroundColor: "var(--secondary)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              cursor: selectedBatchItems.length === 0 ? "not-allowed" : "pointer",
              opacity: selectedBatchItems.length === 0 ? 0.6 : 1,
            }}
          >
            {t("skills.batchConfigureTools")}
          </button>
        );
      case "batch-category":
        return (
          <button
            key={actionId}
            type="button"
            onClick={() => setShowBatchCategoryDialog(true)}
            disabled={selectedBatchItems.length === 0}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              fontSize: "13px",
              fontWeight: 500,
              color: "var(--foreground)",
              backgroundColor: "var(--secondary)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              cursor: selectedBatchItems.length === 0 ? "not-allowed" : "pointer",
              opacity: selectedBatchItems.length === 0 ? 0.6 : 1,
            }}
          >
            {t("skills.batchCategory")}
          </button>
        );
      case "batch-tag":
        return (
          <button
            key={actionId}
            type="button"
            onClick={() => setShowBatchTagDialog(true)}
            disabled={selectedBatchItems.length === 0}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              fontSize: "13px",
              fontWeight: 500,
              color: "var(--foreground)",
              backgroundColor: "var(--secondary)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              cursor: selectedBatchItems.length === 0 ? "not-allowed" : "pointer",
              opacity: selectedBatchItems.length === 0 ? 0.6 : 1,
            }}
          >
            {t("skills.batchTag")}
          </button>
        );
      case "batch-delete":
        return (
          <button
            key={actionId}
            type="button"
            onClick={handleBatchDelete}
            disabled={selectedBatchItems.length === 0 || batchDeleting}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              fontSize: "13px",
              fontWeight: 500,
              color: "var(--destructive, #ef4444)",
              backgroundColor: "var(--secondary)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              cursor: selectedBatchItems.length === 0 || batchDeleting ? "not-allowed" : "pointer",
              opacity: selectedBatchItems.length === 0 ? 0.6 : 1,
            }}
          >
            {batchDeleting ? "..." : t("skills.batchDelete")}
          </button>
        );
      case "project-bindings":
        return (
          <button
            key={actionId}
            type="button"
            onClick={handleOpenProjectBindingsDialog}
            disabled={isBatchManageMode}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              fontSize: "13px",
              fontWeight: 500,
              color: "var(--foreground)",
              backgroundColor: "var(--background)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              cursor: isBatchManageMode ? "not-allowed" : "pointer",
              opacity: isBatchManageMode ? 0.6 : 1,
            }}
          >
            {t("settings.projectBindings")}
          </button>
        );
      case "create-skill":
    }
  }, [
    enterBatchManageMode,
    exitBatchManageMode,
    handleOpenBatchToolDialog,
    isBatchManageMode,
    selectedBatchItems.length,
    t,
  ]);

  const handleCloseBatchToolDialog = useCallback(() => {
    if (batchSubmitting) {
      return;
    }

    setIsBatchToolDialogOpen(false);
  }, [batchSubmitting]);

  const handleOpenProjectBindingsDialog = useCallback(() => {
    if (isBatchManageMode) {
      return;
    }
    setShowProjectBindingsDialog(true);
  }, [isBatchManageMode]);

  const saveProjectBindingsConfig = useCallback(async (nextConfig: AppConfig) => {
    const previousConfig = config;
    const previousSkills = skills;
    setConfig(nextConfig);
    setProjectBindingsSaving(true);

    try {
      await invoke("save_config", { config: nextConfig });
      const refreshedSkills = await invoke<Skill[]>("refresh_skills");
      hookSetSkills(refreshedSkills);
      setSkills(refreshedSkills);
    } catch (err) {
      if (previousConfig) {
        setConfig(previousConfig);
      }
      setSkills(previousSkills);
      addToast(err instanceof Error ? err.message : String(err), "error");
      throw err;
    } finally {
      setProjectBindingsSaving(false);
    }
  }, [addToast, config, skills, hookSetSkills]);

  const handleAddProjectBinding = useCallback(async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: t("settings.selectProjectSkillsDir"),
    });

    if (!selected || Array.isArray(selected)) {
      return;
    }

    try {
      setPendingProjectBinding(buildProjectBindingFromSkillsDir(selected));
    } catch (err) {
      if (err instanceof Error) {
        addToast(err.message, "error");
      } else if (typeof err === "string") {
        addToast(err, "error");
      }
    }
  }, [addToast, t]);

  const handlePendingProjectNameChange = useCallback((name: string) => {
    setPendingProjectBinding((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        name,
      };
    });
  }, []);

  const handleCancelPendingProjectBinding = useCallback(() => {
    setPendingProjectBinding(null);
  }, []);

  const handleConfirmPendingProjectBinding = useCallback(async () => {
    if (!config || !pendingProjectBinding) {
      return;
    }

    try {
      const nextProject = buildProjectBindingFromSkillsDir(
        pendingProjectBinding.skills_dir,
        pendingProjectBinding.name,
      );
      const existingProjects = config.projects ?? [];
      if (hasProjectSkillsDirConflict(existingProjects, nextProject)) {
        addToast(t("settings.projectAlreadyAdded").replace("{name}", nextProject.name), "error");
        return;
      }

      const nextConfig: AppConfig = {
        ...config,
        projects: [...existingProjects, nextProject],
        active_project_id: resolveNextActiveProjectIdAfterAddition(
          config.active_project_id,
          existingProjects,
          nextProject,
        ),
      };
      await saveProjectBindingsConfig(nextConfig);
      setPendingProjectBinding(null);
      addToast(t("settings.projectAdded").replace("{name}", nextProject.name), "success");
    } catch (err) {
      if (err instanceof Error) {
        addToast(err.message, "error");
      } else if (typeof err === "string") {
        addToast(err, "error");
      }
    }
  }, [addToast, config, pendingProjectBinding, saveProjectBindingsConfig, t]);

  const handleCloseProjectBindingsDialog = useCallback(() => {
    if (projectBindingsSaving) {
      return;
    }
    setPendingProjectBinding(null);
    setShowProjectBindingsDialog(false);
  }, [projectBindingsSaving]);

  const handleSetActiveProjectBinding = useCallback(async (projectId: string | null) => {
    if (!config) {
      return;
    }

    const nextConfig: AppConfig = {
      ...config,
      active_project_id: resolveActiveProjectId(projectId, config.projects ?? []),
    };
    await saveProjectBindingsConfig(nextConfig);
  }, [config, saveProjectBindingsConfig]);

  const handleRemoveProjectBinding = useCallback(async (projectId: string) => {
    if (!config) {
      return;
    }

    const nextProjectBindings = resolveNextProjectBindingsAfterRemoval(
      config.projects,
      projectId,
      config.active_project_id,
    );
    const nextConfig: AppConfig = {
      ...config,
      projects: nextProjectBindings.projects,
      active_project_id: nextProjectBindings.activeProjectId,
    };
    await saveProjectBindingsConfig(nextConfig);
  }, [config, saveProjectBindingsConfig]);

  const handleSubmitBatchToolAction = useCallback(async (
    action: "enable" | "disable",
    toolIdsForAction: string[],
    confirmMessage: string,
    options?: { closeOnSuccess?: boolean },
  ) => {
    if (selectedBatchItems.length === 0) {
      addToast(t("skills.batchNoSelection"), "error");
      return;
    }

    if (toolIdsForAction.length === 0) {
      addToast(t("skills.batchNoToolsSelected"), "error");
      return;
    }

    const confirmed = await confirm(confirmMessage, {
      title: t("skills.bulkConfirmTitle"),
      kind: "warning",
    });
    if (!confirmed) {
      return;
    }

    setBatchSubmitting(true);

    try {
      const request: BatchSetSkillToolsRequest = {
        targets: buildBatchTargets(selectedBatchItems),
        tool_ids: toolIdsForAction,
        action,
      };
      const response = await invoke<BatchSetSkillToolsResponse>("batch_set_skill_tools", { request });

      if (response.applied_count > 0) {
        addToast(t("skills.batchSubmitSuccess").replace("{count}", String(response.applied_count)), "success");
      } else if (response.failed_count === 0 && response.skipped_count > 0) {
        addToast(t("skills.batchNoChangesNeeded"), "success");
      }

      if (response.failed_count > 0) {
        addToast(t("skills.batchSubmitPartialFailed").replace("{count}", String(response.failed_count)), "error");
      }

      await dataReloadData();
      if (options?.closeOnSuccess ?? true) {
        exitBatchManageMode();
      }
    } catch (err) {
      addToast(err instanceof Error ? err.message : String(err), "error");
    } finally {
      setBatchSubmitting(false);
    }
  }, [addToast, exitBatchManageMode, dataReloadData, selectedBatchItems, t]);

  const handleBatchToolToggle = useCallback(async (toolId: string, enabled: boolean) => {
    const confirmKey = enabled ? "skills.batchConfirmEnableSelectedTools" : "skills.batchConfirmDisableSelectedTools";
    const confirmMessage = t(confirmKey)
      .replace("{count}", String(batchSelectionSummary.totalCount))
      .replace("{affected}", String(batchSelectionSummary.affectedSkillCount))
      .replace("{tools}", "1");

    await handleSubmitBatchToolAction(enabled ? "enable" : "disable", [toolId], confirmMessage, {
      closeOnSuccess: false,
    });
  }, [batchSelectionSummary.totalCount, handleSubmitBatchToolAction, t]);

  // ── 批量分类 handler ──
  const handleBatchCategoryAssign = useCallback(async (level1: string, level2: string | null) => {
    if (!config || selectedBatchItems.length === 0) return;
    const nextCategories = { ...config.skill_categories };
    for (const item of selectedBatchItems) {
      const key = item.kind === "skill" && item.skill
        ? item.skill.instance_id
        : `group:${item.id}`;
      nextCategories[key] = { level1, level2 };
    }
    const nextConfig: AppConfig = { ...config, skill_categories: nextCategories };
    try {
      await invoke("save_config", { config: nextConfig });
      setConfig(nextConfig);
      addToast(
        t("skills.batchCategorySuccess").replace("{count}", String(selectedBatchItems.length)),
        "success",
      );
      exitBatchManageMode();
    } catch (err) {
      addToast(err instanceof Error ? err.message : String(err), "error");
    }
  }, [addToast, config, exitBatchManageMode, selectedBatchItems, t]);

  // ── 批量删除 handler ──
  const handleBatchDelete = useCallback(async () => {
    if (!config || selectedBatchItems.length === 0) return;
    setBatchDeleting(true);
    try {
      let deletedCount = 0;
      for (const item of selectedBatchItems) {
        if (item.kind === "skill" && item.skill) {
          await invoke("delete_skill", { instanceId: item.skill.instance_id });
          deletedCount++;
        } else if (item.kind === "group" && item.skillPackage) {
          await invoke("remove_skill_package", { packageId: item.skillPackage.package_id });
          deletedCount++;
        }
      }
      // Clean up categories metadata
      const nextCategories = { ...config.skill_categories };
      for (const item of selectedBatchItems) {
        const key = item.kind === "skill" && item.skill
          ? item.skill.instance_id
          : `group:${item.id}`;
        delete nextCategories[key];
      }
      const nextConfig: AppConfig = { ...config, skill_categories: nextCategories };
      await invoke("save_config", { config: nextConfig });
      setConfig(nextConfig);
      addToast(
        t("skills.batchDeleteSuccess").replace("{count}", String(deletedCount)),
        "success",
      );
      await dataReloadData();
      exitBatchManageMode();
    } catch (err) {
      addToast(err instanceof Error ? err.message : String(err), "error");
    } finally {
      setBatchDeleting(false);
    }
  }, [addToast, config, dataReloadData, exitBatchManageMode, selectedBatchItems, t]);

  // ── 批量标签 handler ──
  const handleBatchTag = useCallback(async (action: "append" | "override", tags: string[]) => {
    if (!config || selectedBatchItems.length === 0 || tags.length === 0) return;
    const nextMetadata = { ...config.skill_metadata };
    let changedCount = 0;
    for (const item of selectedBatchItems) {
      if (item.kind !== "skill" || !item.skill) continue;
      const meta = nextMetadata[item.skill.instance_id];
      if (!meta) continue;
      const currentTags: string[] = meta.tags ?? [];
      const newTags = action === "override"
        ? tags
        : [...new Set([...currentTags, ...tags])];
      nextMetadata[item.skill.instance_id] = { ...meta, tags: newTags };
      changedCount++;
    }
    const nextConfig: AppConfig = { ...config, skill_metadata: nextMetadata };
    try {
      await invoke("save_config", { config: nextConfig });
      setConfig(nextConfig);
      addToast(
        t("skills.batchTagSuccess").replace("{count}", String(changedCount)),
        "success",
      );
      exitBatchManageMode();
    } catch (err) {
      addToast(err instanceof Error ? err.message : String(err), "error");
    }
  }, [addToast, config, exitBatchManageMode, selectedBatchItems, t]);

  // ── AI 分类 handler ──
  const handleAiClassify = useCallback(async (skillsToClassify: Skill[]) => {
    if (!config || skillsToClassify.length === 0) return;

    let configured = translation.isConfigured;
    if (!configured) {
      configured = await translation.refreshConfigured();
    }
    if (!configured) {
      addToast(t("skills.llmNotConfigured"), "error");
      return;
    }

    const level1Cats = [
      { id: "prompt", name: "提示增强", description: "用于增强提示词效果的技能，如提示词模板、提示词优化、提示词生成等" },
      { id: "tool", name: "工具调用", description: "用于调用外部工具/API的技能，如文件操作、命令行调用、API集成等" },
      { id: "knowledge", name: "知识蒸馏", description: "用于知识管理和蒸馏的技能，如文档处理、知识提取、数据总结等" },
      { id: "skillflow", name: "Skillflow", description: "用于编排多步骤工作流的技能，如流程自动化、多技能串联等" },
    ];
    const level2Values = categoryDimensions.length > 0
      ? categoryDimensions[0].values
      : [];

    setAiClassifying(true);
    setAiClassifyError(null);
    setAiClassifyProgress({ total: skillsToClassify.length, processed: 0, currentName: "" });

    // Accumulate results as they arrive
    const classifiedMap: Record<string, SkillCategoryAssignment> = {};
    let classifiedCount = 0;
    let failedCount = 0;

    try {
      const allIds = skillsToClassify.map((s) => s.instance_id);

      // Listen for per-item progress events
      const unlistenProgress = await listen<{
        current: number;
        total: number;
        instance_id: string;
        skill_name: string;
        status: string;
        level1?: string;
        level2?: string[];
      }>("llm:classify-item-progress", (event) => {
        const p = event.payload;
        setAiClassifyProgress({
          total: p.total,
          processed: p.current,
          currentName: p.skill_name,
        });

        if (p.status === "classified" && p.level1) {
          classifiedMap[p.instance_id] = {
            level1: p.level1,
            level2: p.level2 && p.level2.length > 0 ? p.level2[0] : null,
          };
          classifiedCount++;

          // Save incrementally to config so UI updates in real-time
          const nextCategories = { ...config.skill_categories, ...classifiedMap };
          const nextConfig: AppConfig = { ...config, skill_categories: nextCategories };
          // Fire-and-forget save; ignore failure for individual saves
          void invoke("save_config", { config: nextConfig }).then(() => {
            setConfig(nextConfig);
          });
        } else {
          failedCount++;
        }
      });

      // Listen for final completion event
      const completePromise = new Promise<{ total: number; classified: number }>((resolve) => {
        void listen<{ total: number; classified: number }>("llm:classify-complete", (event) => {
          unlistenProgress();
          resolve(event.payload);
        });
      });

      // Invoke backend (fire-and-forget from UI perspective)
      await invoke("ai_classify_skills", {
        skillIds: allIds,
        level1Categories: level1Cats,
        level2Values: level2Values,
      });

      // Wait for completion
      const completeResult = await completePromise;

      setAiClassifyProgress({ total: completeResult.total, processed: completeResult.total, currentName: "" });

      // Final save with all results (incremental saves may have already updated)
      if (Object.keys(classifiedMap).length > 0) {
        const nextCategories = { ...config.skill_categories, ...classifiedMap };
        const nextConfig: AppConfig = { ...config, skill_categories: nextCategories };
        await invoke("save_config", { config: nextConfig });
        setConfig(nextConfig);
        addToast(
          t("skills.aiClassifySuccess").replace("{count}", String(classifiedCount)),
          "success",
        );
      } else {
        addToast(t("skills.aiClassifyNone"), "info");
      }

      if (failedCount > 0 && classifiedCount > 0) {
        addToast(
          t("skills.aiClassifyPartial").replace("{fail}", String(failedCount)),
          "info",
        );
      }

      setShowAiClassifyDialog(true);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setAiClassifyError(errorMsg);
      setShowAiClassifyDialog(true);
      addToast(
        t("skills.aiClassifyError").replace("{error}", errorMsg),
        "error",
      );
    } finally {
      setAiClassifying(false);
    }
  }, [addToast, config, categoryDimensions, t, translation]);

  useEffect(() => {
    if (!isBatchManageMode) {
      return;
    }

    setSelectedBatchItemKeys((current) => pruneBatchSelectionToAvailable(current, allBatchItemKeys));
  }, [allBatchItemKeys, isBatchManageMode]);

  const toolIds = useMemo(
    () => getEnabledToolIds(tools),
    [tools],
  );

  const toolEditorSkill = useMemo(() => {
    const skill = skills.find((s) => s.instance_id === toolEditorSkillId) ?? null;
    if (!skill || !skillMetadata) return skill;

    // Get display name and description from metadata, considering language settings
    const metadataKey = getSkillMetadataKey(skill);
    const metadata = skillMetadata[metadataKey];
    const nameLang = config?.preferences?.skill_display_name_lang || "original";
    const descLang = config?.preferences?.skill_display_desc_lang || "original";

    // Determine display name based on language setting
    let displayName = metadata?.display_name || null;
    if (!displayName && nameLang !== "original") {
      displayName = nameLang === "zh"
        ? (metadata?.translated_name_zh || null)
        : (metadata?.translated_name_en || null);
    }

    // Determine display description based on language setting
    let displayDescription = metadata?.display_description || null;
    if (!displayDescription && descLang !== "original") {
      displayDescription = descLang === "zh"
        ? (metadata?.translated_desc_zh || null)
        : (metadata?.translated_desc_en || null);
    }

    // Return skill with display overrides
    return {
      ...skill,
      displayName: displayName || null,
      displayDescription: displayDescription || null,
    };
  }, [skills, toolEditorSkillId, skillMetadata, config?.preferences?.skill_display_name_lang, config?.preferences?.skill_display_desc_lang]);

  const toolEditorOrderedToolIds = useMemo(() => {
    if (!toolEditorSkill) {
      return [];
    }

    if (toolEditorPreserveOrder) {
      return [...toolIds];
    }

    return orderToolIdsForSkill(toolIds, toolEditorSkill.enabled);
  }, [toolEditorSkill, toolIds, toolEditorPreserveOrder]);

  const toolEditorFilteredToolIds = useMemo(() => {
    if (!toolEditorSkill) {
      return [];
    }

    const normalizedQuery = toolEditorQuery.trim().toLowerCase();
    return toolEditorOrderedToolIds.filter((toolId) => {
      if (toolEditorEnabledOnly && !toolEditorSkill.enabled[toolId]) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const displayName = getToolDisplayName(toolId, tools).toLowerCase();
      return displayName.includes(normalizedQuery) || toolId.toLowerCase().includes(normalizedQuery);
    });
  }, [toolEditorEnabledOnly, toolEditorOrderedToolIds, toolEditorQuery, toolEditorSkill, tools]);

  const toolEditorEnabledCount = useMemo(() => {
    if (!toolEditorSkill) {
      return 0;
    }
    return toolEditorOrderedToolIds.filter((toolId) => Boolean(toolEditorSkill.enabled[toolId])).length;
  }, [toolEditorOrderedToolIds, toolEditorSkill]);

  const toolEditorBulkToggleMode = useMemo(() => {
    if (!toolEditorSkill) {
      return "enable";
    }

    return getSkillBulkToggleMode(toolEditorFilteredToolIds, toolEditorSkill.enabled, tools);
  }, [toolEditorFilteredToolIds, toolEditorSkill, tools]);

  const toolEditorBulkToggleTargets = useMemo(() => {
    if (!toolEditorSkill) {
      return [];
    }

    return getSkillBulkToggleTargets(
      toolEditorFilteredToolIds,
      toolEditorSkill.enabled,
      tools,
      toolEditorBulkToggleMode,
    );
  }, [toolEditorFilteredToolIds, toolEditorSkill, tools, toolEditorBulkToggleMode]);

  const toolEditorIsBulkToggling = toolEditorSkill ? bulkTogglingSkillIdRef.current === toolEditorSkill.instance_id : false;
  const toolEditorHasPendingSingleToggle = toolEditorSkill
    ? Boolean(togglingSkill?.startsWith(`${toolEditorSkill.instance_id}:`))
    : false;
  const toolEditorBulkToggleDisabled =
    toolEditorIsBulkToggling || toolEditorHasPendingSingleToggle || toolEditorBulkToggleTargets.length === 0;
  const toolEditorBulkToggleLabel = toolEditorIsBulkToggling
    ? t("skills.bulkUpdating")
    : toolEditorBulkToggleMode === "enable"
      ? t("skills.bulkEnable")
      : t("skills.bulkDisable");

  const toolEditorItems = useMemo(() => {
    if (!toolEditorSkill) {
      return [];
    }

    return toolEditorFilteredToolIds.map((toolId) => {
      const isEnabled = toolEditorSkill.enabled[toolId] ?? false;
      const toggleKey = `${toolEditorSkill.instance_id}:${toolId}`;
      const isToggling = togglingSkill === toggleKey;
      const tool = tools.find((item) => item.id === toolId);
      const isDetected = tool?.detected ?? false;
      const isToolEnabled = tool?.config.enabled ?? false;
      const isDisabled = toolEditorIsBulkToggling || isToggling || !isDetected || !isToolEnabled;

      return {
        id: toolId,
        label: getToolDisplayName(toolId, tools),
        enabled: isEnabled,
        disabled: isDisabled,
        tooltip: !isDetected ? t("skills.toolNotDetected") : undefined,
        dimmed: !isDetected,
      };
    });
  }, [toolEditorFilteredToolIds, toolEditorIsBulkToggling, toolEditorSkill, togglingSkill, tools, t]);

  const toolEditorTags = useMemo(
    () => (toolEditorSkill ? getSkillTagsForSkill(toolEditorSkill, skillMetadata) : []),
    [skillMetadata, toolEditorSkill],
  );
  const toolEditorTagSuggestions = useMemo(() => {
    if (!toolEditorSkill) {
      return [];
    }

    return allTagSummaries
      .map((item) => item.tag)
      .filter((tag) => !toolEditorTags.includes(tag))
      .slice(0, 8);
  }, [allTagSummaries, toolEditorSkill, toolEditorTags]);

  const groupEditorItem = useMemo(
    () => unifiedItems.find((item) => item.kind === "group" && item.id === groupEditorPackageId) ?? null,
    [groupEditorPackageId, unifiedItems],
  );

  const groupEditorMetadataKey = useMemo(
    () => (groupEditorItem ? getGroupMetadataKey(groupEditorItem.id) : null),
    [groupEditorItem],
  );

  const groupEditorTags = useMemo(
    () => (groupEditorItem ? getGroupTags(groupEditorItem.id, skillMetadata) : []),
    [groupEditorItem, skillMetadata],
  );

  const groupEditorTagSuggestions = useMemo(() => {
    if (!groupEditorItem) {
      return [];
    }

    return allTagSummaries
      .map((item) => item.tag)
      .filter((tag) => !groupEditorTags.includes(tag))
      .slice(0, 8);
  }, [allTagSummaries, groupEditorItem, groupEditorTags]);

  const groupEditorOrderedToolIds = useMemo(() => {
    if (!groupEditorItem?.groupToolStateById) {
      return [];
    }

    return orderToolIdsForSkill(
      toolIds,
      getGroupBulkModeState(groupEditorItem.groupToolStateById),
    );
  }, [groupEditorItem, toolIds]);

  const groupEditorFilteredToolIds = useMemo(() => {
    if (!groupEditorItem?.groupToolStateById) {
      return [];
    }

    const normalizedQuery = groupEditorQuery.trim().toLowerCase();
    return groupEditorOrderedToolIds.filter((toolId) => {
      const toolState = groupEditorItem.groupToolStateById?.[toolId];
      if (!toolState) {
        return false;
      }

      if (groupEditorEnabledOnly && !shouldShowGroupToolInEnabledOnly(toolState)) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const displayName = getToolDisplayName(toolId, tools).toLowerCase();
      return displayName.includes(normalizedQuery) || toolId.toLowerCase().includes(normalizedQuery);
    });
  }, [groupEditorEnabledOnly, groupEditorItem, groupEditorOrderedToolIds, groupEditorQuery, tools]);

  const groupEditorEnabledCount = useMemo(() => {
    if (!groupEditorItem?.groupToolStateById) {
      return 0;
    }

    return Object.values(groupEditorItem.groupToolStateById).filter((state) => state.fullyEnabled).length;
  }, [groupEditorItem]);

  const groupEditorBulkToggleMode = useMemo(() => {
    if (!groupEditorItem?.groupToolStateById) {
      return "enable";
    }

    return getSkillBulkToggleMode(
      groupEditorFilteredToolIds,
      getGroupBulkModeState(groupEditorItem.groupToolStateById),
      tools,
    );
  }, [groupEditorFilteredToolIds, groupEditorItem, tools]);

  const groupEditorBulkToggleTargets = useMemo(() => {
    if (!groupEditorItem?.groupToolStateById) {
      return [];
    }

    return getSkillBulkToggleTargets(
      groupEditorFilteredToolIds,
      getGroupBulkModeState(groupEditorItem.groupToolStateById),
      tools,
      groupEditorBulkToggleMode,
    );
  }, [groupEditorBulkToggleMode, groupEditorFilteredToolIds, groupEditorItem, tools]);

  const groupEditorIsBulkToggling = groupEditorItem ? bulkTogglingGroupId === groupEditorItem.id : false;
  const groupEditorHasPendingSingleToggle = groupEditorItem
    ? Boolean(togglingGroupToolKey?.startsWith(`${groupEditorItem.id}:`))
    : false;
  const groupEditorBulkToggleDisabled =
    groupEditorIsBulkToggling || groupEditorHasPendingSingleToggle || groupEditorBulkToggleTargets.length === 0;
  const groupEditorBulkToggleLabel = groupEditorIsBulkToggling
    ? t("skills.bulkUpdating")
    : groupEditorBulkToggleMode === "enable"
      ? t("skills.bulkEnable")
      : t("skills.bulkDisable");

  const groupEditorItems = useMemo(() => {
    if (!groupEditorItem?.groupToolStateById) {
      return [];
    }

    return groupEditorFilteredToolIds.map((toolId) => {
      const state = groupEditorItem.groupToolStateById?.[toolId];
      const toggleKey = `${groupEditorItem.id}:${toolId}`;
      const isToggling = togglingGroupToolKey === toggleKey;
      const tool = tools.find((item) => item.id === toolId);
      const isDetected = tool?.detected ?? false;
      const isToolEnabled = tool?.config.enabled ?? false;
      const isDisabled = groupEditorIsBulkToggling || isToggling || !isDetected || !isToolEnabled;
      return {
        id: toolId,
        label: state ? getGroupToolLabel(getToolDisplayName(toolId, tools), state) : getToolDisplayName(toolId, tools),
        enabled: state ? getGroupToolVisualState(state) : false,
        disabled: isDisabled,
        tooltip: !isDetected ? t("skills.toolNotDetected") : undefined,
        dimmed: !isDetected,
      };
    });
  }, [groupEditorFilteredToolIds, groupEditorIsBulkToggling, groupEditorItem, togglingGroupToolKey, tools, t]);

  const handleGroupToggle = useCallback(async (groupItem: UnifiedSkillListItem, toolId: string, enabled: boolean) => {
    const request = buildGroupSingleToolActionRequest(groupItem, toolId, enabled);
    if (!request) {
      return;
    }

    const toggleKey = `${groupItem.id}:${toolId}`;
    setTogglingGroupToolKey(toggleKey);
    try {
      const response = await invoke<BatchSetSkillToolsResponse>("batch_set_skill_tools", { request });

      if (response.applied_count > 0) {
        const message = enabled ? t("skills.groupToolEnableSuccess") : t("skills.groupToolDisableSuccess");
        addToast(
          message.replace("{count}", String(response.applied_count)).replace("{tool}", getToolDisplayName(toolId, tools)),
          "success",
        );
      }

      if (response.failed_count > 0) {
        addToast(t("skills.bulkTogglePartialFailed").replace("{count}", String(response.failed_count)), "error");
      }

      await dataReloadData();
    } catch (err) {
      addToast(err instanceof Error ? err.message : String(err), "error");
      await dataReloadData();
    } finally {
      setTogglingGroupToolKey(null);
    }
  }, [addToast, dataReloadData, t, tools]);

  const handleGroupBulkToggle = useCallback(async (groupItem: UnifiedSkillListItem, visibleToolIds: string[]) => {
    const skillPackage = groupItem.skillPackage;
    const plan = buildGroupBulkToolActionPlan(groupItem, visibleToolIds, tools);
    if (!skillPackage || !plan) {
      return;
    }

    const confirmed = await confirm(
      plan.bulkMode === "enable"
        ? t("skills.groupBulkConfirmEnable")
          .replace("{tools}", String(plan.targetToolIds.length))
          .replace("{members}", String(skillPackage.installed_members.length))
        : t("skills.groupBulkConfirmDisable")
          .replace("{tools}", String(plan.targetToolIds.length))
          .replace("{members}", String(skillPackage.installed_members.length)),
      {
        title: t("skills.bulkConfirmTitle"),
        kind: "warning",
      },
    );
    if (!confirmed) {
      return;
    }

    setBulkTogglingGroupId(groupItem.id);
    try {
      const response = await invoke<BatchSetSkillToolsResponse>("batch_set_skill_tools", { request: plan.request });

      if (response.applied_count > 0) {
        const successMessage = plan.bulkMode === "enable" ? t("skills.groupBulkEnableSuccess") : t("skills.groupBulkDisableSuccess");
        addToast(successMessage.replace("{count}", String(response.applied_count)), "success");
      }

      if (response.failed_count > 0) {
        addToast(t("skills.bulkTogglePartialFailed").replace("{count}", String(response.failed_count)), "error");
      }

      await dataReloadData();
    } catch (err) {
      addToast(err instanceof Error ? err.message : String(err), "error");
      await dataReloadData();
    } finally {
      setBulkTogglingGroupId(null);
    }
  }, [addToast, dataReloadData, t, tools]);

  const handleDeleteGroup = useCallback(async (groupItem: UnifiedSkillListItem) => {
    const skillPackage = groupItem.skillPackage;
    if (!skillPackage) {
      return;
    }

    const confirmed = await confirm(
      t("skills.groupDeleteConfirm")
        .replace("{name}", groupItem.title)
        .replace("{count}", String(skillPackage.installed_members.length)),
      {
        title: t("skills.delete"),
        kind: "warning",
      },
    );
    if (!confirmed) {
      return;
    }

    setDeletingGroupId(groupItem.id);
    try {
      await invoke("remove_skill_package", { packageId: skillPackage.package_id });
      if (groupEditorPackageId === groupItem.id) {
        closeSkillEditor();
      }
      if (config?.skill_metadata) {
        const nextConfig: AppConfig = {
          ...config,
          skill_metadata: removeGroupSkillMetadataEntries(
            config.skill_metadata,
            skillPackage.installed_members,
            skillPackage.package_id,
          ),
        };
        try {
          await invoke("save_config", { config: nextConfig });
          setConfig(nextConfig);
        } catch (cleanupError) {
          addToast(cleanupError instanceof Error ? cleanupError.message : String(cleanupError), "error");
        }
      }
      addToast(t("skills.groupDeleteSuccess").replace("{name}", groupItem.title), "success");
      await dataReloadData();
    } catch (err) {
      addToast(err instanceof Error ? err.message : String(err), "error");
    } finally {
      setDeletingGroupId(null);
    }
  }, [addToast, closeSkillEditor, config, groupEditorPackageId, dataReloadData, t]);

  useEffect(() => {
    if (initialLoading || hasRestoredScrollRef.current) {
      return;
    }

    const container = listContainerRef.current;
    if (!container) {
      return;
    }

    const savedScrollOffset = takeSkillsListScrollOffset();
    if (savedScrollOffset === null) {
      hasRestoredScrollRef.current = true;
      return;
    }

    container.scrollTop = savedScrollOffset;
    hasRestoredScrollRef.current = true;
  }, [initialLoading, sortedUnifiedItems.length]);

  if (initialLoading) {
    return (
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
        backgroundColor: "var(--background)",
      }}>
        <PageHeader title={t("skills.title")} />
        <main style={{ flex: 1, overflow: "auto", padding: "24px 32px" }}>
          <PageLoader />
        </main>
      </div>
    );
  }

  if (!config) {
    return (
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
        backgroundColor: "var(--background)",
      }}>
        <PageHeader title={t("skills.title")} />
        <main style={{
          flex: 1,
          overflow: "auto",
          padding: "24px 32px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "12px",
          color: "var(--muted-foreground)",
        }}>
          <div>{t("skills.loadFailed")}</div>
          <button
            onClick={() => {
              void dataReloadData();
            }}
            style={{
              padding: "8px 16px",
              fontSize: "14px",
              fontWeight: 500,
              color: "#fff",
              backgroundColor: "var(--primary, #2563eb)",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            {t("common.retry")}
          </button>
        </main>
        <ToastContainer toasts={toasts} onRemove={removeToast} />
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes ai-btn-pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
      `}</style>
    <div style={{
      flex: 1,
      display: "flex",
      flexDirection: "column",
      height: "100%",
      overflow: "hidden",
      backgroundColor: "var(--background)",
    }}>
      <PageHeader
        title={t("skills.title")}
        actions={
          <>
            <RefreshButton onClick={handleRefresh} loading={refreshing} />

            {showTagFilterControl && (
              <div style={{ position: "relative" }}>
                <button
                  type="button"
                  onClick={() => setShowTagFilterMenu((current) => !current)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "8px 12px",
                    fontSize: "13px",
                    fontWeight: 500,
                    color: selectedTags.length > 0 || untaggedOnly || scopeFilter !== "all" ? "var(--primary)" : "var(--foreground)",
                    backgroundColor: "var(--background)",
                    border: selectedTags.length > 0 || untaggedOnly || scopeFilter !== "all" ? "1px solid color-mix(in srgb, var(--primary) 40%, transparent)" : "1px solid var(--border)",
                    borderRadius: "8px",
                    cursor: "pointer",
                    minWidth: "124px",
                    justifyContent: "space-between",
                    boxShadow: selectedTags.length > 0 || untaggedOnly || scopeFilter !== "all" ? "0 0 0 3px color-mix(in srgb, var(--primary) 8%, transparent)" : "none",
                  }}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18M6 12h12M10 18h4" />
                    </svg>
                    <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {tagFilterButtonLabel}
                    </span>
                  </span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d={showTagFilterMenu ? "m18 15-6-6-6 6" : "m6 9 6 6 6-6"} />
                  </svg>
                </button>

                {showTagFilterMenu && (
                  <>
                    <div
                      style={{
                        position: "fixed",
                        inset: 0,
                        zIndex: MODAL_LAYER_Z_INDEX - 1,
                      }}
                      onClick={() => setShowTagFilterMenu(false)}
                    />
                    <div
                      style={{
                        position: "absolute",
                        top: "calc(100% + 8px)",
                        right: 0,
                        width: "260px",
                        maxHeight: "360px",
                        overflow: "auto",
                        padding: "10px",
                        backgroundColor: "var(--background)",
                        border: "1px solid var(--border)",
                        borderRadius: "12px",
                        boxShadow: "0 16px 40px rgba(0,0,0,0.16)",
                        zIndex: MODAL_LAYER_Z_INDEX,
                      }}
                    >
                      <div style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "12px",
                        marginBottom: "10px",
                      }}>
                        <div>
                          <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--foreground)" }}>
                            {t("skills.tagFilterButton")}
                          </div>
                          <div style={{ fontSize: "11px", color: "var(--muted-foreground)", marginTop: "2px" }}>
                            {t("skills.tagFilterHintCompact")}
                          </div>
                        </div>
                        {(selectedTags.length > 0 || untaggedOnly || scopeFilter !== "all") && (
                          <button
                            type="button"
                            onClick={handleResetTagFilters}
                            style={{
                              fontSize: "11px",
                              fontWeight: 600,
                              color: "var(--muted-foreground)",
                              backgroundColor: "transparent",
                              border: "none",
                              cursor: "pointer",
                              padding: "4px 6px",
                            }}
                          >
                            {t("common.reset")}
                          </button>
                        )}
                      </div>

                      <div style={{
                        display: "flex",
                        gap: "4px",
                        padding: "4px",
                        marginBottom: "8px",
                        backgroundColor: "var(--muted)",
                        borderRadius: "8px",
                      }}>
                        {([
                          { value: "all" as const, label: t("skills.scopeFilterAll"), count: unifiedItems.length },
                          { value: "global" as const, label: t("skills.scopeGlobal"), count: scopeFilterCounts.global },
                          { value: "project" as const, label: t("skills.scopeProject"), count: scopeFilterCounts.project },
                        ]).map(({ value, label, count }) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => { setScopeFilter(value); setShowTagFilterMenu(false); }}
                            style={{
                              flex: 1,
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              gap: "1px",
                              padding: "5px 0",
                              fontSize: "11px",
                              fontWeight: scopeFilter === value ? 600 : 400,
                              color: scopeFilter === value ? "var(--primary)" : "var(--muted-foreground)",
                              backgroundColor: scopeFilter === value ? "var(--background)" : "transparent",
                              border: "none",
                              borderRadius: "6px",
                              cursor: "pointer",
                              boxShadow: scopeFilter === value ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                              transition: "background-color 0.15s, color 0.15s",
                            }}
                          >
                            <span>{label}</span>
                            <span style={{ fontSize: "10px", opacity: 0.72 }}>{count}</span>
                          </button>
                        ))}
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <button
                          type="button"
                          onClick={handleResetTagFilters}
                          style={buildTagFilterMenuItemStyle(tagFilterSelection.kind === "all")}
                        >
                          <span>{t("skills.allTags")}</span>
                          <span style={{ opacity: 0.72 }}>{skills.length}</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleToggleUntaggedOnly}
                          style={buildTagFilterMenuItemStyle(untaggedOnly)}
                        >
                          <span>{t("skills.untagged")}</span>
                          <span style={{ opacity: 0.72 }}>{untaggedSkillsCount}</span>
                        </button>

                        {allTagSummaries.map(({ tag, count }) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => toggleTagFilter(tag)}
                            style={buildTagFilterMenuItemStyle(selectedTags.includes(tag))}
                          >
                            <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>#{tag}</span>
                            <span style={{ opacity: 0.72, flexShrink: 0 }}>{count}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            <div
              ref={searchContainerRef}
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                width: searchExpanded ? "210px" : "32px",
                height: "32px",
                borderRadius: "8px",
                backgroundColor: searchExpanded ? "var(--background)" : "transparent",
                border: searchExpanded ? "1px solid var(--ring)" : "1px solid transparent",
                boxShadow: searchExpanded ? "0 0 0 3px color-mix(in srgb, var(--primary) 10%, transparent)" : "none",
                transition: "width 0.25s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.2s, border-color 0.2s, box-shadow 0.2s",
                overflow: "hidden",
                cursor: "pointer",
              }}
              onClick={() => {
                if (!searchExpanded) {
                  setSearchExpanded(true);
                }
              }}
            >
              {/* Search icon — always visible */}
              <svg
                style={{
                  position: "absolute",
                  left: "8px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--muted-foreground)",
                  pointerEvents: "none",
                  flexShrink: 0,
                  transition: "color 0.15s",
                }}
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              {/* Input — slides in with opacity */}
              <input
                type="text"
                placeholder={t("skills.searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  debouncedSearch(e.target.value);
                }}
                style={{
                  width: "100%",
                  height: "100%",
                  padding: "0 12px 0 34px",
                  fontSize: "13px",
                  border: "none",
                  borderRadius: "0",
                  backgroundColor: "transparent",
                  color: "var(--foreground)",
                  outline: "none",
                  opacity: searchExpanded ? 1 : 0,
                  pointerEvents: searchExpanded ? "auto" : "none",
                  transition: "opacity 0.18s ease",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.color = "var(--foreground)";
                }}
                onBlur={(e) => {
                  if (!e.currentTarget.value) {
                    setSearchExpanded(false);
                  }
                }}
              />
            </div>

            {!isBatchManageMode && (
              <div
                style={{ position: "relative", display: "inline-flex" }}
                onMouseEnter={() => setAiAssistantHovered(true)}
                onMouseLeave={() => setAiAssistantHovered(false)}
              >
                <button
                  type="button"
                  onClick={() => setShowAiAssistantDialog(true)}
                  disabled={batchTranslating || aiClassifying || sortedUnifiedItems.length === 0}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "32px",
                    height: "32px",
                    color: "var(--muted-foreground)",
                    background: "transparent",
                    border: "none",
                    borderRadius: "8px",
                    cursor: (batchTranslating || aiClassifying) ? "not-allowed" : "pointer",
                    transition: "color 0.15s, background-color 0.15s",
                    opacity: aiClassifying ? undefined : (batchTranslating ? 0.6 : 1),
                    animation: aiClassifying ? "ai-btn-pulse 1.2s ease-in-out infinite" : undefined,
                  }}
                >
                  <img
                    src="/icons/ai.svg"
                    alt={t("skills.aiAssistant")}
                    width="17"
                    height="17"
                    style={{ display: "block" }}
                  />
                </button>
                {/* Tooltip */}
                {aiAssistantHovered && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: "-28px",
                      left: "50%",
                      transform: "translateX(-50%)",
                      padding: "3px 8px",
                      fontSize: "11px",
                      fontWeight: 500,
                      color: "var(--background)",
                      backgroundColor: "var(--foreground)",
                      borderRadius: "4px",
                      whiteSpace: "nowrap",
                      pointerEvents: "none",
                      zIndex: 100,
                    }}
                  >
                    {aiClassifying
                      ? t("skills.aiClassifyTooltip")
                          .replace("{current}", String(aiClassifyProgress.processed))
                          .replace("{total}", String(aiClassifyProgress.total))
                      : batchTranslating
                        ? t("skills.batchTranslateProgress")
                            .replace("{current}", String(batchTranslateProgress.current))
                            .replace("{total}", String(batchTranslateProgress.total))
                            .replace("{name}", "")
                        : t("skills.aiAssistant")}
                  </div>
                )}
                {/* Progress bar under AI assistant button */}
                {(batchTranslating || aiClassifying) && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: "-4px",
                      left: "2px",
                      right: "2px",
                      height: "3px",
                      backgroundColor: "var(--secondary)",
                      borderRadius: "2px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: batchTranslating
                          ? `${batchTranslateProgress.total > 0 ? Math.round((batchTranslateProgress.current / batchTranslateProgress.total) * 100) : 0}%`
                          : `${aiClassifyProgress.total > 0 ? Math.round((aiClassifyProgress.processed / aiClassifyProgress.total) * 100) : 0}%`,
                        height: "100%",
                        backgroundColor: "var(--primary)",
                        borderRadius: "2px",
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {headerActionLayout.primaryActionIds.map((actionId) =>
                renderHeaderActionButton(actionId),
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {headerActionLayout.secondaryActionIds.map((actionId) =>
                renderHeaderActionButton(actionId),
              )}
            </div>
          </>
        }
      />

      {/* ── 一级分类栏 ── */}
      <nav
        aria-label={t("skills.categoryAll")}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "10px 32px",
          borderBottom: "1px solid var(--border)",
          backgroundColor: "var(--background)",
          flexShrink: 0,
          flexWrap: "wrap",
        }}
      >
        {level1CategoryIds.map((catId) => {
          const catDef = DEFAULT_LEVEL1_CATEGORIES.find((c) => c.id === catId);
          const label = catDef ? t(catDef.labelKey as TranslationPath) : catId;
          const count = level1Counts[catId] ?? 0;
          const active = activeLevel1Category === catId;
          const iconMap: Record<string, React.ReactNode> = {
            all: <AllIcon size={15} />,
            prompt: <PromptIcon size={15} />,
            tool: <ToolIcon size={15} />,
            knowledge: <KnowledgeIcon size={15} />,
            skillflow: <SkillflowIcon size={15} />,
          };
          return (
            <button
              key={catId}
              type="button"
              onClick={() => {
                setActiveLevel1Category(catId);
                setActiveLevel2Category(null);
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 10px",
                fontSize: "13px",
                fontWeight: active ? 600 : 500,
                color: active ? "var(--foreground)" : "var(--muted-foreground)",
                backgroundColor: "transparent",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                transition: "color 0.15s ease, background-color 0.15s ease",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.color = "var(--foreground)";
                  e.currentTarget.style.backgroundColor =
                    "color-mix(in srgb, var(--foreground) 6%, transparent)";
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.color = "var(--muted-foreground)";
                  e.currentTarget.style.backgroundColor = "transparent";
                }
              }}
            >
              <span style={{ opacity: active ? 1 : 0.5, display: "inline-flex", transition: "opacity 0.15s" }}>
                {iconMap[catId] ?? <AllIcon size={15} />}
              </span>
              <span>{label}</span>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 500,
                  opacity: active ? 0.9 : 0.45,
                  color: active ? "var(--foreground)" : "var(--muted-foreground)",
                }}
              >
                {count}
              </span>
            </button>
          );
        })}

      </nav>

      {/* ── 二级分类栏 ── */}
      {currentDimension && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "8px 32px",
            flexShrink: 0,
            flexWrap: "wrap",
          }}
        >
          {/* 维度选择下拉 */}
          {categoryDimensions.length > 1 && (
            <select
              value={currentDimension.id}
              onChange={(e) => {
                setActiveDimensionId(e.target.value);
                setActiveLevel2Category(null);
              }}
              style={{
                padding: "4px 10px",
                fontSize: "12px",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                backgroundColor: "var(--background)",
                color: "var(--foreground)",
                cursor: "pointer",
                outline: "none",
                fontWeight: 500,
              }}
            >
              {categoryDimensions.map((dim) => (
                <option key={dim.id} value={dim.id}>{dim.label}</option>
              ))}
            </select>
          )}

          {/* 维度标签（只有一个维度时） */}
          {categoryDimensions.length === 1 && (
            <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--muted-foreground)" }}>
              {currentDimension.label}
            </span>
          )}

          {/* 二级分类值 pills */}
          {currentDimension.values.map((val) => {
            const active = activeLevel2Category === val;
            return (
              <button
                key={val}
                type="button"
                onClick={() => setActiveLevel2Category(active ? null : val)}
                style={{
                  padding: "4px 12px",
                  fontSize: "12px",
                  fontWeight: active ? 600 : 400,
                  color: active ? "var(--primary-foreground)" : "var(--muted-foreground)",
                  backgroundColor: active ? "var(--foreground)" : "var(--background)",
                  border: active ? "none" : "1px solid var(--border)",
                  borderRadius: "999px",
                  cursor: "pointer",
                  transition: "background-color 0.15s ease, color 0.15s ease",
                  whiteSpace: "nowrap",
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.backgroundColor =
                      "color-mix(in srgb, var(--foreground) 6%, transparent)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.backgroundColor = "var(--background)";
                  }
                }}
              >
                {val}
              </button>
            );
          })}

          {/* 编辑按钮 */}
          <button
            type="button"
            onClick={() => setShowCategoryEditDialog(true)}
            style={{
              padding: "4px 10px",
              fontSize: "12px",
              fontWeight: 500,
              color: "var(--muted-foreground)",
              backgroundColor: "transparent",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              cursor: "pointer",
              transition: "background-color 0.15s ease, color 0.15s ease",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--foreground)";
              e.currentTarget.style.backgroundColor =
                "color-mix(in srgb, var(--foreground) 6%, transparent)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--muted-foreground)";
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            </svg>
            {t("skills.categoryEdit")}
          </button>
        </div>
      )}

      <main
        ref={listContainerRef}
        style={{
          flex: 1,
          overflow: "auto",
          padding: "24px 32px",
        }}
      >
        <div style={{ maxWidth: "1200px" }}>
          {isBatchManageMode && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
                padding: "12px 14px",
                marginBottom: "16px",
                borderRadius: "12px",
                border: "1px solid var(--border)",
                backgroundColor: "var(--secondary)",
                flexWrap: "wrap",
              }}
            >
              <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--foreground)" }}>
                {t("skills.batchSelectedCount")
                  .replace("{count}", String(batchSelectionSummary.totalCount))
                  .replace("{skills}", String(batchSelectionSummary.skillCount))
                  .replace("{groups}", String(batchSelectionSummary.groupCount))}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={handleSelectAllVisibleItems}
                  disabled={visibleBatchItemKeys.length === 0}
                  style={{
                    padding: "7px 10px",
                    fontSize: "12px",
                    fontWeight: 500,
                    color: "var(--foreground)",
                    backgroundColor: "var(--background)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    cursor: visibleBatchItemKeys.length === 0 ? "not-allowed" : "pointer",
                    opacity: visibleBatchItemKeys.length === 0 ? 0.6 : 1,
                  }}
                >
                  {t("skills.batchSelectAllFiltered")}
                </button>
                {batchSelectionSummary.totalCount > 0 && (
                  <button
                    type="button"
                    onClick={handleClearBatchSelection}
                    style={{
                      padding: "7px 10px",
                      fontSize: "12px",
                      fontWeight: 500,
                      color: "var(--foreground)",
                      backgroundColor: "var(--background)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      cursor: "pointer",
                    }}
                  >
                    {t("skills.batchClearSelection")}
                  </button>
                )}
              </div>
            </div>
          )}
          {sortedUnifiedItems.length === 0 ? (
            <div style={{
              textAlign: "center",
              padding: "48px 24px",
              color: "var(--muted-foreground)",
              backgroundColor: "var(--secondary)",
              borderRadius: "12px",
              border: "1px solid var(--border)",
            }}>
              {hasActiveSkillFilters ? t("skills.noMatch") : t("skills.noSkills")}
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(auto-fill, minmax(320px, 1fr))`,
                gap: "16px",
              }}
            >
              {sortedUnifiedItems.map((item) => {
                const canOpen = Boolean(item.openPath);

                const cardTitle = item.kind === "skill" && item.skill
                  ? (() => {
                      const meta = skillMetadata?.[getSkillMetadataKey(item.skill)];
                      const nameLang = config?.preferences?.skill_display_name_lang || "original";
                      if (nameLang === "zh" && meta?.translated_name_zh) return meta.translated_name_zh;
                      if (nameLang === "en" && meta?.translated_name_en) return meta.translated_name_en;
                      return item.title;
                    })()
                  : item.title;

                const description = item.kind === "group"
                  ? item.skillPackage?.package_id ?? getUnifiedItemMetaLabel(item, t)
                  : (() => {
                      const meta = item.kind === "skill" && item.skill
                        ? skillMetadata?.[getSkillMetadataKey(item.skill)]
                        : null;
                      const descLang = config?.preferences?.skill_display_desc_lang || "original";
                      if (descLang === "zh" && meta?.translated_desc_zh) return meta.translated_desc_zh;
                      if (descLang === "en" && meta?.translated_desc_en) return meta.translated_desc_en;
                      return item.description || t("skills.noDescription");
                    })();

                const previewChips = item.previewChips.map((chip) => `#${chip}`);

                // 计算该技能在当前分类系统中的标签
                const categoryChips = (() => {
                  const key = item.kind === "skill" && item.skill
                    ? item.skill.instance_id
                    : `group:${item.id}`;
                  const assignment = skillCategories?.[key];
                  if (!assignment) return [];
                  const chips: string[] = [];
                  // 一级分类名称
                  const l1Def = DEFAULT_LEVEL1_CATEGORIES.find((c) => c.id === assignment.level1);
                  if (l1Def && assignment.level1 !== "all") {
                    chips.push(t(l1Def.labelKey as TranslationPath));
                  }
                  // 二级分类名称
                  if (assignment.level2) {
                    chips.push(assignment.level2);
                  }
                  return chips;
                })();

                return (
                  <SkillCard
                    key={item.key}
                    item={item}
                    isBatchManageMode={isBatchManageMode}
                    isBatchSelected={selectedBatchItemKeys.has(item.key)}
                    canOpen={canOpen}
                    cardTitle={cardTitle}
                    description={description}
                    previewChips={previewChips}
                    categoryChips={categoryChips}
                    tools={tools}
                    deletingSkill={deletingSkill}
                    deletingGroupId={deletingGroupId}
                    onOpen={() => void handleOpenUnifiedItem(item)}
                    onToggleBatchSelection={() => handleToggleBatchItemSelection(item.key)}
                    onEdit={() => {
                      if (item.kind === "skill" && item.skill) {
                        openSkillEditor(item.skill.instance_id, "tools");
                      } else if (item.kind === "group") {
                        openGroupEditor(item.id);
                      }
                    }}
                    onDelete={() => {
                      if (item.kind === "skill" && item.skill) {
                        void handleDelete(item.skill);
                      } else if (item.kind === "group") {
                        void handleDeleteGroup(item);
                      }
                    }}
                    onPin={() => void handleTogglePin(item.key)}
                    t={t}
                  />
                );
              })}
            </div>
          )}
        </div>
      </main>

      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <Suspense fallback={null}>
      {toolEditorSkill && (
        <SkillManageDialog
          skillName={toolEditorSkill.name}
          skillDescription={toolEditorSkill.description || t("skills.noDescription")}
          activeTab={skillEditorTab}
          availableTabs={["tools", "tags", "category"]}
          onTabChange={(tab) => setSkillEditorTab(tab)}
          onClose={closeSkillEditor}
          doneLabel={t("common.done")}
          toolsTitle={t("skills.configureToolsTitle")}
          toolsDescription={t("skills.configureToolsDesc")
            .replace("{skill}", toolEditorSkill.name)
            .replace("{enabled}", String(toolEditorEnabledCount))
            .replace("{total}", String(toolEditorOrderedToolIds.length))}
          query={toolEditorQuery}
          enabledOnly={toolEditorEnabledOnly}
          searchPlaceholder={t("skills.searchToolsPlaceholder")}
          enabledOnlyLabel={t("skills.enabledOnly")}
          bulkToggleLabel={toolEditorBulkToggleLabel}
          bulkToggleDisabled={toolEditorBulkToggleDisabled}
          bulkToggleTitle={toolEditorBulkToggleTargets.length === 0 ? t("skills.bulkNoTarget") : undefined}
          items={toolEditorItems}
          emptyLabel={t("skills.noToolsInFilter")}
          onQueryChange={setToolEditorQuery}
          onEnabledOnlyChange={setToolEditorEnabledOnly}
          onToggle={(toolId, enabled) => { setToolEditorPreserveOrder(true); handleToggle(toolEditorSkill.instance_id, toolId, enabled); }}
          onBulkToggle={() => { setToolEditorPreserveOrder(true); handleBulkToggle(toolEditorSkill, toolEditorFilteredToolIds); }}
          tags={toolEditorTags}
          tagDraft={tagDraft}
          onTagDraftChange={setTagDraft}
          onAddTag={() => void handleAddTag(toolEditorSkill)}
          onRemoveTag={(tag) => void handleRemoveTag(toolEditorSkill, tag)}
          tagSuggestions={toolEditorTagSuggestions}
          onSelectTagSuggestion={(tag) => void persistSkillTags(toolEditorSkill, [...toolEditorTags, tag])}
          savingTags={savingTagsSkillId === getSkillMetadataKey(toolEditorSkill)}
          onSaveDisplayName={(name, desc, nameLang, descLang) => void handleSaveDisplayName(toolEditorSkill, name, desc, nameLang, descLang)}
          onTranslateSkill={() => handleTranslateSkillNameDesc(toolEditorSkill)}
          displayName={(toolEditorSkill as typeof toolEditorSkill & { displayName?: string | null })?.displayName}
          displayDescription={(toolEditorSkill as typeof toolEditorSkill & { displayDescription?: string | null })?.displayDescription}
          displayNameLang={config?.preferences?.skill_display_name_lang || "original"}
          displayDescLang={config?.preferences?.skill_display_desc_lang || "original"}
          t={t}
        />
      )}

      {groupEditorItem && groupEditorItem.skillPackage && (
        <SkillManageDialog
          skillName={groupEditorItem.title}
          skillDescription={groupEditorItem.skillPackage.package_id}
          activeTab={skillEditorTab}
          availableTabs={["tools", "tags", "category"]}
          onTabChange={(tab) => setSkillEditorTab(tab)}
          onClose={closeSkillEditor}
          doneLabel={t("common.done")}
          toolsTitle={t("skills.groupConfigureToolsTitle")}
          toolsDescription={t("skills.groupConfigureToolsDesc")
            .replace("{group}", groupEditorItem.title)
            .replace("{enabled}", String(groupEditorEnabledCount))
            .replace("{total}", String(groupEditorOrderedToolIds.length))}
          query={groupEditorQuery}
          enabledOnly={groupEditorEnabledOnly}
          searchPlaceholder={t("skills.searchToolsPlaceholder")}
          enabledOnlyLabel={t("skills.enabledOnly")}
          bulkToggleLabel={groupEditorBulkToggleLabel}
          bulkToggleDisabled={groupEditorBulkToggleDisabled}
          bulkToggleTitle={groupEditorBulkToggleTargets.length === 0 ? t("skills.bulkNoTarget") : undefined}
          items={groupEditorItems}
          emptyLabel={t("skills.noToolsInFilter")}
          onQueryChange={setGroupEditorQuery}
          onEnabledOnlyChange={setGroupEditorEnabledOnly}
          onToggle={(toolId, enabled) => void handleGroupToggle(groupEditorItem, toolId, enabled)}
          onBulkToggle={() => void handleGroupBulkToggle(groupEditorItem, groupEditorFilteredToolIds)}
          tags={groupEditorTags}
          tagDraft={tagDraft}
          onTagDraftChange={setTagDraft}
          onAddTag={() => {
            if (!groupEditorMetadataKey) {
              return;
            }
            const nextTag = normalizeSkillTags([tagDraft])[0];
            if (!nextTag) {
              return;
            }
            if (groupEditorTags.includes(nextTag)) {
              setTagDraft("");
              return;
            }
            void persistMetadataTags(groupEditorMetadataKey, [...groupEditorTags, nextTag]);
            setTagDraft("");
          }}
          onRemoveTag={(tag) => {
            if (!groupEditorMetadataKey) {
              return;
            }
            void persistMetadataTags(
              groupEditorMetadataKey,
              groupEditorTags.filter((item) => item !== tag),
            );
          }}
          tagSuggestions={groupEditorTagSuggestions}
          onSelectTagSuggestion={(tag) => {
            if (!groupEditorMetadataKey) {
              return;
            }
            void persistMetadataTags(groupEditorMetadataKey, [...groupEditorTags, tag]);
          }}
          savingTags={savingTagsSkillId === groupEditorMetadataKey}
          t={t}
        />
      )}

      <BatchManageToolsDialog
        open={isBatchToolDialogOpen}
        selectedSummary={batchSelectionSummary}
        tools={tools.filter((tool) => actionableToolIds.includes(tool.id))}
        toolStates={batchToolStates}
        query={batchToolQuery}
        submitting={batchSubmitting}
        onQueryChange={setBatchToolQuery}
        onToggleTool={(toolId, enabled) => void handleBatchToolToggle(toolId, enabled)}
        onSubmitEnableAll={() => void handleSubmitBatchToolAction(
          "enable",
          actionableToolIds,
          t("skills.batchConfirmEnableAllTools")
            .replace("{count}", String(batchSelectionSummary.totalCount))
            .replace("{affected}", String(batchSelectionSummary.affectedSkillCount)),
        )}
        onSubmitDisableAll={() => void handleSubmitBatchToolAction(
          "disable",
          actionableToolIds,
          t("skills.batchConfirmDisableAllTools")
            .replace("{count}", String(batchSelectionSummary.totalCount))
            .replace("{affected}", String(batchSelectionSummary.affectedSkillCount)),
        )}
        onClose={handleCloseBatchToolDialog}
        t={t}
      />

      {showCreateDialog && (
        <CreateSkillDialog
          creating={creating}
          existingIds={skills.filter((skill) => skill.scope === "global").map((skill) => skill.id)}
          onCancel={() => setShowCreateDialog(false)}
          onCreate={handleCreateSkill}
          t={t}
        />
      )}

      {showProjectBindingsDialog && config && (
        <ProjectBindingsDialog
          open={showProjectBindingsDialog}
          projects={config.projects ?? []}
          activeProjectId={resolveActiveProjectId(config.active_project_id, config.projects ?? [])}
          pendingProjectBinding={pendingProjectBinding}
          saving={projectBindingsSaving}
          onAddProject={() => void handleAddProjectBinding()}
          onPendingProjectNameChange={handlePendingProjectNameChange}
          onConfirmPendingProject={handleConfirmPendingProjectBinding}
          onCancelPendingProject={handleCancelPendingProjectBinding}
          onSetActiveProject={(projectId) => void handleSetActiveProjectBinding(projectId)}
          onRemoveProject={(projectId) => void handleRemoveProjectBinding(projectId)}
          onClose={handleCloseProjectBindingsDialog}
          t={t}
        />
      )}

      {showCategoryEditDialog && config && (
        <CategoryEditDialog
          open={showCategoryEditDialog}
          config={config}
          onClose={() => setShowCategoryEditDialog(false)}
          onSave={async (nextConfig) => {
            try {
              await invoke("save_config", { config: nextConfig });
              setConfig(nextConfig);
            } catch (err) {
              addToast(err instanceof Error ? err.message : String(err), "error");
            }
          }}
          t={t}
        />
      )}

      {showBatchCategoryDialog && (
        <BatchCategoryDialog
          open={showBatchCategoryDialog}
          count={selectedBatchItems.length}
          dimensions={categoryDimensions}
          onClose={() => setShowBatchCategoryDialog(false)}
          onConfirm={handleBatchCategoryAssign}
          t={t}
        />
      )}

      {showBatchTagDialog && (
        <BatchTagDialog
          open={showBatchTagDialog}
          count={selectedBatchItems.length}
          existingTags={allExistingTags}
          onClose={() => setShowBatchTagDialog(false)}
          onConfirm={handleBatchTag}
          t={t}
        />
      )}

      {showAiAssistantDialog && (
        <AiAssistantDialog
          open={showAiAssistantDialog}
          onClose={() => setShowAiAssistantDialog(false)}
          onBatchTranslate={() => {
            const targets = sortedUnifiedItems
              .filter((it) => it.kind === "skill" && it.skill)
              .map((it) => it.skill!) as Skill[];
            void handleBatchTranslate(targets);
          }}
          onAiClassify={() => {
            const targets = sortedUnifiedItems
              .filter((it) => it.kind === "skill" && it.skill)
              .map((it) => it.skill!) as Skill[];
            void handleAiClassify(targets);
          }}
          t={t}
        />
      )}

      <AiClassifyDialog
        open={showAiClassifyDialog}
        totalCount={aiClassifyProgress.total}
        processedCount={aiClassifyProgress.processed}
        currentName={aiClassifyProgress.currentName}
        classifying={aiClassifying}
        done={!aiClassifying && aiClassifyProgress.processed > 0 && !aiClassifyError}
        error={aiClassifyError}
        onClose={() => setShowAiClassifyDialog(false)}
        onRetry={() => {
          setShowAiClassifyDialog(false);
          setAiClassifyError(null);
          const targets = sortedUnifiedItems
            .filter((it) => it.kind === "skill" && it.skill)
            .map((it) => it.skill!) as Skill[];
          void handleAiClassify(targets);
        }}
        t={t}
      />
      </Suspense>
    </div>
    </>
  );
}



