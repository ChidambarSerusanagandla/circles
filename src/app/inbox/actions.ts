"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUser } from "@/lib/data";
import { DEMO_MODE } from "@/lib/config";
import { supabase } from "@/lib/supabase/server";
import { inboxContent, inboxHandle } from "@/lib/inbox/rules";
import { getInboxMessagePage } from "@/lib/inbox/data";
import type { InboxMessage, InboxPage } from "@/lib/inbox/types";

type Result<T> = { ok: true; data: T } | { ok: false; message: string };
async function context() {
  if (DEMO_MODE) throw new Error("Use the browser demo for private messages.");
  const user = await getUser();
  if (!user) throw new Error("Sign in to open your Inbox.");
  return { user, db: await supabase() };
}
function failure(error: unknown) {
  return {
    ok: false as const,
    message:
      error instanceof z.ZodError
        ? error.issues[0].message
        : error instanceof Error
          ? error.message
          : "Could not save your message. Please try again.",
  };
}
export async function startInboxThread(
  handle: unknown,
): Promise<Result<string>> {
  try {
    const recipient_handle = inboxHandle.parse(handle);
    const { db } = await context();
    const { data, error } = await db.rpc("start_inbox_thread", {
      recipient_handle,
    });
    if (error || !data)
      throw new Error(error?.message || "Could not start this conversation.");
    revalidatePath("/inbox");
    return { ok: true, data };
  } catch (error) {
    return failure(error);
  }
}
export async function sendInboxMessage(
  threadId: string,
  input: unknown,
): Promise<Result<InboxMessage>> {
  try {
    z.uuid().parse(threadId);
    const content = inboxContent.parse(input);
    const { db, user } = await context();
    const { data, error } = await db
      .from("inbox_messages")
      .insert({ thread_id: threadId, sender_id: user.id, content })
      .select("*")
      .single();
    if (error || !data)
      throw new Error(
        "Could not send this message. Check that you can access this conversation.",
      );
    revalidatePath("/inbox");
    return { ok: true, data };
  } catch (error) {
    return failure(error);
  }
}
export async function loadOlderInboxMessages(
  threadId: string,
  before: { id: string; created_at: string },
): Promise<Result<InboxPage>> {
  try {
    z.uuid().parse(threadId);
    z.object({
      id: z.uuid(),
      created_at: z.iso.datetime({ offset: true }),
    }).parse(before);
    await context();
    return { ok: true, data: await getInboxMessagePage(threadId, before) };
  } catch (error) {
    return failure(error);
  }
}
