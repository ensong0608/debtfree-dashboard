# DebtFree — approved Light and Dark redesign handoff
Date: October 23, 2026 (Pacific)
Repository: ensong0608/debtfree-dashboard
Status: Sections 0–9 are implemented and the approved redesign was published on October 23, 2026 (Pacific), app source c2c200fe425737cb616aac3170eefefd677382e9, Worker c5b205d5-cd06-40ee-b164-393680dfedaa, successful release run 40037264277. Section 9 findings below remain the visual/physical-device limits. Earlier checkpoints describe historical verification state. Dependency remediation was explicitly deferred; see docs/PRIVATE_PRODUCTION_RELEASE_20261015.md for publication safeguards and results.

## Start here

Run one numbered section at a time, in order, with one focused agent. Select the recommended model in the model picker yourself; a prompt does not change the active model. Give a fresh agent this file and the section number. Do not depend on chat memory or image attachment order.

Starter prompt:

> Read AGENTS.md and docs/design/2026-10-23/DESIGN_HANDOFF.md on branch codex/theme-design-reference-20261023. Inspect my actual branch and dirty working tree without discarding changes. Open the named reference PNGs relevant to Section [NUMBER]. Perform only that section and its necessary focused checks. Preserve previously completed sections. Report changed files, reference comparisons, checks and unresolved items. Stop after this section. Do not commit, push, merge or deploy application changes unless I explicitly authorize that action.

The documentation branch is a transport for these references, not an instruction to replace a newer local application checkout. It starts from codex/navigation-schedule-20261022 at 908e788ffa7977ad64fde41c741157d0a34570f5. If the active checkout includes newer audit fixes, preserve them and bring over only docs/design/2026-10-23. Do not overwrite current app code with this branch. Main is not the production baseline.

## Reference images: authoritative mapping

All paths below are relative to this directory. Open the actual images before editing. The three PNGs are unmodified originals, stored once per unique image.

| Stable reference | File | Original attachment | Screen order, left to right |
| --- | --- | --- | --- |
| D-OVERVIEW | references/dark-overviews.png | image-gen-2(6).png; user's image 4 | Home; Debt; Progress Overview; Budget Overview |
| D-DETAIL | references/dark-progress-budget.png | DebtFree Dark Finance App Showcase.png; user's image 1 | Progress Trends; Progress Milestones; Budget Transactions; Budget Plan, to be named Schedule |
| L-DETAIL | references/light-progress-budget.png | image(20261023-084433).png; user's image 2 | The same four secondary screens in Light |

image(20261023-083839).png (image 3) and the later download.png are byte-for-byte duplicates of L-DETAIL. They are not light Home/Debt overview references. No separate light overview sheet was provided; derive its composition from D-OVERVIEW and its light colors from L-DETAIL.

| File | SHA-256 |
| --- | --- |
| dark-overviews.png | 26698772364c25649581674d1e2be599d39ba63b00accda51345aaeed9ccb68d |
| dark-progress-budget.png | 0153a84378ccff12bacf72c6d97163388a3c863df3e167d39f71d29735e78d18 |
| light-progress-budget.png | 427dd83c24de114e3356495850c3f4e84bf9062bbbdc640329b8e1357b6f5b68 |

![Dark main screens](references/dark-overviews.png)

![Dark secondary screens](references/dark-progress-budget.png)

![Light secondary screens](references/light-progress-budget.png)

## Approved design contract

- Reproduce the reference composition as closely as practical: hierarchy, card shapes, spacing, density, segmented controls, progress bars/rings, chart treatment, icon tiles, gradients and bottom navigation. Rebuild as working UI; do not embed screenshots as interface backgrounds.
- D-OVERVIEW is the primary Dark style authority. Carry its purple/cyan accents into the D-DETAIL layouts, whose stronger blue accents are secondary. Light uses L-DETAIL's white/pale-blue surfaces and blue accents. Preserve semantic green/cyan, amber and red where appropriate.
- Keep the five current bottom destinations: Home, Debt, Progress, Budget, Settings. Settings stays in its current position. Fit five items even though the references show four.
- Replace the Home bell with an accessible account/avatar button opening the existing Account settings destination. Notification preferences belong inside Settings, not a header bell.
- Progress: Overview / Trends / Milestones. Budget: Overview / Transactions / Schedule. “Plan” and “Payoff Plan” in the mockups become “Schedule” and “Payoff Schedule.” No Payoff Calculator navigation.
- Home and Budget must open the same existing full Payoff Schedule. Retain its current data, controls, math, rows and behavior, then restyle it. No competing repayment plan.
- Settings > Appearance > Themes contains Light and Dark. Light is the default. Apply the choice immediately, persist it for that browser/device, and restore it on reload; no household sync, forced OS-theme matching, or automatic scheduling. Make selection reversible with a clear selected state. Preserve font/text-size preferences; use Helvetica with existing fallbacks.
- Existing controls not pictured remain accessible in matching styling: snapshots, debt grouping/reordering, all debt types, balance updates/payments, activity history, editing, account/household tools, and the three Budget entry actions.
- Reference figures, dates, account names, merchant examples, achievements and encouraging claims are examples only. Render actual recorded/derived application data with truthful labels and useful empty states.
- Never describe balance reduction as confirmed payments/principal paid. Preserve the first saved Progress baseline, timestamps, removed-account treatment, reconciliation anchors, archived history and snapshot revisions.
- Preserve current forecast scopes, payment pool/minimum rules, mortgage/car/escrow separation and Budget overlap prevention. A style change must not roll back recent financial audit fixes.
- Do not copy phone hardware frames, status bars, screenshot dimensions, fake data, bank credentials, or decorative controls without behavior.
- Maintain readable labels, keyboard focus, touch targets, reduced motion, larger text, responsive scrolling, safe-area spacing and accessible chart alternatives. Do not copy tiny screenshot text at unreadable sizes.
- Scope is the current web/PWA application. Do not resume the native pilot, change authentication, migrate D1 to Supabase, provision resources, or enable public registration.

## Preliminary backend/data support review

This was a read-only review of the remote source pinned above, not a live production database inspection or current-device verification. A newer local branch may contain additional support. Reconfirm only relevant differences in Section 0.

| Mockup feature | Source evidence | Supported scope / remaining work |
| --- | --- | --- |
| Shared financial data | db/schema.ts; app/household-api.ts; app/dashboard-data.ts | D1 stores a revision-protected household payload. Accounts, transactions, adjustments, snapshots and monthly plans already exist. Preserve authorization, validation and optimistic concurrency; the redesign alone needs no new database. |
| Light/Dark selection | app/appearance.ts; app/appearance-settings.tsx | Device-local preferences and font/size controls exist. Current validation deliberately rejects dark surfaces, and application is limited to the mobile shell. True Dark needs semantic token coverage, compatibility handling and application across desktop and overlays/portals. Changing a few colors is insufficient. |
| Balance trend / monthly change | app/actual-progress-page.tsx; app/progress-balances.ts; app/debt-transactions.ts | Saved snapshots and dated ledger/adjustment records provide evidence. Sparse history cannot justify smooth invented monthly observations. Show gaps or recorded points and distinguish live balances from dated snapshots. |
| Milestones | app/progress-report.ts; app/debt-presentation.ts | Existing helpers model achieved/projected/pending milestones, but the active Progress page uses buildActualProgress. Do not reconnect a legacy helper with different baselines, scopes or clamped reductions. Some thresholds/date labels in the mockups differ from current support. Derive only evidenced achievements; do not backfill dates. |
| Category progress | account types, display groups and monthlyPlan.loanTrackers; app/loan-progress.ts | Existing records can drive bars/rings. Accounts and house/car have different baselines; reconcile scope and denominator. Missing baseline means unavailable, not 0% or an invented original amount. |
| Recent updates | transactions, balanceAdjustments, archive history and revision metadata | Show only supported recorded financial events, with their actual timestamps. No complete general activity feed was established. household_state.updated_at is not a history of individual events. |
| Budget overview/categories | monthlyBudgets; monthlyPlan.months; app/monthly-plan.ts; app/monthly-plan-page.tsx | Planned spending and some recorded spending/settlements exist. Detailed tracking is optional. Never label planned allocations as actual “Spent,” or missing tracking as proof of zero spending. Category actuals need correct ledger/settlement matching and deduplication. |
| “Spent less than last month” | dated transactions and monthly settlements | Conditional on sufficiently comparable tracked periods. Not established for all households; omit the claim when coverage is unknown. Do not implement an arbitrary completeness policy during styling. |
| “Faster payoff” / on-track status | app/progress-report.ts; app/payoff-schedule.ts; saved projectedDebtFreeMonth | Requires a valid explicit comparison forecast and identical scopes/assumptions. A previous snapshot forecast comparison is not automatically a minimum-only comparison. Missing or stalled forecasts cannot produce a success claim. |
| Budget transaction history | LedgerTransaction; BalanceAdjustment; app/debt-transactions.ts | Existing financial history can be presented under Budget. Keep recorded payments and balance adjustments distinguishable; preserve correction/deletion/history behavior and all scopes. This is not automatic bank-import data. |
| Institution logos | No explicit institution/logo field found in inspected account/loan types; existing UI uses OutlineIcon | Add a small local catalog and optional explicit institution choice only after checking normalization, edits, imports/exports and old clients. Unknown/unsupported institutions use generic icons. No bank connection is implied. |
| User notifications | worker/household-notifications.ts; inspected Settings; mobile/native/notifications.ts exists separately | Worker's notification hub broadcasts household revisions for sync, not user alerts. No complete web user-notification preference/delivery system was established. Inspect only relevant remaining code; do not expose inert enabled switches or request OS permission just to match the mockup. |

