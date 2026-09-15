import "server-only";
import { supabase } from "../supabase/server";
import type { InboxPage, InboxThreadView } from "./types";

export async function getInboxThreads(
  userId: string,
): Promise<InboxThreadView[]> {
  const db = await supabase();
  const { data: threads, error } = await db
    .from("inbox_threads")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) throw new Error("Could not load your Inbox. Please try again.");
  if (!threads?.length) return [];
  const ids = [
    ...new Set(
      threads.map((thread) =>
        thread.participant_low === userId
          ? thread.participant_high
          : thread.participant_low,
      ),
    ),
  ];
  const { data: people, error: peopleError } = await db
    .from("profiles")
    .select("id,display_name,handle")
    .in("id", ids);
  if (peopleError) throw new Error("Could not load the people in your Inbox.");
  return threads
    .map((thread) => ({
      ...thread,
      peer: people!.find(
        (person) =>
          person.id ===
          (thread.participant_low === userId
            ? thread.participant_high
            : thread.participant_low),
      )!,
    }))
    .filter((thread) => !!thread.peer);
}
export async function getInboxMessagePage(
  threadId: string,
  before?: { created_at: string; id: string },
): Promise<InboxPage> {
  const db = await supabase();
  const { data, error } = await db.rpc("inbox_message_page", {
    target: threadId,
    ...(before ? { before_time: before.created_at, before_id: before.id } : {}),
  });
  if (error)
    throw new Error("Could not load this conversation. Please try again.");
  return {
    messages: (data || []).slice(0, 50).reverse(),
    hasOlder: (data?.length || 0) > 50,
  };
}
