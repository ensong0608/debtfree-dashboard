import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { parseDashboardContract, serializeDashboardBackup, createEmptyPlannedPayoff } from "../app/dashboard-data.ts";
import { createBrowserDataRepository, DASHBOARD_STORAGE_KEY, DASHBOARD_BACKUP_STORAGE_KEY } from "../app/data-repository.ts";
import { HouseholdSync } from "../app/household-sync.ts";
import { createBalanceAdjustment } from "../app/debts-screen.ts";
import { transactionAdjustedAccounts, buildProgressBalanceView } from "../app/progress-balances.ts";
import { calculatePlan, forecastApr } from "../app/payoff-engine.ts";
import { buildHomeDashboard } from "../app/home-dashboard.ts";
import { paymentContext } from "../app/payment-context.ts";
import { debtPaymentProgress } from "../app/monthly-plan.ts";
import { readBoundedBody, requireWriteRevision } from "../app/request-safety.ts";
import { buildOnboardingPlan, createOnboardingPlanning, seedMonthlyPlan } from "../app/onboarding-plan.ts";
import { buildPayoffCsv } from "../app/payoff-export.ts";

const fixture = () => parseDashboardContract(JSON.parse(readFileSync(new URL("fixtures/legacy-v0.json", import.meta.url), "utf8")));
const storage = () => { const data = new Map(); return { getItem: k => data.get(k) ?? null, setItem: (k,v) => data.set(k,v), removeItem: k => data.delete(k) }; };
const account = (overrides = {}) => ({ ...fixture().payload.accounts[0], id: "a", balance: 1000, minimum: 100, minimumMode: "manual", apr: 0, interestFee: 0, ...overrides });
const payment = (overrides = {}) => ({ id: "p", accountId: "a", type: "payment", amount: 100, paymentKind: "minimum", date: "2026-09-13", createdAt: "2026-09-13T12:00:00Z", deletedAt: null, memo: "", payeeName: "Card", ...overrides });

test("pre-import checkpoint survives timestamp-only autosave and later edits", async () => {
  const store = storage(); const repo = createBrowserDataRepository(p => p.accounts.length > 0, () => store);
  const old = fixture(); await repo.saveHousehold(old); await repo.checkpoint(old);
  const next = structuredClone(old); next.payload.accounts[0].name = "Imported";
  await repo.saveHousehold(next); next.exportedAt = "2026-09-13T12:00:01Z"; await repo.saveHousehold(next);
  assert.equal(JSON.parse(store.getItem(DASHBOARD_BACKUP_STORAGE_KEY)).payload.accounts[0].name, old.payload.accounts[0].name);
  next.payload.accounts[0].balance = 10; await repo.saveHousehold(next);
  assert.deepEqual((await repo.loadCheckpoint()).payload, old.payload);
  assert.ok(store.getItem(DASHBOARD_STORAGE_KEY));
});

test("valid empty primary does not resurrect the rotating backup", async () => {
  const store = storage(); const repo = createBrowserDataRepository(p => p.accounts.length > 0, () => store);
  const old = fixture(); await repo.saveHousehold(old);
  const empty = structuredClone(old); empty.payload.accounts = []; await repo.saveHousehold(empty);
  assert.equal((await repo.loadHousehold()).contract.payload.accounts.length, 0);
});

test("signed correction reconciles below posted charges and survives export", () => {
  const a = account({ balance: 100 }); const charge = payment({ type: "charge", amount: 300 });
  const result = createBalanceAdjustment({ storedAccount: a, currentBalance: 400, nextBalance: 50, date: "2026-09-13" });
  const backup = fixture(); backup.payload.accounts = [result.account]; backup.payload.transactions = [];
  const restored = parseDashboardContract(JSON.parse(serializeDashboardBackup(backup)));
  assert.equal(transactionAdjustedAccounts(restored.payload.accounts, [charge])[0].balance, 50);
  assert.equal(result.adjustment.balanceAfter, 50);
  assert.equal(result.account.baselineBalance, 100);
  assert.equal(transactionAdjustedAccounts([a], [charge], false)[0].balance, 400);
});

