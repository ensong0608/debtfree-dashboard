# DebtFree public-mobile continuation checklist

Started October 16, 2026 Pacific. This supersedes status assumptions in the October 10 requirements assessment; it does not replace the owner's original requirements file. Historical user acceptance of Stage 2/4/design/private release is user-confirmed usability evidence, not an independent live security or device pass. Stage 6 source/release evidence was checked at branch head c6c5445, following deployed app 31c7fb0 / Worker 2712042b-b613-440d-ada1-e0cda25050d6.

## Evidence and status

| Requirement | Status | Current evidence / remaining work |
|---|---|---|
| Shared headline Progress | Implemented; release verification pending | Debts and Progress call buildActualProgress with original progressStartingBalance, all tracked/archived accounts and retained removed balances. Monthly activity stays separate. Signed increases and zero-baseline unavailable percentages are supported; no baseline dates invented. |
| New debt/archive/correction/removal/scope cases | Automated coverage | Existing plus new unit/API/browser regressions; inclusion scope Cards & other remains distinct from House & car. Filters do not change headline scope. |
| Household name | Implemented; release verification pending | Owner-only server rename scoped to authenticated household; admin/viewer denied. No auth identity changes. |
| Debt-owner/group labels | Implemented; release verification pending | Stable IDs, editable labels/new groups, revision-checked admin/owner saves; viewer writes denied. Legacy backup migration preserves Mama/Papi assignments once. New households start Household; newly added lenders never infer ownership. No login needed for a label. |
| Optional manual/estimated interest | Implemented; release verification pending | Credit cards only, manual default, entered APR/closing day, last-day clamp, actual/365 closing balance estimate and cents rounding. Next close after coveredThrough is first eligible. Legacy Costco APR/history retained; never injected into another card. |
| Interest deduplication and reconciliation | Automated coverage; live two-device check blocked | Monthly deterministic IDs/tombstones and household revisions arbitrate retries. Explicit actual-interest entry replaces unreconciled cycle estimates, reserves unseen cycles and retains replacement links. Lender anchors reconcile estimates. Disable stops catch-up; re-enable defaults past paused cycles. No server scheduler. |
| Manual actual-interest UX | Implemented; limited scope | Edit card → More details → Record actual interest; choose statement closing date. Generic fees are not inferred to be statement interest. Use explicit interest entry or lender balance reconciliation when replacing estimates. |
| Household security enforcement | Implemented + automated, independently live blocked | Server membership, role and origin/session scope checks; isolated synthetic two-household SQL/API tests. Needs two controlled provider-authenticated nonproduction sessions for reads/writes/exports, removed-member denial, invite expiry/revocation, expiry, switching/drafts and actual partner sync. Existing real household checks read-only. |
| Public signup / general household creation | Complete gate | Remain closed; production creation allowlist remains empty. No real invitations/membership mutations for testing. |
| Exports/encrypted backups/local restore | Existing implementation, automated and historical live release evidence | Preserved version-6 compatibility, encrypted release backups and separate local D1 restore. Current release repeats immediate backup and exact-row preservation. |
| Isolated remote D1 restore | Pending actual release-run result | New unbound disposable database SQL-restore rehearsal, exact row/contract/integrity/FK comparisons, cleanup. Permission/cleanup failure leaves gate open. Not a Time Travel rehearsal. |
| Recovery retention and rollback | Partial | Seven-day Actions retention; separate encrypted copy expiry needs owner decision. No automatic financial restore; older group/day-2-only writers unsafe after new fields. See OPERATIONS.md. |
| Deletion request tracking | Complete for receipt/cancellation | Existing durable request references; request received remains distinct from completed. |
| Actual deletion fulfillment | Blocked / partial | Operator procedure prepared in DELETION_FULFILLMENT.md. Needs identity admin access, restricted case register, approved ownership/shared-audit retention and backup expiry, disposable identity/provider/session rehearsal. No completed-deletion claim. |
| Support / privacy / terms / deletion pages | Partial | Working routes and marked drafts describe actual handling. Public support contact, operator/legal identity, markets, retention, response commitments and required review remain owner decisions. External no-login deletion submission not activated. |
| Monitoring | Partial | Fixed-event read/write/export/health/lifecycle/storage/conflict logs and save-failure UI; account alert destination, thresholds/delivery rehearsal, log retention/access and backup operator remain unconfigured. |
| Approved design | Preserved; browser gate pending | Subtle corners, full-screen forms, account access, one Debt +, no refresh or Track loan restoration, snapshots accessible. |
| Payoff planning / sync / recovery / loan compatibility | Existing implementation + regression suite | Retain existing accounting/reconciliation and optional unlinked-loan contracts. Current release full suite required; private success does not finish live/security/mobile gates. |
| Mobile package/native authentication | Deferred to mobile milestone | Architecture and Capacitor extraction recommendation in MOBILE_DEVELOPMENT_PLAN.md. No database move required. |
| Physical devices/accessibility | Deferred, unverified | Android/iPhone keyboard, Back, safe areas, auth/deep links, reconnect, screen readers and large text. Browser viewport checks are not device checks. |
| Stores/developer accounts/signing | Deferred / access dependent | Official current rules rechecked in mobile plan; account type, platform priority, identifiers, signing access, reviewer access and disclosures pending. |
| Subscriptions | Deferred / gated | No billing activation. Decide monetization first; verify full household entitlement/purchase lifecycle before charging. |

## Release results

Pending final candidate validation/publication. Local baseline: live private UI reproduced the mismatched percentages and original Progress/snapshot controls were captured for a read-only comparison. Local lint/typecheck, 307 unit/API tests, local D1 restore and exact Worker dry run passed before final follow-up edits; final CI is authoritative for exact deployed source. Local browser runtime startup was repaired with an optional debugger switch, but Chromium downloads returned invalid archives, so local browser results must not be described as passed. The established CI installs Chromium and must pass full browser validation before publication.

## Remaining decisions/access

Two independent disposable authenticated household sessions and a scoped request runner; Supabase identity administration for deletion; public operator/contact and launch markets; shared-history/backup/provider retention and case register; alert destination/backup incident operator; first mobile platform and Mac/device/signing access; monetization decision. No real household data deletion, invitation or public signup is authorized by the testing plan.

Next mobile milestone: an isolated Capacitor development build proving native authentication, secure sessions and deep links on physical phones, retaining the hosted D1/Worker backend. See MOBILE_DEVELOPMENT_PLAN.md for acceptance criteria.
