import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createDashboardBackup, createDashboardPayload, createEmptyPlannedPayoff, parseDashboardContract, parseDashboardJson, serializeDashboardBackup } from "../app/dashboard-data.ts";
import { createDebtPayment } from "../app/debts-screen.ts";
import { calculateMonthlyPlan, copyRecurringPlannedItems, debtPaymentProgress, spentForPlannedItem } from "../app/monthly-plan.ts";
import { calculatePlan } from "../app/payoff-engine.ts";
import { transactionAdjustedAccounts } from "../app/progress-balances.ts";

const account = { id: "card", name: "Booking", type: "Credit card", balance: 2000, apr: 0, interestFee: 0, minimum: 100, minimumMode: "manual", payoffMode: "priority", creditLimit: 5000, dueDate: "", promoEndDate: "", postPromoApr: 0, postPromoMinimum: 0, createdAt: "2026-08-01" };
const expense = { id: "rent", name: "Rent", kind: "expense", category: "Housing", amount: 1000, paymentMethod: "debit", creditAccountId: "", createdAt: "2026-08-01", recurring: true };
const linked = { id: "hotel", name: "Hotel", kind: "purchase", category: "Travel", amount: 300, paymentMethod: "credit", creditAccountId: "card", createdAt: "2026-08-01", recurring: false };
const income = { id: "salary", name: "Salary", kind: "income", category: "Salary", amount: 3000, paymentMethod: "debit", creditAccountId: "", createdAt: "2026-08-01", recurring: true };
function transaction(id, overrides = {}) { return { id, date: "2026-08-12", accountId: "card", payeeId: "merchant", payeeName: "Merchant", type: "charge", category: "Travel", memo: "", amount: 300, createdAt: "2026-08-12T12:00:00Z", updatedAt: "2026-08-12T12:00:00Z", deletedAt: null, ...overrides }; }
function payload(overrides = {}) { return { accounts: [account], monthlyBudgets: { "2026-08": [income, expense, linked] }, payees: [], transactions: [], snapshots: [], extra: 0, strategy: "avalanche", planning: createEmptyPlannedPayoff(), balanceAdjustments: [], monthlyPlan: { detailedSpendingTracking: false, months: { "2026-08": { safetyBuffer: 200, debtPaymentTarget: 800 } } }, ...overrides }; }

