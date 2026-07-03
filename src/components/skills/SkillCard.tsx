import { useState, memo } from "react";
import { type TranslationPath } from "@/i18n";
import { type UnifiedSkillListItem } from "@/pages/skills/buildUnifiedSkillItems";
import { type Tool } from "@/types";
import { getSkillColor } from "@/lib/getSkillColor";
import { MODAL_LAYER_Z_INDEX } from "@/constants/modal";
import { convertFileSrc } from "@tauri-apps/api/core";
import { getToolIconUrl } from "@/assets/tools";

interface SkillCardProps {
  item: UnifiedSkillListItem;
  isBatchManageMode: boolean;
  isBatchSelected: boolean;
  canOpen: boolean;
  cardTitle: string;
  description: string;
  previewChips: string[];
  categoryChips: string[];
  tools: Tool[];
  deletingSkill: string | null;
  deletingGroupId: string | null;
  onOpen: () => void;
  onToggleBatchSelection: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onPin: () => void;
  t: (key: TranslationPath) => string;
}

// 使用 React.memo 优化，只在关键 props 变化时重新渲染
function SkillCardComponent({
  item,
  isBatchManageMode,
  isBatchSelected,
  canOpen,
  cardTitle,
  description,
  previewChips,
  categoryChips,
  tools,
  deletingSkill,
  deletingGroupId,
  onOpen,
  onToggleBatchSelection,
  onEdit,
  onDelete,
  onPin,
  t,
}: SkillCardProps) {
  const color = getSkillColor(item.title);

  return (
    <div
      key={item.key}
      onClick={isBatchManageMode ? onToggleBatchSelection : canOpen ? onOpen : undefined}
      style={{
        display: "flex",
        flexDirection: "column",
        padding: "16px",
        backgroundColor: isBatchSelected ? "color-mix(in srgb, var(--primary) 8%, var(--secondary))" : "var(--secondary)",
        borderRadius: "10px",
        border: isBatchSelected ? "1px solid color-mix(in srgb, var(--primary) 40%, transparent)" : "1px solid var(--border)",
        transition: canOpen && !isBatchManageMode ? "border-color 0.15s" : undefined,
        cursor: isBatchManageMode ? "pointer" : canOpen ? "pointer" : "default",
        width: "100%",
        boxSizing: "border-box",
      }}
      onMouseEnter={(e) => {
        if (!canOpen || isBatchManageMode) {
          return;
        }
        e.currentTarget.style.borderColor = "var(--ring)";
      }}
      onMouseLeave={(e) => {
        if (!canOpen || isBatchManageMode) {
          return;
        }
        e.currentTarget.style.borderColor = "var(--border)";
      }}
    >
      {/* Header Row */}
      <div style={{ display: "flex", gap: "14px", marginBottom: "16px", alignItems: "flex-start" }}>
        {/* Batch Checkbox */}
        {isBatchManageMode && (
          <div
            style={{
              width: "20px",
              height: "20px",
              marginTop: "12px",
              borderRadius: "6px",
              border: isBatchSelected ? "1px solid var(--primary)" : "1px solid var(--border)",
              backgroundColor: isBatchSelected ? "var(--foreground)" : "var(--background)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {isBatchSelected && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--primary-foreground)" strokeWidth="3">
                <path d="m5 12 5 5L20 7" />
              </svg>
            )}
          </div>
        )}

        {/* Icon */}
        <div style={{
          width: "40px",
          height: "40px",
          borderRadius: "10px",
          backgroundColor: color.bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}>
          {item.kind === "group" ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color.icon} strokeWidth="2">
              <rect x="3" y="4" width="7" height="7" rx="1.5" />
              <rect x="14" y="4" width="7" height="7" rx="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color.icon} strokeWidth="2">
              <path d="M12 3L13.5 8.5L19 10L13.5 11.5L12 17L10.5 11.5L5 10L10.5 8.5L12 3Z" />
            </svg>
          )}
        </div>

        {/* Title and Description */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", flexWrap: "wrap" }}>
            <div style={{
              fontSize: "15px",
              fontWeight: 600,
              color: "var(--foreground)",
              lineHeight: 1.3,
              minWidth: 0,
            }}>
              {cardTitle}
            </div>
            {item.badgeLabel && (
              <span style={{
                display: "inline-flex",
                alignItems: "center",
                height: "22px",
                padding: "0 8px",
                fontSize: "11px",
                fontWeight: 600,
                color: "var(--muted-foreground)",
                backgroundColor: "var(--background)",
                border: "1px solid var(--border)",
                borderRadius: "999px",
              }}>
                {item.badgeLabel}
              </span>
            )}
          </div>
          <div style={{ minHeight: "2.7em" }}>
            <p style={{
              fontSize: "13px",
              color: "var(--muted-foreground)",
              margin: 0,
              lineHeight: 1.5,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}>
              {description}
            </p>
          </div>
        </div>

        {/* Actions */}
        {!isBatchManageMode && item.kind === "skill" && item.skill && (
          <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 1, minWidth: 0 }}>
            {item.pinned && (
              <span title="已置顶" style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                </svg>
              </span>
            )}
            <SkillCardActions
              deleting={deletingSkill === item.skill.instance_id}
              pinned={item.pinned ?? false}
              onEdit={onEdit}
              onDelete={onDelete}
              onPin={onPin}
              t={t}
            />
          </div>
        )}
        {!isBatchManageMode && item.kind === "group" && item.skillPackage && (
          <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 1, minWidth: 0 }}>
            {item.pinned && (
              <span title="已置顶" style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                </svg>
              </span>
            )}
            <SkillCardActionMenu
              deleting={deletingGroupId === item.id}
              editLabel={t("common.edit")}
              deleteLabel={t("skills.delete")}
              pinLabel={item.pinned ? t("skills.unpin") : t("skills.pin")}
              moreActionsLabel={t("skills.moreActions")}
              onEdit={onEdit}
              onDelete={onDelete}
              onPin={onPin}
            />
          </div>
        )}
      </div>

      {/* Preview Chips */}
      {previewChips.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "14px", minHeight: "24px" }}>
          {previewChips.slice(0, 3).map((chip, index) => (
            <span
              key={index}
              style={{
                display: "inline-flex",
                alignItems: "center",
                height: "22px",
                padding: "0 8px",
                fontSize: "11px",
                fontWeight: 500,
                color: "var(--muted-foreground)",
                backgroundColor: "var(--background)",
                border: "1px solid var(--border)",
                borderRadius: "999px",
              }}
            >
              {chip}
            </span>
          ))}
          {item.previewOverflowCount > 0 && (
            <span style={{
              fontSize: "11px",
              fontWeight: 500,
              color: "var(--muted-foreground)",
              height: "22px",
              display: "inline-flex",
              alignItems: "center",
            }}>
              +{item.previewOverflowCount}
            </span>
          )}
        </div>
      )}

      {/* Category chips - between description and footer divider */}
      {categoryChips.length > 0 && (
        <div style={{
          display: "inline-flex",
          flexWrap: "wrap",
          gap: "4px",
          marginBottom: "10px",
        }}>
          {categoryChips.map((chip, idx) => (
            <span
              key={chip}
              style={{
                display: "inline-flex",
                alignSelf: "flex-start",
                alignItems: "center",
                height: "18px",
                padding: "0 6px",
                fontSize: "10px",
                fontWeight: 600,
                letterSpacing: "0.03em",
                color: idx === 0
                  ? "var(--primary-foreground, #fff)"
                  : "var(--muted-foreground)",
                backgroundColor: idx === 0
                  ? "var(--primary, #6366f1)"
                  : "color-mix(in srgb, var(--foreground) 4%, transparent)",
                border: idx === 0
                  ? "none"
                  : "1px solid color-mix(in srgb, var(--foreground) 10%, transparent)",
                borderRadius: "4px",
              }}
            >
              {chip}
            </span>
          ))}
        </div>
      )}

      {/* Footer - only tool logos below divider */}
      <div style={{
        paddingTop: "12px",
        borderTop: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      }}>
        {item.kind === "group" && (
          <div style={{
            fontSize: "12px",
            color: "var(--muted-foreground)",
            lineHeight: 1.5,
          }}>
            {getUnifiedItemMetaLabel(item, t)}
          </div>
        )}
        {renderSkillToolSection(item, tools, t)}
      </div>
    </div>
  );
}

