"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireInternal } from "@/lib/auth/access";
import { DEMO_MODE } from "@/lib/config";
import { demoCookieOptions } from "@/lib/auth/demo-server";
import {
  demoSecret,
  DEMO_CONFIG_COOKIE,
  signToken,
} from "@/lib/auth/demo-token";
import { supabase } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";
export async function configureExperiment(
  status: string,
): Promise<ActionResult> {
  try {
    await requireInternal();
    if (!["draft", "running", "completed"].includes(status))
      return { ok: false, message: "Choose a valid experiment status." };
    if (DEMO_MODE)
      (await cookies()).set(
        DEMO_CONFIG_COOKIE,
        signToken("preview:" + status, demoSecret()),
        demoCookieOptions(),
      );
    else {
      const { error } = await (
        await supabase()
      ).rpc("set_preview_experiment_status", {
        new_status: status as "draft" | "running" | "completed",
      });
      if (error) throw error;
    }
    revalidatePath("/", "layout");
    return {
      ok: true,
      message:
        status === "running"
          ? "Experiment running. Discover uses the persistent 4 / 8 assignment."
          : status === "draft"
            ? "Four-message default restored. Historical results are preserved."
            : "Enrollment stopped. Existing conversion windows can finish.",
    };
  } catch {
    return {
      ok: false,
      message:
        "Could not change the experiment. Internal platform access is required.",
    };
  }
}
