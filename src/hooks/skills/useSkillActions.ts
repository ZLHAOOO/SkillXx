import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { type TranslationPath } from "@/i18n";
import { type Skill, type Tool, type AppConfig } from "@/types";

interface UseSkillActionsProps {
  skills: Skill[];
  tools: Tool[];
  config: AppConfig | null;
  addToast: (message: string, type: "success" | "error") => void;
  refreshData: () => Promise<void>;
  t: (key: TranslationPath) => string;
}

interface UseSkillActionsReturn {
  // Loading states
  togglingSkill: string | null;
  deletingSkill: string | null;
  creating: boolean;
  
  // Actions
  handleCreateSkill: (name: string, description: string) => Promise<void>;
  handleDelete: (skill: Skill) => Promise<void>;
  handleToggle: (skillId: string, toolId: string, enabled: boolean) => Promise<void>;
  handleBulkToggle: (skill: Skill, toolIds: string[]) => Promise<void>;
}

export function useSkillActions({
  skills,
  config,
  addToast,
  refreshData,
  t,
}: UseSkillActionsProps): UseSkillActionsReturn {
  const [togglingSkill, setTogglingSkill] = useState<string | null>(null);
  const [deletingSkill, setDeletingSkill] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const handleCreateSkill = useCallback(async (name: string, description: string) => {
    setCreating(true);
    try {
      const newSkill = await invoke<Skill>("create_skill", {
        name,
        description: description || null,
      });
      addToast(t("skills.createSuccess").replace("{name}", name), "success");
      // Navigation is handled by the component
    } catch (err) {
      addToast(err instanceof Error ? err.message : String(err), "error");
    } finally {
      setCreating(false);
    }
  }, [addToast, t]);

  const handleDelete = useCallback(async (skill: Skill) => {
    setDeletingSkill(skill.instance_id);
    try {
      await invoke("delete_skill", { skillId: skill.id });
      addToast(t("skills.deleteSuccess").replace("{name}", skill.name), "success");
      await refreshData();
    } catch (err) {
      addToast(err instanceof Error ? err.message : String(err), "error");
    } finally {
      setDeletingSkill(null);
    }
  }, [addToast, refreshData, t]);

  const handleToggle = useCallback(async (skillId: string, toolId: string, enabled: boolean) => {
    setTogglingSkill(skillId);
    try {
      if (enabled) {
        await invoke("enable_skill", { skillId, toolId });
      } else {
        await invoke("disable_skill", { skillId, toolId });
      }
      await refreshData();
    } catch (err) {
      addToast(err instanceof Error ? err.message : String(err), "error");
    } finally {
      setTogglingSkill(null);
    }
  }, [addToast, refreshData]);

  const handleBulkToggle = useCallback(async (skill: Skill, toolIds: string[]) => {
    // Implementation for bulk toggle
    // This would iterate through toolIds and call enable/disable for each
    try {
      for (const toolId of toolIds) {
        await invoke("enable_skill", { skillId: skill.id, toolId });
      }
      await refreshData();
    } catch (err) {
      addToast(err instanceof Error ? err.message : String(err), "error");
    }
  }, [addToast, refreshData]);

  return {
    togglingSkill,
    deletingSkill,
    creating,
    handleCreateSkill,
    handleDelete,
    handleToggle,
    handleBulkToggle,
  };
}
