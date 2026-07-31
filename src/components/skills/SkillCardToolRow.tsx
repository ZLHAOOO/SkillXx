import { useState } from "react";
import { type TranslationPath } from "@/i18n";
import { type UnifiedSkillListItem } from "@/pages/skills/buildUnifiedSkillItems";
import { type Tool } from "@/types";
import { MODAL_LAYER_Z_INDEX } from "@/constants/modal";
import { convertFileSrc } from "@tauri-apps/api/core";
import { getToolIconUrl } from "@/assets/tools";
import { groupToolIdsForDisplay } from "@/pages/tools/hermesGrouping";

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

function getToolDisplayName(toolId: string, tools: Tool[]): string {
  const tool = tools.find((t) => t.id === toolId);
  return tool?.name ?? toolId;
}

/**
 * Small Hermes icon with a black count badge in the top-right corner.
 * Replaces a run of identical `hermes-*` profile icons inside a tool
 * icon row (e.g. under a skill card).
 */
function HermesGroupedIcon({ count }: { count: number }) {
  const iconUrl = getToolIconUrl("hermes");
  const label = count > 1 ? `Hermes · ${count} profiles` : "Hermes";
  return (
    <span
      title={label}
      aria-label={label}
      style={{ position: "relative", display: "inline-flex", flexShrink: 0 }}
    >
      {iconUrl ? (
        <img
          src={iconUrl}
          alt="Hermes"
          style={{
            width: "20px",
            height: "20px",
            borderRadius: "5px",
            objectFit: "contain",
            display: "block",
          }}
        />
      ) : (
        <span
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
          }}
        >
          H
        </span>
      )}
      <span
        aria-label={`${count} profiles`}
        style={{
          position: "absolute",
          top: -3,
          right: -3,
          minWidth: 12,
          height: 12,
          padding: "0 3px",
          borderRadius: 6,
          backgroundColor: "#000",
          color: "#fff",
          fontSize: "9px",
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          lineHeight: 1,
          boxShadow: "0 0 0 1px var(--secondary)",
        }}
      >
        {count}
      </span>
    </span>
  );
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

export function renderSkillToolSection(
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

  // Merge runs of Hermes profile ids into a single grouped entry so we
  // don't render N identical Hermes icons.
  const units = groupToolIdsForDisplay(toolIds);

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", alignItems: "center", position: "relative" }}>
      {units.map((unit, index) => {
        if (unit.kind === "hermesGroup") {
          return (
            <HermesGroupedIcon
              key={`hermes-group-${unit.toolIds.join("-")}`}
              count={unit.toolIds.length}
            />
          );
        }
        return (
          <span
            key={`${unit.toolId}-${index}`}
            title={getToolDisplayName(unit.toolId, tools)}
          >
            {getToolIconElement(unit.toolId, tools)}
          </span>
        );
      })}
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
