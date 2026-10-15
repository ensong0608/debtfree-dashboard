import test from "node:test";
import assert from "node:assert/strict";
import { buildPayoffCsv, payoffReportLabels } from "../app/payoff-export.ts";

function report(calculationMode) {
  const scenario = calculationMode === "calculator";
  return {
    calculationMode, generatedAt: "2026-10-11", budgetMonth: "October 2026", strategy: "Avalanche", projectedDebtFree: "November 2026", monthsToPayoff: 2, stalled: false,
    startingDebt: 250, monthlyPlan: 150, estimatedInterest: 0, extraPayment: scenario ? 150 : 100,
    totalIncome: 0, totalExpenses: 0, totalBudget: 0, monthlySurplus: 0, totalMinimums: scenario ? 0 : 50, availableExtra: scenario ? 150 : 100,
    cashflow: [], accounts: [], transactions: [], snapshots: [],
    schedule: [{ month: "October 2026", focusDebt: "Synthetic card", minimumPayments: scenario ? 0 : 50, extraPayment: scenario ? 150 : 100, totalPaid: 150, interest: 0, remaining: 100, milestone: "", accounts: [] }],
  };
}

test("Calculator exports describe the scenario pool without claiming saved minimums or extra", () => {
  const csv = buildPayoffCsv(report("calculator"));
  assert.match(csv, /Scenario only; minimum payments are not reserved/);
  assert.match(csv, /Monthly scenario payment,150/);
  assert.match(csv, /Reserved minimums \(none\),0/);
  assert.match(csv, /Scenario allocation,150/);
  assert.match(csv, /Scenario payment pool,150/);
  assert.match(csv, /Focus debt,Reserved minimums \(none\),Scenario allocation/);
  assert.doesNotMatch(csv, /Extra payment|Available extra|Debt minimums,/);
});

test("Plan and existing report consumers preserve minimum/extra export semantics", () => {
  const csv = buildPayoffCsv(report("plan"));
  assert.match(csv, /Monthly payoff plan,150/);
  assert.match(csv, /Debt minimums,50/);
  assert.match(csv, /Extra payment,100/);
  assert.match(csv, /Minimum payments,Extra payment/);
  assert.doesNotMatch(csv, /Scenario allocation|minimum payments are not reserved/);
  assert.deepEqual(payoffReportLabels({}), payoffReportLabels({ calculationMode: "plan" }));
});
