import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  PAYOFF_PLAN_MONTH_LIMIT,
  calculatePlan,
  effectiveMinimum,
  estimatedMinimum,
  forecastMonthKey,
  individualPayoffMonths,
  monthlyInterest,
  round,
} from "../app/payoff-engine.ts";

const CALCULATION_DATE = new Date(2026, 7, 15, 12, 0, 0);

function account(id, overrides = {}) {
  return {
    id,
    name: id,
    type: "Credit card",
    balance: 500,
    apr: 0,
    interestFee: 0,
    minimum: 50,
    minimumMode: "manual",
    payoffMode: "priority",
    creditLimit: 1000,
    dueDate: "",
    promoEndDate: "",
    postPromoApr: 0,
    postPromoMinimum: 0,
    createdAt: "2026-01-01T12:00:00.000Z",
    ...overrides,
  };
}

function plan(accounts, extra = 0, strategy = "avalanche", linkedCardExpenses = {}, linkedCardPurchases = {}) {
  return calculatePlan(accounts, extra, strategy, linkedCardExpenses, linkedCardPurchases, CALCULATION_DATE);
}

test("preserves automatic and manual minimum payments", () => {
  const automatic = account("automatic", { balance: 1000, apr: 24, minimum: 999, minimumMode: "auto" });
  const manual = account("manual", { balance: 1000, apr: 24, minimum: 75, minimumMode: "manual" });

  assert.equal(estimatedMinimum(1000, 24), 30);
  assert.equal(estimatedMinimum(10, 24), 10.2);
  assert.equal(effectiveMinimum(automatic), 30);
  assert.equal(effectiveMinimum(manual), 75);
  assert.equal(effectiveMinimum(account("paid", { balance: 0, minimum: 75 })), 0);
});

test("preserves avalanche ordering, lower-balance tie-breaking, and stable exact ties", () => {
  const ordered = plan([
    account("large", { balance: 1000, apr: 20 }),
    account("small", { balance: 500, apr: 20 }),
  ], 100, "avalanche");

  assert.deepEqual(ordered.months[0].payments, { large: 50, small: 150 });

  const exactTie = plan([
    account("first", { balance: 500, apr: 20 }),
    account("second", { balance: 500, apr: 20 }),
  ], 50, "avalanche");

  assert.deepEqual(exactTie.months[0].payments, { first: 100, second: 50 });
});

test("preserves snowball ordering, higher-APR tie-breaking, and stable exact ties", () => {
  const ordered = plan([
    account("highApr", { balance: 1000, apr: 20, interestFee: 10 }),
    account("lowApr", { balance: 1000, apr: 10, interestFee: 10 }),
  ], 100, "snowball");

  // After APR-based interest the low-APR card has the smaller balance.
  assert.deepEqual(ordered.months[0].payments, { highApr: 50, lowApr: 150 });

  const exactTie = plan([
    account("first", { balance: 500, apr: 20, interestFee: 5 }),
    account("second", { balance: 500, apr: 20, interestFee: 5 }),
  ], 50, "snowball");

  assert.deepEqual(exactTie.months[0].payments, { first: 100, second: 50 });
});

test("legacy custom settings remain readable through avalanche without custom ordering", () => {
  const debts = [account("high", { apr: 24, customOrder: 1 }), account("low", { apr: 12, customOrder: 0 })];
  assert.deepEqual(plan(debts, 100, "custom"), plan(debts, 100, "avalanche"));
  assert.throws(() => plan(debts, 100, "invalid"), /avalanche or snowball/);
});

test("preserves minimum-only debts and leaves unused rollover unavailable to them", () => {
  const result = plan([
    account("priority", { balance: 100 }),
    account("minimumOnly", { balance: 200, payoffMode: "minimum-only" }),
  ], 100);

  assert.equal(result.monthly, 200);
  assert.equal(result.months.length, 4);
  assert.deepEqual(result.months[0].payments, { priority: 100, minimumOnly: 50 });
  assert.deepEqual(result.months[1].payments, { minimumOnly: 50 });
  assert.equal(result.months[1].paid, 50);
  assert.equal(result.months[1].requiredMonthly, 200);
});

