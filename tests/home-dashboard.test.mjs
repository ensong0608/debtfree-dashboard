import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createEmptyPlannedPayoff } from "../app/dashboard-data.ts";
import { buildHomeDashboard } from "../app/home-dashboard.ts";
import { calculatePlan } from "../app/payoff-engine.ts";

const calculationDate = new Date(2026, 7, 11, 12);

function account(id, overrides = {}) {
  return {
    id,
    name: id,
    type: "Credit card",
    balance: 1000,
    apr: 18,
    interestFee: 0,
    minimum: 50,
    minimumMode: "manual",
    payoffMode: "priority",
    creditLimit: 5000,
    dueDate: "2026-08-25",
    promoEndDate: "",
    postPromoApr: 0,
    postPromoMinimum: 0,
    createdAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}
function transaction(id, overrides = {}) {
  return {
    id,
    date: "2026-08-11",
    accountId: "booking",
    payeeId: "payee-booking",
    payeeName: "Booking",
    type: "payment",
    category: "Debt payment",
    memo: "Recommended payoff payment",
    amount: 800,
    createdAt: "2026-08-11T12:00:00.000Z",
    updatedAt: "2026-08-11T12:00:00.000Z",
    deletedAt: null,
    ...overrides,
  };
}


function scenario(strategy = "avalanche") {
  const accounts = [
    account("booking", { name: "Booking", balance: 3500, apr: 29.24, minimum: 100, dueDate: "2026-07-28" }),
    account("citi", { name: "Citi", balance: 1200, apr: 18, minimum: 50, dueDate: "2026-08-20" }),
    account("discover", { name: "Discover", balance: 5000, apr: 0, minimum: 150, dueDate: "", promoEndDate: "2026-09-15", postPromoApr: 24, postPromoMinimum: 175 }),
    account("family", { name: "Family Loan", type: "Personal loan", balance: 300, apr: 8, minimum: 25, dueDate: "2026-08-17" }),
  ];
  const planning = createEmptyPlannedPayoff();
  planning.onboarding = { completed: true, currentStep: 5, completedAt: "2026-08-01T00:00:00.000Z" };
  planning.debts = accounts.map((item) => ({
    id: item.id,
    name: item.name,
    balance: item.balance + 250,
    apr: item.apr,
    minimum: item.minimum,
    dueDate: item.dueDate,
    creditLimit: item.creditLimit,
    promoEndDate: item.promoEndDate,
    postPromoApr: item.postPromoApr,
    postPromoMinimum: item.postPromoMinimum,
    type: item.type,
    assignment: "household",
    payoffMode: item.payoffMode,
  }));
  const extra = 700;
  const plan = calculatePlan(accounts, extra, strategy, {}, {}, calculationDate);
  return { accounts, planning, extra, plan, strategy, transactions: [] };
}

test("builds the Phase 3 Home summary and next avalanche payment from the payoff engine", () => {
  const input = scenario();
  const model = buildHomeDashboard({ ...input, openingAccounts: input.accounts, snapshots: [], calculationDate });

  assert.equal(model.totalDebt, 10000);
  assert.equal(model.startingDebt, 11000);
  assert.equal(model.amountPaid, 1000);
  assert.equal(model.progressPercent, 9.09);
  assert.equal(model.monthlyTarget, 1025);
  assert.equal(model.extraPayment, 700);
  assert.equal(model.nextPayment.name, "Booking");
  assert.equal(model.nextPayment.payment, 800);
  assert.equal(model.nextPayment.minimum, 100);
  assert.equal(model.nextPayment.aboveMinimum, 700);
  assert.equal(model.nextPayment.dueDate, "2026-08-28");
  assert.deepEqual(model.payoffOrder.map((item) => item.name), ["Booking", "Citi", "Family Loan"]);
  assert.ok(model.debtFreeMonth);
});

test("switching to snowball changes the Home payoff preview and next action", () => {
  const input = scenario("snowball");
  const model = buildHomeDashboard({ ...input, openingAccounts: input.accounts, snapshots: [], calculationDate });

  assert.equal(model.nextPayment.name, "Family Loan");
  assert.deepEqual(model.payoffOrder.map((item) => item.name), ["Family Loan", "Citi", "Booking"]);
});

test("recorded payment balances immediately increase Home progress and update the recommendation", () => {
  const input = scenario();
  const paidAccounts = input.accounts.map((item) => item.id === "booking" ? { ...item, balance: item.balance - 800 } : item);
  const plan = calculatePlan(paidAccounts, input.extra, input.strategy, {}, {}, calculationDate);
  const model = buildHomeDashboard({ ...input, accounts: paidAccounts, openingAccounts: input.accounts, plan, snapshots: [], calculationDate });

  assert.equal(model.totalDebt, 9200);
  assert.equal(model.amountPaid, 1800);
  assert.equal(model.progressPercent, 16.36);
  assert.equal(model.nextPayment.name, "Booking");
  assert.ok(model.nextPayment.payment > model.nextPayment.minimum);
});

test("Home shows actual payments recorded in the current month", () => {
  const input = scenario();
  input.transactions = [
    transaction("payment-booking"),
    transaction("payment-citi", { date: "2026-08-15", accountId: "citi", payeeName: "Citi", amount: 50, createdAt: "2026-08-15T12:00:00.000Z" }),
    transaction("charge", { type: "charge", amount: 30 }),
    transaction("prior-month", { date: "2026-07-31", amount: 100 }),
    transaction("deleted-payment", { amount: 200, deletedAt: "2026-08-12T00:00:00.000Z" }),
  ];
  const model = buildHomeDashboard({ ...input, openingAccounts: input.accounts, snapshots: [], calculationDate });

  assert.equal(model.paymentMonth, "2026-08");
  assert.equal(model.actualPaymentTotal, 850);
  assert.deepEqual(model.actualPayments.map((payment) => payment.accountName), ["Citi", "Booking"]);
});

test("Home actions include due dates, promotional expirations, missing information, and monthly review", () => {
  const input = scenario();
  input.accounts[2].postPromoApr = 0;
  input.planning.debts[2].postPromoApr = 0;
  input.plan = calculatePlan(input.accounts, input.extra, input.strategy, {}, {}, calculationDate);
  const model = buildHomeDashboard({ ...input, openingAccounts: input.accounts, snapshots: [], calculationDate });

  assert.ok(model.actions.some((action) => action.id === "promo-discover"));
  assert.ok(model.actions.some((action) => action.id === "missing-due-dates"));
  assert.ok(model.actions.some((action) => action.id === "missing-promo-apr"));
  assert.ok(model.actions.some((action) => action.id === "monthly-review"));
  assert.equal(model.actions.find((action) => action.id === "due-family")?.date, "2026-08-17");
  const dueAction = model.actions.find((action) => action.id === "due-family");
  assert.equal(dueAction?.destination, "payment");
  assert.equal(dueAction?.accountId, "family");
  assert.equal(dueAction?.amount, 25);
  assert.equal(model.actions.find((action) => action.id === "promo-discover")?.destination, "debt");
  assert.equal(model.actions.find((action) => action.id === "monthly-review")?.destination, "progress");
});

test("Phase 3 UI exposes the required Home actions and mobile layout", async () => {
  const [page, client, styles] = await Promise.all([
    readFile(new URL("../app/home-dashboard-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(page, /Estimated debt-free date/);
  assert.match(page, /Total remaining debt/);
  assert.match(page, /Amount already paid off/);
  assert.match(page, /Monthly debt target/);
  assert.match(page, /Record payment/);
  assert.match(page, /Upcoming actions/);
  assert.match(page, /Next three debts/);
  assert.match(page, /Actual payments/);
  assert.match(page, /id="home-extra-payment"/);
  assert.match(page, /className="home-action-item"/);
  assert.match(client, /label: "Home"/);
  assert.match(client, /label: "Debts"/);
  assert.match(client, /label: "Monthly Plan"/);
  assert.match(client, /label: "Progress"/);
  assert.match(client, /label: "Settings"/);
  assert.match(client, /<details className="secondary-navigation">/);
  assert.match(client, /setPage\("home"\)/);
  assert.match(client, /Recommended payoff payment/);
  assert.match(client, /onExtra=\{setExtra\}/);
  assert.match(client, /onAction=\{openHomeAction\}/);
  assert.match(client, /onViewPayments=\{\(\) => setPage\("history"\)\}/);
  assert.match(styles, /Phase 3 action-focused Home/);
  assert.match(styles, /@media\(max-width:600px\)[\s\S]*\.home-summary\{grid-template-columns:minmax\(0,1fr\)/);
  assert.match(styles, /\.next-payment-button\{width:100%;min-height:50px\}/);
  assert.match(styles, /\.home-extra-editor\{/);
  assert.match(styles, /\.home-payment-list\{/);
  assert.match(styles, /\.home-action-item\{/);
});
