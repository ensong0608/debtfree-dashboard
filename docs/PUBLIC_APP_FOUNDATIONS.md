# Public mobile app foundations — tracked implementation

Branch: `codex/public-app-foundations-20261011`
Base: `35917dc` (`codex/mobile-payments-budget`, current PR #2 head).
Production remains unchanged. Never deploy this branch to production automatically.
Coordinator owns APIs, sync, migration decisions and this checklist. Financial and payoff work have separate file owners.

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
- [ ] Verify deployed identity/session and production DB permissions (requires authenticated Cloudflare/Supabase test access).
- [x] Public signup stays closed. No production schema/data changes.

## Stage 3 — saving/recovery
Existing: compact status, serialized pending outbox, revision conflict, form-safe background refresh, versioned backup import/export.
- [x] Retry and recovery tests; export/restore synthetic history.
- [ ] Account switching/logout/session expiry checks and safe local state isolation.
- [ ] Authenticated preview partner refresh/reconnect checks.

## Stage 4 — progress/payoff
Existing: starting snapshot preserved, archive history, loan tracker separates escrow, all projected months accessible.
- [x] Calculator models entered amount independently of minimum reservation; Plan reserves minimums.
- [x] Cents and edge cases verified.
- [x] Preservation of snapshot/date and visibility preferences.

## Stage 5 — mobile
Existing: Helvetica/light UI, account bubble, no refresh button, full-screen mobile forms/activity, card-tap edit and activity arrow.
- [ ] Narrow screens, text scaling, labels/focus/touch targets; distinguish emulation from physical device.

## Stage 6 — gated
Not started until prior checks pass, especially authenticated household isolation.
- [ ] Empty onboarding/create household.
- [ ] Invitation acceptance/expiry/revocation, owner/member controls, leaving/removal.
- [ ] Account deletion policy and support entry.
No real invitations, public signup or irreversible deletion activation.

## Release and handoff
- [x] Full lint/typecheck/tests/Worker dry-run.
- [ ] Preview deployment on isolated test DB, with synthetic data and test auth only.
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

Dependency: the user must add the `PREVIEW_OWNER_EMAIL` repository secret; connected GitHub tools cannot manage repository secrets. Owner access is NOT yet enabled. Once set, rerun preview workflow; the secret is installed only on `debtfree-dashboard-foundations-test`, not production. No invitations/messages or financial data copies. OAuth initiation already requested the exact preview callback and redirected to Google; actual completed sign-in/session and owner household creation remain unverified.