// Helper component for skill card actions (edit, delete)
interface SkillCardActionsProps {
  deleting: boolean;
  pinned: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onPin: () => void;
  t: (key: TranslationPath) => string;
}

function SkillCardActions({
  deleting,
  pinned,
  onEdit,
  onDelete,
  onPin,
  t,
}: SkillCardActionsProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 1, minWidth: 0 }}>
      <SkillCardActionMenu
        deleting={deleting}
        editLabel={t("common.edit")}
        deleteLabel={t("skills.delete")}
        pinLabel={pinned ? t("skills.unpin") : t("skills.pin")}
        moreActionsLabel={t("skills.moreActions")}
        onEdit={onEdit}
        onDelete={onDelete}
        onPin={onPin}
      />
    </div>
  );
}

// Action menu component (moved from Skills.tsx)
interface SkillCardActionMenuProps {
  deleting: boolean;
  editLabel: string;
  deleteLabel: string;
  pinLabel: string;
  moreActionsLabel: string;
  onEdit: () => void;
  onDelete: () => void;
  onPin: () => void;
}

function SkillCardActionMenu({
  deleting,
  editLabel,
  deleteLabel,
  pinLabel,
  moreActionsLabel,
  onEdit,
  onDelete,
  onPin,
}: SkillCardActionMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        aria-label={moreActionsLabel}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((current) => !current);
        }}
        disabled={deleting}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "30px",
          height: "30px",
          padding: 0,
          borderRadius: "8px",
          border: "none",
          backgroundColor: "transparent",
          color: "var(--muted-foreground)",
          cursor: deleting ? "wait" : "pointer",
          opacity: deleting ? 0.6 : 1,
          transition: "color 0.15s ease, background-color 0.15s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = "var(--foreground)";
          e.currentTarget.style.backgroundColor = "rgba(15, 23, 42, 0.04)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = "var(--muted-foreground)";
          e.currentTarget.style.backgroundColor = "transparent";
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label={moreActionsLabel}
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
            style={{
              position: "fixed",
              inset: 0,
              background: "transparent",
              border: "none",
              padding: 0,
              margin: 0,
              cursor: "default",
            }}
          />
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              right: 0,
              display: "flex",
              flexDirection: "column",
              gap: "2px",
              minWidth: "132px",
              padding: "4px",
              backgroundColor: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              boxShadow: "0 8px 24px rgba(0, 0, 0, 0.25)",
              backdropFilter: "blur(10px)",
              zIndex: MODAL_LAYER_Z_INDEX,
            }}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                onPin();
              }}
              style={{
                display: "flex",
                alignItems: "center",
                width: "100%",
                padding: "10px 12px",
                fontSize: "13px",
                fontWeight: 500,
                color: "var(--popover-foreground)",
                backgroundColor: "transparent",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                textAlign: "left",
                transition: "background-color 0.15s ease, color 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "color-mix(in srgb, var(--foreground) 8%, transparent)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              {pinLabel}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                onEdit();
              }}
              style={{
                display: "flex",
                alignItems: "center",
                width: "100%",
                padding: "10px 12px",
                fontSize: "13px",
                fontWeight: 500,
                color: "var(--popover-foreground)",
                backgroundColor: "transparent",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                textAlign: "left",
                transition: "background-color 0.15s ease, color 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "color-mix(in srgb, var(--foreground) 8%, transparent)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              {editLabel}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                onDelete();
              }}
              disabled={deleting}
              style={{
                display: "flex",
                alignItems: "center",
                width: "100%",
                padding: "10px 12px",
                fontSize: "13px",
                fontWeight: 500,
                color: "var(--destructive)",
                backgroundColor: "transparent",
                border: "none",
                borderRadius: "6px",
                cursor: deleting ? "wait" : "pointer",
                textAlign: "left",
                opacity: deleting ? 0.6 : 1,
                transition: "background-color 0.15s ease, color 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "color-mix(in srgb, var(--destructive) 8%, transparent)";
                e.currentTarget.style.color = "var(--destructive)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.color = "var(--destructive)";
              }}
            >
              {deleteLabel}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function getToolIconElement(toolId: string, tools: Tool[]) {
  const tool = tools.find((t) => t.id === toolId);
  if (!tool) return null;

  const iconSrc = tool.icon_path
    ? convertFileSrc(tool.icon_path)
    : getToolIconUrl(tool.id) || (toolId.startsWith("hermes-") ? getToolIconUrl("hermes") : null);

  if (iconSrc) {
    return (
      <img
        key={toolId}
        src={iconSrc}
        alt={tool.name}
        style={{
          width: "20px",
          height: "20px",
          borderRadius: "5px",
          objectFit: "contain",
          flexShrink: 0,
        }}
      />
    );
  }

  return (
    <span
      key={toolId}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "20px",
        height: "20px",
        borderRadius: "5px",
        backgroundColor: "var(--secondary)",
        fontSize: "10px",
        fontWeight: 700,
        color: "var(--muted-foreground)",
        flexShrink: 0,
      }}
    >
      {tool.name.charAt(0).toUpperCase()}
    </span>
  );
}

