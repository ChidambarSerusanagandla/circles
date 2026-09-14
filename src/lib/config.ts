// Absence of configuration intentionally enables the documented reviewer demo.
// A partially configured or explicitly live installation must fail clearly.
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
  (process.env.NEXT_PUBLIC_DEMO_MODE !== "false" && !process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
export function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Connected mode requires both Supabase URL and publishable key. See .env.example.");
  return {url,key};
}
