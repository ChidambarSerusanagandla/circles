import { it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { seedPlan } from "../../src/lib/seed-plan";
it("loads the connected seed under service-role grants and reproduces SQL experiment results", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key, raw_user_meta_data jsonb);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema public,auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;`);
    for (const file of [
      "001_core.sql",
      "002_analytics.sql",
      "003_service_access.sql",
    ])
      await db.exec(
        readFileSync(
          new URL("../../supabase/migrations/" + file, import.meta.url),
          "utf8",
        ),
      );
    const plan = seedPlan();
    for (const p of plan.profiles)
      await db.query("insert into auth.users values ($1,$2)", [
        p.id,
        JSON.stringify({ display_name: p.display_name }),
      ]);
    await db.exec("set role service_role");
    const tables = {
      groups: plan.groups,
      group_admins: plan.admins,
      messages: plan.messages,
      group_memberships: plan.memberships,
      message_reactions: plan.reactions,
      questions: plan.questions,
      experiment_assignments: plan.assignments,
      analytics_events: plan.events,
    };
    for (const [table, rows] of Object.entries(tables)) {
      const columns = Object.keys(rows[0]);
      for (let offset = 0; offset < rows.length; offset += 250) {
        const chunk = rows.slice(offset, offset + 250);
        const values = chunk.flatMap((row) =>
          columns.map((c) => (row as Record<string, unknown>)[c]),
        );
        const placeholders = chunk
          .map(
            (_, i) =>
              "(" +
              columns
                .map((_, j) => "$" + (i * columns.length + j + 1))
                .join(",") +
              ")",
          )
          .join(",");
        await db.query(
          "insert into public." +
            table +
            "(" +
            columns.join(",") +
            ") values " +
            placeholders,
          values,
        );
      }
    }
    await db.query("insert into public.growth_admins values ($1)", [
      plan.profiles[0].id,
    ]);
    await db.exec("reset role; set role authenticated");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      plan.profiles[0].id,
    ]);
    expect(
      (await db.query("select * from public.preview_funnel(true)")).rows,
    ).toEqual([
      { variant: "A", visitors: 1000, opens: 326, joins: 112 },
      { variant: "B", visitors: 1000, opens: 401, joins: 147 },
    ]);
    expect(
      (
        await db.query<{ visitors: number }>(
          "select * from public.preview_funnel(false)",
        )
      ).rows.every((r) => r.visitors === 0),
    ).toBe(true);
  } finally {
    await db.close();
  }
}, 30000);
