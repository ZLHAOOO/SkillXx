import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { useLocation } from "react-router-dom";
import { useTranslation } from "../i18n";
import type { AppConfig } from "@/types";

export interface SkillTranslationOutput {
  name: string;
  description: string;
  content_md: string | null;
  cached: boolean;
}

export interface MarketplaceTranslationInput {
  id: string;
  name: string;
  description: string | null;
  content_md?: string | null;
}

export interface BatchTranslationProgress {
  current: number;
  total: number;
  instance_id: string;
  skill_name: string;
}

export interface BatchTranslationFailure {
  instance_id: string;
  reason: string;
}

export interface BatchTranslationResult {
  succeeded: string[];
  failed: BatchTranslationFailure[];
  results: Array<{
    instance_id: string;
    translation: SkillTranslationOutput | null;
  }>;
}

export type SkillFileTranslationStatus = "started" | "completed" | "failed";

export interface SkillFileTranslationProgress {
  current: number;
  total: number;
  instance_id: string;
  skill_name: string;
  path: string;
  status: SkillFileTranslationStatus;
  target_lang: string;
}

export interface SkillFileTranslationEntry {
  path: string;
  translation: SkillTranslationOutput;
}

export interface SkillFileTranslationFailure {
  path: string;
  reason: string;
}

export interface SkillFilesTranslationResult {
  files: SkillFileTranslationEntry[];
  failed: SkillFileTranslationFailure[];
}

interface TranslationStore {
  results: Map<string, SkillTranslationOutput>;
  fileResults: Map<string, SkillTranslationOutput>;
  inFlight: Map<string, Promise<SkillTranslationOutput>>;
  fileInFlight: Map<string, Promise<SkillFilesTranslationResult>>;
}

interface SkillTranslationContextValue {
  isConfigured: boolean;
  refreshConfigured: () => Promise<boolean>;
  translateSkill: (instanceId: string, targetLang: string, force?: boolean) => Promise<SkillTranslationOutput>;
  translateMarketplace: (
    input: MarketplaceTranslationInput,
    targetLang: string,
    force?: boolean
  ) => Promise<SkillTranslationOutput>;
  translateBatch: (
    instanceIds: string[],
    targetLang: string,
    onProgress?: (p: BatchTranslationProgress) => void
  ) => Promise<BatchTranslationResult>;
  translateSkillFiles: (
    instanceId: string,
    targetLang: string,
    force?: boolean,
    onProgress?: (p: SkillFileTranslationProgress) => void
  ) => Promise<SkillFilesTranslationResult>;
  getTranslation: (key: string) => SkillTranslationOutput | null;
  getFileTranslation: (instanceId: string, targetLang: string, path: string) => SkillTranslationOutput | null;
  preloadCachedSkills: (instanceIds: string[], targetLang: string) => Promise<void>;
  preloadCachedMarketplace: (
    inputs: MarketplaceTranslationInput[],
    targetLang: string
  ) => Promise<void>;
  clearAll: () => void;
  clearCache: () => Promise<void>;
}

const SkillTranslationContext = createContext<SkillTranslationContextValue | null>(null);

function normalizeTranslationPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.\/+/, "").replace(/^\/+/, "");
}

async function syncTranslationToMetadata(
  result: SkillTranslationOutput,
  instanceId: string,
  targetLang: string
): Promise<void> {
  const config = await invoke<AppConfig>("get_config");
  const metadataKey = instanceId;
  const nextSkillMetadata = { ...config.skill_metadata };
  const existing = nextSkillMetadata[metadataKey] || {};

  if (targetLang === "zh") {
    existing.translated_name_zh = result.name;
    existing.translated_desc_zh = result.description;
    existing.translated_name_en = null;
    existing.translated_desc_en = null;
  } else {
    existing.translated_name_en = result.name;
    existing.translated_desc_en = result.description;
    existing.translated_name_zh = null;
    existing.translated_desc_zh = null;
  }

  nextSkillMetadata[metadataKey] = existing;
  await invoke("save_config", { config: { ...config, skill_metadata: nextSkillMetadata } });
}

