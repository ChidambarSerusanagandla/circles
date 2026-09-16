# Original connected Playwright failure audit

Audited on 2026-09-15 before rerunning or replacing the original result artifacts. The application was connected to Supabase with `NEXT_PUBLIC_DEMO_MODE=false`. The original suite was `tests/e2e/product.spec.ts` at application commit `5e84954`.

Evidence inspected: all 16 `test-results/*/error-context.md` files, their 16 `trace.zip` archives (test and browser action/error records), `test-results/.last-run.json`, the original test source, and the Playwright configuration. This document preserves sanitized findings, not raw traces, request bodies, cookies, or credentials.

## Result and root causes

The reported original result was **16 failed, 2 passed, 0 skipped** across 18 executions. The saved failed-test registry contains exactly 16 failures. All nine desktop executions failed. Seven of nine mobile executions failed; the anonymous discovery and layout/keyboard cases were the two passes.

| Observed first failure | Desktop | Mobile | Total | Interpretation |
| --- | ---: | ---: | ---: | --- |
| Missing `Continue as Chidambar` button | 3 | 4 | 7 | Tests assumed the demo identity shortcut on the real email/password sign-in screen. |
| Missing `Creator · Rahul` button on `/demo` | 1 | 1 | 2 | Tests attempted a demo-only route and account switch. |
| Missing `Internal access key` input | 2 | 2 | 4 | Experiment tests attempted demo-only internal authentication. |
| Aborted navigation or exhausted navigation/test time budget | 3 | 0 | 3 | Two `ERR_ABORTED` errors and one 30-second test timeout. These are separate observed navigation failures, not evidence of broken joins, invitations, Inbox, or RLS. |
| **Total** | **9** | **7** | **16** | **13 failures directly prove a demo/connected test mismatch.** |

The desktop role-boundary test is also incompatible with connected authentication, but it failed earlier while navigating to Profile. Counting it as a missing-button failure would misstate the trace. The exact cause of the three navigation failures cannot be proven from these artifacts alone. They need a stable connected rerun; they must not be declared fixed or attributed conclusively to a product regression based on this run.

The configuration used one undifferentiated test directory, automatically generated demo secrets, and permitted reusing the server on localhost. It did not verify that the running server matched the suite's demo assumptions. That allowed demo tests to execute against the intentionally connected application.

## Each original failing execution

