import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { cleanup, TEST_DESCRIPTION } from "../../scripts/e2e/cleanup.mjs";
import { uid } from "../../src/lib/seed-data";

type Row = Record<string, unknown>;
type Result = { data: Row[]; error: Error | null };
let db: PGlite;
const calls: string[] = [];
let failDeleteTable: string | undefined;
const creator = uid(1),
  viewer = uid(11),
  target = uid(20000),
  seed = uid(100),
  normal = uid(20001);
const name = "E2E Creator team desktop abcdef12";
const privateText = "E2E Private hello desktop abcdef12";
const thread = uid(21000),
  visitor = uid(22000),
  otherVisitor = uid(22001),
  experiment = uid(8000);
const legacy = {
  projectRef: "aaaaaaaaaaaaaaaaaaaa",
  legacy: true,
  dryRun: false,
};
const run = {
  projectRef: legacy.projectRef,
  groupNames: [name],
  inboxTexts: [privateText],
  visitorIds: [visitor],
  dryRun: false,
};

// A small PostgREST-shaped transport executes the real cleanup implementation
// against PostgreSQL. FK cascades, checks and triggers come from our migrations.
class Query implements PromiseLike<Result> {
  private operation = "select";
  private columns = "*";
  private filters: string[] = [];
  private values: unknown[] = [];
  private sort = "";
  private pagination = "";
  private updates: Row = {};
  constructor(private table: string) {}
  private bind(value: unknown) {
    this.values.push(value);
    return `$${this.values.length}`;
  }
  select(columns = "*") {
    this.columns = columns;
    return this;
  }
  delete() {
    this.operation = "delete";
    return this;
  }
  update(values: Row) {
    this.operation = "update";
    this.updates = values;
    return this;
  }
  eq(column: string, value: unknown) {
    this.filters.push(`${column} = ${this.bind(value)}`);
    return this;
  }
  like(column: string, value: string) {
    this.filters.push(`${column} like ${this.bind(value)}`);
    return this;
  }
  in(column: string, values: unknown[]) {
    this.filters.push(
      values.length
        ? `${column} in (${values.map((value) => this.bind(value)).join(",")})`
        : "false",
    );
    return this;
  }
  order(column: string, options?: { ascending: boolean }) {
    this.sort += `${this.sort ? "," : " order by "}${column} ${options?.ascending === false ? "desc" : "asc"}`;
    return this;
  }
  limit(limit: number) {
    this.pagination = ` limit ${limit}`;
    return this;
  }
  range(start: number, end: number) {
    this.pagination = ` limit ${end - start + 1} offset ${start}`;
    return this;
  }
  private async execute(): Promise<Result> {
    const where = this.filters.length
      ? ` where ${this.filters.join(" and ")}`
      : "";
    let sql: string;
    if (this.operation === "select")
      sql = `select ${this.columns} from public.${this.table}${where}${this.sort}${this.pagination}`;
    else if (this.operation === "delete")
      sql = `delete from public.${this.table}${where} returning ${this.columns}`;
    else {
      const assignments = Object.entries(this.updates).map(
        ([column, value]) => `${column} = ${this.bind(value)}`,
      );
      sql = `update public.${this.table} set ${assignments.join(",")}${where} returning ${this.columns}`;
    }
    calls.push(sql);
    if (this.operation === "delete" && this.table === failDeleteTable)
      return {
        data: [],
        error: new Error(
          "Simulated transport error with private response data",
        ),
      };
    try {
      return {
        data: (await db.query<Row>(sql, this.values)).rows,
        error: null,
      };
    } catch (error) {
      return { data: [], error: error as Error };
    }
  }
  then<TResult1 = Result, TResult2 = never>(
    onfulfilled?: ((value: Result) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}
const client = {
  from: (table: string) => new Query(table),
  auth: {
    admin: {
      listUsers: async ({
        page,
        perPage,
      }: {
        page: number;
        perPage: number;
      }) => ({
        data: {
          users: (
            await db.query(
              "select id,email from auth.users order by id limit $1 offset $2",
              [perPage, (page - 1) * perPage],
            )
          ).rows,
        },
        error: null,
      }),
    },
  },
};
async function rows(table: string) {
  return (await db.query<Row>(`select * from public.${table} order by 1`)).rows;
}
async function addGroup(id: string, groupName: string, isDemo = false) {
  await db.query(
    "insert into public.groups(id,name,slug,description,category,created_by,is_demo) values ($1,$2,$3,$4,'Friendship',$5,$6)",
    [
      id,
      groupName,
      groupName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      TEST_DESCRIPTION,
      creator,
      isDemo,
    ],
  );
}
async function event(
  id: string,
  groupId: string | null,
  session: string,
  isDemo = false,
  assigned = false,
) {
  await db.query(
    "insert into public.analytics_events(id,group_id,anonymous_session_id,event_name,dedupe_key,is_demo,experiment_id,experiment_variant) values($1::uuid,$2,$3,'group_opened',$1::text,$4,$5,$6)",
    [
      id,
      groupId,
      session,
      isDemo,
      assigned ? experiment : null,
      assigned ? "A" : null,
    ],
  );
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    set timezone='UTC';
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
    $$;
    grant usage on schema public,auth to anon,authenticated;
    grant execute on function auth.uid() to anon,authenticated;
  `);
  for (const file of [
    "001_core.sql",
    "002_analytics.sql",
    "003_service_access.sql",
    "004_profiles_roles.sql",
    "005_free_groups.sql",
    "006_private_inbox.sql",
    "007_creator_invitations.sql",
  ])
    await db.exec(
      readFileSync(
        new URL(`../../supabase/migrations/${file}`, import.meta.url),
        "utf8",
      ),
    );
  for (const [number, handle] of [
    [1, "rahul"],
    [2, "arjun"],
    [3, "priya"],
    [11, "alex"],
    [12, "chidambar"],
  ] as const)
    await db.query("insert into auth.users values($1,$2,$3)", [
      uid(number),
      `demo${String(number).padStart(2, "0")}@circles.example`,
      JSON.stringify({ display_name: handle, handle }),
    ]);
  await db.query("insert into public.growth_admins values($1)", [uid(12)]);
}, 30000);
afterAll(async () => db?.close());
beforeEach(async () => {
  calls.length = 0;
  failDeleteTable = undefined;
  await db.exec("begin");
  await addGroup(target, name);
  for (let index = 0; index < 6; index++)
    await addGroup(uid(100 + index), `Seeded circle ${index}`, true);
  await addGroup(normal, "An ordinary product circle");
  for (const groupId of [target, seed, normal]) {
    const base = groupId === target ? 30000 : groupId === seed ? 31000 : 32000;
    await db.query("insert into public.group_admins values($1,$2)", [
      groupId,
      creator,
    ]);
    await db.query(
      "insert into public.group_memberships(group_id,profile_id,status) values($1,$2,'active')",
      [groupId, viewer],
    );
    await db.query(
      "insert into public.messages(id,group_id,author_id,content) values($1,$2,$3,'A conversation message')",
      [uid(base), groupId, creator],
    );
    await db.query(
      "insert into public.message_reactions(id,message_id,profile_id,reaction) values($1,$2,$3,'👏')",
      [uid(base + 1), uid(base), viewer],
    );
    await db.query(
      "insert into public.questions(id,group_id,author_id,content,status) values($1,$2,$3,'How did this happen?','answered')",
      [uid(base + 2), groupId, viewer],
    );
    await db.query(
      "insert into public.question_answers(id,question_id,admin_id,content) values($1,$2,$3,'By working together.')",
      [uid(base + 3), uid(base + 2), creator],
    );
    await db.query(
      "insert into public.creator_invitations(id,group_id,inviter_id,invitee_id) values($1,$2,$3,$4)",
      [uid(base + 4), groupId, creator, uid(2)],
    );
  }
  await event(uid(40000), target, visitor);
  await event(uid(40001), seed, otherVisitor, true);
  await event(uid(40002), normal, otherVisitor);
  await event(uid(40003), seed, otherVisitor);
  await db.query(
    "insert into public.inbox_threads(id,participant_low,participant_high,created_at,updated_at) values($1,$2,$3,'2026-01-01','2026-01-01')",
    [thread, creator, viewer],
  );
  await db.query(
    "insert into public.inbox_messages(id,thread_id,sender_id,content,created_at) values($1,$2,$3,'A real review conversation','2026-01-02'),($4,$2,$3,$5,'2026-01-03')",
    [uid(41000), thread, viewer, uid(41001), privateText],
  );
});
afterEach(async () => db.exec("rollback"));

describe("cleanup using all seven application migrations", () => {
  it("defaults to a read-only plan with accurate child counts", async () => {
    const result = await cleanup(client, { ...legacy, dryRun: undefined });
    expect(result.dryRun).toBe(true);
    expect(result.counts).toEqual({
      groups: 1,
      group_admins: 1,
      group_memberships: 1,
      messages: 1,
      message_reactions: 1,
      questions: 1,
      question_answers: 1,
      creator_invitations: 1,
      inbox_messages: 1,
      analytics_events: 1,
      experiment_assignments: 0,
    });
    expect(calls.some((sql) => /^(delete|update)/.test(sql))).toBe(false);
    expect(await rows("groups")).toHaveLength(8);
  });
  it("cascades only owned content, removes its events before SET NULL, and preserves shared Inbox history", async () => {
    const profiles = await rows("profiles"),
      platformRoles = await rows("growth_admins"),
      experiments = await rows("experiments");
    await cleanup(client, legacy);
    expect((await rows("groups")).map((row) => row.id)).toEqual([
      ...Array.from({ length: 6 }, (_, index) => uid(100 + index)),
      normal,
    ]);
    for (const table of [
      "group_admins",
      "group_memberships",
      "messages",
      "message_reactions",
      "questions",
      "question_answers",
      "creator_invitations",
    ])
      expect(await rows(table)).toHaveLength(2);
    expect((await rows("analytics_events")).map((row) => row.id)).toEqual([
      uid(40001),
      uid(40002),
      uid(40003),
    ]);
    expect(
      calls.findIndex((sql) =>
        sql.startsWith("delete from public.analytics_events"),
      ),
    ).toBeLessThan(
      calls.findIndex((sql) => sql.startsWith("delete from public.groups")),
    );
    expect(await rows("inbox_messages")).toEqual([
      expect.objectContaining({
        id: uid(41000),
        content: "A real review conversation",
      }),
    ]);
    expect(await rows("inbox_threads")).toEqual([
      expect.objectContaining({
        id: thread,
        updated_at: new Date("2026-01-02T00:00:00Z"),
      }),
    ]);
    expect(await rows("profiles")).toEqual(profiles);
    expect(await rows("growth_admins")).toEqual(platformRoles);
    expect(await rows("experiments")).toEqual(experiments);
  });
  it("is idempotent after successful cleanup", async () => {
    await cleanup(client, legacy);
    const second = await cleanup(client, legacy);
    expect(Object.values(second.counts)).toEqual(Array(11).fill(0));
    expect(await rows("groups")).toHaveLength(7);
  });
  it("reports a sanitized failure and safely resumes after partial deletion", async () => {
    failDeleteTable = "inbox_messages";
    await expect(cleanup(client, legacy)).rejects.toThrow(
      "E2E cleanup failed during delete inbox_messages; journal retained for retry.",
    );
    expect(await rows("groups")).toHaveLength(7);
    expect(await rows("inbox_messages")).toHaveLength(2);
    failDeleteTable = undefined;
    await cleanup(client, legacy);
    expect(await rows("inbox_messages")).toHaveLength(1);
    expect(await rows("analytics_events")).toHaveLength(3);
  });
  it("limits a new run to journal identities and removes visitor events before their assignments", async () => {
    const anotherName = "E2E Creator team desktop ffffffff";
    await addGroup(uid(20002), anotherName);
    await db.query(
      "insert into public.experiment_assignments(experiment_id,anonymous_session_id,variant) values($1,$2,'A'),($1,$3,'A')",
      [experiment, visitor, otherVisitor],
    );
    await event(uid(40004), seed, visitor, false, true);
    await event(uid(40005), null, visitor, false, true);
    await event(uid(40006), seed, otherVisitor, false, true);
    await db.query(
      "insert into public.inbox_messages(id,thread_id,sender_id,content) values($1,$2,$3,'E2E Private hello desktop ffffffff')",
      [uid(41002), thread, viewer],
    );
    await cleanup(client, run);
    expect(await rows("groups")).toContainEqual(
      expect.objectContaining({ id: uid(20002) }),
    );
    expect((await rows("analytics_events")).map((row) => row.id)).toEqual([
      uid(40001),
      uid(40002),
      uid(40003),
      uid(40006),
    ]);
    expect(await rows("experiment_assignments")).toEqual([
      expect.objectContaining({ anonymous_session_id: otherVisitor }),
    ]);
    expect((await rows("inbox_messages")).map((row) => row.id)).toEqual([
      uid(41000),
      uid(41002),
    ]);
  });
  it("stops before every deletion when an owned target has protected demo analytics", async () => {
    await event(uid(40004), target, visitor, true);
    const before = await rows("groups");
    await expect(cleanup(client, legacy)).rejects.toThrow(
      "protected demo analytics",
    );
    expect(calls.some((sql) => /^(delete|update)/.test(sql))).toBe(false);
    expect(await rows("groups")).toEqual(before);
    expect(await rows("inbox_messages")).toHaveLength(2);
  });
  it("only deletes an empty thread when the journal proves this run created it", async () => {
    await db.query("delete from public.inbox_messages where id=$1", [
      uid(41000),
    ]);
    await cleanup(client, {
      ...run,
      thread: { id: thread, createdByTest: true },
    });
    expect(await rows("inbox_threads")).toHaveLength(0);
  });
  it("retains an empty historical shared thread without proof of creation", async () => {
    await db.query("delete from public.inbox_messages where id=$1", [
      uid(41000),
    ]);
    await cleanup(client, legacy);
    expect(await rows("inbox_threads")).toHaveLength(1);
    expect(await rows("inbox_messages")).toHaveLength(0);
  });
  it("cleans more than one read page and delete batch without orphaned analytics", async () => {
    await db.query(
      "insert into public.analytics_events(group_id,anonymous_session_id,event_name,dedupe_key) select $1,$2,'group_opened','page-event-'||n from generate_series(1,501) n",
      [target, visitor],
    );
    const result = await cleanup(client, legacy);
    expect(result.counts.analytics_events).toBe(502);
    expect(await rows("analytics_events")).toHaveLength(3);
    expect(
      calls.filter((sql) =>
        sql.startsWith("delete from public.analytics_events"),
      ),
    ).toHaveLength(6);
  });
  it("fails closed when a seeded account handle no longer identifies the intended actor", async () => {
    await db.query(
      "update public.profiles set handle='renamed_creator' where id=$1",
      [creator],
    );
    await expect(cleanup(client, legacy)).rejects.toThrow("identity mismatch");
    expect(calls.some((sql) => /^(delete|update)/.test(sql))).toBe(false);
    expect(await rows("groups")).toHaveLength(8);
  });
});
