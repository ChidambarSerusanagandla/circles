import { createClient } from "@supabase/supabase-js";

export const TEST_DESCRIPTION =
  "A fictional conversation created by the connected browser test.";
const suffix = "(?:[0-9a-f]{8}|[0-9a-f]{12}-[0-9a-f]{8})";
const groupPattern = new RegExp(
  `^E2E (Creator team|Reader questions|Viewer loop) (desktop|mobile) ${suffix}$`,
);
const inboxPattern = new RegExp(
  `^E2E (Private hello|Private reply|Rejected sender impersonation|Rejected nonparticipant message|Rejected private message) (desktop|mobile) ${suffix}$`,
);
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const seedIds = new Set(
  Array.from(
    { length: 6 },
    (_, i) => `00000000-0000-4000-8000-${String(100 + i).padStart(12, "0")}`,
  ),
);

export function createCleanupClient(expectedProjectRef) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !/^[a-z0-9]{20}$/.test(expectedProjectRef || ""))
    throw new Error(
      "Cleanup requires a public Supabase URL, server key and explicit 20-character test project ref.",
    );
  if (new URL(url).origin !== `https://${expectedProjectRef}.supabase.co`)
    throw new Error(
      "Cleanup project ref does not match the configured Supabase URL; nothing was deleted.",
    );
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, debug: false },
  });
}

function checked(result, operation) {
  // Never include a raw SDK response: it can carry private records or headers.
  if (result.error)
    throw new Error(
      `E2E cleanup failed during ${operation}; journal retained for retry.`,
    );
  return result.data || [];
}

async function all(makeQuery) {
  const rows = [];
  for (let offset = 0; ; offset += 500) {
    const page = checked(await makeQuery().range(offset, offset + 499), "read");
    rows.push(...page);
    if (page.length < 500) return rows;
  }
}

async function byIds(db, table, column, ids, columns = "*") {
  const rows = [];
  for (let start = 0; start < ids.length; start += 100)
    rows.push(
      ...(await all(() => {
        let query = db
          .from(table)
          .select(columns)
          .in(column, ids.slice(start, start + 100))
          .order(column);
        if (table === "group_admins" || table === "group_memberships")
          query = query.order("profile_id");
        else if (column !== "id") query = query.order("id");
        return query;
      })),
    );
  return rows;
}

export async function resolveTestActors(db) {
  const definitions = {
    creator: ["demo01@circles.example", "rahul"],
    viewer: ["demo11@circles.example", "alex"],
    arjun: ["demo02@circles.example", "arjun"],
    priya: ["demo03@circles.example", "priya"],
    internal: ["demo12@circles.example", "chidambar"],
  };
  const users = new Map();
  for (let page = 1; ; page++) {
    const response = await db.auth.admin.listUsers({ page, perPage: 500 });
    if (response.error)
      throw new Error(
        "Cannot verify seeded test account identities; cleanup stopped.",
      );
    for (const user of response.data.users)
      if (Object.values(definitions).some(([email]) => email === user.email))
        users.set(user.email, user.id);
    if (response.data.users.length < 500) break;
  }
  const profiles = await byIds(
    db,
    "profiles",
    "id",
    [...users.values()],
    "id,handle",
  );
  /** @type {Record<string, string>} */
  const actors = {};
  for (const [role, [email, handle]] of Object.entries(definitions)) {
    const id = users.get(email);
    if (!id || !profiles.some((p) => p.id === id && p.handle === handle))
      throw new Error(
        "Seeded test account identity mismatch; cleanup stopped.",
      );
    actors[role] = id;
  }
  return actors;
}

export function isOwnedGroup(group, creator, names) {
  return (
    !seedIds.has(group.id) &&
    group.is_demo === false &&
    group.created_by === creator &&
    groupPattern.test(group.name) &&
    group.slug === group.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") &&
    group.description === TEST_DESCRIPTION &&
    (!names || names.includes(group.name))
  );
}

