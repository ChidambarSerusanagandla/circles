import { z } from "zod";
import type { AnalyticsEvent, EventName } from "../types";
import type { Assignment } from "../experiments/assignment";
export const browserEventInput = z
  .object({
    id: z.uuid(),
    name: z.enum(["discover_viewed", "group_preview_seen", "group_opened"]),
    groupId: z.uuid().optional(),
    renderedVariant: z.enum(["A", "B"]).optional(),
    experimental: z.boolean().optional(),
  })
  .strict()
  .superRefine((event, ctx) => {
    if (
      event.name === "group_preview_seen" &&
      (event.experimental === undefined || !event.renderedVariant)
    )
      ctx.addIssue({
        code: "custom",
        message: "Rendered preview context is required.",
        path: ["experimental"],
      });
    if (event.name !== "discover_viewed" && !event.groupId)
      ctx.addIssue({
        code: "custom",
        message: "A circle is required.",
        path: ["groupId"],
      });
  });
export function makeEvent(
  assignment: Assignment,
  name: EventName,
  groupId: string | null,
  userId: string | null,
  isDemo: boolean,
  id = crypto.randomUUID(),
  occurredAt = new Date().toISOString(),
): AnalyticsEvent {
  const outcome =
    name === "group_opened" ||
    name === "group_joined" ||
    name === "reaction_added" ||
    name === "question_submitted";
  const attributed = assignment.active || (assignment.attributed && outcome);
  return {
    id,
    user_id: userId,
    anonymous_session_id: assignment.visitorId,
    group_id: groupId,
    event_name: name,
    experiment_id: attributed ? assignment.experimentId : null,
    experiment_variant: attributed ? assignment.variant : null,
    metadata: {},
    created_at: occurredAt,
    is_demo: isDemo,
  };
}
export async function bestEffort(
  operation: () => Promise<unknown>,
): Promise<void> {
  try {
    await operation();
  } catch {
    console.warn(
      "Analytics delivery failed; product action remains successful.",
    );
  }
}
