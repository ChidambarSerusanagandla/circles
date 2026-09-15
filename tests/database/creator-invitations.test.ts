import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { uid } from "../../src/lib/seed-data";

let db: PGlite;
const creator = uid(1),
  coCreator = uid(2),
  invited = uid(3),
  secondInvitee = uid(4);
const thirdInvitee = uid(5),
  fourthInvitee = uid(6),
  outsider = uid(7),
  internal = uid(901);
const group = uid(100),
  otherGroup = uid(101),
  invitation = uid(7000),
  secondInvitation = uid(7001);

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
  for (const name of [
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
        new URL(`../../supabase/migrations/${name}`, import.meta.url),
        "utf8",
      ),
    );
  for (const [id, handle] of [
    [creator, "creator"],
    [coCreator, "cocreator"],
    [invited, "invited"],
    [secondInvitee, "second"],
    [thirdInvitee, "third"],
    [fourthInvitee, "fourth"],
    [outsider, "outsider"],
    [internal, "internal"],
  ])
    await db.query("insert into auth.users values ($1,$2,$3)", [
      id,
      `${handle}@example.test`,
      JSON.stringify({ display_name: handle, handle }),
    ]);
  for (const [id, owner, slug] of [
    [group, creator, "main-circle"],
    [otherGroup, outsider, "other-circle"],
  ]) {
    await db.query(
      "insert into public.groups(id,name,slug,description,category,created_by) values ($1,'Test circle',$2,'A free circle with several creators','Friendship',$3)",
      [id, slug, owner],
    );
    await db.query("insert into public.group_admins values ($1,$2)", [
      id,
      owner,
    ]);
  }
  await db.query("insert into public.group_admins values ($1,$2)", [
    group,
    coCreator,
  ]);
  await db.query("insert into public.growth_admins values ($1)", [internal]);
  await db.query(
    "insert into public.creator_invitations(id,group_id,inviter_id,invitee_id) values ($1,$3,$4,$5),($2,$3,$4,$6)",
    [invitation, secondInvitation, group, creator, invited, secondInvitee],
  );
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

describe("creator invitation access", () => {
  it("shows invitations to invitees and current group creators only", async () => {
    await asUser(invited, async () => {
      expect(
        (await db.query("select id from public.creator_invitations")).rows,
      ).toEqual([{ id: invitation }]);
    });
    await asUser(coCreator, async () => {
      expect(
        (await db.query("select * from public.creator_invitations")).rows,
      ).toHaveLength(2);
    });
    await asUser(outsider, async () => {
      expect(
        (await db.query("select * from public.creator_invitations")).rows,
      ).toHaveLength(0);
    });
    await asUser(internal, async () => {
      expect(
        (await db.query("select * from public.creator_invitations")).rows,
      ).toHaveLength(0);
    });
  });
  it("denies anonymous invitation listing", async () =>
    asUser(null, async () => {
      await expect(
        db.query("select * from public.creator_invitations"),
      ).rejects.toThrow(/permission/i);
    }));
  it.each([invited, outsider, internal])(
    "denies invitation creation without group creator access: %s",
    async (id) =>
      asUser(id, async () => {
        await expect(
          db.query("select public.invite_creator($1,'third')", [group]),
        ).rejects.toThrow(/creators/i);
      }),
  );
  it("prevents a creator inviting into a group they do not manage", async () =>
    asUser(creator, async () => {
      await expect(
        db.query("select public.invite_creator($1,'third')", [otherGroup]),
      ).rejects.toThrow(/creators/i);
    }));
  it("allows any current co-creator to invite an existing handle", async () =>
    asUser(coCreator, async () => {
      const { rows } = await db.query<{ invite_creator: string }>(
        "select public.invite_creator($1,'  @THIRD  ')",
        [group],
      );
      expect(rows[0].invite_creator).toMatch(/^[0-9a-f-]{36}$/);
      expect(
        (
          await db.query(
            "select group_id,inviter_id,invitee_id,status from public.creator_invitations where id=$1",
            [rows[0].invite_creator],
          )
        ).rows,
      ).toEqual([
        {
          group_id: group,
          inviter_id: coCreator,
          invitee_id: thirdInvitee,
          status: "pending",
        },
      ]);
      expect(
        (
          await db.query(
            "select * from public.group_admins where group_id=$1 and profile_id=$2",
            [group, thirdInvitee],
          )
        ).rows,
      ).toHaveLength(0);
    }));
  it("supports inviting at least three other people without replacing existing creators", async () =>
    asUser(creator, async () => {
      for (const handle of ["third", "fourth", "outsider"])
        await db.query("select public.invite_creator($1,$2)", [group, handle]);
      expect(
        (
          await db.query(
            "select * from public.creator_invitations where group_id=$1",
            [group],
          )
        ).rows,
      ).toHaveLength(5);
      expect(
        (
          await db.query(
            "select * from public.group_admins where group_id=$1",
            [group],
          )
        ).rows,
      ).toHaveLength(2);
    }));
  it("rejects duplicate pending invitations even from another creator", async () =>
    asUser(coCreator, async () => {
      await expect(
        db.query("select public.invite_creator($1,'invited')", [group]),
      ).rejects.toThrow(/unique|duplicate/i);
    }));
  it("rejects self-invitation", async () =>
    asUser(creator, async () => {
      await expect(
        db.query("select public.invite_creator($1,'creator')", [group]),
      ).rejects.toThrow(/already a creator/i);
    }));
  it("rejects inviting an existing co-creator", async () =>
    asUser(creator, async () => {
      await expect(
        db.query("select public.invite_creator($1,'cocreator')", [group]),
      ).rejects.toThrow(/already a creator/i);
    }));
  it("rejects a handle without an account", async () =>
    asUser(creator, async () => {
      await expect(
        db.query("select public.invite_creator($1,'nobody')", [group]),
      ).rejects.toThrow(/No account/i);
    }));
});

