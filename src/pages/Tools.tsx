import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { confirm, open } from "@tauri-apps/plugin-dialog";

import { Skill, Tool } from "@/types";
import { useTranslation } from "@/i18n";
import { getToolIconUrl, GenericToolIcon } from "@/assets/tools";
import { FolderOpen, Pencil, Plus, Power, Trash2 } from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import { RelationToggleDialog } from "@/components/skills/RelationToggleDialog";
import { RefreshButton } from "@/components/ui/refresh-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/page-header";
import { ToastContainer, useToast } from "@/components/ui/toast";
import { PageLoader } from "@/components/ui/loading";
import { sortToolsByEnabled } from "./tools/sortTools";
import { CustomToolFormDialog } from "./tools/CustomToolFormDialog";
import { HermesGroupCard } from "./tools/HermesGroupCard";
import { isHermesToolId } from "./tools/hermesGrouping";
import {
  getBulkToggleConfirmKey,
  getBulkToggleTargets,
  getNextBulkToggleMode,
} from "./tools/bulkToggleTools";
import { orderSkillIdsForTool } from "./tools/orderSkillIdsForTool";
import {
  getToolBulkToggleConfirmKey,
  getToolBulkToggleMode,
  getToolBulkToggleTargets,
} from "./tools/bulkToggleToolSkills";

function getSkillDisplayName(skillIdentity: string, skills: Skill[]): string {
  const skill = skills.find((item) => item.instance_id === skillIdentity) ?? skills.find((item) => item.id === skillIdentity);
  return skill?.name ?? skillIdentity;
}

