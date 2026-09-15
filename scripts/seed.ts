import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/database.types";
import { seedEmail, seedPeople, seedPlan } from "../src/lib/seed-plan";

if (process.argv.includes("--dry-run")) {
  console.log(
    Object.fromEntries(
      Object.entries(seedPlan()).map(([name, rows]) => [name, rows.length]),
    ),
  );
} else {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const password = process.env.SEED_PASSWORD;
  const internalPassword = process.env.SEED_INTERNAL_PASSWORD;
  if (!url || !key || !password || password.length < 12)
    throw new Error(
      "Set Supabase URL, server service-role key and a SEED_PASSWORD of at least 12 characters in .env.local.",
    );
  if (
    !internalPassword ||
    internalPassword.length < 16 ||
    internalPassword === password
  )
    throw new Error(
      "Set a separate SEED_INTERNAL_PASSWORD of at least 16 characters for the private project-owner account.",
    );
  const db = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  function check(error: { message: string } | null) {
    if (error) throw new Error(error.message);
  }
  const existing = new Map<string, string>();
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    check(error);
    for (const user of data.users)
      if (user.email) existing.set(user.email, user.id);
    if (data.users.length < 1000) break;
  }
  const ids = new Map<string, string>();
  for (const [i, profile] of seedPeople.entries()) {
    const email = seedEmail(i);
    let id = existing.get(email);
    const isInternal = profile.handle === "chidambar";
    if (!id) {
      const { data, error } = await db.auth.admin.createUser({
        email,
        password: isInternal ? internalPassword : password,
        email_confirm: true,
        user_metadata: {
          display_name: profile.display_name,
          handle: profile.handle,
        },
      });
      check(error);
      id = data.user!.id;
    } else if (isInternal) {
      // Rotate the known seed owner's credential on reruns too: old shared
      // reviewer credentials must never retain internal platform access.
      check(
        (await db.auth.admin.updateUserById(id, { password: internalPassword }))
          .error,
      );
    }
    ids.set(profile.id, id);
  }
  const rows = seedPlan(ids);
  check(
    (
      await db
        .from("profiles")
        .upsert(rows.profiles, { onConflict: "id", ignoreDuplicates: true })
    ).error,
  );
  // Existing seeded accounts retain profile edits; only fill missing handles.
  for (const profile of rows.profiles)
    check(
      (
        await db
          .from("profiles")
          .update({ handle: profile.handle })
          .eq("id", profile.id)
          .is("handle", null)
      ).error,
    );
  check(
    (
      await db
        .from("groups")
        .upsert(rows.groups, { onConflict: "id", ignoreDuplicates: true })
    ).error,
  );
  check(
    (
      await db.from("group_admins").upsert(rows.admins, {
        onConflict: "group_id,profile_id",
        ignoreDuplicates: true,
      })
    ).error,
  );
  check(
    (
      await db
        .from("messages")
        .upsert(rows.messages, { onConflict: "id", ignoreDuplicates: true })
    ).error,
  );
  check(
    (
      await db.from("group_memberships").upsert(rows.memberships, {
        onConflict: "group_id,profile_id",
        ignoreDuplicates: true,
      })
    ).error,
  );
  check(
    (
      await db.from("message_reactions").upsert(rows.reactions, {
        onConflict: "message_id,profile_id,reaction",
        ignoreDuplicates: true,
      })
    ).error,
  );
  check(
    (
      await db
        .from("questions")
        .upsert(rows.questions, { onConflict: "id", ignoreDuplicates: true })
    ).error,
  );
  for (let i = 0; i < rows.assignments.length; i += 500)
    check(
      (
        await db
          .from("experiment_assignments")
          .upsert(rows.assignments.slice(i, i + 500), {
            onConflict: "experiment_id,anonymous_session_id",
            ignoreDuplicates: true,
          })
      ).error,
    );
  for (let i = 0; i < rows.events.length; i += 500)
    check(
      (
        await db
          .from("analytics_events")
          .upsert(rows.events.slice(i, i + 500), {
            onConflict: "dedupe_key",
            ignoreDuplicates: true,
          })
      ).error,
    );
  // Retire the old seed's creator/growth conflation without touching other grants.
  check(
    (
      await db
        .from("growth_admins")
        .delete()
        .eq("profile_id", ids.get(seedPeople[0].id)!)
    ).error,
  );
  // The separate project-owner account has no fictional group ownership.
  check(
    (
      await db
        .from("growth_admins")
        .upsert(
          { profile_id: ids.get(seedPeople[11].id)! },
          { onConflict: "profile_id", ignoreDuplicates: true },
        )
    ).error,
  );
  console.log(
    "Seed complete: 11 fictional accounts plus the project owner, 6 circles, 60 messages, 60 memberships, 114 reactions, 2 pending questions, 2,000 simulated visitors.",
  );
  console.log(
    "Creator: " +
      seedEmail(0) +
      "; reader: " +
      seedEmail(10) +
      "; internal platform admin: " +
      seedEmail(11) +
      ". Creator/reader use SEED_PASSWORD; the owner uses the separate SEED_INTERNAL_PASSWORD. Reruns rotate the known seed owner password only.",
  );
}