test("preserves zero-balance debt handling", () => {
  const zero = account("zero", { balance: 0 });
  const empty = plan([zero]);

  assert.equal(empty.months.length, 0);
  assert.equal(empty.stalled, false);
  assert.equal(individualPayoffMonths(zero, CALCULATION_DATE), 0);

  const linked = plan([zero], 0, "avalanche", { zero: 25 });
  assert.equal(linked.months.length, 1);
  assert.deepEqual(linked.months[0].payments, { zero: 25 });
  assert.deepEqual(linked.months[0].paidOff, []);
});

test("preserves payment rollover after a debt is paid", () => {
  const result = plan([
    account("first", { balance: 60 }),
    account("second", { balance: 500 }),
  ]);

  assert.deepEqual(result.months[0].payments, { first: 50, second: 50 });
  assert.deepEqual(result.months[1].minimums, { first: 10, second: 50 });
  assert.deepEqual(result.months[1].payments, { first: 10, second: 90 });
  assert.deepEqual(result.months[1].paidOff, ["first"]);
  assert.equal(result.months[2].payments.second, 100);
});

test("preserves the effect of changing extra payment", () => {
  const debt = account("single", { balance: 500, apr: 12 });
  const baseline = plan([debt]);
  const withExtra = plan([debt], 50);

  assert.equal(baseline.months[0].payments.single, 50);
  assert.equal(withExtra.months[0].payments.single, 100);
  assert.ok(withExtra.months.length < baseline.months.length);
  assert.ok(withExtra.totalInterest < baseline.totalInterest);
});

test("preserves final partial payments", () => {
  const result = plan([account("single", { balance: 110 })]);

  assert.equal(result.months.length, 3);
  assert.deepEqual(result.months.map((month) => month.payments.single), [50, 50, 10]);
  assert.equal(result.months[2].paid, 10);
  assert.equal(result.months[2].remaining, 0);
  assert.deepEqual(result.months[2].paidOff, ["single"]);
  assert.equal(individualPayoffMonths(account("single", { balance: 110 }), CALCULATION_DATE), 3);
});

test("rounds every projected month and cumulative interest to cents", () => {
  const debt = account("single", { balance: 1200, apr: 12, minimum: 100 });
  const result = plan([debt]);

  assert.equal(monthlyInterest(debt), 12);
  assert.equal(result.months[0].interest, 12);
  assert.equal(result.months[1].interest, 11.12);
  assert.equal(result.months[1].balances.single, 1023.12);
  assert.equal(result.totalInterest, 84.78);
  assert.equal(round(1.005), 1.01);
  assert.equal(round(10.004), 10);
});

test("saved undated interest never overrides forecast APR, even after a balance change", () => {
  const saved = account("single", { balance: 1200, apr: 24, interestFee: 12, minimum: 100 });
  assert.equal(monthlyInterest(saved, CALCULATION_DATE), 24);
  assert.deepEqual(plan([saved]), plan([{...saved, interestFee:0}]));
  assert.equal(monthlyInterest({...saved,balance:600}, CALCULATION_DATE),12);
  assert.equal(saved.interestFee,12);
});

test("preserves explicit promotional APR expiration at the month boundary", () => {
  const promo = account("promo", {
    balance: 1000,
    apr: 0,
    minimum: 25,
    promoEndDate: "2026-09-30",
    postPromoApr: 24,
    postPromoMinimum: 100,
  });
  const result = plan([promo]);

  assert.deepEqual([1, 2, 3].map((month) => forecastMonthKey(month, CALCULATION_DATE)), ["2026-08", "2026-09", "2026-10"]);
  assert.deepEqual(result.months.slice(0, 3).map((month) => month.aprs.promo), [0, 0, 24]);
  assert.deepEqual(result.months.slice(0, 3).map((month) => month.interest), [0, 0, 19]);
});

test("preserves explicit and fallback post-promotion minimum behavior", () => {
  const explicit = plan([account("promo", {
    balance: 1000,
    apr: 0,
    minimum: 25,
    promoEndDate: "2026-09-30",
    postPromoApr: 24,
    postPromoMinimum: 100,
  })]);
  assert.deepEqual(explicit.months.slice(0, 3).map((month) => month.minimums.promo), [25, 25, 100]);
  assert.equal(explicit.months[2].requiredMonthly, 100);
  assert.equal(explicit.months[2].minimumIncrease, 75);
  assert.equal(explicit.peakMonthly, 100);

  const fallback = plan([account("promo", {
    balance: 1000,
    apr: 0,
    minimum: 25,
    promoEndDate: "2026-09-30",
    postPromoApr: 24,
    postPromoMinimum: 0,
  })]);
  assert.deepEqual(fallback.promoMinimumFallbackIds, ["promo"]);
  assert.equal(fallback.months[2].minimums.promo, 25);
  assert.equal(fallback.peakMonthly, 25);
});

