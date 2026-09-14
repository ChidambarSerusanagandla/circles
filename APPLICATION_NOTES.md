# Application notes

## Development log

- Phase 1: started from an empty workspace. Chose the current stable Next.js version returned by npm (16.3.5), App Router, TypeScript and Tailwind. Built an intentionally text-led Discover feed and chronological group pages using 60 authored messages across six groups and ten fictional people.
- Kept creator conversation separate from viewer participation in the page structure. Browsing never requires an account.
- Used generated initials instead of stock portraits to keep the prototype lightweight and avoid implying that fictional conversations belong to real people.
- Planned two explicit execution modes: a browser-local reviewer demo and a real Supabase mode. Live failures must never silently turn into demo data.
- Deployment target is Vercel as requested; no deployment has been performed.

This document is updated as features and verification are completed. Seed data is fictional and is not evidence of product traction.

### Phase 2 — participation and authorization

- Implemented email/password signup, login and logout with the Supabase SSR cookie client; the server verifies identity before mutations, and PostgreSQL independently checks authorization.
- Implemented free and explicitly non-billing premium-demo memberships, six toggleable reactions, member-submitted questions, creator messages, and atomic answer/skip functions.
- The browser demo has explicit reader and creator accounts. Their memberships and reactions are scoped by account. Questions and creator posts persist on the current device.
- Added direct group-by-slug lookup so the Discover feed’s bounded page cannot make a valid group inaccessible.
- A schema review found that PostgreSQL CHECK constraints accept NULL: a premium group with no price passed the original constraint. Added an explicit non-null condition and a PostgreSQL regression test.
- A schema review also found that combining the maximum question and answer could exceed the message limit. Aligned the answer constraint with the 1,400-character application limit.
- 26 automated tests pass, including 16 tests that execute the migration and RLS under anonymous/authenticated roles in PGlite (embedded PostgreSQL). This validates SQL behavior, not the externally hosted Supabase Auth service.
- Local restrictions reject spawned processes. Verified TypeScript separately and used Next.js worker threads, its TypeScript API path, and a webpack build via the documented `CIRCLES_CONSTRAINED_BUILD` option. The normal Vercel build remains `next build`.