| # | Project | Original test | First observed failure | Coverage blocked after that failure |
| ---: | --- | --- | --- | --- |
| 1 | desktop | anonymous discovery, categories and readable conversation | `page.goto` to `/groups/roommates-after-midnight` failed with `net::ERR_ABORTED`. Initial six-card, four-message preview, navigation, and Travel filtering assertions had passed. | Group message count, sign-in-to-join link, anonymous reaction prompt. |
| 2 | desktop | reader joins once, reacts and asks; creator publishes the answer | Timed out waiting for `Continue as Chidambar` after opening the real sign-in page. | Join, duplicate-join state, reaction, question submission, creator review, answer publication. |
| 3 | mobile | reader joins once, reacts and asks; creator publishes the answer | Timed out waiting for `Continue as Chidambar`. | Same downstream reader and creator actions as #2. |
| 4 | desktop | creator can skip, create a circle and publish; all circles join freely | Timed out waiting for `Creator · Rahul` on `/demo`. | Skip, group creation, publish, Discover listing, free joining. |
| 5 | mobile | creator can skip, create a circle and publish; all circles join freely | Timed out waiting for `Creator · Rahul` on `/demo`; error snapshot shows the connected 404 page. | Same downstream creator actions as #4. |
| 6 | desktop | variant A is persistent and uses the common impression area | Timed out waiting for `Internal access key` at `/internal/sign-in`. | Experiment configuration, preview length, impression observation, persistence, demo report UI. |
| 7 | mobile | variant A is persistent and uses the common impression area | Timed out waiting for `Internal access key`; error snapshot shows 404. | Same experiment assertions as #6. |
| 8 | desktop | variant B is persistent and uses the common impression area | Timed out waiting for `Internal access key` at `/internal/sign-in`. | Same experiment assertions as #6, for variant B. |
| 9 | mobile | variant B is persistent and uses the common impression area | Timed out waiting for `Internal access key`; error snapshot shows 404. | Same experiment assertions as #8. |
| 10 | desktop | mobile layout and keyboard navigation stay usable | Second navigation to `/` failed with `net::ERR_ABORTED`. The initial page load and skip-link focus assertion passed. | Overflow checks for Discover, group, Growth denial, and Profile. |
| 11 | desktop | role boundaries protect both Growth routes and preserve the owner profile | Test timeout while navigating to `/profile`. Anonymous 404 assertions for `/internal/growth` and `/experiments` had passed. | Owner shortcut (which would also be invalid in connected mode), viewer/creator denials, internal sign-in and Growth access. |
| 12 | mobile | role boundaries protect both Growth routes and preserve the owner profile | Timed out waiting for `Continue as Chidambar`. Anonymous Growth/legacy-route 404 assertions had passed. | Signed-in role checks and internal Growth access. |
| 13 | desktop | owner invites three people and accepted creators can publish | Timed out waiting for `Continue as Chidambar`. | Group creation, three invitations, recipient acceptance, creator count and posting. |
| 14 | mobile | owner invites three people and accepted creators can publish | Timed out waiting for `Continue as Chidambar`. | Same invitation and posting assertions as #13. |
| 15 | desktop | private Inbox is shared only by its two participants | Timed out waiting for `Continue as Chidambar`. | Start thread, send, other participant read/reply, third-party isolation. |
| 16 | mobile | private Inbox is shared only by its two participants | Timed out waiting for `Continue as Chidambar`. | Same Inbox assertions as #15. |

For #11, the trace shows approximately 19.9 seconds for the first protected route navigation and 8.6 seconds for the second. The 30-second overall test budget was nearly exhausted before Profile navigation started. This is not a 30-second Profile-only failure. For #10, the first page load took approximately 13.4 seconds before the later navigation abort. These timings support investigating test-server readiness and navigation stability, without establishing their underlying cause.

## Cascades and what this run did not establish

The 13 missing-demo-control failures are repeated manifestations of one environment mismatch, spread across seven scenario types and two projects. They are not 13 distinct application bugs. All later assertions listed above were unexecuted after their first failure; they must not be counted as additional failed application features.

No authenticated scenario reached its real product mutations. This run therefore did **not** test whether connected joins, reactions, question moderation, creator invitations, Inbox privacy, or signed-in Growth authorization work. It established neither a defect nor a pass for those behaviors. The anonymous protected-route denials that completed were successful.

The experiment tests also contain later demo-specific assumptions: synthetic visitor-cookie assignment, `circles-demo-v2` local-storage analytics, and the `This browser` demo report. Those assertions were not reached. Replacing only the first login selector would still leave the suite unsuitable for connected Supabase.

Other assertions assume a resettable fixture: exactly six total groups, fixed group slugs for newly created groups, exact initial membership/reaction state, and a preexisting pending question. Connected tests need their own uniquely named data and real account sessions rather than resetting production behavior to satisfy those assumptions.

## Required test repair

- Keep connected `/demo` and `/internal/sign-in` unavailable. Do not restore shortcut buttons or internal demo-key authentication.
- Select demo and connected suites explicitly and refuse a mismatched server environment before product scenarios execute.
- Authenticate connected seeded users through real Supabase Auth, taking ordinary and internal passwords only from environment variables.
- Use isolated account sessions and unique test data for each run/project. Test invitation acceptance before granting posting access, and test Inbox denial as a nonparticipant.
- Preserve observed-versus-demo analytics separation and existing RLS/server authorization.
- Treat navigation errors as unresolved until the connected rerun supplies evidence; do not inflate them into downstream application defects.

This is the audit of the **original** failed run. Subsequent connected execution results belong in the current verification report and do not change these historical findings.
