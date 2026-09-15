import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import {
  demoAccounts,
  DEMO_ACCOUNT_KEYS,
  type DemoAccount,
} from "./demo-accounts";
import type { Profile } from "../types";
export const DEMO_SESSION_COOKIE = "circles_demo_session";
export const DEMO_CONFIG_COOKIE = "circles_demo_experiment";
const payloadSchema = z
  .object({
    account: z.enum(DEMO_ACCOUNT_KEYS),
    expires: z.number(),
    name: z.string().min(2).max(60),
    handle: z
      .string()
      .regex(/^[a-z][a-z0-9_]{2,29}$/)
      .nullable(),
  })
  .strict();
export function demoSecret() {
  if (process.env.DEMO_SESSION_SECRET) {
    if (process.env.DEMO_SESSION_SECRET.length < 32)
      throw new Error(
        "DEMO_SESSION_SECRET must contain at least 32 characters.",
      );
    return process.env.DEMO_SESSION_SECRET;
  }
  // Single-process reviewer convenience. A configured secret is required for
  // consistent sessions across multiple deployed instances.
  const runtime = globalThis as typeof globalThis & {
    circlesDemoSecret?: string;
  };
  return (runtime.circlesDemoSecret ||= randomBytes(32).toString("hex"));
}
export function signToken(value: string, secret: string) {
  const body = Buffer.from(value).toString("base64url");
  return (
    body + "." + createHmac("sha256", secret).update(body).digest("base64url")
  );
}
export function verifyToken(
  token: string | undefined,
  secret: string,
): string | null {
  if (!token || token.length > 2048) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, signature] = parts;
  if (!/^[A-Za-z0-9_-]+$/.test(body) || !/^[A-Za-z0-9_-]{43}$/.test(signature))
    return null;
  const expected = createHmac("sha256", secret).update(body).digest();
  const supplied = Buffer.from(signature, "base64url");
  if (
    supplied.toString("base64url") !== signature ||
    Buffer.from(body, "base64url").toString("base64url") !== body
  )
    return null;
  if (
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  )
    return null;
  return Buffer.from(body, "base64url").toString();
}
export function issueDemoSession(
  account: DemoAccount,
  secret: string,
  profile = demoAccounts[account].user,
  now = Date.now(),
) {
  return signToken(
    JSON.stringify({
      account,
      expires: now + 8 * 60 * 60 * 1000,
      name: profile.display_name,
      handle: profile.handle || null,
    }),
    secret,
  );
}
export function readDemoToken(
  token: string | undefined,
  secret: string,
  now = Date.now(),
): { account: DemoAccount; user: Profile; internal: boolean } | null {
  const text = verifyToken(token, secret);
  if (!text) return null;
  try {
    const parsed = payloadSchema.safeParse(JSON.parse(text));
    if (!parsed.success || parsed.data.expires <= now) return null;
    const data = parsed.data,
      account = demoAccounts[data.account];
    return {
      account: data.account,
      internal: account.internal,
      user: { ...account.user, display_name: data.name, handle: data.handle },
    };
  } catch {
    return null;
  }
}
export function validInternalKey(
  supplied: string,
  expected: string | undefined,
) {
  if (!expected || expected.length < 24) return false;
  const digest = (s: string) =>
    createHmac("sha256", "circles-internal-key-check").update(s).digest();
  return timingSafeEqual(digest(supplied), digest(expected));
}