describe("acceptance and decline", () => {
  it("adds only the invited person to the selected creator team atomically", async () =>
    asUser(invited, async () => {
      await db.query("select public.respond_creator_invitation($1,true)", [
        invitation,
      ]);
      expect(
        (
          await db.query(
            "select status from public.creator_invitations where id=$1",
            [invitation],
          )
        ).rows,
      ).toEqual([{ status: "accepted" }]);
      expect(
        (
          await db.query(
            "select profile_id from public.group_admins where group_id=$1 order by profile_id",
            [group],
          )
        ).rows,
      ).toEqual([
        { profile_id: creator },
        { profile_id: coCreator },
        { profile_id: invited },
      ]);
      expect(
        (
          await db.query("select public.is_group_admin($1) as allowed", [
            otherGroup,
          ])
        ).rows,
      ).toEqual([{ allowed: false }]);
      expect(
        (await db.query("select public.is_growth_admin() as allowed")).rows,
      ).toEqual([{ allowed: false }]);
      await db.query(
        "insert into public.messages(group_id,author_id,content) values ($1,$2,'Happy to join the conversation!')",
        [group, invited],
      );
    }));
  it("declines without granting creator access", async () =>
    asUser(invited, async () => {
      await db.query("select public.respond_creator_invitation($1,false)", [
        invitation,
      ]);
      expect(
        (
          await db.query(
            "select status from public.creator_invitations where id=$1",
            [invitation],
          )
        ).rows,
      ).toEqual([{ status: "declined" }]);
      expect(
        (await db.query("select public.is_group_admin($1) as allowed", [group]))
          .rows,
      ).toEqual([{ allowed: false }]);
    }));
  it.each([creator, secondInvitee, outsider, internal])(
    "rejects responses from anyone except the invitee: %s",
    async (id) =>
      asUser(id, async () => {
        await expect(
          db.query("select public.respond_creator_invitation($1,true)", [
            invitation,
          ]),
        ).rejects.toThrow(/invited person/i);
      }),
  );
  it("rejects anonymous responses", async () =>
    asUser(null, async () => {
      await expect(
        db.query("select public.respond_creator_invitation($1,true)", [
          invitation,
        ]),
      ).rejects.toThrow(/permission/i);
    }));
  it("rejects a second response", async () =>
    asUser(invited, async () => {
      await db.query("select public.respond_creator_invitation($1,true)", [
        invitation,
      ]);
      await expect(
        db.query("select public.respond_creator_invitation($1,false)", [
          invitation,
        ]),
      ).rejects.toThrow(/already/i);
    }));
  it("rejects an unspecified decision", async () =>
    asUser(invited, async () => {
      await expect(
        db.query("select public.respond_creator_invitation($1,null)", [
          invitation,
        ]),
      ).rejects.toThrow(/accept or decline/i);
    }));
  it("rejects acceptance if the inviter no longer administers the group", async () => {
    await db.exec("begin");
    try {
      await db.query(
        "delete from public.group_admins where group_id=$1 and profile_id=$2",
        [group, creator],
      );
      await db.exec("set local role authenticated");
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
        invited,
      ]);
      await expect(
        db.query("select public.respond_creator_invitation($1,true)", [
          invitation,
        ]),
      ).rejects.toThrow(/no longer a creator/i);
    } finally {
      await db.exec("rollback");
    }
  });
  it("allows a fresh invitation after the prior one was declined", async () => {
    await db.exec("begin");
    try {
      await db.exec("set local role authenticated");
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
        invited,
      ]);
      await db.query("select public.respond_creator_invitation($1,false)", [
        invitation,
      ]);
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
        creator,
      ]);
      await db.query("select public.invite_creator($1,'invited')", [group]);
      expect(
        (
          await db.query(
            "select status from public.creator_invitations where group_id=$1 and invitee_id=$2 order by status",
            [group, invited],
          )
        ).rows,
      ).toEqual([{ status: "declined" }, { status: "pending" }]);
    } finally {
      await db.exec("rollback");
    }
  });
});

describe("no direct privilege or invitation mutation bypass", () => {
  it("does not grant uninvited users direct creator membership", async () =>
    asUser(outsider, async () => {
      await expect(
        db.query("insert into public.group_admins values ($1,$2)", [
          group,
          outsider,
        ]),
      ).rejects.toThrow(/permission/i);
    }));
  it("does not let a creator add another person without their acceptance", async () =>
    asUser(creator, async () => {
      await expect(
        db.query("insert into public.group_admins values ($1,$2)", [
          group,
          fourthInvitee,
        ]),
      ).rejects.toThrow(/permission/i);
    }));
  it("denies direct invitation insert", async () =>
    asUser(creator, async () => {
      await expect(
        db.query(
          "insert into public.creator_invitations(group_id,inviter_id,invitee_id) values ($1,$2,$3)",
          [group, creator, thirdInvitee],
        ),
      ).rejects.toThrow(/permission/i);
    }));
  it("denies direct status update", async () =>
    asUser(invited, async () => {
      await expect(
        db.query(
          "update public.creator_invitations set status='accepted' where id=$1",
          [invitation],
        ),
      ).rejects.toThrow(/permission/i);
    }));
  it("denies direct invitation deletion", async () =>
    asUser(creator, async () => {
      await expect(
        db.query("delete from public.creator_invitations where id=$1", [
          invitation,
        ]),
      ).rejects.toThrow(/permission/i);
    }));
});
