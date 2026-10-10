import test from "node:test";
import assert from "node:assert/strict";
import { calculateMinimumPayoffPlan, updatePayoffMinimum } from "../app/payoff-calculator.ts";

const date = new Date("2026-10-08T12:00:00Z");
const card = { id: "card", name: "Test card", type: "Credit card", balance: 10000, baselineBalance: 12000, balanceOffset: -50, apr: 0, interestFee: 0, minimum: 100, minimumMode: "auto", payoffMode: "priority", creditLimit: 20000, dueDate: "2026-10-17", promoEndDate: "", postPromoApr: 0, postPromoMinimum: 0, createdAt: "2026-07-01" };

test("saved minimum changes shared account terms across months without changing financial history", () => {
  const original = structuredClone(card);
  const other = { ...card, id: "other", minimumMode: "manual", minimum: 100 };
  const updated = updatePayoffMinimum([card, other], "card", 300);
  assert.deepEqual(updated[0], { ...card, minimum: 300, minimumMode: "manual" });
  assert.equal(updated[1], other);
  assert.deepEqual(card, original);
  const result = calculateMinimumPayoffPlan(updated, 1000, "snowball", [], date);
  assert.equal(result.error, "");
  assert.ok(result.plan.months.length > 3);
  for (const month of result.plan.months.slice(0, 4)) assert.equal(month.minimums.card, 300);
  assert.equal(updated[0].balance, 10000);
  assert.equal(updated[0].baselineBalance, 12000);
  assert.equal(updated[0].balanceOffset, -50);
  const changedAgain = updatePayoffMinimum(updated, "card", 400);
  assert.equal(calculateMinimumPayoffPlan(changedAgain, 1000, "snowball", [], date).plan.months[1].minimums.card, 400);
});

test("minimum edit rejects invalid amounts, rounds cents, and preserves explicit promotion terms", () => {
  for (const value of [-1, 0, NaN, Infinity, 0.001]) assert.throws(() => updatePayoffMinimum([card], "card", value), /minimum greater/);
  assert.equal(updatePayoffMinimum([card], "card", 100.126)[0].minimum, 100.13);
  const promo = { ...card, promoEndDate: "2026-12-31", postPromoApr: 24, postPromoMinimum: 400 };
  const updated = updatePayoffMinimum([promo], "card", 300)[0];
  assert.equal(updated.postPromoMinimum, 400);
  assert.equal(updated.postPromoApr, 24);
  assert.equal(updated.promoEndDate, "2026-12-31");
  const archived = { ...card, archivedAt: date.toISOString() };
  assert.equal(updatePayoffMinimum([archived], "card", 300)[0], archived);
});
