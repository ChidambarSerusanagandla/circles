import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { uid } from "../../src/lib/seed-data";
let db: PGlite;
const admin = uid(1),
  reader = uid(2),
  other = uid(3),
  group = uid(100),
  otherGroup = uid(101),
  message = uid(1000),
  question = uid(7000);
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key, raw_user_meta_data jsonb); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema public,auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;`,
  );
  await db.exec(
    readFileSync(
      new URL("../../supabase/migrations/001_core.sql", import.meta.url),
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      new URL("../../supabase/migrations/002_analytics.sql", import.meta.url),
      "utf8",
    ),
  );
  await db.exec("create role service_role bypassrls;");
  await db.exec(
    readFileSync(
      new URL(
        "../../supabase/migrations/003_service_access.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  for (const [id, name] of [
    [admin, "Creator"],
    [reader, "Reader"],
    [other, "Other creator"],
  ])
    await db.query("insert into auth.users values ($1,$2)", [
      id,
      JSON.stringify({ display_name: name }),
    ]);
  for (const [id, slug, creator] of [
    [group, "first-circle", admin],
    [otherGroup, "second-circle", other],
  ]) {
    await db.query(
      "insert into public.groups(id,name,slug,description,category,created_by) values ($1,'Test circle',$2,'A conversation for testing','Career',$3)",
      [id, slug, creator],
    );
    await db.query("insert into public.group_admins values ($1,$2)", [
      id,
      creator,
    ]);
  }
  await db.query(
    "insert into public.messages(id,group_id,author_id,content) values ($1,$2,$3,'First message')",
    [message, group, admin],
  );
  await db.query(
    "insert into public.group_memberships(group_id,profile_id,status) values ($1,$2,'active')",
    [group, reader],
  );
  await db.query(
    "insert into public.questions(id,group_id,author_id,content) values ($1,$2,$3,'How did you meet?')",
    [question, group, reader],
  );
  await db.query("insert into public.growth_admins(profile_id) values ($1)", [
    admin,
  ]);
  const experiment = "00000000-0000-4000-8000-000000008000";
  for (const [visitor, variant] of [
    [uid(10000), "A"],
    [uid(10001), "A"],
    [uid(20000), "B"],
    [uid(20001), "B"],
    [uid(20002), "B"],
  ])
    await db.query(
      "insert into public.experiment_assignments(experiment_id,anonymous_session_id,variant) values ($1,$2,$3)",
      [experiment, visitor, variant],
    );
  const events = [
    [10000, "A", group, "group_preview_seen", 0, true],
    [10000, "A", group, "group_preview_seen", 0, true],
    [10000, "A", group, "group_opened", 1, true],
    [10000, "A", group, "group_joined", 2, true],
    [10001, "A", group, "group_joined", -1, true],
    [10001, "A", group, "group_preview_seen", 0, true],
    [20000, "B", otherGroup, "group_preview_seen", 0, true],
    [20000, "B", group, "group_joined", 1, true],
    [20001, "B", group, "group_preview_seen", 0, true],
    [20001, "B", group, "group_joined", 200, true],
    [20002, "B", group, "group_preview_seen", 0, false],
    [20002, "B", group, "group_joined", 1, false],
  ];
  for (const [i, event] of events.entries()) {
    const [visitor, variant, g, name, hours, demo] = event;
    await db.query(
      "insert into public.analytics_events(anonymous_session_id,group_id,event_name,experiment_id,experiment_variant,is_demo,dedupe_key,created_at) values ($1,$2,$3,$4,$5,$6,$7,$8)",
      [
        uid(Number(visitor)),
        g,
        name,
        experiment,
        variant,
        demo,
        "seed-" + i,
        new Date(Date.UTC(2026, 8, 1, Number(hours))).toISOString(),
      ],
    );
  }
}, 30000);
afterAll(async () => db?.close());
async function asUser(id: string | null, run: () => Promise<void>) {
  await db.exec("begin");
  try {
    await db.exec(`set local role ${id ? "authenticated" : "anon"}`);
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
      id || "",
    ]);
    await run();
  } finally {
    await db.exec("rollback");
  }
}
describe("PostgreSQL permissions and RLS", () => {
  it("allows public reading but hides pending questions", async () =>
    asUser(null, async () => {
      expect(
        (await db.query("select * from public.messages")).rows,
      ).toHaveLength(1);
      expect(
        (await db.query("select * from public.questions")).rows,
      ).toHaveLength(0);
    }));
  it("denies anonymous mutations", async () =>
    asUser(null, async () => {
      await expect(
        db.query(
          "insert into public.group_memberships(group_id,profile_id,status) values ($1,$2,'active')",
          [otherGroup, reader],
        ),
      ).rejects.toThrow();
    }));
  it("allows own membership and rejects a concurrent-style retry", async () =>
    asUser(reader, async () => {
      await db.query(
        "insert into public.group_memberships(group_id,profile_id,status) values ($1,$2,'active')",
        [otherGroup, reader],
      );
      await expect(
        db.query(
          "insert into public.group_memberships(group_id,profile_id,status) values ($1,$2,'active')",
          [otherGroup, reader],
        ),
      ).rejects.toThrow(/unique|duplicate/i);
    }));
  it("rejects forged member identity", async () =>
    asUser(reader, async () => {
      await expect(
        db.query(
          "insert into public.group_memberships(group_id,profile_id,status) values ($1,$2,'active')",
          [otherGroup, admin],
        ),
      ).rejects.toThrow(/policy/i);
    }));
  it("does not reveal another reader’s membership", async () =>
    asUser(admin, async () => {
      expect(
        (await db.query("select * from public.group_memberships")).rows,
      ).toHaveLength(0);
      expect(
        (
          await db.query(
            "select * from public.group_counts() where group_id=$1",
            [group],
          )
        ).rows,
      ).toMatchObject([{ member_count: 1 }]);
    }));
  it("prevents viewers impersonating creators", async () =>
    asUser(reader, async () => {
      await expect(
        db.query(
          "insert into public.messages(group_id,author_id,content) values ($1,$2,'Forged')",
          [group, admin],
        ),
      ).rejects.toThrow(/policy/i);
    }));
  it("prevents a creator publishing to another group", async () =>
    asUser(admin, async () => {
      await expect(
        db.query(
          "insert into public.messages(group_id,author_id,content) values ($1,$2,'Wrong group')",
          [otherGroup, admin],
        ),
      ).rejects.toThrow(/policy/i);
    }));
  it("allows creators to publish and prevents ownership changes", async () =>
    asUser(admin, async () => {
      await db.query(
        "insert into public.messages(group_id,author_id,content) values ($1,$2,'Allowed')",
        [group, admin],
      );
      await expect(
        db.query("update public.groups set created_by=$1 where id=$2", [
          reader,
          group,
        ]),
      ).rejects.toThrow(/permission/i);
    }));
  it("allows own profile edits but not someone else’s", async () =>
    asUser(reader, async () => {
      await db.query(
        "update public.profiles set display_name='Changed' where id=$1",
        [admin],
      );
      expect(
        (
          await db.query<{ display_name: string }>(
            "select display_name from public.profiles where id=$1",
            [admin],
          )
        ).rows[0].display_name,
      ).toBe("Creator");
      await db.query(
        "update public.profiles set display_name='Me' where id=$1",
        [reader],
      );
    }));
  it("validates reactions and prevents duplicates", async () =>
    asUser(reader, async () => {
      await db.query(
        "insert into public.message_reactions(message_id,profile_id,reaction) values ($1,$2,'❤️')",
        [message, reader],
      );
      await expect(
        db.query(
          "insert into public.message_reactions(message_id,profile_id,reaction) values ($1,$2,'❤️')",
          [message, reader],
        ),
      ).rejects.toThrow(/unique|duplicate/i);
    }));
  it("requires membership before asking", async () =>
    asUser(admin, async () => {
      await expect(
        db.query(
          "insert into public.questions(group_id,author_id,content) values ($1,$2,'A question?')",
          [group, admin],
        ),
      ).rejects.toThrow(/policy/i);
    }));
  it("does not permit direct question moderation", async () =>
    asUser(reader, async () => {
      await expect(
        db.query("update public.questions set status='answered' where id=$1", [
          question,
        ]),
      ).rejects.toThrow(/permission/i);
    }));
  it("denies another circle’s admin answering", async () =>
    asUser(other, async () => {
      await expect(
        db.query("select public.answer_question($1,'Unauthorized')", [
          question,
        ]),
      ).rejects.toThrow(/admins/i);
    }));
  it("answers atomically and refuses a second answer", async () =>
    asUser(admin, async () => {
      await db.query(
        "select public.answer_question($1,'We met at university.')",
        [question],
      );
      expect(
        (await db.query("select * from public.question_answers")).rows,
      ).toHaveLength(1);
      expect(
        (await db.query("select * from public.messages")).rows,
      ).toHaveLength(2);
      expect(
        (
          await db.query<{ status: string }>(
            "select status from public.questions where id=$1",
            [question],
          )
        ).rows[0].status,
      ).toBe("answered");
      await expect(
        db.query("select public.answer_question($1,'Again')", [question]),
      ).rejects.toThrow(/already/);
    }));
  it("creates the group and first admin in one transaction", async () =>
    asUser(reader, async () => {
      const result = await db.query<{ create_group: string }>(
        "select public.create_group('A new circle','a-new-circle','A conversation for curious people','Friendship')",
      );
      expect(
        (
          await db.query(
            "select * from public.group_admins where group_id=$1 and profile_id=$2",
            [result.rows[0].create_group, reader],
          )
        ).rows,
      ).toHaveLength(1);
    }));
  it("rejects a premium circle without a price", async () => {
    await expect(
      db.query(
        "insert into public.groups(name,slug,description,category,created_by,access_type) values ('Bad premium','bad-premium','A missing price is invalid','Career',$1,'premium')",
        [admin],
      ),
    ).rejects.toThrow(/check/i);
  });
});

describe("SQL analytics isolation", () => {
  it("grants the trusted service role actual table privileges", async () => {
    await db.exec("begin; set local role service_role;");
    try {
      await db.query(
        "insert into public.experiment_assignments(experiment_id,anonymous_session_id,variant) values ($1,$2,'A')",
        ["00000000-0000-4000-8000-000000008000", uid(99900)],
      );
      await db.query(
        "insert into public.analytics_events(anonymous_session_id,event_name,dedupe_key) values ($1,'discover_viewed','service-test')",
        [uid(99900)],
      );
      expect(
        (
          await db.query(
            "select * from public.analytics_events where dedupe_key='service-test'",
          )
        ).rows,
      ).toHaveLength(1);
    } finally {
      await db.exec("rollback");
    }
  });
  it("computes deduplicated, ordered seven-day visitor conversions", async () =>
    asUser(admin, async () => {
      expect(
        (await db.query("select * from public.preview_funnel(true)")).rows,
      ).toEqual([
        { variant: "A", visitors: 2, opens: 1, joins: 1 },
        { variant: "B", visitors: 2, opens: 0, joins: 0 },
      ]);
      expect(
        (
          await db.query(
            "select * from public.preview_funnel(false) where variant='B'",
          )
        ).rows,
      ).toEqual([{ variant: "B", visitors: 1, opens: 0, joins: 1 }]);
    }));
  it("prevents viewers from forging event rows", async () =>
    asUser(reader, async () => {
      await expect(
        db.query(
          "insert into public.analytics_events(anonymous_session_id,event_name,dedupe_key) values ($1,'group_joined','forged')",
          [reader],
        ),
      ).rejects.toThrow(/permission/i);
    }));
  it("denies global growth metrics to an ordinary group creator", async () =>
    asUser(other, async () => {
      await expect(
        db.query("select * from public.preview_funnel(false)"),
      ).rejects.toThrow(/growth access/i);
    }));
  it("denies another group’s creator metrics", async () =>
    asUser(other, async () => {
      await expect(
        db.query("select * from public.creator_metrics($1,false)", [group]),
      ).rejects.toThrow(/Creator access/i);
    }));
  it("does not let users grant themselves internal access", async () =>
    asUser(reader, async () => {
      await expect(
        db.query("insert into public.growth_admins(profile_id) values ($1)", [
          reader,
        ]),
      ).rejects.toThrow(/permission/i);
    }));
});
