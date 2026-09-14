# Implementation plan

1. **Reading experience:** scaffold Next.js, six seeded circles, category filters, responsive cards and full conversation pages. Gate: lint, TypeScript, unit test, production build, HTTP render and visual preview.
2. **Participation:** relational Supabase schema and RLS; server-verified authentication; durable memberships, reactions, questions and answers. Browser-local demo state is an explicit alternate mode, never a fallback for database errors.
3. **Creator tools and analytics:** managed groups, creator message and question workflows, internal dashboard, first-party event ingestion and SQL funnels. Mutation events originate on the server after success.
4. **Preview experiment:** persisted browser assignment, four/eight-message SSR previews, visibility-qualified impressions, deduplicated seven-day visitor conversions, isolated demo and measured reports.
5. **Delivery:** business-rule, database-authorization and browser tests; responsive and keyboard review; README, interview notes, CI, and exact Supabase/Vercel setup instructions.

Each phase ends with verification and a logical Git commit. No real payments, unrestricted viewer chat, real-time sockets, recommendation engine, or notifications in this MVP.

## Architecture

- `src/app`: Next.js routes and server entry points.
- `src/components`: focused UI components and interactive client islands.
- `src/lib`: typed domain rules, experiment measurement, analytics and database access.
- `supabase/migrations`: executable schema, constraints, grants and RLS.
- `supabase/reports`: documented SQL examples.
- `scripts`: repeatable development seed.
- `tests/unit`, `tests/database`, `tests/e2e`: fast logic tests, actual PostgreSQL policy tests, and end-to-end reviewer flows.

## Decisions

- Next.js/Vercel takes precedence over the generic Sites starter and hosting defaults, because the requested stack and deployment target are explicit.
- Identity for experimentation means a persistent browser, not a person; no speculative cross-device stitching.
- Premium joining is clearly a demo entitlement with no charge.
- Questions require membership; reactions require authentication. This preserves open reading while making joining useful.
- Seeded counts and seeded experiment results always carry a demo label. Measured events and simulated history are never combined.
