import { expect, test } from "./fixture";
import {
  closePerson,
  createGroup,
  dbFor,
  login,
  personPage,
  uniqueText,
} from "./helpers";

const publicGroup = "/groups/roommates-after-midnight";

test("anonymous visitors discover previews and read public creator conversations", async ({
  page,
}) => {
  await page.goto("/");
  const card = page
    .locator(".conversation-card")
    .filter({ hasText: "Roommates After Midnight" });
  await expect(card).toBeVisible();
  const previews = await card.locator(".message").count();
  expect([4, 8]).toContain(previews);
  await expect(card.locator("[data-preview-observation]")).toHaveCSS(
    "height",
    "64px",
  );
  await expect(page.getByRole("navigation")).not.toContainText(
    /Experiments|Growth|Admin/,
  );
  await page.getByRole("link", { name: "Travel", exact: true }).click();
  await expect(page.locator(".conversation-card").first()).toBeVisible();
  await page.goto("/");
  await card.getByRole("link", { name: /Continue watching/ }).click();
  await expect(page).toHaveURL(new RegExp(publicGroup + "$"));
  await expect(
    page.locator(".conversation-panel .message").first(),
  ).toBeVisible();
  expect(
    await page.locator(".conversation-panel .message").count(),
  ).toBeGreaterThan(previews);
  await expect(
    page.getByRole("link", { name: "Sign in to join" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /^❤️ reaction/ })
    .first()
    .click();
  await expect(page.getByRole("status")).toContainText("Sign in to react");
  expect((await page.goto("/demo"))?.status()).toBe(404);
  expect((await page.goto("/internal/sign-in"))?.status()).toBe(404);
});

test("viewer signs in, joins once, reacts, asks and finds the circle in Groups", async ({
  page,
  browser,
}, info) => {
  const { context: creatorContext, page: creator } = await personPage(
    browser,
    page,
    info,
  );
  try {
    await login(creator, "creator");
    const group = await createGroup(creator, info, "Viewer loop");
    await creator
      .getByLabel("Your message", { exact: true })
      .fill(uniqueText("Welcome to the conversation", info));
    await creator
      .getByRole("button", { name: "Publish message", exact: true })
      .click();
    await expect(
      creator.getByLabel("Your message", { exact: true }),
    ).toHaveValue("");

    await login(page, "viewer");
    await page.goto(`/groups/${group.slug}`);
    await page
      .getByRole("button", { name: "Join this circle", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Joined", exact: true }),
    ).toBeDisabled();
    const heart = page
      .locator(".conversation-panel .message")
      .first()
      .getByRole("button", { name: /^❤️ reaction/ });
    await heart.click();
    await expect(heart).toHaveAttribute("aria-pressed", "true");
    const question = uniqueText("How did this circle begin", info);
    await page.getByLabel("Your question", { exact: true }).fill(question);
    await page
      .getByRole("button", { name: "Send question", exact: true })
      .click();
    await expect(page.getByLabel("Your question", { exact: true })).toHaveValue(
      "",
    );
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Joined", exact: true }),
    ).toBeDisabled();
    await expect(heart).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".own-questions")).toContainText(question);
    await expect(page.locator(".conversation-panel")).not.toContainText(
      question,
    );
    await expect(
      page.getByRole("button", { name: "Publish message" }),
    ).toHaveCount(0);

    const db = await dbFor(page);
    const row = await db
      .from("groups")
      .select("id")
      .eq("slug", group.slug)
      .single();
    expect(row.error === null).toBe(true);
    const memberships = await db
      .from("group_memberships")
      .select("group_id,profile_id,status")
      .eq("group_id", row.data!.id);
    expect(memberships.error === null).toBe(true);
    expect(memberships.data).toHaveLength(1);
    const duplicate = await db
      .from("group_memberships")
      .insert(memberships.data![0]);
    expect(duplicate.error?.code).toBe("23505");
    await page.goto("/groups");
    await expect(
      page
        .locator(".library-section")
        .filter({ has: page.getByRole("heading", { name: /^Joined circles/ }) })
        .getByRole("heading", { name: group.name, exact: true }),
    ).toBeVisible();
  } finally {
    await closePerson(creatorContext);
  }
});