export function SkillTranslationProvider({ children }: { children: ReactNode }) {
  const storeRef = useRef<TranslationStore>({
    results: new Map(),
    fileResults: new Map(),
    inFlight: new Map(),
    fileInFlight: new Map(),
  });
  const [, forceRender] = useState(0);
  const bump = useCallback(() => forceRender((n) => n + 1), []);

  const [isConfigured, setIsConfigured] = useState(false);

  const refreshConfigured = useCallback(async (): Promise<boolean> => {
    try {
      const provider = await invoke<unknown>("get_translation_provider");
      const configured = provider != null;
      setIsConfigured(configured);
      return configured;
    } catch {
      setIsConfigured(false);
      return false;
    }
  }, []);

  useEffect(() => {
    refreshConfigured();
  }, [refreshConfigured]);

  const cacheKey = (instanceId: string, targetLang: string) =>
    `${targetLang}::${instanceId}`;

  const fileCacheKey = (instanceId: string, targetLang: string, path: string) =>
    `${targetLang}::${instanceId}::${normalizeTranslationPath(path)}`;

  const translateSkill = useCallback(
    async (instanceId: string, targetLang: string, force: boolean = false): Promise<SkillTranslationOutput> => {
      const key = cacheKey(instanceId, targetLang);
      const inflightKey = force ? `${key}::force` : key;
      const existing = storeRef.current.inFlight.get(inflightKey);
      if (existing) return existing;

      const promise = (async () => {
        const result = await invoke<SkillTranslationOutput>("translate_skill", {
          instanceId,
          targetLang,
          force,
        });
        storeRef.current.results.set(key, result);
        bump();
        try {
          await syncTranslationToMetadata(result, instanceId, targetLang);
        } catch {
          // metadata sync failure shouldn't block the translation result
        }
        return result;
      })().finally(() => {
        storeRef.current.inFlight.delete(inflightKey);
      });

      storeRef.current.inFlight.set(inflightKey, promise);
      return promise;
    },
    [bump]
  );

  const translateMarketplace = useCallback(
    async (
      input: MarketplaceTranslationInput,
      targetLang: string,
      force: boolean = false
    ): Promise<SkillTranslationOutput> => {
      const key = cacheKey(input.id, targetLang);
      const inflightKey = force ? `${key}::force` : key;
      const existing = storeRef.current.inFlight.get(inflightKey);
      if (existing) return existing;

      const promise = (async () => {
        const result = await invoke<SkillTranslationOutput>("translate_marketplace_skill", {
          input,
          targetLang,
          force,
        });
        storeRef.current.results.set(key, result);
        bump();
        return result;
      })().finally(() => {
        storeRef.current.inFlight.delete(inflightKey);
      });

      storeRef.current.inFlight.set(inflightKey, promise);
      return promise;
    },
    [bump]
  );

  const translateBatch = useCallback(
    async (
      instanceIds: string[],
      targetLang: string,
      onProgress?: (p: BatchTranslationProgress) => void
    ): Promise<BatchTranslationResult> => {
      const succeeded: string[] = [];
      const failed: BatchTranslationFailure[] = [];
      const results: Array<{
        instance_id: string;
        translation: SkillTranslationOutput | null;
      }> = [];

      for (let i = 0; i < instanceIds.length; i++) {
        const instanceId = instanceIds[i];
        if (onProgress) {
          onProgress({
            current: i + 1,
            total: instanceIds.length,
            instance_id: instanceId,
            skill_name: instanceId,
          });
        }

        try {
          const translation = await translateSkill(instanceId, targetLang, false);
          succeeded.push(instanceId);
          results.push({ instance_id: instanceId, translation });
        } catch (err) {
          const reason = err instanceof Error ? err.message : String(err);
          failed.push({ instance_id: instanceId, reason });
          results.push({ instance_id: instanceId, translation: null });
        }

        // 每次翻译间隔 300ms，避免对 LLM API 造成并发压力
        if (i < instanceIds.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      }

      return { succeeded, failed, results };
    },
    [translateSkill]
  );

  const translateSkillFiles = useCallback(
    async (
      instanceId: string,
      targetLang: string,
      force: boolean = false,
      onProgress?: (p: SkillFileTranslationProgress) => void
    ): Promise<SkillFilesTranslationResult> => {
      const key = cacheKey(instanceId, targetLang);
      const inflightKey = force ? `${key}::files::force` : `${key}::files`;
      const existing = storeRef.current.fileInFlight.get(inflightKey);
      if (existing) return existing;

      const promise = (async () => {
        let unlisten: UnlistenFn | null = null;
        if (onProgress) {
          unlisten = await listen<SkillFileTranslationProgress>(
            "llm:skill-files-progress",
            (event) => {
              const payload = event.payload;
              if (payload.instance_id === instanceId && payload.target_lang === targetLang) {
                onProgress(payload);
              }
            }
          );
        }

        try {
          const result = await invoke<SkillFilesTranslationResult>("translate_skill_files", {
            instanceId,
            targetLang,
            force,
          });
          for (const file of result.files) {
            const normalizedPath = normalizeTranslationPath(file.path);
            storeRef.current.fileResults.set(
              fileCacheKey(instanceId, targetLang, normalizedPath),
              file.translation,
            );
            if (normalizedPath.toLowerCase().endsWith("skill.md")) {
              storeRef.current.results.set(key, file.translation);
            }
          }
          bump();
          return result;
        } finally {
          if (unlisten) unlisten();
        }
      })().finally(() => {
        storeRef.current.fileInFlight.delete(inflightKey);
      });

      storeRef.current.fileInFlight.set(inflightKey, promise);
      return promise;
    },
    [bump]
  );

  const getTranslation = useCallback((key: string) => {
    return storeRef.current.results.get(key) ?? null;
  }, []);

  const getFileTranslation = useCallback((instanceId: string, targetLang: string, path: string) => {
    return storeRef.current.fileResults.get(fileCacheKey(instanceId, targetLang, path)) ?? null;
  }, []);

  const clearAll = useCallback(() => {
    storeRef.current.results.clear();
    storeRef.current.fileResults.clear();
    storeRef.current.inFlight.clear();
    storeRef.current.fileInFlight.clear();
    bump();
  }, [bump]);

  const clearCache = useCallback(async () => {
    await invoke("clear_translation_cache");
    clearAll();
  }, [clearAll]);

  const preloadCachedSkills = useCallback(
    async (instanceIds: string[], targetLang: string): Promise<void> => {
      if (instanceIds.length === 0) return;
      try {
        const entries = await invoke<Array<{ key: string; translation: SkillTranslationOutput | null }>>(
          "get_cached_skill_translations",
          { instanceIds, targetLang },
        );
        let changed = false;
        for (const entry of entries) {
          if (!entry.translation) continue;
          const key = cacheKey(entry.key, targetLang);
          if (!storeRef.current.results.has(key)) {
            storeRef.current.results.set(key, entry.translation);
            changed = true;
          }
        }
        if (changed) bump();
      } catch {
        // ignore preload failure
      }
    },
    [bump],
  );

  const preloadCachedMarketplace = useCallback(
    async (inputs: MarketplaceTranslationInput[], targetLang: string): Promise<void> => {
      if (inputs.length === 0) return;
      try {
        const entries = await invoke<Array<{ key: string; translation: SkillTranslationOutput | null }>>(
          "get_cached_marketplace_translations",
          { inputs, targetLang },
        );
        let changed = false;
        for (const entry of entries) {
          if (!entry.translation) continue;
          const key = cacheKey(entry.key, targetLang);
          if (!storeRef.current.results.has(key)) {
            storeRef.current.results.set(key, entry.translation);
            changed = true;
          }
        }
        if (changed) bump();
      } catch {
        // ignore preload failure
      }
    },
    [bump],
  );

  // 自动缓存预热：根据路由变化预热对应页面的翻译
  const location = useLocation();
  const { language } = useTranslation();

  useEffect(() => {
    const preloadForRoute = async () => {
      if (!isConfigured) return;

      try {
        if (location.pathname === '/skills') {
          // Skills 页面：预热所有已安装 skill
          const skills = await invoke<Array<{ instance_id: string }>>('list_skills');
          const instanceIds = skills.map(s => s.instance_id);
          await preloadCachedSkills(instanceIds, language);
        } else if (location.pathname === '/marketplace') {
          // Marketplace 页面：预热前 50 个
          const items = await invoke<Array<{ id: string; name: string; description: string }>>(
            'get_marketplace_skills'
          );
          const top50 = items.slice(0, 50).map(s => ({
            id: s.id,
            name: s.name,
            description: s.description,
          }));
          await preloadCachedMarketplace(top50, language);
        }
      } catch (err) {
        // 预热失败静默处理，不影响用户
        console.debug('Cache preload failed:', err);
      }
    };

    preloadForRoute();
  }, [location.pathname, language, isConfigured, preloadCachedSkills, preloadCachedMarketplace]);

  const value: SkillTranslationContextValue = {
    isConfigured,
    refreshConfigured,
    translateSkill,
    translateMarketplace,
    translateBatch,
    translateSkillFiles,
    getTranslation,
    getFileTranslation,
    preloadCachedSkills,
    preloadCachedMarketplace,
    clearAll,
    clearCache,
  };

  return (
    <SkillTranslationContext.Provider value={value}>
      {children}
    </SkillTranslationContext.Provider>
  );
}

export function useSkillTranslation() {
  const ctx = useContext(SkillTranslationContext);
  if (!ctx) {
    throw new Error("useSkillTranslation must be used within SkillTranslationProvider");
  }
  return ctx;
}

export function makeTranslationKey(instanceId: string, targetLang: string): string {
  return `${targetLang}::${instanceId}`;
}