test("recorded payoff preserves commitment and current payments are not requested twice", () => {
  const a = account({ balance: 100 }); const b = account({ id: "b", balance: 1000 });
  const payments = [payment()]; const adjusted = transactionAdjustedAccounts([a,b], payments);
  const plan = calculatePlan(adjusted, 100, "avalanche", {}, {}, new Date(2026,8,13), {}, paymentContext(payments, "2026-09", 300));
  assert.equal(plan.monthly, 300); assert.equal(plan.months[0].paid, 200); assert.equal(plan.months[1].paid, 300);
  const solo = account(); const current = transactionAdjustedAccounts([solo], payments);
  const soloPlan = calculatePlan(current, 0, "avalanche", {}, {}, new Date(2026,8,13), {}, paymentContext(payments, "2026-09", 100));
  const home = buildHomeDashboard({ accounts: current, openingAccounts: [solo], plan: soloPlan, extra: 0, strategy: "avalanche", planning: createEmptyPlannedPayoff(), snapshots: [], transactions: payments, calculationDate: new Date(2026,8,13) });
  assert.equal(home.nextPayment, null); assert.equal(soloPlan.months[0].paid, 0); assert.equal(soloPlan.stalled, false);
});

test("final payments remain in the monthly totals", () => {
  const rows = debtPaymentProgress([account({ balance: 0, archivedAt: "2026-09-13" })], {}, [payment({ amount: 1000 })], "2026-09");
  assert.equal(rows.reduce((sum, r) => sum + r.paid, 0), 1000);
});

test("snapshot history remains immutable after account changes", () => {
  const snap = { id: "s", month: "2026-08", capturedAt: "2026-08-31", totalBalance: 750, accounts: [] };
  assert.equal(buildProgressBalanceView([account()], [], [snap]).snapshots[0].totalBalance, 750);
});

test("imports reject duplicate identities and impossible calendar dates", () => {
  let backup = fixture(); backup.payload.accounts.push({ ...backup.payload.accounts[0] });
  assert.throws(() => parseDashboardContract(backup), /duplicates/);
  backup = fixture(); backup.payload.accounts[0].dueDate = "2026-02-30";
  assert.throws(() => parseDashboardContract(backup), /valid.*date/);
});

test("promo rate switches after its exact inclusive expiration day", () => {
  const a = account({ promoEndDate: "2026-09-13", postPromoApr: 30 });
  assert.equal(forecastApr(a, 1, new Date(2026,8,12)), 0);
  assert.equal(forecastApr(a, 1, new Date(2026,8,13)), 0);
  assert.equal(forecastApr(a, 1, new Date(2026,8,14)), 30);
});

test("onboarding seeds income, expenses and buffer without replacing existing months", () => {
  const planning = createOnboardingPlanning(); planning.incomeSources[0] = { id: "income", name: "Salary", monthlyTakeHome: 4000, assignment: "household" };
  planning.essentialExpenses.housing = 1500; planning.essentialExpenses.safetyBuffer = 250;
  planning.debts = [{ ...account(), assignment: "household" }]; planning.capacity.monthlyAmount = 500;
  const result = buildOnboardingPlan(planning); const settings = { detailedSpendingTracking: false, months: {} };
  const seeded = seedMonthlyPlan(result, "2026-09", {}, settings);
  assert.equal(seeded.monthlyBudgets["2026-09"].length, 2); assert.equal(seeded.monthlyPlan.months["2026-09"].safetyBuffer, 250);
  assert.deepEqual(seedMonthlyPlan(result, "2026-09", { "2026-09": [] }, settings).monthlyBudgets["2026-09"], []);
});

test("request limits count bytes and obsolete clients must supply revisions", async () => {
  await assert.rejects(readBoundedBody(new Request("http://localhost", { method: "PUT", body: "ééé" }), 5), /too large/);
  assert.throws(() => requireWriteRevision('{"payload":{}}'), /revision/);
  assert.equal(requireWriteRevision('{"revision":0}'), 0);
});

