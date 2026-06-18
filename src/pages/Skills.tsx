import { useState, useEffect, useCallback, useMemo, useRef, type CSSProperties } from "react";
import { useDebouncedCallback } from "use-debounce";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { confirm, open } from "@tauri-apps/plugin-dialog";
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
  Tool,
} from "@/types";
import { useTranslation, TranslationPath } from "@/i18n";
import {
  useSkillTranslation,
  makeTranslationKey,
  type SkillFileTranslationProgress,
} from "@/hooks/useSkillTranslation";
import { TranslateIconButton } from "@/components/translation/TranslateIconButton";
import { formatTranslationError } from "@/lib/formatTranslationError";
import { getSkillColor } from "@/lib/getSkillColor";
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
  hasSkillMetadataEntry,
  removeSkillMetadataEntry,
  migrateSkillMetadataToInstanceIds,
} from "./skills/skillTags";
import { orderToolIdsForSkill } from "./skills/orderToolIds";
import { getEnabledToolIds } from "./skills/getEnabledToolIds";
import {
  getSkillBulkToggleConfirmKey,
  getSkillBulkToggleMode,
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
import { BatchManageToolsDialog } from "./skills/BatchManageToolsDialog";
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
import { ProjectBindingsDialog } from "./ProjectBindingsDialog";
import { SkillManageDialog, CreateSkillDialog, DisplayNameEditorDialog } from "@/components/skills/dialogs";
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
    backgroundColor: active ? "rgba(9, 105, 218, 0.08)" : "var(--background)",
    border: active ? "1px solid rgba(9, 105, 218, 0.28)" : "1px solid var(--border)",
    borderRadius: "8px",
    cursor: "pointer",
    textAlign: "left",
  };
}

type SkillEditorTab = "tools" | "tags";

type SkillCardActionMenuProps = {
  deleting: boolean;
  editLabel: string;
  editDisplayLabel: string;
  deleteLabel: string;
  moreActionsLabel: string;
  onEdit: () => void;
  onEditDisplay: () => void;
  onDelete: () => void;
};

