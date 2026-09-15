import "server-only";
import { cache } from "react";
import { getUser } from "../data";
import { DEMO_MODE } from "../config";
import { supabase } from "../supabase/server";
import { readDemoSession } from "./demo-server";
export const getAccess = cache(async () => {
  const user = await getUser();
  if (!user) return { user: null, internal: false };
  if (DEMO_MODE)
    return { user, internal: (await readDemoSession())?.internal === true };
  const db = await supabase();
  const { data, error } = await db.rpc("is_growth_admin");
  if (error) throw new Error("Could not verify platform access.");
  return { user, internal: data === true };
});
export async function requireInternal() {
  const access = await getAccess();
  if (!access.user || !access.internal)
    throw new Error("Internal platform access required.");
  return access;
}
