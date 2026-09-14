import { describe, it, expect } from "vitest";
import { demoGroups, profiles } from "../../src/lib/seed-data";
describe("seed integrity", () => { it("provides six readable conversations and valid creator authors", () => { expect(profiles).toHaveLength(10); expect(demoGroups).toHaveLength(6); expect(demoGroups.flatMap(g=>g.messages).length).toBeGreaterThanOrEqual(50); for (const g of demoGroups) { expect(g.admins.length).toBeGreaterThanOrEqual(3); for (const m of g.messages) expect(g.admins.some(a=>a.id===m.author_id)).toBe(true); } }); });
