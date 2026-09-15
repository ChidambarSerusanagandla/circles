import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { DEMO_MODE } from "../config";
import { analyticsDatabase } from "../supabase/admin";
import {
  PREVIEW_EXPERIMENT_ID,
  variantFor,
  VISITOR_COOKIE,
  assignmentForStatus,
  type Assignment,
  type ExperimentStatus,
} from "./assignment";
import { readVisitor, visitorSecret } from "./visitor";
import { demoExperimentStatus } from "../auth/demo-server";
export const getAssignment = cache(async (): Promise<Assignment> => {
  const visitorId =
    readVisitor(
      (await cookies()).get(VISITOR_COOKIE)?.value,
      DEMO_MODE ? undefined : visitorSecret(),
    ) || crypto.randomUUID();
  const fallback: Assignment = {
    visitorId,
    variant: variantFor(visitorId),
    experimentId: PREVIEW_EXPERIMENT_ID,
    active: true,
  };
  if (DEMO_MODE) {
    const status = await demoExperimentStatus();
    return assignmentForStatus(
      fallback,
      status,
      status === "draft" ? null : fallback.variant,
    );
  }
  try {
    const db = analyticsDatabase();
    const { data: experiment, error: expError } = await db
      .from("experiments")
      .select("status")
      .eq("id", PREVIEW_EXPERIMENT_ID)
      .single();
    if (expError) throw expError;
    const status = experiment.status as ExperimentStatus;
    if (status === "running") {
      const { error } = await db.from("experiment_assignments").upsert(
        {
          experiment_id: PREVIEW_EXPERIMENT_ID,
          anonymous_session_id: visitorId,
          variant: fallback.variant,
        },
        {
          onConflict: "experiment_id,anonymous_session_id",
          ignoreDuplicates: true,
        },
      );
      if (error) throw error;
    }
    const { data, error } = await db
      .from("experiment_assignments")
      .select("variant")
      .eq("experiment_id", PREVIEW_EXPERIMENT_ID)
      .eq("anonymous_session_id", visitorId)
      .maybeSingle();
    if (error) throw error;
    // Existing assignments keep their attribution after enrollment stops, so
    // their already-started seven-day conversion windows can mature.
    return assignmentForStatus(
      fallback,
      status,
      data?.variant === "B" ? "B" : data?.variant === "A" ? "A" : null,
    );
  } catch {
    console.warn(
      "Experiment unavailable; serving the baseline without new experimental exposure.",
    );
    return {
      ...fallback,
      variant: "A",
      displayVariant: "A",
      active: false,
      attributed: false,
    };
  }
});