No source finding guarantees that a particular household has the required historical records. Do not retrieve or publish private financial payloads to fill this guide.

### Section 0 completed — October 23, 2026 (Pacific)

This addendum supersedes the preliminary source baseline where noted. This was a read-only source/support gate, not an implementation or a live financial-data inspection. No application files, Git branches, production configuration or private records were changed. No automated tests were run.

**Source and preservation.** The GitHub connector reports `codex/production-release-20261015` at `4286827771925422ea71a125ee286467981b0abc`, a documentation follow-up to audited application source `d3434a68be7c8da57f27cc0ad43c48dc3fb9b97b`. Its AGENTS.md and release notes record the integrated audit release. The navigation branch remains at the handoff's older `908e788` baseline; do not use that baseline to replace current application files. The inspected current source is `/workspace/scratch/7c4611b9975c/debtfree-dashboard`. Its relevant source files were compared by Git blob hashes with the pinned current remote, rather than inferred from release notes alone.

**Working-tree limitation.** That current source directory has an orphaned `.git` worktree pointer to an unavailable parent repository, so its active branch and full dirty state cannot be established through Git. Do not repair/reset it or claim it is clean. Two older local section checkouts under `/workspace/scratch/3bac2e8e63a4/debtfree-dashboard` and `/workspace/scratch/d338419d058b/debtfree-dashboard` are on `codex/navigation-schedule-20261022` at `908e788` and retain uncommitted audit work. They and the reference-only checkouts were left untouched. Before Section 1 mutations, establish a valid isolated working checkout of the current audited source and compare any additional local work; do not replay those older sections wholesale. This is a local checkout precondition, not a backend product blocker. The user's Windows branch cannot be inspected from this environment.

**Relevant newer audit differences to preserve.** The active path now uses `buildActivePayoffCommitment` in `app/payoff-commitment.ts`, `buildConfiguredPayoffSchedule` in `app/payoff-schedule.ts`, and `scheduleExtra`/`scheduleView` in `app/schedule-view.ts`. `payoffExtraPayment`, `payoffExcludedTypes` and `payoffPlanStrategy` exist. The configured forecast starts next month, supplies first-payment suggestions, reserves excluded minimum obligations, separates escrow, and avoids linked-loan Budget duplication. `monthlyBudgetCommitment` and `capturePayoffCommitment` retain historical month commitments. Reuse these paths instead of the older `buildPayoffSchedule`/total-pool wiring. Preserve the newer explicit scope and increase/decrease labels, household-calendar defaults, dirty-form exits, revision/conflict recovery and accessible recurring due-day labels.

| Feature / status | Saved source and active calculation | Scope and historical limits | Smallest implementation / new persisted fields |
| --- | --- | --- | --- |
| Light/Dark — supported with infrastructure work | `app/appearance.ts`: `APPEARANCE_KEY`, version-1 font/size/custom colors, `appearanceError`, parsing/save/reset. `useAppearanceSettings` in `app/appearance-settings.tsx` still applies only to mobile roots and rejects dark surfaces. | Existing local storage and storage-event handling are reusable; desktop, portals, hydration and semantic colors remain implementation work. Save/Cancel currently distinguishes preview from saved preferences. | Section 1 extends this device preference with explicit theme/version compatibility and shared tokens; Section 2 adds the selector. A device-local theme field is needed; no household field/table. Preserve saved font/size and handle old custom colors deliberately. |
| Account entry — already supported | `app/dashboard-client.tsx`: mobile `toggleAccount` and avatar, desktop Account button, existing `profile` destination. | The active header already has Account rather than a bell. Legacy `HomeExperience` also contains an avatar but is not sufficient evidence of the active Home route. | Restyle/reuse the active entry and preserve its return behavior. No new field and no duplicate Account route. |
| Progress baseline/category progress — supported | `buildActualProgress` in `app/debt-activity.ts` reads `monthlyPlan.progressStartingBalance`, accounts/baselines, transactions, adjustments, snapshots/revisions and `removedProgressAccounts`. `loanProgress` reads original/remaining loan amounts. | Cards/other and house/car have distinct evidence and denominators. Fixed starting total takes precedence; removed balances remain retained. Negative net reductions are available. Missing account baselines prevent reliable comparisons. Loan percentage presentation clamps while its reduction remains signed. | Section 6A wraps the current model with explicit scope/availability. Use truthful increases and unavailable states; no replacement baseline, fabricated start date or persisted field. |
| Trends/monthly changes — conditional | `buildActualProgress` exposes saved snapshot points and current-month `paymentActivity` differences; `recentDebtMonths` uses the household calendar. Loan history has balance date and `recordedAt`. | Snapshot `month`, `capturedAt` and revision times mean different things. Nonadjacent saved points are not complete monthly observations. Current balance is live, not another historical snapshot. Ledger net movement is not confirmed payments. | Filter recorded observations and retain gaps; derive only evidenced net movement. No new fields, interpolated actuals or backfilled history. |
| Milestones/achieved dates — conditional; adapter required | Legacy `buildProgressReport` in `app/progress-report.ts` defines first payment, $1,000 reduction, first debt, 25/50/75%, debt-free and projected/pending states. Active Progress instead uses `buildActualProgress`. Payment activity has dates; snapshots/revisions and loan history provide dated observations. | The legacy helper clamps reductions and uses different baseline/scope semantics; do not wire it directly into the active page. A threshold observed at a snapshot establishes first recorded evidence, not the exact crossing date. Live completion alone does not establish a historical achieved date. | Section 6A retains existing thresholds, adapts evidence to the active baseline/scope, and distinguishes achieved/observed/projected/pending. Omit unavailable dates. No milestone table/field needed for derived states. |
| Budget allocations and tracked category actuals — supported/conditional | `monthlyBudgets[month]`, `monthlyPlan.months[month]` and `detailedSpendingTracking`. `calculateMonthlyPlan`, `actualHouseholdSpending`, `spentForPlannedItem`, `settlementReports`; active `MonthlyPlanPage` builds ledger plus settlement reporting rows. | Planned categories are available without detailed tracking. Partial records and a disabled tracker do not establish actual zero spending. Reporting settlements must never enter the debt ledger; payment/adjustment/linked-entry semantics must be preserved. | Section 7A supplies planned allocation selectors and optional recorded actuals with ledger/settlement matching and deduplication. Keep Planned labels by default, all three entry actions, and current commitment logic. No new persisted field. |
| Month comparisons / spending savings claim — conditional, default omit | Dated ledger records and monthly settlements exist; no persisted tracking-coverage/completeness marker was established in the relevant contracts. | Two months with entries are not necessarily comparable complete periods; do not compare partial current month to a full prior month as a proven saving. | Omit “spent less” percentages unless existing evidence establishes comparable coverage. No invented completeness policy or schema addition during redesign. |
| Recent updates / Budget Transactions — supported for recorded financial events | `paymentActivity` in `app/payments.ts` maps transactions/adjustments with stable IDs, event dates, creation times and kinds. `changeDebtEntry` in `app/debt-transactions.ts` retains correction/deletion/restoration history. Account archive events and loan history are additional limited sources. | These are manually recorded/derived financial events, not a bank import or complete activity log. Event date is distinct from entry creation/update time. Household revision/updated_at is not an event feed; old records may not identify an exact action time. | Build a bounded financial-events adapter and reuse existing handlers/scopes. Keep payments versus credits/adjustments and linked differences distinct; do not total mixed activity as spending. No new feed/table or timestamp field. |
| Faster payoff / success claims — conditional; default omit unsupported comparison | Active configured Schedule and saved snapshot `projectedDebtFreeMonth`; legacy `buildProgressReport` compares snapshot payoff dates and minimum-only interest with separate semantics. | A snapshot date alone does not preserve identical scope, balances, forecast origin and assumptions. Missing/stalled forecasts cannot prove improvement. “Earlier than prior forecast” is distinct from “faster than minimums.” | Use the canonical active forecast and show its real status. Only add a comparison after Section 6A establishes a compatible explicit baseline; otherwise omit. No new persisted field for this redesign. |
| Institution icons — generic supported; official logos conditional | No explicit institution key/catalog in relevant account/loan types, editors or validators. `migrateAccount` spreads existing fields; payload validation returns validated records, and `parseHouseholdWriteJson`/`serializeDashboardBackup` feed revision-guarded D1 writes. `data-transfer.ts` imports/merges whole records. Account edits spread stored records but reconstruct draft fields; loan edits spread their candidates. | This establishes an additive metadata path in current source, not a validated institution contract or proof for every older client. Unknown-field preservation does not validate arbitrary keys/assets. No logo provenance/usage approval was established by Section 0. | Section 3 adds optional bounded catalog-key metadata to account/loan types, validators and explicit drafts/save paths, then focused legacy/import/export/round-trip checks. No table migration expected. Generic icons ship where official assets/terms cannot be established; no automatic name assignment or remote logo lookup. |
| Web notification preferences — deferred | `HouseholdNotificationHub` in `worker/household-notifications.ts` emits only `revision-changed`; the inspected socket/ticket routes are isolated native-test paths in `worker/mobile-test.ts`. No web alert preference/delivery path was found in relevant app/worker/public source. | Sync broadcasts and the separate native pilot do not provide user alerts, browser push subscription, delivery preferences or notification history for this web app. | Keep any useful truthful deferred notification explanation under Settings. No enabled inert toggles or permission prompt. A real alert feature would need separately approved channels, triggers, preferences and delivery infrastructure; no notification fields/resources are added here. |

