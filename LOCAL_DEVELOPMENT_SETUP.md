# DebtFree Dashboard — Windows local development

## Ready-to-run copy

Folder: `C:\Projects\debtfree-dashboard`
Branch: `local/windows-development-20261016` (local only; no production branch upstream).
Source: release branch `codex/production-release-20261015`, commit `f330764`.
Latest successful production workflow observed during setup: `325776149de891bc17d48495e6b4100a4e0e272f`, https://github.com/ensong0608/debtfree-dashboard/actions/runs/38994090847 . Its publish, preservation, and authentication verification steps succeeded. The later `f330764` changes only recovery workflow/tooling; application source matches that deployment. This is deployment-log evidence, not an independent Cloudflare account inspection. No deployment credentials or production records were accessed.

## Start, edit, stop

```powershell
Set-Location C:\Projects\debtfree-dashboard
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Start-Local.ps1
```

The execution-policy override applies only to that process. It makes no system policy change. The script installs dependencies if missing, applies local migrations, adds missing synthetic fixtures without overwriting existing households, and starts the server.

Open http://localhost:8787/__local and choose an account. The application is http://localhost:8787 . Use `localhost`, not the LAN address or `127.0.0.1`. Stop with Ctrl+C in the starting terminal. Do not close unrelated Node processes.

```powershell
code C:\Projects\debtfree-dashboard
# Subsequent starts without setup:
npm.cmd run dev:local
```

Vite updates the browser as source changes. Restart after Vite/plugin/configuration changes. The setup screen is outside the application design; application colors/components/navigation remain the release implementation.

## Prerequisites and installation

Verified installed: Git, Node v24.14.1, npm 11.11.0, VS Code 1.129.1. Wrangler is project-local, lockfile version 4.131.1. Playwright Chromium and FFmpeg were installed in the user's Playwright cache. No global packages or system-wide configuration changes were required.

```powershell
git --version
node --version
npm.cmd --version
code --version
npx.cmd wrangler --version
```

For another Windows PC, install Git, Node 24 LTS, and VS Code using their official installers, then reopen PowerShell and run those checks. Repository minimum Node version is 22.13; operations documentation uses Node 24. Use `npm.cmd`/`npx.cmd` to avoid PowerShell npm.ps1 execution-policy issues.

```powershell
New-Item -ItemType Directory -Force C:\Projects
git clone https://github.com/ensong0608/debtfree-dashboard.git C:\Projects\debtfree-dashboard
Set-Location C:\Projects\debtfree-dashboard
git switch -c local/windows-development origin/codex/production-release-20261015
git branch --unset-upstream
npm.cmd ci
npx.cmd playwright install chromium
```

The setup files in this local branch must also be retained or committed before recreating it elsewhere; they are not yet on GitHub.

## Architecture and files

- `app/`: React 19 / Next-compatible application, household APIs, calculation logic and UI.
- `worker/`: Cloudflare Worker entry; vinext/Vite provides the full-stack runtime.
- `drizzle/`: committed D1 migrations; `DB` holds households, membership, versioned JSON financial state, invitations, and deletion requests.
- `tests/`: unit/API tests and browser regression tests.
- `wrangler.jsonc`: existing production configuration. Do not use for local migration commands.
- `wrangler.local.jsonc`: separate fictitious D1 identifier and local Worker name, explicitly `remote: false`.
- `vite.config.ts`, `scripts/local-development-plugin.ts`: local config and account simulation activated only when `DEBTFREE_LOCAL=1` AND Vite is serving. Builds never activate the simulator.
- `scripts/local.mjs`: fixed local commands; no remote/deploy mode.
- `.wrangler/local-state/`: ignored persistent local database.
- `.env.example`: credential-free template; `.env*`, `.dev.vars*`, SQLite files and `.wrangler/` are ignored.

## Environment and isolation

