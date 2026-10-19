# Mobile implementation queue

Manager queue, October 17, 2026 (America/Los_Angeles). All three visible discovery workers have completed and their status/reports were independently collected. First implementation direction is a standalone synthetic bundle; connected-auth design and exact implementation ownership require the corresponding slice review. No implementation or native/device pass is implied.

## Delivery checkpoints

Current dispatch: owner approved Compact plus latest Transactions corrections and requested implementation/delegation. Prompts13–15 sent to existing GPT-6.1 Sol Low workers, reports19–21 assigned. UI/currency implementation and concrete local native-auth/API proof can proceed in disjoint files. Manager waits for owner's completion heads-up, then reviews/tests/integrates. No claim new APK, configured provider, cloud resources or two-phone sync from dispatch. See README current-round table.

Appearance request: owner approved round2 on October17, with Settings gear opening Settings directly and a separate Settings section in the hamburger menu. Approved mobile implementation is assigned in prompts10–12; manager review remains pending until the owner's heads-up. Account and Settings are separate. Themes/fonts/colors are device-local preferences for this slice. No permanent transaction purge is authorized; seven-day behavior is a visible Recently deleted filter only. Preserve existing installed APK/data until reviewed integration and update.

Latest result: owner supplied the heads-up; reports14–16 and source reviewed. UI integration and new APK accepted locally; see reports/17-manager-approved-ui-apk.md for actual verification and artifact fingerprint. Not installed on either phone in this round. Existing installed app/imported data remains intact; connected sync/D3 is still planned separately.

| Checkpoint | Result required | Dependency | Status |
|---|---|---|---|
| D0 — Discovery handoffs | Three source-grounded reports received and independently checked, original-requirements gap recorded | Current discovery round | Complete; implementation-specific design review remains |
| D1 — Bundled synthetic demo | Standalone bundled React client preserving existing theme/logic, synthetic data only, no production/API dependency | D0 | Accepted; browser build/tests and web integration passed |
| D2 — First Android APK | Reproducible debug APK, installed/tested on at least one owner's Samsung phone | D1, Android SDK/tools, device interaction | APK built/inspected and installed/cold-launched on S20+; functional/device acceptance still pending |
| D3 — Connected development app | Separate development backend/auth, native secure sessions, two synthetic identities/households, revision-safe saving and live household updates | Reviewed auth contract and isolated environment | In progress: separate test Supabase created; backend/native implementation expanded; account/provider interactions and full acceptance pending. See CONNECTED_DELIVERY_STATUS.md |
| D4 — Android beta readiness | Both phones exercise sign-in/out, edits/payments/categories/loans/Progress, restart/Back/network interruption, export and accessibility | D2 + D3 | Queued |
| D5 — iOS prototype | macOS build/signing access and reliable physical iPhone tests; platform-specific auth/navigation validated | Shared foundation + external access | Deferred; access unavailable |
| D6 — Store release | Public-app gaps, policies/deletion/operations, account/signing, beta/store review and launch decisions fulfilled | Separate release milestone | Deferred |

D1/D2 establish packaging and device usability, not provider authentication or shared-household synchronization. D3/D4 establish the connected Android milestone. iOS readiness cannot be inferred from Android success.

## Work assignment rules

- Manager assigns one owner for shared package/config files and one for backend/auth files; implementation agents must not edit overlapping ownership areas simultaneously.
- First implementation round should divide client foundation, isolated auth/transport contract, and Windows/device tooling documentation. Parallel work proceeds only when interfaces and file ownership are explicit.
- Code changes stay local and reviewable. Keep full web regressions for integration gates; use targeted checks per slice instead of launching competing full suites.
- Manager checks the work, records evidence, resolves disagreements and assigns follow-up fixes. Agent reports must include exact files, verification, limitations and next task.
- Real imported local records and source export are never test fixtures. Any mobile development backend gets separate synthetic storage and excludes the production-copy identity.

## External inputs

