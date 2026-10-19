# Compact calculator and household currency

Date: October17,2026 / America/Los_Angeles.
Status: assigned implementation complete; integrated manager review/build pending.

## Scope and preservation

Read AGENTS.md, mobile board, complete prompt13, reports17/18, DESIGN_VARIATIONS_20261017.md and approved Compact HTML fragment as a design reference. Preserved prior filter, Position in category save/cancel, calculator modal, Settings/Account routes, summary/cards, Budget layout and existing work. Used synthetic fixtures/isolated browser contexts only. No real household, backups, private screenshots/logs, user browser/phone, cloud/provider/production/remote DB/dependencies/ADB, publishing or subagents. No worker-chat/status polling or completion messages.

## Implemented

Compact calculator remains in the existing modal, triggered by a visible Payoff Calculator label plus icon beside the category filter. Result metrics are compact label/value rows, extra input shows inherited currency marker, selected strategy stays mint, and each payoff account shows full accessible name, forecast APR and end-aligned month. APR24%+ uses a rose/red badge; lower APR uses mint/teal. Long names wrap rather than losing accessible text. Existing minimum-reserving calculation and local scenario isolation remain.

The full schedule renders every calculated month without a six-month slice/disclosure/filter. Heading shows only the month count, with no currency-code suffix. Table fills modal width with auto-sized columns and min-width0; very large amounts can wrap without spilling outside the320px modal. Foreground/background are explicitly scoped to the calculator's current readable appearance tokens for table/cells/caption and results. Earlier component CSS did not pin schedule foreground/background, leaving room for inheritance/shared table rules. The exact cause of the owner's preview screenshot cannot be established from source alone; this implementation does not claim it. Actual synthetic browser computed contrast passed below.

Household currency is optional monthlyPlan.currency, with supported USD/PHP/EUR/GBP/CAD/AUD. Missing legacy metadata displays USD without inserting a default property on mount. Explicit unsupported imported codes fail validation instead of becoming another currency. Currency metadata is backward compatible v6 optional data: no model version bump, conversion, amount/history/baseline rewrite, exchange rates or per-debt currency. Existing serializer/template unknown-field preservation remains; tests cover old/current contracts and unknown envelope/payload fields.

New setup can select currency before entering values. Mobile Settings is still direct via gear/hamburger and distinct from Account; no Back to calculator control added. Existing desktop settings surface also exposes currency. Existing-household changes stage a pending code, with explicit confirmation that amounts remain unchanged/no conversion. Cancel leaves metadata/data unchanged. Viewer controls/handler are disabled/guarded while existing personal appearance remains available. Debt editing shows inherited household code and input symbols, with no per-debt selector.

## Shared integration API

- app/household-currency.ts exports exactly the required HouseholdCurrency union, resolveHouseholdCurrency, createHouseholdMoneyFormatter and householdCurrencySymbol. It also exports the supported list. Pure helper imports no React. Formatter enforces passed currency/style after options; locale is the existing en-US convention and precision is supplied per existing surface.
- app/household-currency-context.tsx exports HouseholdCurrencyProvider({currency,children}) and useHouseholdCurrency(), default USD. Additional useHouseholdMoney convenience hook is used locally. Context is scoped to each React tree, with nested/adjacent isolation tested; no mutable household singleton.
- Dashboard root derives formatter explicitly from its own monthlyPlan.currency. It wraps loaded dashboard and onboarding paths in provider; nested components use their tree context, replacing frozen module-level USD formatters. Normal save behavior is unchanged; no currency normalization write on mount.
- Transactions worker consumes the agreed helpers/provider in its four owned files. This worker did not edit payments-page, transaction-history-table, payments-mobile.module.css or debt-entry-dialog. Their formatting/runtime coverage remains an integrated review gate, not certified here.
- Non-React payoff exports accept explicit optional HouseholdCurrency arguments, defaulting to report.currency or legacy USD. Current React caller passes its household code. CSV identifies units; workbook number formats use the selected marker and subtitle code without shifting worksheet rows/merges. PDF uses code-style amounts to avoid relying on standard PDF font support for peso/euro glyphs. No PDF visual/native share certification claimed.

## Files changed

Core/owned: app/dashboard-client.tsx; app/dashboard-data.ts (optional metadata type/validation only); app/onboarding-flow.tsx; app/quick-payoff-calculator.tsx and module CSS; app/mobile-layout.module.css (labelled trigger/filter sizing only).

New: app/household-currency.ts; app/household-currency-context.tsx; app/household-currency-settings.tsx and module CSS; tests/household-currency.test.mjs; tests/browser/household-currency.spec.ts.

