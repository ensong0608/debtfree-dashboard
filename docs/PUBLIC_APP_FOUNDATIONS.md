# Public mobile app foundations — tracked implementation

Branch: `codex/public-app-foundations-20261011`
Base: `35917dc` (`codex/mobile-payments-budget`, current PR #2 head).
The user approved promotion of the tested foundations to the existing private production app on October 15, 2026. Current release source and evidence are tracked in PRIVATE_PRODUCTION_RELEASE_20261015.md on codex/production-release-20261015. Public signup/Stage 6 remain gated; earlier preview-only notes below are historical.
Coordinator owns APIs, sync, migration decisions and this checklist. Financial and payoff work have separate file owners.

## Private production promotion — superseding release checkpoint

The user requested the tested improvements on the real existing-household app and explicitly approved the encrypted recovery destination. Production publication is complete: source `42172ca746f17a854ab064740c1ab90f60ec437d`, Worker version `24f06427-0cbe-49b6-b5c8-b52d37eb2c59`, successful run `38773041808`/job `116557256609`. Lint/typecheck, 291 Node tests, SQL recovery, 112 browser checks (2 existing skips), exact Worker dry-run, fresh encrypted backup, stored-row preservation, login/chooser/callback/PKCE and anonymous household/export denial passed. Actual production SQL was restored privately in SQLite; saved contracts, original starting Progress/snapshots and legacy displayed balances passed read-only compatibility review. Every persisted household/member/state column matched before and after the final deployment. No migration or financial write/import/reset ran.

The live signed-in production household loaded, and house/car Debt + choices and empty-loan validation were verified without creating a record. Private-app fixes now start from `codex/production-release-20261015`; exact backup/rollback/release evidence is in `docs/PRIVATE_PRODUCTION_RELEASE_20261015.md`. The original foundations preview keeps its separate D1 database. Older preview-only/production-untouched entries below describe their historical batches.

This private-use release does not pass the remaining public-launch gates: two-session direct-API isolation, controlled expiry/revocation/all switching boundaries, independent partner sync, full IAM, remote D1/Time Travel restoration and physical accessibility. Stage 6/public signup remain gated. Next public-foundations action remains an authorized two-session direct-request test runner; do not repeat user-confirmed usability checks or treat the private release as permission to activate signup.

## Current checkpoint — October 15, 2026 (supersedes older next-action notes)

- Inspected clean remote head `ae16626f25ac0b2dbe5b7b3573239186c22eb941`, full branch/PR stack, migration, auth/context/export/sync implementations, existing synthetic recovery tests and preview workflow. PR #4 remains draft against `codex/mobile-payments-budget`; PRs #2/#1 remain the production stack. No newer remote implementation was found at inspection.
- User-reported verification: Stage 2 and Stage 4 looked good; Stage 3 partner updates, unsaved-input preservation and reconnect looked good; Google account chooser now works. These do **not** establish independently tested direct-API isolation, every switching boundary, expiry/revocation, production IAM or physical accessibility.
- Added `npm run test:recovery` to mandatory validation: actual Wrangler local D1 SQL exports restored into a separate disposable database, with exact comparison of every household/member/state column and serialized payload. Covers owner/admin/invited-viewer metadata, two households (including empty state), revision 7, original Progress starting amount and saved snapshot date, deleted transaction history, and an unlinked house loan/history. `foreign_key_check` and D1-supported `quick_check` must pass. Only repository synthetic fixtures are used; no remote database/config input is accepted.
- Drill found that a default local dump interleaves child table creation/inserts before the parent exists. The drill exports complete tables parent-first, preserves foreign-key enforcement, and fails on unreviewed application-table additions. See release plan for the consistency limitation; this does not validate a production or remote D1 restore.
- Added read-only Cloudflare deployment/auth/binding inspection to preview CI. Only metadata is requested; no SQL or production financial payload is read. No secret values/settings are logged. Inspection failure is nonblocking for preview deployment but remains a release blocker; full account IAM/token-policy inspection is explicitly outside its evidence.
- Live preview browser reached Google’s actual account chooser in this session (previous 502/refused-connection limitation did not recur). On resumption, the user selected the saved approved identity through browserAuth; fresh preview UI showed its distinct household and owner identity, then Sign out returned to the login screen. No financial edits, imports, exports, member changes or invitations were performed. This verifies that identity’s UI login/logout path only; authenticated direct-API isolation, controlled expiry/revocation and A→B switching with drafts remain open. No credentials were exposed or authentication bypassed.
- Local lint/typecheck, application build, Worker dry-run, resource-inspection tests and local D1 recovery passed. Full CI browser/deployment verification passed; exact evidence is recorded in the final handoff below. Local Playwright Chromium install returned a truncated archive, so local browser verification is unavailable.
- No app UI, payoff semantics, saved household data, public signup or SQL migration changed. Existing loan validator compatibility/anchor-aware rollback restrictions remain applicable.

### Gate status and exact next steps

| Gate | Evidence / dependency |
| --- | --- |
| Independent authenticated cross-household GET/PUT/export denial | Open: one approved identity completed live preview login/logout during this batch. Still requires two independently authenticated sessions and an authorized direct-request test runner capable of sending scoped GET/PUT/export requests. Browser UI sign-in alone does not establish this; no cookie/token extraction or browser security bypass is permitted. Synthetic adapters remain supporting evidence only. |
| Expiration/revocation and every account-switch/draft boundary | Open: real sessions and controlled expiry/revocation in test auth. User chooser confirmation is recorded separately. |
| Partner synchronization | User-reported good; synthetic SQLite/sync integration already passes. Independently authenticated live partner test still needs approved sessions. |
| Recovery | Local Wrangler D1 SQL restore now validated, in addition to existing JSON/API recovery tests. Remote D1 restore and consistent private production backup remain prerequisites before production migration/release. |
| Production resource/IAM inspection | Read-only CI metadata inspection PASSED in run 38754352950: expected production D1/auth bindings and separate preview D1 confirmed. Full principal/token permissions still need account administration access. |
| Legacy reconciliation review | Read-only review of the private production backup passed for the release: candidate displayed balances exactly match existing offset/history calculations, stored balances and original Progress/snapshots remain unchanged. No historical anchors guessed or transactions reclassified. Do not copy production data into test fixtures. |
| Physical accessibility | Open: actual phone/keyboard/OS text-size/screen-reader access. Browser emulation is not equivalent. |
| Stage 6 | Remains gated on the required preceding checks; no new signup, invitation, household deletion or lifecycle implementation activated. |

Last completed milestone: SQL backup/restore validation and live read-only resource metadata inspection, fully validated and deployed to preview. Next actionable step: arrange an authorized test runner with two real preview sessions for direct scoped read/write/export denial, then controlled expiry/revocation and account switching. Existing browser capabilities support UI interaction but do not expose authenticated custom HTTP requests; do not extract cookies or bypass browser restrictions to manufacture this evidence. Do not ask the user to repeat previously confirmed usability checks.

## Inspection
- [x] Read AGENTS.md; user preview-only release instructions override older production rule.
- [x] Clean checkout; inspected main, remote branches, recent commits and open draft PRs #1/#2.
- [x] Inspect schema/migration: D1 holds memberships and one atomic serialized state per household; Supabase is authentication, not financial storage.
- [x] Live unauthenticated root redirects to `/auth/login` (2026-10-11).
- [ ] Confirm actual deployed commit with Cloudflare account access; repository head is a candidate, not proven deployment identity.
- [x] Isolated source branch and synthetic fixtures. Local tests use isolated SQLite/Miniflare, never remote D1.

## Stage 1 — implementation/local checks passed; legacy review outstanding
Existing: revision-checked whole-state writes, deterministic monthly estimate IDs, audited history, contract validation.
- [x] Historical changes respect later lender balance anchors.
- [x] Exact money examples, validation, auto-interest cycles.
- [x] Request retries return success for an already-persisted identical write without applying again.
- [x] Concurrent writes tested against real SQLite statements.

## Stage 2 — household security
Existing: server-verified Google identity, server-selected household membership, owner/admin/viewer roles, no public onboarding.
- [x] Unrelated household direct API isolation tests with synthetic identities and real SQL.
- [x] Inspect all routes and client credential exposure.
- [x] Preview owner Google sign-in, saved-payload reload/export, logout/re-login verified in live browser (2026-10-14); no record edits.
- [ ] Live unrelated-household/partner sessions, session expiry and production DB permissions remain unverified.
- [x] Public signup stays closed. No production schema/data changes.

## Stage 3 — saving/recovery
Existing: compact status, serialized pending outbox, revision conflict, form-safe background refresh, versioned backup import/export.
- [x] Retry and recovery tests; export/restore synthetic history.
- [x] Synthetic account-switch/session rejection, durable draft recovery and household scope integration tests.
- [ ] Real Google logout/expiry/switching and signed-in multi-device checks.
- [ ] Authenticated preview partner refresh/reconnect checks.

## Stage 4 — progress/payoff
Existing: starting snapshot preserved, archive history, loan tracker separates escrow, all projected months accessible.
- [x] Calculator models entered amount independently of minimum reservation; Plan reserves minimums.
- [x] Cents and edge cases verified.
- [x] Preservation of snapshot/date and visibility preferences.

## Stage 5 — mobile
Existing: Helvetica/light UI, account bubble, no refresh button, full-screen mobile forms/activity, card-tap edit and activity arrow.
- [x] Automated narrow-screen/text scaling, labels, keyboard/focus and touch-target checks; synthetic browser emulation.
- [ ] Physical-device and screen-reader verification; real keyboard/OS text settings remain unverified.

## Stage 6 — gated
Not started until prior checks pass, especially authenticated household isolation.
- [ ] Empty onboarding/create household.
- [ ] Invitation acceptance/expiry/revocation, owner/member controls, leaving/removal.
- [ ] Account deletion policy and support entry.
No real invitations, public signup or irreversible deletion activation.

## Release and handoff
- [x] Full lint/typecheck/tests/Worker dry-run.
- [x] Preview deployed on isolated D1; synthetic automated data only, owner Google sign-in user-confirmed. Real multi-account verification remains a separate gate.
- [x] Commit/push draft PR #4; release summary and rollback plan.

Production migration: none planned at inspection; do not apply any remote migration without recoverable backup and tested restore.

## Implementation checkpoint — 2026-10-11

Implemented (reviewed by coordinator):
- New lender reconciliation anchors preserve later confirmed balances when covered history changes; unchanged lender balances create an anchor too. Integer-cent ledger math and validation. Prior offset-only records stay intact; their historic anchors cannot be guessed. Next confirmed lender update establishes an anchor.
- Exact identical PUT retry acknowledges existing persisted revision; different stale writes conflict. Whole financial state is a single atomic D1 UPDATE.
- Identity + server-resolved household browser cache/outbox scope; old unscoped backups remain untouched for explicit recovery. No automatic adoption by new identities.
- Session rejection revokes staging, offline household editing disabled, visible persistence status, protected persisted export, sanitized server failure event names only.
- Calculator now models entered monthly scenario without minimum reservation; Plan reserves minimums within entered total. This corrects an existing semantic bug. Monthly forecast interest/payment/balance math rounds per account to cents; projections may change by pennies.
- Full-screen mobile forms, 44px close targets, keyboard viewport sizing, Escape/focus restoration.

Checks: lint passed, typecheck passed, all 238 Node tests passed, production-config Worker dry-run passed without publishing. Household tests execute real SQLite schema/queries behind synthetic authenticated-context adapters: they prove route scoping/revision behavior, not live token/session or D1 IAM verification.
Initial implementation CI passed 85 browser checks (4.5 minutes); local browser execution remains blocked at Vite startup: `os.networkInterfaces()` returns `uv_interface_addresses ERR_SYSTEM_ERROR`; physical device unavailable.

Existing live branch confirmed by successful production GitHub Actions run 38069700853 for base 35917dc; this is deployment-log evidence, not direct account inspection.

Preview workflow is isolated to this branch, uses `debtfree-dashboard-foundations-test` Worker + separate D1, applies only existing initial schema, and runs full validation before deployment. No production trigger matches this branch. Preview login uses existing Supabase public configuration, with no owner/bootstrap email; no public signup is enabled. Authenticated preview tests require a dedicated test auth project/allowlisted preview redirect and synthetic test household membership.

### Remaining gates (do not mark stages fully complete)
1. Complete authenticated two-household D1/API checks in preview, including real session expiry/logout/account switching and partner sync/reconnect. Read-only production permission inspection requires Cloudflare access (local Wrangler is not authenticated).
2. Review old offset-only saved reconciliation history against a recoverable export; do not automatically backfill guessed anchors. Capture first new lender anchors through normal balance updates after approved release.
3. Run browser suite in CI/working runtime and physical phone QA; obtain exact approved screenshots for pixel comparison.
4. Stage 6 remains unimplemented because prior security/session/mobile gates are not all verified. Next work: after gates pass, additive invitation table/token acceptance/expiry/revocation with test recipients, then household lifecycle and deletion policy. Current invitation mechanism still activates exact-email invitees upon verified login; not public-ready invitation semantics.
5. No production release requested or performed. No production backup/migration performed. Database SQL migration not required for this change; additive JSON reconciliation metadata only.


Remote branch commit: `7bff4cd9f332d0f171b8b7092923ad83152bf9ed` (initial implementation).
Draft PR: https://github.com/ensong0608/debtfree-dashboard/pull/4
Preview CI run: https://github.com/ensong0608/debtfree-dashboard/actions/runs/38182425792 (validation passed; preview provisioning failed HTTP 401).
Live unauthenticated `/api/household` returned 401 with `Sign in required` on 2026-10-11; authenticated production behavior remains unverified.


### Latest review checkpoint
- Reconciliation history now uses linear `previousAdjustmentId` references, not repeated embedded chains. 120 consecutive updates export/reload; deleting latest anchors skips deleted/moved predecessors, and earlier statement offsets absorb covered corrections.
- Calculator CSV/Excel/PDF label the scenario pool and no reserved minimums. Plan report labels unchanged.
- Initial CI run 38182425792: full `npm run validate` succeeded, including 85 browser checks; preview resource setup failed HTTP 401 on the D1 API request. Schema initialization and deployment were skipped. No preview URL exists yet.
- Exact next infrastructure dependency: repair/replace repository `CLOUDFLARE_API_TOKEN` with permission to create an isolated D1 database and deploy the isolated preview Worker in account `005a72abf0c701cfc067867e4f3ba034`. Do not grant browser access to the token or point the preview at production D1. No token contents were read or logged.
- Final code review additions passed 238 Node tests, lint/typecheck and Worker dry-run locally. Final source commit 6b471733a46d290031be7fa14a83e81a5a5e9a72 passed full CI validation (including browser checks) in run 38183064927. Stage 6 stays gated.


## Final handoff
Final source CI: https://github.com/ensong0608/debtfree-dashboard/actions/runs/38183064927
`npm run validate` PASSED on final source. Preview setup failed on `POST /d1/database` (creating the isolated test database) with HTTP 401, Cloudflare code 10000; initialization/deployment skipped. No test database or Worker deployment was created by these failed requests. Production was untouched throughout.
Saved reference inspected: `DebtFree debts, transactions, and budget screens(1).png` (October 7 concept); illustrative amounts were not imported. Current explicit preferences and latest UI remain authoritative; no claim of pixel matching all later screenshots.

Last completed milestone: financial engine, API retry/isolation/recovery, payoff semantics and mobile emulation validation. Stage 2 live auth/IAM and Stage 3 real session/partner checks are still outstanding, so Stage 6 is NOT started.
Next actionable step: fix repository Cloudflare token authorization, rerun preview workflow, configure dedicated test auth/preview callback and synthetic household members, then execute real two-household/session/partner tests. Do not switch preview binding to production or enable public signup to bypass this gate.
No SQL production migration required. Keep PR draft until release gates in PUBLIC_APP_RELEASE_PLAN.md pass.


## Preview retry — 2026-10-11 (supersedes prior permission blocker)
- After token permissions were updated, run 38183471606 attempt 2 passed full validation (238 Node tests; 85 browser checks, 2 skipped), isolated D1 provisioning, initial test-schema migration and preview deployment.
- Preview URL: https://debtfree-dashboard-foundations-test.ensong0608.workers.dev
- Cloudflare Worker version: bc9a000a-4600-430b-ae75-69f9779fd771.
- The immediate post-deployment login probe failed. Independent fresh probes afterward confirmed HTTP 200 with Google sign-in and HTTP 401 for both `/api/household` and `/api/household/export`. Deployment readiness timing is a plausible cause; no authenticated login is claimed verified.
- Workflow login verification now retries briefly with a strict bound, then still fails if readiness is absent. Data denial remains mandatory. Its verification script was run directly against the deployed preview and passed.
- Cloudflare D1-creation permission blocker is RESOLVED. Production Worker/D1/data remain untouched; test database starts empty and no financial records were copied from production.
- Next actionable step: configure test Google identity/household membership and verify preview OAuth callback, then test two unrelated households, session expiration/logout/switching and partner sync. Public signup remains closed. Stage 6 remains gated; physical-device QA and legacy reconciliation review still outstanding.


## Preview account enablement — 2026-10-11
The user selected their Google account for preview access. The workflow reads a protected GitHub repository secret `PREVIEW_OWNER_EMAIL` and installs it as the isolated Worker's `HOUSEHOLD_OWNER_EMAIL` secret. No plaintext email or email-derived identifier is published in source. Existing app authentication/bootstrap code is unchanged: first verified sign-in by the selected owner creates an empty test household; other identities cannot bootstrap.

Initial dependency (resolved 2026-10-14): user added the `PREVIEW_OWNER_EMAIL` repository secret. Run 38492206212 installed it successfully only on `debtfree-dashboard-foundations-test`, not production; the selected owner can now attempt verified Google sign-in. No invitations/messages or financial data copies. OAuth initiation already requested the exact preview callback and redirected to Google; actual completed sign-in/session and owner household creation remain unverified.


## Preview access retry and calendar correction — 2026-10-14
- User confirmed the protected preview owner secret is saved. Retry run 38185939814 attempt 2 stopped in validation before secret installation/deployment: nine browser failures exposed inconsistent browser-local versus Pacific household dates around UTC midnight.
- Fixed new balance/payment date defaults and current-month selection to use the existing Pacific household calendar, matching transaction entry and automatic interest. Saved dates, settings, financial records and production are untouched.
- Added a synthetic browser regression at the UTC/Pacific month boundary: lender reconciliation, payment and purchase must share October 31 and persist the correct balance after reload in desktop/tablet/phone.
- Source commit 7f3dfb0f2b9725c7a2896d70c46171a63070dfff passed full validation and deployment in https://github.com/ensong0608/debtfree-dashboard/actions/runs/38492206212: lint/typecheck, 238 Node tests, 88 browser checks (2 skipped), Worker dry-run.
- Cloudflare confirmed successful installation of the protected owner secret. Live preview login readiness and anonymous household/export denial checks passed. Deployed source Worker version: e6f96f33-c809-465c-b24f-a18c563af63e (secret upload follows source deployment).
- Actual Google sign-in, callback/session and empty owner household creation remain unverified. Next action: selected owner opens preview and completes Google sign-in; confirm it returns to the preview with an empty household. Then provision isolated synthetic identities/households for live isolation/session/partner QA before Stage 6.
- No SQL migration required by this correction; production Worker/D1/data/settings were untouched. Preview only uses its separate test D1; no production data copies or real invitations.


## Mobile onboarding scroll — 2026-10-14
- User confirmed preview Google sign-in now reaches onboarding after fixing the Supabase callback allowlist. Previous populated screen was a redirect to production, not evidence of shared financial data.
- User reported onboarding cannot scroll to bottom with two income sources on Android/Brave. Root cause: onboarding only had a minimum height and grew beyond the viewport, while body scrolling is intentionally disabled.
- Bound onboarding to the dynamic viewport height with internal vertical scrolling and a keyboard-focusable, named main region. No changes to financial values, saved drafts, snapshots, database schema, or production deployment.
- Added synthetic browser coverage for two incomes at 360/390/430px, a shortened keyboard-style viewport, wheel/keyboard scrolling, reachable Continue, preserved input and progression to debt setup.
- Source bb2fe50d90eaccecc36df16a334f450cda4c4bb8 passed full CI validation in run 38505456627 and preview deployment in https://github.com/ensong0608/debtfree-dashboard/actions/runs/38505456486: lint/typecheck, 238 Node tests, 91 browser checks (2 skipped), Worker dry-run. Scroll regression passed in all three browser projects.
- Preview source Worker version: 8cc82f57-3183-49c3-9a98-fb08077f066d. Protected owner secret installation and live login/anonymous household/export denial checks passed. No production release or new SQL migration.
- Local lint/typecheck passed; local browser checks could not start due to runtime network-interface error and blocked Chromium download, so browser validation relied on CI.
- First test draft failed only an exact money-label locator, corrected before successful validation/deployment; no failed version was deployed.
- Next action: reopen the preview on Android/Brave, confirm two-income setup scrolls to Continue and proceeds to debt setup. Physical keyboard/touch QA still remains; automated keyboard checks use viewport emulation. Continue live household isolation/session/partner tests afterward; Stage 6 stays gated.


## Household session and recovery work — 2026-10-14
- User confirmed mobile onboarding scrolling works on Android/Brave. Broader physical-device QA remains open.
- Reproduced account-switch overwrite with real SQLite: old A page could PUT into newly signed-in B household at the same revision. Fixed expected identity+household scope guards on reads, writes, export and member operations, always compared with server-verified context. Client scope never authorizes or selects a household. Old preview pages must reopen to supply new write headers.
- Outboxes remain per tab to avoid draft collisions; new tabs discover same-identity/same-household unsaved drafts and offer explicit recovery. Restored drafts retain their original revision, so newer partner history causes a conflict instead of silent replacement. Source outbox is cleared only after acknowledgment and only if unchanged.
- Failed Load latest retains the original outbox until an authorized read succeeds. Manual retry/read operations are serialized and reject stale results when a local edit or save happens during the read; a regression reproduces the formerly stale revision/display. Disposed controllers cannot stage or announce late responses. Invalid save acknowledgment retains the durable draft and reports failure.
- Import/reset messages stay pending until cloud acknowledgment; reset keeps a recovery checkpoint. Settings mutations reflect effective offline/session read-only status. No actual reset/import of user financial data was performed.
- Added delegated tests reviewed by coordinator: real SQL account-switch isolation and actual sync-controller/API retry/concurrency/recovery integration. Added browser storage close/reopen and reconnect/partner checks using synthetic transport; these are NOT real Google-session tests. No runtime auth bypass, new public route or production change.
- Local full Node suite, lint/typecheck and exact preview CI validation/deployment are being recorded below. No SQL migration required.

### Exact live verification dependency
The current preview shares the existing Supabase auth project and safely uses a separate D1. The live browser verified the selected owner session, export, logout and re-login. Additional test identities are not yet selected/provisioned; Supabase account settings and D1 IAM were not inspected directly. Live two-household checks need two verified Google test identities in separate preview households, plus a partner identity in one household, and authenticated browser/API sessions for each. Current private bootstrap permits one household; do not open signup or add a runtime bypass to manufacture these sessions. Provision test memberships only after explicit test identities are selected; send no invitations/emails.
Next after this batch: select/provision additional Google test identities in separate preview households safely, then run live direct API isolation and partner sync/expiry tests. Owner persistence/export/logout/relogin has passed. Stage 6 remains gated. Production release still requires approval and the release-plan backup/recovery gates.


## Session/recovery validation and handoff — 2026-10-14
- Final source: b9c144d71fb14d4fa8b5a8a03f7df842b15a742e. Full validation and preview deployment PASSED: https://github.com/ensong0608/debtfree-dashboard/actions/runs/38508880994 . Lint/typecheck, 262 Node tests, 97 browser checks (2 skipped), Worker dry-run; all new closed-tab/reconnect browser regressions passed.
- Preview source Worker version: 0064a952-c669-4a0b-9255-8311547a2b63. Protected owner secret installation and live login/anonymous API-denial smoke checks passed. No new SQL migration. Production Worker/D1/data untouched.
- Live browser: selected owner reached the preview; authenticated export produced a valid version-6 backup. Two further exports after reload and logout/re-login had deeply identical persisted payloads, including financial/history collections. No exported values, email, derived identifiers or private downloads were added to source. No financial operations, reset, restore or member changes were submitted in the live preview. Restoration continues to be tested with synthetic data in isolated SQLite.
- Sign out visibly returned to login, and Google re-login visibly restored owner access. This verifies that session path, not real token expiration/revocation across unrelated accounts. Direct API navigation after logout was blocked by the browser client/security policy; no workaround was attempted and that live API check is NOT claimed passed. CI unauthenticated API denial remains separately verified.
- User-reported Android/Brave onboarding scroll passes. Remaining physical keyboard/large-text/screen-reader testing remains open.
- Last completed batch: expected-session isolation guard, durable explicit outbox recovery, truthful restore/reset saving status, stale-read/disposal/ACK protections, synthetic integration/browser tests and live owner persistence/export/logout/re-login.
- Next actionable dependency: select an additional Google test account for an unrelated preview household and a partner test identity; provision them under controlled private test access, then verify real cross-household API denial and partner refresh/reconnect/expiry. Do not open signup, use a runtime auth bypass, or send messages to bypass the gate. Stage 6 remains unimplemented.


## Private unrelated-household fixture — 2026-10-14
- User selected the second Google test identity. Neither the email nor an email-derived identifier is committed in source. No invitation/message is authorized or sent.
- Added private CI provisioning using protected repository secret PREVIEW_ISOLATION_EMAIL. It is restricted to the preview branch, exact Cloudflare account, named preview D1, and rejects the production DB ID. No runtime authentication bypass or public registration changes.
- Creates only a new empty isolation household, active owner membership and NULL/revision-0 state using a parameterized D1 REST batch. Existing membership is never moved/upgraded; existing household/state rows are never updated/deleted/reset. Already-configured retries preserve saved progress.
- Ten synthetic SQLite fixture tests pass: primary household data/history preservation, empty second-household creation, retry safety, production/resource guard, invalid/missing configuration, member/collision refusal and rollback of a concurrent membership collision. Real D1 provisioning remains unverified until CI runs with the protected secret.
- Fixture job follows full preview validation/deployment. A missing secret fails before any fixture resource request; the deployed preview stays usable. Connected GitHub tools cannot create repository secrets.
- Exact next user dependency: add repository Actions secret PREVIEW_ISOLATION_EMAIL with the selected test email. Then rerun only the failed isolation-fixture job. Once provisioned, verify actual Google sign-in into that separate empty household and run live cross-household session/API checks. Do not add the selected identity to the existing preview household for this isolation test.
- No SQL schema migration or production release is required.


## Isolation fixture validation handoff — 2026-10-14
- Source 7bf2b6730b8f3cc2b786dc464ae6ed2ea492ccb9 passed preview validation/deployment in run https://github.com/ensong0608/debtfree-dashboard/actions/runs/38517371133 : lint/typecheck, 272 Node tests, 97 browser checks (2 skipped), Worker dry-run and live login/anonymous API-denial smoke checks. Preview source Worker version ce1ef35b-5718-4c93-96f3-e4cc4fe3e2ab.
- Separate isolation-fixture job 115701049208 FAILED during configuration validation because PREVIEW_ISOLATION_EMAIL was unavailable; owner-secret installation succeeded in the preview job. The guard runs before any fixture resource request. No second household/member rows were created by this attempt. Existing preview and production financial records were not modified.
- The selected test identity is NOT enabled yet. Required next action: user saves PREVIEW_ISOLATION_EMAIL as a protected repository Actions secret. Coordinator then reruns only the failed fixture job, checks safe D1 provisioning, and continues real second-account preview sign-in. No public signup, real invitations or production deployment.
- Live direct authenticated API verification remains a separate dependency: this cloud browser previously blocked direct API navigation and its security restriction must not be bypassed. Synthetic direct-request/SQLite isolation tests passed; real two-household API/session behavior is not claimed verified.

## Stage 4 follow-up — October 13, 2026 (Pacific)

Stage 2 is paused at the user's request until tomorrow. The unrelated-household provisioning job now requires an explicit workflow dispatch with `provision_isolation_fixture=true`; ordinary preview pushes perform validation/deployment only. The protected `PREVIEW_ISOLATION_EMAIL` dependency remains outstanding. No isolation fixture or production changes are part of this follow-up.

Reviewed existing Stage 4 source/tests before editing. Existing coverage already proves Calculator versus Plan pool semantics, minimum reservation/rejection, zero APR, reallocation, final partial payments, cent conservation, hidden/archived debts, starting snapshot preservation, removed-account retention, and escrow/principal separation. Independent read-only audit found the same calendar gap; coordinator reviewed its reproduction and owns all changes.

- [x] Share the existing Pacific household date across Progress/activity, payoff schedule months, and inclusive promotional end dates. This fixes October transactions disappearing from current-month totals on a device already in November. Stored dates/settings/history remain unchanged.
- [x] Distinguish a projection capped at 1,200 months from an immediately non-amortizing scenario; retain every calculated month.
- [x] Leave stopped exports' months-to-payoff blank in CSV/Excel/PDF, rather than claiming the number of evaluated rows is a completed payoff time. Limit status has distinct compact wording.
- [x] Local lint, typecheck, diff check, and 276 Node tests pass. New synthetic tests cover cap/nonpayoff wording, export preservation, Pacific boundaries and leap-February promo day clamping. Existing inclusive promo test now uses explicit instants on the intended Pacific dates.
- [x] CI browser checks/build/dry-run/preview deployment for this follow-up (final results below).
- [ ] Physical-device/accessibility review remains Stage 5 work; browser regressions are emulation only.

No schema migration, production data write, snapshot replacement, or public signup change is required. Next independent work after this preview validation: Stage 5 large-text, mobile input/touch/focus/navigation checks. Resume Stage 2 private identity setup only when the user resumes it; then explicitly dispatch its fixture job after saving the protected second test-email secret. Stage 6 stays gated.

Stage 4 calendar completion: default recurring due dates, debt-card payoff labels and legacy Home summaries also share the Pacific calendar. Saved due-day values stay intact; a synthetic frozen-clock test verifies October 31, November 30, then December 31. The additional regression passes (277 Node checks including the prior full run).

Initial Stage 4 CI source f4555c6: 276 Node tests and 97 browser checks passed; three viewport cases of the new long-projection regression failed before navigation because its synthetic import omitted required detailedSpendingTracking. Corrected the fixture (no app/import validation weakening). Latest calendar-completion source 7e0a1b1 also requires this test-only correction before final preview validation.

### Validated Stage 4 handoff — October 13, 2026 (Pacific)

- Final tested source: `e2f4a91acb57e4321ec45083e5ab90e007557fd5` on `codex/public-app-foundations-20261011`; draft PR #4.
- Preview run `38520027932`, job `115709333922`: SUCCESS. Lint/typecheck, 277 Node tests, 100 browser checks (2 existing skips), exact Worker dry-run, isolated deployment, private owner-secret configuration, login readiness and anonymous API/export denial passed. Both independent Validate dashboard runs for this source also passed.
- Deployed source Worker version: `358be7b0-3369-4c1d-93c9-4af33a26c0e5` at https://debtfree-dashboard-foundations-test.ensong0608.workers.dev/ . Schema step reported no migrations to apply. No new SQL migration is required.
- Isolation-fixture job `115711629086`: intentionally SKIPPED on push. Stage 2 remains paused; no unrelated test household was provisioned. Use manual workflow dispatch with `provision_isolation_fixture=true` only when Stage 2 resumes and its protected secret is supplied.
- Browser/calendar/long-schedule checks are CI emulation with synthetic imports, not physical device, live Google partner, expiration or production-data verification. No live financial edits or production deployment performed in this follow-up.
- Last completed independent milestone: Stage 4 follow-up corrections and preview validation. Next actionable independent step: Stage 5 keyboard tab navigation (Debt category and Planned/Recorded role=tab widgets lack roving tabindex and Arrow/Home/End behavior), then global 200% text resizing, non-navigation touch-target dimensions, reverse/nested dialog focus and broader page/dialog accessibility checks. Existing 320–430px layouts, selected larger text, forward focus trapping, Escape restoration and shortened viewports already have tests; extend gaps rather than recreating them. Physical screen-reader/keyboard/text-size checks remain unverified.
- Stage 2 real two-household/session/IAM checks and Stage 3 live partner/expiry checks remain dependencies; Stage 6 is still gated. Current saved starting snapshot/date and all production financial data remain untouched.

## Stage 2 resumed — October 14, 2026 (Pacific)

User resumed Stage 2 and confirmed the test email was saved on GitHub. Inspected AGENTS, clean branch, current remote head, migration and unchanged provisioning script before action.

- [x] Reran only the previously failed isolation-fixture job from run 38517371133. The reviewed script is identical in old source 7bf2b67 and current head 1425c64. No app redeploy or schema migration was requested/executed in this follow-up; the preview job reported in rerun metadata reuses its original October 14 05:34–05:41 UTC logs, not a new deployment.
- [x] Job 116197649510 succeeded at 2026-10-15 01:29 UTC: protected owner/test email secrets were available; remote guarded D1 setup returned `created`. Separate test household, active owner membership and empty NULL/revision-0 state were created. Existing household records were not updated/reset; no messages sent. Script verified joined membership/ownership/state metadata after creation.
- [x] Retried fixture job 116198067932: SUCCESS, `already_configured` at 01:30 UTC. The retry performed metadata reads only and preserved existing household/state rows.
- [x] 14 targeted local Node tests passed: fixture production/resource guards, collisions/transaction rollback, retry preservation and expected-session/account-switch authorization.
- [x] Live original preview account/settings remained accessible; sign-out returned the login screen.
- [ ] Live second-account sign-in is blocked in this cloud browser: Google OAuth page returned 502 Bad Gateway with connection refused; one reload had the same outcome. No credentials were entered, no sign-in success inferred, no API navigation/security restriction bypassed. The user's PC session is separate from the cloud browser.
- [ ] Real two-household read/write/export denial, live partner sync, real session expiry/revocation and production IAM remain unverified. Synthetic API/SQLite tests do not establish these live properties. Public signup and Stage 6 remain gated.

Current next action: independent PC browser QA with the configured second Google test account at the verified preview origin. It should remain on the foundations-test host and reach empty onboarding for its own household. Do not import/copy existing household finances or add the second identity to the primary household. Then continue authorized live isolation/session checks when authenticated browser access is available. Production data and saved starting snapshot/date were not changed. Branch remains codex/public-app-foundations-20261011, draft PR #4; deployed source remains e2f4a91 (Stage 4), and no new SQL migration is required.

## Unified Debt + loan entry — October 14, 2026 (Pacific)

User reported no housing choice from Debt +, too many steps to track a house/car loan, and a disabled Save button with no indication of missing fields.

- [x] Inspect current implementation, clean branch/remote/PR, instructions and existing loan tests; preserve saved accounts, balances, snapshots, Budget links and loan histories.
- [x] Debt + now offers House loan and Car loan. Selecting one reuses the same loan editor as Track loan, carrying entered name/balance/APR; successful creation selects House & car automatically. Existing generic Auto loan accounts remain editable in their existing representation; no financial migration/reclassification is performed.
- [x] Budget linking is optional for loan creation/editing. JSON contract accepts both link strings empty, still rejects incomplete pairs/types; existing linked loans keep ID/name matching. No D1 schema migration.
- [x] Save loan stays usable for authorized online users; missing/invalid name, original/remaining amount, balance date, APR or escrow gets an announced error and field-specific description/invalid marker. First invalid field receives focus. Blank remaining balance is distinct from explicitly entered zero. Money is normalized to cents before save; stale existing-loan edits are rejected.
- [x] Mobile loan forms fill the visual viewport with scrollable fields and visible footer. Fixed per-lender new-loan preset removed; existing saved terms are preserved. Updated the old synthetic amortization UI test to enter its own test terms explicitly.
- [x] Independent read-only review found a possible offline unmount losing local loan input. Corrected by keeping the editor mounted for its authorized role and disabling Save through readOnly. Existing household/sync revision/session protections remain in force.
- [x] Local lint/typecheck, diff check and 280 Node tests pass. New tests exercise missing/invalid fields, optional Budget linking, complete/incomplete contract roundtrip, zero terms and unsupported money/date values. One old calendar regression fixture now specifies the intended Pacific offset rather than depending on the host timezone.
- [x] CI full browser suite, Worker dry-run and preview deployment passed (final evidence below). New browser regression covers direct house/car creation, actionable validation/focus, viewport size, no Budget prerequisite, reload and preservation of card/starting progress totals; synthetic screenshots only.

Stage 2 live cross-household/session checks remain unfinished. No real data import, member change, message, production write or public signup change is included here. Next: finish preview validation and record deployment evidence, then continue outstanding authorized Stage 2 and mobile accessibility checks.

Unified-loan first CI: 280 Node tests and 100 existing browser checks passed. New regression stopped before loan selection because it used an exact Current balance label lookup while the shared currency field label includes its prefix. Corrected only the selector; no application validation weakened. Deployment stayed gated on the failed run.

Unified-loan final source `9fb00013411ab7c92bb14219e92d69462eb33d64` passed independent validation run 38678808215: lint/typecheck, 280 Node tests, 103 browser checks (2 existing skips), build and exact Worker dry-run. The complete new loan workflow passed desktop/tablet/phone; test selectors now account for implicit currency/select label content. Reviewed the synthetic phone screenshot from artifact 11947792547: first missing amount is focused/red with its specific message, loan fields scroll, and Save/Cancel remain visible in a full-height modal. This is emulation, not a physical phone verification. Preview deployment run 38678805030 is still pending completion at this note.


### Unified Debt + final validation and handoff

- Tested/deployed source: `9fb00013411ab7c92bb14219e92d69462eb33d64` on `codex/public-app-foundations-20261011`, draft PR #4. Source changes were reviewed and integrated by the coordinator; no SQL migration was added.
- Preview run `38678805030`, job `116239623791`: SUCCESS. Lint/typecheck, 280 Node tests, 103 browser checks (2 existing skips), production bundle build/dry-run, isolated preview deployment, private owner-secret configuration, login readiness and anonymous household/API-export denial passed. Preview schema step: no migrations to apply. Isolation provisioning job `116241788393` intentionally skipped on push.
- Preview source Worker version: `d24e1c04-39c9-4f1e-aa55-84b026034eae`, URL https://debtfree-dashboard-foundations-test.ensong0608.workers.dev/ . No production deployment or financial-data mutation was performed.
- New regression proves direct house/car entry, name/balance carry-over, specific error messages and focus, optional Budget, mobile fullscreen geometry, reload persistence, and preservation of original card/starting Progress totals. Synthetic phone screenshot was visually inspected. Physical-device verification of this new form is still pending; live Google/partner/session/IAM Stage 2/3 gates remain open.
- Last completed milestone: unified Debt + house/car entry and actionable loan validation, deployed to preview. Next user check: use Debt + in preview, select House loan or Car loan, try Save with missing required fields, then save a synthetic loan and verify its House & car category. Existing generic Auto loan/Other entries are not silently converted or deleted, avoiding ledger/snapshot damage.
- Next coordinator work: continue live Stage 2 isolation checks when signed-in access is available, then the previously recorded Stage 5 keyboard/text/touch/focus work. Stage 6/public signup and production release remain gated. For rollback after saving unlinked loans, retain a compatible validator or forward-fix as documented in PUBLIC_APP_RELEASE_PLAN.md; do not delete data to satisfy older validators.

## Stage 5 follow-up — single debt entry and accessibility

User explicitly removed + Track loan in favor of Debt +, then authorized the next independent stage. Stage 2/3 live isolation/session dependencies still block Stage 6; proceeding with independent Stage 5 rather than opening signup.
- [x] Removed redundant + Track loan control, retained editing/payment/activity for saved loans; updated existing browser workflow to enter through Debt +.
- [x] Added roving tab stops and ArrowLeft/ArrowRight/Home/End selection for Debt category and Planned/Recorded tablists.
- [x] Validate keyboard focus wrapping, reverse modal focus, touch targets and global 200% text on narrow layouts using synthetic data.
- [x] Full validation/build/dry-run and preview deploy; production untouched.

Stage 5 implementation review: independent read-only review found no code/selector regressions. Strengthened large-text tests to inspect container/control overflow and scroll/bound the final schedule card above navigation. Text test doubles actual stylesheet font sizes (including px-based declarations), not browser/CSS zoom. Local lint/typecheck and 281 Node tests pass; preview browser/build/dry-run/deployment checks pending. Loan-form close control now meets a 44px target; intrinsic wrapping prevents enlarged titles/nav/currency text from pushing controls away. Existing saved data and calculator/plan semantics are unchanged.

Stage 5 first CI: 281 Node and 109 browser checks passed, including doubled-text overflow/schedule bounds and tab navigation. The reverse-focus regression exposed a real issue: switching to loan entry unmounted Debt +, leaving the stored focus return target disconnected. The debt add bar now remains mounted but hidden during entry, preserving the original trigger for focus restoration. No test was weakened. Deployment was skipped on the failed run.


### Stage 5 follow-up validation and handoff

- Tested/deployed source: `ee4daa33687d8c2e35b029c691b08062c0711191` on `codex/public-app-foundations-20261011`, draft PR #4. Preview run `38681866800`, job `116247981718`: SUCCESS. Lint/typecheck, 281 Node tests, 112 browser checks (2 existing skips), bundle build and exact Worker dry-run passed. Reverse-focus regression now passes across all three browser projects; no test was weakened.
- Preview deployment, private owner-secret configuration, login readiness and anonymous API/export denial passed. Source Worker version: `4b8d0448-b461-4c55-83ca-2f116948e484`; URL https://debtfree-dashboard-foundations-test.ensong0608.workers.dev/ . Schema step reported no migrations to apply; no SQL migration was added. Isolation fixture job `116250111272` intentionally skipped on ordinary push.
- Debt + is now the sole debt creation entry. Existing loan editing/payment/activity remain available. Added tab keyboard navigation, 44px loan-close target, enlarged-text wrapping and focus restoration after loan entry. Synthetic 200% text tests inspect internal overflow and ensure the final schedule month is accessible above navigation. These are browser emulation results, not physical-device or screen-reader verification.
- Last completed milestone: this Stage 5 accessibility batch, validated and deployed to preview. No production deployment, financial-data mutation, starting snapshot/date replacement or invitation occurred. Existing migration/compatible-validator rollback plan remains in PUBLIC_APP_RELEASE_PLAN.md; this UI batch needs no data migration.
- Next actionable step: resume live Stage 2 with authenticated access to the independently provisioned test household, verify empty onboarding and actual cross-household read/write/export denial, then partner sync and session expiration/revocation/account switching. Google OAuth in this cloud browser previously returned 502/connection refused; user-PC sign-in does not authenticate this session. Production IAM and legacy reconciliation review remain release dependencies. Complete physical keyboard/mobile/OS text/screen-reader checks when hardware is available. Stage 6 remains gated; public signup stays closed.


## Stage 3 follow-up — Google account selection

User reports Stages 2/4 and Stage 3 partner update/draft/reconnection checks look good. Record these as user-reported checks, not independent live/API/IAM verification. Account switching is not passed: after logout, Google reuses its previous incognito-session identity.

- [x] Inspected clean branch, AGENTS, current remote head, auth/login/logout/callback flow and existing auth tests. Sign-out uses local Supabase scope; login did not request Google's account chooser.
- [x] Google OAuth now requests `prompt=select_account` on every explicit sign-in. Preview-specific callback, PKCE, origin checks, server membership validation and local sign-out behavior stay intact. No financial/state/schema changes or public signup.
- [x] Run auth regression, full validation and preview deployment; final evidence below.
- [ ] Live Google chooser and switching between the two test identities need verification after deployment; do not infer these from synthetic route tests. Production IAM, independent direct-API isolation/session-expiration checks and physical accessibility remain outstanding.

First account-selection preview run `38686759974`: 286 Node tests, 112 browser checks (2 existing skips), build/dry-run, schema step (no migrations), deployment and private owner-secret configuration passed. Source `e255c99f035c87ce373f060c7d52a64353032781`, Worker version `6aeab3fa-8741-4fdb-83b1-a12aa61c6aaf`. The new immediate post-deploy OAuth configuration check failed without logging response details; a subsequent independent unauthenticated live POST passed every expected condition (303, Supabase authorize, Google provider, select_account, preview callback and S256 challenge). The exact initial mismatch was not captured. Added the same bounded propagation/network retries used by login readiness, retaining every assertion; final workflow rerun pending. No provider sign-in or authenticated API bypass performed.

Additional independent unauthenticated preview smoke: followed only the generated Supabase authorization redirect (manual redirects; no credential entry/session import). Supabase returned 302 to accounts.google.com with `prompt=select_account`, confirming pass-through to Google. Anonymous household read and persisted export each returned 401. This establishes redirect configuration, not a completed Google chooser/account-switch test or authenticated cross-household isolation.

### Account-selection final validation and handoff

- Final source: `3a7aa9f63be38b66de370cf5ef1733f44eb110bd` on `codex/public-app-foundations-20261011`, draft PR #4. Preview run `38687596588`, job `116265907992`: SUCCESS. Lint/typecheck, 286 Node tests, 112 browser checks (2 existing skips), exact Worker build/dry-run, deployment and private owner-secret configuration passed.
- Live workflow verifies Google account-selection request, preview callback and S256 PKCE challenge. Login readiness and anonymous household/export denial passed. Worker source version `81edf661-e46f-44be-8073-b96e636d5830`; URL https://debtfree-dashboard-foundations-test.ensong0608.workers.dev/ . No SQL migration required (schema step: no migrations to apply); isolation fixture intentionally skipped on push. Production and saved financial data were untouched.
- Last completed milestone: explicit Google sign-in requests the account chooser, validated/deployed to preview. Next user check: sign out from preview, click Google sign-in, choose the other test identity and verify only its household appears. Incognito can retain Google's session while private windows remain open; app logout stays local and does not sign the user out of Google globally.
- Do not mark account-switching or Stage 3 fully verified until the actual chosen-identity flow is confirmed. User reports prior Stages 2/4 and partner/draft/reconnection checks good; independent authenticated direct-API isolation, actual expiration/revocation, production IAM, recovery and physical accessibility remain separately tracked release gates. Stage 6/public signup still gated.


## Recovery and resource inspection — final handoff, October 15, 2026 (Pacific)

- Tested/deployed source: `201a1522e30057a5ee2e75ad55f7f78a7bfac3f3` on `codex/public-app-foundations-20261011`, draft PR #4. Recovery scripts, resource guards, CI integration and release/checklist documentation were reviewed on resumption; pre-existing edits were preserved. Git CLI push lacked credentials, so identical source-tree contents were committed through the connected repository API, fetched, and verified identical before aligning the local branch. No credentials were requested or exposed.
- Preview run `38754352950`, job `116488702461`: SUCCESS. Lint/typecheck, 289 Node tests, local D1 SQL recovery, 112 browser checks (2 existing skips), build/exact Worker dry-run, resource inspection, isolated deployment, owner-secret configuration, login readiness, Google account-choice/callback/PKCE and anonymous household/export denial all passed. Isolation fixture `116492500033` intentionally skipped; no test households were reset or reseeded.
- Preview source Worker version: `19a29905-6588-4deb-bd14-ffcddfc5aa52`; URL https://debtfree-dashboard-foundations-test.ensong0608.workers.dev/ . Schema step: no migrations to apply. No new SQL migration or data conversion is required. This batch changes scripts/validation/docs only; app UI, Calculator/Plan semantics, saved balances, loan history and original starting Progress amount/date are unchanged.
- Live read-only resource inspection confirmed production database name/DB binding, Supabase provider, production deployment/source-version metadata and isolated preview DB binding. The first production deployment listed by Cloudflare was `accd1862-fdf1-4005-b2be-3782b1ed9bbe`, version `3d33cea1-2c2e-436f-885e-96038f7e28ca`. No production SQL/payload read or write, migration or deployment occurred. This does not establish account-wide IAM, other principals or token policy scopes.
- Live browser: Google chooser loaded; user securely selected an approved saved identity, fresh preview UI showed its distinct household and owner identity, and Sign out visibly returned to login. Existing preview data was viewed only; it was not assumed synthetic, copied into fixtures, exported or edited. This is one identity’s successful UI login/logout, not independent cross-household API denial, controlled session expiry/revocation, live partner synchronization or every account-switch/draft boundary.
- Local recovery is actual SQL export/restore into separate disposable local D1 databases, with exact state/member/revision/payload comparison and foreign-key/quick-check validation. It does not close remote backup restoration or consistent production backup prerequisites. No production backup was downloaded. Follow the release plan before any future approved production migration; preserve anchor-aware and optional-loan-validator rollback compatibility.
- Remaining dependencies: two controlled real Google sessions plus an authorized direct-request runner; controlled auth expiry/revocation; independent live partner session; account-admin IAM visibility; private consistent production backup/legacy reconciliation review and separate remote restore validation; physical phone/screen-reader/keyboard/OS text-size access. User-reported checks stay recorded separately and need not be repeated.
- Stage 6 and public signup remain gated. Inspect existing member auto-activation and owner-only add/remove before implementing explicit invitation acceptance/expiry/revocation after required gates pass. Do not send messages or enable public access. Production release still requires explicit approval after a concrete release and migration/rollback summary.
