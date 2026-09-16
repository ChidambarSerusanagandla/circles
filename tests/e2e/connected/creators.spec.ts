import { expect, test } from "@playwright/test";
import {
  createGroup,
  dbFor,
  groupConversation,
  login,
  personPage,
  uniqueText,
} from "./helpers";

test("creator invitations require acceptance before three collaborators can publish", async ({
  page,
  browser,
}, testInfo) => {
  test.setTimeout(120_000);
  await login(page, "creator");
  const group = await createGroup(page, testInfo, "Creator team");
  const db = await dbFor(page);
  const created = await db
    .from("groups")
    .select("id")
    .eq("slug", group.slug)
    .single();
  expect(
    created.error === null,
    "The new group must be readable by its owner",
  ).toBe(true);
  expect(created.data?.id).toBeTruthy();
  const groupId = created.data!.id;
  const recipients = [
    { role: "arjun", handle: "arjun" },
    { role: "priya", handle: "priya" },
    { role: "viewer", handle: "alex" },
  ] as const;

  await test.step("Owner sends three invitations without granting creator access", async () => {
    await expect(page.locator(".creator-people li")).toHaveCount(1);
    await expect(page.locator(".creator-people")).toContainText(
      "Owner · Creator",
    );
    for (const recipient of recipients) {
      const handle = page.getByLabel("Invite a creator by handle");
      await handle.fill(recipient.handle);
      await page
        .getByRole("button", { name: "Send creator invitation", exact: true })
        .click();
      await expect(handle).toHaveValue("");
      await expect(
        page.locator(".creator-team").getByRole("status"),
      ).toContainText("Invitation sent");
    }
    await expect(page.locator(".creator-people li")).toHaveCount(1);
    const pending = await db
      .from("creator_invitations")
      .select("invitee_id, status")
      .eq("group_id", groupId);
    expect(pending.error === null).toBe(true);
    expect(pending.data).toHaveLength(3);
    expect(
      pending.data?.every((invitation) => invitation.status === "pending"),
    ).toBe(true);
    const creators = await db
      .from("group_admins")
      .select("profile_id")
      .eq("group_id", groupId);
    expect(creators.error === null).toBe(true);
    expect(creators.data).toHaveLength(1);
  });

  for (const recipient of recipients) {
    await test.step(`${recipient.handle} accepts in Groups and publishes as a creator`, async () => {
      const person = await personPage(browser, page, testInfo);
      try {
        await login(person.page, recipient.role);
        const recipientDb = await dbFor(person.page);
        const profile = await recipientDb
          .from("profiles")
          .select("id")
          .eq("handle", recipient.handle)
          .single();
        expect(profile.error).toBeNull();
        const prematurePost = await recipientDb.from("messages").insert({
          group_id: groupId,
          author_id: profile.data!.id,
          content: uniqueText("Rejected before acceptance", testInfo),
        });
        expect(prematurePost.error?.code).toBe("42501");
        await person.page.goto("/groups");
        const invitation = person.page
          .locator(".creator-invitation")
          .filter({ hasText: group.name });
        await expect(invitation).toBeVisible();
        await invitation
          .getByRole("button", { name: "Accept invitation", exact: true })
          .click();
        await expect(invitation).toHaveCount(0);
        await person.page
          .getByRole("link", { name: "Open Creator studio" })
          .click();
        await person.page
          .getByRole("combobox", { name: "Your circle", exact: true })
          .selectOption({ label: group.name });
        const message = uniqueText(`Hello from ${recipient.handle}`, testInfo);
        await person.page
          .getByLabel("Your message", { exact: true })
          .fill(message);
        await person.page
          .getByRole("button", { name: "Publish message", exact: true })
          .click();
        await expect(
          person.page.getByLabel("Your message", { exact: true }),
        ).toHaveValue("");
        await person.page.goto(`/groups/${group.slug}`);
        const conversation = groupConversation(person.page, group.name);
        await expect(conversation).toHaveCount(1);
        const posted = conversation.getByText(message, { exact: true });
        await expect(posted).toHaveCount(1);
        await expect(posted).toBeVisible();
        const persisted = await recipientDb
          .from("messages")
          .select("id")
          .eq("group_id", groupId)
          .eq("content", message);
        expect(persisted.error).toBeNull();
        expect(persisted.data).toHaveLength(1);
      } finally {
        await person.context.close();
      }
    });
  }

  await page.reload();
  await page
    .getByRole("combobox", { name: "Your circle", exact: true })
    .selectOption({ label: group.name });
  await expect(page.locator(".creator-people li")).toHaveCount(4);
  const accepted = await db
    .from("creator_invitations")
    .select("status")
    .eq("group_id", groupId);
  expect(accepted.error === null).toBe(true);
  expect(accepted.data).toHaveLength(3);
  expect(
    accepted.data?.every((invitation) => invitation.status === "accepted"),
  ).toBe(true);
});