test("planned entries do not change current debt balances", () => assert.equal(transactionAdjustedAccounts([account], [], false)[0].balance, 2000));
test("actual charges change balances exactly once only when detailed tracking is enabled", () => {
  const charge = transaction("charge", { plannedItemId: "hotel" });
  assert.equal(transactionAdjustedAccounts([account], [charge], true)[0].balance, 2300);
  assert.equal(transactionAdjustedAccounts([account], [charge], false)[0].balance, 2000);
});
test("recorded Phase 5 payments change balances exactly once even when tracking is disabled", () => {
  const payment = createDebtPayment({ account, amount: 1100, date: "2026-08-11", paymentKind: "extra", createdAt: "2026-08-11T12:00:00Z" });
  assert.equal(transactionAdjustedAccounts([account], [payment], false)[0].balance, 900);
  assert.equal(transactionAdjustedAccounts([account], [payment], true)[0].balance, 900);
});
test("debt payments are not counted again as household spending", () => {
  const payment = createDebtPayment({ account, amount: 100, date: "2026-08-11", paymentKind: "minimum", createdAt: "2026-08-11T12:00:00Z" });
  assert.equal(calculateMonthlyPlan([income, expense], [payment], "2026-08", { safetyBuffer: 0, debtPaymentTarget: 0 }, true).spent, 0);
});
test("matched planned and actual card purchases are not projected twice", () => {
  const chargedBalance = transactionAdjustedAccounts([account], [transaction("actual", { plannedItemId: "hotel" })], true);
  const oldDuplicated = calculatePlan(chargedBalance, 0, "avalanche", {}, { card: 300 }, new Date(2026, 7, 12));
  const corrected = calculatePlan(chargedBalance, 0, "avalanche", {}, { card: 300 }, new Date(2026, 7, 12), { card: 300 });
  assert.equal(oldDuplicated.months[0].balances.card - corrected.months[0].balances.card, 300);
});
test("tracking defaults disabled for a new user", () => {
  const migrated = parseDashboardContract({ accounts: [], monthlyBudgets: {}, payees: [], transactions: [], snapshots: [], extra: 0, strategy: "avalanche" });
  assert.equal(migrated.payload.monthlyPlan.detailedSpendingTracking, false);
});
test("legacy users with transaction or payee data retain detailed access after migration", () => {
  const legacy = payload({ payees: [{ id: "p", name: "Merchant", createdAt: "2026-08-01", deletedAt: null }] });
  delete legacy.monthlyPlan;
  const migrated = parseDashboardContract(legacy);
  assert.equal(migrated.payload.monthlyPlan.detailedSpendingTracking, true);
});
test("disabling and re-enabling tracking hides calculations without deleting advanced data", () => {
  const charge = transaction("charge");
  const original = payload({ transactions: [charge], payees: [{ id: "merchant", name: "Merchant", createdAt: "2026-08-01", deletedAt: null }] });
  const disabled = { ...original, monthlyPlan: { ...original.monthlyPlan, detailedSpendingTracking: false } };
  assert.equal(calculateMonthlyPlan(original.monthlyBudgets["2026-08"], original.transactions, "2026-08", original.monthlyPlan.months["2026-08"], false).spent, 0);
  assert.deepEqual(disabled.transactions, original.transactions);
  assert.equal(calculateMonthlyPlan(original.monthlyBudgets["2026-08"], original.transactions, "2026-08", original.monthlyPlan.months["2026-08"], true).spent, 300);
});
test("safety buffer and available debt payment follow the explicit formula", () => {
  const result = calculateMonthlyPlan([income, expense], [], "2026-08", { safetyBuffer: 200, debtPaymentTarget: 800 }, false);
  assert.equal(result.safetyBuffer, 200);
  assert.equal(result.availableDebtPayment, 1800);
});
test("copying forward includes recurring items and excludes one-time adjustments", () => {
  const copied = copyRecurringPlannedItems([income, expense, linked], "2026-09-01", (item) => "copy-" + item.id);
  assert.deepEqual(copied.map((item) => item.id), ["copy-salary", "copy-rent"]);
  assert.ok(copied.every((item) => item.createdAt === "2026-09-01"));
});
test("Planned, Spent, and Remaining use different sources of truth", () => {
  const result = calculateMonthlyPlan([expense, linked], [transaction("actual", { amount: 250, plannedItemId: "hotel" })], "2026-08", { safetyBuffer: 0, debtPaymentTarget: 0 }, true);
  assert.deepEqual({ planned: result.plannedSpending, spent: result.spent, remaining: result.remaining }, { planned: 1300, spent: 250, remaining: 1050 });
  assert.equal(spentForPlannedItem("hotel", [transaction("actual", { amount: 250, plannedItemId: "hotel" })], "2026-08", true), 250);
});
test("extra-only payments leave a statement minimum explicitly planned", () => {
  const payment = createDebtPayment({ account, amount: 1100, date: "2026-08-11", paymentKind: "extra", createdAt: "2026-08-11T12:00:00Z" });
  const progress = debtPaymentProgress([account], { card: 1200 }, [payment], "2026-08")[0];
  assert.deepEqual({ minimumPaid: progress.minimumPaid, extraPaid: progress.extraPaid, remainingMinimum: progress.remainingMinimum, remainingExtra: progress.remainingExtra }, { minimumPaid: 0, extraPaid: 1100, remainingMinimum: 100, remainingExtra: 0 });
});
test("Phase 6 JSON round trip retains disabled advanced data and unknown fields", () => {
  const source = payload({ transactions: [transaction("actual", { plannedItemId: "hotel" })], payees: [{ id: "merchant", name: "Merchant", createdAt: "2026-08-01", deletedAt: null }], futureField: { retained: true } });
  const backup = createDashboardBackup(createDashboardPayload(null, source), null, "2026-08-12T12:00:00Z");
  const restored = parseDashboardJson(serializeDashboardBackup(backup));
  assert.equal(restored.version, 4);
  assert.equal(restored.payload.monthlyPlan.detailedSpendingTracking, false);
  assert.equal(restored.payload.transactions[0].plannedItemId, "hotel");
  assert.deepEqual(restored.payload.futureField, { retained: true });
});
test("desktop, tablet, phone, accessible labels, and validation are present", async () => {
  const [page, styles, client] = await Promise.all([readFile(new URL("../app/monthly-plan-page.tsx", import.meta.url), "utf8"), readFile(new URL("../app/globals.css", import.meta.url), "utf8"), readFile(new URL("../app/dashboard-client.tsx", import.meta.url), "utf8")]);
  assert.match(page, /<h1>Monthly Plan<\/h1>/);
  assert.match(page, /Enable detailed spending tracking/);
  assert.match(page, /aria-label="Planned, spent, and remaining"/);
  assert.match(page, /aria-label="Cash cushion \(monthly safety buffer\)"/);
  assert.match(page, /role="alert"/);
  assert.match(styles, /@media\(max-width:1100px\)/);
  assert.match(styles, /@media\(max-width:700px\)/);
  assert.match(client, /detailedSpendingTracking && <TransactionsPage/);
  assert.match(client, /plannedItems=\{planningCashflowItems\}/);
  assert.match(page, /Payoff Plan calls for/);
  assert.match(page, /Cash cushion to keep/);
  assert.match(client, /\["charge", "payment", "fee"\]/);
  assert.match(client, /transactionDraft\.type === "payment" && !editingTransactionId/);
  assert.match(client, /createDebtPayment\(\{ account, amount: transactionDraft\.amount/);
  assert.match(client, /paymentKind: transactionDraft\.paymentKind/);
  assert.doesNotMatch(client, /\u00c3|\u00c2|\u00e2|\ufffd/);
  assert.doesNotMatch(styles, /\u00c3|\u00c2|\u00e2|\ufffd/);
});

test("Quick Add payment remains an audited single balance-changing action", async () => {
  const client = await readFile(new URL("../app/dashboard-client.tsx", import.meta.url), "utf8");
  assert.match(client, /Payments use the audited debt-payment action and reduce the balance exactly once/);
  assert.match(client, /A payment is never counted as household spending/);
});
