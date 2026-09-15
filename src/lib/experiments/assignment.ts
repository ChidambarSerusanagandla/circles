import type { Variant } from "../types";
export const PREVIEW_EXPERIMENT_ID = "00000000-0000-4000-8000-000000008000";
export const VISITOR_COOKIE = "circles_visitor";
export type ExperimentStatus = "draft" | "running" | "completed";
export interface Assignment {
  visitorId: string;
  variant: Variant;
  displayVariant?: Variant;
  experimentId: string;
  active: boolean;
  attributed?: boolean;
}
export function assignmentForStatus(
  identity: Pick<Assignment, "visitorId" | "experimentId">,
  status: ExperimentStatus,
  storedVariant: Variant | null,
): Assignment {
  const variant = storedVariant ?? "A";
  return {
    ...identity,
    variant,
    // Draft changes presentation without discarding an existing conversion window.
    displayVariant: status === "draft" ? "A" : variant,
    active: status === "running" && storedVariant !== null,
    attributed: storedVariant !== null,
  };
}
// A random UUID provides the randomization. The versioned salt and hash make
// retries deterministic, including concurrent initial requests and DB outages.
export function variantFor(visitorId: string): Variant {
  let hash = 2166136261;
  for (const char of `preview-v1:${visitorId}`) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 2 === 0 ? "A" : "B";
}
export const previewLength = (variant: Variant) => (variant === "A" ? 4 : 8);
