import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { ExternalLink, Link2, Plus, Loader2 } from "lucide-react";
import { RefreshButton } from "@/components/ui/refresh-button";
import { PageHeader } from "@/components/ui/page-header";
import { ToastContainer, useToast } from "@/components/ui/toast";
import { InstallCountBadge } from "@/components/marketplace/InstallCountBadge";
import {
  InstallResult,
  MarketplaceSkill,
  MarketplaceSkillsResponse,
  MarketplaceSyncResult,
} from "@/types";
import { useTranslation } from "@/i18n";
import { useSkillTranslation, makeTranslationKey } from "@/hooks/useSkillTranslation";
import { TranslateIconButton } from "@/components/translation/TranslateIconButton";
import { SkillDetailModal } from "@/components/marketplace/SkillDetailModal";
import { formatInstallCountLabel } from "@/pages/marketplace/formatInstallCount";
import { buildMarketplaceMetaItems } from "@/pages/marketplace/buildMarketplaceMetaItems";
import { sortMarketplaceSkillsByInstallStatus } from "@/pages/marketplace/sortMarketplaceSkillsByInstallStatus";
import { getMarketplaceMetaChipStyle } from "@/components/marketplace/marketplaceMetaChipStyle";
import { MODAL_LAYER_Z_INDEX, MODAL_OVERLAY_COLOR } from "@/constants/modal";
import { getSkillColor } from "@/lib/getSkillColor";
import { formatTranslationError } from "@/lib/formatTranslationError";
import { SearchBar } from "@/components/marketplace/SearchBar";
import { PlatformSkillCard } from "@/components/marketplace/PlatformSkillCard";
import type { AppConfig, PlatformSkill, PlatformInstallResult } from "@/types";

const DESCRIPTION_BATCH_SIZE = 12;
const DIRECT_GITHUB_INSTALL_ID = "__github_direct_install__";
const marketplaceDescriptionCache = new Map<string, string | null>();

interface MarketplaceDescriptionRequest {
  id: string;
  repo_url: string;
  skill_path: string;
}

function primeDescriptionCache(skills: MarketplaceSkill[]) {
  skills.forEach((skill) => {
    const description = skill.description?.trim();
    if (description) {
      marketplaceDescriptionCache.set(skill.id, description);
    }
  });
}

function withCachedDescription(skill: MarketplaceSkill): MarketplaceSkill {
  const cached = marketplaceDescriptionCache.get(skill.id);
  if (!cached || cached === skill.description) {
    return skill;
  }
  return { ...skill, description: cached };
}

