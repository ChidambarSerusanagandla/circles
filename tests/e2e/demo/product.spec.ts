import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import {
  variantFor,
  VISITOR_COOKIE,
} from "../../../src/lib/experiments/assignment";
import { uid } from "../../../src/lib/seed-data";
const group = "/groups/roommates-after-midnight";
async function internalLogin(page: Page) {
  await page.goto("/internal/sign-in");
  await page
    .getByLabel("Internal access key")
    .fill(process.env.DEMO_INTERNAL_ACCESS_KEY!);
  await page.getByRole("button", { name: "Open internal workspace" }).click();
  await expect(page).toHaveURL(/\/internal\/growth$/);
}
test("anonymous discovery, categories and readable conversation", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("article")).toHaveCount(6);
  await expect(
    page.locator(".conversation-card").first().locator(".message"),
  ).toHaveCount(4);
  await expect(page.getByRole("navigation")).not.toContainText(
    /Experiments|Growth|Admin/,
  );
  await page.getByRole("link", { name: "Travel", exact: true }).click();
  await expect(page.getByRole("article")).toHaveCount(1);
  await page.goto(group);
  await expect(page.locator(".conversation-panel .message")).toHaveCount(10);
  await expect(
    page.getByRole("link", { name: "Sign in to join" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /^❤️ reaction/ })
    .first()
    .click();
  await expect(page.getByRole("status")).toContainText("Sign in to react");
});
test("reader joins once, reacts and asks; creator publishes the answer", async ({
  page,
}) => {
  await page.goto(group);
  await page.getByRole("link", { name: "Sign in to join" }).click();
  await page.getByRole("button", { name: "Continue as Chidambar" }).click();
  await expect(page).toHaveURL(new RegExp(group + "$"));
  await page.getByRole("button", { name: "Join this circle" }).click();
  await expect(
    page.getByRole("button", { name: "Joined", exact: true }),
  ).toBeDisabled();
  const heart = page
    .locator(".message")
    .first()
    .getByRole("button", { name: /^❤️ reaction/ });
  await heart.click();
  await expect(heart).toHaveAttribute("aria-pressed", "true");
  await page
    .getByLabel("Your question", { exact: true })
    .fill("What is your favorite shared dinner?");
  await page.getByRole("button", { name: "Send question" }).click();
  await expect(page.getByRole("status")).toContainText("Question sent");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Joined", exact: true }),
  ).toBeDisabled();
  await page.goto("/demo");
  await page.getByRole("button", { name: "Creator · Rahul" }).click();
  await page.goto("/creator");
  const question = page
    .locator("form.question-review")
    .filter({ hasText: "What is your favorite shared dinner?" });
  await question
    .getByRole("textbox")
    .fill("Friday pasta is our weekly tradition.");
  await question.getByRole("button", { name: "Publish answer" }).click();
  await expect(question).toHaveCount(0);
  await page.goto(group);
  await expect(
    page.getByText(/Friday pasta is our weekly tradition/),
  ).toBeVisible();
  await expect(
    page
      .locator(".message")
      .first()
      .getByRole("button", { name: "❤️ reaction, 1", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
});
test("creator can skip, create a circle and publish; all circles join freely", async ({
  page,
}) => {
  await page.goto("/profile");
  await page.goto("/demo");
  await page.getByRole("button", { name: "Creator · Rahul" }).click();
  await page.goto("/creator");
  await page.getByRole("button", { name: "Skip question" }).first().click();
  await expect(page.getByRole("status")).toContainText("Question skipped");
  await page.getByRole("button", { name: "New circle" }).click();
  await page
    .locator(".create-form")
    .getByLabel("Circle name", { exact: true })
    .fill("Sunday Lunch Club");
  await page.getByLabel("Address", { exact: true }).fill("sunday-lunch-club");
  await page
    .locator(".create-form")
    .getByLabel("Description", { exact: true })
    .fill("A good meal and a very long conversation.");
  await page
    .getByRole("button", { name: "Create circle", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Your circle", exact: true })
    .selectOption({ label: "Sunday Lunch Club" });
  await page
    .getByLabel("Your message", { exact: true })
    .fill("Does brunch have a closing time?");
  await page
    .getByRole("button", { name: "Publish message", exact: true })
    .click();
  await page.goto("/groups/sunday-lunch-club");
  await expect(
    page.getByText("Does brunch have a closing time?"),
  ).toBeVisible();
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "Sunday Lunch Club", exact: true }),
  ).toBeVisible();
  await page.goto("/groups/the-next-chapter");
  await expect(
    page.getByText("Free to join. Always welcome to watch."),
  ).toBeVisible();
  await expect(page.locator("main")).not.toContainText(
    /premium|\$4\.99|payment/i,
  );
  await page.getByRole("button", { name: "Join this circle" }).click();
  await expect(
    page.getByRole("button", { name: "Joined", exact: true }),
  ).toBeDisabled();
});
for (const variant of ["A", "B"] as const)
  test(`variant ${variant} is persistent and uses the common impression area`, async ({
    page,
    context,
  }) => {
    const id = Array.from({ length: 100 }, (_, i) => uid(i + 500)).find(
      (id) => variantFor(id) === variant,
    )!;
    await context.addCookies([
      { name: VISITOR_COOKIE, value: id, domain: "localhost", path: "/" },
    ]);
    await internalLogin(page);
    await page.getByLabel("Preview experiment").selectOption("running");
    await page.getByRole("button", { name: "Save configuration" }).click();
    await expect(page.getByRole("status").last()).toContainText(
      "Experiment running",
    );
    await page.goto("/");
    await expect(
      page.locator(".conversation-card").first().locator(".message"),
    ).toHaveCount(variant === "A" ? 4 : 8);
    await expect(page.locator("[data-preview-observation]").first()).toHaveCSS(
      "height",
      "64px",
    );
    await page
      .locator("[data-preview-observation]")
      .first()
      .scrollIntoViewIfNeeded();
    await expect
      .poll(async () =>
        page.evaluate(
          () =>
            JSON.parse(
              localStorage.getItem("circles-demo-v2") || "{}",
            ).events?.filter(
              (e: { event_name: string }) =>
                e.event_name === "group_preview_seen",
            ).length || 0,
        ),
      )
      .toBeGreaterThan(0);
    await page.reload();
    await expect(
      page.locator(".conversation-card").first().locator(".message"),
    ).toHaveCount(variant === "A" ? 4 : 8);
    await page.goto("/internal/growth");
    await expect(
      page.getByText(/shown for product demonstration only/),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "This browser", exact: true })
      .click();
    await expect(page.getByText(/not production traffic/)).toBeVisible();
  });