// Helper functions
function getToolDisplayName(toolId: string, tools: Tool[]): string {
  const tool = tools.find((t) => t.id === toolId);
  return tool?.name ?? toolId;
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

  return `${t("skills.enabledFor")} ${summary.enabledCount}/${summary.totalCount}`;
}

// Tool overflow popup showing remaining tool names
interface ToolOverflowPopoverProps {
  toolIds: string[];
  tools: Tool[];
  onClose: () => void;
}

function ToolOverflowPopover({ toolIds, tools, onClose }: ToolOverflowPopoverProps) {
  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        style={{
          position: "fixed",
          inset: 0,
          background: "transparent",
          border: "none",
          padding: 0,
          margin: 0,
          cursor: "default",
          zIndex: MODAL_LAYER_Z_INDEX + 1,
        }}
      />
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          top: "calc(100% + 6px)",
          left: 0,
          display: "flex",
          flexDirection: "column",
          gap: "2px",
          minWidth: "160px",
          maxWidth: "240px",
          maxHeight: "260px",
          overflowY: "auto",
          padding: "4px",
          backgroundColor: "var(--popover)",
          border: "1px solid var(--border)",
          borderRadius: "8px",
          boxShadow: "0 8px 24px rgba(0, 0, 0, 0.25)",
          backdropFilter: "blur(10px)",
          zIndex: MODAL_LAYER_Z_INDEX + 2,
        }}
      >
        {toolIds.map((toolId) => {
          const tool = tools.find((t) => t.id === toolId);
          return (
            <div
              key={toolId}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 10px",
                fontSize: "12px",
                fontWeight: 500,
                color: "var(--popover-foreground)",
                borderRadius: "6px",
                whiteSpace: "nowrap",
              }}
            >
              <span style={{ flexShrink: 0 }}>{getToolIconElement(toolId, tools)}</span>
              <span>{tool?.name ?? toolId}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}

function renderSkillToolSection(
  item: UnifiedSkillListItem,
  tools: Tool[],
  t: (key: TranslationPath) => string,
) {
  if (item.kind !== "skill" || !item.toolSummary) {
    return null;
  }

  const { state, visibleEnabledToolIds, remainingCount, enabledCount, totalCount } = item.toolSummary;
  const hasEnabledTools = state !== "none";

  if (!hasEnabledTools) {
    return (
      <div style={{
        fontSize: "12px",
        color: "var(--muted-foreground)",
        lineHeight: 1.5,
      }}>
        {t("skills.noToolsEnabled")}
      </div>
    );
  }

  const allEnabledIds = state === "all" && item.allToolIds
    ? item.allToolIds
    : visibleEnabledToolIds;
  const overflowIds = state === "all" && item.allToolIds
    ? [] : visibleEnabledToolIds.slice(10);

  return <ToolIconsRow
    toolIds={allEnabledIds.slice(0, 10)}
    overflowIds={overflowIds}
    overflowCount={remainingCount}
    enabledCount={enabledCount}
    totalCount={totalCount}
    state={state}
    tools={tools}
  />;
}

interface ToolIconsRowProps {
  toolIds: string[];
  overflowIds: string[];
  overflowCount: number;
  enabledCount: number;
  totalCount: number;
  state: string;
  tools: Tool[];
}

function ToolIconsRow({ toolIds, overflowIds, overflowCount, enabledCount, totalCount, state, tools }: ToolIconsRowProps) {
  const [showOverflow, setShowOverflow] = useState(false);

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", alignItems: "center", position: "relative" }}>
      {toolIds.map((toolId) => (
        <span key={toolId} title={getToolDisplayName(toolId, tools)}>
          {getToolIconElement(toolId, tools)}
        </span>
      ))}
      {overflowCount > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowOverflow((prev) => !prev);
          }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            height: "20px",
            padding: "0 6px",
            fontSize: "11px",
            fontWeight: 500,
            color: "var(--primary)",
            backgroundColor: "rgba(99, 102, 241, 0.1)",
            border: "1px solid rgba(99, 102, 241, 0.25)",
            borderRadius: "5px",
            cursor: "pointer",
            whiteSpace: "nowrap",
            lineHeight: 1,
          }}
        >
          +{overflowCount}
        </button>
      )}
      {showOverflow && overflowIds.length > 0 && (
        <ToolOverflowPopover
          toolIds={overflowIds}
          tools={tools}
          onClose={() => setShowOverflow(false)}
        />
      )}
      {state !== "partial" && (
        <span style={{
          fontSize: "11px",
          fontWeight: 500,
          color: "var(--muted-foreground)",
          whiteSpace: "nowrap",
        }}>
          {enabledCount}/{totalCount}
        </span>
      )}
    </div>
  );
}

// 使用 React.memo 优化，只在关键 props 变化时重新渲染
export const SkillCard = memo(SkillCardComponent);