The owner has Samsung S20+ and Samsung S21+ 5G phones. Before D2 record Android/One UI/WebView versions, and arrange connection/install interaction. A phone serial number is not needed in the shared report. Tool installation/build permissions and any actual OS prompts will be handled when the exact setup is known; discovery installs nothing.

Before D3, establish separate development provider/account configuration through interactive secure setup. Keep secret values out of chat, source and reports. Whether a free development resource is appropriate is a decision after an exact proposal, not permission to alter production.

The original `DebtFree_Public_App_Requirements.txt` is not yet available locally. Use the saved plan/checklist provisionally and reconcile the original before locking public-launch scope. No need to block source/tool discovery on it.

## Manager review

Reports received: `reports/01-architecture.md`, `reports/02-authentication.md`, `reports/03-android-readiness.md`. All three visible discovery worker turns completed without errors. The manager reviews results. Latest owner direction: workers save reports and finish in their own chats without direct completion messages; wait until the owner explicitly says workers are ready before checking their chats/status. No automatic detection, polling or automation. A general continuation request or owner setup completion is not a worker-status heads-up.

Initial manager reconciliation: proceed toward a separate no-network synthetic browser bundle before Capacitor/native packaging. Keep initial repository injection minimal; defer the broader connected transport/session refactor until its contract is reviewed. Both proposals touch DashboardClient/lifecycle, so those edits must be sequential under a single owner. Android toolchain preparation can be a separate non-overlapping task. No Android installation, cloud provisioning, native auth implementation or iOS access was performed/claimed in this discovery round.

## Manager summary and next round

Reviewed all three reports and their dated continuations. Discovery is sufficient to start the bundled synthetic-client checkpoint; it is not approval of an implemented native authentication design or a claim that an APK exists. Agent work in this round was report-only; existing application/setup/category work remains preserved.

Concerns to track:

- The existing web output has no standalone root HTML. Client extraction and bundle isolation need an actual build/browser check, not only a dependency inventory.
- Mobile authentication, secure credential/draft storage and authoritative session revocation remain unproven. Review provider/plugin capabilities and API contract before connected financial access; no web-security bypass.
- Android Studio/SDK/Java tools are not confirmed installed in PATH or standard locations. Toolchain verification/install and disk/download needs precede native compilation.
- Physical Android versions and phone acceptance are pending. iOS remains blocked on reliable build/device access; the original full requirements file is still unavailable for product/launch reconciliation.

Round 2 assignments (owner authorized "let's begin then"; dispatched to the same three visible GPT-6.1 Sol Low workers):

1. Architecture worker: implement the narrowed standalone synthetic bundle from its continuation, owning mobile entry/fixture/repository/config and minimal shared dashboard/lifecycle integration. Manager owns root script/ignore integration. Require isolated browser behavior, preserved theme/category/accounting/Progress and zero auth/API/production requests.
2. Android worker: create the read-only toolchain doctor and concise Windows setup instructions in its separate scope. Prepare exact missing-tool setup; actual installation/SDK license interaction is a later explicit task. No package/native-project edits while the client boundary is settling.
3. Authentication worker: refine a minimal native auth/session/transport contract and proposed negative-test matrix, resolving secure-storage and session-liveness feasibility. Keep this round out of shared dashboard/backend files and make no cloud/provider changes.

After the first bundle passes manager review, assign one packaging owner for Capacitor/package/lockfile/native project edits and produce the debug APK. Then run owner-assisted phone acceptance, followed by isolated connected-auth/sync work. No requirement for the owner to validate agent completion.

Manager design decision for the future connected slice: the contract's memory-only variant is acceptable only as an explicitly limited authentication proof without connected financial editing. Connected edits must preserve durable pending-draft/recovery behavior across process death before claiming D3/D4 acceptance. Secure token storage and encrypted financial-draft storage are distinct gates. No storage plugin or privileged liveness service is selected merely by the documentation review.

