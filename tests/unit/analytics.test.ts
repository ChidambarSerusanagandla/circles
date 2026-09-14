import { describe, expect, it, vi } from "vitest";
import {
  bestEffort,
  browserEventInput,
  makeEvent,
} from "../../src/lib/analytics/events";
import {
  funnels,
  creatorMetrics,
  rate,
  lift,
} from "../../src/lib/analytics/metrics";
import { sampleEvents } from "../../src/lib/analytics/sample";
import {
  PREVIEW_EXPERIMENT_ID,
  variantFor,
  previewLength,
} from "../../src/lib/experiments/assignment";
import { uid } from "../../src/lib/seed-data";
const assignment = {
  visitorId: uid(10000),
  variant: "A" as const,
  experimentId: PREVIEW_EXPERIMENT_ID,
  active: true,
};
describe("first-party analytics", () => {
  it("creates a timestamped event with explicit identity and source", () => {
    expect(
      makeEvent(assignment, "group_opened", uid(100), null, false),
    ).toMatchObject({
      anonymous_session_id: assignment.visitorId,
      experiment_variant: "A",
      user_id: null,
      is_demo: false,
    });
  });
  it("refuses client-authored joins, identities and variants", () => {
    expect(
      browserEventInput.safeParse({
        id: uid(12),
        name: "group_joined",
        groupId: uid(100),
      }).success,
    ).toBe(false);
    expect(
      browserEventInput.safeParse({
        id: uid(12),
        name: "group_opened",
        groupId: uid(100),
        user_id: uid(1),
      }).success,
    ).toBe(false);
    expect(
      browserEventInput.safeParse({ id: uid(12), name: "group_preview_seen" })
        .success,
    ).toBe(false);
  });
  it("never fails a successful product action because analytics failed", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(
      bestEffort(async () => {
        throw new Error("Database unavailable");
      }),
    ).resolves.toBeUndefined();
    warning.mockRestore();
  });
  it("produces the stated simulated experiment results", () => {
    const result = funnels(sampleEvents(), true);
    expect(result).toEqual([
      { variant: "A", visitors: 1000, opens: 326, joins: 112 },
      { variant: "B", visitors: 1000, opens: 401, joins: 147 },
    ]);
    expect(lift(result[0], result[1]).absolute).toBeCloseTo(0.035);
    expect(lift(result[0], result[1]).relative).toBeCloseTo(0.3125);
  });
  it("does not mix simulated history into measured traffic", () =>
    expect(funnels(sampleEvents(), false).every((v) => v.visitors === 0)).toBe(
      true,
    ));
  it("handles empty and zero-baseline funnels", () => {
    expect(rate(0, 0)).toBe(0);
    expect(
      lift(
        { variant: "A", visitors: 0, opens: 0, joins: 0 },
        { variant: "B", visitors: 1, opens: 1, joins: 1 },
      ).relative,
    ).toBeNull();
  });
  it("deduplicates visitors and excludes wrong groups, pre-exposure and late joins", () => {
    const preview = {
      ...makeEvent(assignment, "group_preview_seen", uid(100), null, false),
      created_at: "2026-09-01T10:00:00Z",
    };
    const join = {
      ...preview,
      id: uid(600),
      event_name: "group_joined" as const,
      created_at: "2026-09-02T10:00:00Z",
    };
    expect(funnels([preview, preview, join, join], false)[0]).toMatchObject({
      visitors: 1,
      joins: 1,
    });
    for (const change of [
      { group_id: uid(101) },
      { created_at: "2026-08-30T10:00:00Z" },
      { created_at: "2026-09-08T10:00:01Z" },
    ])
      expect(funnels([preview, { ...join, ...change }], false)[0].joins).toBe(
        0,
      );
    expect(
      funnels(
        [preview, { ...join, created_at: "2026-09-08T10:00:00Z" }],
        false,
      )[0].joins,
    ).toBe(1);
    expect(creatorMetrics([preview, join], uid(100), false).joins).toBe(0);
  });
});
describe("persistent experiment assignment", () => {
  it("remains stable for the same visitor before and after authentication", () => {
    expect(variantFor(uid(10))).toBe(variantFor(uid(10)));
    const event = makeEvent(
      { ...assignment, variant: variantFor(uid(10)) },
      "group_joined",
      uid(100),
      uid(1),
      false,
    );
    expect(event.experiment_variant).toBe(variantFor(uid(10)));
  });
  it("assigns both arms in an approximately even split", () => {
    const a = Array.from({ length: 10000 }, (_, i) =>
      variantFor(uid(i)),
    ).filter((v) => v === "A").length;
    expect(a).toBeGreaterThan(4500);
    expect(a).toBeLessThan(5500);
  });
  it("changes only the number of messages", () => {
    expect(previewLength("A")).toBe(4);
    expect(previewLength("B")).toBe(8);
  });
});
