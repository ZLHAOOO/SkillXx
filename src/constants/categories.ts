import type { SkillCategoryDimension } from "@/types";

// ── Level 1 categories ──────────────────────────────────────────
export interface Level1CategoryDef {
  id: string;
  labelKey: string;
}

export const DEFAULT_LEVEL1_CATEGORIES: Level1CategoryDef[] = [
  { id: "all", labelKey: "skills.categoryAll" },
  { id: "prompt", labelKey: "skills.categoryPrompt" },
  { id: "tool", labelKey: "skills.categoryTool" },
  { id: "knowledge", labelKey: "skills.categoryKnowledge" },
  { id: "skillflow", labelKey: "skills.categorySkillflow" },
];

// ── Default category dimensions (Level 2) ───────────────────────
export const DEFAULT_DIMENSIONS: SkillCategoryDimension[] = [
  {
    id: "scene",
    label: "按场景",
    values: ["编程研发", "商业运营", "内容创意", "办公协作", "教育学习", "生活服务"],
  },
];
