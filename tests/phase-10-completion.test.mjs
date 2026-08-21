import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { calculatePlan } from "../app/payoff-engine.ts";
import { buildPaymentWhatIf, payoffCalculationWarnings } from "../app/payoff-plan.ts";
import { buildProgressReport } from "../app/progress-report.ts";
import { transactionAdjustedAccounts } from "../app/progress-balances.ts";

const calculationDate = new Date("2026-08-21T12:00:00");

function account(id, overrides = {}) {
  return {
    id,
    name: id,
    type: "Credit card",
    balance: 1500,
    apr: 18,
    interestFee: 0,
    minimum: 75,
    minimumMode: "manual",
    payoffMode: "priority",
    creditLimit: 5000,
    dueDate: "2026-08-25",
    promoEndDate: "",
    postPromoApr: 0,
    postPromoMinimum: 0,
    createdAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

function transaction(id, overrides = {}) {
  return {
    id,
    date: "2026-08-10",
    accountId: "card",
    payeeId: "issuer",
    payeeName: "Card issuer",
    type: "payment",
    category: "Debt payment",
    memo: "",
    amount: 400,
    createdAt: "2026-08-10T12:00:00.000Z",
    updatedAt: "2026-08-10T12:00:00.000Z",
    deletedAt: null,
    balanceBefore: 1500,
    balanceAfter: 1100,
    ...overrides,
  };
}

test("Phase 6 what-if scenarios are isolated until their total is applied", () => {
  const accounts = [account("high", { apr: 28, balance: 4000 }), account("low", { apr: 9, balance: 2000 })];
  const original = structuredClone(accounts);
  const scenario = buildPaymentWhatIf(accounts, 100, 250, "avalanche", [], {}, {}, calculationDate);

  assert.equal(scenario.additionalMonthly, 250);
  assert.equal(scenario.totalExtra, 350);
  assert.equal(scenario.plan.stalled, false);
  assert.ok((scenario.monthsSaved ?? 0) > 0);
  assert.ok((scenario.interestSaved ?? 0) > 0);
  assert.deepEqual(accounts, original);
});

test("Phase 6 UI provides 50, 100, 250, custom, results, and explicit apply", async () => {
  const source = await readFile(new URL("../app/dashboard-client.tsx", import.meta.url), "utf8");
  assert.match(source, /\[50, 100, 250\]/);
  assert.match(source, /Custom additional amount/);
  assert.match(source, /<span>Debt-free date<\/span>/);
  assert.match(source, /<span>Time saved<\/span>/);
  assert.match(source, /<span>Interest saved<\/span>/);
  assert.match(source, /Apply this amount to my plan/);
  assert.match(source, /Test an increase without changing the saved plan/);
});

test("Phase 9 report exposes required metrics, dual-path chart, and restrained milestones", async () => {
  const opening = [account("card")];
  const transactions = [
    transaction("payment"),
    transaction("interest", { type: "fee", amount: 20, date: "2026-08-15", balanceBefore: undefined, balanceAfter: undefined }),
  ];
  const current = transactionAdjustedAccounts(opening, transactions);
  const currentPlan = calculatePlan(current, 200, "avalanche", {}, {}, calculationDate);
  const minimumOnlyPlan = calculatePlan(current, 0, "avalanche", {}, {}, calculationDate);
  const snapshots = [{
    id: "july",
    month: "2026-07",
    capturedAt: "2026-07-31T12:00:00.000Z",
    totalBalance: 1500,
    monthlyInterest: 22.5,
    activeAccountCount: 1,
    projectedDebtFreeMonth: "2027-12",
    note: "Starting point",
    accounts: [{ accountId: "card", name: "card", type: "Credit card", balance: 1500, apr: 18 }],
  }];
  const report = buildProgressReport({ openingAccounts: opening, transactions, snapshots, currentPlan, minimumOnlyPlan, calculationDate });

  assert.equal(report.startingDebt, 1500);
  assert.equal(report.currentDebt, 1120);
  assert.equal(report.principalEliminated, 380);
  assert.equal(report.progressPercent, 25.33);
  assert.equal(report.changeThisMonth, 380);
  assert.equal(report.estimatedInterestPaid, 20);
  assert.ok((report.estimatedInterestAvoided ?? 0) >= 0);
  assert.equal(report.previousDebtFreeMonth, "2027-12");
  assert.ok(report.currentDebtFreeMonth);
  assert.ok(report.chart.some((point) => point.actual !== null));
  assert.ok(report.chart.some((point) => point.projected !== null));
  assert.equal(report.milestones.length, 7);
  assert.equal(report.milestones.find((item) => item.id === "first-payment")?.status, "achieved");
  assert.equal(report.milestones.find((item) => item.id === "quarter")?.status, "achieved");

  const [panel, helper] = await Promise.all([
    readFile(new URL("../app/progress-report-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/progress-report.ts", import.meta.url), "utf8"),
  ]);
  const progressSource = `${panel}\n${helper}`;
  [
    "Starting debt",
    "Current debt",
    "Principal eliminated",
    "Progress",
    "Change this month",
    "Estimated interest paid",
    "Estimated interest avoided",
    "Current debt-free date",
    "Previous debt-free date",
    "Schedule movement",
    "Actual balance and projected payoff path",
    "First payment recorded",
    "First $1,000 eliminated",
    "First debt paid off",
    "25% complete",
    "50% complete",
    "75% complete",
    "Debt-free",
  ].forEach((label) => assert.ok(progressSource.includes(label), `Missing Phase 9 output: ${label}`));
});

test("Phase 10 warns when a balance is projected to survive its promotional period", () => {
  const promo = account("Promo card", { balance: 5000, apr: 0, minimum: 50, promoEndDate: "2026-08-31", postPromoApr: 29, postPromoMinimum: 75 });
  const plan = calculatePlan([promo], 0, "avalanche", {}, {}, calculationDate);
  const warnings = payoffCalculationWarnings([promo], plan, calculationDate);
  assert.ok(warnings.some((warning) => /Promo card.*remaining.*promotional APR expires/i.test(warning)));

  const missingApr = account("Missing promo APR", { apr: 0, promoEndDate: "2026-10-31", postPromoApr: 0 });
  const missingWarnings = payoffCalculationWarnings([missingApr], calculatePlan([missingApr], 0, "avalanche", {}, {}, calculationDate), calculationDate);
  assert.ok(missingWarnings.some((warning) =>
    warning.includes("Your payoff projection may be inaccurate because the APR after the promotional period is missing.")));
});
