# Approved mobile layout implementation

Date: October 17, 2026 (America/Los_Angeles).
Status: assigned layout/navigation/Account/Quick Payoff Calculator implemented; manager integrated review/build pending.

## Scope and preservation

Read AGENTS.md, mobile work board, complete prompt10-approved-layout, latest design-proposal correction and reports12/13. Preserved the current dirty working tree and all existing setup/category/native work. No real household data, exported backups, private screenshots or phone contents were read. No screenshots were taken; the new browser tests explicitly disable screenshot capture. No production/cloud/auth/provider/database/adb/device/dependency/git publishing operations or subagents. No worker chats/statuses inspected or completion messages sent.

Owned edits only:
- app/dashboard-client.tsx
- app/outline-icon.tsx
- NEW app/mobile-layout.module.css
- NEW app/quick-payoff-calculator.tsx
- NEW app/quick-payoff-calculator.module.css
- NEW tests/browser/mobile-approved-layout.spec.ts
- this report

## Implemented behavior

Mobile view is SSR-safe useSyncExternalStore/matchMedia at max-width820px, matching existing mobile navigation breakpoint. Desktop retains More, its avatar/save header and detailed debt controls. Root app-shell receives data-mobile-layout=true and scoped layout module only when mobileView is true.

Mobile header is compact/centered with a left Tools hamburger and right gear. Gear navigates directly to the full Settings page; no intermediate dialog. Routine account bubble and Saved on device header text are absent on mobile. Existing actionable save/storage/auth/recovery/conflict notices remain. Synthetic-demo marker stays in the title. Tools drawer has existing calculator/plan/Progress/utilization/stats routes and a separate Settings section, with Escape/backdrop/close support and the existing focus trap/trigger restoration.

Bottom tabs: Debts / Transactions / Budget / Account. Settings and Account are distinct routes. Settings renders the appearance worker's component and existing category editor. Account retains household/access, backups/import/reset/recovery; its mobile category editor is moved to Settings. Account adds CSV import, a link to debt details/ordering, and Paid off & archived. Archive records show PAID OFF only at zero balance; otherwise ARCHIVED. Restore asks confirmation, then calls the existing restore action. No new data-migration/retention/purge logic.

The active mobile Debts page no longer renders Detailed debt view & import or Auditable debt activity. Existing underlying controls/actions remain available through the dedicated Debt details & import tool, including unique minimum/payoff/archive controls and CSV import; existing Sort on cards remains. Archived list is absent from mobile Debts/tool and lives in Account. Card/total-summary JSX and styling were retained; Budget content/markup/layout was not edited. Global header/navigation changes apply to Budget as authorized.

Quick Payoff Calculator appears after Cards & other cards, before the removed mobile detailed section. It is an isolated local scenario with extra payment and Avalanche/Snowball, computed minimums plus explicit monthly total, estimated debt-free month, interest/total paid, ordered account dates and optional first6months. It uses calculateMinimumPayoffPlan, engine forecast rates/minimums/month keys, and existing priority ordering. It reserves all active account minimums and includes minimum-only records consistently with that scenario model. Opening/adjusting it does not call saved-plan setters or write Budget. All categories are included regardless of card filter; separate House/car loanTrackers are excluded. Archived/zero balances are excluded. Missing/invalid amounts, missing minimums, engine errors, insufficient future minimum budget, stalled and month-limit states display a concise result message instead of invented payoff dates. No-active state is explicit. Default scenario extra0 is local, not a replacement of saved extra/plan.

## Integration interfaces

- Imports default AppearanceSettings and named useAppearanceSettings(enabled:boolean) from ./appearance-settings. Hook called unconditionally at DashboardClient top with mobileView. Root attribute lets that worker's opt-in CSS scope correctly. No appearance module was authored/edited by this worker.
- Passes optional mobile={mobileView} to existing PaymentsPage. No PaymentsPage/history worker file edited. Both interfaces were available when the passing typecheck/browser checks ran.
- Uses a detailsTool prop on the existing AccountsPage so mobile tool access preserves detailed controls without returning the archive list to Debts or showing a second calculator. Existing desktop path defaults remain.
- Added only menu/account SVG shapes to existing outline icon system.

## Actual checks

- ESLint owned TS/TSX/spec files: passed via npx eslint app/dashboard-client.tsx app/outline-icon.tsx app/quick-payoff-calculator.tsx tests/browser/mobile-approved-layout.spec.ts.
- npm run typecheck after integration modules existed: passed. Earlier typecheck caught this worker's incorrect payoffPriority import; fixed it to debts-screen before the pass.
- Started only a dedicated source Vite server on previously free127.0.0.1:3011 using installed CLI and mobile/vite.config.ts; no build/dependency/native command. Existing8787/4179 servers/tabs were not stopped or controlled. Root Playwright reuseExistingServer used this synthetic standalone source server, not the existing real-data app.
- Final targeted command: npx playwright test tests/browser/mobile-approved-layout.spec.ts --project=phone --project=tablet --project=desktop --workers=1 --max-failures=1. Result7 passed /5 intentional viewport skips,15.4s. Three mobile checks each at tablet/phone plus one desktop preservation check. Coverage: four tabs, direct gear-to-Settings/no dialog, categories separated from Account, zero/nonzero archive labels, dismiss/accept Restore, Tools-to-Progress retained1500 baseline, calculator minima/total and strategy order, six-month table, invalid extra, unchanged saved plan/ledger/snapshots;320/390/736 widths, compact header, Tools Escape/focus return and bottom navigation bounds with collapsed-navigation preference.
- The collapsed preference case initially exposed a CSS specificity conflict with legacy navigation rules. Fixed only the scoped module's collapsed-sidebar selectors; final run above passed. Initial source-preview scans also encountered a transient in-progress transaction module and the incorrect payoffPriority export; no other worker file was changed to address them.
- Six short synthetic model assertions passed: minimum reservation for both accounts, no input mutation, missing manual minimum error, all-archived empty plan, minimum-only scenario and future promo-minimum shortfall. One initial assertion expected a plan object on the future-shortfall case; the engine instead correctly returned an error. Corrected the assertion to accept the engine error or an explicitly detected shortfall; no engine change.
- git diff --check on existing owned app files: passed (line-ending warnings only).
- Stopped this worker's source preview (session6292) with Ctrl+C; verified no3011 listener afterward. No preview process left by this worker. No full web/mobile production build, integrated suite, native/APK or phone test run in this assignment.

## Limits and next action

Source/browser checks establish the tested synthetic layout flows only. Appearance persistence/preset coverage and Transactions visual/history acceptance belong to their assigned workers and integrated manager review; this report does not certify those features. Existing mobile/demo.spec.ts expects the previous More/avatar navigation and will need manager-coordinated update before an integrated demo-browser pass; it was outside this worker's editable scope. No existing test file was changed silently. Root full web regression may likewise contain old phone navigation expectations.

Manager should review the combined source, run integrated build/types/lint and coordinated synthetic web/mobile regressions, update obsolete test selectors, inspect responsive appearance/Transactions integration, and then rebuild/audit the APK. Do not install or clear the owner's currently imported phone data during review; no APK/device behavior or source-private-data preservation hash is claimed by this worker. The current Debt+/baseline/history/storage/accounting functions remain in place and were not migrated.

Per latest owner preference: report saved and final handoff in this worker chat only. No manager/other-chat completion notification, status polling or acknowledgement request.
