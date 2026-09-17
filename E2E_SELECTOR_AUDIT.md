# Connected conversation selector audit

## Desktop creator-invitation follow-up

The latest completed connected run is **desktop 8 passed / 1 failed, mobile 9 passed / 0 failed, total 17 passed / 1 failed / 0 skipped**. The only failure is the invitation-card assertion in the first creator scenario. The database assertions immediately before it passed: three pending invitations and one owner/creator. The failed group's records were already removed by teardown; the recovery-journal directory contains no remaining JSON journals.

Evidence checked for this specific failure:

- Migration 007 has a partial unique index on `(group_id, invitee_id)` for pending invitations. The RPC locks the group and inserts once. The page query filters by the signed-in recipient and pending status. There is one component mount, one keyed map, no optimistic copy and no separate responsive rendering.
- A temporary, journaled probe against the hosted project used real seeded sign-ins and the public client for creation/invitation queries. It created exactly three pending rows for Arjun, Priya and Alex. A repeated invitation failed with PostgreSQL `23505`. Each recipient's unfiltered-by-recipient group query returned exactly their one invitation; explicit reads of the other two invitation IDs returned zero rows.
- The recipient's authenticated desktop HTTP response contained one invitation article, initially after the main element, and two hidden framework streaming segments. The failure itself identifies one match through the accessible `article` role and the second only through a raw DOM selector. This supports hidden streaming markup as the extra match, rather than duplicate invitation records.
- The saved failure snapshot is of the owner's Creator studio page, not the secondary recipient page. Consequently the original two elements' computed visibility cannot be established retrospectively. No two visible invitation cards or duplicate-rendering application defect was found. This is treated as a test-selector scope defect, with that evidence limit explicit.

The test now scopes to the accessible `main` → `article` containing the exact level-three group heading, then requires **exactly one visible card**. Two accessible cards still fail. It additionally checks three distinct intended recipient IDs and, before acceptance, recipient-only API visibility under real RLS. No positional selectors, application source, schema, RLS or authentication changes were made.

The probe was cleaned in `finally` using the existing guarded cleanup implementation: its group, owner membership in `group_admins` and three invitations were removed. The final protected-data audit again found **six intended circles, zero E2E circles**, no targeted leftovers and unchanged previously protected records.

Local lint, TypeScript, **234 unit/PostgreSQL tests across 19 files**, and the production build passed. The connected browser rerun is deliberately left to the user's working terminal, as requested. The completed 17/1/0 result is the baseline; **18/18 is not yet claimed**. No deployment occurred.

## Final question-status scope correction

The next completed connected run improved to **17 passed / 1 failed / 0 skipped**: desktop **9/0**, mobile **8/1**. All four original failures below passed. The remaining mobile creator-question failure matched two `answered` badges, one under `#main` and one outside it, through an unscoped `.own-questions > div` locator.

Source inspection found one question query, one question list/map and one badge per question; no separate mobile render or connected/demo merge. A read-only request as the seeded viewer found **one database question in answered state**, and the response (excluding scripts) contained **one own-questions section, one answered badge and one skipped badge**. That section was initially outside main in hidden framework streaming markup. This supports the same temporary streaming-scope diagnosis; the original failure did not capture visibility at that instant, and no actual duplicate visible badge was established.

Only `tests/e2e/connected/creators.spec.ts` changed executable code in this final correction. Submission confirmation and final question-status assertions now start at the existing accessible `main` region. Each final question is matched by exact content; the test requires exactly one row, exactly one visible badge and the expected status text. No positional selector shortcuts or application changes were made.

After this correction: lint passed, TypeScript passed, **201 unit/PostgreSQL tests passed in 17 files**, and the production build passed. The exact external-server E2E command was attempted again but this agent shell hit `spawn EPERM` while launching the Playwright worker, before any case executed. The completed **17/1/0** result is the pre-correction baseline, not a new pass claim. The user's working-terminal rerun is pending; **18/18 remains unverified**. No deployment occurred.

