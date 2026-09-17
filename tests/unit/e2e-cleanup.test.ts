import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createCleanupClient,
  isOwnedGroup,
  isOwnedInboxMessage,
  planCleanup,
  TEST_DESCRIPTION,
} from "../../scripts/e2e/cleanup.mjs";

const actors = {
  creator: "00000000-0000-4000-8000-000000000001",
  viewer: "00000000-0000-4000-8000-000000000011",
  arjun: "00000000-0000-4000-8000-000000000002",
  priya: "00000000-0000-4000-8000-000000000003",
  internal: "00000000-0000-4000-8000-000000000012",
};
const group = {
  id: "00000000-0000-4000-8000-000000020000",
  name: "E2E Creator team desktop abcdef12",
  slug: "e2e-creator-team-desktop-abcdef12",
  description: TEST_DESCRIPTION,
  created_by: actors.creator,
  is_demo: false,
};
const thread = {
  participant_low: actors.creator,
  participant_high: actors.viewer,
};
const message = {
  content: "E2E Private hello mobile abcdef12",
  sender_id: actors.viewer,
};
afterEach(() => vi.unstubAllEnvs());

describe("connected E2E cleanup ownership guards", () => {
  it("requires all historical group markers to match", () => {
    expect(isOwnedGroup(group, actors.creator, undefined)).toBe(true);
  });
  it.each([
    { name: "E2E A real group desktop abcdef12" },
    { name: "E2E Creator team desktop abcdef12 extra" },
    { name: "E2E Creator team desktop not-a-test" },
    { slug: "my-real-circle" },
    { description: "A real creator's circle using a similar name." },
    { created_by: actors.viewer },
    { is_demo: true },
    { is_demo: undefined },
    { id: "00000000-0000-4000-8000-000000000100" },
  ])("preserves a group when this marker differs: %j", (change) => {
    expect(
      isOwnedGroup({ ...group, ...change }, actors.creator, undefined),
    ).toBe(false);
  });
  it.each(["Creator team", "Reader questions", "Viewer loop"])(
    "accepts the exact %s pattern with a new run marker",
    (label) => {
      const name = `E2E ${label} mobile 0123456789ab-abcdef12`;
      expect(
        isOwnedGroup(
          {
            ...group,
            name,
            slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          },
          actors.creator,
          [name],
        ),
      ).toBe(true);
    },
  );
  it("limits new-run cleanup to exact names in its journal", () => {
    expect(isOwnedGroup(group, actors.creator, [])).toBe(false);
    expect(isOwnedGroup(group, actors.creator, [group.name + "suffix"])).toBe(
      false,
    );
    expect(isOwnedGroup(group, actors.creator, [group.name])).toBe(true);
  });
  it("requires the intended private conversation and expected sender", () => {
    expect(isOwnedInboxMessage(message, thread, actors, undefined)).toBe(true);
    expect(
      isOwnedInboxMessage(
        message,
        { ...thread, participant_high: actors.internal },
        actors,
        undefined,
      ),
    ).toBe(false);
    expect(
      isOwnedInboxMessage(
        { ...message, sender_id: actors.creator },
        thread,
        actors,
        undefined,
      ),
    ).toBe(false);
    expect(isOwnedInboxMessage(message, undefined, actors, undefined)).toBe(
      false,
    );
  });
  it("never treats a broad E2E prefix or unrelated journal text as ownership", () => {
    expect(
      isOwnedInboxMessage(
        { ...message, content: "E2E please read my genuine message" },
        thread,
        actors,
        undefined,
      ),
    ).toBe(false);
    expect(isOwnedInboxMessage(message, thread, actors, [])).toBe(false);
    expect(
      isOwnedInboxMessage(message, thread, actors, [message.content]),
    ).toBe(true);
  });
  it("requires a creator sender for private replies", () => {
    const reply = {
      content: "E2E Private reply desktop abcdef12",
      sender_id: actors.creator,
    };
    expect(isOwnedInboxMessage(reply, thread, actors, undefined)).toBe(true);
    expect(
      isOwnedInboxMessage(
        { ...reply, sender_id: actors.viewer },
        thread,
        actors,
        undefined,
      ),
    ).toBe(false);
  });
});

describe("cleanup fails closed before database access", () => {
  it("rejects a different project without disclosing its service key", () => {
    vi.stubEnv(
      "NEXT_PUBLIC_SUPABASE_URL",
      "https://aaaaaaaaaaaaaaaaaaaa.supabase.co",
    );
    vi.stubEnv(
      "SUPABASE_SERVICE_ROLE_KEY",
      "unit-test-private-key-never-display",
    );
    expect(() => createCleanupClient("bbbbbbbbbbbbbbbbbbbb")).toThrow(
      "project ref does not match",
    );
  });
  it("requires explicit project confirmation", () => {
    expect(() => createCleanupClient("")).toThrow("explicit 20-character");
  });
  it.each([
    {},
    { projectRef: "aaaaaaaaaaaaaaaaaaaa", groupNames: [], inboxTexts: [] },
    {
      projectRef: "aaaaaaaaaaaaaaaaaaaa",
      groupNames: [],
      inboxTexts: [],
      visitorIds: ["not-a-uuid"],
    },
    {
      projectRef: "aaaaaaaaaaaaaaaaaaaa",
      legacy: true,
      visitorIds: [actors.viewer],
    },
  ])("rejects incomplete or unsafe journal options %j", async (options) => {
    await expect(planCleanup({}, options)).rejects.toThrow();
  });
});
