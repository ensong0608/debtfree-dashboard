> Current release: the approved Light/Dark redesign was published on October 23, 2026 at app source c2c200fe425737cb616aac3170eefefd677382e9. See the Light/Dark production result at the end of this file for deployment, encrypted backup and data-preservation evidence. Earlier releases below remain historical context.

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

## October 22, 2026 — integrated audit corrections

Prepared from the audited and current production branch head `ef96ea6ee81d477d2b975b4b659d87d19475ebbf`. The owner authorized integrating the finished sections and proceeding with the private production release after the combined checks. Older section checkouts were preserved; their changes were reconciled onto this source rather than replacing the newer Home, credit-card editor or configured Schedule.

The release aligns Schedule extra/method/type settings with Budget and payment suggestions, reserves excluded debts' minimum obligations, deducts linked loan spending once, and captures only the current month's commitment for later historical display. Forecast changes do not post payments. Net balance movement, historical snapshot scope, forecast scope/status/actions, account and transaction draft exits, recurring due-day wording, Schedule touch/text sizing, household-calendar defaults and actionable conflict/oversize messages are integrated. Deletion capture/cancellation uses durable owned references and guarded retry handling; no deletion fulfillment is activated.

Local validation: 60 focused calculation/calendar/lifecycle/recovery checks passed across the affected areas, plus 21 focused synthetic browser cases across phone and desktop, including 320/360/390/430px Schedule checks. These totals combine passing targeted runs; only failed or affected cases were rerun. Obsolete source-string assertions for the pre-redesign Home/navigation were removed while their model checks and the current behavioral browser coverage were retained. Changed-file ESLint, TypeScript and diff checks passed. Local browser verification mounted the production dashboard component in an isolated Vite/device-storage harness after the Worker development server failed its readiness timeout; it does not establish authenticated backend or native-device acceptance. The production workflow must additionally pass its real Worker browser checks, exact bundle dry run, resource identity, encrypted recovery, stored-row preservation and sign-in/API checks before release is reported successful.

No schema migration, production financial import/reset, native authentication implementation, new backend resource, public registration, policy commitment or destructive deletion operation is included. F02/F04 public-launch decisions and fulfillment remain blocked as documented in DELETION_FULFILLMENT.md and MONITORING_RESPONSE.md. Native/PWA/Capacitor work remains planning only. Physical-device keyboard/safe-area/Back behavior and independent authenticated partner/tenant/session acceptance remain outside this private correction.

### October 23 production result

