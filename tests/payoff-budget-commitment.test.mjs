import test from 'node:test';
import assert from 'node:assert/strict';
import { buildActivePayoffCommitment, capturePayoffCommitment, monthlyBudgetCommitment } from '../app/payoff-commitment.ts';
import { createDemoFixture } from '../mobile/demo-fixture.ts';
import { parseDashboardContract } from '../app/dashboard-data.ts';
import { updatePayoffMinimum } from '../app/payoff-calculator.ts';

const date = new Date('2026-10-22T19:00:00Z');
const account = (overrides = {}) => ({ ...createDemoFixture().payload.accounts[0], id: 'card', name: 'Card', balance: 1000, minimum: 25, apr: 0, ...overrides });
const home = (overrides = {}) => ({ id: 'home', name: 'Home', kind: 'house', originalAmount: 20000, remainingAmount: 10000, balanceKind: 'principal', asOf: '2026-10-01', budgetItemId: 'mortgage', budgetItemName: 'Mortgage', monthlyPayment: 600, apr: 12, escrow: 100, history: [], ...overrides });
const settings = (overrides = {}) => ({ months: {}, detailedSpendingTracking: false, payoffPlanAmount: 100, payoffExtraPayment: 75, ...overrides });
const mortgage = { id: 'mortgage', name: 'Mortgage', kind: 'expense', amount: 600 };

test('F01: extra, zero extra and minimum changes follow the configured schedule, preserving the legacy total', () => {
  const saved = settings();
  const initial = buildActivePayoffCommitment([account()], [], [], saved, date);
  assert.equal(initial.schedule.monthly, 100);
  assert.equal(initial.budgetCommitment, 100);
  assert.equal(initial.accountSuggestions.card, 100);
  const raised = buildActivePayoffCommitment([account()], [], [], settings({ payoffExtraPayment: 175 }), date);
  assert.equal(raised.schedule.monthly, 200);
  assert.equal(raised.budgetCommitment, 200);
  const minimumOnly = buildActivePayoffCommitment([account()], [], [], settings({ payoffExtraPayment: 0 }), date);
  assert.equal(minimumOnly.budgetCommitment, 25);
  const edited = buildActivePayoffCommitment(updatePayoffMinimum([account()], 'card', 60), [], [], saved, date);
  assert.equal(edited.budgetCommitment, 135);
  assert.equal(edited.accountSuggestions.card, 135);
  assert.equal(saved.payoffPlanAmount, 100);
});

test('F08: suggestions use the selected method and include mortgage extra without doubling escrow', () => {
  const small = account({ id: 'small', name: 'Small', balance: 100 });
  const avalanche = buildActivePayoffCommitment([small], [home()], [], settings({ payoffExtraPayment: 100, payoffPlanStrategy: 'avalanche' }), date);
  const snowball = buildActivePayoffCommitment([small], [home()], [], settings({ payoffExtraPayment: 100, payoffPlanStrategy: 'snowball' }), date);
  assert.equal(avalanche.accountSuggestions.small, 25);
  assert.equal(avalanche.loanSuggestions.home, 700);
  assert.equal(snowball.accountSuggestions.small, 100);
  assert.equal(snowball.loanSuggestions.home, 625);
  assert.equal(avalanche.householdPayment, snowball.householdPayment);
});

test('excluded debts retain minimum obligations and never receive schedule extra', () => {
  const outside = account({ id: 'personal', type: 'Personal loan', minimum: 80 });
  const result = buildActivePayoffCommitment([account(), outside], [home()], [mortgage], settings({ payoffExcludedTypes: ['Personal loan', 'Mortgage'] }), date);
  assert.equal(result.schedule.monthly, 100);
  assert.equal(result.outsideSchedulePayments, 680);
  assert.equal(result.householdPayment, 780);
  assert.equal(result.loanPaymentsInSpending, 600);
  assert.equal(result.budgetCommitment, 180);
  assert.equal(result.accountSuggestions.personal, 80);
  assert.equal(result.loanSuggestions.home, 600);
});