**Persistence evidence and compatibility limits.** The relevant current contract path is `migrateAccount` / `validateAccount` / `validateMonthlyPlan` / `validateDashboardPayloadFields` -> `parseDashboardContract` -> `serializeDashboardBackup`; household writes pass through `createHouseholdApi.PUT` with session/role checks and an expected revision. Local backups use `app/data-repository.ts`; import preview/merge uses `app/data-transfer.ts`. Existing metadata is generally preserved by record spreads, but an optional institution key still needs explicit validation and create/edit coverage. This source review does not claim a tested round trip, deployed old-client interoperability or household-specific historical availability.

**Decisions and limits.** No new product decision blocks Section 1. Real notification delivery and unsupported comparison claims remain deferred under the approved contract. Official institution marks require documented source/terms in Section 3; the approved generic fallback avoids blocking UI work. Exact historical milestone dates cannot be recovered where no evidence exists. No new database, cloud resource, schema migration, financial formula or public-registration change is required by this gate.

**Checks actually performed.** Extracted the supplied ZIP; read its handoff, current AGENTS.md and relevant local/release instructions; inspected existing checkout branch/status where Git worked; checked current remote branch heads through GitHub; compared relevant current source blob hashes; reviewed only targeted source differences and unresolved support paths; checked all three PNG SHA-256 values against the handoff. No images were regenerated, encoded into chat or uploaded to GitHub. No automated tests, build, browser/device checks or live database requests were run. Existing release test totals above are historical evidence, not checks repeated here.

**Next boundary.** Stop after Section 0. Next is **Section 1 — Semantic Light/Dark foundation**, recommended **GPT 6.1 Sol / High**. First satisfy the valid-checkout precondition above, then extend shared theme infrastructure only. Do not start Section 2 until Section 1 is complete; Section 2's recommendation is GPT 6 Luna / High. Model selection remains manual.

### Section 1 completed — October 23, 2026 (Pacific)

**Checkout and preservation.** Work is isolated at `/workspace/scratch/00524890527f/debtfree-dashboard`, branch `local/semantic-themes-section1-20261023`, based on `4286827771925422ea71a125ee286467981b0abc`. A valid independent Git repository was created and the audited commit fetched before implementation. Every tracked file in the orphaned `/workspace/scratch/7c4611b9975c/debtfree-dashboard` source matched this baseline byte-for-byte; its extra files were generated verification artifacts and `next-env.d.ts`, not newer application work. That source and both older dirty section checkouts were left untouched. No older audit work was replayed. The supplied ZIP lacked the completed Section 0 addendum; the existing completed workspace handoff supplied it. References were reused locally, without regeneration, encoding into messages, or uploading. Keep these reference images local and exclude them from staging/publication under the current Section 1 instructions.

**Implemented contract.** `Appearance` now has `version: 2` and explicit `theme: 'light' | 'dark'`. `THEMES`, `withTheme`, and `appearanceTokens` provide the shared contract for Section 2. Light defaults follow L-DETAIL's white/pale-blue/blue palette; Dark follows D-OVERVIEW's deep surfaces, cyan foreground accents and purple filled controls. Semantic roles cover surfaces, raised panels, borders, controls, foregrounds, focus, selection, disabled/error states, success/warning/danger/info/violet panels and fills, chart series/grid/tracks, gradients, overlays, shadows, illustration layers and typography. Current layouts, controls, financial logic and data contracts were retained. Existing chart alternatives remain in place.

`AppearanceProvider` mounts once in the web root layout and applies tokens to `document.documentElement`, including `color-scheme`; desktop, responsive shells, dynamically mounted dialogs and body portals inherit them. It replaces the mobile-only hook and DOM observer. Existing custom preview events remain supported, and real same-origin localStorage events update other tabs, including reset/removal. Unrelated/session-storage events are ignored. Preferences remain outside financial payloads, backups, outboxes and household sync.

**Saved-preference compatibility.** The original `debtfree-device-appearance-v1` key is retained. Reading never writes, removes or migrates stored bytes. Readable v1 custom colors become an in-memory v2 Light preference; valid font and size choices survive. The original four colors also remain in `legacyColors`, retained by `withTheme` and serialization after an explicit save. Selecting a built-in theme intentionally applies its palette; legacy colors remain available to restore rather than being silently lost. Invalid v1 colors fall back to the Light palette while keeping valid typography; damaged/unknown v2 records fall back to defaults. Corrupt originals stay in storage until the user explicitly saves or resets. New/reset preferences use Light, Helvetica with existing fallbacks, and standard size. The existing editor retains its Save/Cancel/Reset behavior and legacy presets pending Section 2; its Mint button no longer incorrectly claims to be the new default.

Validation requires six-digit hex colors, a supported theme/font/size, matching light/dark surfaces and at least 4.5:1 primary text/accent contrast. Derived secondary surfaces preserve valid foreground contrast, semantic foregrounds fall back safely for custom palettes, and solid fills have separate readable labels. Chart marks target at least 3:1 against their surface. Font/size tokens apply throughout current CSS without changing layout dimensions. Existing progress-dependent ring colors remain; their tracks and labels now inherit the theme.

**Initial rendering and limitations.** SSR and the initial hydration tree deterministically use Light. A client layout effect reads the device preference and applies it before the hydrated paint, without an inline bootstrap script, CSP relaxation, hiding the app or hydration suppression. An early server-rendered Light frame can still appear before JavaScript/hydration when Dark is saved; no zero-flash claim is made. Denied storage falls back to usable Light; save/reset failures remain visible through the existing editor. No OS matching or theme scheduling was introduced. Physical Android/PWA keyboard, native packaging, safe areas and Android Back were not verified. This is representative foundation acceptance, not a complete screen-by-screen or all-custom-palette visual audit. Detailed UI composition, selector cards, notification/account entry work and financial adapters remain for their assigned sections.

**Changed files.**

- Contract/application: `app/appearance.ts`, `app/appearance-provider.tsx` (new), `app/theme.css` (new), `app/layout.tsx`, `app/appearance-settings.tsx`, `app/dashboard-client.tsx`.
- Shared/current component styles, with geometry retained: `app/globals.css`, `app/design-system.css`, `app/reference-layout.css`, `app/mobile-layout.module.css`, `app/debt-experience.module.css`, `app/payoff-home.module.css`, `app/payments-mobile.module.css`, `app/quick-payoff-calculator.module.css`, `app/appearance-settings.module.css`, `app/household-currency-settings.module.css`, `app/action-confirmation.module.css`, `app/info-tooltip.module.css`.
- Presentation colors only: `app/actual-progress-page.tsx`, `app/card-progress-chart.tsx`, `app/debt-presentation.ts`, `app/debt-progress-ring.tsx`, `app/debt-experience.tsx`, `app/payoff-landscape.tsx`. No financial calculations or persisted fields changed.
- Focused verification: `tests/appearance.test.mjs`, `tests/browser/theme-foundation.spec.ts` (new). This existing checkpoint is the only documentation updated; the three supplied reference PNGs remain unchanged.

**Checks actually performed.**

