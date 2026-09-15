import { NextResponse } from "next/server";
import { z } from "zod";
import { DEMO_MODE } from "@/lib/config";
import {
  demoSecret,
  DEMO_SESSION_COOKIE,
  issueDemoSession,
  validInternalKey,
} from "@/lib/auth/demo-token";
import { demoCookieOptions } from "@/lib/auth/demo-server";
import { DEMO_ACCOUNT_KEYS } from "@/lib/auth/demo-accounts";
const input = z
  .object({
    account: z.enum(DEMO_ACCOUNT_KEYS),
    key: z.string().max(200).optional(),
  })
  .strict();
export async function POST(request: Request) {
  if (!DEMO_MODE) return new Response(null, { status: 404 });
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return new Response(null, { status: 403 });
  const text = await request.text();
  if (text.length > 1024) return new Response(null, { status: 413 });
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return new Response(null, { status: 400 });
  }
  const parsed = input.safeParse(raw);
  if (!parsed.success)
    return NextResponse.json(
      { ok: false, message: "Choose a valid account." },
      { status: 400 },
    );
  const { account, key } = parsed.data;
  if (
    account === "internal" &&
    !validInternalKey(key || "", process.env.DEMO_INTERNAL_ACCESS_KEY)
  )
    return NextResponse.json(
      { ok: false, message: "Internal access key was not accepted." },
      { status: 403 },
    );
  const response = NextResponse.json({ ok: true, message: "Signed in." });
  response.cookies.set(
    DEMO_SESSION_COOKIE,
    issueDemoSession(account, demoSecret()),
    demoCookieOptions(),
  );
  response.headers.set("Cache-Control", "no-store");
  return response;
}