test('mortgage and auto payments never enter planned Debt payments regardless of Budget links', () => {
  const car = home({ id: 'car', kind: 'car', monthlyPayment: 300, escrow: undefined });
  const result = buildActivePayoffCommitment([], [home(), car], [{ ...mortgage, amount: 650 }], settings({ payoffExtraPayment: 0 }), date);
  assert.equal(result.householdPayment, 900);
  assert.equal(result.loanPaymentsInSpending, 650);
  assert.equal(result.budgetCommitment, 0);
  const partial = buildActivePayoffCommitment([], [home()], [{ ...mortgage, amount: 550 }], settings({ payoffExtraPayment: 0 }), date);
  assert.equal(partial.budgetCommitment, 0);
  const unlinked = buildActivePayoffCommitment([], [home({ budgetItemId: '', budgetItemName: '' })], [], settings({ payoffExtraPayment: 0 }), date);
  assert.equal(unlinked.budgetCommitment, 0);
});

test('final loan payments cannot create excess spending coverage or a negative commitment', () => {
  const result = buildActivePayoffCommitment([], [home({ remainingAmount: 50, apr: 0 })], [mortgage], settings({ payoffExtraPayment: 0 }), date);
  assert.equal(result.schedule.monthly, 150);
  assert.equal(result.loanSuggestions.home, 150);
  assert.equal(result.loanPaymentsInSpending, 150);
  assert.equal(result.budgetCommitment, 0);
});

test('missing terms do not erase known loan payments or infer unknown payment amounts', () => {
  const known = buildActivePayoffCommitment([], [home({ apr: undefined })], [], settings({ payoffExtraPayment: 0 }), date);
  assert.equal(known.budgetCommitment, 0);
  assert.ok(known.schedule.issues.length);
  const unknown = buildActivePayoffCommitment([], [home({ monthlyPayment: undefined })], [], settings({ payoffExtraPayment: 0 }), date);
  assert.equal(unknown.budgetCommitment, 0);
  assert.equal(unknown.missingLoanPayments, 1);
  assert.ok(unknown.schedule.issues.length);
});

test('planned Debt payments include saved extra independently of forecast exclusions, but empty debts reserve none', () => {
  const result = buildActivePayoffCommitment([account(), account({ id: 'archived', archivedAt: date.toISOString() })], [], [], settings({ payoffExcludedTypes: ['Credit card'] }), date);
  assert.equal(result.schedule.monthly, 0);
  assert.equal(result.budgetCommitment, 100);
  assert.equal(result.extra, 75); // retain the saved choice for a later included debt
  assert.equal(buildActivePayoffCommitment([], [], [], settings(), date).budgetCommitment, 0);
});

test('capture survives reload and rollover, without rewriting old months, ledger, anchors or snapshots', () => {
  const fixture = createDemoFixture();
  fixture.payload.monthlyPlan = settings({
    progressStartingBalance: 1500,
    months: { '2026-09': { safetyBuffer: 20, debtPaymentTarget: 120 }, '2026-10': { safetyBuffer: 10, debtPaymentTarget: 120, payments: { card: 25 }, settlements: [] } },
  });
  const before = structuredClone(fixture);
  fixture.payload.monthlyPlan = capturePayoffCommitment(fixture.payload.monthlyPlan, '2026-10', '2026-10', 400);
  const restored = parseDashboardContract(JSON.parse(JSON.stringify(fixture))).payload;
  assert.equal(monthlyBudgetCommitment(restored.monthlyPlan, '2026-10', '2026-11', 700), 400);
  assert.equal(monthlyBudgetCommitment(restored.monthlyPlan, '2026-11', '2026-11', 700), 700);
  assert.deepEqual(restored.monthlyPlan.months['2026-09'], before.payload.monthlyPlan.months['2026-09']);
  assert.deepEqual(restored.monthlyPlan.months['2026-10'].payments, { card: 25 });
  assert.deepEqual(restored.monthlyPlan.months['2026-10'].settlements, []);
  assert.equal(restored.monthlyPlan.months['2026-10'].safetyBuffer, 10);
  assert.equal(restored.monthlyPlan.progressStartingBalance, 1500);
  assert.equal(restored.monthlyPlan.payoffPlanAmount, 100);
  for (const key of ['accounts', 'transactions', 'snapshots', 'monthlyBudgets', 'balanceAdjustments']) assert.deepEqual(restored[key], before.payload[key]);
  assert.equal(capturePayoffCommitment(restored.monthlyPlan, '2026-09', '2026-11', 999), restored.monthlyPlan);
  assert.equal(capturePayoffCommitment(restored.monthlyPlan, '2026-10', '2026-10', 400), restored.monthlyPlan);
});