Manager reserved root package scripts/ignore changes and saved source-only baseline copies under ignored `.wrangler/mobile-round2-baseline`. Package lockfile and both Wrangler configurations were fingerprinted; no dependency or configuration mutation is planned in this round. The architecture worker owns the minimal shared dashboard/lifecycle edits; tooling and auth scopes are disjoint. Manager will run integrated validation after the client worker's focused checks finish, avoiding competing browser servers.

## Round 2 result

Accepted D1. All three workers reported directly to the manager; implementation corrections were returned to their owners and verified. Final checks: lint/types passed; web build and 315 unit/API tests passed; 6 standalone browser checks passed; full web suite 136 passed/2 intentional skips/0 failures. Doctor syntax/read-only/error-path and corrected version parser checks passed. Desktop/phone screenshots were inspected. No APK/device/provider/iOS pass or native-tool installation occurred. Current local household payload and lockfile/Wrangler fingerprints were preserved. See `reports/07-manager-round2.md` and `LOCAL_DEMO.md`.

## Round 3 — Android project/tool preparation reviewed

Owner authorized continuation. Packaging worker owns exact Capacitor 8.5.3 packages/lock changes, root config bridge, mobile config/native project and native branding. Tooling worker owns a verified portable JDK/official command-line-tools preparation script/cache and setup guide. No global settings, production/provider/database changes or automatic SDK license acceptance. Independent review worker is assigned only after packaging files stabilize.

Generated project requirements reported: Java21, Gradle8.14.3, AGP8.13.0, minSDK24/compileSDK36/targetSDK36. SDK Build-Tools default must match the generated AGP requirement. The existing web dependencies' versions/removals were independently compared with a source-only baseline: no existing package version changed or disappeared; 82 package entries added for packaging. New native dependencies are an explicit round3 exception to the prior lock freeze.

If SDK acceptance is required, prepare the exact owner command and all non-blocked project/tool work before reporting the gate. A generated native project or `cap sync` is not an APK/native compile pass. Physical phone and iOS gates remain distinct.

Manager outcome: reports08–10 reviewed; stale instrumentation assertion corrected; canonical tool cache repaired and verified, interrupted future downloads stay in `.part` until hash verification. Root generated-folder lint/TS exclusions are in place. Lint, types, web build + 315 tests, 4 demo repository tests and 6 demo browser checks passed. Current native assets resynced. Gradle8.14.3 wrapper launched successfully with Java21.0.12.1 and its pinned distribution checksum. Existing web dependency versions were preserved; the scoped UUID override restored audit findings to the existing baseline (22), with no new vulnerability entries. Current local household and protected sources/configs remain unchanged.

Next owner action: run the interactive ReviewLicenses command in ANDROID_SETUP.md and report whether it completed. No SDK packages/license acceptance/native build were run by agents. After actual owner acceptance, verify licenses and install only Platform36, Build Tools35.0.0 and Platform-Tools, then assembleDebug/lintDebug and inspect the resulting APK before phone installation. See reports/11-manager-round3.md. No background polling/worker completion messages; latest manual heads-up preference remains active.

## First APK — owner license step completed

Owner reported the PowerShell license review finished; actual license records and an EOF-only accepted-license check verified before SDK requests. Installed only Platform36 revision2, Build Tools35.0.0 and Platform-Tools37.0.1. Native build/lint passed. APK asset audit initially caught AGP expanding/renaming the OCR gzip file; a native generated-assets task now preserves its exact packaged name/bytes. Final APK matches all18 web files, uses the development identity/no remote server, and has a verified debug signature. App lint:0 errors/10 warnings; existing dependency baselines/warnings remain documented. See reports/12-manager-first-apk.md.

Next: owner connects S20+ for first physical test and provides Android version. No adb/device interaction yet; D2 remains incomplete until install/runtime acceptance. No worker status/chat detection during this continuation; a setup-command completion does not authorize worker checks. Real household/production unchanged.