test("preserves recurring linked credit-card expenses", () => {
  const result = plan([account("card", { balance: 100 })], 0, "avalanche", { card: 20 });

  assert.equal(result.monthly, 70);
  assert.equal(result.months.length, 2);
  assert.deepEqual(result.months.map((month) => month.payments.card), [70, 70]);
  assert.deepEqual(result.months.map((month) => month.balances.card), [50, 0]);
});

test("preserves first-month-only linked credit-card purchases", () => {
  const result = plan([account("card", { balance: 100 })], 0, "avalanche", {}, { card: 30 });

  assert.equal(result.monthly, 50);
  assert.equal(result.peakMonthly, 80);
  assert.equal(result.months.length, 2);
  assert.deepEqual(result.months.map((month) => month.requiredMonthly), [80, 50]);
  assert.deepEqual(result.months.map((month) => month.payments.card), [80, 50]);
  assert.deepEqual(result.months.map((month) => month.minimumIncrease), [30, 0]);
});

test("preserves non-amortizing and immediately stalled plans", () => {
  const nonAmortizing = plan([account("stuck", { balance: 1000, apr: 24, minimum: 10 })]);

  assert.equal(nonAmortizing.stalled, true);
  assert.equal(nonAmortizing.months.length, 1);
  assert.equal(nonAmortizing.months[0].interest, 20);
  assert.equal(nonAmortizing.months[0].paid, 10);
  assert.deepEqual(nonAmortizing.nonAmortizingAccountIds, ["stuck"]);
  assert.deepEqual(nonAmortizing.months[0].nonAmortizingAccountIds, ["stuck"]);

  const noPayment = plan([account("stuck", { balance: 1000, minimum: 0 })]);
  assert.equal(noPayment.stalled, true);
  assert.equal(noPayment.months.length, 0);
  assert.deepEqual(noPayment.nonAmortizingAccountIds, ["stuck"]);
});

test("preserves an empty plan as complete rather than stalled", () => {
  const result = plan([]);

  assert.deepEqual(result, {
    months: [],
    totalInterest: 0,
    monthly: 0,
    peakMonthly: 0,
    stalled: false,
    nonAmortizingAccountIds: [],
    promoMinimumFallbackIds: [],
  });
});

test("preserves the 1,200-month long-plan limit", () => {
  const result = plan([account("long", { balance: 2000, minimum: 1 })]);

  assert.equal(PAYOFF_PLAN_MONTH_LIMIT, 1200);
  assert.equal(result.months.length, 1200);
  assert.equal(result.months[1199].month, 1200);
  assert.equal(result.months[1199].remaining, 800);
  assert.equal(result.stalled, true);
  assert.deepEqual(result.nonAmortizingAccountIds, ["long"]);
});

test("matches the anonymized representative projection with monthly cent rounding", async () => {
  const fixture = JSON.parse(await readFile(new URL("./fixtures/legacy-v0.json", import.meta.url), "utf8"));
  const result = plan(
    fixture.accounts,
    fixture.extra,
    fixture.strategy,
    { "account-card-1": 120 },
    { "account-card-1": 180 },
  );

  // The legacy auto-mode installment uses its fixed scheduled payment; only cards
  // receive the generic minimum estimate. Saved fee calibration is no longer used.
  assert.equal(result.monthly,590);
  assert.equal(result.months[0].interest,92.68);
  assert.equal(result.months[0].minimums['account-loan-1'],210);
  assert.equal(result.months.length,37);
  assert.equal(result.totalInterest,1190.35);
  assert.equal(result.months.at(-1).remaining,0);
  let before=fixture.accounts.reduce((sum,a)=>sum+a.balance,0);
  for (const month of result.months) {
    const planned=120+(month.month===1?180:0);
    assert.equal(round(before+month.interest+planned-month.paid),month.remaining);
    before=month.remaining;
  }
});
