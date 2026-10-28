import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { calculateMinimumPayoffPlan, calculatePayoffCalculator } from "../app/payoff-calculator.ts";
import { buildActualProgress, retainRemovedProgressAccount } from "../app/debt-activity.ts";
import { parseDashboardContract, parseDashboardJson, serializeDashboardBackup } from "../app/dashboard-data.ts";

const date = new Date("2026-10-08T12:00:00Z");
const account = (id, extra = {}) => ({ id, name: id, type: "Credit card", balance: 10000, baselineBalance: 10000, apr: 0, interestFee: 0, minimum: 900, minimumMode: "manual", payoffMode: "priority", creditLimit: 20000, dueDate: "", promoEndDate: "", postPromoApr: 0, postPromoMinimum: 0, createdAt: "2026-10-01", ...extra });

test("separate plan reserves every minimum inside the entered total, then follows priority", () => {
  const accounts = [account("one"), account("two")];
  const original = structuredClone(accounts);
  const result = calculateMinimumPayoffPlan(accounts, 7000, "custom", ["one", "two"], date);
  assert.equal(result.error, "");
  assert.deepEqual(result.plan.months[0].payments, { one: 6100, two: 900 });
  assert.deepEqual(result.plan.months.map(m => m.paid), [7000, 7000, 6000]);
  assert.ok(result.plan.months.every(m => m.paid <= 7000 && m.requiredMonthly === 7000));
  assert.deepEqual(accounts, original);
  const calculator = calculatePayoffCalculator(accounts, 7000, "custom", ["one", "two"], date);
  assert.equal(calculator.months[0].payments.one, 7000);
  assert.equal(calculator.months[0].payments.two ?? 0, 0);
});

test("plan rejects insufficient and missing minimums without raising the saved payment", () => {
  assert.match(calculateMinimumPayoffPlan([account("one"), account("two")], 1799.99, "avalanche", [], date).error, /1800.00/);
  assert.equal(calculateMinimumPayoffPlan([account("small", { balance: 20, minimum: 25 })], 20, "avalanche", [], date).plan.months[0].paid, 20);
  assert.match(calculateMinimumPayoffPlan([account("missing", { minimum: 0 })], 7000, "avalanche", [], date).error, /Set a minimum payment/);
  const promo = account("promo", { balance: 10000, minimum: 100, promoEndDate: "2026-10-31", postPromoApr: 24, postPromoMinimum: 900 });
  assert.match(calculateMinimumPayoffPlan([promo], 500, "avalanche", [], date).error, /2026-11/);
});

test("total-budget plan applies selected strategy consistently and excludes archived debts", () => {
  const result = calculateMinimumPayoffPlan([account("one"), account("two", { payoffMode: "minimum-only" }), account("archived", { archivedAt: "2026-10-01", minimum: 10000 })], 7000, "custom", ["two", "one"], date);
  assert.equal(result.error, "");
  assert.equal(result.plan.months[0].payments.two, 900);
  assert.equal(result.plan.months[0].payments.one, 6100);
  assert.equal(result.plan.months[0].payments.archived, undefined);
});

const tx = (id, type, amount, extra = {}) => ({ id, accountId: "card", date: "2026-10-08", createdAt: date.toISOString(), type, amount, payeeName: "", category: "", memo: "", ...extra });
const adjustment = { id: "adjust", accountId: "card", date: "2026-10-08", createdAt: date.toISOString(), difference: -100, balanceBefore: 970, balanceAfter: 870 };

test("Progress counts negative payments, credits and adjustments once regardless tags", () => {
  const card = account("card", { balance: 1000, baselineBalance: 1000, balanceOffset: -100 });
  const transactions = [tx("pay", "payment", 20), tx("credit", "payment", 10, { credit: true }), tx("fee", "fee", 5), tx("deleted", "payment", 500, { deletedAt: date.toISOString() })];
  const report = buildActualProgress([card], transactions, [adjustment], [], date, 1000);
  assert.equal(report.monthlyReductions, 130);
  assert.equal(report.monthlyIncreases, 5);
  assert.equal(report.monthlyChange, -125);
  assert.equal(report.reductionCount, 3);
  assert.equal(report.current, 875);
  const confirmed = buildActualProgress([card], transactions, [{ ...adjustment, confirmedPayment: { confirmedAt: date.toISOString() } }], [], date, 1000);
  assert.equal(confirmed.monthlyReductions, report.monthlyReductions);
  const corrected = transactions.map(t => t.id === "pay" ? { ...t, amount: 30, revisions: [t] } : t);
  assert.equal(buildActualProgress([card], corrected, [adjustment], [], date, 1000).monthlyReductions, 140);
  const deleted = corrected.map(t => t.id === "pay" ? { ...t, deletedAt: date.toISOString() } : t);
  assert.equal(buildActualProgress([card], deleted, [adjustment], [], date, 1000).monthlyReductions, 110);
  const backdated = corrected.map(t => t.id === "pay" ? { ...t, date: "2026-09-30" } : t);
  assert.equal(buildActualProgress([card], backdated, [adjustment], [], date, 1000).monthlyReductions, 110);
});

