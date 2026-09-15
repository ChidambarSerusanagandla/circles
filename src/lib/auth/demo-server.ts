import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { DEMO_MODE } from "../config";
import {
  demoSecret,
  DEMO_CONFIG_COOKIE,
  DEMO_SESSION_COOKIE,
  readDemoToken,
  verifyToken,
} from "./demo-token";
export const readDemoSession = cache(async () =>
  DEMO_MODE
    ? readDemoToken(
        (await cookies()).get(DEMO_SESSION_COOKIE)?.value,
        demoSecret(),
      )
    : null,
);
export async function demoExperimentStatus(): Promise<
  "draft" | "running" | "completed"
> {
  const raw = verifyToken(
    (await cookies()).get(DEMO_CONFIG_COOKIE)?.value,
    demoSecret(),
  );
  return raw === "preview:running"
    ? "running"
    : raw === "preview:completed"
      ? "completed"
      : "draft";
}
export function demoCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure:
      process.env.NODE_ENV === "production" &&
      process.env.DEMO_SECURE_COOKIES !== "false",
    path: "/",
    maxAge: 8 * 60 * 60,
  };
}
