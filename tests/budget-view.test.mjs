import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBudgetView, buildBudgetActivity, budgetReports, budgetLoanActivity, inBudgetPeriod } from '../app/budget-view.ts';
import { buildActivePayoffCommitment } from '../app/payoff-commitment.ts';
import { changeDebtEntry } from '../app/debt-transactions.ts';
const account = { id: 'card', name: 'Card', type: 'Credit card', balance: 2000, apr: 0, minimum: 100, minimumMode: 'manual', payoffMode: 'priority', interestFee: 0, creditLimit: 5000, dueDate: '', promoEndDate: '', postPromoApr: 0, postPromoMinimum: 0, createdAt: '2026-01-01' };
const item = (id, kind, amount) => ({ id, name: id, kind, amount, category: 'Household', paymentMethod: 'debit', creditAccountId: '', createdAt: '2026-10-01' });
const tx = (id, type, amount, extra = {}) => ({ id, type, amount, accountId: 'card', date: '2026-10-05', createdAt: '2026-10-05', updatedAt: '2026-10-05', deletedAt: null, category: 'Purchases', payeeId: '', payeeName: '', memo: '', ...extra });
const settlement = (extra = {}) => ({ id: 'paid', kind: 'spending', targetId: 'food', name: 'food', date: '2026-10-05', amount: 50, source: 'debit', createdAt: '2026-10-05', ...extra });
const items = [item('income', 'income', 3000), item('food', 'expense', 500), item('once', 'purchase', 100)];
const settings = { months: { '2026-09': { safetyBuffer: 25, debtPaymentTarget: 123 } }, detailedSpendingTracking: false, payoffPlanAmount: 300 };
const commitment = buildActivePayoffCommitment([account], [], items, settings, new Date('2026-10-23T12:00:00Z'));
const input = (extra = {}) => ({ items, transactions: [], settings, loans: [], month: '2026-10', currentMonth: '2026-10', commitment, ...extra });

