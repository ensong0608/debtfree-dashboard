import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createDashboardBackup, createDashboardPayload, createEmptyPlannedPayoff, parseDashboardContract, parseDashboardJson, serializeDashboardBackup } from "../app/dashboard-data.ts";
import { createBalanceAdjustment, createDebtPayment, DebtPaymentError, setDebtArchived } from "../app/debts-screen.ts";
import { buildHomeDashboard } from "../app/home-dashboard.ts";
import { calculatePlan } from "../app/payoff-engine.ts";
import { transactionAdjustedAccounts } from "../app/progress-balances.ts";

const createdAt = "2026-08-12T18:00:00.000Z";
const paymentDate = "2026-08-12";
const creator = { email: "member@example.com", displayName: "Household Member" };

function account(id, overrides = {}) {
  return {
    id, name: id, type: "Credit card", balance: 1000, apr: 20, interestFee: 0, minimum: 100,
    minimumMode: "manual", payoffMode: "priority", creditLimit: 2000, dueDate: "2026-08-20",
    promoEndDate: "", postPromoApr: 0, postPromoMinimum: 0, createdAt, ...overrides,
  };
}

function payment(debt, amount, overrides = {}) {
  return createDebtPayment({ account: debt, amount, date: paymentDate, createdAt, id: "payment-" + debt.id, creator, ...overrides });
}

test("payment reduces calculated balance exactly once with before/after audit values", () => {
  const debt = account("card");
  const transaction = payment(debt, 250, { note: "August payment" });
  const [current] = transactionAdjustedAccounts([debt], [transaction]);
  assert.equal(debt.balance, 1000);
  assert.equal(current.balance, 750);
  assert.equal(transaction.balanceBefore, 1000);
  assert.equal(transaction.balanceAfter, 750);
  assert.equal(transaction.memo, "August payment");
  assert.deepEqual(transaction.creator, creator);
});

test("payment audit metadata is informational and never double-counted", () => {
  const debt = account("card");
  const transaction = payment(debt, 250);
  const [current] = transactionAdjustedAccounts([debt], [transaction]);
  assert.equal(current.balance, debt.balance - transaction.amount);
  assert.equal(current.balance, 750);
});

test("payment immediately changes the payoff projection and Home next action", () => {
  const first = account("priority", { balance: 100, apr: 30, minimum: 50 });
  const second = account("next", { balance: 500, apr: 10, minimum: 50 });
  const beforeAccounts = [first, second];
  const beforePlan = calculatePlan(beforeAccounts, 50, "avalanche");
  const beforeHome = buildHomeDashboard({ accounts: beforeAccounts, openingAccounts: beforeAccounts, plan: beforePlan, extra: 50, strategy: "avalanche", planning: createEmptyPlannedPayoff(), snapshots: [], transactions: [], calculationDate: new Date("2026-08-12T12:00:00") });
  const finalPayment = payment(first, 100, { action: "mark-paid-off" });
  const afterAccounts = transactionAdjustedAccounts(beforeAccounts, [finalPayment]);
  const afterPlan = calculatePlan(afterAccounts, 50, "avalanche");
  const afterHome = buildHomeDashboard({ accounts: afterAccounts, openingAccounts: beforeAccounts, plan: afterPlan, extra: 50, strategy: "avalanche", planning: createEmptyPlannedPayoff(), snapshots: [], transactions: [finalPayment], calculationDate: new Date("2026-08-12T12:00:00") });
  assert.equal(beforeHome.nextPayment?.accountId, "priority");
  assert.equal(afterHome.nextPayment?.accountId, "next");
  assert.ok(afterPlan.totalInterest < beforePlan.totalInterest);
});

test("final partial payment is accepted and overpayment is rejected clearly", () => {
  const debt = account("card", { balance: 42.37 });
  assert.equal(payment(debt, 42.37).balanceAfter, 0);
  assert.throws(() => payment(debt, 42.38), (error) => error instanceof DebtPaymentError && /cannot exceed.*\$42\.37/i.test(error.message));
});

