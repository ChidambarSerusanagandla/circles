import { request, type FullConfig } from "@playwright/test";

export default async function checkMode(config: FullConfig) {
  const api = await request.newContext({
    baseURL: config.projects[0].use.baseURL,
  });
  try {
    const profile = await api.get("/profile");
    const html = await profile.text();
    const demo = await api.get("/demo");
    const internal = await api.get("/internal/sign-in");
    const isConnected =
      profile.ok() &&
      html.includes('name="password"') &&
      !html.includes("Continue as Chidambar") &&
      demo.status() === 404 &&
      internal.status() === 404;
    const isDemo =
      profile.ok() &&
      html.includes("Continue as Chidambar") &&
      demo.ok() &&
      internal.ok();
    if (config.metadata.mode === "connected" ? !isConnected : !isDemo)
      throw new Error(
        `E2E server mode mismatch: expected ${config.metadata.mode}. Rebuild with the correct NEXT_PUBLIC_DEMO_MODE and restart; no product tests were run.`,
      );
  } finally {
    await api.dispose();
  }
}