test('planned-only allocations never claim actual spending or comparable monthly coverage', () => {
  const view = buildBudgetView(input());
  assert.deepEqual(view.planned, { income: 3000, spending: 600, payoff: 300, afterSpending: 2400, remaining: 2100, safetyBuffer: 0 });
  assert.equal(view.actual, null);
  assert.equal(view.spendingComparison, null);
  assert.ok(view.allocations.every(row => row.recordedPaid === null));
});
test('recorded-only actuals exclude payments, credits, fees, interest and deleted records', () => {
  const transactions = [tx('buy', 'charge', 40, { plannedItemId: 'food' }), tx('pay', 'payment', 200), tx('credit', 'payment', 10, { credit: true }), tx('fee', 'fee', 5), tx('interest', 'charge', 20, { category: 'Interest' }), tx('gone', 'charge', 80, { deletedAt: '2026-10-06' })];
  const view = buildBudgetView(input({ transactions, settings: { ...settings, detailedSpendingTracking: true } }));
  assert.equal(view.actual.recordedSpending, 40);
  assert.equal(view.actual.coverage, 'recorded-only');
  assert.deepEqual(view.actual.records.map(row=>[row.id,row.amount,row.markedPaid]), [['buy',40,false]]);
  assert.equal(view.actual.records.reduce((sum,row)=>sum+row.amount,0),view.actual.recordedSpending);
  assert.equal(view.allocations[1].recordedPaid, 40);
  assert.equal(view.spendingComparison, null);
});
test('settlements remain reporting-only, deduplicate by ID and never by equal amounts', () => {
  const paid = settlement();
  const configured = { ...settings, detailedSpendingTracking: true, months: { '2026-10': { settlements: [paid, paid, settlement({ id: 'partial' })] } } };
  const view = buildBudgetView(input({ settings: configured }));
  assert.equal(view.allocations[1].recordedPaid, 100);
  assert.equal(view.actual.recordedSpending, 100);
  assert.equal(view.actual.records.length,2);assert.ok(view.actual.records.every(row=>row.markedPaid));
  assert.equal(budgetReports([], configured).length, 2);
  assert.equal(buildBudgetActivity([], [], configured, '2026-10').totals.netDebtChange, 0);
});
test('unresolved checklist/ledger overlap withholds combined actuals rather than guessing', () => {
  const configured = { ...settings, detailedSpendingTracking: true, months: { '2026-10': { settlements: [settlement()] } } };
  const view = buildBudgetView(input({ settings: configured, transactions: [tx('buy', 'charge', 50, { plannedItemId: 'food' })] }));
  assert.equal(view.actual, null);
  assert.equal(view.allocations[1].recordedPaid, null);
  assert.equal(view.allocations[1].coverage, 'overlap-unresolved');
});
test('loan links use canonical ID/name matching without duplicating mortgage/car allocations or escrow', () => {
  const loanItems = [...items, item('house', 'expense', 800), item('car', 'expense', 200)];
  const loans = [{ id: 'h', name: 'Home', kind: 'house', originalAmount: 20000, remainingAmount: 10000, balanceKind: 'principal', asOf: '2026-10-01', history: [], apr: 0, principalAndInterest: 600, escrow: 200, monthlyPayment: 800, budgetItemId: 'old-house', budgetItemName: 'house' }, { id: 'c', name: 'Car', kind: 'car', originalAmount: 4000, remainingAmount: 3000, balanceKind: 'principal', asOf: '2026-10-01', history: [], apr: 0, monthlyPayment: 200, budgetItemId: 'car', budgetItemName: 'car' }];
  const active = buildActivePayoffCommitment([account], loans, loanItems, { ...settings, payoffExcludedTypes: ['Auto loan'] }, new Date('2026-10-23T12:00:00Z'));
  const configured = { ...settings, detailedSpendingTracking: true, months: { '2026-10': { settlements: [settlement({ targetId: 'house', amount: 800 })] } } };
  const view = buildBudgetView(input({ items: loanItems, loans, settings: configured, commitment: active }));
  assert.equal(view.planned.payoff, active.householdPayment - active.loanPaymentsInSpending);
  assert.equal(view.planned.spending, 1600);
  assert.equal(active.outsideSchedulePayments, 200);
  assert.equal(view.allocations.find(row => row.item.id === 'house').householdSpending, false);
  assert.equal(view.allocations.find(row => row.item.id === 'house').recordedPaid, 800);
  assert.equal(view.actual, null);
});
test('reporting month/year/lifetime filtering cannot change live forecast or saved commitments', () => {
  const source = input();
  const before = structuredClone(source);
  assert.equal(buildBudgetView({ ...source, month: '2026-09' }).planned.payoff, 123);
  assert.equal(buildBudgetView({ ...source, month: '2025-01' }).planned.payoff, 0);
  assert.deepEqual(source, before);
  assert.equal(inBudgetPeriod('2026-09-01', '2026-10', 'month'), false);
  assert.equal(inBudgetPeriod('2026-09-01', '2026-10', 'year'), true);
  assert.equal(inBudgetPeriod('2025-09-01', '2026-10', 'lifetime'), true);
});
test('mixed activity totals preserve credits, included payments and signed corrections', () => {
  const activity = buildBudgetActivity([tx('payment', 'payment', 100), tx('duplicate', 'payment', 100, { includedIn: { type: 'transaction', id: 'payment' } }), tx('credit', 'payment', 20, { credit: true }), tx('buy', 'charge', 50)], [{ id: 'a', accountId: 'card', date: '2026-10-02', createdAt: '2026-10-02', difference: 30 }], settings, '2026-10');
  assert.deepEqual(activity.totals, { payments: 100, credits: 20, netDebtChange: -40, settledSpending: 0, settledMinimums: 0 });
});
test('existing corrections, deletion and restoration flow through adapters without another ledger', () => {
  let state = { accounts: [account], transactions: [], adjustments: [] };
  const change = command => { state = changeDebtEntry(state, command, undefined, '2026-10-05T12:00:00Z', 'payment'); };
  const draft = amount => ({ accountId: 'card', kind: 'payment', amount, date: '2026-10-05', note: '', direction: 'decrease' });
  const total = () => buildBudgetActivity(state.transactions, state.adjustments, settings, '2026-10').totals.payments;
  change({ action: 'save', draft: draft(100) });
  assert.equal(total(), 100);
  change({ action: 'save', id: 'transaction:payment', draft: draft(150) });
  assert.equal(total(), 150);
  change({ action: 'delete', id: 'transaction:payment' });
  assert.equal(total(), 0);
  change({ action: 'restore', id: 'transaction:payment' });
  assert.equal(total(), 150);
});

test('loan payment observations retain escrow and never treat balance snapshots as payments', () => {
  const history = [{ date: '2026-10-03', recordedAt: '2026-10-03', amount: 3000, balanceKind: 'principal' }, { date: '2026-10-05', recordedAt: '2026-10-05', amount: 2800, balanceKind: 'principal', payment: 300, principal: 200, interest: 60, escrow: 40 }];
  const rows = budgetLoanActivity([{ id: 'loan', name: 'Home', history }], '2026-10');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].payment, 300);
  assert.equal(rows[0].principal, 200);
  assert.equal(rows[0].escrow, 40);
  assert.equal(budgetLoanActivity([{ id: 'loan', name: 'Home', history }], '2026-09').length, 0);
});
test('paid checklists remain visible when detailed spending is disabled', () => {
  const configured = { ...settings, months: { '2026-10': { settlements: [settlement()] } } };
  const view = buildBudgetView(input({ settings: configured }));
  assert.equal(view.allocations[1].recordedPaid, 50);
  assert.equal(view.actual, null);
});
