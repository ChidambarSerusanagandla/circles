import type { Profile } from "../types";
export interface CreatorInvitation {
  id: string;
  group_id: string;
  inviter_id: string;
  invitee_id: string;
  status: "pending" | "accepted" | "declined";
  created_at: string;
}
export interface InvitationView extends CreatorInvitation {
  group_name: string;
  group_slug: string;
  inviter: Profile;
}
