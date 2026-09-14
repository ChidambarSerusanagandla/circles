import type { Variant } from "../types";
export const PREVIEW_EXPERIMENT_ID = "00000000-0000-4000-8000-000000008000";
export const VISITOR_COOKIE = "circles_visitor";
export interface Assignment {
  visitorId: string;
  variant: Variant;
  experimentId: string;
  active: boolean;
  attributed?: boolean;
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