export function Marketplace() {
  const { t, language } = useTranslation();
  const translation = useSkillTranslation();
  const [translatingMarketIds, setTranslatingMarketIds] = useState<Set<string>>(new Set());
  const [marketViewMode, setMarketViewMode] = useState<Set<string>>(new Set());
  const { toasts, addToast, removeToast } = useToast();
  const [skills, setSkills] = useState<MarketplaceSkill[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [githubInstallDialogOpen, setGithubInstallDialogOpen] = useState(false);
  const [searchQuery, _setSearchQuery] = useState("");
  const [githubInstallUrl, setGithubInstallUrl] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedSkill, setSelectedSkill] = useState<MarketplaceSkill | null>(null);
  const [installingSkill, setInstallingSkill] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingAll, setUpdatingAll] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searching, setSearching] = useState(false);
  const [descriptionHydrationTick, setDescriptionHydrationTick] = useState(0);

  // Platform search state
  const [platformSearchResults, setPlatformSearchResults] = useState<PlatformSkill[]>([]);
  const [platformSearching, setPlatformSearching] = useState(false);
  const [installingPlatformSkill, setInstallingPlatformSkill] = useState<string | null>(null);
  const [enabledPlatforms, setEnabledPlatforms] = useState<string[]>([]);
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const listRequestSeqRef = useRef(0);
  const remoteLoadSeqRef = useRef(0);
  const descriptionInFlightRef = useRef<Set<string>>(new Set());
  const descriptionFetchedRef = useRef<Set<string>>(new Set());
  const descriptionRequestSeqRef = useRef(0);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const initialRef = useRef(true);
  const normalizedRemoteQuery = useMemo(
    () => deferredSearchQuery.trim(),
    [deferredSearchQuery],
  );

  const showMarketplaceError = useCallback((err: unknown, fallbackMessage: string) => {
    const rawMessage = err instanceof Error ? err.message : String(err);
    const rateLimited =
      /(^|[^0-9])429([^0-9]|$)/.test(rawMessage)
      || /too many requests/i.test(rawMessage)
      || /rate limit/i.test(rawMessage)
      || /请求过于频繁/.test(rawMessage);
    addToast(rateLimited ? t("marketplace.rateLimited") : fallbackMessage, "error");
    console.error("[marketplace] request failed", err);
  }, [addToast, t]);

  const loadSkills = useCallback(async (options?: {
    forceRefresh?: boolean;
    query?: string;
    page?: number;
    append?: boolean;
  }) => {
    const forceRefresh = options?.forceRefresh ?? false;
    const query = options?.query;
    const page = options?.page ?? 1;
    const append = options?.append ?? false;
    const normalizedQuery = query && query.trim().length > 0 ? query.trim() : undefined;
    const requestSeq = listRequestSeqRef.current + 1;
    listRequestSeqRef.current = requestSeq;
    const isStaleRequest = () => requestSeq !== listRequestSeqRef.current;

    try {
      const result = await invoke<MarketplaceSkillsResponse>("fetch_marketplace_skills", {
        forceRefresh,
        query: normalizedQuery,
        page,
      });
      if (isStaleRequest()) {
        return;
      }
      primeDescriptionCache(result.skills);
      const incoming = result.skills.map(withCachedDescription);

      setSkills((prev) => {
        if (!append || page === 1) {
          return sortMarketplaceSkillsByInstallStatus(incoming);
        }
        const merged = [...prev];
        const existingIds = new Set(prev.map((skill) => skill.id));
        for (const skill of incoming) {
          if (!existingIds.has(skill.id)) {
            merged.push(skill);
          }
        }
        return sortMarketplaceSkillsByInstallStatus(merged);
      });
      setHasMore(result.has_more);
      setCurrentPage(page);
    } catch (err) {
      if (isStaleRequest()) {
        return;
      }
      showMarketplaceError(err, t("marketplace.networkError"));
    } finally {
      if (page === 1 && !isStaleRequest()) {
        setInitialLoading(false);
      }
    }
  }, [showMarketplaceError, t]);

  useEffect(() => {
    const loadSeq = remoteLoadSeqRef.current + 1;
    remoteLoadSeqRef.current = loadSeq;
    setSearching(true);
    void loadSkills({
      page: 1,
      query: normalizedRemoteQuery,
    }).finally(() => {
      if (remoteLoadSeqRef.current === loadSeq) {
        setSearching(false);
        initialRef.current = false;
      }
    });
  }, [loadSkills, normalizedRemoteQuery]);

  // Load enabled marketplace sources from config for the search bar dropdown
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const config = await invoke<AppConfig>("get_config");
        if (!cancelled) {
          const SOURCE_TO_PLATFORM: Record<string, string> = {
            "src_skills_sh_home": "skills.sh",
            "src_composio_awesome_claude_skills": "awesome-claude-skills",
            "skillhub": "skillhub",
            "clawhub": "clawhub",
            "redskill": "redskill",
          };
          const enabled = config.marketplace_sources
            ?.filter((s) => s.enabled)
            .map((s) => SOURCE_TO_PLATFORM[s.id])
            .filter((p): p is string => p !== undefined) ?? [];
          setEnabledPlatforms(enabled);
        }
      } catch {
        // Silently ignore - SearchBar falls back to showing all platforms
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (skills.length === 0) return;
    const inputs = skills.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
    }));
    void translation.preloadCachedMarketplace(inputs, language);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skills, language, translation.preloadCachedMarketplace]);

  useEffect(() => {
    const candidates = skills
      .filter((skill) => {
        if (skill.description) {
          return false;
        }
        if (!skill.repo_url || !skill.skill_path) {
          return false;
        }
        if (descriptionFetchedRef.current.has(skill.id) || descriptionInFlightRef.current.has(skill.id)) {
          return false;
        }
        return true;
      })
      .slice(0, DESCRIPTION_BATCH_SIZE);

    if (candidates.length === 0) {
      return;
    }

    const requestId = descriptionRequestSeqRef.current + 1;
    descriptionRequestSeqRef.current = requestId;
    candidates.forEach((skill) => descriptionInFlightRef.current.add(skill.id));
    let cancelled = false;
    let continueHydration = false;

    async function hydrateDescriptions() {
      try {
        const payload: MarketplaceDescriptionRequest[] = candidates
          .filter((skill) => Boolean(skill.repo_url && skill.skill_path))
          .map((skill) => ({
            id: skill.id,
            repo_url: skill.repo_url as string,
            skill_path: skill.skill_path as string,
          }));

        if (payload.length === 0) {
          continueHydration = true;
          return;
        }

        const descriptions = await invoke<Record<string, string | null>>(
          "fetch_marketplace_skill_descriptions",
          { skills: payload },
        );

        if (cancelled || requestId !== descriptionRequestSeqRef.current) {
          return;
        }

        Object.entries(descriptions).forEach(([skillId, description]) => {
          const normalized = description?.trim() || null;
          marketplaceDescriptionCache.set(skillId, normalized);
        });

        setSkills((prev) => {
          let changed = false;
          const next = prev.map((skill) => {
            const cached = marketplaceDescriptionCache.get(skill.id);
            if (!cached || cached === skill.description) {
              return skill;
            }
            changed = true;
            return { ...skill, description: cached };
          });
          return changed ? next : prev;
        });

        setSelectedSkill((current) => {
          if (!current) {
            return current;
          }
          const cached = marketplaceDescriptionCache.get(current.id);
          if (!cached || cached === current.description) {
            return current;
          }
          return { ...current, description: cached };
        });

        continueHydration = true;
      } catch (_err) {
        // ignore hydration errors and keep list responsive
      } finally {
        candidates.forEach((skill) => {
          descriptionInFlightRef.current.delete(skill.id);
          if (continueHydration) {
            descriptionFetchedRef.current.add(skill.id);
          }
        });
        if (!cancelled && continueHydration) {
          setDescriptionHydrationTick((value) => value + 1);
        }
      }
    }

    void hydrateDescriptions();

    return () => {
      cancelled = true;
    };
  }, [skills, descriptionHydrationTick]);

  const handleRefresh = useCallback(async () => {
    descriptionFetchedRef.current.clear();
    descriptionInFlightRef.current.clear();
    setRefreshing(true);
    try {
      await loadSkills({
        forceRefresh: true,
        page: 1,
        query: normalizedRemoteQuery,
      });
      addToast(t("common.refreshSuccess"), "success");
    } catch (err) {
      showMarketplaceError(err, t("marketplace.networkError"));
    } finally {
      setRefreshing(false);
    }
  }, [addToast, loadSkills, normalizedRemoteQuery, showMarketplaceError, t]);

  const updateAvailableCount = useMemo(
    () => skills.filter((skill) => skill.install_status === "update_available").length,
    [skills],
  );
  const installingGithubUrl = installingSkill === DIRECT_GITHUB_INSTALL_ID;

  const handleUpdateAll = useCallback(async () => {
    if (updatingAll || updateAvailableCount === 0 || installingSkill) {
      return;
    }

    setUpdatingAll(true);
    try {
      const syncResult = await invoke<MarketplaceSyncResult>(
        "sync_marketplace_installed_skills",
      );
      if (syncResult.updated > 0) {
        addToast(
          t("marketplace.syncUpdated").replace("{count}", String(syncResult.updated)),
          "success",
        );
      }
      if (syncResult.failed.length > 0) {
        addToast(
          t("marketplace.syncPartialFailed").replace(
            "{count}",
            String(syncResult.failed.length),
          ),
          "error",
        );
      }

      await loadSkills({
        forceRefresh: true,
        page: 1,
        query: normalizedRemoteQuery,
      });
    } catch (err) {
      showMarketplaceError(err, t("marketplace.networkError"));
    } finally {
      setUpdatingAll(false);
    }
  }, [
    installingSkill,
    loadSkills,
    normalizedRemoteQuery,
    showMarketplaceError,
    t,
    updateAvailableCount,
    updatingAll,
  ]);

  const handleLoadMore = useCallback(async () => {
    if (loadingMore || refreshing || initialLoading || !hasMore) {
      return;
    }
    setLoadingMore(true);
    try {
      await loadSkills({
        page: currentPage + 1,
        append: true,
        query: normalizedRemoteQuery,
      });
    } finally {
      setLoadingMore(false);
    }
  }, [
    currentPage,
    hasMore,
    initialLoading,
    loadSkills,
    loadingMore,
    normalizedRemoteQuery,
    refreshing,
  ]);

  const handleInstall = useCallback(async (skill: MarketplaceSkill, event?: MouseEvent) => {
    event?.stopPropagation();
    if (skill.install_status === "installed") return;

    const isUpdateAction = skill.install_status === "update_available";
    setInstallingSkill(skill.id);
    try {
      const result = await invoke<InstallResult>("install_marketplace_skill", { skillId: skill.id });
      if (result.success) {
        addToast(
          t(isUpdateAction ? "marketplace.updateSuccess" : "marketplace.installSuccess").replace(
            "{name}",
            skill.name,
          ),
          "success",
        );
        setSelectedSkill((current) => (
          current && current.id === skill.id
            ? { ...current, install_status: "installed" }
            : current
        ));
        await loadSkills({
          forceRefresh: true,
          page: 1,
          query: normalizedRemoteQuery,
        });
      } else {
        addToast(
          t(isUpdateAction ? "marketplace.updateFailed" : "marketplace.installFailed"),
          "error",
        );
      }
    } catch (err) {
      showMarketplaceError(
        err,
        t(isUpdateAction ? "marketplace.updateFailed" : "marketplace.installFailed"),
      );
    } finally {
      setInstallingSkill(null);
    }
  }, [addToast, loadSkills, normalizedRemoteQuery, showMarketplaceError, t]);

  const handleGithubInstall = useCallback(async () => {
    const directUrl = githubInstallUrl.trim();
    if (!directUrl) {
      addToast(t("marketplace.githubInstallRequired"), "error");
      return;
    }
    if (installingSkill || updatingAll || refreshing) {
      return;
    }

    setInstallingSkill(DIRECT_GITHUB_INSTALL_ID);
    try {
      const result = await invoke<InstallResult>("install_marketplace_skill_by_ref", {
        reference: {
          name: "",
          repo_url: directUrl,
        },
      });
      if (result.success) {
        addToast(t("marketplace.githubInstallSuccess"), "success");
        setGithubInstallUrl("");
        setGithubInstallDialogOpen(false);
        await loadSkills({
          forceRefresh: true,
          page: 1,
          query: normalizedRemoteQuery,
        });
      } else {
        addToast(t("marketplace.githubInstallFailed"), "error");
      }
    } catch (err) {
      showMarketplaceError(err, t("marketplace.githubInstallFailed"));
    } finally {
      setInstallingSkill(null);
    }
  }, [
    addToast,
    githubInstallUrl,
    installingSkill,
    loadSkills,
    normalizedRemoteQuery,
    refreshing,
    showMarketplaceError,
    t,
    updatingAll,
  ]);

  // Platform search handler
  const handlePlatformSearch = useCallback(async (platform: string, query: string) => {
    setPlatformSearching(true);
    setPlatformSearchResults([]);
    try {
      const results = await invoke<PlatformSkill[]>("search_marketplace", {
        platform,
        query,
      });
      setPlatformSearchResults(results);
    } catch (err) {
      addToast(
        err instanceof Error ? err.message : String(err),
        "error"
      );
    } finally {
      setPlatformSearching(false);
    }
  }, [addToast]);

  // Platform install handler
  const handlePlatformInstall = useCallback(async (skill: PlatformSkill) => {
    setInstallingPlatformSkill(skill.slug);
    try {
      const result = await invoke<PlatformInstallResult>("install_from_platform", {
        platform: skill.platform,
        slug: skill.slug,
      });
      if (result.success) {
        addToast(`已安装 ${skill.name}`, "success");
        // Refresh local skills list
        await loadSkills({ forceRefresh: true, page: 1 });
      } else {
        addToast(result.message, "error");
      }
    } catch (err) {
      addToast(
        err instanceof Error ? err.message : String(err),
        "error"
      );
    } finally {
      setInstallingPlatformSkill(null);
    }
  }, [addToast, loadSkills]);

  // Install by URL handler
  const handleInstallByUrl = useCallback(async (_platform: string, url: string) => {
    setPlatformSearching(true);
    try {
      const result = await invoke<PlatformInstallResult>("install_marketplace_skill_by_ref", {
        reference: {
          name: "",
          repo_url: url,
        },
      });
      if (result.success) {
        addToast("技能安装成功", "success");
        await loadSkills({ forceRefresh: true, page: 1 });
      } else {
        addToast(result.message || "安装失败", "error");
      }
    } catch (err) {
      addToast(
        err instanceof Error ? err.message : String(err),
        "error"
      );
    } finally {
      setPlatformSearching(false);
    }
  }, [addToast, loadSkills]);

  const handleTranslateMarketSkill = useCallback(
    async (skill: MarketplaceSkill, event: MouseEvent | null, force: boolean = false) => {
      event?.stopPropagation();
      const key = makeTranslationKey(skill.id, language);
      if (!force) {
        const existing = translation.getTranslation(key);
        if (existing) {
          const isTranslated = marketViewMode.has(skill.id);
          setMarketViewMode((prev) => {
            const next = new Set(prev);
            isTranslated ? next.delete(skill.id) : next.add(skill.id);
            return next;
          });
          return;
        }
      }
      let configured = translation.isConfigured;
      if (!configured) {
        configured = await translation.refreshConfigured();
      }
      if (!configured) {
        addToast(t("skills.llmNotConfigured"), "error");
        return;
      }
      setTranslatingMarketIds((prev) => {
        const next = new Set(prev);
        next.add(skill.id);
        return next;
      });
      try {
        await translation.translateMarketplace(
          { id: skill.id, name: skill.name, description: skill.description },
          language,
          force,
        );
      } catch (err) {
        addToast(formatTranslationError(err, t), "error");
      } finally {
        setTranslatingMarketIds((prev) => {
          const next = new Set(prev);
          next.delete(skill.id);
          return next;
        });
      }
    },
    [translation, language, addToast, t, marketViewMode],
  );

  const handleOpenExternalLink = useCallback(async (event: MouseEvent, url: string) => {
    event.stopPropagation();
    if (url) {
      try {
        await openUrl(url);
      } catch (err) {
        showMarketplaceError(err, t("marketplace.networkError"));
      }
    }
  }, [showMarketplaceError, t]);

  useEffect(() => {
    if (!hasMore || initialLoading || refreshing) {
      return;
    }
    const target = loadMoreRef.current;
    if (!target) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void handleLoadMore();
        }
      },
      { rootMargin: "200px 0px" },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [handleLoadMore, hasMore, initialLoading, refreshing, skills.length]);

  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    skills.forEach((skill) => {
      skill.tags.forEach((tag) => tagSet.add(tag));
    });
    return Array.from(tagSet).sort((a, b) => a.localeCompare(b));
  }, [skills]);

  const filteredSkills = useMemo(() => {
    return skills.filter((skill) => {
      const matchesTags = selectedTags.length === 0
        || selectedTags.some((tag) => skill.tags.includes(tag));
      return matchesTags;
    });
  }, [selectedTags, skills]);

  // Always render page structure (header, search bar, etc.)
  // Skills grid shows skeleton/empty state based on loading and data
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
        title={t("marketplace.title")}
        actions={
          <>
            {updateAvailableCount > 0 && (
              <button
                type="button"
                onClick={handleUpdateAll}
                disabled={updatingAll || refreshing || installingSkill !== null}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 12px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 600,
                  border: '1px solid rgba(9, 105, 218, 0.35)',
                  color: 'var(--primary)',
                  backgroundColor: 'rgba(9, 105, 218, 0.10)',
                  cursor: updatingAll || refreshing || installingSkill !== null ? 'not-allowed' : 'pointer',
                  opacity: updatingAll || refreshing || installingSkill !== null ? 0.7 : 1,
                }}
              >
                {updatingAll
                  ? t("marketplace.updatingAll")
                  : t("marketplace.updateAll").replace("{count}", String(updateAvailableCount))}
              </button>
            )}
            <button
              type="button"
              onClick={() => setGithubInstallDialogOpen(true)}
              disabled={installingSkill !== null || updatingAll}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 600,
                border: '1px solid rgba(9, 105, 218, 0.28)',
                color: 'var(--foreground)',
                backgroundColor: 'var(--background)',
                cursor: installingSkill !== null || updatingAll ? 'not-allowed' : 'pointer',
                opacity: installingSkill !== null || updatingAll ? 0.7 : 1,
              }}
            >
              <Link2 size={14} />
              {t("marketplace.githubInstallOpen")}
            </button>
            <RefreshButton onClick={handleRefresh} loading={refreshing || updatingAll} />
          </>
        }
      />

      <main style={{ flex: 1, overflow: 'auto', padding: '12px 20px' }}>
        <div style={{ maxWidth: '1200px' }}>
          {/* Platform Search Section */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            marginBottom: '24px',
            paddingTop: '8px',
          }}>
            <SearchBar onSearch={handlePlatformSearch} onInstallByUrl={handleInstallByUrl} loading={platformSearching} enabledPlatforms={enabledPlatforms} />
          </div>

          {/* Platform Search Results */}
          {platformSearchResults.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '12px',
              }}>
                <h3 style={{
                  margin: 0,
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'var(--foreground)',
                }}>
                  搜索结果
                </h3>
                <button
                  onClick={() => setPlatformSearchResults([])}
                  style={{
                    padding: '4px 10px',
                    fontSize: '12px',
                    color: 'var(--muted-foreground)',
                    backgroundColor: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  清除
                </button>
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '12px',
              }}>
                {platformSearchResults.map((skill) => (
                  <PlatformSkillCard
                    key={skill.slug}
                    skill={skill}
                    onInstall={handlePlatformInstall}
                    installing={installingPlatformSkill === skill.slug}
                  />
                ))}
              </div>
            </div>
          )}

          {platformSearching && platformSearchResults.length === 0 && (
            <div style={{
              textAlign: 'center',
              padding: '40px 20px',
              color: 'var(--muted-foreground)',
            }}>
              搜索中...
            </div>
          )}

          {availableTags.length > 0 && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
              {availableTags.map((tag) => {
                const isSelected = selectedTags.includes(tag);
                return (
                    <button
                      key={tag}
                      onClick={() => {
                        setSelectedTags((prev) => isSelected
                          ? prev.filter((t) => t !== tag)
                          : [...prev, tag]);
                      }}
                      style={{
                        borderRadius: '999px',
                        padding: '4px 10px',
                        fontSize: '11px',
                        fontWeight: 500,
                        border: isSelected ? '1px solid rgba(9, 105, 218, 0.4)' : '1px solid var(--border)',
                        backgroundColor: isSelected ? 'rgba(9, 105, 218, 0.12)' : 'var(--secondary)',
                        color: isSelected ? 'var(--primary)' : 'var(--muted-foreground)',
                        cursor: 'pointer',
                      }}
                    >
                    {tag}
                  </button>
                );
              })}
            </div>
          )}

          {initialLoading && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '12px',
            }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} style={{
                  backgroundColor: 'var(--secondary)',
                  borderRadius: '10px',
                  border: '1px solid var(--border)',
                  padding: '16px',
                  animation: 'pulse 1.5s ease-in-out infinite',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: 'var(--muted)', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ height: '14px', width: '70%', backgroundColor: 'var(--muted)', borderRadius: '4px', marginBottom: '6px' }} />
                      <div style={{ height: '11px', width: '40%', backgroundColor: 'var(--muted)', borderRadius: '4px' }} />
                    </div>
                  </div>
                  <div style={{ height: '11px', width: '90%', backgroundColor: 'var(--muted)', borderRadius: '4px', marginBottom: '6px' }} />
                  <div style={{ height: '11px', width: '60%', backgroundColor: 'var(--muted)', borderRadius: '4px' }} />
                </div>
              ))}
            </div>
          )}

          {!initialLoading && filteredSkills.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '32px 20px',
              color: 'var(--muted-foreground)',
              backgroundColor: 'var(--secondary)',
              borderRadius: '10px',
              border: '1px solid var(--border)',
            }}>
              {searching
                ? t("loading.default")
                : skills.length === 0
                  ? t("marketplace.noSkills")
                  : t("marketplace.noMatch")}
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '12px',
            }}>
              {filteredSkills.map((skill) => {
                const color = getSkillColor(skill.name);
                const isInstalled = skill.install_status === "installed";
                const isUpdateAvailable = skill.install_status === "update_available";
                const isInstalling = installingSkill === skill.id;
                const actionBusy = isInstalling || updatingAll;
                const externalUrl = skill.external_url || skill.repo_url;
                const installCountLabel = formatInstallCountLabel(skill.install_count);
                const metaChipStyle = getMarketplaceMetaChipStyle("compact");
                const translationKey = makeTranslationKey(skill.id, language);
                const cachedTranslation = translation.getTranslation(translationKey);
                const showingTranslation =
                  cachedTranslation != null && marketViewMode.has(skill.id);
                const displayedName = showingTranslation && cachedTranslation
                  ? cachedTranslation.name
                  : skill.name;
                const displayedDescription = showingTranslation && cachedTranslation
                  ? cachedTranslation.description
                  : skill.description;
                const isTranslating = translatingMarketIds.has(skill.id);
                const metaItems = buildMarketplaceMetaItems(
                  t("marketplace.source").replace("{source}", skill.source_name),
                  skill.author ? t("marketplace.author").replace("{author}", skill.author) : null,
                  installCountLabel,
                );
                return (
                    <div
                      key={skill.id}
                      onClick={() => setSelectedSkill(skill)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        padding: '14px',
                        backgroundColor: 'var(--secondary)',
                        borderRadius: '10px',
                        border: '1px solid var(--border)',
                        transition: 'border-color 0.15s',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--ring)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border)';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '8px' }}>
                        <div style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '8px',
                          backgroundColor: color.bg,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color.icon} strokeWidth="2">
                            <path d="M12 3L13.5 8.5L19 10L13.5 11.5L12 17L10.5 11.5L5 10L10.5 8.5L12 3Z"/>
                          </svg>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '14px',
                            fontWeight: 600,
                            color: 'var(--foreground)',
                            marginBottom: '3px',
                            lineHeight: 1.3,
                          }}>
                            <span style={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}>
                              {displayedName}
                            </span>
                            {externalUrl && (
                              <span
                                style={{
                                  color: 'var(--muted-foreground)',
                                  cursor: 'pointer',
                                  flexShrink: 0,
                                  display: 'flex',
                                  alignItems: 'center',
                                }}
                                onClick={(e) => handleOpenExternalLink(e, externalUrl)}
                                title={t("marketplace.openInBrowser")}
                              >
                                <ExternalLink size={13} />
                              </span>
                            )}
                            <div style={{ marginLeft: 'auto', flexShrink: 0 }}>
                              <TranslateIconButton
                                hasTranslation={cachedTranslation != null}
                                showingTranslation={showingTranslation}
                                translating={isTranslating}
                                translateLabel={t("skills.translateAction")}
                                showOriginalLabel={t("skills.showOriginal")}
                                showTranslationLabel={t("skills.showTranslated")}
                                translatingLabel={t("skills.translating")}
                                retranslateLabel={t("skills.retranslate")}
                                onClick={(e) => void handleTranslateMarketSkill(skill, e)}
                                onRetranslate={() => void handleTranslateMarketSkill(skill, null, true)}
                                size={22}
                              />
                            </div>
                          </div>
                          <p style={{
                            fontSize: '12px',
                            color: 'var(--muted-foreground)',
                            margin: 0,
                            lineHeight: 1.4,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}>
                            {displayedDescription || t("skills.noDescription")}
                          </p>
                        </div>
                        <div style={{
                          display: 'flex',
                          alignItems: 'flex-end',
                          flexShrink: 0,
                        }}>
                          {isInstalled ? (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '10px',
                              fontWeight: 500,
                              color: 'var(--color-success)',
                              backgroundColor: 'var(--color-success-bg)',
                              padding: '4px 8px',
                              borderRadius: '6px',
                              border: '1px solid var(--color-success-border)',
                              flexShrink: 0,
                            }}>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <polyline points="20 6 9 17 4 12"/>
                              </svg>
                              {t("marketplace.installed")}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => handleInstall(skill, e)}
                              disabled={actionBusy}
                              title={t(isUpdateAvailable ? "marketplace.update" : "marketplace.install")}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '28px',
                                height: '28px',
                                borderRadius: '6px',
                                border: '1px solid var(--border)',
                                backgroundColor: 'var(--secondary)',
                                color: 'var(--muted-foreground)',
                                cursor: actionBusy ? 'wait' : 'pointer',
                                opacity: actionBusy ? 0.7 : 1,
                                flexShrink: 0,
                                padding: 0,
                              }}
                            >
                              {isInstalling
                                ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                                : <Plus size={14} />}
                            </button>
                          )}
                        </div>
                      </div>

                      <div style={{
                        display: 'flex',
                        gap: '6px',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        marginBottom: '6px',
                      }}>
                        {metaItems.map((item) => (
                          item.kind === "install_count" ? (
                            <InstallCountBadge key={item.key} label={item.label} />
                          ) : (
                            <span
                              key={item.key}
                              style={{
                                ...metaChipStyle,
                              }}
                            >
                              {item.label}
                            </span>
                          )
                        ))}
                        {skill.tags.length > 0 && (
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            {skill.tags.slice(0, 3).map((tag) => (
                              <span
                                key={tag}
                                style={{
                                  fontSize: '10px',
                                  fontWeight: 500,
                                  color: 'var(--primary)',
                                  backgroundColor: 'rgba(9, 105, 218, 0.12)',
                                  padding: '2px 6px',
                                  borderRadius: '999px',
                                  border: '1px solid rgba(9, 105, 218, 0.35)',
                                }}
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                );
              })}
            </div>
          )}

          {hasMore && (
            <>
              <div ref={loadMoreRef} style={{ height: '1px' }} />
              {loadingMore && (
                <div style={{
                  marginTop: '8px',
                  textAlign: 'center',
                  fontSize: '11px',
                  color: 'var(--muted-foreground)',
                }}>
                  {t("loading.default")}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {selectedSkill && (
        <SkillDetailModal
          skill={selectedSkill}
          onClose={() => setSelectedSkill(null)}
          onInstall={handleInstall}
          installing={updatingAll || installingSkill === selectedSkill.id}
        />
      )}

      <GithubInstallDialog
        open={githubInstallDialogOpen}
        installing={installingGithubUrl}
        value={githubInstallUrl}
        onChange={setGithubInstallUrl}
        onClose={() => setGithubInstallDialogOpen(false)}
        onSubmit={() => void handleGithubInstall()}
      />
    </div>
  );
}

function GithubInstallDialog({
  open,
  installing,
  value,
  onChange,
  onClose,
  onSubmit,
}: {
  open: boolean;
  installing: boolean;
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const { t } = useTranslation();

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !installing) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [installing, onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: MODAL_OVERLAY_COLOR,
        zIndex: MODAL_LAYER_Z_INDEX,
        padding: "24px",
      }}
      onClick={() => {
        if (!installing) {
          onClose();
        }
      }}
    >
      <div
        style={{
          width: "min(680px, calc(100vw - 48px))",
          backgroundColor: "var(--background)",
          borderRadius: "18px",
          border: "1px solid var(--border)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.24)",
          padding: "22px",
          display: "flex",
          flexDirection: "column",
          gap: "18px",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "16px",
              fontWeight: 700,
              color: "var(--foreground)",
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "28px",
                height: "28px",
                borderRadius: "10px",
                background: "rgba(9, 105, 218, 0.1)",
                color: "var(--primary)",
              }}
            >
              <Link2 size={15} />
            </span>
            {t("marketplace.githubInstallTitle")}
          </div>
          <p
            style={{
              margin: 0,
              fontSize: "13px",
              lineHeight: 1.6,
              color: "var(--muted-foreground)",
            }}
          >
            {t("marketplace.githubInstallDesc")}
          </p>
        </div>

        <div
          style={{
            padding: "12px 14px",
            borderRadius: "14px",
            border: "1px solid rgba(9, 105, 218, 0.14)",
            background:
              "linear-gradient(135deg, rgba(9, 105, 218, 0.08), rgba(9, 105, 218, 0.03))",
            fontSize: "12px",
            color: "var(--muted-foreground)",
            lineHeight: 1.6,
          }}
        >
          {t("marketplace.githubInstallPlaceholder")}
        </div>

        <input
          autoFocus
          type="text"
          placeholder={t("marketplace.githubInstallPlaceholder")}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onSubmit();
            }
          }}
          style={{
            width: "100%",
            padding: "12px 14px",
            fontSize: "13px",
            border: "1px solid var(--border)",
            borderRadius: "12px",
            backgroundColor: "var(--background)",
            color: "var(--foreground)",
            outline: "none",
            boxSizing: "border-box",
          }}
        />

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
          <button
            type="button"
            onClick={onClose}
            disabled={installing}
            style={{
              padding: "9px 14px",
              borderRadius: "10px",
              border: "1px solid var(--border)",
              backgroundColor: "var(--secondary)",
              color: "var(--foreground)",
              fontSize: "13px",
              fontWeight: 600,
              cursor: installing ? "wait" : "pointer",
              opacity: installing ? 0.7 : 1,
            }}
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={installing}
            style={{
              padding: "9px 16px",
              borderRadius: "10px",
              border: "1px solid var(--color-primary)",
              backgroundColor: "var(--color-primary)",
              color: "white",
              fontSize: "13px",
              fontWeight: 700,
              cursor: installing ? "wait" : "pointer",
              opacity: installing ? 0.7 : 1,
            }}
          >
            {installing ? t("marketplace.installing") : t("marketplace.githubInstallAction")}
          </button>
        </div>
      </div>
    </div>
  );
}
