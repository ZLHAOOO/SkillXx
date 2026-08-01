import { test } from "node:test";
import assert from "node:assert/strict";
import { getUnifiedItemMetaLabel } from "./getUnifiedItemMetaLabel.ts";
import type { UnifiedSkillListItem } from "./buildUnifiedSkillItems.ts";
import type { EnabledToolsSummary } from "./summarizeEnabledTools.ts";

/** Echo the key back so assertions show which branch was taken. */
const t = ((key: string) => {
  if (key === "skills.groupMembersCount") return "{count} members";
  return key;
}) as Parameters<typeof getUnifiedItemMetaLabel>[1];

function item(overrides: Partial<UnifiedSkillListItem>): UnifiedSkillListItem {
  return {
    kind: "skill",
    key: "k",
    id: "id",
    title: "title",
    description: null,
    openPath: null,
    searchText: "",
    tags: [],
    supportsTagFilter: true,
    badgeLabel: null,
    scopeLabel: null,
    previewChips: [],
    previewOverflowCount: 0,
    sortName: "title",
    sortPriority: 0,
    ...overrides,
  };
}

function summary(overrides: Partial<EnabledToolsSummary>): EnabledToolsSummary {
  return {
    state: "partial",
    enabledCount: 0,
    totalCount: 0,
    visibleEnabledToolIds: [],
    remainingCount: 0,
    ...overrides,
  };
}

test("getUnifiedItemMetaLabel reports the member count for groups", () => {
  assert.equal(
    getUnifiedItemMetaLabel(item({ kind: "group", memberCount: 3 }), t),
    "3 members",
  );
});

test("getUnifiedItemMetaLabel treats a group with no memberCount as zero", () => {
  assert.equal(getUnifiedItemMetaLabel(item({ kind: "group" }), t), "0 members");
});

test("getUnifiedItemMetaLabel reports no enabled tools when the summary is missing", () => {
  // A skill row can be built before its tool summary is computed, and that must
  // not read as "enabled for all".
  assert.equal(getUnifiedItemMetaLabel(item({}), t), "skills.noToolsEnabled");
});

test("getUnifiedItemMetaLabel distinguishes none / all / partial", () => {
  assert.equal(
    getUnifiedItemMetaLabel(item({ toolSummary: summary({ state: "none" }) }), t),
    "skills.noToolsEnabled",
  );
  assert.equal(
    getUnifiedItemMetaLabel(item({ toolSummary: summary({ state: "all" }) }), t),
    "skills.allEnabled",
  );
  assert.equal(
    getUnifiedItemMetaLabel(
      item({ toolSummary: summary({ state: "partial", enabledCount: 2, totalCount: 5 }) }),
      t,
    ),
    "skills.enableFor 2/5",
  );
});
