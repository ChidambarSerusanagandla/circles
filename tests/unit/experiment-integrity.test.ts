import { describe, expect, it } from "vitest";
import { makeEvent } from "../../src/lib/analytics/events";
import { creatorMetrics, funnels } from "../../src/lib/analytics/metrics";
import { PREVIEW_EXPERIMENT_ID } from "../../src/lib/experiments/assignment";
import { readVisitor, signVisitor } from "../../src/lib/experiments/visitor";
import { uid } from "../../src/lib/seed-data";
const assignment = {
  visitorId: uid(10),
  variant: "B" as const,
  experimentId: PREVIEW_EXPERIMENT_ID,
  active: true,
};
const time = "2026-09-01T10:00:00Z";
describe("experiment integrity", () => {
  it("rejects forged, malformed and incorrectly signed live visitor cookies", () => {
    const secret = "local-test-secret-of-at-least-32-characters";
    const signed = signVisitor(uid(10), secret);
    expect(readVisitor(signed, secret)).toBe(uid(10));
    for (const value of [
      uid(10),
      signed.replace(uid(10), uid(11)),
      signed + ".extra",
      signed.slice(0, -1),
      undefined,
    ])
      expect(readVisitor(value, secret)).toBeNull();
    expect(readVisitor(signed, "a-different-key")).toBeNull();
    expect(readVisitor(uid(10))).toBe(uid(10));
  });
  it("retains attribution for existing conversions after enrollment stops", () => {
    const stopped = { ...assignment, active: false, attributed: true };
    const preview = makeEvent(
      assignment,
      "group_preview_seen",
      uid(100),
      null,
      false,
      uid(1001),
      time,
    );
    const joined = makeEvent(
      stopped,
      "group_joined",
      uid(100),
      uid(1),
      false,
      uid(1002),
      "2026-09-02T10:00:00Z",
    );
    expect(funnels([preview, joined], false)[1].joins).toBe(1);
    expect(
      makeEvent(stopped, "group_preview_seen", uid(100), null, false)
        .experiment_id,
    ).toBeNull();
    expect(
      makeEvent(
        { ...stopped, attributed: false },
        "group_joined",
        uid(100),
        uid(1),
        false,
      ).experiment_id,
    ).toBeNull();
  });
  it("preserves receipt time when async event processing finishes out of order", () => {
    const open = makeEvent(
      assignment,
      "group_opened",
      uid(100),
      null,
      false,
      uid(1002),
      "2026-09-01T10:00:02Z",
    );
    const delayedPreview = makeEvent(
      assignment,
      "group_preview_seen",
      uid(100),
      null,
      false,
      uid(1001),
      time,
    );
    expect(funnels([open, delayedPreview], false)[1]).toMatchObject({
      visitors: 1,
      opens: 1,
    });
    expect(delayedPreview.created_at).toBe(time);
  });
  it("excludes other experiments but allows creator funnels across tag changes", () => {
    const preview = makeEvent(
      assignment,
      "group_preview_seen",
      uid(100),
      null,
      false,
      uid(1001),
      time,
    );
    const unrelated = {
      ...preview,
      experiment_id: uid(8999),
      anonymous_session_id: uid(11),
    };
    expect(funnels([preview, unrelated], false)[1].visitors).toBe(1);
    const noExperiment = { ...assignment, active: false };
    const open = makeEvent(
      noExperiment,
      "group_opened",
      uid(100),
      null,
      false,
      uid(1002),
      "2026-09-01T10:01:00Z",
    );
    const join = makeEvent(
      noExperiment,
      "group_joined",
      uid(100),
      uid(1),
      false,
      uid(1003),
      "2026-09-01T10:02:00Z",
    );
    expect(
      creatorMetrics([preview, open, join], uid(100), false),
    ).toMatchObject({ previews: 1, opens: 1, joins: 1 });
  });
});
