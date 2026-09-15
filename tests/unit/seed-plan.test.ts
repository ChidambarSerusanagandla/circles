import { describe, expect, it } from "vitest";
import { seedPlan, seedPeople } from "../../src/lib/seed-plan";
import { uid } from "../../src/lib/seed-data";
import { funnels } from "../../src/lib/analytics/metrics";
describe("repeatable connected seed", () => {
  it("contains relationally valid authored content and memberships", () => {
    const p = seedPlan();
    expect(p.profiles).toHaveLength(12);
    expect(p.groups).toHaveLength(6);
    expect(p.messages).toHaveLength(60);
    expect(p.admins).toHaveLength(18);
    expect(p.memberships).toHaveLength(60);
    expect(p.reactions.length).toBeGreaterThan(50);
    for (const message of p.messages)
      expect(
        p.admins.some(
          (a) =>
            a.group_id === message.group_id &&
            a.profile_id === message.author_id,
        ),
      ).toBe(true);
    for (const q of p.questions)
      expect(
        p.memberships.some(
          (m) => m.group_id === q.group_id && m.profile_id === q.author_id,
        ),
      ).toBe(true);
  });
  it("maps fictional profile IDs onto real Auth account IDs", () => {
    const mapping = new Map(seedPeople.map((p, i) => [p.id, uid(i + 40000)]));
    const plan = seedPlan(mapping);
    expect(plan.groups[0].created_by).toBe(uid(40000));
    expect(plan.messages[0].author_id).toBe(uid(40000));
    expect(() => seedPlan(new Map())).toThrow("mapping");
  });
  it("keeps simulation explicit and stable across reruns", () => {
    const a = seedPlan(),
      b = seedPlan();
    expect(a.events).toEqual(b.events);
    expect(a.assignments).toHaveLength(2000);
    expect(a.groups.every((g) => g.is_demo)).toBe(true);
    expect(a.events.every((e) => e.is_demo)).toBe(true);
    expect(new Set(a.events.map((e) => e.dedupe_key)).size).toBe(
      a.events.length,
    );
    expect(funnels(a.events, false).every((f) => f.visitors === 0)).toBe(true);
  });
});
