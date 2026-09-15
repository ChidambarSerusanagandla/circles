import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { uid } from "../../src/lib/seed-data";

let db: PGlite;
let thread: string;
const sender = uid(1),
  recipient = uid(2),
  stranger = uid(3);
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema public,auth to anon,authenticated;
    grant execute on function auth.uid() to anon,authenticated;
  `);
  for (const file of [
    "001_core.sql",
    "002_analytics.sql",
    "003_service_access.sql",
    "004_profiles_roles.sql",
    "006_private_inbox.sql",
  ]) {
    await db.exec(
      readFileSync(
        new URL(`../../supabase/migrations/${file}`, import.meta.url),
        "utf8",
      ),
    );
  }
  for (const [id, handle] of [
    [sender, "rahul"],
    [recipient, "arjun"],
    [stranger, "priya"],
  ]) {
    await db.query("insert into auth.users values ($1,$2,$3)", [
      id,
      `${handle}@example.test`,
      JSON.stringify({ display_name: handle, handle }),
    ]);
  }
  // Platform analytics access does not grant access to other people's messages.
  await db.query("insert into public.growth_admins values ($1)", [stranger]);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    sender,
  ]);
  thread = (
    await db.query<{ id: string }>(
      "select public.start_inbox_thread('arjun') as id",
    )
  ).rows[0].id;
  await db.query(
    "insert into public.inbox_messages(thread_id,sender_id,content) values($1,$2,'Hello from Rahul')",
    [thread, sender],
  );
  await db.query("select set_config('request.jwt.claim.sub','',false)");
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

describe("private Inbox PostgreSQL authorization", () => {
  it("allows both participants to read and send", async () => {
    for (const person of [sender, recipient])
      await asUser(person, async () => {
        expect(
          (await db.query("select * from public.inbox_threads")).rows,
        ).toHaveLength(1);
        expect(
          (await db.query("select * from public.inbox_messages")).rows,
        ).toHaveLength(1);
        await db.query(
          "insert into public.inbox_messages(thread_id,sender_id,content) values($1,$2,'Reply')",
          [thread, person],
        );
        expect(
          (
            await db.query("select * from public.inbox_message_page($1)", [
              thread,
            ])
          ).rows,
        ).toHaveLength(2);
      });
  });
  it("denies anonymous reads and conversation creation", async () => {
    await asUser(null, async () => {
      await expect(
        db.query("select * from public.inbox_messages"),
      ).rejects.toThrow(/permission denied/);
    });
    await asUser(null, async () => {
      await expect(
        db.query("select public.start_inbox_thread('rahul')"),
      ).rejects.toThrow(/permission denied/);
    });
  });
  it("returns no private rows to a third party, even through pagination RPC", async () =>
    asUser(stranger, async () => {
      expect(
        (await db.query("select * from public.inbox_threads")).rows,
      ).toHaveLength(0);
      expect(
        (await db.query("select * from public.inbox_messages")).rows,
      ).toHaveLength(0);
      expect(
        (
          await db.query("select * from public.inbox_message_page($1)", [
            thread,
          ])
        ).rows,
      ).toHaveLength(0);
    }));
  it("rejects posting into another pair’s thread", async () =>
    asUser(stranger, async () => {
      await expect(
        db.query(
          "insert into public.inbox_messages(thread_id,sender_id,content) values($1,$2,'Intrusion')",
          [thread, stranger],
        ),
      ).rejects.toThrow(/row-level security/);
    }));
  it("rejects impersonating the other participant", async () =>
    asUser(sender, async () => {
      await expect(
        db.query(
          "insert into public.inbox_messages(thread_id,sender_id,content) values($1,$2,'Impersonation')",
          [thread, recipient],
        ),
      ).rejects.toThrow(/row-level security/);
    }));
  it("prevents direct creation of arbitrary pairs", async () =>
    asUser(sender, async () => {
      await expect(
        db.query(
          "insert into public.inbox_threads(participant_low,participant_high) values($1,$2)",
          [recipient, stranger],
        ),
      ).rejects.toThrow(/permission denied/);
    }));
  it("deduplicates reverse-order conversation requests", async () =>
    asUser(recipient, async () => {
      const result = await db.query<{ id: string }>(
        "select public.start_inbox_thread(' @RAHUL ') as id",
      );
      expect(result.rows[0].id).toBe(thread);
      expect(
        (await db.query("select * from public.inbox_threads")).rows,
      ).toHaveLength(1);
    }));
  it.each(["rahul", "no_such_user", "bad handle"])(
    "rejects self, missing, or invalid recipient %s",
    async (handle) =>
      asUser(sender, async () => {
        await expect(
          db.query("select public.start_inbox_thread($1)", [handle]),
        ).rejects.toThrow(/another person|No person|Invalid handle/);
      }),
  );
  it.each(["   ", "a".repeat(2001)])(
    "rejects invalid message content",
    async (content) =>
      asUser(sender, async () => {
        await expect(
          db.query(
            "insert into public.inbox_messages(thread_id,sender_id,content) values($1,$2,$3)",
            [thread, sender, content],
          ),
        ).rejects.toThrow(/check constraint/);
      }),
  );
  it("does not let participants alter message history", async () =>
    asUser(sender, async () => {
      await expect(
        db.query("update public.inbox_messages set content='Changed'"),
      ).rejects.toThrow(/permission denied/);
    }));
  it("paginates tied timestamps without skipping or repeating messages", async () => {
    await db.exec("begin");
    try {
      await db.query("delete from public.inbox_messages where thread_id=$1", [
        thread,
      ]);
      for (let index = 0; index < 60; index++)
        await db.query(
          "insert into public.inbox_messages(id,thread_id,sender_id,content,created_at) values($1,$2,$3,$4,'2026-09-14T12:00:00Z')",
          [uid(1000 + index), thread, sender, `Message ${index}`],
        );
      await db.exec("set local role authenticated");
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
        recipient,
      ]);
      const first = await db.query<{ id: string; created_at: string }>(
        "select * from public.inbox_message_page($1)",
        [thread],
      );
      expect(first.rows).toHaveLength(51);
      const cursor = first.rows[49];
      const older = await db.query<{ id: string }>(
        "select * from public.inbox_message_page($1,$2,$3)",
        [thread, cursor.created_at, cursor.id],
      );
      expect(older.rows).toHaveLength(10);
      expect(
        new Set(
          [...first.rows.slice(0, 50), ...older.rows].map((row) => row.id),
        ).size,
      ).toBe(60);
    } finally {
      await db.exec("rollback");
    }
  });
});
