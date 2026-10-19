# Implement Compact design and one household currency

Use GPT-6.1 Sol Low. Actual repo C:\Projects\debtfree-dashboard, branch local/windows-development-20261016; visible chat's 0LESS folder is not the repo. Read AGENTS.md, mobile README, reports17/18, DESIGN_VARIATIONS_20261017.md, then the approved Compact fragment at C:\Users\masil\.codex\visualizations\2026\10\17\01a1489e-837e-7b63-ba04-2911935fe420\debtfree-polished-calculator.html as design reference only. Owner has NOW approved Compact implementation, with corrections below. Don't copy prototype financial math, fake navigation or status/preview prose into the app.

LOCAL ONLY. Preserve all dirty/untracked source, current installed app/storage keys, real PC/phone household, category settings, ledger/Progress baseline and prior artifacts. No commit/push/deploy/cloud/provider/remote DB/real-data/ADB actions, dependency changes or subagents. Do not open/control localhost8787 or the owner's browser/phone. Synthetic data only; no real backup/screenshots/logs. No worker chats/status polling or completion messages to manager/peers. Save final report and finish in your own chat; owner announces completion. Keep concise progress visible.

## Ownership

Own app/dashboard-client.tsx, app/dashboard-data.ts (currency metadata/validation only), app/onboarding-flow.tsx, app/quick-payoff-calculator.tsx and module CSS, app/mobile-layout.module.css, app/outline-icon.tsx; NEW app/household-currency.ts, app/household-currency-context.tsx, app/household-currency-settings.tsx (+ scoped module CSS); tests/browser/mobile-approved-layout.spec.ts, NEW tests/household-currency.test.mjs and a focused currency browser spec; report docs/mobile/reports/19-compact-currency.md.

For consistent currency formatting you may also edit only the currency-related lines/hooks/props in app/actual-progress-page.tsx, debt-activity-panel.tsx, debt-insights-page.tsx, home-dashboard-page.tsx, loan-activity-panel.tsx, loan-progress-panel.tsx, mobile-debt-visuals.tsx, monthly-plan-page.tsx, payoff-calculator-page.tsx, payoff-export.ts and progress-report-page.tsx. Preserve those layouts and math. Inventory other hardcoded currency labels and disclose any remaining unsupported surface rather than quietly showing incorrect units.

Do NOT edit app/payments-page.tsx, app/transaction-history-table.tsx, app/payments-mobile.module.css or app/debt-entry-dialog.tsx: Transactions worker owns those. Do not edit native/auth/sync/global/reference CSS/package/lock/configs. Manager owns integrated suites/build/APK/provider work.

## Compact UI

Match Compact: restrained mint/teal/white-paper/navy,8px corners, compact label/value result rows; selected strategy uses existing mint. Keep original summary/debt cards and Budget layout/content. Calculator remains modal triggered beside category filter; label the trigger Payoff Calculator with the icon (not icon-only). Extra Payment row gets the selected currency SYMBOL (or compact currency marker) beside input. Preserve minimum-reserving engine/scenario isolation.

Each payoff row shows debt name + APR percentage (existing high-APR24%+ red, lower APR teal) and payoff month aligned at end; handle long names accessibly at320px. Full schedule, every calculated month to payoff, no First6months disclosure/filter/slice. Header may say number of months, but REMOVE the currency-code suffix (e.g.23 months · USD ->23 months). Table fills available modal width with naturally sized columns, min-width0, readable explicit foreground/background at every supported theme/font. User reports white/invisible table text in the preview: diagnose inheritance and pin appropriate scoped contrast, do not rely on host styles or blindly claim exact cause. Keep semantic signs, error/stalled/insufficient-budget states and no fake zero/debt-free date. Test default + Ocean/Sand + readable custom settings.

Settings stays a dedicated page via gear/hamburger, separate from Account. No Back to calculator button/link in Settings. Preserve current header, four bottom tabs, archived placement, filter and Position in category save/cancel work from report18.

## Currency contract shared with Transactions worker

Create these exports exactly:

- app/household-currency.ts: type HouseholdCurrency = 'USD'|'PHP'|'EUR'|'GBP'|'CAD'|'AUD'; resolveHouseholdCurrency(value:unknown):HouseholdCurrency (missing ->USD); createHouseholdMoneyFormatter(currency:HouseholdCurrency, options?:Intl.NumberFormatOptions):Intl.NumberFormat; householdCurrencySymbol(currency:HouseholdCurrency):string. Explicit supported options only, no remote rates.
- app/household-currency-context.tsx: HouseholdCurrencyProvider({currency,children}), and useHouseholdCurrency():HouseholdCurrency. Default context USD for standalone legacy consumers. Context must be per React tree, never a mutable global household singleton. Import pure helpers without React in models/exports.
- Store optional monthlyPlan.currency, default legacy missing to USD without writing/relabeling existing data on mount. Add validation and old/new backup roundtrip tests; preserve all existing unknown-field/validator compatibility. No model version bump just to drop backward-compatible metadata; justify if genuinely required. Unsupported present codes cannot silently become different money units during import.

Wrap appropriate render paths (including onboarding) in the provider derived from current household's monthlyPlan.currency. Root code formats from its own scoped currency explicitly; nested functions/components must not keep frozen module-level USD formatters. Keep decimal precision as each surface expects; values/calculations do not change. Pass explicit currency to non-React export functions with backward-compatible USD default; exported reports must not label PHP amounts USD.

Integrate Household currency in onboarding and Settings, with one code for all debts, totals, entry inputs and calculator. Debt editing can show inherited household currency, never a per-debt selector yet. Common six supported currencies above all use2 minor units. Existing imported households default USD. New setup can choose before entering debt values. Changing an existing household's code must require a concise explicit confirmation that amounts stay the same and no conversion occurs; keep cancel/data untouched, change metadata only on explicit acceptance. Viewer cannot change household currency; personal appearance remains usable. Never auto-convert/rewrite balances/history or invent exchange rates. Future per-debt currencies remain deferred.

Transactions worker uses your provider/hook/format helper in its four owned files. Finish the helper contracts early, but do not send notifications or edit their files. If integration is temporarily incomplete, report the dependency honestly rather than create stubs or poll chats.

## Checks/report

Focused checks only; don't run full builds/native/integrated suite while peers work or stop existing servers. Use isolated synthetic source/component harness and targeted lint/types/unit/browser checks. Cover supported/invalid/missing codes, no mount writes, old backup preservation, USD/PHP formatting, provider scope isolation, onboarding choice, existing-data confirmation/cancel, viewers, dark/white-text regression, all schedule rows/final0, long names/large values at320/390px, keyboard modal close/focus and saved-plan/Budget preservation. No monetary model changes. Report19 lists exact files, actual checks, integration exports and any remaining hardcoded currency surfaces. No APK/device/sync readiness claim.
