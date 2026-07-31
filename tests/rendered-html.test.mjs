import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("renders the DebtFree Dashboard shell", async () => {
  const [layout, client] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard-client.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(layout, /DebtFree Dashboard/i);
  assert.match(client, /Monthly Budget/i);
  assert.match(client, /Copy \{monthLabel\(shiftMonth\(month, -1\)\)\}/);
  assert.match(client, /Core transaction ledger/i);
  assert.match(client, /Batch entry/i);
  assert.match(client, /softDeleteTransaction/);
  assert.match(client, /ledger-pagination/);
  assert.match(client, /Monthly progress archive/i);
  assert.match(client, /captureSnapshot/);
  assert.match(client, /snapshot-chart/);
  assert.match(client, /SnapshotNoteEditor/);
  assert.match(client, /projectedDebtFreeMonth/);
  assert.match(client, /Revolving credit health/i);
  assert.match(client, /utilization-track/);
  assert.match(client, /What-if planner/i);
  assert.match(client, /Strategy comparison/i);
  assert.match(client, /Extra-payment scenarios/i);
  assert.doesNotMatch(client, /Coming later|FuturePage|>Soon</i);
  assert.match(client, /Add income/i);
  assert.match(client, /Add expense/i);
  assert.match(client, /Payoff Plan/i);
  assert.match(client, /Merchants &amp; recipients/);
  assert.match(client, /Merchant \/ recipient/);
  assert.match(client, /Who received the money/);
  assert.match(client, /The Account field above is the card or debt balance/);
  assert.match(client, /&lsaquo;/);
  assert.match(client, /&rsaquo;/);
  assert.match(client, /&times;/);
  assert.doesNotMatch(client, /\? Debit|\? Credit|month\?s|>\?</);
  assert.doesNotMatch(layout + client, /codex-preview|Building your site|react-loading-skeleton/i);
});

