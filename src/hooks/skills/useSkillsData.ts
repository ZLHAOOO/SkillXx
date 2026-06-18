import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { type AppConfig, type Skill, type InstalledSkillPackage, type Tool } from "@/types";
import { migrateSkillMetadataToInstanceIds } from "@/pages/skills/skillTags";

interface UseSkillsDataReturn {
  // Data
  skills: Skill[];
  skillPackages: InstalledSkillPackage[];
  tools: Tool[];
  config: AppConfig | null;
  
  // Loading states
  initialLoading: boolean;
  refreshing: boolean;
  
  // Actions
  loadData: () => Promise<void>;
  refreshData: () => Promise<void>;
  reloadData: () => Promise<void>;
  
  // Setters (for external updates)
  setSkills: React.Dispatch<React.SetStateAction<Skill[]>>;
  setSkillPackages: React.Dispatch<React.SetStateAction<InstalledSkillPackage[]>>;
  setTools: React.Dispatch<React.SetStateAction<Tool[]>>;
  setConfig: React.Dispatch<React.SetStateAction<AppConfig | null>>;
}

export function useSkillsData(): UseSkillsDataReturn {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [skillPackages, setSkillPackages] = useState<InstalledSkillPackage[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
        setConfig(nextConfig);
      }
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setInitialLoading(false);
    }
  }, []);

  const refreshData = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const reloadData = useCallback(async () => {
    await loadData();
  }, [loadData]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  return {
    skills,
    skillPackages,
    tools,
    config,
    initialLoading,
    refreshing,
    loadData,
    refreshData,
    reloadData,
    setSkills,
    setSkillPackages,
    setTools,
    setConfig,
  };
}
