import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { DEMO_MODE } from "../config";
import { analyticsDatabase } from "../supabase/admin";
import { PREVIEW_EXPERIMENT_ID, variantFor, VISITOR_COOKIE, type Assignment } from "./assignment";
import { readVisitor, visitorSecret } from "./visitor";
export const getAssignment = cache(async (): Promise<Assignment> => {
  const visitorId = readVisitor((await cookies()).get(VISITOR_COOKIE)?.value, DEMO_MODE ? undefined : visitorSecret()) || crypto.randomUUID();
  const fallback: Assignment = { visitorId, variant: variantFor(visitorId), experimentId: PREVIEW_EXPERIMENT_ID, active: true };
  if (DEMO_MODE) return fallback;
  try {
    const db = analyticsDatabase();
    const { data: experiment, error: expError } = await db.from("experiments").select("status").eq("id", PREVIEW_EXPERIMENT_ID).single();
    if (expError) throw expError;
    const active = experiment.status === "running";
    if (active) {
      const { error } = await db.from("experiment_assignments").upsert({ experiment_id: PREVIEW_EXPERIMENT_ID, anonymous_session_id: visitorId, variant: fallback.variant }, { onConflict: "experiment_id,anonymous_session_id", ignoreDuplicates: true });
      if (error) throw error;
    }
    const { data, error } = await db.from("experiment_assignments").select("variant").eq("experiment_id", PREVIEW_EXPERIMENT_ID).eq("anonymous_session_id", visitorId).maybeSingle();
    if (error) throw error;
    // Existing assignments keep their attribution after enrollment stops, so
    // their already-started seven-day conversion windows can mature.
    return { ...fallback, active, attributed: Boolean(data), variant: data?.variant === "B" ? "B" : "A" };
  } catch {
    console.warn("Experiment unavailable; serving the baseline without new experimental exposure.");
    return { ...fallback, variant: "A", active: false, attributed: false };
  }
});