export function isOwnedInboxMessage(message, thread, actors, texts) {
  const match = inboxPattern.exec(message.content);
  if (!match || !thread || (texts && !texts.includes(message.content)))
    return false;
  const [low, high] = [actors.creator, actors.viewer].sort();
  if (thread.participant_low !== low || thread.participant_high !== high)
    return false;
  const allowedSenders = {
    "Private hello": [actors.viewer],
    "Private reply": [actors.creator],
    "Rejected sender impersonation": [actors.creator],
    "Rejected nonparticipant message": [actors.arjun, actors.internal],
    "Rejected private message": [low],
  };
  return allowedSenders[match[1]].includes(message.sender_id);
}

export async function planCleanup(db, options) {
  if (!options.projectRef || !/^[a-z0-9]{20}$/.test(options.projectRef))
    throw new Error("An explicit test project ref is required.");
  if (
    !options.legacy &&
    (!Array.isArray(options.groupNames) ||
      !Array.isArray(options.inboxTexts) ||
      !Array.isArray(options.visitorIds))
  )
    throw new Error("Run cleanup requires a complete resource journal.");
  const visitors = [...new Set(options.visitorIds || [])];
  if (visitors.some((id) => !uuid.test(id)))
    throw new Error("Invalid journal visitor identity.");
  if (options.legacy && visitors.length)
    throw new Error("Historical cleanup cannot infer visitor ownership.");
  const actors = await resolveTestActors(db);
  const candidates = await all(() =>
    db.from("groups").select("*").like("name", "E2E %").order("id"),
  );
  const groups = candidates.filter((group) =>
    isOwnedGroup(
      group,
      actors.creator,
      options.legacy ? undefined : options.groupNames,
    ),
  );
  const ids = groups.map((group) => group.id);
  const messages = await byIds(db, "messages", "group_id", ids, "id");
  const questions = await byIds(db, "questions", "group_id", ids, "id");
  const counts = {
    groups: groups.length,
    group_admins: (
      await byIds(db, "group_admins", "group_id", ids, "group_id,profile_id")
    ).length,
    group_memberships: (
      await byIds(
        db,
        "group_memberships",
        "group_id",
        ids,
        "group_id,profile_id",
      )
    ).length,
    messages: messages.length,
    message_reactions: (
      await byIds(
        db,
        "message_reactions",
        "message_id",
        messages.map((row) => row.id),
        "id",
      )
    ).length,
    questions: questions.length,
    question_answers: (
      await byIds(
        db,
        "question_answers",
        "question_id",
        questions.map((row) => row.id),
        "id",
      )
    ).length,
    creator_invitations: (
      await byIds(db, "creator_invitations", "group_id", ids, "id")
    ).length,
  };
  const events = [
    ...new Map(
      [
        ...(await byIds(db, "analytics_events", "group_id", ids, "id,is_demo")),
        ...(await byIds(
          db,
          "analytics_events",
          "anonymous_session_id",
          visitors,
          "id,is_demo",
        )),
      ].map((row) => [row.id, row]),
    ).values(),
  ];
  if (events.some((row) => row.is_demo))
    throw new Error(
      "A target has protected demo analytics; no deletion attempted.",
    );
  const assignments = await byIds(
    db,
    "experiment_assignments",
    "anonymous_session_id",
    visitors,
    "id",
  );
  const inboxCandidates = await all(() =>
    db
      .from("inbox_messages")
      .select("id,thread_id,sender_id,content,created_at")
      .like("content", "E2E %")
      .order("id"),
  );
  const threadIds = [
    ...new Set([
      ...inboxCandidates.map((row) => row.thread_id),
      ...(options.thread ? [options.thread.id] : []),
    ]),
  ];
  const threads = await byIds(db, "inbox_threads", "id", threadIds);
  const inboxMessages = inboxCandidates.filter((row) =>
    isOwnedInboxMessage(
      row,
      threads.find((t) => t.id === row.thread_id),
      actors,
      options.legacy ? undefined : options.inboxTexts,
    ),
  );
  return {
    groups,
    events,
    assignments,
    inboxMessages,
    threads,
    actors,
    summary: {
      groups: groups.map((row) => ({ id: row.id, name: row.name })),
      counts: {
        ...counts,
        inbox_messages: inboxMessages.length,
        analytics_events: events.length,
        experiment_assignments: assignments.length,
      },
      preservedUnrecognizedE2EGroups: candidates.filter(
        (group) => !groups.includes(group),
      ).length,
    },
  };
}

