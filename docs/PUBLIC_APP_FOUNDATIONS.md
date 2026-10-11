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

## Stage 1 — correctness (in progress)
Existing: revision-checked whole-state writes, deterministic monthly estimate IDs, audited history, contract validation.
- [ ] Historical changes respect later lender balance anchors.
- [ ] Exact money examples, validation, auto-interest cycles.
- [ ] Request retries return success for an already-persisted identical write without applying again.
- [ ] Concurrent writes tested against real SQLite statements.

## Stage 2 — household security
Existing: server-verified Google identity, server-selected household membership, owner/admin/viewer roles, no public onboarding.
- [ ] Unrelated household direct API isolation tests with synthetic identities and real SQL.
- [ ] Inspect all routes and client credential exposure.
- [ ] Verify deployed identity/session and production DB permissions (requires authenticated Cloudflare/Supabase test access).
- [ ] Public signup stays closed. No production schema/data changes.

## Stage 3 — saving/recovery
Existing: compact status, serialized pending outbox, revision conflict, form-safe background refresh, versioned backup import/export.
- [ ] Retry and recovery tests; export/restore synthetic history.
- [ ] Account switching/logout/session expiry checks and safe local state isolation.
- [ ] Authenticated preview partner refresh/reconnect checks.

## Stage 4 — progress/payoff
Existing: starting snapshot preserved, archive history, loan tracker separates escrow, all projected months accessible.
- [ ] Calculator models entered amount independently of minimum reservation; Plan reserves minimums.
- [ ] Cents and edge cases verified.
- [ ] Preservation of snapshot/date and visibility preferences.

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
- [ ] Full lint/typecheck/tests/Worker dry-run.
- [ ] Preview deployment on isolated test DB, with synthetic data and test auth only.
- [ ] Commit/push draft PR; release summary and rollback plan.

Production migration: none planned at inspection; do not apply any remote migration without recoverable backup and tested restore.

## Implementation checkpoint — 2026-10-11

Implemented (reviewed by coordinator):
- New lender reconciliation anchors preserve later confirmed balances when covered history changes; unchanged lender balances create an anchor too. Integer-cent ledger math and validation. Prior offset-only records stay intact; their historic anchors cannot be guessed. Next confirmed lender update establishes an anchor.
- Exact identical PUT retry acknowledges existing persisted revision; different stale writes conflict. Whole financial state is a single atomic D1 UPDATE.
- Identity + server-resolved household browser cache/outbox scope; old unscoped backups remain untouched for explicit recovery. No automatic adoption by new identities.
- Session rejection revokes staging, offline household editing disabled, visible persistence status, protected persisted export, sanitized server failure event names only.
- Calculator now models entered monthly scenario without minimum reservation; Plan reserves minimums within entered total. This corrects an existing semantic bug. Monthly forecast interest/payment/balance math rounds per account to cents; projections may change by pennies.
- Full-screen mobile forms, 44px close targets, keyboard viewport sizing, Escape/focus restoration.

Checks: lint passed, typecheck passed, all 232 then 233 Node tests passed (final count to confirm), production-config Worker dry-run passed without publishing. Household tests execute real SQLite schema/queries behind synthetic authenticated-context adapters: they prove route scoping/revision behavior, not live token/session or D1 IAM verification.
Browser tests added but local execution blocked at Vite startup: `os.networkInterfaces()` returns `uv_interface_addresses ERR_SYSTEM_ERROR`; physical device unavailable.

Existing live branch confirmed by successful production GitHub Actions run 38069700853 for base 35917dc; this is deployment-log evidence, not direct account inspection.

Preview workflow is isolated to this branch, uses `debtfree-dashboard-foundations-test` Worker + separate D1, applies only existing initial schema, and runs full validation before deployment. No production trigger matches this branch. Preview login uses existing Supabase public configuration, with no owner/bootstrap email; no public signup is enabled. Authenticated preview tests require a dedicated test auth project/allowlisted preview redirect and synthetic test household membership.

### Remaining gates (do not mark stages fully complete)
1. Complete authenticated two-household D1/API checks in preview, including real session expiry/logout/account switching and partner sync/reconnect. Read-only production permission inspection requires Cloudflare access (local Wrangler is not authenticated).
2. Review old offset-only saved reconciliation history against a recoverable export; do not automatically backfill guessed anchors. Capture first new lender anchors through normal balance updates after approved release.
3. Run browser suite in CI/working runtime and physical phone QA; obtain exact approved screenshots for pixel comparison.
4. Stage 6 remains unimplemented because prior security/session/mobile gates are not all verified. Next work: after gates pass, additive invitation table/token acceptance/expiry/revocation with test recipients, then household lifecycle and deletion policy. Current invitation mechanism still activates exact-email invitees upon verified login; not public-ready invitation semantics.
5. No production release requested or performed. No production backup/migration performed. Database SQL migration not required for this change; additive JSON reconciliation metadata only.
