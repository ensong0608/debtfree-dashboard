# Foundations release and rollback plan

This is a draft preview release, not approval to deploy production.

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