function fakeCloud() {
  let revision = 0, contract = fixture();
  const writes = [];
  const request = async (_url, init) => {
    if (init?.method === "PUT") {
      const body = JSON.parse(init.body); writes.push(body);
      if (body.revision !== revision) return Response.json({}, { status: 409 });
      contract = body.payload; revision++;
      return Response.json({ revision });
    }
    return Response.json({ revision, payload: contract, role: "owner", householdName: "Test", members: [] });
  };
  return { request, writes, current: () => contract };
}

test("two sessions cannot erase each other's edits and conflict draft survives reload", async () => {
  const cloud = fakeCloud(); const store = storage(); let status;
  const a = new HouseholdSync({ storage: store, key: "a", request: cloud.request, status: () => {} });
  const b = new HouseholdSync({ storage: store, key: "b", request: cloud.request, status: s => { status = s; } });
  const first = await a.load(); const second = await b.load();
  first.contract.payload.extra = 125; a.stage(first.contract); await a.flush();
  second.contract.payload.extra = 999; b.stage(second.contract); await b.flush();
  assert.equal(status, "conflict"); assert.equal(cloud.current().payload.extra, 125);
  const reloaded = new HouseholdSync({ storage: store, key: "b", request: cloud.request, status: s => { status = s; } });
  assert.equal((await reloaded.load()).contract.payload.extra, 999); assert.equal(status, "conflict");
  a.dispose(); b.dispose(); reloaded.dispose();
});

test("network failure retains pending draft and retry reconciles an acknowledged write", async () => {
  const cloud = fakeCloud(); const store = storage(); let fail = true;
  const request = async (url, init) => { const response = await cloud.request(url,init); if (init?.method === "PUT" && fail) { fail = false; throw new Error("lost response"); } return response; };
  const a = new HouseholdSync({ storage: store, key: "a", request, status: () => {} });
  const loaded = await a.load(); loaded.contract.payload.extra = 77; a.stage(loaded.contract); await a.flush(); assert.ok(a.pending);
  await a.load(); assert.equal(a.pending, null); assert.equal(cloud.writes.length, 1); a.dispose();
});

test("CSV keeps imported text literal while preserving numeric fields", () => {
  const csv = buildPayoffCsv({ generatedAt: "2026-09-13", cashflow: [{ type: "Income", name: "=1+1", category: "Salary", amount: 12, paymentMethod: "Debit", linkedAccount: "" }], accounts: [], schedule: [], transactions: [], snapshots: [] });
  assert.match(csv, /'=1\+1/); assert.match(csv, /Salary,12,Debit/);
});

test("historical minimum targets survive payoff and current minimum changes", () => {
  const rows = debtPaymentProgress([account({ balance: 0, minimum: 0 })], { a: 100 }, [payment()], "2026-09", { a: 100 });
  assert.equal(rows[0].minimumTarget, 100);
  assert.equal(rows[0].minimumPaid, 100);
  assert.equal(rows[0].remaining, 0);
});

test("saved first-month minimum does not shrink after a partial payment", () => {
  const plan = calculatePlan([account({ balance: 950, minimum: 100 })], 0, "avalanche", {}, {}, new Date(2026,8,14), {}, { monthlyCommitment: 100, paid: { a: 50 }, minimumPaid: { a: 50 }, minimumTargets: { a: 100 } });
  assert.equal(plan.months[0].payments.a, 50);
  assert.equal(plan.months[1].payments.a, 100);
});

test("large household calculation stays within an interactive budget", () => {
  const accounts = Array.from({length: 100}, (_,i) => account({id: "large-"+i, balance: 1000+i*10, apr: 12}));
  const started = performance.now();
  const plan = calculatePlan(accounts, 1000, "avalanche");
  assert.ok(plan.months.length > 0 && !plan.stalled);
  assert.ok(performance.now() - started < 2000, "100-account forecast should complete within two seconds");
});
