"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { DEMO_MODE } from "@/lib/config";
import { supabase } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";
import { cookies } from "next/headers";
import { getUser } from "@/lib/data";
import { profileInput } from "@/lib/rules";
import { demoAccounts } from "@/lib/auth/demo-accounts";
import { profiles } from "@/lib/seed-data";
import { readDemoSession, demoCookieOptions } from "@/lib/auth/demo-server";
import {
  DEMO_SESSION_COOKIE,
  demoSecret,
  issueDemoSession,
} from "@/lib/auth/demo-token";
const credentials = z.object({
  email: z.email(),
  password: z.string().min(8).max(128),
  display_name: z.string().trim().min(2).max(60),
});
export async function authenticate(
  input: unknown,
  signup: boolean,
): Promise<ActionResult> {
  if (DEMO_MODE)
    return {
      ok: false,
      message: "Use the demo account below. No password is needed.",
    };
  const result = credentials.safeParse(input);
  if (!result.success)
    return { ok: false, message: result.error.issues[0].message };
  try {
    const db = await supabase();
    const { email, password, display_name } = result.data;
    const { data, error } = signup
      ? await db.auth.signUp({
          email,
          password,
          options: { data: { display_name } },
        })
      : await db.auth.signInWithPassword({ email, password });
    if (error)
      return {
        ok: false,
        message: signup
          ? "Could not create your account. Please check your details and try again."
          : "Email or password wasn’t recognized.",
      };
    revalidatePath("/", "layout");
    return {
      ok: true,
      message:
        signup && !data.session
          ? "Check your email to confirm your account, then sign in."
          : "Signed in. Welcome to Circles.",
    };
  } catch {
    return {
      ok: false,
      message: "Authentication is unavailable. Please try again shortly.",
    };
  }
}
export async function signOut(): Promise<ActionResult> {
  try {
    if (DEMO_MODE) (await cookies()).delete(DEMO_SESSION_COOKIE);
    if (!DEMO_MODE) {
      const db = await supabase();
      const { error } = await db.auth.signOut();
      if (error) throw error;
    }
    revalidatePath("/", "layout");
    return { ok: true, message: "You’ve signed out." };
  } catch {
    return { ok: false, message: "Could not sign out. Please try again." };
  }
}
export async function updateProfile(input: unknown): Promise<ActionResult> {
  const parsed = profileInput.safeParse(input);
  if (!parsed.success)
    return { ok: false, message: parsed.error.issues[0].message };
  try {
    const user = await getUser();
    if (!user) return { ok: false, message: "Sign in to update your profile." };
    if (DEMO_MODE) {
      const session = await readDemoSession();
      if (!session) throw new Error("Missing session");
      const taken = [
        ...profiles,
        ...Object.values(demoAccounts).map((a) => a.user),
      ];
      if (
        parsed.data.handle &&
        taken.some(
          (p) =>
            p.id !== user.id &&
            (p.handle || p.display_name.split(" ")[0].toLowerCase()) ===
              parsed.data.handle,
        )
      )
        return { ok: false, message: "That handle is already taken." };
      (await cookies()).set(
        DEMO_SESSION_COOKIE,
        issueDemoSession(session.account, demoSecret(), {
          ...user,
          ...parsed.data,
        }),
        demoCookieOptions(),
      );
    } else {
      const { error } = await (
        await supabase()
      )
        .from("profiles")
        .update(parsed.data)
        .eq("id", user.id);
      if (error)
        return {
          ok: false,
          message:
            error.code === "23505"
              ? "That handle is already taken."
              : "Could not save your profile.",
        };
    }
    revalidatePath("/", "layout");
    return { ok: true, message: "Profile saved." };
  } catch {
    return {
      ok: false,
      message: "Could not save your profile. Please try again.",
    };
  }
}
