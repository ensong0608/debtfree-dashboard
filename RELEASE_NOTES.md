# DebtFree Dashboard release notes

## 2026-10-22 — Navigation and debt experience (production verified)

Branch `codex/navigation-schedule-20261022` starts at `30b112d`, the current release checkout, and preserves the mortgage/car details and date-scoped transaction history work. Five primary tabs: Home, Debt, Progress, Budget, Settings. Home adds the greeting, countdown, saved-progress summary, search/sort, unified debt cards and a tappable Payoff Schedule preview. Debt details use Overview / Transactions / Info with Advanced for detailed fields and destructive account actions. Account activity defaults to Lifetime and stays scoped to the selected debt; full state is still passed to existing optimistic-concurrency transaction commands. Loan activity can display every saved month. Existing data/account editing, creation, payment and loan persistence functions are reused.

Payoff Schedule replaces the visible calculator/plan destinations. Its account projection reuses `calculateMinimumPayoffPlan` and the saved `payoffPlanAmount` / `payoffPlanStrategy`. Mortgage/car projections retain separately saved fixed payments, Budget-link fallback, APR and escrow; final principal is capped, and escrow is never counted as interest or principal. The combined forecast has the existing engine's 1,200-month ceiling. Missing loan terms, payoff quotes, underfunded minimums and non-amortizing balances show an adjustment message instead of a misleading household finish date. It does not record forecast payments or reallocate loan payments into the account budget. The Home reduction includes loan original/current balances plus the preserved account Progress anchor; it is balance reduction rather than assumed principal paid.

No schema, migration, auth, household ownership, stored financial shape or production data changes. Search/sort and detail navigation are transient UI state. The owner explicitly approved production publication on October 22. PR #9 was merged into the current production release branch. App source: `44e826ed1ffa6530a135553d5c6bf80ea75c271d`. Worker version: `4b140081-7100-4d46-8d12-bfd37f19b189`. Production was published and verified at 09:25 UTC (02:25 Pacific). Release run: https://github.com/ensong0608/debtfree-dashboard/actions/runs/39754867725 .

Validation: 22 focused Node checks passed (schedule, minimum-reserving payoff engine, unified transaction preservation). TypeScript and changed-file ESLint passed. Candidate phone/desktop checks passed, reusing unchanged successes and rerunning only failed or affected scenarios. Final Home navigation/sort/search and mortgage/car creation checks passed in run 39754375226; the production workflow passed all six focused phone scenarios against the merged release source. These cover five-tab navigation, search/sort, scoped lifetime history, Info/Advanced/back/focus, payment persistence, legacy mortgage history, loan creation validation, schedule data/keyboard/contrast and preservation of unrelated financial records. Production build and exact Worker dry-run passed, and that bundle was published without rebuilding. The full suite was not run.

Production preflight confirmed the existing Cloudflare account, Worker and D1 database. The immediate full SQL export was restored privately and passed integrity, foreign-key, stored-contract and original Progress/snapshot checks before encryption. Encrypted recovery artifact `12414898045` has seven-day retention in the approved GitHub Actions destination; no private key or plaintext financial payload was uploaded. Committed schema was unchanged, so no remote migration ran. At 09:25:11 UTC, every stored household, membership, financial-state, invitation and request column matched the immediate pre-release backup exactly. Google sign-in/account-choice/PKCE/callback and anonymous household/export/lifecycle denial passed. No production test payments or balance edits were made. No independent live signed-in household/device UI check is claimed.

Reference composition uses existing CSS/outlined icons and a decorative CSS landscape rather than embedding reference images or invented financial figures. Home Sort/Search sits directly below the greeting; a search immediately shows matching debts there. Payment forecasts retain the separate saved account budget and fixed loan payments rather than silently reallocating mortgage/car payments.

Changed files: `app/dashboard-client.tsx`, `app/debt-experience.tsx`, `app/debt-experience.module.css`, `app/payoff-schedule.ts`, `app/debt-entry-dialog.tsx`, `app/debt-insights-page.tsx`, `app/globals.css`, `app/loan-activity-panel.tsx`, `app/loan-details-fields.tsx`, `app/loan-progress-panel.tsx`, `app/mobile-layout.module.css`, `app/onboarding-flow.tsx`, `app/payments-page.tsx`, `tests/browser/debt-experience.spec.ts`, `tests/payoff-schedule.test.mjs`, `.github/workflows/deploy-cloudflare.yml`, `.github/workflows/redesign-visual-review.yml`, and this release note.

