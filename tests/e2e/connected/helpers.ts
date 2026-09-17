import {
  expect,
  type Browser,
  type Page,
  type TestInfo,
} from "@playwright/test";
import { createServerClient } from "@supabase/ssr";
import { randomUUID } from "node:crypto";
import type { Database } from "../../../src/lib/database.types";
import { runFor } from "./run-journal";
export { closePerson } from "./run-journal";

const accounts = {
  viewer: { email: "demo11@circles.example", name: "Alex Morgan" },
  creator: { email: "demo01@circles.example", name: "Rahul Mehta" },
  arjun: { email: "demo02@circles.example", name: "Arjun Shah" },
  priya: { email: "demo03@circles.example", name: "Priya Kapoor" },
  internal: {
    email: "demo12@circles.example",
    name: "Chidambar Rao Serusanagandla",
  },
} as const;
export type Role = keyof typeof accounts;

// Secondary participants must use the same device settings as the primary page.
export async function personPage(browser: Browser, page: Page, info: TestInfo) {
  const use = info.project.use;
  const context = await browser.newContext({
    baseURL: use.baseURL,
    viewport: page.viewportSize(),
    userAgent: use.userAgent,
    isMobile: use.isMobile,
    hasTouch: use.hasTouch,
    deviceScaleFactor: use.deviceScaleFactor,
    locale: use.locale,
    timezoneId: use.timezoneId,
  });
  await runFor(info).addContext(context, use.baseURL!);
  return { context, page: await context.newPage() };
}

export function groupConversation(page: Page, name: string) {
  // The accessible main region excludes temporary hidden SSR transport markup.
  // A duplicate inside the current conversation still fails strict assertions.
  return page.getByRole("main").getByRole("region", {
    name: `Conversation in ${name}`,
    exact: true,
  });
}

export function privateConversation(page: Page, peer: Role) {
  return page.getByRole("main").getByRole("region", {
    name: `Conversation with ${accounts[peer].name}`,
    exact: true,
  });
}

export async function login(page: Page, role: Role) {
  const account = accounts[role];
  const password =
    process.env[
      role === "internal" ? "SEED_INTERNAL_PASSWORD" : "SEED_PASSWORD"
    ];
  if (!password) throw new Error(`Missing environment password for ${role}`);
  await page.goto("/profile");
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue as Chidambar" }),
  ).toHaveCount(0);
  await page.getByLabel("Email", { exact: true }).fill(account.email);
  // Never attach raw auth responses, traces, storageState, or a caught fill error.
  try {
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page
      .locator("form")
      .getByRole("button", { name: "Sign in", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: account.name, exact: true }),
    ).toBeVisible();
    const identity = await (await dbFor(page)).auth.getUser();
    if (identity.error || identity.data.user?.email !== account.email)
      throw new Error(
        "The signed-in browser must use the expected Supabase project",
      );
  } catch {
    await page
      .getByLabel("Password", { exact: true })
      .fill("")
      .catch(() => {});
    throw new Error(
      `Connected UI sign-in failed for ${role}; check the seeded account and private environment credentials.`,
    );
  }
}

export async function dbFor(page: Page) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key)
    throw new Error("Missing public Supabase connection configuration");
  const cookies = await page.context().cookies();
  // Same public-key/user-session boundary as the app; never a service-role client.
  return createServerClient<Database>(url, key, {
    auth: { debug: false },
    cookies: {
      getAll: () => cookies.map(({ name, value }) => ({ name, value })),
      setAll: () => {},
    },
  });
}

export function uniqueText(prefix: string, info: TestInfo) {
  const marker = runFor(info).journal.id.replaceAll("-", "").slice(0, 12);
  return `E2E ${prefix} ${info.project.name} ${marker}-${randomUUID().slice(0, 8)}`;
}

export async function createGroup(page: Page, info: TestInfo, prefix: string) {
  const name = uniqueText(prefix, info);
  await runFor(info).registerGroup(name);
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  await page.goto("/groups");
  const create = page.getByRole("link", {
    name: "Create a group",
    exact: true,
  });
  if (await create.count()) await create.click();
  else {
    await page
      .getByRole("link", { name: "Open Creator studio", exact: true })
      .click();
    await page.getByRole("button", { name: "New circle", exact: true }).click();
  }
  const form = page.locator(".create-form");
  await form.getByLabel("Circle name", { exact: true }).fill(name);
  await form.getByLabel("Address", { exact: true }).fill(slug);
  await form
    .getByLabel("Description", { exact: true })
    .fill("A fictional conversation created by the connected browser test.");
  await form
    .getByRole("button", { name: "Create circle", exact: true })
    .click();
  await expect(form).toHaveCount(0);
  await page
    .getByRole("combobox", { name: "Your circle", exact: true })
    .selectOption({ label: name });
  await expect(page.locator(".creator-people li")).toHaveCount(1);
  return { name, slug };
}