- `node --test tests/appearance.test.mjs`: six focused cases passed. Covers defaults/corruption, v1 preservation, identity and semantic contrast (including custom Light/Dark palettes), injection/invalid values, explicit save/reload/reset isolation and storage failures.
- `tsc --noEmit --incremental false`: passed. ESLint on the changed TS/TSX and named test files: passed with no warnings. `git diff --check`: passed.
- `tests/browser/theme-foundation.spec.ts` on local synthetic guest data only: four checks passed across desktop (1440 × 1000) and phone (390 × 844). The shell/dialog case in each viewport covers both themes, Dark reload, genuine two-tab updates and reset, inherited portal colors, font/size preview, contrast checks and unchanged financial payloads. The other two checks cover denied appearance-storage reads. After the final illustration/navigation color correction, only the two affected shell/dialog cases were rerun; both passed. Earlier storage-failure results were reused.
- Inspected screenshots of both shells and minimum-payment dialogs in both themes. Shell and dialog Axe color-contrast rules passed. Static CSS parses, semantic references resolve, and the SSR default palettes match runtime tokens. Screenshots are local ignored artifacts under `outputs/section1-theme/`.
- Browser tooling initially lacked Chromium and the standard Playwright browser download returned an invalid archive. A scratch-only Chromium binary from the npm-distributed package enabled verification with a temporary local launcher/config; no dependency manifest or browser configuration changes are part of the application diff. Development-only vinext renderer/optimization warnings were observed; browser page errors were absent in the checked flows. No build, full suite, sync suite, native build or production probe ran.

**Authorization and next boundary.** All changes are uncommitted and local. No push, merge, deployment, production-data action, schema change or resource provisioning occurred. Stop after Section 1. Next: **Section 2 — Settings, Themes and account entry**, recommended **GPT 6 Luna / High**. Model selection is manual. Start from this isolated checkout and preserve its uncommitted work; use `THEMES`/`withTheme` and the existing preview/save events rather than creating another preference store. Reconcile the selector's immediate persistence with the remaining editor's Save/Cancel semantics as specified in Section 2.

### Section 2 implementation checkpoint — October 23, 2026 (Pacific)

**Implemented locally.** `AppearanceSettings` now presents Light and Dark preview cards as an accessible pressed-state group. The saved theme applies immediately through Section 1's existing storage key and appearance event/provider; default/reset remains Light. Font, size and custom-color editing remain available. Old custom color metadata stays preserved and can be previewed again. Theme selection reads the latest saved preference and writes only theme identity/palette while preserving saved typography and legacy metadata. Unsaved editor fields remain drafts; Save applies only fields changed since the most recent saved baseline, preserving newer values from another tab, and Cancel reloads the current saved preference without undoing an already-saved theme. Cross-tab storage changes update the selected card and safely rebase clean draft fields. Storage failures show an error, never a success message. Preferences remain device-local. Settings contains only a concise notice that notification preferences are not available yet; no notification switches or permission requests were added.

The existing header Account/avatar entry was retained. Its desktop action now uses the same remembered return destination as mobile. Account, household, import/export, recovery and the five bottom navigation destinations remain in place. The Section 1 reference images were opened and reused as design guidance; no reference image was modified or copied.

**Changed for Section 2.** `app/appearance-settings.tsx`, `app/appearance-settings.module.css`, `app/dashboard-client.tsx`, and new `tests/browser/section2-settings.spec.ts`. This work adds no financial fields, sync behavior, backend changes or notification delivery. All Section 1 changes remain uncommitted and untouched.

**Checks actually performed.** Focused ESLint on the two changed TSX files and new browser spec passed. `tsc --noEmit --incremental false` and `git diff --check` passed. Section 1 appearance unit checks were not rerun. The focused browser spec was attempted on desktop and phone but did not execute application flows: this execution environment isolates network namespaces across tool processes, the recorded dev-server lock referred to an absent PID, and the reachable server could not be exposed to Playwright on the allowed loopback ports. The default Playwright Chromium was missing; a temporary workspace Chromium binary was extracted, but the server/browser connection limitation remained. No screenshots or UI assertions from Section 2 are claimed. No full suite, build, synchronization checks or production probe ran.

**Next boundary.** Section 2 implementation stops here. Theme behavior is covered by the new focused browser spec but still needs a successful run when a reachable local server/browser is available. Next: **Section 3 — Institution icons and compatibility**, recommended **GPT 6.1 Sol / Medium**. Model choice remains manual. Do not start Section 3 in this checkpoint.

### Section 3 implementation checkpoint — October 23, 2026 (Pacific)

**Implemented locally.** Added `app/institutions.ts` with permanent bounded keys `chase`, `citi`, and `other`; `institutionKey` is optional on debt accounts and loan trackers. The catalog is deliberately limited to owner-provided institution examples. A shared `InstitutionIcon` uses existing OutlineIcon card/home/car/money fallbacks on neutral semantic-theme tiles, with accessible institution/type names. It is used in the unified debt list, loan cards and account-linked calculated-balance rows. Merchant/category rows retain their own identity. No name matching, automatic assignment, renaming, record rewrite, external request or bank connection was added.

`InstitutionPicker` offers Not selected, Chase, Citi and Other in account creation/general editing, CreditCardInfo and loan creation/editing. Selection remains a draft until the existing Save action, participates in card conflict detection and existing dirty/discard behavior, and can be cleared. Switching a new-account form into a mortgage/car form carries the explicitly selected institution. Viewer fieldsets remain disabled.

**Compatibility evidence.** Inspected `migrateAccount`, account/loan validators, `saveAccount`, `saveCreditCardDetails`, LoanDetailsFields/LoanProgressPanel normalization/save, `previewDashboardImport`/`resolveDashboardImport`, `createBrowserDataRepository`, `serializeDashboardBackup` and `parseHouseholdWriteJson`. Record spreads and existing JSON persistence retain the optional key; absent keys stay absent after serialization. Shared write/import validation and direct editor checks reject invalid keys, oversized strings, URLs, SVG/HTML and non-string institution values. No schema/version migration or financial formula changes. Snapshots and transaction metadata are not extended. Existing unknown-field preservation is retained. This verifies the current contract with synthetic records; it does not certify every deployed older client. Older clients that reconstruct drafts may retain metadata but cannot offer this picker; no old-client deployment was tested.

**Assets and reference comparison.** Opened the existing D-OVERVIEW PNG. The shared tiles supply the icon placement foundation for later screen sections, without restyling those screens now. No official logo assets with documented source and suitable terms are supplied. Chase and Citi logos remain deferred; all catalog choices and unsupported/unidentified institutions deliberately render generic type icons. No imitation trademarks, external logo URLs, raw SVG or HTML are stored by this feature. A future logo addition requires official asset provenance and usage terms documented here before bundling it. No reference image was changed or uploaded.

**Changed for Section 3.** New: `app/institutions.ts`, `app/institution-icon.tsx`, `app/institution-icon.module.css`, `app/institution-picker.tsx`, `tests/institutions.test.mjs`, `tests/browser/section3-institutions.spec.ts`. Modified: `app/dashboard-data.ts`, `app/dashboard-client.tsx`, `app/credit-card-editor.ts`, `app/credit-card-info.tsx`, `app/loan-progress.ts`, `app/loan-entry.ts`, `app/loan-details-fields.tsx`, `app/loan-progress-panel.tsx`, `app/debt-experience.tsx`, and this existing checkpoint. Section 1/2 changes remain intact and uncommitted.

**Checks actually performed.** Five institution cases passed: catalog/fallbacks; legacy name/no assignment; explicit card edit/clear/save/reload plus loan metadata import/export and merge/replace; account/loan invalid-key validation; stale card metadata conflicts. Full synthetic payload comparisons confirm IDs, balances, histories, transactions and snapshots are unchanged after removing only the newly selected metadata. The first fixture comparison detected the import merger's existing empty removedProgressAccounts default; the synthetic fixture was adjusted to include that existing default, with no application merge change. The four existing credit-card editor tests and 17 existing dashboard contract tests passed. Only affected tests were run; no full suite, auth/sync suite, deployment or production probe.

Focused ESLint on all Section 3 TS/TSX/test files, TypeScript (`tsc --noEmit --incremental false`) and `git diff --check` passed. The new browser spec covers explicit account/loan selection, Save/reload, unchanged financial records and Light/Dark tiles, but could not run application assertions: vinext startup failed on a restricted `uv_interface_addresses` call, and retrying with its existing inspector-disable environment option encountered an inaccessible/stale dev-server lock. No successful browser interaction, screenshot comparison or physical-device check is claimed for this section. Temporary test configuration was removed; no app/tooling dependencies were changed.

**Next boundary.** Stop after Section 3. Next is **Section 4 — Home**, recommended **GPT 6 Luna / High**. Start from `/workspace/scratch/00524890527f/debtfree-dashboard`, branch `local/semantic-themes-section1-20261023`, preserving all uncommitted Section 1–3 changes. Model selection remains manual. Section 4 is not started. No commit, push, merge or deployment is authorized by this implementation request.

