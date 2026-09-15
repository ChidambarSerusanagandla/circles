import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { uid } from "../../src/lib/seed-data";

let db: PGlite;
const creator = uid(1);
const reader = uid(2);
const existingMember = uid(3);
const convertedGroup = uid(100);
const existingFreeGroup = uid(101);
const importedLegacyGroup = uid(102);
const joinedAt = "2026-09-01T12:00:00.000Z";

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
  for (const file of [
    "001_core.sql",
    "002_analytics.sql",
    "003_service_access.sql",
    "004_profiles_roles.sql",
  ])
    await migrate(file);
  for (const [id, name] of [
    [creator, "Circle Creator"],
    [reader, "New Reader"],
    [existingMember, "Existing Member"],
  ])
    await db.query("insert into auth.users values ($1,$2,$3)", [
      id,
      `${id}@example.test`,
      JSON.stringify({ display_name: name }),
    ]);
  await db.query(
    "insert into public.groups(id,name,slug,description,category,created_by,access_type,monthly_price) values ($1,'Previously priced','previously-priced','An existing group with paid metadata','Career',$3,'premium',4.99),($2,'Already free','already-free','An existing group open to everyone','Friendship',$3,'free',null)",
    [convertedGroup, existingFreeGroup, creator],
  );
  await db.query("insert into public.group_admins values ($1,$3),($2,$3)", [
    convertedGroup,
    existingFreeGroup,
    creator,
  ]);
  await db.query(
    "insert into public.group_memberships(group_id,profile_id,status,joined_at) values ($1,$2,'premium_demo',$3)",
    [convertedGroup, existingMember, joinedAt],
  );
  await migrate("005_free_groups.sql");
  // Trusted imports may retain dormant metadata; current membership policy
  // must still let viewers join freely without creating a paid entitlement.
  await db.exec("set role service_role");
  await db.query(
    "insert into public.groups(id,name,slug,description,category,created_by,access_type,monthly_price) values ($1,'Legacy import','legacy-import','Imported historical pricing metadata','Career',$2,'premium',9.99)",
    [importedLegacyGroup, creator],
  );
  await db.exec("reset role");
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

describe("free group migration and membership", () => {
  it("converts existing groups to free without removing their identity", async () => {
    expect(
      (
        await db.query(
          "select id,name,created_by,access_type,monthly_price from public.groups where id in ($1,$2) order by id",
          [convertedGroup, existingFreeGroup],
        )
      ).rows,
    ).toEqual([
      {
        id: convertedGroup,
        name: "Previously priced",
        created_by: creator,
        access_type: "free",
        monthly_price: null,
      },
      {
        id: existingFreeGroup,
        name: "Already free",
        created_by: creator,
        access_type: "free",
        monthly_price: null,
      },
    ]);
  });
  it("converts old demo entitlements while preserving membership and join time", async () => {
    const { rows } = await db.query<{
      group_id: string;
      profile_id: string;
      status: string;
      joined_at: Date;
    }>(
      "select * from public.group_memberships where group_id=$1 and profile_id=$2",
      [convertedGroup, existingMember],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      group_id: convertedGroup,
      profile_id: existingMember,
      status: "active",
    });
    expect(rows[0].joined_at.toISOString()).toBe(joinedAt);
  });
  it("retains dormant metadata columns and service-role compatibility", async () => {
    expect(
      (
        await db.query(
          "select access_type,monthly_price from public.groups where id=$1",
          [importedLegacyGroup],
        )
      ).rows,
    ).toEqual([{ access_type: "premium", monthly_price: "9.99" }]);
  });
  it.each([convertedGroup, importedLegacyGroup])(
    "allows ordinary active joining for %s",
    async (groupId) =>
      asUser(reader, async () => {
        await db.query(
          "insert into public.group_memberships(group_id,profile_id,status) values ($1,$2,'active')",
          [groupId, reader],
        );
        expect(
          (
            await db.query(
              "select status from public.group_memberships where group_id=$1",
              [groupId],
            )
          ).rows,
        ).toEqual([{ status: "active" }]);
      }),
  );
  it.each([convertedGroup, importedLegacyGroup])(
    "rejects a paid demo entitlement for %s",
    async (groupId) =>
      asUser(reader, async () => {
        await expect(
          db.query(
            "insert into public.group_memberships(group_id,profile_id,status) values ($1,$2,'premium_demo')",
            [groupId, reader],
          ),
        ).rejects.toThrow(/policy/i);
      }),
  );
  it("still rejects forged membership identity", async () =>
    asUser(reader, async () => {
      await expect(
        db.query(
          "insert into public.group_memberships(group_id,profile_id,status) values ($1,$2,'active')",
          [existingFreeGroup, creator],
        ),
      ).rejects.toThrow(/policy/i);
    }));
  it("still prevents duplicate memberships", async () =>
    asUser(existingMember, async () => {
      await expect(
        db.query(
          "insert into public.group_memberships(group_id,profile_id,status) values ($1,$2,'active')",
          [convertedGroup, existingMember],
        ),
      ).rejects.toThrow(/unique|duplicate/i);
    }));
  it("still requires sign-in for joining", async () =>
    asUser(null, async () => {
      await expect(
        db.query(
          "insert into public.group_memberships(group_id,profile_id,status) values ($1,$2,'active')",
          [existingFreeGroup, reader],
        ),
      ).rejects.toThrow(/permission/i);
    }));
});