test("Profile persists the real signed-in account and supports signing out", async ({
  page,
}) => {
  await login(page, "viewer");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Alex Morgan", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Handle", { exact: true })).toHaveValue("alex");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Profile saved");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue as Chidambar" }),
  ).toHaveCount(0);
});

test("viewer and creator are denied Growth while the separately authorized internal account can read it", async ({
  page,
  browser,
}, info) => {
  for (const route of ["/internal/growth", "/experiments"])
    expect((await page.goto(route))?.status()).toBe(404);
  for (const role of ["viewer", "creator", "internal"] as const) {
    const { context, page: person } = await personPage(browser, page, info);
    try {
      await login(person, role);
      await expect(person.getByRole("navigation")).not.toContainText(
        /Experiments|Growth|Admin/,
      );
      const db = await dbFor(person);
      const report = await db.rpc("preview_funnel", { demo: false });
      if (role === "internal") {
        expect(report.error === null).toBe(true);
        expect((await person.goto("/internal/growth"))?.status()).toBe(200);
        await expect(
          person.getByRole("heading", { name: "A little more context?" }),
        ).toBeVisible();
        await person.goto("/experiments");
        await expect(person).toHaveURL(/\/internal\/growth$/);
      } else {
        expect(Boolean(report.error)).toBe(true);
        const configuration = await db.rpc("set_preview_experiment_status", {
          new_status: "draft",
        });
        expect(Boolean(configuration.error)).toBe(true);
        for (const route of ["/internal/growth", "/experiments"])
          expect((await person.goto(route))?.status()).toBe(404);
      }
    } finally {
      await closePerson(context);
    }
  }
});

test("internal report keeps simulated history separate from observed activity", async ({
  page,
}) => {
  await login(page, "internal");
  await page.goto("/internal/growth");
  await expect(
    page.getByRole("button", { name: "Measured traffic", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".report-disclosure")).toContainText(
    "Simulated seed history is excluded",
  );
  const db = await dbFor(page);
  const sample = await db.rpc("preview_funnel", { demo: true });
  expect(sample.error === null).toBe(true);
  expect(
    sample.data?.map((row) => ({
      variant: row.variant,
      visitors: Number(row.visitors),
      joins: Number(row.joins),
    })),
  ).toEqual([
    { variant: "A", visitors: 1000, joins: 112 },
    { variant: "B", visitors: 1000, joins: 147 },
  ]);
  const measured = await db.rpc("preview_funnel", { demo: false });
  expect(measured.error === null).toBe(true);
  for (const row of measured.data || []) {
    const card = page.locator(`.variant-${row.variant}`);
    await expect(
      card
        .locator(".variant-numbers div")
        .filter({ has: page.getByText("Visitors", { exact: true }) })
        .locator("dd"),
    ).toHaveText(Number(row.visitors).toLocaleString());
  }
  await page
    .getByRole("button", { name: "Sample history", exact: true })
    .click();
  await expect(page.locator(".report-disclosure")).toHaveText(
    "Demo data — shown for product demonstration only.",
  );
  await expect(page.locator(".variant-A .primary-rate strong")).toHaveText(
    "11.2%",
  );
  await expect(page.locator(".variant-B .primary-rate strong")).toHaveText(
    "14.7%",
  );
  await page
    .getByRole("button", { name: "Measured traffic", exact: true })
    .click();
  await expect(page.locator(".report-disclosure")).toContainText(
    "Simulated seed history is excluded",
  );
});

test("public and signed-in pages remain usable at the project's viewport", async ({
  page,
}) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
  await login(page, "viewer");
  for (const route of ["/", publicGroup, "/groups", "/inbox", "/profile"]) {
    await page.goto(route);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
});