async function deleteIds(db, table, ids, extra = (query) => query) {
  let deleted = 0;
  for (let start = 0; start < ids.length; start += 100) {
    const data = checked(
      await extra(
        db
          .from(table)
          .delete()
          .in("id", ids.slice(start, start + 100)),
      ).select("id"),
      `delete ${table}`,
    );
    deleted += data.length;
  }
  return deleted;
}

export async function cleanup(db, options) {
  const plan = await planCleanup(db, options);
  if (options.dryRun !== false) return { dryRun: true, ...plan.summary };
  // Events use SET NULL, unlike the group-owned content's CASCADE relationships.
  await deleteIds(
    db,
    "analytics_events",
    plan.events.map((row) => row.id),
    (q) => q.eq("is_demo", false),
  );
  const removedGroups = await deleteIds(
    db,
    "groups",
    plan.groups.map((row) => row.id),
    (q) =>
      q
        .eq("is_demo", false)
        .eq("created_by", plan.actors.creator)
        .eq("description", TEST_DESCRIPTION)
        .in(
          "name",
          plan.groups.map((row) => row.name),
        ),
  );
  if (removedGroups !== plan.groups.length)
    throw new Error(
      "Group changed during cleanup; inspect the retained journal before retrying.",
    );
  await deleteIds(
    db,
    "inbox_messages",
    plan.inboxMessages.map((row) => row.id),
  );

  const [low, high] = [plan.actors.creator, plan.actors.viewer].sort();
  let removedThreads = 0;
  for (const thread of plan.threads) {
    if (thread.participant_low !== low || thread.participant_high !== high)
      continue;
    const touched = plan.inboxMessages.some(
      (row) => row.thread_id === thread.id,
    );
    const owned =
      options.thread?.id === thread.id && options.thread.createdByTest === true;
    if (!touched && !owned) continue;
    const remaining = checked(
      await db
        .from("inbox_messages")
        .select("created_at")
        .eq("thread_id", thread.id)
        .order("created_at", { ascending: false })
        .limit(1),
      "retained Inbox history",
    );
    if (owned && !remaining.length) {
      // New messages touch updated_at. Compare-and-set protects a concurrent sender.
      removedThreads += checked(
        await db
          .from("inbox_threads")
          .delete()
          .eq("id", thread.id)
          .eq("updated_at", thread.updated_at)
          .select("id"),
        "empty owned thread",
      ).length;
    } else if (touched) {
      const updatedAt = remaining[0]?.created_at || thread.created_at;
      checked(
        await db
          .from("inbox_threads")
          .update({ updated_at: updatedAt })
          .eq("id", thread.id)
          .eq("updated_at", thread.updated_at)
          .select("id"),
        "Inbox activity timestamp",
      );
    }
  }

  // Browser/API contexts are closed and drained by the caller. Repeat the exact
  // visitor sweep to include completed keepalive requests; a FK conflict fails
  // safely and leaves the journal for global-teardown/manual recovery.
  const visitors = options.visitorIds || [];
  const lateEvents = await byIds(
    db,
    "analytics_events",
    "anonymous_session_id",
    visitors,
    "id,is_demo",
  );
  if (lateEvents.some((row) => row.is_demo))
    throw new Error("Protected demo event appeared; journal retained.");
  await deleteIds(
    db,
    "analytics_events",
    lateEvents.map((row) => row.id),
    (q) => q.eq("is_demo", false),
  );
  const assignments = await byIds(
    db,
    "experiment_assignments",
    "anonymous_session_id",
    visitors,
    "id",
  );
  await deleteIds(
    db,
    "experiment_assignments",
    assignments.map((row) => row.id),
  );
  const remaining = await planCleanup(db, options);
  if (Object.values(remaining.summary.counts).some((count) => count !== 0))
    throw new Error(
      "Cleanup left owned records; journal retained for recovery.",
    );
  return { dryRun: false, ...plan.summary, removedThreads };
}
