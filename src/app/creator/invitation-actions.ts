"use server";
import { revalidatePath } from "next/cache";
import { DEMO_MODE } from "@/lib/config";
import { getUser } from "@/lib/data";
import { supabase } from "@/lib/supabase/server";
import { inviteHandleInput } from "@/lib/creators/rules";
import { uuidInput } from "@/lib/rules";
import type { ActionResult } from "@/lib/types";
export async function inviteCreator(
  groupId: string,
  handle: string,
): Promise<ActionResult> {
  const id = uuidInput.safeParse(groupId),
    name = inviteHandleInput.safeParse(handle);
  if (!id.success || !name.success)
    return {
      ok: false,
      message: "Choose a group and enter an existing user's handle.",
    };
  try {
    if (DEMO_MODE || !(await getUser())) throw new Error("Sign in required");
    const { error } = await (
      await supabase()
    ).rpc("invite_creator", { target: id.data, invited_handle: name.data });
    if (error)
      return {
        ok: false,
        message:
          "Could not invite this handle. Check that the user exists, is not already a creator, and has no pending invitation.",
      };
    revalidatePath("/", "layout");
    return {
      ok: true,
      message: "Invitation sent. They can accept or decline from Groups.",
    };
  } catch {
    return {
      ok: false,
      message:
        "Could not send the invitation. Group creator access is required.",
    };
  }
}
export async function respondCreatorInvitation(
  id: string,
  accept: boolean,
): Promise<ActionResult> {
  if (!uuidInput.safeParse(id).success || typeof accept !== "boolean")
    return { ok: false, message: "This invitation is invalid." };
  try {
    if (DEMO_MODE || !(await getUser())) throw new Error("Sign in required");
    const { error } = await (
      await supabase()
    ).rpc("respond_creator_invitation", { invitation_id: id, accept });
    if (error)
      return {
        ok: false,
        message: "This invitation is unavailable or already answered.",
      };
    revalidatePath("/", "layout");
    return {
      ok: true,
      message: accept
        ? "Invitation accepted. You can now manage this group."
        : "Invitation declined.",
    };
  } catch {
    return {
      ok: false,
      message:
        "Could not respond. Sign in with the invited account and try again.",
    };
  }
}
