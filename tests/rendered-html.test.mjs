import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("renders the DebtFree Dashboard shell and optional detail tools", async () => {
  const [layout, client, monthly] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/monthly-plan-page.tsx", import.meta.url), "utf8"),
  ]);
  const source = client + monthly;
  assert.match(layout, /DebtFree Dashboard/i);
  assert.match(source, /Monthly Plan/i);
  assert.doesNotMatch(source, /Monthly Budget/i);
  assert.match(monthly, /Copy recurring items/i);
  assert.match(client, /Searchable transaction ledger/i);
  assert.match(client, /Batch entry/i);
  assert.match(client, /softDeleteTransaction/);
  assert.match(client, /ledger-pagination/);
  assert.match(client, /captureSnapshot/);
  assert.match(client, /onUpdateNote=\{updateSnapshotNote\}/);
  assert.match(client, /Revolving credit health/i);
  assert.match(client, /DebtInsightsPage/);
  assert.doesNotMatch(client, /Strategy comparison/i);
  assert.match(monthly, /title: "One-time"/);
  assert.match(monthly, /title: "Income"/);
  assert.match(monthly, /title: "Spending"/);
  assert.doesNotMatch(monthly, /Enable detailed spending tracking/i);
  assert.match(client, /Merchants &amp; recipients/);
  assert.match(client, /Who received the money/);
  assert.match(client, /&times;/);
  assert.doesNotMatch(layout + source, /codex-preview|Building your site|react-loading-skeleton/i);
});
test("supports complete JSON backup transfer between dashboard origins", async () => {
  const [client, styles, contract, repository, safety] = await Promise.all([
    readFile(new URL("../app/dashboard-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/data-repository.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/data-safety-panel.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(contract, /debtfree-dashboard-backup/);
  assert.match(safety, /Export full backup/);
  assert.match(safety, /Import full backup/);
  assert.match(client, /monthlyBudgets, payees, transactions, snapshots, extra, strategy/);
  assert.match(repository, /interface DataRepository/);
  assert.match(client, /repository\.importData\(await file\.text\(\)\)/);
  assert.match(client, /resolveDashboardImport\(currentContract, incoming, mode\)/);
  assert.match(safety, /Replace current data/);
  assert.match(safety, /Merge with current data/);
  assert.match(client, /Local device storage only/);
  assert.match(client, /deviceSaveStatus === "synced" \? "Saved on device"/);
  assert.match(client, /profile-grid device-only-profile/);
  assert.doesNotMatch(client, /function DataTransferPanel/);
  assert.match(styles, /data-transfer-card/);
  assert.match(styles, /data-transfer-actions/);
  assert.match(safety, /role=\{message\.startsWith\("Import failed"\)/);
  assert.match(styles, /overflow-wrap:anywhere/);
  assert.match(styles, /profile-grid\.device-only-profile/);
});

test("simplifies monthly planning and copies recurring entries", async () => {
  const [client, monthly, styles] = await Promise.all([
    readFile(new URL("../app/dashboard-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/monthly-plan-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(client, /copyRecurringPlannedItems/);
  assert.match(monthly, /Select plan month/i);
  assert.match(monthly, /Planned entries/i);
  assert.match(monthly, /One-time adjustments are never copied/i);
  assert.match(styles, /Phase 6 Monthly Plan/);
});
test("removes disposable starter assets", async () => {
  const [page, client, monthly, payoffEngine, progressReport, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/monthly-plan-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/payoff-engine.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/progress-report-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  const dashboardSource = page + client + monthly + payoffEngine + progressReport;
  assert.match(layout, /DebtFree Dashboard/);
  assert.match(dashboardSource, /Import DebtFree CSV/);
  assert.match(dashboardSource, /extractDebtFreeAccounts/);
  const calculator = await readFile(new URL("../app/payoff-calculator-page.tsx", import.meta.url), "utf8");
  assert.match(calculator, /Avalanche/);
  assert.match(calculator, /Snowball/);
  assert.match(calculator, /Custom/);
  assert.match(dashboardSource, /CashflowItem/);
  assert.match(dashboardSource, /cashflowItems/);
  assert.match(dashboardSource, /Paid with/);
  assert.match(dashboardSource, /Select the card used for this/);
  assert.match(dashboardSource, /linkedCardExpenses/);
  assert.doesNotMatch(dashboardSource, /Includes \{moneyPrecise\.format\(cardExpense\)\} card expense/);
  assert.doesNotMatch(dashboardSource, /month-sticky|interest-sticky|remaining-sticky|month-plan-head/);
  assert.match(calculator, /plan-table-summary/);
  assert.match(calculator, /Custom payoff order/);
  assert.match(calculator, /Move up/);
  assert.match(calculator, /Ending balance/);
  assert.doesNotMatch(dashboardSource, /moneyPrecise\.format\(month\.payments\[account\.id\] \?\? 0\)\} paid/);
  assert.match(dashboardSource, /\/api\/household/);
  assert.match(dashboardSource, /Add member/);
  assert.match(page, /getAuthenticatedUser/);
  assert.match(page, /Local device storage only/);
  assert.match(dashboardSource, /signs in with Google/i);
  assert.match(dashboardSource, /Estimated paid off date/);
  assert.match(dashboardSource, /Credit limit/);
  assert.match(dashboardSource, /minimum-only/);
  assert.match(dashboardSource, /Auto estimate/);
  assert.match(calculator, /Starting debt/);
  assert.match(calculator, /month\.balances/);
  assert.match(dashboardSource, /projectedMonthlyRate/);
  assert.match(dashboardSource, /Actual interest fee/);
  assert.match(calculator, /active = accounts\.filter/);
  assert.match(dashboardSource, /title: "Income"/);
  assert.match(dashboardSource, /title: "Spending"/);
  assert.match(dashboardSource, /monthly-plan-groups/);
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
  assert.match(client, /signs in with Google/);
  assert.match(store, /SELECT id FROM households LIMIT 1/);
  assert.match(page, /This account is not part of the shared household/);
  assert.doesNotMatch(client, /window\.close\(\)|Close dashboard/);
  assert.match(styles, /Mobile-first dashboard shell and collapsible navigation/);
  assert.match(styles, /dashboard-collapsed/);
  assert.match(styles, /grid-row:2/);
  assert.match(styles, /safe-area-inset-bottom/);
  assert.match(styles, /font-size:16px/);
  assert.match(styles, /Compact desktop payoff workspace/);
  assert.match(styles, /\.payoff-table thead th \{ position:sticky/);
  assert.match(styles, /\.plan-screen\{\s*height:calc\(100dvh - 72px\)/);
  assert.match(styles, /\.plan-scroll\{[^}]*flex:1 1 auto;overflow:auto/);
  assert.match(styles, /scrollbar-gutter:stable/);
});


test("exports a complete payoff report in CSV, Excel, and PDF formats", async () => {
  const [client, exporter, packageJson] = await Promise.all([
    readFile(new URL("../app/payoff-calculator-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/payoff-export.ts", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  assert.match(client, /Export calculation/);
  assert.match(client, /totalMinimums: 0/);
  assert.match(client, /exportReport\(format\)/);
  assert.match(client, /\["csv", "excel", "pdf"\]/);
  assert.match(exporter, /MONTHLY PLAN BREAKDOWN/);
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
  const [client, engine, styles, releaseNotes, contract] = await Promise.all([
    readFile(new URL("../app/dashboard-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/payoff-engine.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../RELEASE_NOTES.md", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard-data.ts", import.meta.url), "utf8"),
  ]);
  assert.match(contract, /promoEndDate: string/);
  assert.match(contract, /postPromoApr: number/);
  assert.match(contract, /postPromoMinimum: number/);
  assert.match(client, /from "\.\/payoff-engine"/);
  assert.match(engine, /function forecastMinimum/);
  assert.match(engine, /account\.postPromoMinimum > 0/);
  assert.match(engine, /promoMinimumFallbackIds/);
  assert.match(engine, /nonAmortizingAccountIds/);
  assert.match(client, /PayoffCalculatorPage/);
  assert.match(styles, /true-cost-warning/);
  assert.match(styles, /promo-fields/);
  assert.match(releaseNotes, /Promo-aware payoff forecasting/);
  assert.match(releaseNotes, /non-amortizing balances/);
});

test("keeps the direct Cloudflare Worker deployment reproducible", async () => {
  const [wranglerSource, packageSource] = await Promise.all([
    readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  const wrangler = JSON.parse(wranglerSource);
  const packageJson = JSON.parse(packageSource);
  assert.equal(wrangler.name, "debtfree-dashboard");
  assert.equal(wrangler.main, "worker/index.ts");
  assert.deepEqual(wrangler.compatibility_flags, ["nodejs_compat"]);
  assert.equal(wrangler.assets.binding, "ASSETS");
  assert.equal(wrangler.d1_databases[0].binding, "DB");
  assert.equal(wrangler.d1_databases[0].database_name, "debtfree-dashboard-prod");
  assert.equal(wrangler.images.binding, "IMAGES");
  assert.match(packageJson.scripts["deploy:cloudflare"], /dist\/server\/wrangler\.json/);
  assert.equal(packageJson.scripts.deploy, "npm run deploy:cloudflare");
  assert.match(packageJson.scripts["deploy:check"], /--dry-run/);
  assert.equal(packageJson.scripts["sites:prepare"], undefined);
  assert.match(packageJson.scripts["db:migrate:cloudflare"], /migrations apply/);
});

test("pays linked credit-card one-time purchases in the current payoff month only", async () => {
  const [client, engine, payoffPlan] = await Promise.all([
    readFile(new URL("../app/dashboard-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/payoff-engine.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/payoff-plan.ts", import.meta.url), "utf8"),
  ]);
  assert.match(client, /item\.kind === "purchase"/);
  assert.match(client, /linkedCardPurchases/);
  assert.match(engine, /actualizedLinkedCardExpenses/);
  assert.match(engine, /Math\.max\(0, \(linkedCardExpenses\[accountId\]/);
  assert.match(engine, /oneTimePurchaseTotal - paidThisMonth/);
  assert.match(engine, /scheduledPayment = \(minimums\[account\.id\] \?\? 0\) \+ cardChargeForMonth\(account\.id, month\)/);
  assert.match(payoffPlan, /month\.month === 1 \? linkedCardPurchases\[account\.id\] \?\? 0 : 0/);
  assert.match(client, /linkedCardPurchases, new Date/);
});
test("uses verified personal email accounts with household admin and viewer roles", async () => {
  const [auth, client, householdRoute, membersRoute, schema, wranglerSource] = await Promise.all([
    readFile(new URL("../app/cloudflare-auth.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/household-api.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/household/members/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8"),
  ]);
  const wrangler = JSON.parse(wranglerSource);
  assert.match(auth, /cf-access-jwt-assertion/);
  assert.match(auth, /verifyAccessIdentity/);
  assert.match(auth, /CF_ACCESS_TEAM_DOMAIN/);
  assert.match(auth, /CF_ACCESS_AUD/);
  assert.match(auth, /verifyAccessIdentity/);
  assert.doesNotMatch(auth, /oai-authenticated-user-email/);
  assert.match(client, /HouseholdRole = "owner" \| "admin" \| "viewer"/);
  assert.match(client, /Viewer access/);
  assert.match(client, /viewer-readonly-surface/);
  assert.match(client, /Household members/);
  assert.match(client, /<option value="viewer">Viewer<\/option>/);
  assert.match(householdRoute, /Viewer access is read-only/);
  assert.match(membersRoute, /\["admin", "viewer"\]/);
  assert.match(schema, /\["owner", "admin", "viewer"\]/);
  assert.equal(wrangler.vars.CF_ACCESS_TEAM_DOMAIN, "https://ensong0608.cloudflareaccess.com");
  assert.equal(wrangler.vars.CF_ACCESS_AUD.length, 64);
});