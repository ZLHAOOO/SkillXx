/**
 * Shared helpers for treating multiple Hermes profiles as one logical
 * "Hermes" group. Used by the Tools page (agent card merging) and the
 * Skills page (tool icon row merging), so the visual rule lives in
 * one place.
 */

/** True if `toolId` is the base `hermes` entry or any `hermes-<profile>`. */
export function isHermesToolId(toolId: string): boolean {
  return toolId === "hermes" || toolId.startsWith("hermes-");
}

/** A single renderable entry in a tool-icon row. */
export type ToolIconUnit =
  | { kind: "single"; toolId: string }
  | { kind: "hermesGroup"; toolIds: string[] };

/**
 * Collapse runs of Hermes tool ids into a single `hermesGroup` unit.
 * Preserves the original relative order so the preview stays stable.
 *
 *   [claude, hermes-tianxuan, hermes-tianshu, cursor]
 *     -> [single(claude), hermesGroup(2), single(cursor)]
 *
 * A single isolated Hermes id (e.g. only `hermes` enabled) still
 * becomes a one-element `hermesGroup` so the UI consistently treats
 * "any Hermes" as a group — this keeps badge semantics simple.
 */
export function groupToolIdsForDisplay(toolIds: string[]): ToolIconUnit[] {
  const result: ToolIconUnit[] = [];
  let hermesRun: string[] = [];
  const flushHermes = () => {
    if (hermesRun.length > 0) {
      result.push({ kind: "hermesGroup", toolIds: hermesRun });
      hermesRun = [];
    }
  };
  for (const id of toolIds) {
    if (isHermesToolId(id)) {
      hermesRun.push(id);
    } else {
      flushHermes();
      result.push({ kind: "single", toolId: id });
    }
  }
  flushHermes();
  return result;
}