No API keys, Cloudflare login, real Google identity, or production secrets are needed. `wrangler.local.jsonc` sets `APP_ORIGIN=http://localhost:8787`, household lifecycle enabled, and allows `new@example.test` to create a household. Access audience/domain are inert placeholders. `AUTH_PROVIDER=supabase` is deliberately absent. The launcher sets `DEBTFREE_LOCAL=1`, disables the inspector and telemetry. Do not copy production `.env`/`.dev.vars` files here.

Local D1 has a fake UUID `00000000-0000-4000-8000-000000000001`. All local database commands explicitly pass `--local`, a separate config, and `.wrangler/local-state`. The dev server binds to localhost, and the simulator rejects other Host names and cross-origin writes. Local synthetic cookies are only a testing mechanism, not production authentication. Never expose this server using a tunnel.

## Accounts, household testing, and sample data

At `/__local`, choose:

| Account | Role/use |
| --- | --- |
| owner | Owner of Demo Household |
| admin | Editable member of Demo Household |
| viewer | Read-only member of Demo Household |
| other | Owner of Separate Household; isolation checks |
| new | No initial membership; household creation/invitation testing |
| guest | Signed out/device storage; onboarding tests |

All addresses end in `@example.test`. Use different browser profiles for concurrent sessions; account switches within one profile share cookies across tabs. Account selection is intentionally synthetic and does not test registration, password handling, OAuth, refresh tokens or email delivery. The normal My Account sign-out clears the simulated session. Use the new account and household invitation UI to exercise lifecycle flows; no real invitation email is sent by this setup. Membership authorization and household data APIs use the existing application implementation.

Seed data uses only the committed synthetic fixture, migrated through the application's version-6 parser, with a current-month budget, credit card and personal loan, transactions, historical snapshot, and separate home/car loan trackers linked to budget bills. Both seeded households have independent state. The guest starts with an empty browser profile. Seeding is idempotent and preserves edits. Future months may need their normal budget copy/review action.

Production Google OAuth is not configured locally. For end-to-end Google testing, use a separate development Supabase project and Google OAuth client with local callback settings, following `docs/GOOGLE_LOGIN_SETUP.md` and https://supabase.com/docs/guides/auth/social-login/auth-google . Configure only development credentials, and explicitly adapt/disable the local account simulator before testing real OAuth. This step remains manual; no production auth project was changed.

## Database setup, backup, reset

```powershell
npm.cmd run db:migrate:local
npm.cmd run db:seed:local
```

Stop the server before resetting. Export any local experiments using Settings first. To reset only local state safely:

```powershell
Set-Location C:\Projects\debtfree-dashboard
$localDbPath = [IO.Path]::GetFullPath((Join-Path (Get-Location) '.wrangler\local-state'))
if ($localDbPath -ne 'C:\Projects\debtfree-dashboard\.wrangler\local-state') { throw 'Unexpected database directory' }
Remove-Item -LiteralPath $localDbPath -Recurse -Force
npm.cmd run db:migrate:local
npm.cmd run db:seed:local
```

Also clear site storage for localhost:8787 if you want to remove device backups/outboxes, or use a fresh browser profile. Resetting D1 does not clear browser storage. Never use production exports to populate this database without separate explicit permission.

