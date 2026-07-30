import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request("http://localhost/", { headers: { accept: "text/html" } }), { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } }, { waitUntil() {}, passThroughOnException() {} });
}

test("renders the DebtFree Dashboard shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<title>DebtFree Dashboard<\/title>/i);
  assert.match(html, /Monthly income &amp; expenses|Monthly income & expenses/i);
  assert.match(html, /Add income/i);
  assert.match(html, /Add expense/i);
  assert.match(html, /Payoff Plan/i);
  assert.doesNotMatch(html, /codex-preview|Building your site|react-loading-skeleton/i);
});

test("removes disposable starter assets", async () => {
  const [page, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  assert.match(page, /DebtFree Dashboard/);
  assert.match(page, /Import DebtFree CSV/);
  assert.match(page, /extractDebtFreeAccounts/);
  assert.match(page, /Avalanche/);
  assert.match(page, /Snowball/);
  assert.match(page, /CashflowItem/);
  assert.match(page, /cashflowItems/);
  assert.match(page, /Paid with/);
  assert.match(page, /Select the card used for this expense/);
  assert.match(page, /linkedCardExpenses/);
  assert.match(page, /Minimums \+ linked card expenses \+ extra/);
  assert.match(page, /Includes \{moneyPrecise\.format\(cardExpense\)\} card expense/);
  assert.match(page, /month-sticky/);
  assert.match(page, /interest-sticky/);
  assert.match(page, /remaining-sticky/);
  assert.match(page, /monthlySurplus/);
  assert.match(page, /Use my \$\{moneyPrecise\.format\(availableExtra\)\} available extra/);
  assert.match(page, /Calculated after monthly expenses, budgets, and debt minimums\. Edit anytime/);
  assert.match(page, /Estimated paid off date/);
  assert.match(page, /Credit limit/);
  assert.match(page, /minimum-only/);
  assert.match(page, /Auto estimate/);
  assert.match(page, /Starting debt/);
  assert.match(page, /month\.balances/);
  assert.match(page, /projectedMonthlyRate/);
  assert.match(page, /Actual interest fee/);
  assert.match(page, /planAccounts = accounts\.filter/);
  assert.match(page, /\+ Add income/);
  assert.match(page, /\+ Add expense/);
  assert.match(page, /\+ Add budget/);
  assert.match(page, /cashflow-columns/);
  assert.doesNotMatch(page, /cashflow-tabs|Set-aside plan/);
  assert.doesNotMatch(page, /<th>Focus<\/th>/);
  assert.match(layout, /focused personal dashboard for debt accounts and payoff planning/);
  assert.doesNotMatch(page + layout + packageJson, /SkeletonPreview|codex-preview|react-loading-skeleton/);
  await assert.rejects(access(new URL("../app/_sites-preview", import.meta.url)));
});