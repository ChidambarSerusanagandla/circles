import { test, expect } from "@playwright/test";
import {
  variantFor,
  VISITOR_COOKIE,
} from "../../src/lib/experiments/assignment";
import { uid } from "../../src/lib/seed-data";
const group = "/groups/roommates-after-midnight";
test("anonymous discovery, categories and readable conversation", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("article")).toHaveCount(6);
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
  await page.getByRole("button", { name: "Explore as a reader" }).click();
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
  await page.goto("/profile");
  await page.getByRole("button", { name: "Switch to creator" }).click();
  await page.goto("/admin");
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
test("creator can skip, create a circle and publish; premium joining is a demo", async ({
  page,
}) => {
  await page.goto("/profile");
  await page.getByRole("button", { name: "Try the creator dashboard" }).click();
  await page.goto("/admin");
  await page.getByRole("button", { name: "Skip question" }).first().click();
  await expect(page.getByRole("status")).toContainText("Question skipped");
  await page.getByRole("button", { name: "New circle" }).click();
  await page
    .getByLabel("Circle name", { exact: true })
    .fill("Sunday Lunch Club");
  await page.getByLabel("Address", { exact: true }).fill("sunday-lunch-club");
  await page
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
    page.getByText("Demo membership. No payment is collected."),
  ).toBeVisible();
  await page.getByRole("button", { name: /Join · \$4.99/ }).click();
  await expect(page.getByRole("status")).toContainText("No payment was taken");
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
    await page.goto("/experiments");
    await expect(page.getByText(/not real experiment results/)).toBeVisible();
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
  for (const path of ["/", group, "/experiments", "/profile"]) {
    await page.goto(path);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
});