## Validation commands

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
# With the local server running:
npm.cmd run test:local:api
npm.cmd run test:browser:local
# Smaller UI regression selection:
npm.cmd run test:browser:local -- tests/browser/loan-progress.spec.ts tests/browser/dashboard.spec.ts tests/browser/actual-progress.spec.ts tests/browser/household-lifecycle.spec.ts --max-failures=1
```

`npm test` includes the production-mode build and unit/API suite; it does not deploy. `test:browser:local` uses the running local server and desktop/tablet/phone projects. Existing tests predominantly exercise guest/device mode or mock their API responses. The separate local API test exercises actual local D1, including role denial and household isolation; its admin save increments only a local fixture revision.

Dependency audit at setup: 22 findings (1 critical, 15 high, 5 moderate, 1 low), including Next. Versions were preserved for production parity. The older operations note about only four moderate findings is no longer current. Inspect `.wrangler/npm-audit.json` or run `npm.cmd audit`; evaluate upgrades in a separate change, without `npm audit fix --force` during this setup.

## Git workflow and production updates

No changes have been pushed and no deployment is authorized. Commit/review the local setup on this dedicated branch:

```powershell
git status
git add .gitignore package.json vite.config.ts wrangler.local.jsonc .env.example Start-Local.ps1 LOCAL_DEVELOPMENT_SETUP.md playwright.local.config.ts scripts/local-development-plugin.ts scripts/local.mjs scripts/seed-local.mjs scripts/test-local-api.mjs
git commit -m "Configure isolated Windows local development"
# Only when you approve publishing your branch:
git push -u origin local/windows-development-20261016
gh pr create --base codex/production-release-20261015 --head local/windows-development-20261016
```

Pushing/merging to the release branch can trigger a production deployment. Existing workflows deploy from named release branches, and `AGENTS.md` also describes direct production deployment for ordinary site changes. This task is explicitly local-only. Never run `npm run deploy`, `deploy:cloudflare`, `db:migrate:cloudflare`, remote recovery/export tools, or workflow dispatch commands as part of local development. Do not merge a release PR until approved for production.

Before pulling updates, commit unfinished work locally (or use `git stash push -u`, avoiding local secrets). Fetch, inspect successful deployment workflow runs, and merge the verified production source into your LOCAL branch, not the reverse:

```powershell
git add <specific-source-files>
git commit -m "WIP: preserve local work"
git fetch origin
gh run list --workflow deploy-cloudflare.yml --limit 5
git merge origin/codex/production-release-20261015
npm.cmd ci
npm.cmd run db:migrate:local
```

Resolve conflicts preserving the local-only Vite path and database config, then rerun checks. If upstream changes introduce authentication or schema requirements, inspect them before starting. Stash users can use `git stash apply` and drop the stash only after confirming their work survived.

## Troubleshooting and reinstall

- Port 8787 occupied / another vinext server running: stop the terminal running this repository's server, then restart. The framework uses a project-wide dev-server lock; use the local Playwright config to reuse port 8787.
- Node/tsc command unavailable: reopen PowerShell after installation; run `npm.cmd ci` to completion before starting tools.
- Database unavailable: rerun local migrations, confirm `.wrangler/local-state`, and use `dev:local`.
- Unauthorized household: select an account at `/__local`; guest mode deliberately returns 401 from household APIs.
- Viewer cannot edit: expected; switch to owner/admin.
- Unexpected old browser state: export local work first, then clear localhost site storage or use a new profile.
- OAuth unavailable: use local accounts; real OAuth needs the separate development configuration above.
- Reinstall dependencies: stop the dev server and run `npm.cmd ci` (recreates node_modules from the unchanged lockfile). Keep `.wrangler/local-state` to preserve experiments, or use the explicit reset procedure for a clean database. Do not delete the entire project or uncommitted work.

Cloudflare local D1 reference: https://developers.cloudflare.com/d1/best-practices/local-development/ .

## Validation report

Completed on this PC:

- Lockfile install (`npm ci`), production-mode build, all 311 unit/API tests, lint, and TypeScript checks passed.
- Both committed D1 migrations applied successfully to local D1; synthetic seed applied successfully.
- Running local API tests passed for anonymous/unknown identity denial, owner/admin/viewer/other identity, viewer write denial, cross-household denial, admin revision-checked save, cross-site write rejection and sign-out cookie removal.
- Real browser account switching loaded owner and viewer data; the new user reached the actual household setup screen. A 390px phone screenshot was inspected and showed the preserved Debts design and mobile navigation.
- Browser regression results are recorded below after completion. The full repository browser suite has a separate command above and is not implied by a targeted run.
- An initial browser harness run failed because API test writes omitted Origin and hit the local CSRF guard (403 versus the expected unauthenticated 401). The local Playwright configuration now sends the same localhost Origin as the browser; no application authorization was weakened.

Remaining manual checks: real Google OAuth/registration and token refresh against a separate development provider; exhaustive review of every existing screen and a complete browser-suite run beyond the selected regressions. Synthetic identity simulation is not proof of production authentication behavior. No real user/financial records or credentials were downloaded. Production Worker, D1, auth provider, deployment configuration, and GitHub branches were not changed.

Final targeted browser run: **52 passed, 2 intentionally skipped, 0 failed** in 3.3 minutes across desktop (1440px), tablet (820px), and phone (390px). The desktop-only scrolling case is intentionally skipped on tablet and phone. Covered onboarding, debt/payment edits and deletion/restoration, budget persistence, interest reconciliation, shared progress baselines, loan persistence, invitation UI, deletion-request UI, imports, focus/keyboard behavior, and mobile navigation. Household UI regression tests use their existing mocked API scenarios; real local D1 authorization was independently checked by `test:local:api`.

The repository's isolated D1 recovery test also passed: separate source/target fixtures, exact household/member/state preservation, revisions, progress/snapshot dates, loan history, quick_check and foreign keys. No remote database was accessed. Built server JavaScript was checked and did not contain the local account cookie/simulator implementation. Final lint and TypeScript checks passed. Startup PowerShell syntax was validated. Source, lockfile, and production Wrangler configuration have no changes; only local tooling/configuration/documentation was added or edited. Setup changes are left uncommitted on the local branch for review.

One intermediate browser run was interrupted by a configuration edit restarting Vite. The final run above completed after configuration edits were finished. Local Vite watching now excludes `.wrangler` and `outputs` so generated test traces/screenshots do not cause browser reloads.

## October 17 continuation — authorized production financial copy

The user explicitly authorized copying production financial data to this local environment, then selected the production Google account and supplied the exported backup file. This supersedes the initial setup report's statement that only synthetic financial records were present. The app's authenticated Export full backup control was used. No production financial write, database migration, deployment, remote recovery, or GitHub push was performed.

Choose **production** at http://localhost:8787/__local to open **Production household (local copy)**. The existing browser has been switched to that local account. It contains 13 debt records (9 active and 4 archived), 29 transaction records, 3 saved snapshots, 4 budget months, and 2 house/car loan trackers. Deleted/archived history is retained as exported, so visible transaction/debt counts can be smaller than total records.

The complete financial payload was validated by the application's version-6 parser and then compared field for field against both the stored local state and the untouched source JSON payload. The local Debts total and progress matched the production display. Transactions, Budget, house/car loans, Progress, and Settings were opened locally without visible errors. No test payments or balance edits were made to the copied household.

The import created a new local household and a local owner identity, `production@example.test`. It did not replace Demo Household, Separate Household, or their users/experiments. A before-import checkpoint and a private copy of the source backup are in ignored `.wrangler/private/`. The import verified that every pre-existing local row in all five household tables was unchanged. Real production memberships, invitations, sessions, Google tokens, API keys, and auth credentials were not imported. The household label intentionally identifies this as a local copy.

This is a one-time snapshot, not live synchronization. Starting the app seeds only missing demo rows and never reimports or overwrites the copied household. Local changes cannot update production through this configuration. Keep `.wrangler/private/` and local databases private; they now contain real financial information. Local browser storage for the production test account also contains its device backup. Do not tunnel the server or attach private files/screenshots to a public PR.

For an explicitly requested initial import into another fresh local installation containing these setup files:

```powershell
Set-Location C:\Projects\debtfree-dashboard
npm.cmd run db:migrate:local
npm.cmd run db:import:local -- 'C:\path\to\debtfree-household-backup.json'
```

The importer uses Wrangler's local binding proxy with `remoteBindings: false`, no environment files, fixed local configuration and the explicit `.wrangler/local-state/v3` directory. It refuses to overwrite an existing production copy. Its private report is `.wrangler/private/production-import-report.json`. Do not delete an existing copy to refresh it until local experiments have been exported and a replacement has been explicitly planned.

The review confirmed the release branch is still `f330764`; the latest successful production deployment remains `3257761`. Installed locked dependencies are complete, and local health returns 200. No dependencies or system-wide settings needed reinstalling. Application source, production Wrangler configuration and package lockfile remain unchanged.

Added during this continuation:

- `scripts/import-local-backup.mjs`: validated, additive local import with checkpoint and exact-copy/preservation checks.
- `scripts/local-config.mjs`: local command/Vite guard against changed database identity, remote D1, enabled production auth, changed origin or additional remote-service bindings.
- `production` in the development-only account selector, with wording that accurately describes the real imported snapshot.

When committing local setup tooling, include these two new scripts in the explicit file list in the Git workflow above. Never stage `.wrangler`, the exported financial backup, private reports or screenshots. Changes remain local and uncommitted.

Remaining limitations: simulated local identity does not exercise real Google registration/token refresh. That still requires a separate development auth provider. The dependency audit findings from the initial setup remain unresolved to preserve the production lockfile. They should be handled in a separately reviewed dependency update.


Continuation validation results: production-mode build and all 311 unit/API tests passed again; lint and TypeScript checks passed. The COMPLETE repository browser suite passed: **130 passed, 2 intentional desktop-only scrolling skips, 0 failed** across desktop/tablet/phone in 7.8 minutes (`.wrangler/review-browser-tests.log`). These UI regression tests use synthetic/device or mocked API data. Real local D1 permission checks separately passed, and a demo owner was denied access to the imported household with 403. The imported household's health endpoint returned 200. The prior local D1 recovery test remains valid; no schema changed during this continuation. No real Google OAuth configuration or physical-device verification is implied by these results.

The original source JSON financial payload and the copied API payload also matched exactly without any parser normalization differences. The copied household remained unchanged after UI and regression testing. No production financial records, deployment, database schema, auth-provider configuration, or repository branches were modified. All new code/configuration/documentation changes remain uncommitted in `local/windows-development-20261016`.

## Local debt-category UI change — October 17

Implemented locally: existing categories can be selected in the add/edit debt dialog below Debt type; Add category opens an inline themed name field. New categories are committed with the debt, and cancelling the debt discards a pending category. Debt categories can be added and renamed in Settings with explicit Save/Cancel controls. Sort now handles ordering only. Stable category IDs, financial balances, ledger/history and Progress baselines are preserved. No schema migration or production deployment is involved.

Changed application files: `app/debt-category-controls.tsx`, `app/dashboard-client.tsx`, `app/globals.css`. Added browser coverage in `tests/browser/debt-categories.spec.ts` and updated the existing group/progress UI tests for the new Settings/editor flow.

After the Windows restart, the app started successfully with its normal local command and localhost returned HTTP 200. The earlier dynamic TCP port exhaustion is resolved. The temporary process-only networking experiment was removed; no system-wide networking changes or startup workarounds are in use.

Validation commands:

```powershell
Set-Location C:\Projects\debtfree-dashboard
npm.cmd run test:browser:local -- tests/browser/debt-categories.spec.ts tests/browser/debt-groups.spec.ts tests/browser/actual-progress.spec.ts --max-failures=1
npm.cmd run test:browser:local -- --max-failures=1
```

The targeted category/progress run passed all 15 tests. The complete updated browser suite passed **136 tests, 2 intentional desktop-only scrolling skips, 0 failures** across desktop, tablet and phone in 7.8 minutes (`.wrangler/category-full-browser-tests.log`). It covers category creation, duplicate/empty-name validation, cancellation, Settings creation/renaming, debt reassignment, persistence, and unchanged financial history and Progress. Existing onboarding, payments, Budget, loans, accessibility and recovery regressions also passed. Tests use synthetic/device or mocked API fixtures, not the imported household.

Desktop and phone screenshots were visually inspected against the existing theme. They are in `outputs/ui-verification/debt-categories/`; `phone-edit-debt.png`, `phone-add-category.png` and `phone-settings.png` show the new controls. This is agent visual verification, not a claim of user design approval. The in-app browser tool declined access under its URL policy, so the user's tab was not controlled during this verification; refresh http://localhost:8787/ to see the changes.

Build, lint, TypeScript and all 311 unit/API tests passed. Real local D1 account/isolation/CSRF checks passed again. The private import check confirmed the copied API financial payload still exactly matches the original export. All imported production-copy records and prior local setup files were preserved; no production financial write, deployment or GitHub push was performed. Changes remain uncommitted on the local development branch. The separate development-auth and dependency-audit limitations above still apply.

## Standalone mobile-client checkpoint — October 17

The Android/iPhone preparation now has a separate sample-data browser bundle. Its PC preview address is http://127.0.0.1:4179/. It reuses the current dashboard/theme/accounting code and stores fabricated records in scoped browser storage on that separate origin; it does not use local D1, the simulated production account or production APIs. The existing household app and startup script remain at localhost:8787.

Start/build/test instructions are in `docs/mobile/LOCAL_DEMO.md`; the work board, agent reports and manager integration result are in `docs/mobile/`. The read-only Android tooling checker and `ANDROID_SETUP.md` describe remaining native prerequisites. A browser bundle is not yet an APK or a verified native authentication/device implementation.

At the start of this mobile round, the current imported local household already differed from the original JSON export in its accounts field. The manager preserved that current state and recorded a hash-only baseline under ignored `.wrangler/mobile-round2-baseline`. Historical exact-import comparisons above describe their verification time. Do not overwrite current local edits by restoring/reimporting the older export merely to make that historical comparison pass.

## October 18 — explanation and payoff-table UI refinement

Local source changes: consistent info icons and accessible explanation dialogs with an upper-right circled close control; explanations added to key calculated figures across Debts, Transactions, Home, Budget, Progress, Payoff Plan, the quick calculator, insights and loan summaries. Payoff Plan's separate Assumptions section is replaced by contextual help. Full payoff schedule uses compact table rows on desktop and phone, with paid-off accounts listed beneath the month. Transaction deletion is a small centered text action below Cancel/Save. The duplicate calculator item is removed from Tools; the debt-screen calculator remains. The settings icon uses a symmetric eight-tooth outline.

These are source edits only. No tests, browser acceptance, lint, typechecks, builds, deployment, database commands or phone operations were run, following the owner's approval rule. The running local dev server may pick up edits through its normal reload behavior, but no rendered result is claimed. Review the local screen and obtain approval for focused checks before claiming verification.

Brave can use the same local server on this PC: scripts/local.mjs binds localhost:8787 and the local middleware accepts the localhost Host with same-origin writes. Browser profiles have separate cookies/device storage; opening another browser does not expose the server to the internet or copy device-only records.

## October 18 — UI-v4 verified update APK

Owner explicitly requested removing info icons while retaining explanations, inline Transaction summary icons/titles, a second-click Settings toggle, then tests and an update APK. This request authorized this task's checks/build; the standing ask-before-testing rule remains for future tasks.

Implemented label-based explanation buttons (no separate info glyph), inline Transaction card headings, Settings returning to the preceding page on the second gear click, and readable unsplit Budget amounts. The earlier circled explanation close control, secondary centered Delete action, compact schedule table and mobile Tools cleanup remain. Added synthetic mobile/ui-refinements.spec.ts coverage at 320px and 390px and expanded the existing mobile test configuration. Transaction keyboard regression exposed a Tab-focus escape; fixed focus cycling in the shared dialog. Desktop transaction-help expectations now reflect the requested explanations. Corrected unknown JSON response typing in the earlier connected runtime/repository; this does not activate connected mode.

Final checks:
- TypeScript and focused ESLint: PASS.
- Mobile bundle/browser suite: 19 passed, 5 intentional desktop/mobile-scope skips, 0 failures.
- Independent synthetic transaction regression suite: 15 passed, 0 failures (including stale edit/delete safeguards, cancel, viewer access, PHP values and keyboard focus).
- Focused appearance/Home/currency/mobile-repository unit checks: 22 passed, 0 failures.
- Mobile build/Capacitor sync and Android assembleDebug/lintDebug: PASS; app lint 0 errors / 9 existing warnings.
- APK audit: all 19 web files byte-identical, zero plugins, no remote server URL, zero forbidden private files. git diff --check PASS.
- Screenshots inspected for 320px Budget and compact schedule, 390px Transaction headings and secondary Delete layout. Synthetic browser tests preserve their financial fixtures; no real household/production operations were performed.

Delivered file: C:\Users\masil\Desktop\PROJECTS\0LESS\builds\DebtFree-Dev-20261018-UI-v4.apk
Package com.debtfree.dashboard.dev; version1.0.2/code3; 12,721,936 bytes.
SHA256 e7bb5612df97e395af4a0a75bd59bbfdabaeae813a53793b65b9d7fd6cf1de40.
Signer SHA256 01f3806626d72c8b53d2a1dd5c1069d1248a9968fadf906d8d7ae1aa799273ab; compared directly with UI-v3 and matched. Destination copy hash verified. Install as an update; do not uninstall or clear app data. Actual phone installation/data retention has not been performed by the agent. This remains the device-only app; connected Google/shared-household delivery is still separate and incomplete. Existing APKs were preserved. No commit/push/deployment.

## October 19 — approved production release candidate

Owner paused connected Android/shared-session implementation after diagnostic APK v2 still returned S3. The separate test resources/source/APKs are preserved; the unfinished native test is not enabled for production.

Owner requested all completed app changes published to production and GitHub, then explicitly approved production lint, TypeScript, full tests, browser checks, exact Worker dry-run, encrypted recovery and read-only data-preservation/login verification. Existing GitHub production-release workflow is the publishing path; do not duplicate it with a manual deployment.

Candidate includes the completed responsive dashboard navigation, Settings toggle, debt-category editing/order, currency/appearance settings, text-triggered explanations with circled close control, inline Transaction headings/secondary delete action, quick calculator and compact payoff table. Corrected nested interactive controls on loan cards by placing explanation controls outside the edit button. Existing browser tests now use the approved responsive navigation/table/secondary-delete flows and the correct web fixture namespace; a synthetic loan-help regression checks that help does not open editing or change its balance.

Pre-push checks: full app build, lint/TypeScript and389 automated cases passed; local synthetic D1 restore/quick_check/foreign-key/financial-state preservation rehearsal passed; exact production Worker bundle dry-run passed. Production schema unchanged. Built production assets contain no connected-test issuer, custom callback or authority endpoint. Public-source screening excludes credentials, generated bundles/APKs/SDKs and financial exports; tester email literals were removed from the new public checkpoint (exact private enrollment configuration remains intact).

Windows browser runs exposed outdated selectors and the loan help nesting issue. Those were corrected; complete final browser acceptance remains a mandatory GitHub workflow gate before production publication. Standard3011 test startup conflicts with an existing vinext development server for this checkout, and repeated local cold-start120s timeouts are not a passing browser result. Earlier partial runs do not establish full acceptance. Final workflow/deployment/backup/preservation evidence will be recorded after completion.

GitHub main and codex/production-release-20261015 are both ancestors of this checkout. Plan: fast-forward both to the reviewed candidate, preserving the local development branch and history. Existing production before release: Worker d8d41ec6-ce11-43b7-ad5d-5fe8d37aacf3, unchanged D1 debtfree-dashboard-prod/3f2dd9d5-77de-4945-8e13-f6c1af454de1. Public registration remains closed. No production financial write/import/reset is included.
