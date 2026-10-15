# Private production release — completed October 15, 2026

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

Production is deployed and verified at source 42172ca746f17a854ab064740c1ab90f60ec437d, Worker version 24f06427-0cbe-49b6-b5c8-b52d37eb2c59. Continue private-app fixes from codex/production-release-20261015. No release job is left pending. Remaining public-launch checks are listed below and in PUBLIC_APP_FOUNDATIONS.md; Stage 6/public signup remain gated. After release, keep a fixed production revision and publish finished changes deliberately; development edits must not overwrite the running Worker automatically.

## Approved recovery evidence before deployment

User explicitly approved the encrypted GitHub Actions backup destination on October 15 at 09:47 Pacific. Backup workflow 38772100259/job 116550279543 succeeded for df95f4a95b9ce19aba78a2f68cac88995295722b. Artifact 11991697583 contains encrypted bytes only with seven-day retention; the separate private key never entered GitHub. The encrypted artifact was downloaded, its archive digest verified, decrypted privately, and SQL checksum, candidate parsing, exact saved account balances and original Progress snapshot/starting amount checked successfully. An encrypted durable private copy and the separate key are retained outside the repository. Actual production SQL restored in private in-memory SQLite passed integrity and foreign-key checks; this is not a remote D1 Time Travel restore. No production financial write or migration occurred.

The publication workflow repeats the read-only encrypted backup immediately before deployment and compares every stored household/member/state column after deployment using canonical cryptographic fingerprints. A mismatch can reflect concurrent user activity; never restore/rollback financial data automatically. The final app source is unchanged from the fully tested foundations candidate; release-only scripts/workflow/tests are additive. Public-launch security/device gates remain open and must not be called passed because this private-use release is authorized.

## First production publication and live verification

Source b96038d7dd75dba02ab66caf675fd9717df8fe44 deployed successfully in run 38773014428/job 116553435202 on October 15, 2026 at 17:03 UTC. Worker version ceb60060-a0aa-4e6f-8777-e2cec44592e2. Lint/typecheck, 291 Node tests, actual local D1 recovery, 112 browser checks (2 existing skips), exact Worker dry-run, live resource identity checks, immediate encrypted production backup (artifact 11991644771), publication, production Google chooser/PKCE/callback and anonymous household/export denial passed. The post-deploy fingerprint check proved every stored household/member/financial-state column exactly matched the immediate pre-release backup. No migration, data conversion or automatic database restore ran.

A private read-only compatibility review additionally compared candidate displayed balances against the actual existing offset/history calculation; they matched exactly. Existing account balances, original starting Progress amount, snapshot dates and snapshot contents were preserved by candidate parsing. No historical anchors were inferred and no transactions were reclassified.

The production browser reused an existing authenticated session and loaded the real saved household with Saved status. Debt + visibly offered House loan and Car loan. Opening House loan showed an enabled Save loan control; submitting the empty form displayed the validation alert and the form was cancelled. No new loan, payment, test balance, member change, import or reset was saved. This is live UI verification of the authenticated household and loan-validation path, not proof of all multi-household/session/IAM/public-launch gates.

GitHub initially showed no runs/check suites for the first release push. A workflow-comment-only follow-up was committed through the contents API; both delayed first-push runs and the follow-up then appeared. The additional release run 38773041808 uses source 42172ca746f17a854ab064740c1ab90f60ec437d with identical app source. Production concurrency serialized them; both use immediate recovery/preservation guards. Record the final result/version below before claiming the release workflow is fully closed.

## Final production result and handoff

- Final deployed source: 42172ca746f17a854ab064740c1ab90f60ec437d. Final release run 38773041808/job 116557256609: SUCCESS at October 15, 2026 17:11 UTC. Worker version 24f06427-0cbe-49b6-b5c8-b52d37eb2c59, URL https://debtfree-dashboard.ensong0608.workers.dev/ . This source differs from the first successful production source only by a workflow comment; app/worker/schema/package contents match the validated foundations candidate exactly. Later handoff commits change documentation only.
- Final lint/typecheck, 291 Node tests, local D1 recovery, 112 browser checks (2 existing skips), exact Worker dry-run, account/resource inspection, immediate encrypted backup, direct Cloudflare publication, exact stored-row preservation and Google login/chooser/PKCE/production-callback/anonymous household-export denial passed. The final stored-row fingerprint check passed at 17:11:27 UTC. All household/member/financial columns matched the immediate pre-release backup. No SQL migration, financial conversion, production import/reset or automatic rollback occurred.
- Final encrypted recovery artifact: 11993132249 in run 38773041808, expires October 22 at 17:11 UTC. Downloaded archive digest bd4ea15ae94f38d426f23e40394bb7d156833a0995a331ce3ff7df8fe30726e1 was checked, authenticated decryption succeeded with the separate private key, and SQL checksum/contracts/saved balances/starting Progress/snapshots were revalidated privately. An updated encrypted private copy and the separately retained key survive outside GitHub. Do not commit either financial plaintext or the private key. The original private backup version remains available in private file history.
- Live authenticated production UI loaded the saved household, showed Saved status, and exposed the unified house/car Debt + choices. Empty house-loan validation was exercised without entering test amounts; Save was enabled, validation appeared, and Cancel closed the form. No record or financial action was saved. The production and preview databases remain separate. Physical device/screen-reader verification and independent direct-request multi-household/session/IAM checks remain unverified.
- Last completed milestone: approved private production promotion with recoverable encrypted backup and verified data preservation. User direction is now to deliver requested private-app fixes to the real app after validation; development alone must not silently replace the deployed revision. Use the current production release branch as the base, not main or older PR branches. The original foundations preview remains available for explicitly isolated public-launch work. Existing PR #4/older stack are not evidence that main is the deployed source; do not merge/publish an older head over this release.
- Next independent public-foundations step: obtain two controlled real sessions and an authorized direct-request runner, verify actual scoped GET/PUT/export denial plus controlled expiry/revocation/account-switch draft boundaries, then remaining partner/IAM/device checks before Stage 6. A remote D1/Time Travel restore is still separate from the private SQLite restoration performed for this release. No already-confirmed user usability check needs repeating.
