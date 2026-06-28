export type SkillsHeaderActionId =
  | "batch-manage"
  | "batch-configure"
  | "batch-category"
  | "batch-tag"
  | "batch-delete"
  | "project-bindings"
  | "create-skill";

export interface SkillsHeaderActionLayout {
  primaryActionIds: SkillsHeaderActionId[];
  secondaryActionIds: SkillsHeaderActionId[];
}

export function buildSkillsHeaderActionLayout(
  isBatchManageMode: boolean,
): SkillsHeaderActionLayout {
  return {
    primaryActionIds: isBatchManageMode
      ? ["batch-manage", "batch-category", "batch-tag", "batch-configure", "batch-delete"]
      : ["batch-manage", "project-bindings"],
    secondaryActionIds: ["create-skill"],
  };
}
