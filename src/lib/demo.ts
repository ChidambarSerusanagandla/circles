import { demoGroups, profiles, uid } from "./seed-data";
import type { CreatorInvitation } from "./creators/types";
import type { InboxThread, InboxMessage } from "./inbox/types";
import type {
  AnalyticsEvent,
  Group,
  Message,
  Profile,
  Question,
} from "./types";
import {
  answerInput,
  groupInput,
  groupSettingsInput,
  messageInput,
  questionInput,
  reactionInput,
  requireAdmin,
  requireIdentity,
} from "./rules";
export interface DemoState {
  creatorInvitations?: CreatorInvitation[];
  creatorLinks?: { group_id: string; profile: Profile }[];
  inboxThreads?: InboxThread[];
  inboxMessages?: InboxMessage[];
  user: Profile | null;
  memberships: string[];
  reactions: string[];
  questions: Question[];
  messages: Message[];
  groups: Group[];
  groupSettings?: Record<
    string,
    Pick<Group, "name" | "description" | "category">
  >;
  events: AnalyticsEvent[];
}
export function configureDemoGroup(
  state: DemoState,
  group: Group,
  input: unknown,
): DemoState {
  requireAdmin(
    state.user?.id || null,
    group.admins.map((a) => a.id),
  );
  const settings = groupSettingsInput.parse(input);
  return {
    ...state,
    groupSettings: { ...state.groupSettings, [group.id]: settings },
  };
}
export const initialDemo: DemoState = {
  user: null,
  memberships: [],
  reactions: [],
  messages: [],
  groups: [],
  events: [],
  questions: [
    {
      id: uid(7001),
      group_id: uid(100),
      author_id: profiles[4].id,
      content: "How long have you all lived together?",
      status: "pending",
      created_at: "2026-09-11T11:00:00Z",
    },
    {
      id: uid(7002),
      group_id: uid(100),
      author_id: profiles[8].id,
      content: "Do you actually have a shared grocery list?",
      status: "pending",
      created_at: "2026-09-11T12:00:00Z",
    },
  ],
};
export function hasDemoMembership(state: DemoState, groupId: string) {
  return state.memberships.includes(`${state.user?.id}:${groupId}`);
}
export function demoMemberCount(state: DemoState, groupId: string) {
  return state.memberships.filter((m) => m.endsWith(`:${groupId}`)).length;
}
export function demoReactionCount(
  state: DemoState,
  messageId: string,
  reaction: string,
) {
  return state.reactions.filter((r) => r.endsWith(`:${messageId}:${reaction}`))
    .length;
}
export function joinDemo(state: DemoState, group: Group): DemoState {
  requireIdentity(state.user?.id || null);
  if (hasDemoMembership(state, group.id)) return state;
  return {
    ...state,
    memberships: [...state.memberships, `${state.user!.id}:${group.id}`],
  };
}
export function reactionKey(
  messageId: string,
  reaction: string,
  userId: string,
) {
  return `${userId}:${messageId}:${reaction}`;
}
export function reactDemo(
  state: DemoState,
  messageId: string,
  reaction: string,
): DemoState {
  requireIdentity(state.user?.id || null);
  reactionInput.parse(reaction);
  const key = reactionKey(messageId, reaction, state.user!.id);
  return {
    ...state,
    reactions: state.reactions.includes(key)
      ? state.reactions.filter((r) => r !== key)
      : [...state.reactions, key],
  };
}
export function askDemo(
  state: DemoState,
  groupId: string,
  content: string,
): DemoState {
  requireIdentity(state.user?.id || null);
  if (!hasDemoMembership(state, groupId))
    throw new Error("Join this circle before asking a question.");
  return {
    ...state,
    questions: [
      ...state.questions,
      {
        id: crypto.randomUUID(),
        group_id: groupId,
        author_id: state.user!.id,
        content: questionInput.parse(content),
        status: "pending",
        created_at: new Date().toISOString(),
      },
    ],
  };
}
export function postDemo(
  state: DemoState,
  group: Group,
  content: string,
): DemoState {
  requireAdmin(
    state.user?.id || null,
    group.admins.map((a) => a.id),
  );
  return {
    ...state,
    messages: [
      ...state.messages,
      {
        id: crypto.randomUUID(),
        group_id: group.id,
        author_id: state.user!.id,
        author: state.user!,
        content: messageInput.parse(content),
        created_at: new Date().toISOString(),
        reactions: {},
      },
    ],
  };
}
export function moderateDemo(
  state: DemoState,
  group: Group,
  id: string,
  answer: string | null,
): DemoState {
  requireAdmin(
    state.user?.id || null,
    group.admins.map((a) => a.id),
  );
  const question = state.questions.find(
    (q) => q.id === id && q.group_id === group.id,
  );
  if (!question || question.status !== "pending")
    throw new Error(
      "This question has already been reviewed or is unavailable.",
    );
  const next = {
    ...state,
    questions: state.questions.map((q) =>
      q.id === id
        ? {
            ...q,
            status:
              answer === null ? ("skipped" as const) : ("answered" as const),
          }
        : q,
    ),
  };
  return answer === null
    ? next
    : postDemo(
        next,
        group,
        `A reader asked: ${question.content}\n\n${answerInput.parse(answer)}`,
      );
}
export function createDemo(state: DemoState, input: unknown): DemoState {
  requireIdentity(state.user?.id || null);
  const fields = groupInput.parse(input);
  if ([...demoGroups, ...state.groups].some((g) => g.slug === fields.slug))
    throw new Error("That circle address is already taken.");
  return {
    ...state,
    groups: [
      ...state.groups,
      {
        ...fields,
        id: crypto.randomUUID(),
        access_type: "free",
        monthly_price: null,
        created_by: state.user!.id,
        admins: [state.user!],
        messages: [],
        member_count: 0,
      },
    ],
  };
}
