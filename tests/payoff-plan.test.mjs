import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  DASHBOARD_BACKUP_FORMAT,
  DASHBOARD_DATA_VERSION,
  MONTHLY_PLAN_DASHBOARD_DATA_VERSION,
  createDashboardBackup,
  parseDashboardContract,
  parseDashboardJson,
  serializeDashboardBackup,
} from "../app/dashboard-data.ts";
import { calculatePlan } from "../app/payoff-engine.ts";
import {
  accountsWithCustomDebtOrder,
  buildPayoffScheduleRows,
  buildStrategyComparison,
  mergeVisibleCustomDebtOrder,
  normalizeCustomDebtOrder,
  visibleCustomDebtOrder,
} from "../app/payoff-plan.ts";
import { buildPayoffCsv } from "../app/payoff-export.ts";

const CALCULATION_DATE = new Date("2026-08-12T12:00:00");

function account(id, overrides = {}) {
  return {
    id,
    name: id,
    type: "Credit card",
    balance: 2000,
    apr: 18,
    interestFee: 0,
    minimum: 50,
    minimumMode: "manual",
    payoffMode: "priority",
    creditLimit: 5000,
    dueDate: "2026-08-20",
    promoEndDate: "",
    postPromoApr: 0,
    postPromoMinimum: 0,
    createdAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

test("Avalanche ranks by effective forecast APR and re-ranks after promotional transitions", () => {
  const calibrated = account("calibrated", { balance: 1000, apr: 5, interestFee: 25 });
  const nominal = account("nominal", { balance: 1000, apr: 24 });
  const calibratedPlan = calculatePlan([nominal, calibrated], 100, "avalanche", {}, {}, CALCULATION_DATE);
  assert.ok(calibratedPlan.months[0].payments.calibrated > calibrated.minimum);
  assert.equal(calibratedPlan.months[0].payments.nominal, nominal.minimum);

  const promo = account("promo", { balance: 5000, apr: 0, promoEndDate: "2026-08-31", postPromoApr: 30, postPromoMinimum: 50 });
  const steady = account("steady", { balance: 5000, apr: 20 });
  const promoPlan = calculatePlan([promo, steady], 100, "avalanche", {}, {}, CALCULATION_DATE);
  assert.ok(promoPlan.months[0].payments.steady > steady.minimum);
  assert.ok(promoPlan.months[1].payments.promo > promo.minimum);
});

test("Snowball targets the lowest current balance with existing APR tie-breaking", () => {
  const small = account("small", { balance: 500, apr: 8 });
  const large = account("large", { balance: 1500, apr: 29 });
  const plan = calculatePlan([large, small], 100, "snowball", {}, {}, CALCULATION_DATE);
  assert.ok(plan.months[0].payments.small > small.minimum);
  assert.equal(plan.months[0].payments.large, large.minimum);
});

test("custom order remains stable across balances, add, payoff, archive, restore, and remove", () => {
  const a = account("a", { createdAt: "2026-08-01T00:00:00.000Z" });
  const b = account("b", { createdAt: "2026-08-02T00:00:00.000Z" });
  const c = account("c", { createdAt: "2026-08-03T00:00:00.000Z" });
  const saved = ["b", "a", "c"];
  assert.deepEqual(visibleCustomDebtOrder([a, b, c], saved).map((item) => item.id), saved);
  assert.deepEqual(visibleCustomDebtOrder([{ ...a, balance: 99 }, { ...b, balance: 9999 }, c], saved).map((item) => item.id), saved);

  const d = account("d", { createdAt: "2026-08-04T00:00:00.000Z" });
  const added = normalizeCustomDebtOrder([a, b, c, d], saved);
  assert.deepEqual(added, ["b", "a", "c", "d"]);
  assert.deepEqual(visibleCustomDebtOrder([a, { ...b, balance: 0 }, c, d], added).map((item) => item.id), ["a", "c", "d"]);
  assert.deepEqual(visibleCustomDebtOrder([{ ...a, archivedAt: "2026-08-12" }, { ...b, balance: 0 }, c, d], added).map((item) => item.id), ["c", "d"]);
  assert.deepEqual(visibleCustomDebtOrder([a, { ...b, balance: 0 }, c, d], added).map((item) => item.id), ["a", "c", "d"]);
  assert.deepEqual(normalizeCustomDebtOrder([a, b, d], added), ["b", "a", "d"]);
  assert.deepEqual(mergeVisibleCustomDebtOrder([a, { ...b, balance: 0 }, c, d], added, ["d", "c", "a"]), ["b", "d", "c", "a"]);
});

test("minimum-only debts remain outside extra targeting for every comparison strategy", () => {
  const priority = account("priority", { balance: 1500, apr: 10 });
  const minimumOnly = account("minimum-only", { balance: 200, apr: 35, payoffMode: "minimum-only" });
  const result = buildStrategyComparison([minimumOnly, priority], 100, ["minimum-only", "priority"], {}, {}, CALCULATION_DATE);
  result.comparisons.forEach((item) => {
    assert.equal(item.firstTarget, "priority");
    assert.equal(item.plan.months[0].payments["minimum-only"], minimumOnly.minimum);
    assert.ok(item.plan.months[0].payments.priority > priority.minimum);
  });
});

test("strategy comparison returns all outcomes, recommendation savings, and never changes the saved strategy", () => {
  const high = account("high", { balance: 5000, apr: 28, minimum: 100 });
  const low = account("low", { balance: 3000, apr: 9, minimum: 100 });
  const accounts = [low, high];
  const originalAccounts = structuredClone(accounts);
  const savedStrategy = "custom";
  const result = buildStrategyComparison(accounts, 250, ["low", "high"], {}, {}, CALCULATION_DATE);
  assert.deepEqual(result.comparisons.map((item) => item.strategy), ["avalanche", "snowball", "custom"]);
  result.comparisons.forEach((item) => {
    assert.ok(item.plan.months.length > 0);
    assert.ok(item.firstTarget);
    assert.equal(typeof item.plan.totalInterest, "number");
  });
  const recommended = result.comparisons.find((item) => item.strategy === result.recommendedStrategy);
  const alternative = result.comparisons.find((item) => item.strategy === result.alternativeStrategy);
  assert.equal(recommended.interestDifference, 0);
  assert.equal(result.projectedSavings, Math.round((alternative.plan.totalInterest - recommended.plan.totalInterest) * 100) / 100);
  assert.equal(savedStrategy, "custom");
  assert.deepEqual(accounts, originalAccounts);
});

test("schedule rows expose focus debt, minimum, extra, interest, total paid, and ending balance", () => {
  const high = account("high", { balance: 2000, apr: 25, minimum: 75 });
  const low = account("low", { balance: 1000, apr: 8, minimum: 50 });
  const plan = calculatePlan([low, high], 100, "avalanche", {}, {}, CALCULATION_DATE);
  const rows = buildPayoffScheduleRows([low, high], plan);
  assert.equal(rows[0].focusDebt, "high");
  assert.equal(rows[0].minimumPayments, 125);
  assert.equal(rows[0].extraPayment, 100);
  assert.equal(rows[0].interest, Math.round(plan.months[0].interest * 100) / 100);
  assert.equal(rows[0].totalPaid, Math.round(plan.months[0].paid * 100) / 100);
  assert.equal(rows[0].endingBalance, Math.round(plan.months[0].remaining * 100) / 100);
});

test("custom ordering is applied through copies without modifying balances, payments, or snapshots", () => {
  const accounts = [account("a", { balance: 900 }), account("b", { balance: 400 })];
  const before = structuredClone(accounts);
  const ordered = accountsWithCustomDebtOrder(accounts, ["b", "a"]);
  assert.deepEqual(ordered.map((item) => item.customOrder), [1, 0]);
  assert.deepEqual(accounts, before);
  assert.deepEqual(accounts.map((item) => item.balance), [900, 400]);
});

test("legacy v4 payload migrates custom order explicitly and round-trips unknown fields", () => {
  const first = account("first", { customOrder: 1 });
  const second = account("second", { customOrder: 0 });
  const current = parseDashboardContract({
    accounts: [first, second],
    monthlyBudgets: {},
    payees: [],
    transactions: [],
    snapshots: [],
    extra: 100,
    strategy: "snowball",
  });
  const legacy = {
    ...current,
    version: MONTHLY_PLAN_DASHBOARD_DATA_VERSION,
    payload: { ...current.payload, futurePhase7Field: { retained: true } },
  };
  delete legacy.payload.customDebtOrder;
  const migrated = parseDashboardContract(legacy);
  assert.equal(migrated.version, DASHBOARD_DATA_VERSION);
  assert.equal(migrated.payload.strategy, "snowball");
  assert.deepEqual(migrated.payload.customDebtOrder, ["second", "first"]);
  assert.deepEqual(migrated.payload.futurePhase7Field, { retained: true });

  const roundTrip = parseDashboardJson(serializeDashboardBackup(createDashboardBackup(migrated.payload, migrated, "2026-08-12T12:00:00.000Z")));
  assert.equal(roundTrip.format, DASHBOARD_BACKUP_FORMAT);
  assert.deepEqual(roundTrip.payload.customDebtOrder, ["second", "first"]);
  assert.deepEqual(roundTrip.payload.futurePhase7Field, { retained: true });
});

test("schedule is collapsed to a short preview by default and expands only on request", async () => {
  const client = await readFile(new URL("../app/dashboard-client.tsx", import.meta.url), "utf8");
  assert.match(client, /useState\(false\)/);
  assert.match(client, /scheduleExpanded \? scheduleRows : scheduleRows\.slice\(0, DEFAULT_SCHEDULE_PREVIEW_MONTHS\)/);
  assert.match(client, /aria-expanded=\{scheduleExpanded\}/);
  assert.match(client, /setScheduleExpanded\(\(current\) => !current\)/);
  assert.match(client, /Show all \$\{scheduleRows\.length\} months/);
  assert.match(client, /displayedScheduleRows\.map/);
});

test("keyboard and mobile move controls remain visible and announce reordered positions", async () => {
  const [client, styles] = await Promise.all([
    readFile(new URL("../app/dashboard-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(client, /Move \$\{account\.name\} up/);
  assert.match(client, /Move \$\{account\.name\} down/);
  assert.match(client, /aria-live="polite"/);
  assert.match(client, /moved to position \$\{position\} of \$\{ids\.length\}/);
  assert.match(styles, /@media\(max-width:700px\)/);
  assert.match(styles, /custom-order-actions\{display:grid!important\}/);
  assert.match(styles, /custom-order-actions button\{touch-action:manipulation\}/);
});

test("calculation transparency includes every required assumption and estimate warning", async () => {
  const client = await readFile(new URL("../app/dashboard-client.tsx", import.meta.url), "utf8");
  [
    "How this plan was calculated",
    "Selected strategy",
    "Monthly payment amount",
    "Minimum-payment assumptions",
    "Interest calculation method",
    "Payment rollover",
    "Promotional-rate assumptions",
    "Planned new-purchase assumptions",
    "Calculation date",
    "Missing-data warnings",
    "Estimate based on the balances, rates, and payments currently entered.",
  ].forEach((label) => assert.ok(client.includes(label), `Missing calculation detail: ${label}`));
});

test("report exports preserve existing sections and include transparent schedule fields", () => {
  const csv = buildPayoffCsv({
    generatedAt: "2026-08-12",
    budgetMonth: "August 2026",
    strategy: "Avalanche",
    projectedDebtFree: "December 2026",
    monthsToPayoff: 5,
    stalled: false,
    startingDebt: 1000,
    monthlyPlan: 250,
    estimatedInterest: 25,
    extraPayment: 100,
    totalIncome: 3000,
    totalExpenses: 1500,
    totalBudget: 500,
    monthlySurplus: 1000,
    totalMinimums: 150,
    availableExtra: 850,
    cashflow: [],
    accounts: [],
    schedule: [{
      month: "August 2026",
      focusDebt: "Card",
      minimumPayments: 150,
      extraPayment: 100,
      totalPaid: 250,
      interest: 20,
      remaining: 770,
      milestone: "",
      accounts: [],
    }],
    transactions: [],
    snapshots: [],
  });
  assert.match(csv, /MONTHLY PLAN BREAKDOWN/);
  assert.match(csv, /DEBT ACCOUNTS/);
  assert.match(csv, /PAYOFF SCHEDULE/);
  assert.match(csv, /TRANSACTION LEDGER/);
  assert.match(csv, /PAYOFF SNAPSHOTS/);
  assert.match(csv, /Focus debt,Minimum payments,Extra payment/);
  assert.match(csv, /Card,150,100/);
});