test("archive, removal, restoration and new accounts cannot falsely create repayment", () => {
  const card = account("card", { balance: 1000, baselineBalance: 1000, balanceOffset: -100 });
  const transactions = [tx("pay", "payment", 20)];
  const before = buildActualProgress([card], transactions, [adjustment], [], date, 1000);
  const retained = retainRemovedProgressAccount([], card, before.current, date.toISOString());
  const after = buildActualProgress([], transactions, [adjustment], [], date, 1000, retained);
  assert.equal(after.current, before.current);
  assert.equal(after.monthlyReductions, before.monthlyReductions);
  assert.equal(after.reduction, before.reduction);
  assert.equal(after.retainedCount, 1);
  assert.equal(buildActualProgress([{ ...card, archivedAt: date.toISOString() }], transactions, [adjustment], [], date, 1000).current, before.current);
  assert.equal(buildActualProgress([card], transactions, [adjustment], [], date, 1000, retained).current, before.current);
  assert.equal(buildActualProgress([card], transactions, [adjustment], [], date, 1000, retained).retainedCount, 0);
  assert.equal(retainRemovedProgressAccount(retained, card, before.current).length, 1);
  const added = buildActualProgress([card, account("new", { balance: 500, baselineBalance: 500 })], transactions, [adjustment], [], date, 1000);
  assert.equal(added.starting, 1500);
  assert.equal(added.monthlyReductions, before.monthlyReductions);
  assert.equal(added.reduction, before.reduction);
});

test("backup round trip preserves independent settings, removed balances and snapshots", () => {
  const backup = parseDashboardContract(JSON.parse(readFileSync(new URL("fixtures/legacy-v0.json", import.meta.url), "utf8")));
  backup.payload.monthlyPlan = { ...backup.payload.monthlyPlan, calculatorAmount: 3793, payoffPlanAmount: 5000, payoffPlanStrategy: "custom", payoffPlanOrder: ["card"], progressStartingBalance: 61871.72, removedProgressAccounts: retainRemovedProgressAccount([], account("card"), 875, date.toISOString()) };
  const restored = parseDashboardJson(serializeDashboardBackup(backup));
  assert.deepEqual(restored.payload.monthlyPlan, JSON.parse(JSON.stringify(backup.payload.monthlyPlan)));
  assert.deepEqual(restored.payload.snapshots, backup.payload.snapshots);
  restored.payload.monthlyPlan.payoffPlanAmount = -1;
  assert.throws(() => parseDashboardContract(restored), /payoffPlanAmount/);
});

test('per-debt baselines supersede the retained legacy total without changing it', () => {
  const original = account('a', { balance: 800, baselineBalance: 1000 });
  const added = account('b', { balance: 500, baselineBalance: 500 });
  const report = buildActualProgress([original, added], [], [], [], date, 1000);
  assert.equal(report.starting, 1500); assert.equal(report.current, 1300); assert.equal(report.reduction, 200);
  const archived = buildActualProgress([{ ...original, archivedAt: '2026-10-08' }, added], [], [], [], date, 1000);
  assert.equal(archived.current, report.current);
  const removed = retainRemovedProgressAccount([], added, 500);
  assert.equal(buildActualProgress([original], [], [], [], date, 1000, removed).current, 1300);
  const zero = buildActualProgress([added], [], [], [], date, 0);
  assert.equal(zero.starting, 500); assert.equal(zero.comparisonAvailable, true); assert.equal(zero.percent, 0);
  const zeroAccount=buildActualProgress([{...added,baselineBalance:0}],[],[],[],date,999);assert.equal(zeroAccount.starting,0);assert.equal(zeroAccount.percent,null);
});

test('unmatched historical snapshots never hide current debts or fabricate a baseline',()=>{
 const cards=[account('new-a'),account('new-b')];
 const snapshot={id:'old',month:'2026-01',capturedAt:'2026-01-01T12:00:00Z',totalBalance:5000,accounts:[{accountId:'missing',balance:5000,name:'Old',type:'Credit card',apr:0}]};
 const report=buildActualProgress(cards,[],[],[snapshot],date);
 assert.equal(report.current,20000);assert.equal(report.comparisonAvailable,true);assert.equal(report.percent,0);
 assert.equal(report.starting,20000);assert.equal(snapshot.totalBalance,5000);
 const added=buildActualProgress(cards,[],[],[{...snapshot,accounts:[{accountId:'new-a',balance:10000}]}],date);
 assert.equal(added.current,20000);assert.equal(added.starting,20000);assert.equal(added.percent,0);
});
