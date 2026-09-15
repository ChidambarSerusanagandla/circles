import type { DemoState } from "../demo";
import { profiles } from "../seed-data";
import { ownerProfile, readerProfile } from "../auth/demo-accounts";
import { requireIdentity } from "../rules";
import { inboxContent, inboxHandle, participantPair } from "./rules";
import type { InboxMessage, InboxThreadView } from "./types";

export const inboxPeople = [...profiles, ownerProfile, readerProfile];
export function demoInboxThreads(state: DemoState): InboxThreadView[] {
  if (!state.user) return [];
  return (state.inboxThreads || [])
    .filter((thread) =>
      [thread.participant_low, thread.participant_high].includes(
        state.user!.id,
      ),
    )
    .map((thread) => ({
      ...thread,
      peer: inboxPeople.find(
        (person) =>
          person.id ===
          (thread.participant_low === state.user!.id
            ? thread.participant_high
            : thread.participant_low),
      )!,
    }))
    .filter((thread) => !!thread.peer)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}
export function startDemoThread(
  state: DemoState,
  handle: unknown,
): { state: DemoState; threadId: string } {
  requireIdentity(state.user?.id || null);
  const target = inboxHandle.parse(handle);
  const peer = inboxPeople.find((person) => person.handle === target);
  if (!peer) throw new Error("No person found with that handle.");
  const [participant_low, participant_high] = participantPair(
    state.user!.id,
    peer.id,
  );
  const existing = (state.inboxThreads || []).find(
    (thread) =>
      thread.participant_low === participant_low &&
      thread.participant_high === participant_high,
  );
  if (existing) return { state, threadId: existing.id };
  const created_at = new Date().toISOString();
  const thread = {
    id: crypto.randomUUID(),
    participant_low,
    participant_high,
    created_at,
    updated_at: created_at,
  };
  return {
    state: { ...state, inboxThreads: [...(state.inboxThreads || []), thread] },
    threadId: thread.id,
  };
}
export function sendDemoMessage(
  state: DemoState,
  threadId: string,
  input: unknown,
): DemoState {
  requireIdentity(state.user?.id || null);
  if (!demoInboxThreads(state).some((thread) => thread.id === threadId))
    throw new Error("This conversation is unavailable.");
  const content = inboxContent.parse(input);
  const message: InboxMessage = {
    id: crypto.randomUUID(),
    thread_id: threadId,
    sender_id: state.user!.id,
    content,
    created_at: new Date().toISOString(),
  };
  return {
    ...state,
    inboxMessages: [...(state.inboxMessages || []), message],
    inboxThreads: (state.inboxThreads || []).map((thread) =>
      thread.id === threadId
        ? { ...thread, updated_at: message.created_at }
        : thread,
    ),
  };
}
export function demoInboxMessages(
  state: DemoState,
  threadId: string,
): InboxMessage[] {
  if (!demoInboxThreads(state).some((thread) => thread.id === threadId))
    return [];
  return (state.inboxMessages || [])
    .filter((message) => message.thread_id === threadId)
    .sort(
      (a, b) =>
        a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
    );
}
