# Development log

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

### Phase 3 — creator studio and first-party measurement

- Added creator group creation, message publishing, question answering/skipping, and a compact engagement dashboard.
- Added server-derived analytics identity and experiment assignment; browser ingestion accepts only reading events. Successful joins, reactions and questions log on the server. Analytics failures do not roll back product actions.
- Restricted global experiment results to an explicit internal growth-admin role. Ordinary creators can query only their own group metrics.
- Built SQL reports that count distinct browsers and require a same-group outcome within seven days of a preview. Creator joins also require an intervening open.
- Historical simulation and measured events have separate data flags and reports; no simulated result is presented as real traffic.
- Phase gate passed: lint, TypeScript, 41 tests, and the constrained production build. Hosted Supabase and Vercel have not been connected or deployed.

### Phase 4 — conversation preview experiment

- Wired server-rendered four/eight-message previews to a persistent, versioned browser assignment and database uniqueness constraint.
- Review caught treatment-dependent impression eligibility. Both arms now observe the same fixed 64px area for one second, rather than a fraction of their differently sized previews.
- Added signed visitor cookies in connected mode, strict event payload validation, deduplication, and receipt-time timestamps before asynchronous ingestion work.
- Stopping enrollment retains existing assignment attribution for later conversions; new preview exposures stop. Assignment outages serve baseline without claiming a new exposure.
- Added the experiment dashboard with separate simulated history, browser-local activity and measured traffic, explicit conversion definitions, absolute/relative lift and no statistical-significance claim.
- Corrected JavaScript/SQL attribution parity: the experiment report is scoped to this experiment; creator funnels remain independent of experiment tags.
- Phase gate passed: lint, TypeScript, 45 tests and production build. Sample rates are 11.2% vs 14.7% (+3.5 percentage points, +31.25% relative); these numbers are simulated, not a learning from real users.

### Phase 5 — delivery and verification

- Added a repeatable Supabase Auth/content seed and explicit service-role grants, with an integration test that loads the seed through the service role and reproduces its SQL funnels.
- Scoped managed/joined queries independently of Discover, batched feed previews, filtered the pending question inbox before limiting, and preserved safe return links through sign-in.
- Fixed browser-demo counts across account switching, added locally created circles to Discover, and kept preview attribution tied to the actual rendered variant during database recovery.
- Formatted the source, added GitHub Actions, a 12-case desktop/mobile Playwright suite, SQL report examples, README and interview documentation.
- Final checks: lint and TypeScript passed; 54 Vitest tests passed; constrained production build passed; HTTP checks verified all main routes plus 4 vs 8 server-rendered preview messages.
- Browser controls verified join/react/ask, reload persistence, creator answer/skip, circle creation/publishing, premium-demo joining, category filtering, keyboard skip link, stable reaction totals, and no horizontal overflow on main pages at 390px. Browser console had no errors in the final walkthrough.
- Playwright CLI discovered its tests but worker spawn was blocked by the local sandbox. The seed CLI also hit a child-process restriction; its plan and table insertion were validated independently by the passing database test. Hosted Auth, GitHub CI and Vercel remain unvalidated.

## Product refinement — 2026-09-14

The follow-up product decisions kept the existing app and its design, moved Growth to an independently protected internal route, preserved the separate owner identity and fictional creators, and made every group free. The current navigation is Discover, Groups, Inbox and Profile. Creator controls remain contextual to Groups.

Creator invitations now target existing handles, require explicit acceptance, and add only the relevant group role. Three accepted collaborators plus an owner were exercised in the browser. Private Inbox has its own two-person data model; it does not reuse group messages or questions. The database tests include an internal platform administrator attempting to read a different pair's private thread.

The review also found a global loading boundary that returned a streamed HTTP 200 before a protected-page not-found result. Loading states were scoped to consumer routes so protected access checks now return an actual 404 before rendering. A local HTTP script covers anonymous, viewer, creator, internal and forged-session access. The final command results and browser checks are in VERIFICATION.md.

Monetization branches and simulated entitlement creation were removed from the app; migration005 converts existing rows and leaves dormant metadata columns for a future explicit decision. No deployment or external messaging took place. Local demo participation, invitations and private messages remain inspectable browser storage; connected privacy relies on Supabase Auth and PostgreSQL RLS, not the demo.
