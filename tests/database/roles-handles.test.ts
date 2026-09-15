import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { uid } from "../../src/lib/seed-data";
import { seedEmail, seedPeople, seedPlan } from "../../src/lib/seed-plan";

let db: PGlite;
const legacyCreator = uid(1);
const reader = uid(2);
const creator = uid(3);
const internalAdmin = uid(901);
const existingAdmin = uid(905);
const group = uid(100);
const experiment = uid(8000);

async function migrate(name: string) {
  await db.exec(
    readFileSync(
      new URL(`../../supabase/migrations/${name}`, import.meta.url),
      "utf8",
    ),
  );
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
    $$;
    grant usage on schema public,auth to anon,authenticated;
    grant execute on function auth.uid() to anon,authenticated;
  `);
  await migrate("001_core.sql");
  await migrate("002_analytics.sql");
  await migrate("003_service_access.sql");
  for (const [id, name, email] of [
    [legacyCreator, "Rahul Mehta", "demo01@circles.example"],
    [reader, "Normal Reader", "reader@example.test"],
    [creator, "Group Creator", "creator@example.test"],
    [internalAdmin, "Chidambar Rao Serusanagandla", "demo12@circles.example"],
    [existingAdmin, "Designated Admin", "appointed@example.test"],
  ]) {
    await db.query("insert into auth.users values ($1,$2,$3)", [
      id,
      email,
      JSON.stringify({ display_name: name }),
    ]);
  }
  await db.query(
    "insert into public.groups(id,name,slug,description,category,created_by,is_demo) values ($1,'Creator circle','creator-circle','An existing fictional conversation','Career',$2,true)",
    [group, creator],
  );
  await db.query("insert into public.group_admins values ($1,$2),($1,$3)", [
    group,
    creator,
    legacyCreator,
  ]);
  await db.query("insert into public.growth_admins values ($1),($2),($3)", [
    legacyCreator,
    internalAdmin,
    existingAdmin,
  ]);
  await migrate("004_profiles_roles.sql");
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

describe("optional unique handles", () => {
  it("preserves existing profiles without inventing handles", async () => {
    const { rows } = await db.query<{
      id: string;
      display_name: string;
      handle: string | null;
    }>("select id,display_name,handle from public.profiles order by id");
    expect(rows).toHaveLength(5);
    expect(rows.every((p) => p.handle === null)).toBe(true);
    expect(rows.find((p) => p.id === internalAdmin)?.display_name).toBe(
      "Chidambar Rao Serusanagandla",
    );
  });
  it("allows a reader to set and clear their own handle", async () =>
    asUser(reader, async () => {
      await db.query(
        "update public.profiles set handle='reader_2026' where id=$1",
        [reader],
      );
      expect(
        (
          await db.query("select handle from public.profiles where id=$1", [
            reader,
          ])
        ).rows,
      ).toEqual([{ handle: "reader_2026" }]);
      await db.query("update public.profiles set handle=null where id=$1", [
        reader,
      ]);
    }));
  it("does not let a reader change someone else’s handle", async () =>
    asUser(reader, async () => {
      await db.query("update public.profiles set handle='stolen' where id=$1", [
        creator,
      ]);
      expect(
        (
          await db.query("select handle from public.profiles where id=$1", [
            creator,
          ])
        ).rows,
      ).toEqual([{ handle: null }]);
    }));
  it("enforces unique handles across profiles", async () => {
    await db.exec("begin");
    try {
      await db.query(
        "update public.profiles set handle='same_handle' where id=$1",
        [reader],
      );
      await expect(
        db.query(
          "update public.profiles set handle='same_handle' where id=$1",
          [creator],
        ),
      ).rejects.toThrow(/unique|duplicate/i);
    } finally {
      await db.exec("rollback");
    }
  });
  it.each([
    "ab",
    "1reader",
    "MixedCase",
    "has-dash",
    "has space",
    "a".repeat(31),
  ])("rejects invalid stored handle %s", async (handle) =>
    asUser(reader, async () => {
      await expect(
        db.query("update public.profiles set handle=$1 where id=$2", [
          handle,
          reader,
        ]),
      ).rejects.toThrow(/check/i);
    }),
  );
  it("normalizes optional signup handles and ignores role metadata", async () => {
    await db.exec("begin");
    try {
      const id = uid(990);
      await db.query(
        "insert into auth.users values ($1,'new@example.test',$2)",
        [
          id,
          JSON.stringify({
            display_name: "New Reader",
            handle: "  New_Reader  ",
            platform_admin: true,
          }),
        ],
      );
      expect(
        (await db.query("select handle from public.profiles where id=$1", [id]))
          .rows,
      ).toEqual([{ handle: "new_reader" }]);
      expect(
        (
          await db.query(
            "select * from public.growth_admins where profile_id=$1",
            [id],
          )
        ).rows,
      ).toHaveLength(0);
    } finally {
      await db.exec("rollback");
    }
  });
  it("accepts signup without a handle", async () => {
    await db.exec("begin");
    try {
      const id = uid(991);
      await db.query(
        "insert into auth.users values ($1,'optional@example.test',$2)",
        [id, JSON.stringify({ display_name: "Optional Reader" })],
      );
      expect(
        (await db.query("select handle from public.profiles where id=$1", [id]))
          .rows,
      ).toEqual([{ handle: null }]);
    } finally {
      await db.exec("rollback");
    }
  });
});

describe("independent platform and creator roles", () => {
  it("removes only the legacy fictional seed grant", async () => {
    const { rows } = await db.query<{ profile_id: string }>(
      "select profile_id from public.growth_admins",
    );
    expect(rows.map((r) => r.profile_id).sort()).toEqual(
      [internalAdmin, existingAdmin].sort(),
    );
  });
  it("starts with the short default and retains the experiment", async () => {
    expect(
      (
        await db.query("select status from public.experiments where id=$1", [
          experiment,
        ])
      ).rows,
    ).toEqual([{ status: "draft" }]);
  });
  it("allows a standalone platform admin to read the Growth report", async () =>
    asUser(internalAdmin, async () => {
      expect(
        (await db.query("select public.is_group_admin($1) as allowed", [group]))
          .rows,
      ).toEqual([{ allowed: false }]);
      expect(
        (await db.query("select * from public.preview_funnel(true)")).rows,
      ).toHaveLength(2);
      expect(
        (await db.query("select * from public.experiments")).rows,
      ).toHaveLength(1);
    }));
  it("does not give platform admins creator posting rights", async () =>
    asUser(internalAdmin, async () => {
      await expect(
        db.query(
          "insert into public.messages(group_id,author_id,content) values ($1,$2,'Unauthorized post')",
          [group, internalAdmin],
        ),
      ).rejects.toThrow(/policy/i);
    }));
  it("does not give platform admins another group’s creator metrics", async () =>
    asUser(internalAdmin, async () => {
      await expect(
        db.query("select * from public.creator_metrics($1,true)", [group]),
      ).rejects.toThrow(/Creator access/i);
    }));
  it.each([reader, creator, legacyCreator])(
    "denies Growth reporting to %s",
    async (id) =>
      asUser(id, async () => {
        expect(
          (await db.query("select * from public.experiments")).rows,
        ).toHaveLength(0);
        expect(
          (await db.query("select * from public.analytics_events")).rows,
        ).toHaveLength(0);
        await expect(
          db.query("select * from public.preview_funnel(true)"),
        ).rejects.toThrow(/growth access/i);
      }),
  );
  it("allows creators their own simple metrics", async () =>
    asUser(creator, async () => {
      expect(
        (
          await db.query("select * from public.creator_metrics($1,true)", [
            group,
          ])
        ).rows,
      ).toHaveLength(1);
    }));
  it.each([reader, creator])(
    "denies experiment configuration to %s",
    async (id) =>
      asUser(id, async () => {
        await expect(
          db.query("select public.set_preview_experiment_status('running')"),
        ).rejects.toThrow(/growth access/i);
      }),
  );
  it("denies anonymous experiment configuration", async () =>
    asUser(null, async () => {
      await expect(
        db.query("select public.set_preview_experiment_status('running')"),
      ).rejects.toThrow(/permission/i);
    }));
  it("lets only the platform admin start and stop the preview experiment", async () =>
    asUser(internalAdmin, async () => {
      for (const status of ["running", "completed", "draft"]) {
        await db.query("select public.set_preview_experiment_status($1)", [
          status,
        ]);
        expect(
          (
            await db.query(
              "select status from public.experiments where id=$1",
              [experiment],
            )
          ).rows,
        ).toEqual([{ status }]);
      }
    }));
  it("rejects an unsupported experiment state", async () =>
    asUser(internalAdmin, async () => {
      await expect(
        db.query("select public.set_preview_experiment_status('unknown')"),
      ).rejects.toThrow(/Invalid experiment status/i);
    }));
  it("does not permit a creator to self-grant platform access", async () =>
    asUser(creator, async () => {
      await expect(
        db.query("insert into public.growth_admins values ($1)", [creator]),
      ).rejects.toThrow(/permission/i);
    }));
});

describe("separate project-owner seed", () => {
  it("preserves fictional accounts and keeps the owner out of their content", () => {
    const owner = seedPeople.find((p) => p.id === internalAdmin)!;
    const plan = seedPlan();
    expect(seedPeople).toHaveLength(12);
    expect(owner).toEqual({
      id: internalAdmin,
      display_name: "Chidambar Rao Serusanagandla",
      handle: "chidambar",
    });
    expect(seedEmail(seedPeople.indexOf(owner))).toBe("demo12@circles.example");
    expect(new Set(plan.profiles.map((p) => p.handle)).size).toBe(12);
    expect(plan.groups.some((g) => g.created_by === internalAdmin)).toBe(false);
    expect(plan.admins.some((a) => a.profile_id === internalAdmin)).toBe(false);
    expect(plan.messages.some((m) => m.author_id === internalAdmin)).toBe(
      false,
    );
    expect(plan.memberships.some((m) => m.profile_id === internalAdmin)).toBe(
      false,
    );
  });
});
