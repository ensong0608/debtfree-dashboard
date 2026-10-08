import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { buildProgressBalanceView, transactionAdjustedAccounts } from "../app/progress-balances.ts";

function account(id, balance) {
  return {
    id, name: id, type: "Credit card", balance, apr: 18, interestFee: 0, minimum: 25, minimumMode: "manual", payoffMode: "priority",
    creditLimit: 5000, dueDate: "", promoEndDate: "", postPromoApr: 0, postPromoMinimum: 0, createdAt: "2026-07-01T00:00:00.000Z",
  };
}

function transaction(id, overrides = {}) {
  return {
    id, date: "2026-07-15", accountId: "card-a", payeeId: "payee", payeeName: "Issuer", type: "payment", category: "Debt payment",
    memo: "", amount: 200, createdAt: "2026-07-15T12:00:00.000Z", updatedAt: "2026-07-15T12:00:00.000Z", deletedAt: null, ...overrides,
  };
}

function snapshot(month, totalBalance) {
  return {
    id: `snapshot-${month}`, month, capturedAt: `${month}-31T12:00:00.000Z`, totalBalance, monthlyInterest: 20, activeAccountCount: 2,
    projectedDebtFreeMonth: null, note: "", accounts: [{ accountId: "card-a", name: "card-a", type: "Credit card", balance: totalBalance, apr: 18 }],
  };
}

test("Progress preserves saved historical balances and uses active transactions for current balances", () => {
  const accounts = [account("card-a", 1000), account("card-b", 500)];
  const transactions = [
    transaction("payment-a"),
    transaction("charge-a", { type: "charge", amount: 100 }),
    transaction("payment-b", { accountId: "card-b", amount: 50 }),
    transaction("deleted-charge", { type: "charge", amount: 900, deletedAt: "2026-07-20T00:00:00.000Z" }),
  ];
  const july = snapshot("2026-07", 9999);
  const august = snapshot("2026-08", 1400);

  const view = buildProgressBalanceView(accounts, transactions, [august, july]);

  assert.equal(view.baselineMonth, "2026-07");
  assert.equal(view.startingTotal, 9999);
  assert.equal(view.currentTotal, 1350);
  assert.deepEqual(view.currentAccounts.map((item) => item.balance), [900, 450]);
  assert.equal(view.snapshots[0].totalBalance, 9999);
  assert.deepEqual(view.snapshots[0].accounts.map((item) => item.balance), [9999]);
  assert.equal(view.snapshots[1].totalBalance, 1400);
  assert.equal(july.totalBalance, 9999);
});

test("the dashboard and actual Progress use the same posted balance source", async () => {
  const [source, model, panel] = await Promise.all([
    readFile(new URL("../app/dashboard-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/debt-activity.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/actual-progress-page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(source, /transactionAdjustedAccounts\(accounts, transactions, detailedSpendingTracking\)/);
  assert.match(source, /<ActualProgressPage readOnly=\{isViewer\} accounts=\{accounts\}/);
  assert.match(model, /transactionAdjustedAccounts\(accounts, transactions\)/);
  assert.match(panel, /money.format\(report.current\)/);
  assert.doesNotMatch(panel, /minimumOnlyPlan|Projected debt-free|Estimated interest paid/);
});

test("transaction-adjusted balances never go below zero", () => {
  const accounts = [account("card-a", 100)];
  const adjusted = transactionAdjustedAccounts(accounts, [transaction("overpayment", { amount: 250 })]);
  assert.equal(adjusted[0].balance, 0);
});