## Earlier four-failure investigation

Investigated September 16, 2026. The saved connected run completed with **14 passed, 4 failed, 0 skipped**: desktop 7/2, mobile 7/2. All four failures were strict locator errors, not four separate product regressions.

## Individual failures

| Device / scenario             | Failing assertion                                              | Diagnosis and correction                                                                                                                                         |
| ----------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Desktop / creator invitations | Exact Priya message matched two paragraphs                     | Selector crossed the active page boundary. Scope to the named circle conversation inside the accessible main region.                                             |
| Desktop / creator answers     | `.conversation-panel` matched two panels on the anonymous page | Same scope problem for the whole panel. Require one named conversation and one answer message within it.                                                         |
| Mobile / creator invitations  | Exact Arjun message matched two paragraphs                     | Same scope problem as the desktop invitation case. Keep exact text, visibility and uniqueness assertions.                                                        |
| Mobile / private Inbox        | Exact received message matched two paragraphs                  | Unscoped text included a second match outside the accessible participant conversation. Scope to the existing `Conversation with Alex Morgan` region within main. |

Classification: **test-selector scope defects; no application duplicate-record/rendering defect established**. Evidence supports temporary framework streaming/hydration markup as the extra match, rather than desktop/mobile copies. Original artifacts did not capture computed visibility/ancestor chains at the failure instant; that historical DOM state cannot be proven retroactively.

## Evidence

- The three saved group failures place one match under `#main` and the other outside it. Inbox identifies one in the accessible participant region and the other outside it.
- Read-only Supabase queries using the creator's real session and public key found **exactly one database row for each affected message**. No service role was used.
- Each affected route, including Inbox requested as its participant, returned **one conversation panel and one occurrence of the affected text**, excluding scripts. Panels initially appear outside main in Next/React hidden streamed HTML segments (`S:*`).
- The rendered desktop group has one visible panel and one exact Priya message after loading.
- Source has one group/inbox component per route and one message map in each. No responsive message copies or second consumer region intentionally repeats these messages. Connected group rendering does not append demo state.
- Inbox appends a successful persisted send response, but the failing recipient page had not sent anything. That send path cannot explain this failure.

## Files changed in this correction

- `src/components/group-view.tsx`: named accessible conversation region; no visual or data-flow change.
- `tests/e2e/connected/helpers.ts`: strict group/private region helpers and shared full-device participant context.
- `tests/e2e/connected/creators.spec.ts`: scoped assertions, persisted-message uniqueness, and a pending invitee's attempted post must fail RLS before acceptance.
- `tests/e2e/connected/inbox.spec.ts`: scoped participant assertions and database message uniqueness; isolation checks retained.
- `tests/e2e/connected/product.spec.ts`: secondary sessions inherit the full project's device settings.
- `README.md`, `VERIFICATION.md`, this audit: test-environment guidance and truthful verification evidence.

No `.first()`, `.last()` or `.nth()` was introduced to resolve the four failures. Two visible messages inside the active conversation still fail. No auth, RLS, Growth guards, analytics separation, schema or demo login behavior changed.

## Verification

- ESLint and TypeScript: passed, exit 0.
- Full unit/PostgreSQL suite: **201 passed in 17 files**, exit 0.
- Production build: passed, Next 16.3.5 / webpack with the existing constrained-build configuration. Connected localhost restarted.
- The requested connected rerun discovered 18 cases but failed in `WorkerHost.startRunner` with **`spawn EPERM` before any test started** in the agent shell. This is a runner-launch failure, not 18 failed application tests.

Last completed counts remain the pre-fix **desktop 7/2, mobile 7/2, total 14 passed / 4 failed / 0 skipped**. A completed rerun from the user's working terminal is required before claiming 18/18:

```powershell
$env:PLAYWRIGHT_EXTERNAL_SERVER="true"
npm.cmd run test:e2e:connected
```

Run from the repository directory against the updated connected build. The redacted result is saved in ignored `test-results/connected/safe-results.json`. No deployment was attempted.
