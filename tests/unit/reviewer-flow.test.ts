import { describe, expect, it } from "vitest";
import {
  createDemo,
  demoMemberCount,
  demoReactionCount,
  hasDemoMembership,
  initialDemo,
  joinDemo,
  reactDemo,
} from "../../src/lib/demo";
import { demoGroups, profiles } from "../../src/lib/seed-data";
import { safeReturnPath } from "../../src/lib/return-path";
import { browserEventInput, makeEvent } from "../../src/lib/analytics/events";
import { PREVIEW_EXPERIMENT_ID } from "../../src/lib/experiments/assignment";
describe("reviewer flow regressions", () => {
  it("keeps totals stable while participation remains account-specific", () => {
    const g = demoGroups[0],
      m = g.messages[0];
    let state = joinDemo({ ...initialDemo, user: profiles[0] }, g);
    state = reactDemo(state, m.id, "❤️");
    state = { ...state, user: profiles[1] };
    expect(hasDemoMembership(state, g.id)).toBe(false);
    expect(demoMemberCount(state, g.id)).toBe(1);
    expect(demoReactionCount(state, m.id, "❤️")).toBe(1);
    state = joinDemo(state, g);
    state = reactDemo(state, m.id, "❤️");
    expect(demoMemberCount(state, g.id)).toBe(2);
    expect(demoReactionCount({ ...state, user: null }, m.id, "❤️")).toBe(2);
  });
  it("prevents duplicate group slugs against seeded and locally created circles", () => {
    const state = { ...initialDemo, user: profiles[0] };
    const fields = {
      name: "New circle",
      slug: "new-circle",
      description: "A new place to talk with friends.",
      category: "Friendship",
    };
    const next = createDemo(state, fields);
    expect(next.groups[0].admins[0].id).toBe(profiles[0].id);
    expect(() => createDemo(next, fields)).toThrow("taken");
    expect(() =>
      createDemo(state, { ...fields, slug: demoGroups[0].slug }),
    ).toThrow("taken");
  });
  it("accepts only an explicit allowlist of local return destinations", () => {
    expect(safeReturnPath("/groups/roommates-after-midnight")).toBe(
      "/groups/roommates-after-midnight",
    );
    for (const path of [
      "https://evil.test",
      "//evil.test",
      "/\\evil.test",
      "/groups/../admin",
      "/profile?next=https://evil.test",
      undefined,
    ])
      expect(safeReturnPath(path)).toBeUndefined();
  });
  it("requires the rendered preview context and preserves an inactive render after recovery", () => {
    const input = {
      id: crypto.randomUUID(),
      name: "group_preview_seen",
      groupId: demoGroups[0].id,
    };
    expect(browserEventInput.safeParse(input).success).toBe(false);
    expect(
      browserEventInput.safeParse({
        ...input,
        renderedVariant: "A",
        experimental: false,
      }).success,
    ).toBe(true);
    const recovered = {
      visitorId: crypto.randomUUID(),
      variant: "B" as const,
      experimentId: PREVIEW_EXPERIMENT_ID,
      active: true,
    };
    const rendered = { ...recovered, active: false, attributed: false };
    expect(
      makeEvent(rendered, "group_preview_seen", input.groupId, null, false)
        .experiment_id,
    ).toBeNull();
  });
});
