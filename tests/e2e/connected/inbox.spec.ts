import { type BrowserContext } from "@playwright/test";
import { expect, test } from "./fixture";
import { runFor } from "./run-journal";
import {
  dbFor,
  closePerson,
  login,
  personPage,
  privateConversation,
  uniqueText,
} from "./helpers";

test("private Inbox allows its two participants and denies other users, including Growth admins", async ({
  page,
  browser,
}, testInfo) => {
  const contexts: BrowserContext[] = [];
  const message = uniqueText("Private hello", testInfo);
  const reply = uniqueText("Private reply", testInfo);
  const run = runFor(testInfo);

  try {
    await login(page, "viewer");
    const viewerDb = await dbFor(page);
    const identity = await viewerDb.auth.getUser();
    expect(identity.error).toBeNull();
    const recipientProfile = await viewerDb
      .from("profiles")
      .select("id")
      .eq("handle", "rahul")
      .single();
    expect(recipientProfile.error).toBeNull();
    const pair = [identity.data.user!.id, recipientProfile.data!.id].sort();
    const baseline = await viewerDb
      .from("inbox_threads")
      .select("id,updated_at")
      .eq("participant_low", pair[0])
      .eq("participant_high", pair[1])
      .maybeSingle();
    expect(baseline.error).toBeNull();
    if (baseline.data)
      await run.registerThread({
        id: baseline.data.id,
        createdByTest: false,
        baselineUpdatedAt: baseline.data.updated_at,
      });
    await page.goto("/inbox");
    await page.getByLabel("Find someone by handle").fill("@rahul");
    await page
      .getByRole("button", { name: "Open conversation", exact: true })
      .click();
    await page.waitForURL(/\/inbox\?thread=[a-f0-9-]+$/);
    const threadId = new URL(page.url()).searchParams.get("thread")!;
    await run.registerThread({
      id: threadId,
      createdByTest: !baseline.data,
      ...(baseline.data ? { baselineUpdatedAt: baseline.data.updated_at } : {}),
    });
    const threadPath = `/inbox?thread=${threadId}`;
    await expect(
      page
        .getByRole("navigation", { name: "Conversations", exact: true })
        .locator(`a[href="${threadPath}"]`),
    ).toBeVisible();
    await run.registerInboxText(message);
    await page.getByLabel("Your message", { exact: true }).fill(message);
    await page
      .getByRole("button", { name: "Send message", exact: true })
      .click();
    const viewerConversation = privateConversation(page, "creator");
    await expect(viewerConversation).toHaveCount(1);
    await expect(
      viewerConversation.getByText(message, { exact: true }),
    ).toHaveCount(1);
    await expect(
      viewerConversation.getByText(message, { exact: true }),
    ).toBeVisible();
    const sentMessage = viewerConversation
      .locator(".inbox-messages li")
      .filter({ hasText: message });
    await expect(sentMessage.locator("time")).toHaveAttribute(
      "datetime",
      /\d{4}-\d{2}-\d{2}T/,
    );

    const { context: creatorContext, page: creatorPage } = await personPage(
      browser,
      page,
      testInfo,
    );
    contexts.push(creatorContext);
    await login(creatorPage, "creator");
    await creatorPage.goto("/inbox");
    const creatorThread = creatorPage
      .getByRole("navigation", { name: "Conversations", exact: true })
      .locator(`a[href="${threadPath}"]`);
    await expect(creatorThread).toBeVisible();
    await creatorThread.click();
    const creatorConversation = privateConversation(creatorPage, "viewer");
    await expect(creatorConversation).toHaveCount(1);
    await expect(
      creatorConversation.getByText(message, { exact: true }),
    ).toHaveCount(1);
    await expect(
      creatorConversation.getByText(message, { exact: true }),
    ).toBeVisible();
    await run.registerInboxText(reply);
    await creatorPage.getByLabel("Your message", { exact: true }).fill(reply);
    await creatorPage
      .getByRole("button", { name: "Send message", exact: true })
      .click();
    await expect(
      creatorConversation.getByText(reply, { exact: true }),
    ).toHaveCount(1);
    await expect(
      creatorConversation.getByText(reply, { exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(
      viewerConversation.getByText(reply, { exact: true }),
    ).toHaveCount(1);
    await expect(
      viewerConversation.getByText(reply, { exact: true }),
    ).toBeVisible();

    const visibleThread = await viewerDb
      .from("inbox_threads")
      .select("id,participant_low,participant_high")
      .eq("id", threadId);
    expect(
      Boolean(visibleThread.error),
      "A participant can query their private thread",
    ).toBe(false);
    expect(visibleThread.data?.length).toBe(1);
    const participantPage = await viewerDb.rpc("inbox_message_page", {
      target: threadId,
    });
    expect(
      Boolean(participantPage.error),
      "A participant can read message history",
    ).toBe(false);
    expect(
      participantPage.data?.some(
        (row: { content: string }) => row.content === reply,
      ),
    ).toBe(true);
    expect(
      participantPage.data?.filter((row) => row.content === message),
    ).toHaveLength(1);
    expect(
      participantPage.data?.filter((row) => row.content === reply),
    ).toHaveLength(1);

    expect(
      Boolean(recipientProfile.error),
      "The seeded recipient profile exists",
    ).toBe(false);
    const forgedText = uniqueText("Rejected sender impersonation", testInfo);
    await run.registerInboxText(forgedText);
    const forgedParticipantMessage = await viewerDb
      .from("inbox_messages")
      .insert({
        thread_id: threadId,
        sender_id: recipientProfile.data!.id,
        content: forgedText,
      });
    expect(
      Boolean(forgedParticipantMessage.error),
      "A participant cannot impersonate the other sender",
    ).toBe(true);

    for (const role of ["arjun", "internal"] as const) {
      const { context: outsiderContext, page: outsiderPage } = await personPage(
        browser,
        page,
        testInfo,
      );
      contexts.push(outsiderContext);
      await login(outsiderPage, role);
      await outsiderPage.goto(threadPath);
      await expect(
        outsiderPage.getByRole("heading", {
          name: "This conversation is unavailable.",
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        outsiderPage.getByText(message, { exact: true }),
      ).toHaveCount(0);
      await expect(outsiderPage.getByText(reply, { exact: true })).toHaveCount(
        0,
      );
      await expect(
        outsiderPage.getByLabel("Your message", { exact: true }),
      ).toHaveCount(0);
      await expect(
        outsiderPage
          .getByRole("navigation", { name: "Conversations", exact: true })
          .locator(`a[href="${threadPath}"]`),
      ).toHaveCount(0);

      const outsiderDb = await dbFor(outsiderPage);
      const hiddenThread = await outsiderDb
        .from("inbox_threads")
        .select("id")
        .eq("id", threadId);
      expect(
        Boolean(hiddenThread.error),
        "Thread filtering is enforced by RLS",
      ).toBe(false);
      expect(hiddenThread.data?.length).toBe(0);
      const hiddenMessages = await outsiderDb
        .from("inbox_messages")
        .select("id")
        .eq("thread_id", threadId);
      expect(
        Boolean(hiddenMessages.error),
        "Message filtering is enforced by RLS",
      ).toBe(false);
      expect(hiddenMessages.data?.length).toBe(0);
      const hiddenPage = await outsiderDb.rpc("inbox_message_page", {
        target: threadId,
      });
      expect(
        Boolean(hiddenPage.error),
        "The message RPC preserves participant RLS",
      ).toBe(false);
      expect(hiddenPage.data?.length).toBe(0);

      const outsiderProfile = await outsiderDb
        .from("profiles")
        .select("id")
        .eq("handle", role === "arjun" ? "arjun" : "chidambar")
        .single();
      expect(
        Boolean(outsiderProfile.error),
        "The seeded nonparticipant profile exists",
      ).toBe(false);
      const outsiderText = uniqueText(
        "Rejected nonparticipant message",
        testInfo,
      );
      await run.registerInboxText(outsiderText);
      const outsiderMessage = await outsiderDb.from("inbox_messages").insert({
        thread_id: threadId,
        sender_id: outsiderProfile.data!.id,
        content: outsiderText,
      });
      expect(
        Boolean(outsiderMessage.error),
        "A nonparticipant cannot send using their own identity",
      ).toBe(true);
      const privateText = uniqueText("Rejected private message", testInfo);
      await run.registerInboxText(privateText);
      const forgedMessage = await outsiderDb.from("inbox_messages").insert({
        thread_id: threadId,
        sender_id: visibleThread.data![0].participant_low,
        content: privateText,
      });
      expect(
        Boolean(forgedMessage.error),
        "A nonparticipant cannot send as a thread participant",
      ).toBe(true);
    }
  } finally {
    await Promise.all(contexts.map((context) => closePerson(context)));
  }
});