Currency-only hooks/formatters/input/error labels/export arguments changed in: app/actual-progress-page.tsx, debt-activity-panel.tsx, debt-insights-page.tsx, home-dashboard-page.tsx, loan-activity-panel.tsx, loan-progress-panel.tsx, mobile-debt-visuals.tsx, monthly-plan-page.tsx, payoff-calculator-page.tsx, payoff-export.ts and progress-report-page.tsx. Pure display helper functions receive formatters explicitly. Existing milestone's1000 threshold is unchanged; its displayed label now formats the selected unit. No calculations/layout redesign in those files. app/outline-icon.tsx required no new change this round.

Updated tests/browser/mobile-approved-layout.spec.ts only for the approved always-visible full schedule; retained existing navigation/filter/position/modal/financial-preservation checks. This report is the only documentation edited. Global/reference/design-system styles, native/auth/sync, package/lock/configs and other-worker files were not edited.

## Actual checks

- node --test tests/household-currency.test.mjs tests/payoff-report-mode.test.mjs:6 passed. Four new currency checks plus two existing report-mode regressions. Supported/missing/invalid codes; USD/PHP values and enforced currency options; old version4/current v6 roundtrip with no legacy metadata insertion; unknown fields; unchanged balances/ledger/snapshots; per-tree/default React context; viewer settings disabled in SSR with no change callback; actual CSV and workbook PHP metadata/format and USD default. Workbook bytes were unzipped in-memory from a synthetic mocked download; no real file/data used. PDF visual output was not tested.
- npm run typecheck: final pass after correcting formatter helper references/imports. Source lint on all changed TS/TSX/spec/unit files passed; final scoped lint repeated after correcting the test harness variable name and loan symbol import. Earlier checks exposed those issues, plus a formerly module-scoped Progress change helper; fixed by passing its formatter, not a global currency state.
- Dedicated installed Vite source server on previously free127.0.0.1:3011, with mobile/vite.config.ts. Root Playwright reused that synthetic source server; existing8787 and4179/user tabs were not controlled. No full build, dependency install or native command. Stopped this worker's server session42012 after checks; no3011 listener remained.
- Final targeted browser command: npx playwright test tests/browser/household-currency.spec.ts tests/browser/mobile-approved-layout.spec.ts --project=phone --workers=1 --max-failures=1. Result11 passed/1 intentional desktop-only skip in24.1seconds. Tests explicitly disable screenshots.
- Browser coverage: absent legacy currency after mount; confirmation staging/cancel; explicit PHP acceptance; full financial payload identical after removing only currency metadata; summary/calculator PHP symbols; new setup PHP selection before balances; no Settings back-to-calculator; full schedule beyond6rows/final0; long names/APR; default/Ocean/Sand/readable custom serif/larger text at320/390px; actual computed table-cell foreground/background contrast>=4.5; large1billion synthetic balances at320px; table/modal/page width; Escape/focus return; unchanged saved plan/Budget payload; retained category filter and debt-position save/cancel/ledger preservation. Earlier selector ambiguity in onboarding and old row-alignment expectation were corrected; runtime selector labels and new top alignment were verified by final pass.
- git diff --check on edited existing files: no whitespace errors (Git line-ending warnings only). No full historical/integrated suite, APK/device/sync/auth pass claimed.

## Currency inventory / remaining limits

Assigned financial amount formatters and their pure helper call sites were converted, including chart labels, Progress snapshots/milestones, loans, Budget, inputs, dashboard, scenario/saved plans and current export caller. No frozen module-level USD formatter remains in those assigned surfaces.

Some old currency-specific copy outside ownership remains: appearance-settings.tsx contains its static dollar-denominated visual sample; pure validators debts-screen.ts, debt-transactions.ts and payoff-calculator.ts still contain '$0'/'$0.00' error strings. These are not balance conversions or USD numeric formatters, but those messages may still surface in non-USD flows and should receive a coordinated currency-neutral wording pass. Loan-entry's zero wording is contextualized at this worker's loan display boundary. Receipt OCR parsing and imported foreign-currency interpretation are not new FX functionality. Do not claim arbitrary multi-currency receipt/account handling.

Viewer test here is component SSR/disabled-handler evidence, not real provider/membership enforcement. Transactions worker integration, desktop currency visual regression, exhaustive PDF rendering, actual custom-theme/device font rendering, full compiled asset review and native export/share remain manager/integration gates. Dark themes remain unsupported by existing appearance validation; tested readable custom light settings, not a dark-theme rollout. No currency math, schema migration or realtime household synchronization was introduced.

## Next action

Owner supplies completion heads-up; manager reviews combined work, resolves remaining legacy zero-error copy with appropriate file owners, runs integrated lint/types/build/targeted full source/component regressions, checks export PDF/Transactions unit consistency, then rebuilds/audits the update APK without clearing imported data. Existing phone/provider state was not accessed. Final handoff stays in this worker chat only; no manager/peer notification or status polling.
