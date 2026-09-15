# Verification record — September 14, 2026

This record covers the final free-product, role-separation, creator-invitation and private-Inbox implementation. It distinguishes executed checks from prepared or externally dependent work.

## Automated checks executed locally

| Check                             | Exact result                                                                                         |
| --------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Full Vitest unit/PostgreSQL suite | **191 tests passed in 16 files**, exit 0                                                             |
| ESLint across repository          | Passed, exit 0                                                                                       |
| TypeScript `tsc --noEmit`         | Passed, exit 0                                                                                       |
| Next.js production build          | Passed, exit 0, Next.js 16.3.5; webpack with `CIRCLES_CONSTRAINED_BUILD=true`                        |
| Local HTTP access smoke checks    | **47 assertions passed**, exit 0                                                                     |
| Playwright desktop/mobile suite   | **Not executed successfully**: 18 tests discovered, worker startup failed with `spawn EPERM`, exit 1 |

Commands used from the repository root:

```powershell
node node_modules/eslint/bin/eslint.js .
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vitest/vitest.mjs run --configLoader=native --pool=threads
$env:CIRCLES_CONSTRAINED_BUILD='true'
node node_modules/next/dist/bin/next build --webpack
# With the resulting production server running on localhost:3000:
node --env-file=.env.local scripts/check-access.mjs
$env:PLAYWRIGHT_EXTERNAL_SERVER='true'
node node_modules/@playwright/test/cli.js test --workers=1
```

The constrained build uses Next's worker-thread path to accommodate local child-process restrictions; TypeScript validation remains enabled. The ordinary build configuration is retained for Vercel. Playwright checks are authored, including the new collaboration and Inbox flows, but **no Playwright pass is claimed**. GitHub Actions is configured but no CI execution is claimed.

PostgreSQL tests execute migrations, including the complete 001–007 chain, inside PGlite with mock Auth users and database roles. They verify free membership conversion and joining, own-profile/unique-handle rules, creator-only posting/settings, invitation acceptance/decline and atomic role creation, private Inbox participant access, and independent internal Growth privileges. A Growth administrator cannot read a different pair's private thread. The seed integration reproduces the historical simulated experiment counts while excluding them from measured reports.

The HTTP script verifies anonymous, owner/viewer, reader, Rahul, Priya and Arjun receive real 404 responses at `/internal/growth` and `/experiments`; authorized internal sessions receive the report and legacy redirect. It also checks wrong keys, cross-origin sign-in requests, forged sessions, the owner's full name and the four consumer navigation items.

## Browser walkthroughs executed through the available browser controls

- **Anonymous:** Discover, four-message preview, Continue watching, public conversation, sign-in requirement for reacting. No experiment or platform links in navigation.
- **Viewer:** owner sign-in returns to the chosen group; join, reaction and question submission work; membership persists after reload. Profile retains Chidambar Rao Serusanagandla and @chidambar; saving succeeds. The formerly premium Next Chapter group joins freely with no pricing or payment flow.
- **Creator:** managed-group selection, message posting, question answering/skipping, public answer display and settings save work. Creator navigation is contextual to Groups.
- **Collaboration:** created After Hours Club as the owner; invited Rahul, Alex and Priya. It had one creator before acceptance and four afterward. Priya published a visible group message. Arjun received a fourth invitation and declined without receiving the group role.
- **Inbox:** owner started a private thread with Rahul by handle; Rahul saw the message and replied. Alex's Inbox did not expose that conversation. There was no external delivery from the local demo.
- **Internal:** private-key sign-in opened the protected report, preserving the labeled 11.2%/14.7% simulated join rates. Starting the experiment displayed an eight-message treatment in this browser; restoring Draft returned Discover to four-message previews.
- **Responsive/accessibility:** no horizontal overflow at 390 × 844 on Discover, a group, Groups, Inbox, Creator studio or Profile. Mobile questions follow the conversation. The keyboard skip link receives focus. Final walkthrough captured no browser warning/error entries.

Screenshots were saved outside the Git repository in `../screenshots/`: Discover, a group, Creator studio and Inbox. These are screenshots of the local demo, not evidence of deployment or real users.

## External validation still required

- Hosted Supabase Auth, email confirmation and PostgREST integration. The SQL permissions were tested locally, not against a hosted Supabase instance.
- Seed Auth account provisioning and existing-session behavior after rotating the private internal seed password. The seed plan/database inserts are covered; local `tsx` startup previously hit the child-process restriction.
- Normal-environment Playwright execution and GitHub CI.
- Vercel configuration/deployment, domain setup and real traffic. **No deployment was attempted.**

Demo content, including messages and invitations, is inspectable shared browser storage. It is suitable for fictional review content, not secure private communication. Connected-mode privacy uses Supabase Auth and PostgreSQL RLS. No production adoption, paid usage or real experiment lift is claimed.
