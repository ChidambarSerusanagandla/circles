import "server-only";
import { DEMO_MODE } from "../config";
import { getUser } from "../data";
import { supabase } from "../supabase/server";
import type { CreatorInvitation, InvitationView } from "./types";
export async function getCreatorInvitations(): Promise<InvitationView[]> {
  if (DEMO_MODE) return [];
  const user = await getUser();
  if (!user) return [];
  const db = await supabase();
  const { data, error } = await db
    .from("creator_invitations")
    .select("*")
    .eq("invitee_id", user.id)
    .eq("status", "pending")
    .order("created_at")
    .limit(100);
  if (error) throw new Error("Could not load creator invitations.");
  if (!data?.length) return [];
  const [groups, people] = await Promise.all([
    db
      .from("groups")
      .select("id,name,slug")
      .in(
        "id",
        data.map((i) => i.group_id),
      ),
    db
      .from("profiles")
      .select("id,display_name,handle")
      .in(
        "id",
        data.map((i) => i.inviter_id),
      ),
  ]);
  if (groups.error || people.error)
    throw new Error("Could not load invitation details.");
  return data.map((i) => ({
    ...i,
    status: i.status as CreatorInvitation["status"],
    group_name: groups.data!.find((g) => g.id === i.group_id)?.name || "Group",
    group_slug: groups.data!.find((g) => g.id === i.group_id)?.slug || "",
    inviter: people.data!.find((p) => p.id === i.inviter_id)!,
  }));
}