export function Tools() {
  const { t } = useTranslation();
  const [tools, setTools] = useState<Tool[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bulkToggling, setBulkToggling] = useState(false);
  const { toasts, addToast, removeToast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editingToolId, setEditingToolId] = useState<string | null>(null);
  const [toolEditorToolId, setToolEditorToolId] = useState<string | null>(null);
  const [toolEditorQuery, setToolEditorQuery] = useState("");
  const [toolEditorEnabledOnly, setToolEditorEnabledOnly] = useState(false);
  const [toolEditorPreserveOrder, setToolEditorPreserveOrder] = useState(false);
  const [togglingSkill, setTogglingSkill] = useState<string | null>(null);
  const [bulkTogglingToolId, setBulkTogglingToolId] = useState<string | null>(null);
  const [dragOverToolId, setDragOverToolId] = useState<string | null>(null);
  const draggedToolIdRef = useRef<string | null>(null);
  const [iconFallbackStage, setIconFallbackStage] = useState<Record<string, "asset" | "file" | "none">>({});
  const [toolsOrder, setToolsOrder] = useState<string[]>([]);

  const fetchToolsAndSkills = useCallback(async (
    toolsCommand: "detect_tools" | "refresh_tools",
    skillsCommand: "list_skills" | "refresh_skills",
  ) => {
    setError(null);
    const [toolsResult, skillsResult] = await Promise.all([
      invoke<Tool[]>(toolsCommand),
      invoke<Skill[]>(skillsCommand),
    ]);
    setTools(toolsResult);
    setSkills(skillsResult);
    setIconFallbackStage({});
  }, []);

  // Load saved tools order from config
  const loadToolsOrder = useCallback(async () => {
    try {
      const config = await invoke<{ tools_order?: string[] }>("get_config");
      if (config.tools_order && config.tools_order.length > 0) {
        setToolsOrder(config.tools_order);
      }
    } catch (err) {
      console.error("Failed to load tools order:", err);
    }
  }, []);

  // Save tools order to config
  const saveToolsOrder = useCallback(async (order: string[]) => {
    try {
      await invoke("save_tools_order", { toolsOrder: order });
      setToolsOrder(order);
    } catch (err) {
      console.error("Failed to save tools order:", err);
    }
  }, []);

  // Initial load - uses cached data
  const loadTools = useCallback(async () => {
    try {
      // Load config first to get saved order
      await loadToolsOrder();
      await fetchToolsAndSkills("detect_tools", "list_skills");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setInitialLoading(false);
    }
  }, [fetchToolsAndSkills, loadToolsOrder]);

  // Manual refresh - forces re-detection
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchToolsAndSkills("refresh_tools", "refresh_skills");
      addToast(t("common.refreshSuccess"), "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRefreshing(false);
    }
  }, [addToast, fetchToolsAndSkills, t]);

  // Reload after operations - force re-detection to avoid stale cached list
  const reloadTools = useCallback(async () => {
    try {
      // Save current order before refresh
      const currentOrder = tools.map(t => t.id);
      await fetchToolsAndSkills("refresh_tools", "list_skills");
      // Try to save the order again after refresh (in case tools changed)
      if (currentOrder.length > 0) {
        saveToolsOrder(currentOrder);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [fetchToolsAndSkills, tools, saveToolsOrder]);
  const toggleToolEnabled = useCallback(async (tool: Tool, enabled: boolean) => {
    // Undetected tools cannot be enabled, but still allow disabling if already enabled.
    if (enabled && !tool.detected) {
      setError(t("skills.toolNotDetected"));
      return;
    }

    const previousEnabled = tool.config.enabled;

    // Optimistic update
    setTools(prev => prev.map(t =>
      t.id === tool.id ? { ...t, config: { ...t.config, enabled } } : t
    ));
    setError(null);

    try {
      await invoke("set_tool_enabled", { toolId: tool.id, enabled });
    } catch (err) {
      // Rollback on error
      setTools(prev => prev.map(t =>
        t.id === tool.id ? { ...t, config: { ...t.config, enabled: previousEnabled } } : t
      ));
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [t]);

  const openToolSkillEditor = useCallback((toolId: string) => {
    setToolEditorToolId(toolId);
    setToolEditorQuery("");
    setToolEditorEnabledOnly(false);
    setToolEditorPreserveOrder(false);
  }, []);

  const closeToolSkillEditor = useCallback(() => {
    setToolEditorToolId(null);
    setToolEditorQuery("");
    setToolEditorEnabledOnly(false);
  }, []);

  const handleToggleSkillForTool = useCallback(async (tool: Tool, instanceId: string, enabled: boolean) => {
    const toggleKey = `${tool.id}:${instanceId}`;
    setTogglingSkill(toggleKey);

    try {
      if (enabled) {
        await invoke("enable_skill", { instanceId, toolId: tool.id });
        addToast(
          t("skills.enableSuccess")
            .replace("{skill}", getSkillDisplayName(instanceId, skills))
            .replace("{tool}", tool.name),
          "success",
        );
      } else {
        await invoke("disable_skill", { instanceId, toolId: tool.id });
        addToast(
          t("skills.disableSuccess")
            .replace("{skill}", getSkillDisplayName(instanceId, skills))
            .replace("{tool}", tool.name),
          "success",
        );
      }
      await reloadTools();
    } catch (err) {
      addToast(err instanceof Error ? err.message : String(err), "error");
    } finally {
      setTogglingSkill(null);
    }
  }, [addToast, reloadTools, skills, t]);

  const handleBulkToggleToolSkills = useCallback(async (tool: Tool, visibleSkillIds: string[]) => {
    const enabledMap: Record<string, boolean> = {};
    skills.forEach((skill) => {
      enabledMap[skill.instance_id] = Boolean(skill.enabled[tool.id]);
    });

    const bulkMode = getToolBulkToggleMode(visibleSkillIds, enabledMap);
    const targetSkillIds = getToolBulkToggleTargets(visibleSkillIds, enabledMap, bulkMode);

    if (targetSkillIds.length === 0) {
      return;
    }

    const enabled = bulkMode === "enable";
    const confirmed = await confirm(
      t(getToolBulkToggleConfirmKey(bulkMode)).replace("{count}", String(targetSkillIds.length)),
      {
        title: t("tools.bulkConfirmTitle"),
        kind: "warning",
      },
    );
    if (!confirmed) {
      return;
    }

    setBulkTogglingToolId(tool.id);
    setError(null);

    // Optimistic update for immediate feedback.
    setSkills((prev) =>
      prev.map((skill) => {
        if (!targetSkillIds.includes(skill.instance_id)) {
          return skill;
        }
        return {
          ...skill,
          enabled: {
            ...skill.enabled,
            [tool.id]: enabled,
          },
        };
      }),
    );

    try {
      const command = enabled ? "enable_skill" : "disable_skill";
      const results = await Promise.allSettled(
        targetSkillIds.map((instanceId) => invoke(command, { instanceId, toolId: tool.id })),
      );

      const failedCount = results.filter((result) => result.status === "rejected").length;
      const changedCount = targetSkillIds.length - failedCount;

      if (changedCount > 0) {
        const successMessage = enabled
          ? t("tools.bulkEnableSkillsSuccess")
          : t("tools.bulkDisableSkillsSuccess");
        addToast(successMessage.replace("{count}", String(changedCount)), "success");
      }

      if (failedCount > 0) {
        const failedMessage = t("tools.bulkToggleSkillsPartialFailed").replace("{count}", String(failedCount));
        addToast(failedMessage, "error");
        setError(failedMessage);
      }

      await reloadTools();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      addToast(message, "error");
      setError(message);
      await reloadTools();
    } finally {
      setBulkTogglingToolId(null);
    }
  }, [addToast, reloadTools, skills, t]);

  const bulkToggleMode = useMemo(
    () => getNextBulkToggleMode(tools),
    [tools]
  );
  const bulkToggleTargets = useMemo(
    () => getBulkToggleTargets(tools, bulkToggleMode),
    [tools, bulkToggleMode]
  );

  const handleBulkToggleTools = useCallback(async () => {
    if (bulkToggleTargets.length === 0) {
      return;
    }

    const enabled = bulkToggleMode === "enable";
    const confirmed = await confirm(
      t(getBulkToggleConfirmKey(bulkToggleMode)).replace("{count}", String(bulkToggleTargets.length)),
      {
        title: t("tools.bulkConfirmTitle"),
        kind: "warning",
      }
    );
    if (!confirmed) {
      return;
    }

    const targetIds = new Set(bulkToggleTargets.map((tool) => tool.id));

    setBulkToggling(true);
    setError(null);

    try {
      // Optimistic update for immediate feedback.
      setTools((prev) =>
        prev.map((tool) =>
          targetIds.has(tool.id)
            ? { ...tool, config: { ...tool.config, enabled } }
            : tool
        )
      );

      const results = await Promise.allSettled(
        bulkToggleTargets.map((tool) =>
          invoke("set_tool_enabled", { toolId: tool.id, enabled })
        )
      );

      const failedCount = results.filter((result) => result.status === "rejected").length;
      const changedCount = bulkToggleTargets.length - failedCount;

      if (changedCount > 0) {
        const successMessage = enabled
          ? t("tools.bulkEnableSuccess")
          : t("tools.bulkDisableSuccess");
        addToast(successMessage.replace("{count}", String(changedCount)), "success");
      }

      if (failedCount > 0) {
        const failedMessage = t("tools.bulkTogglePartialFailed").replace("{count}", String(failedCount));
        addToast(failedMessage, "error");
        setError(failedMessage);
      }

      await reloadTools();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      addToast(message, "error");
      setError(message);
      await reloadTools();
    } finally {
      setBulkToggling(false);
    }
  }, [addToast, bulkToggleMode, bulkToggleTargets, reloadTools, t]);

  // 修改配置路径（默认定位到当前路径）
  const handleEditConfigPath = useCallback(async (toolId: string, currentPath?: string) => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: t("tools.selectConfigPath"),
      defaultPath: currentPath || undefined,
    });

    if (selected && typeof selected === "string") {
      try {
        await invoke("update_tool_paths", {
          toolId,
          configPath: selected,
        });
        await reloadTools();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    }
  }, [reloadTools, t]);

  // 修改技能路径（默认定位到当前路径）
  const handleEditSkillsPath = useCallback(async (toolId: string, currentPath?: string) => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: t("tools.selectSkillsPath"),
      defaultPath: currentPath || undefined,
    });

    if (selected && typeof selected === "string") {
      try {
        await invoke("update_tool_paths", {
          toolId,
          skillsPath: selected,
        });
        await reloadTools();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    }
  }, [reloadTools, t]);


  const startCreateCustomTool = useCallback(() => {
    setEditingToolId(null);
    setFormOpen(true);
  }, []);

  const startEditCustomTool = useCallback((tool: Tool) => {
    setEditingToolId(tool.id);
    setFormOpen(true);
  }, []);

  const handleDeleteCustomTool = useCallback(async (tool: Tool) => {
    const confirmed = await confirm(
      t("tools.customDeleteConfirm").replace("{name}", tool.name),
      { title: t("tools.customDelete") }
    );
    if (!confirmed) {
      return;
    }

    setError(null);
    try {
      await invoke("delete_custom_tool", { toolId: tool.id });
      await reloadTools();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [reloadTools, t]);

  useEffect(() => {
    loadTools();
  }, [loadTools]);

  // Apply saved order to tools
  const orderedTools = useMemo(() => {
    if (toolsOrder.length === 0) return tools;

    // Create a map for quick lookup
    const toolsMap = new Map(tools.map(tool => [tool.id, tool]));

    // Get tools in saved order
    const ordered = toolsOrder
      .map(id => toolsMap.get(id))
      .filter((tool): tool is Tool => tool !== undefined);

    // Add any new tools not in the saved order at the end
    const orderedIds = new Set(toolsOrder);
    const newTools = tools.filter(tool => !orderedIds.has(tool.id));

    return [...ordered, ...newTools];
  }, [tools, toolsOrder]);

  const builtinTools = useMemo(
    () => sortToolsByEnabled(orderedTools.filter((tool) => tool.source !== "custom" && tool.detected && !isHermesToolId(tool.id))),
    [orderedTools]
  );
  // Hermes profiles share one icon and one config dir; render them as a
  // single grouped card instead of N visually-identical cards. The group
  // card exposes per-profile enable/manage controls through its own dialog.
  const hermesGroupTools = useMemo(
    () => orderedTools.filter((tool) => tool.source !== "custom" && tool.detected && isHermesToolId(tool.id)),
    [orderedTools]
  );
  const customTools = useMemo(
    () => sortToolsByEnabled(orderedTools.filter((tool) => tool.source === "custom")),
    [orderedTools]
  );
  const bulkToggleLabel = bulkToggling
    ? t("tools.bulkUpdating")
    : bulkToggleMode === "enable"
      ? t("tools.bulkEnable")
      : t("tools.bulkDisable");

  const toolEditorTool = useMemo(
    () => tools.find((tool) => tool.id === toolEditorToolId) ?? null,
    [tools, toolEditorToolId],
  );

  const skillIds = useMemo(
    () => skills.map((skill) => skill.instance_id),
    [skills],
  );

  const toolSkillEnabledMap = useMemo(() => {
    if (!toolEditorTool) {
      return {};
    }
    const enabledMap: Record<string, boolean> = {};
    skills.forEach((skill) => {
      enabledMap[skill.instance_id] = Boolean(skill.enabled[toolEditorTool.id]);
    });
    return enabledMap;
  }, [skills, toolEditorTool]);

  const toolEditorOrderedSkillIds = useMemo(() => {
    if (!toolEditorTool) {
      return [];
    }

    if (toolEditorPreserveOrder) {
      return [...skillIds];
    }

    return orderSkillIdsForTool(skillIds, toolSkillEnabledMap);
  }, [skillIds, toolEditorTool, toolSkillEnabledMap, toolEditorPreserveOrder]);

  const toolEditorFilteredSkillIds = useMemo(() => {
    if (!toolEditorTool) {
      return [];
    }

    const normalizedQuery = toolEditorQuery.trim().toLowerCase();
    return toolEditorOrderedSkillIds.filter((skillId) => {
      if (toolEditorEnabledOnly && !toolSkillEnabledMap[skillId]) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const displayName = getSkillDisplayName(skillId, skills).toLowerCase();
      return displayName.includes(normalizedQuery) || skillId.toLowerCase().includes(normalizedQuery);
    });
  }, [
    skills,
    toolEditorEnabledOnly,
    toolEditorOrderedSkillIds,
    toolEditorQuery,
    toolEditorTool,
    toolSkillEnabledMap,
  ]);

  const toolEditorEnabledCount = useMemo(() => {
    if (!toolEditorTool) {
      return 0;
    }
    return toolEditorOrderedSkillIds.filter((skillId) => toolSkillEnabledMap[skillId]).length;
  }, [toolEditorOrderedSkillIds, toolEditorTool, toolSkillEnabledMap]);

  const toolEditorBulkToggleMode = useMemo(() => {
    if (!toolEditorTool) {
      return "enable";
    }
    return getToolBulkToggleMode(toolEditorFilteredSkillIds, toolSkillEnabledMap);
  }, [toolEditorFilteredSkillIds, toolEditorTool, toolSkillEnabledMap]);

  const toolEditorBulkToggleTargets = useMemo(() => {
    if (!toolEditorTool) {
      return [];
    }
    return getToolBulkToggleTargets(toolEditorFilteredSkillIds, toolSkillEnabledMap, toolEditorBulkToggleMode);
  }, [toolEditorFilteredSkillIds, toolEditorTool, toolEditorBulkToggleMode, toolSkillEnabledMap]);

  const toolEditorIsBulkToggling = toolEditorTool ? bulkTogglingToolId === toolEditorTool.id : false;
  const toolEditorHasPendingSingleToggle = toolEditorTool
    ? Boolean(togglingSkill?.startsWith(`${toolEditorTool.id}:`))
    : false;
  const toolEditorBulkToggleDisabled =
    toolEditorIsBulkToggling || toolEditorHasPendingSingleToggle || toolEditorBulkToggleTargets.length === 0;
  const toolEditorBulkToggleLabel = toolEditorIsBulkToggling
    ? t("tools.bulkUpdatingSkills")
    : toolEditorBulkToggleMode === "enable"
      ? t("tools.bulkEnableSkills")
      : t("tools.bulkDisableSkills");

  const toolEditorItems = useMemo(() => {
    if (!toolEditorTool) {
      return [];
    }

    const shouldDisable = !toolEditorTool.detected || !toolEditorTool.config.enabled;

    return toolEditorFilteredSkillIds.map((skillId) => {
      const isEnabled = toolSkillEnabledMap[skillId] ?? false;
      const toggleKey = `${toolEditorTool.id}:${skillId}`;
      const isToggling = togglingSkill === toggleKey;
      const isDisabled = toolEditorIsBulkToggling || isToggling || shouldDisable;
      const tooltip = !toolEditorTool.detected
        ? t("skills.toolNotDetected")
        : !toolEditorTool.config.enabled
          ? t("tools.skillsManageDisabled")
          : undefined;

      return {
        id: skillId,
        label: getSkillDisplayName(skillId, skills) + (skills.find((s) => s.id === skillId)?.is_default ? " · 默认" : ""),
        enabled: isEnabled,
        disabled: isDisabled,
        tooltip,
        dimmed: !toolEditorTool.detected,
      };
    });
  }, [
    skills,
    t,
    togglingSkill,
    toolEditorFilteredSkillIds,
    toolEditorIsBulkToggling,
    toolEditorTool,
    toolSkillEnabledMap,
  ]);

  const handleIconError = useCallback((toolId: string) => {
    setIconFallbackStage(prev => {
      const current = prev[toolId] ?? "asset";
      const nextStage = current === "asset" ? "file" : "none";
      return { ...prev, [toolId]: nextStage };
    });
  }, []);

  // Show skeleton while initial loading
  if (initialLoading) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        backgroundColor: 'var(--background)',
      }}>
        <PageHeader title={t("nav.agents")} />
        <main style={{ flex: 1, overflow: 'auto', padding: '24px 32px' }}>
          <PageLoader />
        </main>
      </div>
    );
  }

  const renderToolCard = (tool: Tool) => {
    const isCustom = tool.source === "custom";
    const iconStage = iconFallbackStage[tool.id] ?? "asset";
    const customIconSrc = tool.icon_path
      ? iconStage === "asset"
        ? convertFileSrc(tool.icon_path)
        : iconStage === "file"
          ? `file://${tool.icon_path}`
          : null
      : null;
    const iconUrl = customIconSrc || getToolIconUrl(tool.id);
    const manageSkillsDisabled = !tool.detected || !tool.config.enabled;
    const manageSkillsTitle = !tool.detected
      ? t("skills.toolNotDetected")
      : !tool.config.enabled
        ? t("tools.skillsManageDisabled")
        : t("tools.manageSkills");

    return (
      <div
        key={tool.id}
        draggable
        onDragStart={() => {
          draggedToolIdRef.current = tool.id;
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOverToolId(tool.id);
        }}
        onDragLeave={() => setDragOverToolId(null)}
        onDrop={(e) => {
          e.preventDefault();
          const draggedId = draggedToolIdRef.current;
          setDragOverToolId(null);
          if (!draggedId || draggedId === tool.id) {
            draggedToolIdRef.current = null;
            return;
          }
          setTools(prev => {
            const next = [...prev];
            const fromIdx = next.findIndex(t => t.id === draggedId);
            const toIdx = next.findIndex(t => t.id === tool.id);
            if (fromIdx === -1 || toIdx === -1) return prev;
            const [moved] = next.splice(fromIdx, 1);
            next.splice(toIdx, 0, moved);
            // Save the new order to backend
            const newOrder = next.map(t => t.id);
            saveToolsOrder(newOrder);
            return next;
          });
          draggedToolIdRef.current = null;
        }}
        style={{
          display: 'flex',
          flexDirection: 'column',
          padding: '18px 20px',
          backgroundColor: dragOverToolId === tool.id ? 'color-mix(in srgb, var(--primary) 8%, var(--secondary))' : 'var(--secondary)',
          borderRadius: '14px',
          border: dragOverToolId === tool.id ? '2px dashed var(--primary)' : '1px solid var(--border)',
          transition: 'border-color 0.2s, box-shadow 0.2s, transform 0.2s, background-color 0.2s',
          cursor: 'grab',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.12)';
          e.currentTarget.style.transform = 'scale(1.02)';
        }}
        onMouseLeave={(e) => {
          if (dragOverToolId === tool.id) return;
          e.currentTarget.style.boxShadow = 'none';
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        {/* Top: Icon + Title + Status + Toggle */}
        <div style={{ display: 'flex', gap: '14px', marginBottom: '16px', alignItems: 'flex-start' }}>
          {/* Icon */}
          {iconUrl ? (
            <img
              src={iconUrl}
              alt={tool.name}
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                flexShrink: 0,
                objectFit: 'cover',
              }}
              onError={() => {
                if (tool.icon_path) {
                  handleIconError(tool.id);
                }
              }}
            />
          ) : (
            <GenericToolIcon />
          )}

          {/* Title + Status */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '4px',
              flexWrap: 'wrap',
            }}>
              <span style={{
                fontSize: '15px',
                fontWeight: 600,
                color: 'var(--foreground)',
                lineHeight: 1.3,
              }}>
                {tool.name}
              </span>
              <span style={{
                fontSize: '11px',
                fontWeight: 500,
                padding: '2px 8px',
                borderRadius: '6px',
                backgroundColor: tool.detected ? 'var(--color-success-bg)' : 'var(--secondary)',
                color: tool.detected ? 'var(--color-success)' : 'var(--muted-foreground)',
                border: tool.detected ? '1px solid var(--color-success-border)' : '1px solid var(--border)',
              }}>
                {tool.detected ? t("tools.detectedStatus") : t("tools.notDetected")}
              </span>
              {tool.cli_available && (
                <span style={{
                  fontSize: '11px',
                  fontWeight: 500,
                  padding: '2px 8px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--background)',
                  color: 'var(--muted-foreground)',
                  border: '1px solid var(--border)',
                }}>
                  CLI
                </span>
              )}
              {isCustom && (
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      startEditCustomTool(tool);
                    }}
                    title={t("tools.customEdit")}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '24px',
                      height: '24px',
                      borderRadius: '6px',
                      border: '1px solid var(--border)',
                      background: 'var(--background)',
                      color: 'var(--muted-foreground)',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--muted)';
                      e.currentTarget.style.color = 'var(--foreground)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--background)';
                      e.currentTarget.style.color = 'var(--muted-foreground)';
                    }}
                  >
                    <Pencil style={{ width: '12px', height: '12px' }} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteCustomTool(tool);
                    }}
                    title={t("tools.customDelete")}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '24px',
                      height: '24px',
                      borderRadius: '6px',
                      border: '1px solid var(--border)',
                      background: 'var(--background)',
                      color: 'var(--color-danger)',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--muted)';
                      e.currentTarget.style.color = 'var(--color-danger)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--background)';
                    }}
                  >
                    <Trash2 style={{ width: '12px', height: '12px' }} />
                  </button>
                </div>
              )}
            </div>
            <p style={{
              fontSize: '13px',
              color: 'var(--muted-foreground)',
              margin: 0,
              lineHeight: 1.5,
            }}>
              ID: {tool.id}
            </p>
          </div>

          {/* Skill Dialog + Toggle */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ marginTop: '2px', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (!manageSkillsDisabled) {
                  openToolSkillEditor(tool.id);
                }
              }}
              title={manageSkillsTitle}
              disabled={manageSkillsDisabled}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '28px',
                height: '28px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--background)',
                color: 'var(--muted-foreground)',
                cursor: manageSkillsDisabled ? 'not-allowed' : 'pointer',
                opacity: manageSkillsDisabled ? 0.5 : 1,
                transition: 'background-color 0.15s, color 0.15s, border-color 0.15s',
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                if (manageSkillsDisabled) {
                  return;
                }
                e.currentTarget.style.backgroundColor = 'var(--muted)';
                e.currentTarget.style.color = 'var(--foreground)';
                e.currentTarget.style.borderColor = 'var(--ring)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--background)';
                e.currentTarget.style.color = 'var(--muted-foreground)';
                e.currentTarget.style.borderColor = 'var(--border)';
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 3L13.5 8.5L19 10L13.5 11.5L12 17L10.5 11.5L5 10L10.5 8.5L12 3Z"/>
              </svg>
            </button>
            <Toggle
              checked={tool.config.enabled}
              disabled={!tool.detected && !tool.config.enabled}
              onChange={(enabled) => toggleToolEnabled(tool, enabled)}
            />
          </div>
        </div>

        {/* Bottom: Config Info */}
        <div style={{
          paddingTop: '14px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              fontSize: '12px',
              color: 'var(--muted-foreground)',
              flexShrink: 0,
              width: '80px',
            }}>
              {t("tools.configPath")}
            </span>
            <code style={{
              flex: 1,
              fontSize: '11px',
              color: 'var(--foreground)',
              backgroundColor: 'var(--background)',
              padding: '2px 6px',
              borderRadius: '4px',
              wordBreak: 'break-all',
            }}>
              {tool.config.config_path || t("tools.notSet")}
            </code>
            {/* 打开路径选择器修改配置路径，默认定位到当前路径，仅启用的工具可点击 */}
            {!isCustom && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (tool.config.enabled) {
                    handleEditConfigPath(tool.id, tool.config.config_path);
                  }
                }}
                title={tool.config.enabled ? t("tools.editPath") : t("skills.toolNotDetected")}
                disabled={!tool.config.enabled}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '24px',
                  height: '24px',
                  borderRadius: '6px',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--muted-foreground)',
                  cursor: tool.config.enabled ? 'pointer' : 'not-allowed',
                  flexShrink: 0,
                  opacity: tool.config.enabled ? 1 : 0.4,
                }}
                onMouseEnter={(e) => {
                  if (tool.config.enabled) {
                    e.currentTarget.style.backgroundColor = 'var(--muted)';
                    e.currentTarget.style.color = 'var(--foreground)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--muted-foreground)';
                }}
              >
                <FolderOpen style={{ width: '14px', height: '14px' }} />
              </button>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              fontSize: '12px',
              color: 'var(--muted-foreground)',
              flexShrink: 0,
              width: '80px',
            }}>
              {t("tools.skillsPath")}
            </span>
            <code style={{
              flex: 1,
              fontSize: '11px',
              color: 'var(--foreground)',
              backgroundColor: 'var(--background)',
              padding: '2px 6px',
              borderRadius: '4px',
              wordBreak: 'break-all',
            }}>
              {tool.config.skills_path || t("tools.notSet")}
            </code>
            {/* 打开路径选择器修改技能路径，默认定位到当前路径，仅启用的工具可点击 */}
            {!isCustom && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (tool.config.enabled) {
                    handleEditSkillsPath(tool.id, tool.config.skills_path);
                  }
                }}
                title={tool.config.enabled ? t("tools.editPath") : t("skills.toolNotDetected")}
                disabled={!tool.config.enabled}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '24px',
                  height: '24px',
                  borderRadius: '6px',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--muted-foreground)',
                  cursor: tool.config.enabled ? 'pointer' : 'not-allowed',
                  flexShrink: 0,
                  opacity: tool.config.enabled ? 1 : 0.4,
                }}
                onMouseEnter={(e) => {
                  if (tool.config.enabled) {
                    e.currentTarget.style.backgroundColor = 'var(--muted)';
                    e.currentTarget.style.color = 'var(--foreground)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--muted-foreground)';
                }}
              >
                <FolderOpen style={{ width: '14px', height: '14px' }} />
              </button>
            )}
          </div>
        </div>

        {isCustom && tool.icon_path && iconFallbackStage[tool.id] === "none" && (
          <p style={{
            marginTop: '10px',
            fontSize: '11px',
            color: 'var(--muted-foreground)',
          }}>
            {t("tools.customIconLoadFailed")}
          </p>
        )}
      </div>
    );
  };

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
      backgroundColor: 'var(--background)',
    }}>
      <PageHeader
        title={t("nav.agents")}
        actions={
          <>
            <RefreshButton onClick={handleRefresh} loading={refreshing} />
            <button
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 12px',
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--foreground)',
                backgroundColor: 'var(--secondary)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                cursor: bulkToggling || refreshing || bulkToggleTargets.length === 0 ? 'not-allowed' : 'pointer',
                opacity: bulkToggling || refreshing || bulkToggleTargets.length === 0 ? 0.6 : 1,
                transition: 'background-color 0.15s, border-color 0.15s',
              }}
              onMouseEnter={(e) => {
                if (bulkToggling || refreshing || bulkToggleTargets.length === 0) {
                  return;
                }
                e.currentTarget.style.backgroundColor = 'var(--muted)';
                e.currentTarget.style.borderColor = 'var(--ring)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--secondary)';
                e.currentTarget.style.borderColor = 'var(--border)';
              }}
              onClick={handleBulkToggleTools}
              disabled={bulkToggling || refreshing || bulkToggleTargets.length === 0}
              title={bulkToggleTargets.length === 0 ? t("tools.bulkNoTarget") : undefined}
            >
              <Power style={{ width: '14px', height: '14px' }} />
              {bulkToggleLabel}
            </button>
            <button
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--primary-foreground)',
                backgroundColor: 'var(--foreground)',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
              onClick={startCreateCustomTool}
            >
              <Plus style={{ width: '14px', height: '14px' }} />
              {t("tools.customAdd")}
            </button>
          </>
        }
      />

      {/* Content */}
      <main style={{
        flex: 1,
        overflow: 'auto',
        padding: '24px 32px',
      }}>
        <div style={{ maxWidth: '1200px' }}>
          {/* Error */}
          {error && (
            <div className="mb-6">
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </div>
          )}

          {/* Section: Detected Tools */}
          <section>
            <h2 style={{
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--muted-foreground)',
              margin: '0 0 16px 0',
            }}>
              {t("tools.detected")}
            </h2>

            {builtinTools.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '48px 24px',
                color: 'var(--muted-foreground)',
                backgroundColor: 'var(--secondary)',
                borderRadius: '12px',
                border: '1px solid var(--border)',
              }}>
                <p style={{ margin: '0 0 8px 0' }}>{t("tools.noTools")}</p>
                <p style={{ margin: 0, fontSize: '13px' }}>
                  {t("tools.noToolsDesc")}
                </p>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
                gap: '16px',
              }}>
                {builtinTools.map(renderToolCard)}
                {hermesGroupTools.length > 0 && (
                  <HermesGroupCard
                    tools={hermesGroupTools}
                    onManageProfile={openToolSkillEditor}
                    onToggleProfile={(profileId, enabled) => {
                      const profile = tools.find((t) => t.id === profileId);
                      if (profile) toggleToolEnabled(profile, enabled);
                    }}
                  />
                )}
              </div>
            )}
          </section>

          {/* Section: Custom Tools */}
          <section style={{ marginTop: '32px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px',
            }}>
              <h2 style={{
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--muted-foreground)',
                margin: 0,
              }}>
                {t("tools.customTitle")}
              </h2>
              <div />
            </div>

            {customTools.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '40px 24px',
                color: 'var(--muted-foreground)',
                backgroundColor: 'var(--secondary)',
                borderRadius: '12px',
                border: '1px dashed var(--border)',
              }}>
                <button
                  onClick={startCreateCustomTool}
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    border: '1px dashed var(--border)',
                    background: 'var(--background)',
                    color: 'var(--muted-foreground)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    marginBottom: '10px',
                  }}
                >
                  <Plus style={{ width: '18px', height: '18px' }} />
                </button>
                <p style={{ margin: '0 0 6px 0' }}>{t("tools.customEmpty")}</p>
                <p style={{ margin: 0, fontSize: '12px' }}>{t("tools.customEmptyDesc")}</p>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
                gap: '16px',
              }}>
                {customTools.map(renderToolCard)}
              </div>
            )}
          </section>
        </div>
      </main>

      {toolEditorTool && (
        <RelationToggleDialog
          title={t("tools.configureSkillsTitle")}
          description={t("tools.configureSkillsDesc")
            .replace("{tool}", toolEditorTool.name)
            .replace("{enabled}", String(toolEditorEnabledCount))
            .replace("{total}", String(toolEditorOrderedSkillIds.length))}
          query={toolEditorQuery}
          enabledOnly={toolEditorEnabledOnly}
          searchPlaceholder={t("tools.searchSkillsPlaceholder")}
          enabledOnlyLabel={t("tools.enabledOnlySkills")}
          bulkToggleLabel={toolEditorBulkToggleLabel}
          bulkToggleDisabled={toolEditorBulkToggleDisabled}
          bulkToggleTitle={toolEditorBulkToggleTargets.length === 0 ? t("tools.bulkNoSkillTarget") : undefined}
          items={toolEditorItems}
          emptyLabel={t("tools.noSkillsInFilter")}
          doneLabel={t("common.done")}
          onQueryChange={setToolEditorQuery}
          onEnabledOnlyChange={setToolEditorEnabledOnly}
          onToggle={(skillId, enabled) => { setToolEditorPreserveOrder(true); handleToggleSkillForTool(toolEditorTool, skillId, enabled); }}
          onBulkToggle={() => { setToolEditorPreserveOrder(true); handleBulkToggleToolSkills(toolEditorTool, toolEditorFilteredSkillIds); }}
          onClose={closeToolSkillEditor}
        />
      )}

      <CustomToolFormDialog
        open={formOpen}
        editingToolId={editingToolId}
        existingTools={tools}
        onClose={() => setFormOpen(false)}
        onSaved={reloadTools}
        onError={setError}
      />
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