## Institution icon approach

Use a shared local InstitutionIcon component and stable catalog keys. Prefer genuine official assets with recorded provenance and suitable usage terms; do not redraw or generate imitation bank trademarks. Start with institutions confirmed by existing configured account choices or owner-provided examples, including Chase as the reference example. Do not create an exhaustive bank catalog.

An optional institution picker can offer known institutions and Other. Existing accounts keep generic type icons unless a reliable existing identifier or explicit user choice supplies the institution. A name match may suggest a choice, but must not silently persist one or rename accounts. Institution selection is presentation metadata, not account linking.

Fallbacks: credit card, bank/personal loan, house, car, student loan and other. A merchant/category icon in Transactions must not be mistaken for the card issuer. Use a neutral tile to keep genuine logos readable in both themes without recoloring the marks. Missing assets must fall back cleanly. Avoid remote logo lookups that transmit account names or introduce paid services.

If actual asset licensing/source cannot be established, ship the generic icon path and report which official logos remain deferred. If selection needs additive payload fields, have Sol handle the compatibility change; Luna can style the picker/component after that contract is fixed.

## Model assignments and working rules

These are workload recommendations, not guaranteed success rates or automatic model switches. Luna High is preferred for bounded UI work after the shared contracts are established. Use Sol for coordinated persistence, financial selectors and theme infrastructure.

Official model guidance checked October 23, 2026:
- https://learn.chatgpt.com/docs/models
- https://developers.openai.com/api/docs/models/gpt-6-luna

| Section | Model / effort | Dependency |
| --- | --- | --- |
| 0. Confirm source and data support | GPT 6.1 Sol — Medium | First |
| 1. Shared theme foundation | GPT 6.1 Sol — High | 0 |
| 2. Settings / theme selector / account entry | GPT 6 Luna — High | 1; supported notification behavior from 0 |
| 3. Institution icon contract and metadata | GPT 6.1 Sol — Medium | 0–1 |
| 4. Home | GPT 6 Luna — High | 1–3; use existing approved selectors |
| 5. Debt and forms | GPT 6 Luna — High | 1–3 |
| 6A. Progress selectors and milestone evidence | GPT 6.1 Sol — Medium | 0–1 |
| 6B. Progress UI | GPT 6 Luna — High | 6A |
| 7A. Budget navigation and data integration | GPT 6.1 Sol — Medium | 0–1; shared Schedule contract |
| 7B. Budget UI | GPT 6 Luna — High | 7A; 3 |
| 8. Full Payoff Schedule styling | GPT 6 Luna — High | 1; 7A |
| 9. Integration and focused acceptance | GPT 6.1 Sol — High | All implementation sections |

For a Luna section, stop and identify the needed Sol subtask if the work requires new financial formulas, data migration, sync/auth changes or unresolved persistence semantics. Do not spend repeated attempts on an expanding task. No Astra is planned; consider it only for a specific unresolved architectural/data-integrity blocker.