describe("creators cannot activate dormant pricing", () => {
  it("retains ordinary creator settings updates", async () =>
    asUser(creator, async () => {
      await db.query(
        "update public.groups set name='A new free chapter' where id=$1",
        [convertedGroup],
      );
      expect(
        (
          await db.query(
            "select name,access_type,monthly_price from public.groups where id=$1",
            [convertedGroup],
          )
        ).rows,
      ).toEqual([
        {
          name: "A new free chapter",
          access_type: "free",
          monthly_price: null,
        },
      ]);
    }));
  it("keeps pricing columns outside authenticated update privileges", async () =>
    asUser(creator, async () => {
      await expect(
        db.query(
          "update public.groups set access_type='premium',monthly_price=4.99 where id=$1",
          [convertedGroup],
        ),
      ).rejects.toThrow(/permission/i);
    }));
  it("RLS independently rejects activation even with pricing column privileges", async () => {
    await db.exec("begin");
    try {
      await db.exec(
        "grant update(access_type,monthly_price) on public.groups to authenticated; set local role authenticated;",
      );
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
        creator,
      ]);
      await expect(
        db.query(
          "update public.groups set access_type='premium',monthly_price=4.99 where id=$1",
          [convertedGroup],
        ),
      ).rejects.toThrow(/policy/i);
    } finally {
      await db.exec("rollback");
    }
  });
  it("keeps direct group creation ungranted", async () =>
    asUser(creator, async () => {
      await expect(
        db.query(
          "insert into public.groups(name,slug,description,category,created_by,access_type,monthly_price) values ('Paid attempt','paid-attempt','An unauthorized pricing attempt','Career',$1,'premium',4.99)",
          [creator],
        ),
      ).rejects.toThrow(/permission/i);
    }));
  it("the restrictive insert guard rejects paid creation even with a permissive grant", async () => {
    await db.exec("begin");
    try {
      await db.exec(
        "grant insert on public.groups to authenticated; create policy test_permissive_insert on public.groups for insert to authenticated with check (true); set local role authenticated;",
      );
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
        creator,
      ]);
      await expect(
        db.query(
          "insert into public.groups(name,slug,description,category,created_by,access_type,monthly_price) values ('Paid attempt','paid-attempt','An unauthorized pricing attempt','Career',$1,'premium',4.99)",
          [creator],
        ),
      ).rejects.toThrow(/policy/i);
    } finally {
      await db.exec("rollback");
    }
  });
  it("the existing creation RPC still creates a free circle and its creator", async () =>
    asUser(reader, async () => {
      const result = await db.query<{ create_group: string }>(
        "select public.create_group('Readers at Lunch','readers-at-lunch','A free conversation around lunch','Friendship')",
      );
      const id = result.rows[0].create_group;
      expect(
        (
          await db.query(
            "select access_type,monthly_price from public.groups where id=$1",
            [id],
          )
        ).rows,
      ).toEqual([{ access_type: "free", monthly_price: null }]);
      expect(
        (
          await db.query(
            "select * from public.group_admins where group_id=$1 and profile_id=$2",
            [id, reader],
          )
        ).rows,
      ).toHaveLength(1);
    }));
});
