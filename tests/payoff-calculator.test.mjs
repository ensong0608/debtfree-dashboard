import test from "node:test";
import assert from "node:assert/strict";
import { calculatePayoffCalculator } from "../app/payoff-calculator.ts";
const account = (id, changes = {}) => ({ id, name: id, type: "Credit card", balance: 10000, apr: 0, interestFee: 0, minimum: 900, minimumMode: "manual", payoffMode: "priority", creditLimit: 20000, dueDate: "", promoEndDate: "", postPromoApr: 0, postPromoMinimum: 0, createdAt: "2026-10-01", ...changes });
const date = new Date("2026-10-07T12:00:00Z");
test("7000 is the entire payment pool and final payment uses only remaining debt", () => {
 const accounts = [account("one"), account("two", { minimumMode: "auto", payoffMode: "minimum-only", postPromoMinimum: 3000 })];
 const before = structuredClone(accounts);
 const plan = calculatePayoffCalculator(accounts, 7000, "avalanche", [], date);
 assert.equal(plan.monthly, 7000); assert.equal(plan.months.length, 3);
 assert.deepEqual(plan.months.map(m => m.paid), [7000, 7000, 6000]);
 assert.equal(plan.months.at(-1).remaining, 0);
 assert.ok(plan.months.every(m => Object.values(m.minimums).every(v => v === 0)));
 assert.deepEqual(accounts, before);
});
test("calculator retains interest and promo rates without adding post-promo minimums", () => {
 const plan = calculatePayoffCalculator([account("one", { balance: 1000, apr: 12, promoEndDate: "2026-10-31", postPromoApr: 24, postPromoMinimum: 5000 })], 500, "avalanche", [], date);
 assert.equal(plan.months[0].interest, 10); assert.equal(plan.months[0].paid, 500);
 assert.equal(plan.months[1].aprs.one, 24); assert.equal(plan.months[1].paid, 500);
 assert.equal(plan.peakMonthly, 500);
});
test("uses current balances without subtracting any past payments again", () => {
 const plan = calculatePayoffCalculator([account("remaining", { balance: 850 })], 500, "snowball", [], date);
 assert.deepEqual(plan.months.map(m => m.paid), [500, 350]);
 assert.equal(calculatePayoffCalculator([account("one", { apr: 24 })], 1, "avalanche", [], date).stalled, true);
 assert.equal(calculatePayoffCalculator([account("one")], 0, "avalanche", [], date).stalled, true);
 assert.equal(calculatePayoffCalculator([account("archived", { archivedAt: "2026-10-01" })], 500, "avalanche", [], date).months.length, 0);
});
