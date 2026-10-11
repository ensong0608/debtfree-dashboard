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