Global instructions for every implementation section:
1. Read applicable AGENTS.md, relevant current release/local setup instructions and only needed source files. Inspect branch and dirty state; preserve user work. State intended outcome, model recommendation, boundaries and completion criteria.
2. Open the exact reference images. State which reference and phone panel you are following. If an image is unavailable, stop that visual section and identify the missing path; do not substitute memory or another screenshot.
3. Reuse shared components and semantic theme tokens. Avoid accumulating screen-specific overrides or changing unrelated screens.
4. Work locally, sequentially. This handoff authorizes no application commit/push/merge/deployment, production data mutation, remote migration, paid service or public-launch change.
5. Run only directly relevant checks allowed by the user's current instructions. The user requests focused checks and no full suite. Read the actual local testing rule: if a newer applicable rule requires explicit test approval, present the proposed focused checks at implementation completion and await approval; do not claim tested acceptance before approval/checks.
6. Do not run npm test, npm run validate, blanket tests/*.test.mjs, all Playwright projects, broad synchronization suites, APK/store builds or recovery drills for a styling section. npm test includes a build in the inspected repo. Reuse passing results for unchanged code; rerun only affected/failed checks.
7. Use synthetic fixtures for verification. Never seed/reset/import production or log private payloads. Add regression tests only when they protect meaningful new behavior, not wording or mirrored CSS.
8. Review the diff and whitespace. Report completed behavior, files, checks actually run, unresolved constraints and deliberate visual differences. Do not start the next section automatically.

## Section 0 — Source and feature support gate
Model: GPT 6.1 Sol / Medium. Read-only/planning only.

Confirm the actual active source and whether newer audit fixes exist beyond the pinned remote branch. Preserve those fixes. Read the existing preliminary support matrix above and verify its unresolved points against relevant current files.

For each mockup-only feature, report: saved fields/source, active calculation, available scope, known historical limitations, smallest implementation, and whether any new persisted field is needed. Pay particular attention to milestone achieved dates, Progress baselines, actual versus planned Budget categories, month comparisons, recent activity, valid faster-payoff comparisons, institution metadata, and real web notification capabilities.

Inspect relevant backend validation and persistence paths as well as frontend types; a TypeScript index signature alone does not establish round-trip support. Do not query live private data just to establish schema capabilities. No new tables, cloud resources, policy, financial formulas or migrations in this section.

Update only the support notes in this handoff if needed. Identify blocked product decisions precisely. Completion: a source-backed supported/conditional/deferred list with file/function evidence. No automated tests for this read-only gate.

## Section 1 — Semantic Light/Dark foundation
Model: GPT 6.1 Sol / High.

Build a shared theme contract that covers the current web app, desktop, responsive shell, overlays/portals, forms, tables, focus, disabled/error states, tooltips, charts and navigation. Use D-OVERVIEW and L-DETAIL. D-DETAIL supplies the secondary-screen composition.

Extend the existing appearance implementation rather than building a parallel preference system. Resolve the current light-only validator and hardcoded dark text/surfaces through semantic tokens, not simply by deleting contrast checks. Account for the current hook being mobile-only. Preserve readable semantic panels and chart series in both themes.

Define explicit Light/Dark identity, version/default/fallback handling and compatibility for saved v1 custom appearance, font and size settings. Do not silently destroy existing preferences; document the migration behavior. New/reset preferences default to Light. Keep preferences out of household payloads and outboxes.

Cover initial rendering, hydration/flash behavior, localStorage denial/corruption, same-browser tab updates and portal inheritance. Avoid a script/security workaround solely to hide a flash. Do not use a global filter/invert transform.

Verification: focused appearance parsing/persistence/compatibility checks, relevant changed-file lint/type checks when necessary, and one representative shell/dialog in each theme. Do not restyle every feature page in this section. Completion: stable tokens and theme plumbing usable by later Luna sections.

## Section 2 — Settings, Themes and account entry
Model: GPT 6 Luna / High.

Use Section 1's contract. Keep Settings as the fifth bottom tab. Present Settings > Appearance > Themes with Light/Dark preview cards, explicit selected state and accessible controls. Selection updates immediately and persists on this device. Font and size remain available. Reconcile existing Save/Cancel behavior so the screen never claims a preview is saved when it is not.

Replace the Home bell with the existing Account/avatar entry. Keep notifications inside Settings. Reuse genuine existing preference/delivery behavior if Section 0 established it. Otherwise keep notification capability deferred with concise truthful UI only where useful; do not create fake active toggles, send notifications, request OS permission or invent a push backend. Preserve account, household, import/export and recovery access.

Verification: switch themes, reload, reset, larger text, account navigation, and same-browser tab update using synthetic data. Do not rerun appearance unit checks unchanged since Section 1. Completion: two usable theme choices and correct Account/Settings destinations.

## Section 3 — Institution icons and compatibility
Model: GPT 6.1 Sol / Medium.

Implement the institution approach above. Reuse the existing icon system for fallback types. Inspect account/loan creation and edit, normalization, imports/exports, serialization and older records before adding metadata. Make any new identifier optional, bounded and validated against a catalog; do not store raw SVG, external URLs or arbitrary HTML in financial records.

Use a shared renderer on debt cards and relevant account-linked rows. Offer explicit institution selection without blocking existing workflows or forcing users to classify old debts. Keep issuer and merchant/category identity separate. Do not bulk rewrite existing records.

Verification: known institution, Other/missing asset fallback, legacy records, explicit selection/save/reload and metadata round-trip using synthetic fixtures. Confirm balances/IDs/history are unchanged. No full auth/sync suite. Completion: consistent local icons plus a compatibility-safe optional picker; report genuine logo assets still unavailable.

## Section 4 — Home
Model: GPT 6 Luna / High.

Follow the first D-OVERVIEW phone closely: DebtFree header, greeting/account button, gradient debt summary and compact chart, payoff summary, next payment, schedule preview, and supported recent updates. Derive Light from L-DETAIL's surfaces/colors. Use only existing approved selectors or Section 0-supported projections.

Preserve actual household/forecast scope labels, stalled/missing-term states, account versus fixed-loan payment treatment, and existing Home actions. Do not invent a faster payoff figure, saved event timestamp or unconditional “great progress”/“on track” claim. Keep Home and Debt separate.

Home's schedule preview opens the existing full schedule, not a replacement calculator. Every See all/chevron must have a real destination; omit unsupported decoration. Retain useful existing information/actions even when not pictured.

Verification: Home -> Account, Home -> Schedule -> Back, valid/stalled forecast and no-history case, and reference comparison in both themes at a representative phone width. Completion: close composition with live truthful data, no financial math changes.

## Section 5 — Debt list, details and forms
Model: GPT 6 Luna / High.

Follow D-OVERVIEW phone 2: account summary, segmented filters, institution icon tiles, debt cards, clear balances and progress bars. Preserve all real debt types and custom groups/reordering instead of limiting data to the four sample accounts. Category/type filters must filter actual records and remain understandable alongside existing household groupings.

Keep Debt + as the sole entry for cards, other debts, mortgage and car. Preserve account Overview / Transactions / Info, simplified Update/payment flows, original/current balances, APR, minimums, recurring due day and mortgage escrow behavior. Extend both themes into existing full-screen forms and dialogs. Do not restore + Track Loan or stale lender text.

Preserve account versus transaction saves, dirty-state/discard behavior and viewer restrictions. Unknown baselines do not produce invented percentages; balance increases remain truthful. Keep meaningful recent fixes even when screenshots omit their controls.

Verification: existing targeted debt flow(s) for list -> detail -> edit/save or discard, one payment/adjustment path, plus a mortgage/car form visual check where styling changed. Use long names and both themes. Do not rerun financial-engine tests for unchanged math. Completion: coherent Debt UI without lost editing/history features.

## Section 6A — Progress data and milestone adapter
Model: GPT 6.1 Sol / Medium.

Use the current actual-progress model as the authority. Define a small shared selector/view model for Overview / Trends / Milestones, with explicit account/loan/household scope. Preserve progressStartingBalance, removed accounts, existing snapshots/revisions and loan history. Do not replace it with the legacy progress-report helper simply because that helper has milestones.

Derive recorded trend points and net monthly changes only from supported observations. Do not interpolate missing history as actual records. Derive achieved/projected/pending milestone states from evidence, retaining current thresholds unless separately approved; screenshot thresholds and dates are examples. Keep projected dates visibly projected. Preserve negative reductions when balances increase and unavailable baselines when necessary.

Validate any faster-payoff comparison's baseline, scope and assumptions. Do not invent a historical start date or achievement date. No schema migration unless separately justified and approved.

Verification: targeted selector checks for debt decrease/increase, missing history, baseline preservation, removed accounts, scope changes and projected versus achieved states. Completion: a stable truth-preserving adapter for Luna's UI.

## Section 6A completion checkpoint — October 23, 2026 (Pacific)

Implemented locally on `local/semantic-themes-section1-20261023` at `/workspace/scratch/00524890527f/debtfree-dashboard`. Earlier Sections 1–5 changes remain intact and uncommitted. No publication or migration.

**Shared contract for Section 6B.** Import `buildProgressView` from `app/progress-view.ts`. Pass the existing Progress inputs (`accounts`, `transactions`, `adjustments`, `snapshots`, `loans`, optional `startingBalance` from `monthlyPlan.progressStartingBalance`, `removedAccounts`, and `date`). Its second argument is `accounts`, `loans`, or `household`. Use scoped `summary`, `live`, `observations`, `trend`, and `milestones` for Overview / Trends / Milestones. `actual` remains the account-only `buildActualProgress` report for existing snapshot controls/account breakdown, regardless of selected view scope. `loanHistory` preserves original records and identifies each loan's balance kind/as-of date. No active UI was replaced in 6A; wire this adapter during 6B.

**Evidence semantics.** `summary.reduction` and `percent` stay signed; unavailable baseline comparisons are null. `baselineKind` identifies account baseline, original loan amounts, or mixed household comparisons. `summary.startingDate` is null: no exact common starting date is established. `live` never becomes a saved observation. `observations` preserves current saved account snapshot totals with a scope-comparability flag; revisions remain in `actual.snapshots` and continue to inform the authority's baseline. Monthly `trend.savedBalance` is null for missing/incompatible observations. `observedNetChange` is the signed difference between observations in consecutive months, not complete calendar-month activity; `recordedAccountChange` is the signed account activity subtotal and null without records. It is never a household/loan spending total. Do not join chart lines through nulls. Loan aggregation requires saved balances for every loan on the same day with the current balance kind; household aggregation additionally requires a matching account observation day. No carry-forward/interpolation. Same-day loan observations use the latest recorded version; conflicting values without an evidenced recording order remain unavailable.

**Milestones and projections.** Existing seven milestone identities/thresholds are retained. `achievedOn` is only a recorded payment event date with evidence; threshold/live attainment has no invented crossing date. `firstObservedMonth` denotes recorded evidence, not an exact achievement month. Live attainment may have both date fields null. Superseded same-day loan payoff observations do not establish achievement. Optional `forecast: { settings, items }` rebuilds the canonical active Schedule from the same adjusted live balances; projections are available only with complete matching scope, no missing terms/stall and no omitted retained/archived balances. Scope mismatch omits projections rather than inventing a different schedule for the selected Progress tab. Projected dates use `projectedMonth`. Faster-payoff comparisons are always null because saved snapshot forecast dates lack comparable scope/origin/assumptions. Show no faster-payoff claim.

**Focused verification.** Added `tests/progress-view.test.mjs`: 14 selector cases cover signed movement/unavailable baselines, fixed baseline and revisions, retained accounts/reconciliation, trend gaps and live separation, observed versus exact milestone dates, payment exclusions, account/loan/household scopes, missing/mixed-kind loan history, same-day loan corrections and ambiguous recording order, canonical projection eligibility, missing/stalled projections, recorded monthly subtotals and historical payoff observations. Existing `tests/debt-activity.test.mjs`: four cases passed unchanged. Changed-file ESLint passed. `tsc --noEmit --incremental false` and `git diff --check` passed on the final selector implementation. No broad tests, build, browser check, schema change or production probe; this section adds data selectors only.

Next: **Section 6B — GPT 6 Luna / High**, using this adapter and preserving directly visible snapshot controls/list. Continue in the same dirty checkout; the remote baseline does not contain this work.

## Section 6B — Progress interface
Model: GPT 6 Luna / High.

Build Overview / Trends / Milestones using Section 6A exclusively. Follow D-OVERVIEW phone 3 and D-DETAIL phones 1–2; Light follows L-DETAIL phones 1–2. Match cards, charts, time-range controls, milestone timeline and category rings using the shared theme tokens.

Keep snapshot controls and saved snapshot list directly visible on Progress, including the main Overview; do not bury them inside nested dropdowns or remove them to match the mockup. Time ranges filter real points. Charts need readable labels and accessible data summaries. Never visually smooth unsupported history into invented actual observations.

Verification: tab/range navigation, missing-history state, snapshot access and both themes with larger text. Reuse passed Section 6A checks. Completion: close visual match with truthful trend/milestone semantics.

## Section 7A — Budget and shared Schedule integration
Model: GPT 6.1 Sol / Medium.

Create Budget Overview / Transactions / Schedule navigation. Keep one canonical full Payoff Schedule also used by Home. Preserve month selection where applicable; do not let changing a Budget reporting month silently change the schedule's forecast origin or financial settings.

Adapt existing recorded transaction/activity handlers into Budget Transactions without duplicating the ledger, losing account-level history or changing signs. Preserve payments versus adjustments, corrections, deletion, restoration and month/year/lifetime scope. Define totals clearly when a feed contains several activity types.

Provide selectors for planned allocations and optional recorded actuals using current ledger/settlement rules. Never count payments as household spending or count linked mortgage/car obligations twice. Maintain existing audit fixes for payment commitment/minimums and Record Payment suggestions. Do not turn optional detailed tracking on by default or require transaction entry for every purchase.

Show comparison/“Spent” labels only when evidence supports them; otherwise show planned values accurately. Keep all three actions: Income +, Spending +, One-off +. Preserve existing settlement/paid behavior.

Verification: focused adapter/navigation checks for planned-only versus tracked data, no duplicate payments/settlements, month selection, transaction correction path and shared Home/Budget schedule. Reuse existing unchanged financial checks. Completion: safe view models and working routes for Luna.

## Section 7A completion checkpoint — October 23, 2026 (Pacific)

Implemented locally in `/workspace/scratch/00524890527f/debtfree-dashboard`, branch `local/semantic-themes-section1-20261023`. Preserve the dirty checkout, including Sections 1–6. No commit, push, deployment, migration, production query or financial-engine change.

**Section 7B contract.** `app/budget-view.ts` exports `buildBudgetView`, `buildBudgetActivity`, `budgetLoanActivity`, `budgetReports`, `inBudgetPeriod`, and the Budget tab/period/view types. `dashboard-client.tsx` owns `budgetTab` and reporting `selectedMonth`; neither changes the current-month forecast inputs. Budget Overview uses the view's planned totals and matched allocation paid amounts. Transactions reuses `PaymentsPage` and the existing `changeTransactionEntry` / `DebtEntryDialog` correction, delete, restore, revision and viewer behavior. Its optional controlled reporting month feeds back to Budget, with month/year/lifetime scopes. Loan payment observations link to existing loan details, retaining principal/interest/escrow separately. Paid checklist records remain a separate reporting section, never editable synthetic ledger rows. Keep their existing source records intact.

**One full Schedule.** `BudgetScheduleEntry` receives the same `activePayoff` as Home and opens the existing single `PayoffSchedulePopup` through `scheduleOpen`. Its Back action returns to the Budget Schedule subtab. Scope, missing terms, strategy/minimum controls and account/loan first-payment suggestions remain owned by the canonical implementation. Overview still uses `monthlyBudgetCommitment`, including saved historical amounts. Existing linked-loan coverage, outside-schedule minimum obligations and escrow calculations are unchanged. Do not construct a forecast from `selectedMonth`.

**Truthful data.** Planned cashflow includes linked loan entries once, with the canonical commitment subtracting the loan coverage already in Spending. Allocation records flag linked loan obligations. Recorded household spending excludes those linked obligations, debt payments, credits, adjustments, interest and fees; it is available only with optional detailed tracking and evidence, labeled `recorded-only`, never a complete monthly total. Matched paid checklist amounts remain available with detailed tracking off. No actual-income ledger or complete coverage evidence exists, so `spendingComparison` is null; do not add a percent-less or full-month remaining-spending claim. Mixed feed totals explicitly separate payments, credits, signed account net change, settled spending and settled minimums. Loan observations are not added to account net movement or checklist totals.

**Overlap limits.** Duplicate IDs are counted once, and existing payment inclusion links retain their authority. Equal dates/amounts do not establish duplicate purchases. There is no cross-source event ID joining a spending settlement to a ledger purchase. If both reference the same planned item in a month, its combined paid amount and affected actual subtotal are withheld (`overlap-unresolved` / `unresolvedSpendingOverlap`) rather than guessing. Individual records remain accessible. No new metadata or schema is introduced. Forecast settlement handling remains untouched.

**Navigation/access.** Overview / Transactions / Schedule work within Budget. Keep Income +, Spending +, One-off + available. Read-only viewers can navigate reporting and Schedule; mutations remain disabled. Section 7A supplies minimal functional composition only; apply reference styling/search/filter improvements in 7B.

**Checks run now.** Ten `tests/budget-view.test.mjs` cases cover planned-only/tracked data, reporting-only settlements and ID deduplication, unresolved overlap, mortgage/car links and escrow, excluded obligations, preserved historical months, period scopes, signed mixed totals, existing corrections/deletion/restoration, loan observations and optional tracking. Existing `payoff-budget-commitment` and `payment-overlap` checks passed (15 cases). The focused phone browser test `tests/browser/section7a-budget.spec.ts` passed: Home/full Schedule equals Budget/full Schedule after reporting-month changes, Back preserves Budget Schedule, selected month survives subtab navigation, lifetime scope works and all three add actions are visible. Changed-file ESLint, TypeScript and `git diff --check` passed. Browser execution used the existing temporary Chromium runtime and an environment-only network-interface shim; no app/runtime configuration changed. No full suite, build, theme-wide visual acceptance or production checks were run; those are outside 7A.

Next: **Section 7B — GPT 6 Luna / High**. Continue from this checkout and these adapters; the remote baseline does not contain the uncommitted implementation.

## Section 7B — Budget interface
Model: GPT 6 Luna / High.

Follow D-OVERVIEW phone 4 and D-DETAIL phones 3–4; Light uses L-DETAIL phones 3–4. Build segmented Overview / Transactions / Schedule, budget summary/allocation bars, category icon rows, compact monthly transaction groups/search/filter, schedule summary and strategy/settings entry points.

Bind only to Section 7A's adapters. Where the screenshot says Spent but current data is planned-only, use Planned and an honest corresponding summary. Do not copy groceries/merchant examples, sample percentages or “22% less” claims into real households. Forecast payments and actual recorded transactions must remain distinct.

Retain the current full schedule via View full Payoff Schedule. Do not implement a parallel “Plan” page or duplicate repayment logic. Keep existing entry actions accessible and prevent the action bar or bottom navigation from covering rows.

Verification: targeted visual/navigation checks for all three subtabs, both themes, transaction search/filter, empty data, large amounts and larger text. Reuse unchanged Section 7A checks. Completion: close Budget reference fidelity with working controls.

## Section 8 — Full Payoff Schedule restyle
Model: GPT 6 Luna / High.

Keep the current full schedule and restyle it with the shared themes. This has no separate full-screen reference; use D-OVERVIEW/D-DETAIL styling rather than inventing a new schedule design.

Preserve the current forecast origin, scope, monthly payment, interest, balance after payment, debts paid off, strategy/order controls, exports where present, missing-term/stalled messages and back behavior. Retain the current four-column mobile layout and payment placement unless an evidence-based accessibility fix requires a small adjustment. Do not replace monthly projections with only the upcoming-payment list shown in Home.

Verification: visual inspection at 320/360/390/430px with long account names, large values, multiple debts paid off in one month and a noncalculable forecast. Compare Home and Budget entry/Back behavior. Reuse earlier checks where identical. No payoff-engine tests unless its inputs/logic changed. Completion: complete existing schedule readable in both themes.

## Section 9 — Focused integration and visual acceptance
Model: GPT 6.1 Sol / High.

Review the accumulated diff against this approved contract and all three actual reference sheets. Use a compact screen/reference matrix and list meaningful differences, including the derived light overviews, preserved snapshot controls and truthful Budget labels.

Check five-tab navigation, Progress/Budget subtabs, Account/Settings entry, theme persistence, institution fallbacks, shared Schedule, editing/discard, viewer restrictions and surviving historical data. Inspect all changed surfaces in both themes; specifically catch portal dialogs and desktop pages retaining light-only styles.

Use synthetic fixtures at 320/360/390/430px, plus a representative desktop viewport. Check larger text, contrast/focus, touch areas, scroll, and action-bar clearance. Desktop viewport checks do not verify physical Android keyboard, safe areas, Android Back or installed PWA behavior; report those limits.

Run only affected named unit/browser checks and necessary lint/type/build checks. Select the smallest set that covers cross-screen integration, reusing passed unchanged results. Do not launch npm test, npm run validate or a full browser/sync suite. No production probes, publication or migration in this section.

Completion: report implementation status by section, focused check results, outstanding limitations and user-visible deviations. Production publication remains a separate explicitly authorized task with the current release guards.

## Authorization for this reference-only commit

The owner explicitly requested that these design images be uploaded to GitHub and that a section-by-section prompt be created. That request authorizes the three named reference PNGs and this handoff despite the general AGENTS.md exclusion of user-provided reference files. It does not authorize staging unrelated attachments, application code, credentials or financial data. Existing documentation does not identify these new references, approved theme decisions or this implementation sequence, so this single handoff records the newly requested design work without duplicating operational instructions.


## Section 9 integration review — October 23, 2026 (Pacific)

**Scope and provenance.** Reviewed the accumulated implementation on `local/semantic-themes-section1-20261023` in `/workspace/scratch/00524890527f/debtfree-dashboard`, based on `4286827` / audited application source `d3434a6`. Preserved the existing dirty tree. Opened all three original reference sheets and verified their hashes against the handoff. No reference modification, regeneration or upload; no financial-engine, persistence, authentication, schema, production-data, commit, push or deployment operation.

### Screen/reference comparison

| Surface | Reference | Result and meaningful visible differences |
| --- | --- | --- |
| Home | D-OVERVIEW phone 1 | Greeting, gradient household balance, recorded chart, payoff/next payment, Schedule preview and recent financial activity are present. Account replaces the bell. Payoff remains a separate card rather than inside the gradient; the layout is taller, particularly with larger text. Chart explicitly shows account snapshots, not whole-household saved history. Unsupported success/faster-payoff claims are omitted. |
| Debt | D-OVERVIEW phone 2 | Summary, type/group segments, institution/type tiles, balances and reduction bars are present. Cards retain a taller stacked layout with APR/minimum information and household controls rather than the mockup's compact issuer rows. Generic institution icons replace official bank logos. |
| Progress Overview | D-OVERVIEW phone 3 | Summary, recorded trend, milestone preview and category rings use shared tokens. Scope/baseline information and directly visible snapshot controls/list add height. Negative movement, unavailable baselines and missing observations remain explicit. |
| Progress Trends / Milestones | D-DETAIL phones 1–2; L-DETAIL phones 1–2 | Real range controls, accessible chart summaries, gaps, category rings and evidenced achieved/projected/pending timeline. Existing seven milestone thresholds remain; no invented journey dates or faster-payoff claim. Timeline uses row separators rather than reproducing every decorative connector. |
| Budget Overview / Transactions / Schedule | D-OVERVIEW phone 4; D-DETAIL phones 3–4; L-DETAIL phones 3–4 | Segments, allocation/category rows, searchable monthly activity and Schedule summary are present. Labels say Planned; optional recorded totals remain partial. Household commitments and three add actions remain visible. Mobile summary metrics stack to preserve large currency amounts. No unsupported Spent, 22%-less or faster-payoff claims. |
| Full Payoff Schedule | Derived from shared Dark/Light styling; no full-screen reference | Existing canonical complete forecast, four-column phone table, payment placement, scope/origin, controls and missing-term messages retained. This intentionally differs from the mockup's short upcoming-payment list. |
| Light overviews | D-OVERVIEW composition plus L-DETAIL palette | Derived white/pale-blue/blue layouts; no separate Light overview reference exists. They are adaptations, not a match to an absent sheet. |
| Settings / Account / dialogs / desktop | Shared token contract | Existing destinations and tools retained; device-local Themes selection, typography and portal inheritance preserved. Desktop adapts the existing sidebar/content shell rather than stretching phone frames. Notifications truthfully remain unavailable. |

### Status by section

| Section | Local status |
| --- | --- |
| 0 | Current audited baseline and data-support boundaries retained. |
| 1 | Theme foundation verified across responsive/desktop shells and body portals; deterministic Light SSR limitation remains. |
| 2 | Theme persistence, cross-tab updates, typography, reset, storage failure and Account return verified; earlier browser block resolved. |
| 3 | Explicit account/loan institution metadata save/reload and financial preservation verified; generic icons ship, official logo assets remain deferred. |
| 4 | Home integrated; chart scope/footer/gaps and signed increase percentage corrected in this review. |
| 5 | Debt/card/loan editing, save/cancel/discard and long-name forms verified; household grouping retained. |
| 6A | Approved selector model retained. Reused the checkpoint's 14 selector and four debt-activity results; selector code is unchanged. |
| 6B | Overview/Trends/Milestones, visible snapshots, real ranges and missing-history views verified. |
| 7A | Shared canonical Schedule/reporting-month separation verified. Reused the checkpoint's ten Budget selector cases and 15 commitment/overlap cases; financial adapters are unchanged. |
| 7B | Planned allocations, search/empty results, reporting controls and theme integration reviewed. |
| 8 | Four-column Schedule checked at 320/360/390/430px in both themes, including long names, large values, simultaneous payoffs and noncalculable forecasts. |
| 9 | Focused integration complete subject to the visible deviations and physical-device limitations below. This is not exact reference-fidelity signoff or publication approval. |

### Scoped defects corrected

- Phone navigation now says Debt, matching desktop and the approved five-tab labels.
- Dark selected household-group text uses the readable accent, rather than the purple fill foreground that measured about 2.03:1.
- Budget grid tracks shrink correctly at 320px with larger text; headings wrap, tab labels have spacing, currency values remain intact, and the new gradient summary outranks an older reference stylesheet rule.
- Home's snapshot action no longer overlaps its axis labels; a single observation shows one date label. Account-only saved history is explicitly labeled and missing months are not connected. Balance increases retain their actual percentage instead of displaying 0%.
- Repaired stale focused checks: expand Custom colors before editing, inspect body font inheritance, locate Notifications outside Appearance, use current Progress labels/navigation, dispatch real appearance events, navigate to the app before Schedule storage access, preserve an already-saved theme on Home test reload, and use a valid loan-link fixture.

### Checks run in Section 9

The final passing results below are assembled from focused runs, reusing unchanged passing cases. Initial failures caused by integration defects or stale test setup/selectors were corrected and only their affected cases rerun.

| Named check | Actual result / scope |
| --- | --- |
| `section2-settings.spec.ts` | Three cases on phone and desktop: immediate save, reload/cross-tab/reset/typography, Account return and denied storage. Passed. |
| `section3-institutions.spec.ts` | Phone and desktop account/loan selection, reload and financial-history equality. Passed. Unknown/Other/absent keys retain generic type icons; unchanged catalog unit evidence was reused. |
| `section4-home.spec.ts` | Two phone cases: Account/Schedule routes, empty saved history in both themes, and incomplete loan terms. Passed. |
| `debt-experience.spec.ts` | Only `account drafts offer…`, `mortgage and car forms keep…`, and `loan account edits can…`, on phone and desktop. Six executions passed. |
| `audit-integration.spec.ts` | Phone and desktop: live increases, correct 40.0% household increase, retained dated snapshot/baseline, missing terms and loan-details route. Passed. |
| `section6b-progress.spec.ts` | Phone range/scope/snapshot/contrast case and missing-history case. Both passed. |
| `section7a-budget.spec.ts` | Phone and desktop reporting-month independence, identical Home/Budget full Schedule, Back and reporting scopes. Passed. |
| `section7b-budget.spec.ts` | Phone planned allocation rows, search/no results, real theme events and full Schedule. Passed. |
| `section8-schedule.spec.ts` | Both named cases on phone and desktop projects (four executions; these specs force phone widths). Table/no-overflow assertions at 320/360/390/430, both themes, large names/values, multiple payoffs and missing APR. Passed. |
| `section9-integration.spec.ts` (new) | Responsive/desktop matrix plus Dark edit/discard contrast/history cases. Both projects passed. Matrix covers all five destinations and six Progress/Budget subviews, larger text, keyboard focus, touch heights, scroll/action-bar clearance and unchanged synthetic payload. |
| `section9-viewer.spec.ts` (new) | Real dashboard component with synthetic managed-viewer props in both themes/projects. Debt creation/account fields/institution picker/snapshot capture/Budget add actions/Schedule edits disabled; navigation remains usable; zero external writes and unchanged payload. Passed. This is a UI check, not renewed server-authority testing. |
| `theme-foundation.spec.ts` | Only `semantic theme reaches…`, phone and desktop: body portal minimum editor, both palettes, reload, genuine second-tab updates, reset, typography and Axe shell/dialog contrast. Passed. |
| Validation | `npm run typecheck`, scoped ESLint on changed TS/TSX/specs, `npm run build`, and `git diff --check`: passed. Build emitted proxy-environment and static route-classification notices, with no build errors. |

No full unit/browser/sync suite, payoff-engine rerun, production probe, Worker dry run, native build or migration was run.

**Validation environment.** Browser checks used only hand-authored synthetic fixtures, temporary Chromium and an isolated local source copy with an environment-only network-interface shim. No repository dependency/configuration changes were needed. The responsive matrix used 320/360/390/430 × 844 and desktop 1440 × 1000 in both themes with Larger text; portal and editing checks also covered standard text. Axe color-contrast checks, keyboard-visible focus, primary/add-action touch heights, scroll reachability, action-bar clearance and exact synthetic payload preservation were asserted. Screenshots were inspected locally and remain test artifacts, not deliverables or production evidence.

**Changed in Section 9 only.** Application: `app/dashboard-client.tsx`, `app/debt-experience.module.css`, `app/globals.css`, `app/home-dashboard-page.tsx`, `app/home-dashboard.module.css`. New checks: `tests/browser/section9-integration.spec.ts`, `tests/browser/section9-viewer.spec.ts`. Updated existing focused checks: `tests/browser/section2-settings.spec.ts`, `tests/browser/section4-home.spec.ts`, `tests/browser/section6b-progress.spec.ts`, `tests/browser/section7b-budget.spec.ts`, `tests/browser/section8-schedule.spec.ts`, `tests/browser/audit-integration.spec.ts`, `tests/browser/debt-experience.spec.ts`. Documentation: this existing handoff. Earlier dirty files belong to accumulated sections and were retained.

**Remaining limits / stop boundary.** Layout/theme functionality is locally checked; exact screenshot density is not achieved, especially in Debt and larger-text Progress/Budget. Official institution logos and real notification delivery remain deferred. Stored Dark can show an initial server-rendered Light frame before hydration. This is not a full custom-palette or general accessibility audit. Synthetic payload comparisons and unchanged selector results do not prove the contents of production records; no production probes were run. Desktop Chromium viewports with touch emulation do not verify physical Android keyboard overlays, Android Back, real safe-area insets, installed PWA behavior, device performance or household synchronization on phones. No new financial/persistence architecture defect was established in this review. Stop here; production publication still requires separate explicit authorization and current release safeguards.
