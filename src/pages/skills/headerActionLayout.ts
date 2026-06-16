export type SkillsHeaderActionId =
  | "batch-manage"
  | "batch-configure"
  | "project-bindings"
  | "translate-names"
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
      ? ["batch-manage", "batch-configure"]
      : ["batch-manage", "project-bindings", "translate-names"],
    secondaryActionIds: ["create-skill"],
  };
}