test("balance updates reconcile upward and downward without duplicate ledger effects", () => {
  const stored = account("card");
  const charge = { id: "charge", date: paymentDate, accountId: "card", payeeId: "", payeeName: "Merchant", type: "charge", category: "Other", memo: "", amount: 100, createdAt, updatedAt: createdAt, deletedAt: null };
  const current = transactionAdjustedAccounts([stored], [charge])[0];
  const upward = createBalanceAdjustment({ storedAccount: stored, currentBalance: current.balance, nextBalance: 1200, date: paymentDate, createdAt, id: "up" });
  assert.equal(upward.adjustment.balanceBefore, 1100);
  assert.equal(upward.adjustment.balanceAfter, 1200);
  assert.equal(upward.adjustment.difference, 100);
  assert.equal(transactionAdjustedAccounts([upward.account], [charge])[0].balance, 1200);
  const downward = createBalanceAdjustment({ storedAccount: upward.account, currentBalance: 1200, nextBalance: 900, date: paymentDate, createdAt, id: "down" });
  assert.equal(downward.adjustment.difference, -300);
  assert.equal(transactionAdjustedAccounts([downward.account], [charge])[0].balance, 900);
});

test("mark paid off retains the debt and archive/restore preserves history", () => {
  const debt = account("card", { balance: 75 });
  const finalPayment = payment(debt, 75, { action: "mark-paid-off" });
  const retained = transactionAdjustedAccounts([debt], [finalPayment]);
  assert.equal(retained.length, 1);
  assert.equal(retained[0].balance, 0);
  assert.equal(finalPayment.debtAction, "mark-paid-off");
  const archived = setDebtArchived(debt, true, createdAt, creator, "archive-1");
  const restored = setDebtArchived(archived, false, "2026-08-12T19:00:00.000Z", creator, "restore-1");
  assert.equal(archived.archivedAt, createdAt);
  assert.equal(restored.archivedAt, null);
  assert.deepEqual(restored.archiveHistory.map((entry) => entry.action), ["archived", "restored"]);
});

test("removed and archived debt references remain safe", () => {
  const archived = setDebtArchived(account("archived", { balance: 0 }), true, createdAt, creator, "archive");
  const orphanPayment = payment(account("removed"), 50);
  assert.deepEqual(transactionAdjustedAccounts([archived], [orphanPayment]).map((item) => item.id), ["archived"]);
});

test("v2 payload migration and full JSON backup retain Phase 5 history", () => {
  const payload = createDashboardPayload(null, {
    accounts: [account("card")], monthlyBudgets: {}, payees: [], transactions: [payment(account("card"), 25)],
    snapshots: [], extra: 0, strategy: "avalanche", planning: createEmptyPlannedPayoff(),
    balanceAdjustments: [{ id: "adjustment", accountId: "card", date: paymentDate, balanceBefore: 975, balanceAfter: 980, difference: 5, createdAt, note: "Statement", creator }],
  });
  const backup = createDashboardBackup(payload, null, createdAt);
  const reparsed = parseDashboardJson(serializeDashboardBackup(backup));
  assert.deepEqual(reparsed.payload.transactions[0].creator, creator);
  assert.equal(reparsed.payload.transactions[0].balanceAfter, 975);
  assert.deepEqual(reparsed.payload.balanceAdjustments, payload.balanceAdjustments);

  const v2 = structuredClone(backup);
  v2.version = 2;
  delete v2.payload.balanceAdjustments;
  const migrated = parseDashboardContract(v2);
  assert.equal(migrated.version, 3);
  assert.deepEqual(migrated.payload.balanceAdjustments, []);
});

test("desktop table, mobile stacked cards, explicit actions, and accessible dialogs are present", async () => {
  const [client, styles] = await Promise.all([
    readFile(new URL("../app/dashboard-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(client, /className="debt-table"/);
  assert.match(client, /className="debt-card-list"/);
  assert.match(client, />Record payment</);
  assert.match(client, />Update balance</);
  assert.match(client, />Mark paid off</);
  assert.match(client, />Archive</);
  assert.match(client, />Restore</);
  assert.match(client, /Advanced destructive action/);
  assert.match(client, /role="dialog" aria-modal="true" aria-labelledby="payment-modal-title" aria-describedby="payment-modal-description"/);
  assert.match(client, /role="dialog" aria-modal="true" aria-labelledby="balance-modal-title" aria-describedby="balance-modal-description"/);
  assert.match(client, /role="alert"/);
  assert.match(client, /event\.key === "Escape"/);
  assert.match(styles, /@media\(max-width:760px\)[\s\S]*\.debt-table-wrap\{display:none\}/);
  assert.match(styles, /\.debt-card-list\{display:grid/);
  assert.match(styles, /\.debt-action\{min-height:46px/);
});
