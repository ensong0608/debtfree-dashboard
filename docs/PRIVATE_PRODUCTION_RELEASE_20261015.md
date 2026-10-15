# Private production release candidate — October 15, 2026

The user requested that the tested improvements reach the real app now, with development/release separation established for the later public launch. This changes the prior preview-only delivery direction. It does not open public signup or authorize Stage 6 activation.

## Exact candidate and destination

- Application source: 201a1522e30057a5ee2e75ad55f7f78a7bfac3f3; documentation head 73a6398bca6ca260455319cd0a16d5e38193ca1b has identical app source.
- Prepared release branch: codex/production-release-20261015. Existing foundations review: PR #4.
- Destination: existing Cloudflare Worker debtfree-dashboard at https://debtfree-dashboard.ensong0608.workers.dev/ with its existing DB binding. Never import preview data or replace this database.
- Last repository production deployment found: workflow 38069700853, source 35917dc4209c8dfec1f82683f43c7417d9092e01. Reconfirm live deployment/bindings immediately before publishing; repository history is not live deployment proof.

## Changes reaching the real app

Unified Debt + house/car entry; removal of + Track loan; optional Budget linking with specific missing-field validation; preserved editing/payment/activity; Google account chooser; keyboard/focus/large-text/fullscreen form fixes; preserved starting Progress balance/date; Pacific recurring dates and corrected accessible payoff schedules; cents/reconciliation anchors, revision/retry and household-session safeguards; scoped draft/reconnect recovery and protected export.

Calculator continues to use the entered scenario total. Plan reserves minimums within its entered total. Public signup remains closed. Billing, app-store packaging, bank integrations and Stage 6 lifecycle activation are excluded.

## Validation evidence

Preview run 38754352950, job 116488702461 passed lint/typecheck, 289 Node tests, SQL restore drill, 112 browser checks (2 existing skips), build/exact Worker dry-run, read-only production/preview binding inspection, isolated deployment and login/anonymous data-denial checks. Independent validate runs 38754358687 and 38754352927 passed. Preview source Worker version: 19a29905-6588-4deb-bd14-ffcddfc5aa52.

The release preparation script additionally passes syntax, lint and typecheck. It has not exported production or run against remote production. One approved identity’s preview UI login/logout passed. Independent direct-API two-household isolation, controlled expiration/revocation, all account-switch/draft boundaries, live partner sync, full IAM and physical accessibility remain unverified. These must not be described as passed or as public-launch readiness.

## Data and rollback plan

No SQL migration or bulk financial conversion is required. Do not modify existing balances, transactions, APRs, minimums, dates, Budget, loan history or original starting Progress amount/date during deployment.

Before publishing, produce a recoverable private full database backup and verify that the stored contracts/snapshots are accepted by the candidate. Proposed implementation: a read-only export in an ephemeral CI directory, a private in-memory SQLite restoration/integrity/FK/contract check, and RSA-OAEP/AES-GCM encryption before storing any recovery artifact. Only the public encryption key may enter the repository; the private key is retained privately outside the repository. Financial values must never enter source, logs or UI verification artifacts.

Resolved approval dependency: automatic approval review initially rejected adding the proposed backup workflow because the user has not explicitly authorized sending the encrypted production financial backup to a GitHub Actions artifact in this public repository. No backup workflow/script/public key was uploaded or run; no production database was exported, migrated or changed. The user explicitly approved that encrypted artifact destination (7-day retention, private key kept separately) on October 15, 2026 at 09:47 Pacific. Proceed with this approved mechanism; never upload plaintext financial backups or the private encryption key to GitHub.

After backup and compatibility checks pass, inspect exact production identity/settings, publish the validated candidate to the existing Worker, and verify Google login plus anonymous household/export denial. Check authenticated saved data where available without creating payments or test balances. Record source SHA and Worker version.

A code rollback is straightforward before new financial writes. After reconciliation-anchor writes or unlinked loans, use a compatible validator/forward fix; an older release can reject unlinked loans and mishandle history containing anchors. Never delete loans or invent Budget entries for rollback. Never restore a stale backup over later activity without explicit reconciliation. Retain the existing production version before deployment; prefer stopping writes and preserving current state if correctness is in doubt.

## Current state and next action

Production has not changed. The candidate is prepared and the recovery mechanism is reviewable locally. Backup destination approval has been received. Next: run the approved backup/compatibility validation and verify decryption privately before production publishing. After release, keep a fixed production revision and publish finished changes deliberately; development edits must not overwrite the running Worker automatically.

## Approved recovery evidence before deployment

User explicitly approved the encrypted GitHub Actions backup destination on October 15 at 09:47 Pacific. Backup workflow 38772100259/job 116550279543 succeeded for df95f4a95b9ce19aba78a2f68cac88995295722b. Artifact 11991697583 contains encrypted bytes only with seven-day retention; the separate private key never entered GitHub. The encrypted artifact was downloaded, its archive digest verified, decrypted privately, and SQL checksum, candidate parsing, exact saved account balances and original Progress snapshot/starting amount checked successfully. An encrypted durable private copy and the separate key are retained outside the repository. Actual production SQL restored in private in-memory SQLite passed integrity and foreign-key checks; this is not a remote D1 Time Travel restore. No production financial write or migration occurred.

The publication workflow repeats the read-only encrypted backup immediately before deployment and compares every stored household/member/state column after deployment using canonical cryptographic fingerprints. A mismatch can reflect concurrent user activity; never restore/rollback financial data automatically. The final app source is unchanged from the fully tested foundations candidate; release-only scripts/workflow/tests are additive. Public-launch security/device gates remain open and must not be called passed because this private-use release is authorized.
