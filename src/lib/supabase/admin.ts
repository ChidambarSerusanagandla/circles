import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";
export function analyticsDatabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new Error(
      "Server analytics requires Supabase URL and service role key.",
    );
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
