import type { DemoState } from "../demo";
import type { Group } from "../types";
import { demoGroups, profiles } from "../seed-data";
import { ownerProfile, readerProfile } from "../auth/demo-accounts";
import { requireAdmin, requireIdentity } from "../rules";
import { inviteHandleInput } from "./rules";
export const demoPeople = [...profiles, readerProfile, ownerProfile];
export function applyDemoGroup(state: DemoState, group: Group): Group {
  const admins = new Map(group.admins.map((p) => [p.id, p]));
  for (const link of state.creatorLinks || [])
    if (link.group_id === group.id) admins.set(link.profile.id, link.profile);
  return {
    ...group,
    ...state.groupSettings?.[group.id],
    admins: [...admins.values()],
  };
}
export function inviteDemoCreator(
  state: DemoState,
  group: Group,
  handle: string,
): DemoState {
  const effective = applyDemoGroup(state, group);
  requireAdmin(
    state.user?.id || null,
    effective.admins.map((p) => p.id),
  );
  const normalized = inviteHandleInput.parse(handle);
  const person = demoPeople.find((p) => p.handle === normalized);
  if (!person) throw new Error("No account has that handle.");
  if (effective.admins.some((p) => p.id === person.id))
    throw new Error("This person is already a creator.");
  const invitations = state.creatorInvitations || [];
  if (
    invitations.some(
      (i) =>
        i.group_id === group.id &&
        i.invitee_id === person.id &&
        i.status === "pending",
    )
  )
    throw new Error("An invitation is already pending for this person.");
  return {
    ...state,
    creatorInvitations: [
      ...invitations,
      {
        id: crypto.randomUUID(),
        group_id: group.id,
        inviter_id: state.user!.id,
        invitee_id: person.id,
        status: "pending",
        created_at: new Date().toISOString(),
      },
    ],
  };
}
export function respondDemoInvitation(
  state: DemoState,
  id: string,
  accept: boolean,
): DemoState {
  requireIdentity(state.user?.id || null);
  const invitation = state.creatorInvitations?.find(
    (i) =>
      i.id === id && i.invitee_id === state.user!.id && i.status === "pending",
  );
  if (!invitation)
    throw new Error("This invitation is unavailable or already answered.");
  const group = [...demoGroups, ...state.groups].find(
    (g) => g.id === invitation.group_id,
  );
  if (!group) throw new Error("This group is unavailable.");
  if (
    accept &&
    !applyDemoGroup(state, group).admins.some(
      (p) => p.id === invitation.inviter_id,
    )
  )
    throw new Error("The inviter is no longer a creator of this group.");
  return {
    ...state,
    creatorInvitations: state.creatorInvitations!.map((i) =>
      i.id === id ? { ...i, status: accept ? "accepted" : "declined" } : i,
    ),
    creatorLinks: accept
      ? [
          ...(state.creatorLinks || []).filter(
            (l) =>
              !(
                l.group_id === invitation.group_id &&
                l.profile.id === state.user!.id
              ),
          ),
          { group_id: invitation.group_id, profile: state.user! },
        ]
      : state.creatorLinks,
  };
}
