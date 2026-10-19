# Agent report: Mobile architecture and client extraction

Date/time zone: October 17, 2026, America/Los_Angeles.
Status: complete — discovery only; implementation and device checks remain pending.
Owned files: `docs/mobile/reports/01-architecture.md` only.

## Inspected evidence

Repository paths below are relative to `C:\Projects\debtfree-dashboard`; line references describe the inspected working tree, including the existing uncommitted category work.

| Evidence | Relevant finding |
|---|---|
| `AGENTS.md`; `docs/mobile/README.md`; saved mobile plan, public checklist and Stage 6 notes | Local-only discovery; preserve theme, single Debt +, groups, Progress and ledger; original requirements file remains unavailable. Historical release/public statuses are not current device evidence. |
| `LOCAL_DEVELOPMENT_SETUP.md`, latest category section | Records the prior 311 unit/API and 136 browser passes, two skips, simulated identity and unchanged copied household. These are historical results, not tests rerun by this agent. |
| `package.json:1`; `vite.config.ts:1`; `app/page.tsx:1`; `app/layout.tsx:1` | React 19 with vinext/Vite 8 and Cloudflare server environments. Home performs authentication/membership resolution and redirects on the server. Layout imports three stylesheets and reads request headers. |
| `dist/client` directory listing | Contains `_next`, OCR, static assets and a vinext client manifest; no root `index.html`. Existing build output is not a complete standalone Capacitor application. |
| `app/dashboard-client.tsx:255` | Dashboard receives user/household props; navigation uses React `PageId` state rather than a Next router. It constructs its repository, sync controller and browser integrations internally. |
| Static TypeScript import-declaration walk from DashboardClient | 50 local runtime modules reached. External static runtime imports: React and `next/link` (only in `household-lifecycle-panel.tsx:2`). The `DashboardUser` import from server-dependent `cloudflare-auth.ts` is type-only and is erased; do not mistake it for a runtime server dependency. Dynamic exports/OCR require separate handling below. |
| `app/data-repository.ts:13–36`; `app/household-sync.ts:14–41`; `app/household-recovery.ts:6` | Repository methods are asynchronous, but its Storage adapter, sync outbox and recovery enumeration are synchronous Web Storage interfaces. Sync already accepts an injectable request function. |
| `app/dashboard-data.ts:10,1137`; `app/dashboard-client.tsx:337` | Current contract is version 6. Payload/backup helpers preserve unknown template properties; load preserves the original starting balance and retained removed-account records. |
| `app/use-dialog-focus.ts:5`; `app/dashboard-client.tsx:414,447` | Existing visualViewport sizing, focus management, Escape handling, and safe refresh guards are reusable. Browser events are not proof of native Back or app lifecycle handling. |
| `app/layout.tsx:3`; `app/globals.css:1`; `app/reference-layout.css:1`; `postcss.config.mjs:1` | CSS must retain order: globals, design-system, reference-layout. Tailwind PostCSS processing is required. Final reference tokens set 8px control corners. Safe-area and dynamic-height rules already exist. |

Official documentation checked October 17, 2026:

- Capacitor needs built assets with a root `index.html` containing a head; `webDir` points to those assets and sync copies them into native projects. [Installation](https://capacitorjs.com/docs/getting-started).
- A dedicated Vite HTML entry produces a static client bundle. [Vite production build](https://vite.dev/guide/build.html).
- `server.url` is intended for live reload, not a production packaging approach. Keep the default local schemes initially; do not broaden navigation or enable cleartext as a shortcut. [Capacitor configuration](https://capacitorjs.com/docs/config).
- Capacitor App exposes lifecycle, URL-open and Android Back events; installing a Back listener replaces default behavior. [App API](https://capacitorjs.com/docs/apis/app).
- Web Storage is available but has durability caveats. Preferences is for lightweight settings; database/storage selection is needed for larger retained records. This is not a recommendation to put authentication tokens in Preferences. [Storage guide](https://capacitorjs.com/docs/guides/storage).

## Findings

**Recommendation (proposal): use a separate bundled React entry with Capacitor, reusing the current dashboard and pure accounting modules. Keep the existing Worker/D1 architecture.** No database replacement is required. Avoid a native UI rewrite at this stage and avoid wrapping the production website URL.

The smallest useful checkpoint is a statically served synthetic demo of the actual DashboardClient, followed by an Android debug APK containing that bundle. It can work without the PC server or any account because the existing device-only branch bypasses household synchronization. Label it a demo; this proves rendering, theme, accounting interactions and packaging, not real sign-in, safe native persistence or connected household operation. Never seed it from the real imported localhost household. The `/__local` simulator is a web-development tool, not a native authentication mechanism.

The import graph is close to browser-ready but not framework-independent yet. `HouseholdLifecyclePanel` is imported even when its UI is disabled, so merely setting `lifecycleEnabled=false` does not eliminate `next/link` from a conventional client build. Replace that component's two internal links with an injected navigation callback/link boundary that defaults to equivalent ordinary anchors for web. Do not alias every Next import or bundle the server entry. A shared `dashboard-user.ts` type can later remove confusing type ownership without changing authentication.

### Complete integration inventory

| Boundary | Existing sites | Proposed handling |
|---|---|---|
| Household transport | `household-sync.ts:38` GET/PUT `/api/household` | Inject a reviewed absolute-origin request adapter, retain revision checks and verified identity/household response checks. |
| Direct dashboard API calls | `dashboard-client.tsx:556,562,813` member POST/DELETE and saved household export GET | Route through the same adapter; repository injection alone does not cover these. |
| Lifecycle transport | `household-lifecycle-panel.tsx:16,21,25` initial/load GET and action POST | Inject request/navigation; preserve acceptance, expiry, roles, leave/deletion semantics. No active lifecycle calls in demo. |
| Authentication/bootstrap | Server `page.tsx`; client expired-session link at `dashboard-client.tsx:1103`; sign-out form at `:1524` | Mobile bootstrap explicitly resolves verified identity/membership, renders access/setup states, and keys DashboardClient by session/household. Use auth adapter actions for sign-in/logout; never navigate to an unbundled `/auth` route or weaken web cookies/CSRF. Agent 2 owns native contract details. |
| External/setup links | `dashboard-client.tsx:1499`; lifecycle `:28,45,52,56` | Current `window.location.origin` would copy a device-local origin. Use configured HTTPS development link base, URL allowlist and explicit navigation/deep-link routing; demo must not advertise a usable household share link. |
| Device cache/outbox | `data-repository.ts`; DashboardClient `:353,369–378,1052`; `household-sync.ts`; `household-recovery.ts` | Namespaced throwaway storage is enough for demo. For connected native state, select a durable store and refactor all synchronous outbox/enumeration accesses together. A promise-returning Preferences adapter cannot satisfy existing Storage calls. Credential storage remains separate and protected. |
| Export/import | DashboardClient `:804–849`; `data-safety-panel.tsx`; `payoff-export.ts:41,119,266,419` | Full JSON and CSV/XLSX use Blob/anchor download; PDF uses `jsPDF.save`. Introduce file export/share service for every format and return completion/cancellation accurately. Keep parsing, preview, checkpoint, replace/merge validation unchanged. Native file input/receipt selection needs device checks. |
| Dynamic assets | `receipt-ocr.ts:181`; `public/ocr`; dynamic fflate/jspdf imports in `payoff-export.ts:250,319` | Include whitelisted OCR worker/core/language files and dynamic export chunks; resolve asset URLs against bundle origin. Prove worker/WASM behavior on device; do not silently replace offline OCR with a cloud upload. |
| Navigation/lifecycle | DashboardClient page/modal state, focus/online/visibility timers, `use-dialog-focus.ts` | Add a navigation controller with explicit topmost-dialog dismissal, unsaved-form handling, page history and Android Back. Do not synthesize Escape: multiple existing listeners can close several surfaces. Native resume should request the existing guarded refresh, never overwrite an active form or pending/conflicted draft. |

Connected editing currently becomes read-only when browser connectivity is offline (`dashboard-client.tsx:325`); failed in-flight writes retain their outbox. Preserve that distinction. Do not interpret the device-only demo's editable state as authorization for connected offline financial writes.

Preservation requirements for every slice: keep v6 validation and unknown-field round trips, stable IDs/category order, transaction tombstones/corrections, interest estimate/replacement/reconciliation links, loan histories, snapshots, `monthlyPlan.progressStartingBalance` and `removedProgressAccounts`. Retain cent rounding, household dates and current payoff engine. A viewport/layout adaptation must not recalculate baselines, seed real data, or introduce old-client writes that discard new fields. Add an explicit minimum-client/API compatibility contract before connected beta.

## Recommended implementation slices

1. **Bundled synthetic client (next task; no Capacitor dependency needed yet).** One owner adds `mobile/index.html`, `mobile/main.tsx`, `mobile/vite.config.ts`, `mobile/demo-fixture.ts`, `mobile/demo-repository.ts` and a small `app/dashboard-platform.ts` interface; edits DashboardClient for optional repository/navigation/file-service injection with unchanged web defaults; removes lifecycle `next/link` coupling. Manager exclusively owns package scripts/ignore changes. Use existing React Vite plugin, explicit CSS/PostCSS handling, output `mobile/dist`, and a whitelist of public assets. No vinext/Cloudflare plugin, no production origin fallback, no project env loading into bundle, no access to local D1/backups. Inject a validated sample contract through a stable namespaced repository; seed only on absent demo state. Acceptance: root HTML/static chunks load from independent static server, real app retains theme and category/payment/Progress flows, reload retains only demo changes, and network capture shows zero household/auth/production requests. Inspect bundle for server modules or credentials and run relevant existing web regressions. Browser pass remains separate from device pass.
2. **Android bundled-demo package.** Depends on slice 1 and Agent 3 toolchain plan. Proposed `mobile/capacitor.config.ts`, `mobile/android/**`, dedicated mobile script/config additions; one packaging owner. Point webDir to mobile/dist, omit server.url, use a distinct development application ID and debug signing. Add `mobile/platform/native-lifecycle.ts` plus a dashboard navigation boundary under one coordinated owner. Acceptance: install/launch with PC server off on S20+ and S21+ 5G; Back/modal/keyboard/safe-area checks, edit/relaunch demo persistence, no production traffic. Record actual Android/WebView versions first. Obtain genuine native export/share evidence before claiming exports work; temporary unavailable controls need clear scope and no false success message.
3. **Authenticated development vertical slice.** Depends on reviewed Agent 2 native session/bootstrap/API design and a separately provisioned synthetic development backend. Proposed `mobile/auth/**`, `mobile/platform/native-request.ts`, `app/household-client.ts`, `mobile/platform/native-store.ts`; coordinated edits to DashboardClient, lifecycle, sync and recovery. Move every inventoried request through transport without patching global fetch. Refactor durable draft storage consistently, await writes before reporting safety, keep recovery/checkpoint semantics, and clear access/session memory on switching without adopting another identity's outbox. Acceptance: two development identities/two households, viewer denial, membership removal, refresh/logout/account switch, lost-response retry, revision conflict, background interruption, cold/warm callbacks, export/import/share and restart recovery. No auth/device completion until real tests execute.
4. **iOS parity checkpoint.** Reuse the same entry, calculations, platform contracts and theme. Add only platform implementations/build settings when macOS access is available. Avoid Android assumptions in common code; never put Android exit logic into iOS paths. Compile/sign on macOS and run physical iPhone auth, keyboard, safe areas, resume, links, exports and accessibility before marking parity. Android success does not satisfy this slice.

Avoid simultaneous edits to DashboardClient, lifecycle panel, package/lockfile or sync storage by multiple agents. After each integrated slice the manager should review the diff, run the necessary existing accounting/security tests and update the work board. This report proposes boundaries; it does not authorize implementation/deployment/cloud changes beyond the current discovery scope.

## Verification actually performed

- Read-only `git status --short`: existing modified/untracked local setup/category files present and preserved.
- Read source/config/planning files, targeted `rg` searches, static directory listing, and a no-output-file TypeScript AST runtime import walk. Found no root HTML in dist/client and one Next runtime import in the dashboard graph. Dynamic imports were separately inspected.
- Reviewed current official Capacitor/Vite documentation above. No dependency resolution/install, app build, full test run, cloud/provider call, native compile, physical-device check or real authentication test performed.
- Did not read private backups, real financial JSON, local database rows, credentials or tokens.

## Blockers and owner input

- **Now:** no owner credential/account decision blocks the bundled synthetic extraction. Manager approval of the next exact implementation assignment is sufficient. Original requirements are still needed for complete product reconciliation, but do not block a labelled demo.
- **Android checkpoint:** owner has Samsung S20+ and Samsung S21+ 5G; installed Android/WebView versions and eventual device connection are still required. Toolchain prerequisites are Agent 3's assignment.
- **Connected checkpoint:** Agent 2's reviewed native contract and isolated development provider/backend access are prerequisites. Simulator/browser regression evidence is insufficient.
- **Later:** macOS build/signing access and reliable iPhone testing; public requirements, privacy/deletion and store readiness remain separately gated. No account purchases or production changes are part of this report.

## Changes made and handoff

Created this report only. No source/config/dependency/data change, commit, push or deployment. Next concrete task: assign slice 1 to one implementation owner, have manager reserve shared package/dashboard files, and require a standalone browser-tested synthetic bundle before Android packaging. Native/device/provider checks remain unexecuted.

## Continuation — October 17, 2026 (America/Los_Angeles)

Status: discovery/handoff review complete. This section narrows and supersedes slice 1 above; earlier evidence is retained. All implementation below is proposed, not executed.

### Source checks and corrections

- Re-read AGENTS.md, mobile README, assignment prompt and checkpoint; inspected current git status. Existing dirty setup/category files remain present. Only this report was edited in this continuation.
- Confirmed `DashboardClient` at line 255 constructs its own repository; `deviceOnly` at line 318 is selected by the exact email string `Local device storage only`. Its load branch returns before constructing HouseholdSync. Setting `lifecycleEnabled=false` alone does not select device-only mode. Do not invent a verified identity or household ID for the demo.
- Confirmed `DataRepository` already covers load/save/import/export/checkpoint/reset, and `createBrowserDataRepository` accepts a scope. Reuse it through a small wrapper; no new general platform interface, native file-service abstraction or navigation controller is needed for this first browser checkpoint. The prior broad injection proposal was premature for slice 1.
- Confirmed `household-lifecycle-panel.tsx` statically imports `next/link` and contains two Link elements. For slice 1, ordinary anchors with the same href/class/text are the smallest proposed removal; an injected navigation contract can wait for connected/native work. Keep the web lifecycle behavior and endpoints intact.
- Confirmed CSS order in layout, Tailwind PostCSS configuration, installed package declarations for React/Vite/plugin-react, v6 contract and type-only DashboardUser import. This is source evidence, not proof of dependency installation or compilation. Existing root Vite config imports local setup, vinext and Cloudflare; the mobile config must be independent.
- Confirmed `dist/client` has no root index.html. OCR uses absolute `/ocr/...` URLs (receipt-ocr lines 144–149), so slice 1 should serve at the bundle origin root and copy those assets explicitly. The earlier line 181 OCR reference is stale. No worker/device behavior was tested.
- Correction to demo isolation: repository injection alone does not isolate the shared navigation preference at DashboardClient lines 353/1052. Run the demo on a dedicated static origin and never on the existing localhost app port. Financial storage must additionally use a fixed demo scope. My Account currently exposes Copy dashboard link even in device-only mode; hide that action only in the explicit synthetic demo so it cannot imply household sharing.
- The earlier 50-module AST count and documentation review are prior checkpoint evidence; they were not rerun here. No new framework/platform claim depends on an external documentation refresh.

### Exact first implementation assignment — standalone synthetic browser bundle

Dependencies: manager reserves the files below for one implementation owner. No backend/provider/device access or new dependency is required by this proposed slice. Do not run the existing local app, seed/import scripts or use its storage/database as fixture input.

| Owner | Exact files | Assignment |
|---|---|---|
| One implementation owner | NEW `mobile/index.html`, `mobile/main.tsx` | Root HTML with head/viewport and React mount; import the three existing CSS files in layout order. Mount the real DashboardClient with the exact device-only sentinel user, no householdId, lifecycle disabled, a stable injected demo repository and explicit synthetic-demo flag. Show a short persistent Synthetic demo label. Bootstrap errors must render visibly without falling back to the web app or real cache. |
| Same owner | NEW `mobile/demo-fixture.ts`, `mobile/demo-repository.ts` | Hand-author a small deterministic v6 sample using current contract helpers/validation: two debts in distinct categories, a payment and snapshot, explicit Progress starting balance. Wrap createBrowserDataRepository with a fixed demo-only scope. Seed only when no valid saved demo exists; preserve edits, checkpoints and reset semantics. Distinguish corrupt existing demo data from first use rather than silently replacing it. Never read unscoped financial storage. |
| Same owner | NEW `mobile/vite.config.ts` | Independent React client config with mobile root, base `/`, output mobile/dist, explicit existing PostCSS processing, envDir disabled and no define/loadEnv containing project environment. Do not import root Vite config or vinext/Cloudflare/local-development plugins. Disable automatic public-directory copying; copy only public/favicon.svg and public/ocr recursively into output through an explicit allowlist. No arbitrary repo/server assets. Keep export dynamic chunks. |
| Same owner | EDIT `app/dashboard-client.tsx` | Add an optional DataRepository prop and demo flag defaulting to current web behavior. Memoize the fallback repository and use the supplied stable instance throughout existing load/save/import/recovery paths. Hide Copy dashboard link for the demo only. Do not change calculations, contract validation, sync/auth code, category work or existing web defaults. |
| Same owner | EDIT `app/household-lifecycle-panel.tsx` | Replace only the two Next Link elements/import with equivalent anchors to remove known runtime framework coupling. No transport/action redesign. |
| Same owner | NEW `tests/mobile-demo.test.mjs`, `mobile/playwright.config.ts`, `mobile/demo.spec.ts` | Focused repository/fixture tests and browser acceptance against the independent static bundle. Use an isolated temporary browser context and synthetic fixture only. Confirm Node runtime needed for direct TS imports before choosing command flags. Browser config launches static preview only, with no inherited local app server. |
| Manager only | EDIT `package.json`, `.gitignore` | After reviewing the owner's result, add build:mobile (`vite build --config mobile/vite.config.ts`) and preview:mobile (`vite preview --config mobile/vite.config.ts --host 127.0.0.1 --port 4179 --strictPort`); ignore mobile/dist and mobile test outputs. No dependency/lockfile edit. Reserve port 4179 or select an unused dedicated port before starting. |

No writes outside this list without a revised manager assignment. No `app/dashboard-platform.ts`, native project, Capacitor install, server/auth changes, environment files or lockfile changes in this slice. Adding HTML and React code is an implementation task, not part of this report-only review.

Acceptance gates for the implementation owner/manager (all currently pending):

1. Build the separate mobile config successfully; output contains root index.html, local JS/CSS chunks, favicon and OCR files, with no app server required. Review generated file inventory and dependency graph for server/auth/Cloudflare entry modules; review configuration for environment leakage without printing secret values. A string scan alone is insufficient proof of isolation.
2. Serve only mobile/dist on its dedicated origin. With all non-bundle requests rejected and recorded from before navigation, load Accounts, category controls, payment flow, Progress and My Account. Require zero `/api`, `/auth`, production-host or other external requests, including when profile and retry-like controls are used. Assert no sharing/login/logout/lifecycle controls appear. Local chunk/OCR/asset requests are allowed and must resolve; test browser OCR separately if claiming it works.
3. Change a category, record a synthetic payment, save a snapshot and reload. Verify stable IDs, saved edits and unchanged explicit Progress starting balance. Remove a synthetic debt and confirm baseline/history retention. Inspect browser storage in the isolated context: financial keys must be demo-scoped; no unscoped household/outbox keys. The existing navigation preference is allowed only on this separate origin.
4. Focused wrapper tests cover first-use seeding, existing saved state, damaged state, reset and checkpoint recovery, and v6 unknown-field round-trip. Use fabricated data. Browser tests cover real UI integration, not just the wrapper implementation.
5. Run lint/typecheck and relevant existing accounting/repository/lifecycle tests after integration, plus category/Progress web regressions in an isolated synthetic web test environment under manager coordination. Do not call `npm test` a short unit check: its script builds the web app first. Record exact commands/results; no prior 311/136 results count as this slice's validation. If existing tests require build output, report that dependency before running them.
6. Deliver a diff and reproducible build/preview/test commands. Desktop bundle success is the complete scope of this slice. Browser downloads/imports may be checked with fabricated files; native export/share, offline durability, Android Back/lifecycle, provider login, Android APK/device and iPhone checks remain pending.

### Continuation verification and handoff

Actually executed: read-only `git status --short`, `rg` source/path searches, targeted Get-Content reads, and dist/client directory listing. No app build, lint, typecheck, test suite, browser execution, native/provider/device test, install, account/cloud action, commit, push or deployment occurred. No secrets, private backups, database rows or real household payloads were read.

Only `docs/mobile/reports/01-architecture.md` was changed. No technical blocker found for assigning the standalone bundle; manager must reserve shared files and accept the narrowed scope. Original requirements remain unavailable and do not block a labelled synthetic demo. Next action: assign this exact slice to one implementation owner, then review its standalone browser evidence before Android packaging. Connected authentication and device prerequisites remain owned by the other reports and are not accepted by this architecture review.
