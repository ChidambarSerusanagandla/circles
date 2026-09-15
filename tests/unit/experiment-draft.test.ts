import { describe, expect, it } from "vitest";
import { makeEvent } from "../../src/lib/analytics/events";
import { funnels } from "../../src/lib/analytics/metrics";
import {
  assignmentForStatus,
  PREVIEW_EXPERIMENT_ID,
  previewLength,
} from "../../src/lib/experiments/assignment";
import { uid } from "../../src/lib/seed-data";

const identity = {
  visitorId: uid(42),
  experimentId: PREVIEW_EXPERIMENT_ID,
};

describe("draft presentation and existing conversion windows", () => {
  it.each(["A", "B"] as const)(
    "shows four messages while preserving the stored %s assignment",
    (variant) => {
      const assignment = assignmentForStatus(identity, "draft", variant);
      expect(assignment).toMatchObject({
        variant,
        displayVariant: "A",
        active: false,
        attributed: true,
      });
      expect(previewLength(assignment.displayVariant!)).toBe(4);
      expect(
        makeEvent(assignment, "group_preview_seen", uid(100), null, false)
          .experiment_id,
      ).toBeNull();
      expect(
        makeEvent(assignment, "group_joined", uid(100), uid(1), false)
          .experiment_variant,
      ).toBe(variant);
    },
  );

  it.each(["draft", "running", "completed"] as const)(
    "does not attribute an unassigned visitor in %s",
    (status) => {
      const assignment = assignmentForStatus(identity, status, null);
      expect(assignment).toMatchObject({
        variant: "A",
        displayVariant: "A",
        active: false,
        attributed: false,
      });
      expect(
        makeEvent(assignment, "group_joined", uid(100), uid(1), false)
          .experiment_id,
      ).toBeNull();
    },
  );

  it("counts a join after returning to Draft without extending the original window", () => {
    const running = assignmentForStatus(identity, "running", "B");
    const draft = assignmentForStatus(identity, "draft", "B");
    const preview = makeEvent(
      running,
      "group_preview_seen",
      uid(100),
      null,
      false,
      uid(1001),
      "2026-09-01T10:00:00Z",
    );
    const baselinePreview = makeEvent(
      draft,
      "group_preview_seen",
      uid(100),
      null,
      false,
      uid(1002),
      "2026-09-07T10:00:00Z",
    );
    const join = makeEvent(
      draft,
      "group_joined",
      uid(100),
      uid(1),
      false,
      uid(1003),
      "2026-09-08T10:00:00Z",
    );
    expect(funnels([preview, baselinePreview, join], false)[1]).toMatchObject({
      visitors: 1,
      joins: 1,
    });
    expect(
      funnels(
        [
          preview,
          baselinePreview,
          { ...join, created_at: "2026-09-08T10:00:01Z" },
        ],
        false,
      )[1].joins,
    ).toBe(0);
  });

  it("resumes the persisted variant when the same experiment restarts", () => {
    const draft = assignmentForStatus(identity, "draft", "B");
    const resumed = assignmentForStatus(identity, "running", draft.variant);
    expect(resumed).toMatchObject({
      ...identity,
      variant: "B",
      displayVariant: "B",
      active: true,
      attributed: true,
    });
    expect(previewLength(resumed.displayVariant!)).toBe(8);
  });
});