test("mobile layout and keyboard navigation stay usable", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
  for (const path of ["/", group, "/internal/growth", "/profile"]) {
    await page.goto(path);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
});

test("role boundaries protect both Growth routes and preserve the owner profile", async ({
  page,
}) => {
  for (const path of ["/internal/growth", "/experiments"]) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(404);
    await expect(
      page.getByRole("heading", { name: "A little more context?" }),
    ).toHaveCount(0);
  }
  await page.goto("/profile");
  await page.getByRole("button", { name: "Continue as Chidambar" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Chidambar Rao Serusanagandla",
      exact: true,
    }),
  ).toBeVisible();
  expect((await page.goto("/internal/growth"))?.status()).toBe(404);
  await page.goto("/demo");
  await page.getByRole("button", { name: "Creator · Rahul" }).click();
  await expect(page).toHaveURL(/\/creator$/);
  await expect(page.getByRole("navigation")).not.toContainText(
    /Experiments|Growth|Admin/,
  );
  expect((await page.goto("/internal/growth"))?.status()).toBe(404);
  await internalLogin(page);
  await expect(
    page.getByText("Demo data — shown for product demonstration only.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.goto("/experiments");
  await expect(page).toHaveURL(/\/internal\/growth$/);
});

test("owner invites three people and accepted creators can publish", async ({
  page,
}) => {
  await page.goto("/profile");
  await page.getByRole("button", { name: "Continue as Chidambar" }).click();
  await page.goto("/groups");
  await page.getByRole("link", { name: "Create a group", exact: true }).click();
  await page
    .locator(".create-form")
    .getByLabel("Circle name", { exact: true })
    .fill("After Hours Club");
  await page.getByLabel("Address", { exact: true }).fill("after-hours-club");
  await page
    .locator(".create-form")
    .getByLabel("Description", { exact: true })
    .fill("Four people and a very long conversation.");
  await page
    .getByRole("button", { name: "Create circle", exact: true })
    .click();
  for (const handle of ["rahul", "alex", "priya"]) {
    await page.getByLabel("Invite a creator by handle").fill(handle);
    await page.getByRole("button", { name: "Send creator invitation" }).click();
    await expect(page.getByRole("status").last()).toContainText(
      "Invitation sent",
    );
  }
  await expect(page.locator(".creator-people li")).toHaveCount(1);
  for (const identity of [
    "Creator · Rahul",
    "Reader · Alex",
    "Collaborator · Priya",
  ]) {
    await page.goto("/demo");
    await page.getByRole("button", { name: identity, exact: true }).click();
    await page.goto("/groups");
    const invitation = page
      .locator(".creator-invitation")
      .filter({ hasText: "After Hours Club" });
    await invitation.getByRole("button", { name: "Accept invitation" }).click();
    await expect(invitation).toHaveCount(0);
  }
  await page.goto("/creator");
  await page
    .getByRole("combobox", { name: "Your circle", exact: true })
    .selectOption({ label: "After Hours Club" });
  await expect(page.locator(".creator-people li")).toHaveCount(4);
  await page
    .getByLabel("Your message", { exact: true })
    .fill("A good conversation starts with a hello.");
  await page
    .getByRole("button", { name: "Publish message", exact: true })
    .click();
  await expect(page.getByRole("status").first()).toContainText(
    "Message published",
  );
});

test("private Inbox is shared only by its two participants", async ({
  page,
}) => {
  await page.goto("/profile");
  await page.getByRole("button", { name: "Continue as Chidambar" }).click();
  await page.goto("/inbox");
  await page.getByLabel("Find someone by handle").fill("@rahul");
  await page
    .getByRole("button", { name: "Open conversation", exact: true })
    .click();
  await page
    .getByLabel("Your message", { exact: true })
    .fill("Thanks for starting that conversation.");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(
    page.getByText("Thanks for starting that conversation.", { exact: true }),
  ).toBeVisible();
  await page.goto("/demo");
  await page
    .getByRole("button", { name: "Creator · Rahul", exact: true })
    .click();
  await page.goto("/inbox");
  await expect(
    page.getByText("Thanks for starting that conversation.", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Your message", { exact: true })
    .fill("Glad you enjoyed it!");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await page.goto("/demo");
  await page
    .getByRole("button", { name: "Reader · Alex", exact: true })
    .click();
  await page.goto("/inbox");
  await expect(
    page.getByText("Thanks for starting that conversation.", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page
      .getByRole("navigation", { name: "Conversations", exact: true })
      .getByRole("link"),
  ).toHaveCount(0);
});
