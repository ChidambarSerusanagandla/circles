import "server-only";
import { cache } from "react";
import { DEMO_MODE } from "./config";
import { supabase } from "./supabase/server";
import { demoGroups } from "./seed-data";
import type { Group, Message, Profile, Question, Reaction } from "./types";
import { readDemoSession } from "./auth/demo-server";
export const getUser = cache(async () => {
  if (DEMO_MODE) return (await readDemoSession())?.user || null;
  const db = await supabase();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error && error.name !== "AuthSessionMissingError")
    throw new Error("Unable to verify your session. Please try again.");
  if (!user) return null;
  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("id,display_name,handle")
    .eq("id", user.id)
    .single();
  if (profileError) throw new Error("Could not load your profile.");
  return profile;
});
export const getGroups = cache(
  async (
    scope: "discover" | "mine" | "managed" = "discover",
  ): Promise<Group[]> => {
    if (DEMO_MODE) return demoGroups;
    const db = await supabase();
    let groupIds: string[] | undefined;
    if (scope !== "discover") {
      const user = await getUser();
      if (!user) return [];
      const [adminLinks, memberLinks] = await Promise.all([
        db.from("group_admins").select("group_id").eq("profile_id", user.id),
        scope === "mine"
          ? db
              .from("group_memberships")
              .select("group_id")
              .eq("profile_id", user.id)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (adminLinks.error || memberLinks.error)
        throw new Error("Could not load your circles.");
      groupIds = [
        ...new Set(
          [...(adminLinks.data || []), ...(memberLinks.data || [])].map(
            (g) => g.group_id,
          ),
        ),
      ];
      if (!groupIds.length) return [];
    }
    const query = db.from("groups").select("*").order("created_at");
    const groups = await (groupIds
      ? query.in("id", groupIds)
      : query.limit(60));
    if (groups.error)
      throw new Error(
        "Could not load circles. Check the database connection and migrations.",
      );
    const ids = (groups.data || []).map((g) => g.id);
    if (!ids.length) return [];
    const [admins, counts, messages] = await Promise.all([
      db.from("group_admins").select("*").in("group_id", ids),
      db.rpc("group_counts"),
      scope === "discover"
        ? db.rpc("preview_messages", { group_ids: ids })
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (admins.error || counts.error || messages.error)
      throw new Error("Could not load circle details.");
    const personIds = [
      ...new Set([
        ...(admins.data || []).map((a) => a.profile_id),
        ...(messages.data || []).map((m) => m.author_id),
      ]),
    ];
    const [people, reactions] = await Promise.all([
      db.from("profiles").select("id,display_name,handle").in("id", personIds),
      db.rpc("reaction_counts", {
        message_ids: (messages.data || []).map((m) => m.id),
      }),
    ]);
    if (people.error || reactions.error)
      throw new Error("Could not load conversation details.");
    const profiles = new Map((people.data || []).map((p) => [p.id, p]));
    return (groups.data || []).map((g) => ({
      ...g,
      category: g.category as Group["category"],
      access_type: g.access_type as Group["access_type"],
      admins: (admins.data || [])
        .filter((a) => a.group_id === g.id)
        .map((a) => profiles.get(a.profile_id)!)
        .filter(Boolean),
      member_count: Number(
        counts.data?.find((c) => c.group_id === g.id)?.member_count || 0,
      ),
      messages: (messages.data || [])
        .filter((m) => m.group_id === g.id)
        .map((m) => ({
          ...m,
          author: profiles.get(m.author_id) || {
            id: m.author_id,
            display_name: "Creator",
          },
          reactions: Object.fromEntries(
            (reactions.data || [])
              .filter((r) => r.message_id === m.id)
              .map((r) => [r.reaction, Number(r.total)]),
          ),
        })),
    }));
  },
);
export async function getMessages(
  groupId: string,
  limit = 50,
  offset = 0,
  knownProfiles?: Map<string, Profile>,
): Promise<Message[]> {
  if (DEMO_MODE)
    return (
      demoGroups
        .find((g) => g.id === groupId)
        ?.messages.slice(offset, offset + limit) || []
    );
  const db = await supabase();
  const { data, error } = await db
    .from("messages")
    .select("*")
    .eq("group_id", groupId)
    .order("created_at")
    .order("id")
    .range(offset, offset + limit - 1);
  if (error) throw new Error("Could not load the conversation.");
  const ids = (data || []).map((m) => m.id);
  const [people, reactions] = await Promise.all([
    knownProfiles
      ? Promise.resolve({ data: [...knownProfiles.values()], error: null })
      : db
          .from("profiles")
          .select("id,display_name,handle")
          .in("id", [...new Set((data || []).map((m) => m.author_id))]),
    db.rpc("reaction_counts", { message_ids: ids }),
  ]);
  if (people.error || reactions.error)
    throw new Error("Could not load conversation details.");
  const profiles = new Map((people.data || []).map((p) => [p.id, p]));
  return (data || []).map((m) => ({
    ...m,
    author: profiles.get(m.author_id) || {
      id: m.author_id,
      display_name: "Creator",
    },
    reactions: Object.fromEntries(
      (reactions.data || [])
        .filter((r) => r.message_id === m.id)
        .map((r) => [r.reaction, Number(r.total)]),
    ) as Partial<Record<Reaction, number>>,
  }));
}
export const getGroup = cache(
  async (slug: string): Promise<Group | undefined> => {
    if (DEMO_MODE) return demoGroups.find((g) => g.slug === slug);
    const db = await supabase();
    const { data: group, error } = await db
      .from("groups")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw new Error("Could not load this circle.");
    if (!group) return undefined;
    const [admins, counts] = await Promise.all([
      db.from("group_admins").select("profile_id").eq("group_id", group.id),
      db.rpc("group_counts"),
    ]);
    if (admins.error || counts.error)
      throw new Error("Could not load this circle’s creators.");
    const { data: people, error: peopleError } = await db
      .from("profiles")
      .select("id,display_name,handle")
      .in(
        "id",
        (admins.data || []).map((a) => a.profile_id),
      );
    if (peopleError) throw new Error("Could not load this circle’s creators.");
    return {
      ...group,
      category: group.category as Group["category"],
      access_type: group.access_type as Group["access_type"],
      admins: people || [],
      member_count: Number(
        counts.data?.find((c) => c.group_id === group.id)?.member_count || 0,
      ),
      messages: [],
    };
  },
);
export async function getParticipation(groupId?: string) {
  const user = await getUser();
  if (!user || DEMO_MODE)
    return {
      user,
      memberships: [] as string[],
      reactions: [] as { message_id: string; reaction: string }[],
      questions: [] as Question[],
    };
  const db = await supabase();
  const [memberships, reactions, questions] = await Promise.all([
    db.from("group_memberships").select("group_id").eq("profile_id", user.id),
    db
      .from("message_reactions")
      .select("message_id,reaction")
      .eq("profile_id", user.id),
    groupId
      ? db
          .from("questions")
          .select("*")
          .eq("group_id", groupId)
          .order("created_at", { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [], error: null }),
  ]);
  for (const result of [memberships, reactions, questions])
    if (result.error) throw new Error("Could not load your activity.");
  return {
    user,
    memberships: (memberships.data || []).map((m) => m.group_id),
    reactions: reactions.data || [],
    questions: questions.data || [],
  };
}
