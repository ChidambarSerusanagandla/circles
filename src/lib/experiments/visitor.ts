import { createHmac, timingSafeEqual } from "node:crypto";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function signVisitor(id: string, secret: string) {
  return id + "." + createHmac("sha256", secret).update(id).digest("hex");
}
export function readVisitor(cookie: string | undefined, secret?: string): string | null {
  if (!cookie) return null;
  if (!secret) return UUID.test(cookie) ? cookie : null;
  const [id, signature, extra] = cookie.split(".");
  if (extra || !UUID.test(id) || !/^[0-9a-f]{64}$/.test(signature || "")) return null;
  const expected = signVisitor(id, secret).split(".")[1];
  return timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex")) ? id : null;
}
export function visitorSecret() {
  const secret = process.env.ANALYTICS_COOKIE_SECRET;
  if (!secret || secret.length < 32) throw new Error("Connected mode requires ANALYTICS_COOKIE_SECRET with at least 32 characters. See .env.example.");
  return secret;
}