function renderPreviewChips(chips: string[], overflowCount: number) {
  if (chips.length === 0 && overflowCount === 0) {
    return null;
  }

  return (
    <>
      {chips.map((chip) => (
        <span
          key={chip}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            fontSize: "11px",
            fontWeight: 500,
            color: "var(--primary)",
            backgroundColor: "color-mix(in srgb, var(--primary) 10%, transparent)",
            border: "1px solid color-mix(in srgb, var(--primary) 25%, transparent)",
            borderRadius: "999px",
            padding: "3px 8px",
            lineHeight: 1.2,
          }}
        >
          {chip}
        </span>
      ))}
      {overflowCount > 0 && (
        <span
          style={{
            fontSize: "11px",
            fontWeight: 500,
            color: "var(--muted-foreground)",
            padding: "3px 0",
          }}
        >
          +{overflowCount}
        </span>
      )}
    </>
  );
}

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
  const [translatingIds, setTranslatingIds] = useState<Set<string>>(new Set());
  const [skillTranslationProgress, setSkillTranslationProgress] = useState<Record<string, SkillFileTranslationProgress>>({});
  const [batchTranslating, setBatchTranslating] = useState(false);
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
  const [toolEditorSkillId, setToolEditorSkillId] = useState<string | null>(null);
  const [toolEditorQuery, setToolEditorQuery] = useState("");
  const [toolEditorEnabledOnly, setToolEditorEnabledOnly] = useState(false);
  const [bulkTogglingSkillId, setBulkTogglingSkillId] = useState<string | null>(null);
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
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { toasts, addToast, updateToast, removeToast } = useToast();

  // Custom hook for data management
  const {
    skills: dataSkills,
    skillPackages: dataSkillPackages,
    tools: dataTools,
    config: dataConfig,
    reloadData: dataReloadData,
  } = useSkillsData();

  // Custom hook for filtering and search
  const {
    unifiedItems: filterUnifiedItems,
    sortedUnifiedItems: filterSortedUnifiedItems,
    hasActiveSkillFilters: filterHasActiveSkillFilters,
  } = useSkillFilter({
    skills: dataSkills,
    skillPackages: dataSkillPackages,
    tools: dataTools,
    config: dataConfig,
    searchQuery: debouncedSearchQuery, // 使用防抖后的搜索查询
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

  // Display name editor state
  const [displayNameEditorSkillId, setDisplayNameEditorSkillId] = useState<string | null>(null);
  const [displayNameDraft, setDisplayNameDraft] = useState("");
  const [displayDescDraft, setDisplayDescDraft] = useState("");
  const [savingDisplayName, setSavingDisplayName] = useState(false);

  // Batch translate names state
  const [translatingNames, setTranslatingNames] = useState(false);

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

  const loadData = useCallback(async () => {
    const settled = await Promise.allSettled([
      invoke<Skill[]>("list_skills"),
      invoke<InstalledSkillPackage[]>("list_skill_packages"),
      invoke<AppConfig>("get_config"),
      invoke<Tool[]>("detect_tools"),
    ]);

    const [skillsR, packagesR, configR, toolsR] = settled;
    const failures: string[] = [];
    for (const r of settled) {
      if (r.status === "rejected") {
        failures.push(r.reason instanceof Error ? r.reason.message : String(r.reason));
      }
    }

    try {
      if (skillsR.status === "fulfilled") setSkills(skillsR.value);
      if (packagesR.status === "fulfilled") setSkillPackages(packagesR.value);
      if (toolsR.status === "fulfilled") setTools(toolsR.value);

      if (configR.status === "fulfilled") {
        const configResult = configR.value;
        const skillsForMigration = skillsR.status === "fulfilled" ? skillsR.value : [];
        const migratedSkillMetadata = migrateSkillMetadataToInstanceIds(
          skillsForMigration,
          configResult.skill_metadata,
        );
        const nextConfig = migratedSkillMetadata === configResult.skill_metadata
          ? configResult
          : { ...configResult, skill_metadata: migratedSkillMetadata };
        if (nextConfig !== configResult) {
          try {
            await invoke("save_config", { config: nextConfig });
          } catch (err) {
            failures.push(err instanceof Error ? err.message : String(err));
          }
        }
        setConfig(nextConfig);
      }

      for (const msg of failures) {
        addToast(msg, "error");
      }
    } finally {
      setInitialLoading(false);
    }
  }, [addToast]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const [skillsResult, skillPackagesResult, configResult, toolsResult] = await Promise.all([
        invoke<Skill[]>("refresh_skills"),
        invoke<InstalledSkillPackage[]>("list_skill_packages"),
        invoke<AppConfig>("get_config"),
        invoke<Tool[]>("detect_tools"),
      ]);
      setSkills(skillsResult);
      setSkillPackages(skillPackagesResult);
      setConfig(configResult);
      setTools(toolsResult);
      addToast(t("common.refreshSuccess"), "success");
    } catch (err) {
      addToast(err instanceof Error ? err.message : String(err), "error");
    } finally {
      setRefreshing(false);
    }
  }, [addToast, t]);

  const reloadData = useCallback(async () => {
    try {
      const [skillsResult, skillPackagesResult, configResult, toolsResult] = await Promise.all([
        invoke<Skill[]>("list_skills"),
        invoke<InstalledSkillPackage[]>("list_skill_packages"),
        invoke<AppConfig>("get_config"),
        invoke<Tool[]>("detect_tools"),
      ]);
      setSkills(skillsResult);
      setSkillPackages(skillPackagesResult);
      setConfig(configResult);
      setTools(toolsResult);
    } catch (err) {
      addToast(err instanceof Error ? err.message : String(err), "error");
    }
  }, [addToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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

  // Display name editor handlers
  const openDisplayNameEditor = useCallback((skill: Skill) => {
    const metadataKey = getSkillMetadataKey(skill);
    const existing = skillMetadata?.[metadataKey];
    setDisplayNameDraft(existing?.display_name || "");
    setDisplayDescDraft(existing?.display_description || "");
    setDisplayNameEditorSkillId(skill.instance_id);
  }, [skillMetadata]);

  const closeDisplayNameEditor = useCallback(() => {
    setDisplayNameEditorSkillId(null);
    setDisplayNameDraft("");
    setDisplayDescDraft("");
  }, []);

  const handleSaveDisplayName = useCallback(async (skill: Skill) => {
    if (!config) return;

    const metadataKey = getSkillMetadataKey(skill);
    const currentMetadata = skillMetadata?.[metadataKey] || { tags: [] };
    const displayName = displayNameDraft.trim() || null;
    const displayDescription = displayDescDraft.trim() || null;

    // Only save if something changed
    if (displayName === (currentMetadata.display_name || null) &&
        displayDescription === (currentMetadata.display_description || null)) {
      closeDisplayNameEditor();
      return;
    }

    setSavingDisplayName(true);
    try {
      const nextMetadata = {
        ...currentMetadata,
        display_name: displayName,
        display_description: displayDescription,
      };
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
      closeDisplayNameEditor();
    } catch (err) {
      addToast(err instanceof Error ? err.message : String(err), "error");
    } finally {
      setSavingDisplayName(false);
    }
  }, [config, skillMetadata, displayNameDraft, displayDescDraft, closeDisplayNameEditor, addToast, t]);

  // Batch translate skill names and descriptions
  const handleBatchTranslateNames = useCallback(async () => {
    if (!translation.isConfigured) {
      const configured = await translation.refreshConfigured();
      if (!configured) {
        addToast(t("skills.llmNotConfigured"), "error");
        return;
      }
    }

    const targetLang = config?.preferences?.language || "en";
    const instanceIds = skills.map((s) => s.instance_id);

    if (instanceIds.length === 0) {
      addToast(t("skills.batchTranslateNoNew"), "info");
      return;
    }

    const confirmed = await confirm(
      t("skills.batchTranslateNamesConfirm").replace("{count}", String(instanceIds.length)),
      { title: t("skills.batchTranslateNames"), kind: "warning" }
    );
    if (!confirmed) return;

    setTranslatingNames(true);
    try {
      const result = await invoke<{ succeeded: string[]; failed: { instance_id: string; reason: string }[] }>(
        "translate_skill_names_batch",
        { instanceIds, targetLang }
      );

      const fail = result.failed.length;
      const ok = result.succeeded.length;
      addToast(
        t("skills.batchTranslateNamesDone")
          .replace("{ok}", String(ok))
          .replace("{total}", String(instanceIds.length))
          .replace("{fail}", String(fail)),
        fail > 0 ? "error" : "success"
      );

      await reloadData();
    } catch (err) {
      addToast(formatTranslationError(err, t), "error");
    } finally {
      setTranslatingNames(false);
    }
  }, [translation, config, skills, addToast, reloadData, t]);

  const handleToggle = actionHandleToggle;

  const openSkillEditor = useCallback((skillIdentity: string, tab: SkillEditorTab = "tools") => {
    setToolEditorSkillId(skillIdentity);
    setGroupEditorPackageId(null);
    setSkillEditorTab(tab);
    setToolEditorQuery("");
    setToolEditorEnabledOnly(false);
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

  const handleTranslateSkill = useCallback(
    async (skill: Skill, force: boolean = false) => {
      let configured = translation.isConfigured;
      if (!configured) {
        configured = await translation.refreshConfigured();
      }
      if (!configured) {
        addToast(t("skills.llmNotConfigured"), "error");
        return;
      }
      setTranslatingIds((prev) => {
        const next = new Set(prev);
        next.add(skill.instance_id);
        return next;
      });
      try {
        const result = await translation.translateSkillFiles(skill.instance_id, language, force, (progress) => {
          setSkillTranslationProgress((prev) => ({
            ...prev,
            [skill.instance_id]: progress,
          }));
        });
        if (result.failed.length > 0) {
          addToast(
            t("editor.translateFilesPartialFailed")
              .replace("{ok}", String(result.files.length))
              .replace("{fail}", String(result.failed.length)),
            "error",
          );
        }
      } catch (err) {
        addToast(formatTranslationError(err, t), "error");
      } finally {
        setSkillTranslationProgress((prev) => {
          const next = { ...prev };
          delete next[skill.instance_id];
          return next;
        });
        setTranslatingIds((prev) => {
          const next = new Set(prev);
          next.delete(skill.instance_id);
          return next;
        });
      }
    },
    [translation, language, addToast, t, formatTranslationError],
  );

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

      const pending: Skill[] = [];
      let skipped = 0;
      for (const skill of skillsToTranslate) {
        const key = makeTranslationKey(skill.instance_id, language);
        if (translation.getTranslation(key)) {
          skipped += 1;
        } else {
          pending.push(skill);
        }
      }

      if (pending.length === 0) {
        addToast(t("skills.batchTranslateNoNew"), "info");
        return;
      }

      const confirmMessage = skipped > 0
        ? t("skills.batchTranslateConfirmSkip")
            .replace("{new}", String(pending.length))
            .replace("{skipped}", String(skipped))
        : t("skills.batchTranslateConfirm").replace("{count}", String(pending.length));

      const confirmed = await confirm(confirmMessage, { title: t("skills.batchTranslate") });
      if (!confirmed) return;

      setBatchTranslating(true);
      let progressToastId: string | undefined;
      try {
        const ids = pending.map((s) => s.instance_id);
        const result = await translation.translateBatch(ids, language, (p) => {
          const progressMsg = t("skills.batchTranslateProgress")
            .replace("{current}", String(p.current))
            .replace("{total}", String(p.total))
            .replace("{name}", p.skill_name);

          if (!progressToastId) {
            // 创建持久化进度 toast
            progressToastId = addToast(progressMsg, "info", true);
          } else {
            // 更新现有 toast
            updateToast(progressToastId, progressMsg);
          }
        });

        // 翻译完成：移除进度 toast，显示结果
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
      } catch (err) {
        if (progressToastId) {
          removeToast(progressToastId);
        }
        addToast(formatTranslationError(err, t), "error");
      } finally {
        setBatchTranslating(false);
      }
    },
    [translation, language, addToast, updateToast, removeToast, t],
  );

  const handleDelete = actionHandleDelete;

  const handleCreateSkill = actionHandleCreateSkill;

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

  const hasActiveSkillFilters = Boolean(searchQuery.trim()) || selectedTags.length > 0 || untaggedOnly || scopeFilter !== "all";

  const scopeFilterCounts = useMemo(() => {
    const globalCount = unifiedItems.filter((item) => item.scopeLabel === "global").length;
    const projectCount = unifiedItems.filter((item) => item.scopeLabel === "project").length;
    return { global: globalCount, project: projectCount };
  }, [unifiedItems]);

  const scopeTabs = useMemo(() => {
    const tabs: Array<{ value: "all" | "global" | "project"; label: string; count: number }> = [
      { value: "all", label: t("skills.scopeFilterAll"), count: unifiedItems.length },
    ];
    if (scopeFilterCounts.global > 0) {
      tabs.push({ value: "global", label: t("skills.scopeGlobal"), count: scopeFilterCounts.global });
    }
    if (scopeFilterCounts.project > 0) {
      tabs.push({ value: "project", label: t("skills.scopeProject"), count: scopeFilterCounts.project });
    }
    return tabs;
  }, [scopeFilterCounts, t, unifiedItems.length]);

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

  // 计算网格列数
  const [containerWidth, setContainerWidth] = useState(1200);
  const cardWidth = 320;
  const gap = 16;
  const columns = Math.max(1, Math.floor((containerWidth + gap) / (cardWidth + gap)));

  // 将数据按行分组（每行 columns 个）
  const rows = useMemo(() => {
    const result: typeof sortedUnifiedItems[] = [];
    for (let i = 0; i < sortedUnifiedItems.length; i += columns) {
      result.push(sortedUnifiedItems.slice(i, i + columns));
    }
    return result;
  }, [sortedUnifiedItems, columns]);

  // 网格虚拟化 - 按行虚拟化
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => listContainerRef.current,
    estimateSize: () => 180, // 估计每行的高度
    overscan: 3, // 预渲染 3 行
  });

  // 监听容器宽度变化
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
      case "translate-names":
        return (
          <button
            key={actionId}
            type="button"
            onClick={() => void handleBatchTranslateNames()}
            disabled={isBatchManageMode || translatingNames}
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
              cursor: isBatchManageMode || translatingNames ? "not-allowed" : "pointer",
              opacity: isBatchManageMode || translatingNames ? 0.6 : 1,
            }}
          >
            {translatingNames ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 1s linear infinite" }}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m5 8 6 6M4 14l6-6 2-3M2 5h12M7 2h1M12.22 8l2.47-2.47M17.5 14.5l-2.47 2.47" />
              </svg>
            )}
            {t("skills.translateNames")}
          </button>
        );
      case "create-skill":
        return (
          <button
            key={actionId}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: 500,
              color: "var(--primary-foreground)",
              backgroundColor: "var(--foreground)",
              border: "none",
              borderRadius: "8px",
              cursor: isBatchManageMode ? "not-allowed" : "pointer",
              transition: "opacity 0.15s",
              opacity: isBatchManageMode ? 0.5 : 1,
            }}
            onMouseEnter={(e) => { if (!isBatchManageMode) e.currentTarget.style.opacity = "0.9"; }}
            onMouseLeave={(e) => { if (!isBatchManageMode) e.currentTarget.style.opacity = "1"; }}
            onClick={() => {
              if (!isBatchManageMode) {
                setShowCreateDialog(true);
              }
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            {t("skills.newSkill")}
          </button>
        );
    }
  }, [
    enterBatchManageMode,
    exitBatchManageMode,
    handleOpenBatchToolDialog,
    handleBatchTranslateNames,
    isBatchManageMode,
    translatingNames,
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
  }, [addToast, config, skills]);

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

      await reloadData();
      if (options?.closeOnSuccess ?? true) {
        exitBatchManageMode();
      }
    } catch (err) {
      addToast(err instanceof Error ? err.message : String(err), "error");
    } finally {
      setBatchSubmitting(false);
    }
  }, [addToast, exitBatchManageMode, reloadData, selectedBatchItems, t]);

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

  const toolEditorSkill = useMemo(
    () => skills.find((skill) => skill.instance_id === toolEditorSkillId) ?? null,
    [skills, toolEditorSkillId],
  );

  const toolEditorOrderedToolIds = useMemo(() => {
    if (!toolEditorSkill) {
      return [];
    }

    return orderToolIdsForSkill(toolIds, toolEditorSkill.enabled);
  }, [toolEditorSkill, toolIds]);

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

  const toolEditorIsBulkToggling = toolEditorSkill ? bulkTogglingSkillId === toolEditorSkill.instance_id : false;
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

      await reloadData();
    } catch (err) {
      addToast(err instanceof Error ? err.message : String(err), "error");
      await reloadData();
    } finally {
      setTogglingGroupToolKey(null);
    }
  }, [addToast, reloadData, t, tools]);

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

      await reloadData();
    } catch (err) {
      addToast(err instanceof Error ? err.message : String(err), "error");
      await reloadData();
    } finally {
      setBulkTogglingGroupId(null);
    }
  }, [addToast, reloadData, t, tools]);

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
      await reloadData();
    } catch (err) {
      addToast(err instanceof Error ? err.message : String(err), "error");
    } finally {
      setDeletingGroupId(null);
    }
  }, [addToast, closeSkillEditor, config, groupEditorPackageId, reloadData, t]);

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
              setInitialLoading(true);
              loadData();
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
                    border: selectedTags.length > 0 || untaggedOnly || scopeFilter !== "all" ? "1px solid rgba(9, 105, 218, 0.4)" : "1px solid var(--border)",
                    borderRadius: "8px",
                    cursor: "pointer",
                    minWidth: "124px",
                    justifyContent: "space-between",
                    boxShadow: selectedTags.length > 0 || untaggedOnly || scopeFilter !== "all" ? "0 0 0 3px rgba(9, 105, 218, 0.08)" : "none",
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

            <div style={{ position: "relative" }}>
              <svg
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--muted-foreground)",
                  pointerEvents: "none",
                }}
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                type="text"
                placeholder={t("skills.searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  debouncedSearch(e.target.value);
                }}
                style={{
                  width: "200px",
                  padding: "8px 12px 8px 36px",
                  fontSize: "13px",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  backgroundColor: "var(--background)",
                  color: "var(--foreground)",
                  outline: "none",
                  transition: "border-color 0.15s, box-shadow 0.15s",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "var(--ring)";
                  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(9, 105, 218, 0.1)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "var(--border)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
            </div>

            {!isBatchManageMode && (
              <button
                type="button"
                onClick={() => {
                  const targets = sortedUnifiedItems
                    .filter((it) => it.kind === "skill" && it.skill)
                    .map((it) => it.skill!) as Skill[];
                  void handleBatchTranslate(targets);
                }}
                disabled={batchTranslating || sortedUnifiedItems.length === 0}
                title={t("skills.batchTranslate")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 12px",
                  fontSize: "13px",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  backgroundColor: "var(--background)",
                  color: "var(--foreground)",
                  cursor: batchTranslating ? "wait" : "pointer",
                  opacity: batchTranslating ? 0.6 : 1,
                  whiteSpace: "nowrap",
                }}
              >
                {t("skills.batchTranslate")}
              </button>
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

      <nav
        aria-label={t("skills.scopeFilterAll")}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "10px 32px",
          borderBottom: "1px solid var(--border)",
          backgroundColor: "var(--background)",
          flexShrink: 0,
        }}
      >
        {scopeTabs.map((tab) => {
          const active = scopeFilter === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setScopeFilter(tab.value)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "6px 14px",
                fontSize: "13px",
                fontWeight: active ? 600 : 500,
                color: active ? "var(--primary-foreground)" : "var(--muted-foreground)",
                backgroundColor: active ? "var(--foreground)" : "transparent",
                border: active ? "none" : "1px solid var(--border)",
                borderRadius: "999px",
                cursor: "pointer",
                transition: "background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease",
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
              <span>{tab.label}</span>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 500,
                  opacity: active ? 0.85 : 0.7,
                  padding: "1px 7px",
                  borderRadius: "999px",
                  backgroundColor: active
                    ? "rgba(255, 255, 255, 0.15)"
                    : "color-mix(in srgb, var(--foreground) 6%, transparent)",
                  minWidth: "20px",
                  textAlign: "center",
                  lineHeight: 1.4,
                }}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </nav>

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
                const translationKey = item.kind === "skill" && item.skill
                  ? makeTranslationKey(item.skill.instance_id, language)
                  : null;
                const translated = translationKey ? translation.getTranslation(translationKey) : null;
                const isTranslatedView = translationKey
                  ? translation.getView(translationKey) === "translated" && translated != null
                  : false;
                const cardTitle = isTranslatedView && translated ? translated.name : item.title;
                const description = item.kind === "group"
                  ? item.skillPackage?.package_id ?? getUnifiedItemMetaLabel(item, t)
                  : isTranslatedView && translated
                    ? translated.description || t("skills.noDescription")
                    : item.description || t("skills.noDescription");
                const previewChips = item.previewChips.map((chip) => `#${chip}`);
                const fileProgress = item.kind === "skill" && item.skill
                  ? skillTranslationProgress[item.skill.instance_id]
                  : undefined;
                const fileProgressText = fileProgress
                  ? t("editor.translateFilesCompact")
                      .replace("{current}", String(fileProgress.current))
                      .replace("{total}", String(fileProgress.total))
                      .replace("{path}", fileProgress.path)
                  : null;
                const fileProgressPercent = fileProgress && fileProgress.total > 0
                  ? Math.max(0, Math.min(100, (fileProgress.current / fileProgress.total) * 100))
                  : 0;

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
                    fileProgressText={fileProgressText}
                    fileProgressPercent={fileProgressPercent}
                    isTranslatedView={isTranslatedView}
                    translated={translated}
                    tools={tools}
                    deletingSkill={deletingSkill}
                    deletingGroupId={deletingGroupId}
                    translatingIds={translatingIds}
                    skillTranslationProgress={skillTranslationProgress}
                    onOpen={() => void handleOpenUnifiedItem(item)}
                    onToggleBatchSelection={() => handleToggleBatchItemSelection(item.key)}
                    onEdit={() => {
                      if (item.kind === "skill" && item.skill) {
                        openSkillEditor(item.skill.instance_id, "tools");
                      } else if (item.kind === "group") {
                        openGroupEditor(item.id);
                      }
                    }}
                    onEditDisplay={() => {
                      if (item.kind === "skill" && item.skill) {
                        openDisplayNameEditor(item.skill);
                      }
                    }}
                    onDelete={() => {
                      if (item.kind === "skill" && item.skill) {
                        void handleDelete(item.skill);
                      } else if (item.kind === "group") {
                        void handleDeleteGroup(item);
                      }
                    }}
                    onTranslate={() => {
                      if (item.kind === "skill" && item.skill) {
                        if (translated && translationKey) {
                          translation.setView(translationKey, isTranslatedView ? "original" : "translated");
                        } else {
                          void handleTranslateSkill(item.skill);
                        }
                      }
                    }}
                    onRetranslate={() => {
                      if (item.kind === "skill" && item.skill) {
                        void handleTranslateSkill(item.skill, true);
                      }
                    }}
                    t={t}
                  />
                );
              })}
            </div>
          )}
        </div>
      </main>

      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {toolEditorSkill && (
        <SkillManageDialog
          skillName={toolEditorSkill.name}
          skillDescription={toolEditorSkill.description || t("skills.noDescription")}
          activeTab={skillEditorTab}
          onTabChange={setSkillEditorTab}
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
          onToggle={(toolId, enabled) => handleToggle(toolEditorSkill.instance_id, toolId, enabled)}
          onBulkToggle={() => handleBulkToggle(toolEditorSkill, toolEditorFilteredToolIds)}
          tags={toolEditorTags}
          tagDraft={tagDraft}
          onTagDraftChange={setTagDraft}
          onAddTag={() => void handleAddTag(toolEditorSkill)}
          onRemoveTag={(tag) => void handleRemoveTag(toolEditorSkill, tag)}
          tagSuggestions={toolEditorTagSuggestions}
          onSelectTagSuggestion={(tag) => void persistSkillTags(toolEditorSkill, [...toolEditorTags, tag])}
          savingTags={savingTagsSkillId === getSkillMetadataKey(toolEditorSkill)}
          t={t}
        />
      )}

      {groupEditorItem && groupEditorItem.skillPackage && (
        <SkillManageDialog
          skillName={groupEditorItem.title}
          skillDescription={groupEditorItem.skillPackage.package_id}
          activeTab={skillEditorTab}
          onTabChange={setSkillEditorTab}
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

      {displayNameEditorSkillId && (() => {
        const editingSkill = skills.find((s) => s.instance_id === displayNameEditorSkillId);
        if (!editingSkill) return null;
        return (
          <DisplayNameEditorDialog
            skillName={editingSkill.name}
            skillDescription={editingSkill.description || ""}
            displayNameDraft={displayNameDraft}
            displayDescDraft={displayDescDraft}
            saving={savingDisplayName}
            onDisplayNameChange={setDisplayNameDraft}
            onDisplayDescChange={setDisplayDescDraft}
            onSave={() => void handleSaveDisplayName(editingSkill)}
            onClose={closeDisplayNameEditor}
            t={t}
          />
        );
      })()}

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
    </div>
  );
}