test("creator reviews viewer questions, publishes an answer and keeps skipped questions private", async ({
  page,
  browser,
}, testInfo) => {
  test.setTimeout(120_000);
  await login(page, "creator");
  const group = await createGroup(page, testInfo, "Reader questions");
  const questionToAnswer = uniqueText(
    "What inspired this conversation",
    testInfo,
  );
  const questionToSkip = uniqueText(
    "Could we discuss this another time",
    testInfo,
  );
  const answer = uniqueText("We started with a shared curiosity", testInfo);
  const viewer = await personPage(browser, page, testInfo);

  try {
    await test.step("Viewer joins and submits two questions outside the creator conversation", async () => {
      await login(viewer.page, "viewer");
      await viewer.page.goto(`/groups/${group.slug}`);
      await viewer.page
        .getByRole("button", { name: "Join this circle", exact: true })
        .click();
      await expect(
        viewer.page.getByRole("button", { name: "Joined", exact: true }),
      ).toBeDisabled();
      for (const question of [questionToAnswer, questionToSkip]) {
        const input = viewer.page.getByLabel("Your question", { exact: true });
        await input.fill(question);
        await viewer.page
          .getByRole("button", { name: "Send question", exact: true })
          .click();
        await expect(input).toHaveValue("");
        await expect(
          viewer.page
            .getByRole("main")
            .locator(".own-questions")
            .getByText(question, { exact: true }),
        ).toBeVisible();
        await expect(
          groupConversation(viewer.page, group.name),
        ).not.toContainText(question);
      }
      await expect(
        viewer.page.getByRole("button", {
          name: "Publish message",
          exact: true,
        }),
      ).toHaveCount(0);
    });

    await test.step("Creator answers one question and skips the other", async () => {
      await page.reload();
      await page
        .getByRole("combobox", { name: "Your circle", exact: true })
        .selectOption({ label: group.name });
      const answered = page
        .locator("form.question-review")
        .filter({ hasText: questionToAnswer });
      await answered.getByRole("textbox").fill(answer);
      await answered
        .getByRole("button", { name: "Publish answer", exact: true })
        .click();
      await expect(answered).toHaveCount(0);
      const skipped = page
        .locator("form.question-review")
        .filter({ hasText: questionToSkip });
      await skipped
        .getByRole("button", { name: "Skip question", exact: true })
        .click();
      await expect(skipped).toHaveCount(0);
    });

    await test.step("Viewer can read the answer and inspect each question's final state", async () => {
      await viewer.page.reload();
      await expect(groupConversation(viewer.page, group.name)).toContainText(
        answer,
      );
      await expect(
        groupConversation(viewer.page, group.name),
      ).not.toContainText(questionToSkip);
      const ownQuestion = (content: string) =>
        viewer.page
          .getByRole("main")
          .locator(".own-questions > div")
          .filter({ has: viewer.page.getByText(content, { exact: true }) });
      for (const [content, status] of [
        [questionToAnswer, "answered"],
        [questionToSkip, "skipped"],
      ]) {
        const question = ownQuestion(content);
        await expect(question).toHaveCount(1);
        const badge = question.locator(".status");
        await expect(badge).toHaveCount(1);
        await expect(badge).toBeVisible();
        await expect(badge).toHaveText(status);
      }
    });

    await test.step("Answer is public while the skipped question stays outside the public conversation", async () => {
      const anonymous = await personPage(browser, page, testInfo);
      try {
        await anonymous.page.goto(`/groups/${group.slug}`);
        const conversation = groupConversation(anonymous.page, group.name);
        await expect(conversation).toHaveCount(1);
        await expect(conversation).toContainText(answer);
        await expect(
          conversation.locator(".message").filter({ hasText: answer }),
        ).toHaveCount(1);
        await expect(anonymous.page.locator("main")).not.toContainText(
          questionToSkip,
        );
      } finally {
        await anonymous.context.close();
      }
    });
  } finally {
    await viewer.context.close();
  }
});
