# Connected E2E data and cleanup

Connected browser tests exercise real Supabase Auth and real database writes. They must not leave fictional test groups in the reviewer feed. No product-side name filter hides those records: cleanup removes the test data at its source.

## Cleanup command

From the repository root, with `.env.local` pointing at the intended test/review project:

```powershell
# Preview only; the command does not delete unless --apply is present.
npm.cmd run test:e2e:cleanup -- --project-ref bajpmxmpkendiocszorb

# Apply the narrowly matched historical artifact cleanup.
npm.cmd run test:e2e:cleanup -- --project-ref bajpmxmpkendiocszorb --apply
```

That ref is the reviewed `circles-review` project. For a different test project, deliberately supply its ref. The command refuses a ref that differs from `NEXT_PUBLIC_SUPABASE_URL`. It uses the existing private `SUPABASE_SERVICE_ROLE_KEY` only in the Node cleanup process; no credentials are written to reports or passed to a browser.

The command is safe to repeat. Historical selection requires **all** of these group conditions:

- Name is exactly `E2E Creator team`, `E2E Reader questions` or `E2E Viewer loop`, followed by `desktop`/`mobile` and the generated hexadecimal suffix.
- Slug is the exact derived name slug, description is the fixture's exact sentence, `is_demo=false`, and ownership belongs to the verified seeded `demo01@circles.example` / `@rahul` account.
- The ID is not one of the six original seeded group IDs.

A prefix alone is insufficient. Account IDs are verified against both Auth emails and profile handles. An unexpected demo analytics row attached to a target causes cleanup to stop before deleting anything.

## Relationships and deletion order

| Records                                                                                        | Treatment                                                                                                                                                |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test group analytics                                                                           | Explicitly remove non-demo events first. `group_id` uses `ON DELETE SET NULL`, so deleting only the group would orphan their attribution.                |
| Groups                                                                                         | Delete only exact matched IDs with ownership/demo/description/name guards.                                                                               |
| Group creators, memberships, messages, questions, invitations                                  | Removed through the actual group foreign-key cascades.                                                                                                   |
| Message reactions and question answers                                                         | Removed through message/question cascades.                                                                                                               |
| Private Inbox messages                                                                         | Match exact known generated text, expected sender and Alex/Rahul participant pair. Unrelated private messages are preserved.                             |
| Shared Inbox thread                                                                            | Historical cleanup keeps it. Recompute last-activity time from retained history using a compare-and-set guard.                                           |
| New, journal-owned empty Inbox thread                                                          | Future cleanup can delete it only when no messages remain and `updated_at` still matches the inspected value. A concurrent sender prevents the deletion. |
| Experiment assignments                                                                         | Historical cleanup keeps them. Future cleanup removes only recorded test visitor assignments, after their non-demo events.                               |
| Profiles, Auth users, Growth roles, experiment configuration, seeded groups and demo analytics | Never deleted by cleanup.                                                                                                                                |

Group cascades are database-atomic. The overall HTTP cleanup comprises several ordered operations, not one database transaction; an error stops the operation, fails the test run and retains its journal for an idempotent retry. It does not silently report success after a partial cleanup.

## Future connected runs

`playwright.connected.config.ts` requires `E2E_SUPABASE_PROJECT_REF` to match the configured URL, plus the existing server-only cleanup key and `ANALYTICS_COOKIE_SECRET`. These are test-runner settings. Do not add the E2E project ref or seed passwords to Vercel. Product actions and authorization assertions still use real UI sign-in and ordinary user sessions; the privileged client is used only to verify cleanup identities and remove owned artifacts.

Each test has a durable journal in ignored `.e2e-runs/<run UUID>/<test UUID>.json`. It records intended group names and exact Inbox texts **before** sending the request, so a failure before an assertion or response does not lose ownership information. Names include a per-test 12-hex marker and an 8-hex random suffix.

Every browser context, including extra participants and the API preflight, receives its own random, signed anonymous analytics identity before its first request. This uses the normal analytics cookie format and does not authenticate anyone. Only the unsigned visitor UUID is persisted; journals contain no passwords, session cookies or tokens. Cleanup therefore knows which observed test events on seeded groups also belong to that run without changing the product's demo/observed distinction.

Teardown drains pending analytics requests, revokes only test-owned local Auth sessions, closes browser contexts, and runs exact-journal cleanup in `finally`. Global teardown repeats the sweep and removes successful journals. Cleanup errors fail the run and leave journals outside Playwright's automatically cleared results directory.

For an interrupted run, preview its recovery:

```powershell
npm.cmd run test:e2e:cleanup -- --project-ref bajpmxmpkendiocszorb --recover
# After reviewing the plan:
npm.cmd run test:e2e:cleanup -- --project-ref bajpmxmpkendiocszorb --recover --apply
```

Use `--journal .e2e-runs/<run>/<test>.json` instead of `--recover` to select just one journal. Recovery requires the journal's recorded project to match the explicit target. Successful recovery removes the journal. Do not delete these journals before recovering a failed run.

## Limits and preferred isolation

Old browsing events on seeded groups and null-group experiment exposures have no E2E marker. Their shared account IDs and timestamps cannot reliably distinguish tests from normal review activity. **They and old assignments are intentionally preserved.** A visitor touching a test group is not enough evidence to erase all of that visitor's activity.

The historical Alex/Rahul thread has no creation-ownership record and is preserved even if cleanup leaves it empty. A process killed after creating a new empty thread but before receiving its ID can similarly leave an unidentifiable thread; do not guess. Auth audit history/last-sign-in timestamps are Supabase-managed records and are never rewritten or globally revoked by this tool.

Use one connected run at a time. Fresh groups are public while a test is running, even with teardown. For future CI or simultaneous portfolio review, use a separate **circles-e2e Supabase project**: apply migrations 001–007, seed it with distinct private credentials, and build/start a separate local or CI app using that project's environment. Set its own `E2E_SUPABASE_PROJECT_REF` and matching signing secret for the test runner. Keep the reviewer/Vercel app connected to `circles-review`. This avoids temporary test content and reduces the consequence of interrupted runs. No second project was created in this task.

## Applied cleanup — September 16, 2026

The reviewed historical cleanup removed:

| Entity                       | Removed |
| ---------------------------- | ------: |
| Groups                       |      18 |
| Group creators               |      33 |
| Memberships                  |      12 |
| Group messages               |      27 |
| Reactions                    |       6 |
| Questions                    |      18 |
| Answers                      |       6 |
| Creator invitations          |      18 |
| Private messages             |      11 |
| Group-linked observed events |     112 |

All six seeded circles remain; no `E2E ...` groups remain. Checksums confirmed preservation of the original profiles/Auth identities (13), seeded content, both Growth roles, experiment configuration, all 2,000 existing assignments and 5,195 untargeted analytics events. The existing private thread was preserved.

The cleanup implementation is tested against all seven real migrations in embedded PostgreSQL, including dry runs, failure recovery, pagination, protected data, exact ownership and foreign-key cascades. See [VERIFICATION.md](VERIFICATION.md) for execution results. No application behavior, RLS, visual design or deployment changed.
