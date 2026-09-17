import { randomUUID } from "node:crypto";
import { request, type FullConfig } from "@playwright/test";
import {
  createCleanupClient,
  resolveTestActors,
} from "../../../scripts/e2e/cleanup.mjs";
import { TestRun, retryCurrentRunJournals } from "./run-journal";

export default async function setup(config: FullConfig) {
  process.env.E2E_RUN_ID = randomUUID();
  const projectRef = process.env.E2E_SUPABASE_PROJECT_REF!;
  const db = createCleanupClient(projectRef);
  await resolveTestActors(db);
  const run = new TestRun();
  const baseURL = config.projects[0].use.baseURL!;
  const cookie = await run.visitorCookie(baseURL);
  const api = await request.newContext({
    baseURL,
    storageState: {
      cookies: [
        {
          name: cookie.name,
          value: cookie.value,
          domain: new URL(baseURL).hostname,
          path: "/",
          expires: -1,
          httpOnly: true,
          secure: cookie.secure,
          sameSite: cookie.sameSite,
        },
      ],
      origins: [],
    },
  });
  try {
    const profile = await api.get("/profile");
    const html = await profile.text();
    const demo = await api.get("/demo");
    const internal = await api.get("/internal/sign-in");
    if (
      !profile.ok() ||
      !html.includes('name="password"') ||
      html.includes("Continue as Chidambar") ||
      demo.status() !== 404 ||
      internal.status() !== 404
    )
      throw new Error(
        "Connected E2E requires a connected server; no product tests were run",
      );
    const state = await api.storageState();
    if (
      state.cookies.find((item) => item.name === cookie.name)?.value !==
      cookie.value
    )
      throw new Error(
        "Connected server's analytics secret differs from the test environment",
      );
  } finally {
    await api.dispose();
    await run.finish();
  }
  return retryCurrentRunJournals;
}
