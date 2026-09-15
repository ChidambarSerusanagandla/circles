import { describe, expect, it } from "vitest";
import { initialDemo } from "../../src/lib/demo";
import { profiles, uid } from "../../src/lib/seed-data";
import {
  demoInboxMessages,
  demoInboxThreads,
  sendDemoMessage,
  startDemoThread,
} from "../../src/lib/inbox/demo";
import {
  inboxContent,
  inboxHandle,
  participantPair,
} from "../../src/lib/inbox/rules";

describe("private Inbox business rules", () => {
  it("normalizes a handle without accepting invalid handles", () => {
    expect(inboxHandle.parse(" @Rahul ")).toBe("rahul");
    expect(() => inboxHandle.parse("not a handle")).toThrow();
  });
  it("uses one stable pair regardless of who starts a conversation", () => {
    expect(participantPair(uid(2), uid(1))).toEqual(
      participantPair(uid(1), uid(2)),
    );
    const first = startDemoThread(
      { ...initialDemo, user: profiles[0] },
      "@arjun",
    );
    const second = startDemoThread(
      { ...first.state, user: profiles[1] },
      "@rahul",
    );
    expect(second.threadId).toBe(first.threadId);
    expect(second.state.inboxThreads).toHaveLength(1);
  });
  it("requires identity, an existing handle, and another person", () => {
    expect(() => startDemoThread(initialDemo, "rahul")).toThrow();
    expect(() =>
      startDemoThread({ ...initialDemo, user: profiles[0] }, "rahul"),
    ).toThrow(/another person/);
    expect(() =>
      startDemoThread({ ...initialDemo, user: profiles[0] }, "no_such_person"),
    ).toThrow(/No person/);
  });
  it("keeps messages and threads visible to the two participants only", () => {
    const started = startDemoThread(
      { ...initialDemo, user: profiles[0] },
      "arjun",
    );
    const sent = sendDemoMessage(
      started.state,
      started.threadId,
      " Hello Arjun! ",
    );
    expect(demoInboxMessages(sent, started.threadId)[0].content).toBe(
      "Hello Arjun!",
    );
    const recipient = { ...sent, user: profiles[1] };
    expect(demoInboxThreads(recipient)).toHaveLength(1);
    expect(demoInboxMessages(recipient, started.threadId)).toHaveLength(1);
    const stranger = { ...sent, user: profiles[2] };
    expect(demoInboxThreads(stranger)).toHaveLength(0);
    expect(demoInboxMessages(stranger, started.threadId)).toHaveLength(0);
    expect(() =>
      sendDemoMessage(stranger, started.threadId, "Intrusion"),
    ).toThrow(/unavailable/);
  });
  it("does not accept empty or oversized messages", () => {
    expect(() => inboxContent.parse("  ")).toThrow();
    expect(() => inboxContent.parse("a".repeat(2001))).toThrow();
    expect(inboxContent.parse("a".repeat(2000))).toHaveLength(2000);
  });
});