test("removes disposable starter assets", async () => {
  const [page, client, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  const dashboardSource = page + client;
  assert.match(dashboardSource, /DebtFree Dashboard/);
  assert.match(dashboardSource, /Import DebtFree CSV/);
  assert.match(dashboardSource, /extractDebtFreeAccounts/);
  assert.match(dashboardSource, /Avalanche/);
  assert.match(dashboardSource, /Snowball/);
  assert.match(dashboardSource, /CashflowItem/);
  assert.match(dashboardSource, /cashflowItems/);
  assert.match(dashboardSource, /Paid with/);
  assert.match(dashboardSource, /Select the card used for this expense/);
  assert.match(dashboardSource, /linkedCardExpenses/);
  assert.match(dashboardSource, /Minimums \+ linked card expenses \+ extra/);
  assert.match(dashboardSource, /\+ \{moneyPrecise\.format\(item\.amount\)\} \{item\.name\}/);
  assert.doesNotMatch(dashboardSource, /Includes \{moneyPrecise\.format\(cardExpense\)\} card expense/);
  assert.match(dashboardSource, /month-sticky/);
  assert.match(dashboardSource, /interest-sticky/);
  assert.match(dashboardSource, /remaining-sticky/);
  assert.match(dashboardSource, /Amount 2 Pay\/month/);
  assert.doesNotMatch(dashboardSource, /moneyPrecise\.format\(month\.payments\[account\.id\] \?\? 0\)\} paid/);
  assert.match(dashboardSource, /\/api\/household/);
  assert.match(dashboardSource, /Add admin/);
  assert.match(page, /requireChatGPTUser/);
  assert.match(dashboardSource, /never share your password/i);
  assert.match(dashboardSource, /monthlySurplus/);
  assert.match(dashboardSource, /Use my \$\{moneyPrecise\.format\(availableExtra\)\} available extra/);
  assert.match(dashboardSource, /Calculated after monthly expenses, budgets, and debt minimums\. Edit anytime/);
  assert.match(dashboardSource, /Estimated paid off date/);
  assert.match(dashboardSource, /Credit limit/);
  assert.match(dashboardSource, /minimum-only/);
  assert.match(dashboardSource, /Auto estimate/);
  assert.match(dashboardSource, /Starting debt/);
  assert.match(dashboardSource, /month\.balances/);
  assert.match(dashboardSource, /projectedMonthlyRate/);
  assert.match(dashboardSource, /Actual interest fee/);
  assert.match(dashboardSource, /planAccounts = accounts\.filter/);
  assert.match(dashboardSource, /\+ Add income/);
  assert.match(dashboardSource, /\+ Add expense/);
  assert.match(dashboardSource, /\+ Add budget/);
  assert.match(dashboardSource, /cashflow-columns/);
  assert.doesNotMatch(dashboardSource, /cashflow-tabs|Set-aside plan/);
  assert.doesNotMatch(dashboardSource, /<th>Focus<\/th>/);
  assert.match(layout, /focused personal dashboard for debt accounts and payoff planning/);
  assert.doesNotMatch(dashboardSource + layout + packageJson, /SkeletonPreview|codex-preview|react-loading-skeleton/);
  await assert.rejects(access(new URL("../app/_sites-preview", import.meta.url)));
});
test("supports a mobile dashboard shell and collapsible navigation", async () => {
  const [client, styles, store, page] = await Promise.all([
    readFile(new URL("../app/dashboard-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/api/household/store.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(client, /toggleDashboardNavigation/);
  assert.match(client, /Collapse dashboard navigation/);
  assert.match(client, /Expand dashboard navigation/);
  assert.match(client, /NAVIGATION_COLLAPSED_KEY/);
  assert.match(client, /sidebar-head/);
  assert.match(client, /mobile-dashboard-toggle/);
  assert.doesNotMatch(client, /<span>\{navigationCollapsed \? "Expand" : "Collapse"\}<\/span>/);
  assert.match(client, /A paid subscription is not required/);
  assert.match(store, /SELECT id FROM households LIMIT 1/);
  assert.match(page, /This account is not part of the shared household/);
  assert.doesNotMatch(client, /window\.close\(\)|Close dashboard/);
  assert.match(styles, /Mobile-first dashboard shell and collapsible navigation/);
  assert.match(styles, /dashboard-collapsed/);
  assert.match(styles, /grid-row:2/);
  assert.match(styles, /safe-area-inset-bottom/);
  assert.match(styles, /font-size:16px/);
});


test("exports a complete payoff report in CSV, Excel, and PDF formats", async () => {
  const [client, exporter, packageJson] = await Promise.all([
    readFile(new URL("../app/dashboard-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/payoff-export.ts", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  assert.match(client, /Export full report/);
  assert.match(client, /Budget, debts, schedule, transactions, and snapshots/);
  assert.match(client, /exportReport\("csv"\)/);
  assert.match(client, /exportReport\("excel"\)/);
  assert.match(client, /exportReport\("pdf"\)/);
  assert.match(exporter, /MONTHLY BUDGET BREAKDOWN/);
  assert.match(exporter, /DEBT ACCOUNTS/);
  assert.match(exporter, /PAYOFF SCHEDULE/);
  assert.match(exporter, /TRANSACTION LEDGER/);
  assert.match(exporter, /PAYOFF SNAPSHOTS/);
  assert.match(exporter, /function reportSheets/);
  assert.match(exporter, /Your complete payoff plan/);
  assert.match(exporter, /Page \$\{page\} of \$\{pageCount\}/);
  assert.match(packageJson, /"fflate"/);
  assert.match(packageJson, /"jspdf"/);
  assert.match(packageJson, /"jspdf-autotable"/);
});


test("uses explicit post-promo card terms in payoff forecasts", async () => {
  const [client, styles, releaseNotes] = await Promise.all([
    readFile(new URL("../app/dashboard-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../RELEASE_NOTES.md", import.meta.url), "utf8"),
  ]);
  assert.match(client, /promoEndDate: string/);
  assert.match(client, /postPromoApr: number/);
  assert.match(client, /postPromoMinimum: number/);
  assert.match(client, /function forecastMinimum/);
  assert.match(client, /account\.postPromoMinimum > 0/);
  assert.match(client, /The forecast keeps the current minimum; it does not silently estimate a higher one/);
  assert.match(client, /True Cost forecast/);
  assert.match(client, /forecast\.totalInterest/);
  assert.match(client, /forecast\.peakMonthly/);
  assert.match(client, /nonAmortizingAccountIds/);
  assert.match(client, /No payoff at this payment/);
  assert.match(styles, /true-cost-warning/);
  assert.match(styles, /promo-fields/);
  assert.match(releaseNotes, /Promo-aware payoff forecasting/);
  assert.match(releaseNotes, /non-amortizing balances/);
});