## 2026-09-14 - Already-paid monthly records

Monthly Plan now records debit/checking expenses, card expenses already included in current balances, and minimums already paid without changing debt balances. Records include amount, payment date, source and creation time, survive backups and reloads, and can be undone. Minimum acknowledgments reduce this month’s remaining obligations and forecast budget. Card expense acknowledgments prevent duplicate projected spending. Records apply only to their saved month and are not copied with recurring entries. Use the ordinary debt payment/charge flow only for new movements not already reflected in the current balances.


## 2026-09-14 - Reliability audit repairs

Revision-checked household saves, durable pending edits and recovery checkpoints protect household data. Corrected balances, payment-aware forecasts, stable commitment rollover, immutable snapshots and onboarding-seeded monthly plans align the main screens. Imports validate IDs and dates, CSV text is formula-safe, and browser/API/security tests extend the release gate. See docs/PHASE_ACCEPTANCE.md for canonical numbering and docs/OPERATIONS.md for recovery and model limits.

## 2026-08-21 - Full Phase 1-16 completion

- Routed device household persistence through a tested repository abstraction and added optional ownership metadata for future shared entries.
- Added import previews with debt, month, transaction, snapshot, and source-version counts plus explicit Replace or Merge behavior.
- Added visible backup guidance, automatic backup recovery coverage, and a typed RESET confirmation that preserves account access.
- Extracted deterministic snapshot creation and completed the Phase 11-16 regression audit for calculation transparency, mobile accessibility, design hierarchy, and memoized payoff calculations.

## 2026-08-21 - Phase 1-10 completion audit

- Added isolated $50, $100, $250, and custom monthly payment what-if scenarios with explicit apply behavior.
- Expanded Progress with the complete Phase 9 metric set, actual-versus-projected chart, and milestone states.
- Added a warning when a promotional balance is projected to remain after its promotional APR expires.
- Added regression coverage and a standalone TypeScript validation command for the completed Phase 1-10 workflow.

## 2026-08-11 - Action-focused Home dashboard

- Home now leads with the next recommended payment, debt-free date, remaining debt, progress, and monthly target.
- The next payment action opens a prefilled payment record and updates balances and projections through the existing ledger.
- Upcoming due dates, promotional expirations, missing projection details, and the monthly review are visible together.
- Primary navigation now follows Home, Debts, Payoff Plan, Monthly Plan, Progress, and Settings; detailed tools remain available in the advanced menu.

## 2026-08-04 - Personal-email household accounts

- Cloudflare Access one-time PINs now verify each member's personal email before the app accepts their identity.
- Household owners can invite either admins with edit access or viewers with read-only access.
- Viewer writes are blocked by the API and editing controls are disabled in the dashboard.
- Existing device data is copied into an empty owner household after the first authenticated sign-in.
## 2026-08-04 - One-time credit-card purchase payments

- One-time purchases linked to a credit card are now added to that card's payoff payment in the current month only.
- The payoff schedule labels those purchases as one-time and does not carry them into future months.
- Recurring credit-card expenses continue to be charged and covered by the planned payment every month.

## 2026-07-31 - Promo-aware payoff forecasting

- Payoff forecasts now use the card's saved post-promotion APR and actual minimum payment after a 0% offer ends.
- If the future minimum is not known, the forecast keeps the current minimum and says so instead of silently estimating a higher payment.
- The True Cost warning now uses the same payoff forecast for its interest, finish date, and monthly-payment figures.
- Forecasts identify non-amortizing balances and stop presenting a misleading payoff date when payments do not reduce the balance after interest and new charges.

## Phase 6 - Monthly Plan source of truth

- Replaced Monthly Budget with a lightweight Monthly Plan for recurring income, recurring planned spending, one-time adjustments, safety buffer, debt-payment target, and available debt payment.
- Added explicit Planned, Spent, and Remaining values. Phase 5 payments are never counted as household spending.
- Detailed spending tracking is optional, disabled for new users, preserved for legacy transaction/payee users, and hides advanced tools without deleting their data.
- Added minimum, extra, and combined payment classifications so the current month shows paid-so-far and still-planned amounts per debt.
- Added planned-to-actual transaction links and a characterized first-month payoff correction that prevents matched card spending from being projected twice.
- Added v4 JSON migration and round-trip coverage without changing payoff ordering or interest formulas.
