# Foundations release and rollback plan

Public-launch gates below remain open. The user separately approved the existing-household private production release on October 15, 2026, including the encrypted recovery destination. See PRIVATE_PRODUCTION_RELEASE_20261015.md for exact release, backup and preservation evidence; this approval does not open public signup or activate Stage 6.

## Before production approval
- Pass lint, types, all Node tests, browser suite and exact Worker dry-run for final commit.
- Confirm production identity/deployment and export household JSON plus a recoverable D1 export. Securely store outside this public repository. Validate restore into separate test D1.
- Inspect existing progress starting total/date and old reconciliation records without editing them.
- Verify real two-household authentication/read/write/export denial and owner/admin/viewer boundaries in preview. No privileged client credentials; D1 accessible only through Worker binding and server-selected membership. No public registration.
- Test Google session expiry/refresh/logout/switching and unsaved form preservation with two test identities. Configure dedicated test auth, callback allowlist and memberships first; never seed real household data into preview.
- Run phone keyboard, text scaling, touch, focus and back navigation checks. Existing scripts are emulation, not physical-device validation.

## Release
- Review draft PR against `codex/mobile-payments-budget`, then reconcile the existing PR stack before approving a production target.
- Deploy exact tested source through Cloudflare only after user approval.
- No SQL migration needed. Reconciliation JSON metadata is additive, legacy records preserved. Do not reset or bulk transform financial state.
- Verify authenticated saved balances, starting snapshot/date, persistence, exports and estimates before continuing household use.

## Rollback
- Stop writes if balance correctness is questioned; export current state first.
- Prefer a forward fix. The prior Worker understands legacy offset-based accounting but does not enforce new anchors when history changes. Do not simply revert code and then edit history containing anchors.
- A code-only rollback is suitable before any new financial writes. After writes, validate original/current export in isolated DB and retain every transaction/audit revision before choosing a recovery path.
- Never delete/recreate production D1 or import a stale backup over newer household activity without deliberate reviewed reconciliation.
- Preview failure requires no production rollback: preview Worker/DB are separate and production remains untouched.

## Stage 4 follow-up release behavior

The established Pacific household calendar now controls current activity/Progress months, recurring due-date defaults, debt payoff labels and promotional forecast dates on every device. This can correct displayed forecast months/rates near Pacific midnight; no saved due day, snapshot date, account term or financial history is rewritten. Forecasts that reach the 1,200-month limit retain their complete schedules and have distinct wording. Stopped exports leave months to payoff blank; they do not imply a completed payoff time.

No SQL migration or data rollback is required for these display/calendar corrections. Continue to follow the anchor-aware rollback restrictions above for the broader foundations branch. Household isolation provisioning now requires explicit manual workflow dispatch with its Stage 2 boolean input; ordinary preview pushes skip that job while Stage 2 is paused.

## Unified loan entry compatibility

House/car entry through Debt + saves the existing loanTracker representation, without reclassifying existing debts or changing SQL schema. Empty Budget links are now supported as a pair so a fresh household can add a loan before setting up Budget. Old application versions reject these empty links: after new unlinked loans have been saved, prefer a forward fix or retain a compatible validator during rollback. Do not delete the loan or invent Budget entries to make an older release accept it. Preserve a full private export before any reviewed recovery. Existing linked loans, escrow terms, history and pinned starting Progress values stay intact.


## Recovery validation checkpoint — October 15, 2026

`npm run test:recovery` now runs in mandatory validation. It creates two disposable local D1 databases with hard-coded synthetic bindings in a temporary configuration, seeds the current schema and synthetic financial/member data, exports complete tables with Wrangler, restores them into the other database, and compares all stored columns and exact payload bytes. It verifies revision, starting Progress balance and saved snapshot date, deleted history, optional loan Budget links, membership roles/status, empty household state, foreign keys and D1 `quick_check`. Temporary databases/SQL are removed afterward. No credentials or remote database access is needed.

The initial drill exposed a local restore ordering failure: the existing migration creates child tables before `households`, and the default dump interleaves child inserts before the parent table exists. For this static synthetic drill, per-table exports are combined in dependency order (`households`, `household_members`, `household_state`) without modifying row values or disabling foreign keys. A schema inventory assertion requires review if application tables are added. The earlier JSON export/import tests alone did not exercise this SQL path.

**Scope:** this is local D1 recovery evidence, not remote Time Travel, production backup recoverability or a consistent live multi-table snapshot. Do not apply the per-table procedure to an actively changing production database: separate exports can capture different moments. Before any approved production migration, obtain a recoverable consistent private D1 backup plus household export, validate restoration in a separate non-production D1 using the actual remote export format, inspect original starting balance/date and legacy reconciliation, and review the migration/rollback plan. No production backup or financial payload was downloaded during this batch.

Preview CI also performs read-only resource metadata inspection: production deployment IDs/source version IDs, expected production DB binding/auth provider, and separate preview DB binding. A successful result does not establish all IAM principals or token policies. This diagnostic step is allowed to fail without blocking an otherwise valid isolated preview; its failure must remain visible and unresolved for production approval.

This batch changes validation/scripts/docs only. There is no SQL migration, financial data conversion, UI or payoff behavior change. Production deployment remains unapproved. Code-only rollback of this batch is safe; rolling back the broader foundations branch still requires the anchor-aware and optional-loan-validator compatibility rules above.