- Deployed application source: `d3434a68be7c8da57f27cc0ad43c48dc3fb9b97b` on `codex/production-release-20261015`; source tree `29737143d32afe89cf86cae0d9a95d7ac8499589`. [Release run 39912620285](https://github.com/ensong0608/debtfree-dashboard/actions/runs/39912620285), job `120278848550`, succeeded. Worker version `c434d16c-3ab5-4dcc-978c-195cd8afa550` was published at 06:39:44 UTC to https://debtfree-dashboard.ensong0608.workers.dev/ . Documentation-only follow-ups do not change this application source.
- All 12 focused phone debt-experience checks passed against the real local Worker server in CI. Resource identity, exact Worker build/dry run, encrypted recovery preparation/upload, publication, stored-row preservation and production Google login/protected API checks passed. The full suite and disposable remote D1 restore rehearsal were intentionally not run.
- The immediate production SQL export restored privately in in-memory SQLite and passed integrity, foreign keys, stored contracts and original Progress snapshot checks. Encrypted-only recovery artifact `12483546420` is retained in the release run for seven days. Its private key remains separate; this session did not download/decrypt the artifact or perform a remote restore.
- At 06:39:44 UTC the post-deployment check confirmed every stored household, membership, financial-state, invitation and request column exactly matched the immediate pre-release backup. The schema was unchanged, and no remote migration, financial import/reset, test payment or automatic data restore occurred.
- Initial candidate `0e52a8b63a4043c0aebaa428847186f6869b67b2` stopped before production preflight/deployment in [run 39912125296](https://github.com/ensong0608/debtfree-dashboard/actions/runs/39912125296): the newly added recurring-date helper became part of the exact Due day label. The correction gives both account editors an explicit accessible field name and associates the helper as its description. The affected phone case, changed-file lint and TypeScript checks passed locally before the successful release run.

Production publication and its bounded data-preservation/auth checks are complete. Authenticated household UI, independent tenant/partner/session acceptance and physical devices were not exercised in this release; the outstanding public-launch and native/deletion decisions above remain open. The existing encrypted recovery and compatible-forward-fix/rollback requirements still apply.


## October 23, 2026 — Light/Dark release preparation (NOT PUBLISHED)

Status: completed redesign located and release candidate prepared. Publication is not authorized. Dependency findings below require a disposition before an unqualified readiness recommendation. No commit, staging, push, PR, merge, workflow dispatch, deployment, remote migration, backup export or production financial write was performed during preparation.

### Exact source and continuity

- Checkout: `/workspace/scratch/00524890527f/debtfree-dashboard`.
- Active branch: `local/semantic-themes-section1-20261023`.
- HEAD and remotely verified production branch head: `4286827771925422ea71a125ee286467981b0abc`. GitHub branch resolution was checked during preparation; recheck only that it has not advanced before an approved publication.
- Current documented deployed app: `d3434a68be7c8da57f27cc0ad43c48dc3fb9b97b`; Worker version `c434d16c-3ab5-4dcc-978c-195cd8afa550`; successful release run `39912620285`. HEAD's changes after that app commit are documentation only; app/worker/schema/package content matches the deployed source. A new live Cloudflare deployment lookup was not performed in preparation; the publication workflow must confirm the actual resources and current deployment before publishing.
- All accumulated uncommitted implementation and prior integrated audit fixes remain in the original checkout. It was not reset, switched to an old branch, replaced with a clone, or reconstructed from earlier sections.
- Existing Section 9 evidence: `docs/design/2026-10-23/DESIGN_HANDOFF.md`, Section 9 integration review. Before the release fixes below, all 237 app/test files matched the Section 9 verification copy byte-for-byte. Its focused checks are reused for unchanged code. Temporary process/runtime files were unavailable after the continuation; the affected checks used a new isolated local source copy, without changing the original runtime/dependency/configuration files.
- App/test candidate digest (SHA-256 over the sorted path/hash mapping): `7f3fb868e36b2a83438cfa9d746c25cf30507888026b9a3f164c7e825926cd9d`.
- Resume files, ignored and never staged: `outputs/release-preparation-20261023/release-manifest.json` (per-file source/build hashes) and `release-paths.txt` (explicit staging allowlist). Do not rerun unchanged passing checks after approval. Recheck hashes/remote head; changed source invalidates only affected evidence.

### Section readiness and user-visible behavior

| Sections | Verified state |
| --- | --- |
| 0–3 | Audited production baseline retained; semantic Light/Dark on desktop, phone and body portals; Light default; immediate device-local selection/reload/cross-tab behavior; typography and denied-storage handling; Account return; explicit optional institution metadata and generic fallbacks. |
| 4–5 | Reference-derived Home/Debt, five destinations Home / Debt / Progress / Budget / Settings, Account and Settings tools, all debt types, groups/reordering and existing account/payment/loan editing. Release preparation additionally repairs focus after moving an edited debt into a different household group. |
| 6A–6B | Active `buildActualProgress` authority, Overview / Trends / Milestones, signed increases, missing-history gaps, evidence-based dates, explicit scopes, original baseline and directly visible saved snapshots/revisions retained. Unchanged selector results reused. |
| 7A–7B | Overview / Transactions / Schedule, independent reporting month, truthful Planned/optional recorded labels, ledger corrections/deletion/restoration, all three add actions, deduplication/overlap rules and historical commitments retained. Unchanged adapters/results reused. |
| 8–9 | One canonical full Payoff Schedule shared by Home and Budget, four-column phone forecast, scope/origin/controls/Back retained. Section 9 responsive/theme/viewer/edit/discard/payload evidence remains applicable, except affected debt focus/legacy assertions were rechecked below. |

Known visible limits are unchanged: Debt cards are taller than the reference; larger-text screens are less dense; Light overviews are derived because no Light overview sheet exists; bank logos use generic type icons; notification delivery remains unavailable; a saved Dark device can briefly show the Light server frame before hydration. Physical Android keyboard/Back/safe-area/installed-PWA/sync acceptance remains unverified. Synthetic responsive desktop Chromium is not physical-device verification. This is not exact screenshot-fidelity, public-launch or full accessibility/security signoff.

### Scoped release fixes

- `app/debt-experience.tsx`: give list buttons a stable record identity for focus restoration.
- `app/use-dialog-focus.ts`: if a household-group edit remounts the originating list button, find its replacement by that stable identity when the final dialog closes. Existing connected-trigger and topmost-dialog behavior is retained.
- `tests/browser/debt-experience.spec.ts`: update obsolete Home region/class, Progress region and built-in palette assertions to the approved implementation. The existing group-edit/back focus assertion now passes without removing its behavioral requirement.

### Checks actually performed during release preparation

| Check | Result and limits |
| --- | --- |
| Repository / provenance / exclusions | Branch, HEAD, dirty state, AGENTS, handoff/checkpoints, current release/operations instructions, all workflow triggers and recovery scripts inspected. GitHub resolves production branch to HEAD; prior release job succeeded and encrypted artifact is unexpired. App baseline comparison confirms prior audit work is included. |
| Mandatory release phone file | `tests/browser/debt-experience.spec.ts --project=phone`: initial 13 cases produced nine passes and four failures. Three failures were obsolete visual/region assertions; one was the remounted group-button focus bug. Only `five tabs`, `debt Overview`, `summary swipe` and `schedule choices` were rerun after fixes: four passed. Final aggregate: all 13 named phone cases covered. Uses synthetic device-storage fixtures on the local Vinext/Worker development server, not production records or authenticated tenant acceptance. |
| Affected desktop checks | `debt-experience.spec.ts --project=desktop --grep 'debt Overview|account drafts|Home preview'`: three passed, including replacement-trigger return, nested draft dialogs and Schedule return. An initial server-start attempt stopped on a stale development lock before tests; an environment-only `VINEXT_NO_DEV_LOCK=1` retry passed. |
| TypeScript | `npm run typecheck`: passed on the final app changes. |
| Scoped lint | `npx eslint app/debt-experience.tsx app/use-dialog-focus.ts tests/browser/debt-experience.spec.ts`: passed. Earlier Section 9 lint results reused for unchanged files. |
| Exact Worker build/dry run | `npm run deploy:check`: passed, repeated once because the focus fix changed application code after the first pass. The final build produced 117 modules, 50 client asset files, upload 1737.22 KiB / gzip 462.46 KiB. `--dry-run: exiting now` confirmed no publication. Final generated files are hashed in the ignored manifest. Build emitted proxy/route-classification/telemetry notices, not errors. |
| Data / authentication / infrastructure scope | No changed Worker, auth/API, DB/schema/migration, scripts, native code, package/lockfile, Wrangler, proxy or workflow file. No SQL migration exists in the candidate, so no migration is proposed. Original financial engines, history/reconciliation/snapshot logic and server permissions are unchanged; Section 9 synthetic preservation evidence and unchanged focused selector checks reused. |
| Credential / private-data review | Intended paths reviewed; no private-key, provider-secret/token-assignment or personal-email patterns found. Application/reference financial examples remain synthetic fixtures. PNGs, attachments, generated dist/outputs, credentials, private financial exports and unrelated files excluded. A pattern scan supplements the file review; it is not a full secret-history audit. |
| Recovery availability | Existing public encryption key parses as RSA 3072. GitHub confirms encrypted artifact `12483546420` from run `39912620285` exists and is unexpired, expiring October 29, 2026 at 11:39 p.m. Pacific (October 30 06:39 UTC). Fresh immediate backup is still required during publication. No private key was retrieved or current decryption attempted; separate custody is documented in earlier recovery evidence. |
| Dependency review required by existing operations instructions | `npm audit --json` completed: 16 affected package entries, two critical, nine high, five moderate. No lockfile/dependency change was made. See unresolved issue below. |
| Diff hygiene | `git diff --check`: passed. No staged changes. |

Not run: `npm test`, `npm run validate`, blanket unit/browser/sync suites, native builds, recovery drills, remote migrations or production probes. Historical results are identified as reused, not newly executed. Raw preparation logs remain under `/workspace/scratch/6f1ee4ee2bb8/`; no private production payloads were acquired.

### Unresolved dependency issue (separate from styling)

The existing lockfile includes `next@16.3.5` and transitive `dompurify@3.4.15`, each reported critical by npm. High findings include the Cloudflare/Vite/Wrangler/Miniflare toolchain and other transitive packages. The September operations note claiming only four moderate development findings is stale; it is not current security clearance.

Primary advisories checked include [Next ImageResponse GHSA-vcvr-r3jv-pc5j](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j) and [DOMPurify template/shadow-root GHSA-cg2g-xh64-v4q7](https://github.com/advisories/GHSA-cg2g-xh64-v4q7). Additional Next findings in the audit include image optimization and typed-array cache remote-code-execution reports. Narrow source inspection found no explicit `next/og`, `next/image`, `use cache`, `use server`, DOMPurify template/DOM-return options, or jsPDF `.html()` calls in app source. The existing Worker image endpoint delegates to Vinext/Cloudflare Images; PDF export uses jsPDF tables. This does NOT establish that every vulnerable dependency path is unreachable. There is no evidence this redesign introduced the advisories, and its dependencies match production, but package/runtime reachability and compatible patched versions need a focused separate review before recommending publication without caveats. Do not run a forced audit fix or silently expand this candidate into dependency/infrastructure upgrades.

### Exact proposed publication actions — only after separate approval

1. Recheck the candidate digest/allowlist, a clean staging area and the remote production head. If only documentation has changed, preserve application hashes and do not repeat passing checks. If the remote app or candidate changed, identify that change before proceeding; never force-push or overwrite a newer release.
2. On the preserved local implementation branch, stage only the 69 allowlisted paths using `git add --pathspec-from-file=outputs/release-preparation-20261023/release-paths.txt`; inspect the staged diff. Commit once with title `Add device-local Light and Dark redesign`.
3. Push that exact commit once to `HEAD:refs/heads/codex/light-dark-release-20261023`. The inspected workflows do not match that branch for production, preview, full validation or redesign review, so this source push does not itself deploy. Open one PR with base `codex/production-release-20261015` and this release head; no main promotion is involved.
4. Merge that reviewed PR once after explicit authorization covering commit/push/merge/automatic deployment. App/test changes reaching `codex/production-release-20261015` automatically trigger `Deploy Cloudflare dashboard`. No manual workflow dispatch, extra trigger commit, preview push or direct `npm run deploy` accompanies it. If run registration is delayed, inspect/wait for the same commit instead of creating another deployment trigger.
5. The existing workflow runs only its focused phone debt file unless full validation is explicitly opted in. Leave `full_suite` false. It confirms account `005a72abf0c701cfc067867e4f3ba034`, Worker `debtfree-dashboard`, D1 `debtfree-dashboard-prod` / `3f2dd9d5-77de-4945-8e13-f6c1af454de1`, and actual existing deployment IDs. It exports production read-only, restores privately in SQLite, checks integrity/FKs/candidate contracts/original baseline/snapshots, encrypts with RSA-OAEP-SHA256 + AES-256-GCM, and uploads encrypted-only recovery for seven days. Failure before publication stops the workflow.
6. No committed migration changed; the existing conditional migration step must report unchanged and skip remote application. The existing authentication-configuration step retains Google/Supabase, lifecycle enabled, empty household creation allowlist and the current production origin; it is not authorization for new auth/public-registration work.
7. CI builds once via `npm run deploy:check`, then publishes those exact `dist/server/wrangler.json` artifacts with `npx wrangler deploy --config dist/server/wrangler.json --keep-vars`. CI does not have an input for the local generated bundle; its own production-configured dry-run bundle is the one it publishes without rebuilding. This is the approved automatic path; do not also run `npm run deploy`, which would rebuild and publish a second time.
8. Verify successful deployment, URL/version, every stored household/member/state/invitation/request column against the immediate pre-release fingerprints, anonymous root redirect to login, Google login content, correct account chooser/PKCE/callback, and 401/403 for anonymous household/export/lifecycle API requests. Reuse the established workflow checks. No test financial records. Signed-in UI can be checked only through an existing authorized session without saving synthetic changes; otherwise report that limit.
9. Report completion only after publication and required preservation/auth checks pass. If a post-publication check fails, state whether the Worker changed and exactly which verification failed; never call a partial run successful.

### Recovery and rollback

Capture the actual currently deployed version in preflight; the documented fallback is `c434d16c-3ab5-4dcc-978c-195cd8afa550`. Prefer a compatible forward fix after new writes. The current deployed version supports the existing reconciliation anchors and optional loan validators; much older branches are unsuitable rollback targets. Optional institution metadata is additive, but old clients do not offer it and have not been certified as writers after new selections, so do not assume all older client edits preserve it.

If an approved application rollback is needed, review write/metadata compatibility and use the recorded previous Worker version (`wrangler rollback <previous-version-id> --name debtfree-dashboard --config wrangler.jsonc`) once, with current resource and auth/preservation checks. Do not automatically restore/import a financial backup. A fingerprint mismatch can be concurrent user activity; inspect privately first. Any actual data recovery requires stopping writes, a fresh private current export, explicit owner recovery-point approval, isolated restoration validation and reconciliation of newer activity. Never reset/recreate D1 or strip history/offsets/snapshots to fit an older application.

### Intended release files (69)

Only the following paths enter the proposed commit. The three original reference PNGs remain local and are excluded from publication; generated bundles/manifests/logs and temporary runtime fixes are excluded. Existing remote references are not reuploaded.

```text
app/action-confirmation.module.css
app/actual-progress-page.module.css
app/actual-progress-page.tsx
app/appearance-provider.tsx
app/appearance-settings.module.css
app/appearance-settings.tsx
app/appearance.ts
app/budget-schedule-entry.tsx
app/budget-view.ts
app/card-progress-chart.tsx
app/credit-card-editor.ts
app/credit-card-info.tsx
app/dashboard-client.tsx
app/dashboard-data.ts
app/debt-experience.module.css
app/debt-experience.tsx
app/debt-presentation.ts
app/debt-progress-ring.tsx
app/design-system.css
app/globals.css
app/home-dashboard-page.tsx
app/home-dashboard.module.css
app/household-currency-settings.module.css
app/info-tooltip.module.css
app/institution-icon.module.css
app/institution-icon.tsx
app/institution-picker.tsx
app/institutions.ts
app/layout.tsx
app/loan-details-fields.tsx
app/loan-entry.ts
app/loan-progress-panel.tsx
app/loan-progress.ts
app/mobile-layout.module.css
app/monthly-plan-page.tsx
app/outline-icon.tsx
app/payments-mobile.module.css
app/payments-page.tsx
app/payoff-home.module.css
app/payoff-landscape.tsx
app/progress-view.ts
app/quick-payoff-calculator.module.css
app/reference-layout.css
app/theme.css
app/use-dialog-focus.ts
docs/PRIVATE_PRODUCTION_RELEASE_20261015.md
docs/design/2026-10-23/DESIGN_HANDOFF.md
tests/appearance.test.mjs
tests/browser/actual-progress.spec.ts
tests/browser/audit-integration.spec.ts
tests/browser/debt-experience.spec.ts
tests/browser/f10-mobile-layout.spec.ts
tests/browser/mobile-ui-refinements.spec.ts
tests/browser/payoff-budget.spec.ts
tests/browser/section2-settings.spec.ts
tests/browser/section3-institutions.spec.ts
tests/browser/section4-home.spec.ts
tests/browser/section6b-progress.spec.ts
tests/browser/section7a-budget.spec.ts
tests/browser/section7b-budget.spec.ts
tests/browser/section8-schedule.spec.ts
tests/browser/section9-integration.spec.ts
tests/browser/section9-viewer.spec.ts
tests/browser/separate-payoff-progress.spec.ts
tests/browser/theme-foundation.spec.ts
tests/budget-view.test.mjs
tests/credit-card-editor.test.mjs
tests/institutions.test.mjs
tests/progress-view.test.mjs
```

Approval checkpoint: publication has not been approved. The exact candidate and workflow are reviewable. Resolve or explicitly disposition the dependency findings before deciding whether to authorize commit/push/merge and its automatic production deployment. The original checkout and manifest are the continuation point if usage ends.


### Publication authorization — October 23, 2026 (Pacific)

The owner explicitly requested deploying the prepared redesign first and deciding on dependency remediation later. This authorizes this candidate's commit, release branch/PR, merge and the existing automatic production workflow. Dependency findings are knowingly deferred; no dependency upgrade is included. Reuse unchanged passing checks and preserve the existing encrypted backup, data, resource and authentication gates.


### Light/Dark production result — October 23, 2026 (Pacific)

The owner approved deploying the prepared redesign first and deferring dependency work. [PR #11](https://github.com/ensong0608/debtfree-dashboard/pull/11) merged into `codex/production-release-20261015` as app source `c2c200fe425737cb616aac3170eefefd677382e9`. Its tree `971810d5e3961b4b5bbc852bcea57b5b943619f1` exactly matches the validated local candidate. Local checkpoint commit is `d61beb97e4fdb64f19c6a9b6ec612d66944ab3ab`; Git transport was unavailable, so the connected GitHub API created remote source commit `47f9f258dd27a7a495fe781c575d8027bae61ea1` with the identical source tree. The original local branch remains preserved. No reference PNG, generated bundle, credential or private financial payload was committed.

[Production run 40037264277](https://github.com/ensong0608/debtfree-dashboard/actions/runs/40037264277), job `120699696273`, succeeded. All 13 focused phone debt-experience cases passed in CI against the local Worker server. Resource identity, current deployment metadata, existing production DB binding and preview isolation were verified. The fresh read-only full SQL export restored privately in SQLite and passed integrity, foreign keys, candidate stored-contract compatibility, original Progress baseline and snapshots before encryption. Encrypted-only recovery artifact `12538285253` has seven-day retention, expiring October 30 at 4:03 p.m. Pacific (23:03 UTC); its digest is `sha256:6942d898c0f147afef2847140552df5b63ada40c673689e84a8cd3ca4423a858`. The private recovery key remains separate. This session did not download/decrypt the backup or perform a remote restore.

Committed schema was unchanged; CI explicitly reported no remote migration applied. CI's exact Worker build/dry run passed, then its same generated bundle was published once without rebuilding. Wrangler reported https://debtfree-dashboard.ensong0608.workers.dev/ and Worker version `c5b205d5-cd06-40ee-b164-393680dfedaa` at 4:04:06 p.m. Pacific (23:04:06 UTC). No manual dispatch or direct duplicate deployment was performed.

At 4:04:07 p.m. Pacific the post-publication fingerprint check confirmed every stored household, membership, financial-state, invitation and request column exactly matched the immediate pre-release backup. Google login/root redirect, account chooser/PKCE/callback and unauthenticated household/export/lifecycle API denial passed. No production test record, payment, balance edit, import, reset, financial-data restore or new infrastructure operation occurred. The production account, Worker and D1 remain the existing ones. Recovery metadata records the previous deployment/version set inside the encrypted backup; the documented earlier app fallback remains `c434d16c-3ab5-4dcc-978c-195cd8afa550`, subject to the compatibility/forward-fix requirements above.

Publication and its required bounded checks are complete. Full validation and the disposable remote recovery drill were intentionally skipped. No independent signed-in production UI, cross-household/session/IAM, physical Android or installed-PWA check is claimed. Section 9 visual deviations and brief initial Light frame remain. The existing dependency advisories (two critical, nine high, five moderate package entries) are unchanged and explicitly deferred by the owner; this publication is not a dependency-security clearance or public-launch approval.

This final follow-up changes release documentation/AGENTS/handoff only. It does not change the deployed application or trigger another deployment. Resume from the preserved local checkout and use the deployed app source above, not main or older historical releases.
