import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProgressView } from '../app/progress-view.ts';
import { buildActualProgress } from '../app/debt-activity.ts';
const date = new Date('2026-10-23T12:00:00Z');
const account = (overrides = {}) => ({ id: 'a', name: 'Card', type: 'Credit card', balance: 800, baselineBalance: 2000, apr: 0, minimum: 100, minimumMode: 'manual', payoffMode: 'priority', interestFee: 0, creditLimit: 5000, dueDate: '', promoEndDate: '', postPromoApr: 0, postPromoMinimum: 0, createdAt: '2026-06-01', ...overrides });
const snapshot = (month, balance, overrides = {}) => ({ id: month, month, totalBalance: balance, capturedAt: month + '-20T12:00:00Z', accounts: [{ accountId: 'a', balance }], revisions: [], ...overrides });
const loan = (overrides = {}) => ({ id: 'l', name: 'Car', kind: 'car', originalAmount: 5000, remainingAmount: 3000, balanceKind: 'principal', asOf: '2026-10-20', history: [], apr: 0, monthlyPayment: 200, ...overrides });
const input = (overrides = {}) => ({ accounts: [account()], loans: [], transactions: [], adjustments: [], snapshots: [], startingBalance: 2000, date, ...overrides });
const milestone = (view, id) => view.milestones.find(item => item.id === id);
const forecast = (settings = {}) => ({ settings: { months: {}, payoffPlanAmount: 200, ...settings }, items: [] });

test('account summary exactly preserves actual authority, signed increases and unknown baseline', () => {
  for (const balance of [800, 2500]) {
    const source = input({ accounts: [account({ balance })] });
    const actual = buildActualProgress(source.accounts, [], [], [], date, 2000);
    const view = buildProgressView(source);
    assert.equal(view.summary.current, actual.current);
    assert.equal(view.summary.reduction, actual.reduction);
    assert.equal(view.summary.percent, actual.percent);
  }
  const unknown = buildProgressView(input({ accounts: [account({ baselineBalance: undefined })], startingBalance: undefined }));
  assert.equal(unknown.summary.starting, null);
  assert.equal(unknown.summary.reduction, null);
  assert.equal(milestone(unknown, 'quarter').status, 'pending');
});

test('fixed baseline, removed balances, revisions and reconciliation remain unchanged', () => {
  const original = snapshot('2026-06', 2000);
  const source = input({ accounts: [account({ reconciliation: { date: '2026-10-10', balance: 800, offset: 0, createdAt: '2026-10-10T12:00:00Z', coveredTransactionIds: ['paid'] } })],
    transactions: [{ id: 'paid', accountId: 'a', date: '2026-10-09', type: 'payment', amount: 400, createdAt: '2026-10-09T12:00:00Z' }],
    removedAccounts: [{ id: 'old', name: 'Old', balance: 300, baselineBalance: 500, removedAt: '2026-10-01' }], snapshots: [snapshot('2026-06', 1700, { revisions: [original] })] });
  const before = structuredClone(source);
  const view = buildProgressView(source);
  assert.equal(view.summary.starting, 2000);
  assert.equal(view.summary.current, 1100);
  assert.equal(view.actual.retainedCount, 1);
  assert.equal(view.actual.baseline.totalBalance, 2000);
  assert.equal(view.observations[0].comparable, false);
  assert.equal(view.trend[0].savedBalance, null);
  assert.deepEqual(source, before);
});

test('saved trend leaves gaps, separates live values and retains signed observed changes', () => {
  const view = buildProgressView(input({ snapshots: [snapshot('2026-06', 2000), snapshot('2026-08', 1500), snapshot('2026-09', 1700)] }));
  assert.deepEqual(view.trend.map(point => point.savedBalance), [2000, null, 1500, 1700, null]);
  assert.deepEqual(view.trend.map(point => point.observedNetChange), [null, null, null, 200, null]);
  assert.equal(view.live.balance, 800);
  assert.equal(buildProgressView(input()).trend[0].savedBalance, null);
});

test('first observed threshold and live attainment never invent crossing/start dates', () => {
  const saved = buildProgressView(input({ snapshots: [snapshot('2026-08', 900)] }));
  assert.equal(milestone(saved, 'half').status, 'achieved');
  assert.equal(milestone(saved, 'half').firstObservedMonth, '2026-08');
  assert.equal(milestone(saved, 'half').achievedOn, null);
  assert.equal(saved.summary.startingDate, null);
  const live = milestone(buildProgressView(input()), 'half');
  assert.equal(live.evidence, 'live-balance');
  assert.equal(live.firstObservedMonth, null);
  assert.equal(live.achievedOn, null);
});

test('payment milestones exclude deleted, linked, credit and adjustment records', () => {
  const payment = { id: 'p', accountId: 'a', date: '2026-09-01', createdAt: '2026-09-02', type: 'payment', amount: 100, balanceBefore: 100, balanceAfter: 0 };
  const excluded = [{ ...payment, deletedAt: '2026-10-01' }, { ...payment, id: 'linked', includedIn: { type: 'transaction' } }, { ...payment, id: 'credit', credit: true }, { ...payment, id: 'adjust', reductionKind: 'adjustment' }];
  assert.equal(milestone(buildProgressView(input({ transactions: excluded })), 'first-payment').status, 'pending');
  const view = buildProgressView(input({ transactions: [payment] }));
  assert.equal(milestone(view, 'first-payment').achievedOn, '2026-09-01');
  assert.equal(milestone(view, 'first-debt').achievedOn, '2026-09-01');
});

test('scopes keep account baseline separate from loan originals and avoid carrying loan history forward', () => {
  const source = input({ loans: [loan({ history: [{ date: '2026-08-20', amount: 4000, balanceKind: 'principal', recordedAt: '2026-08-21' }] })], snapshots: [snapshot('2026-08', 1500), snapshot('2026-09', 1000)] });
  const accounts = buildProgressView(source, 'accounts'), loans = buildProgressView(source, 'loans'), household = buildProgressView(source, 'household');
  assert.equal(accounts.summary.starting, 2000);
  assert.equal(loans.summary.starting, 5000);
  assert.equal(household.summary.starting, 7000);
  assert.equal(household.summary.current, 3800);
  assert.deepEqual(loans.accountIds, []);
  assert.deepEqual(accounts.loanIds, []);
  assert.deepEqual(household.observations.map(point => point.balance), [5500]);
  assert.equal(household.trend.find(point => point.month === '2026-09').savedBalance, null);
  assert.deepEqual(loans.loanHistory[0].history, source.loans[0].history);
});

test('loan history requires all loans, matching balance kinds and exact observation days', () => {
  const loans = [loan({ history: [{ date: '2026-08-20', amount: 4000, balanceKind: 'principal', recordedAt: '2026-08-21' }] }), loan({ id: 'other', history: [{ date: '2026-08-21', amount: 1000, balanceKind: 'principal' }, { date: '2026-08-20', amount: 1200, balanceKind: 'payoff' }] })];
  assert.deepEqual(buildProgressView(input({ loans }), 'loans').observations, []);
  const unavailable = buildProgressView(input({ loans: [loan({ originalAmount: 0 })] }), 'loans');
  assert.equal(unavailable.summary.reduction, null);
});

test('same-day loan revisions use latest saved version; increases remain signed', () => {
  const source = input({ loans: [loan({ remainingAmount: 5500, history: [{ date: '2026-09-01', amount: 4000, balanceKind: 'principal', recordedAt: '2026-09-02' }, { date: '2026-09-01', amount: 4500, balanceKind: 'principal', recordedAt: '2026-09-03' }] })] });
  const view = buildProgressView(source, 'loans');
  assert.equal(view.observations[0].balance, 4500);
  assert.equal(view.summary.reduction, -500);
  assert.equal(view.summary.percent, -10);
});

test('canonical complete forecast yields projected milestones only for matching scope', () => {
  const source = input({ accounts: [account({ balance: 1800 })], forecast: forecast() });
  const view = buildProgressView(source);
  assert.ok(view.forecast);
  assert.equal(milestone(view, 'half').status, 'projected');
  assert.ok(milestone(view, 'half').projectedMonth);
  assert.equal(milestone(view, 'half').achievedOn, null);
  assert.equal(view.fasterPayoffComparison, null);
  assert.equal(buildProgressView({ ...source, loans: [loan()] }).forecast, null);
  assert.equal(buildProgressView({ ...source, forecast: forecast({ payoffExcludedTypes: ['Credit card'] }) }).forecast, null);
  assert.equal(buildProgressView({ ...source, removedAccounts: [{ id: 'removed', name: 'Removed', balance: 200, removedAt: '2026-10-01' }] }).forecast, null);
});

test('stalled or missing-term forecasts cannot produce projected achievements', () => {
  const view = buildProgressView(input({ accounts: [account({ balance: 1800, minimum: 0 })], forecast: forecast({ payoffPlanAmount: 0 }) }));
  assert.equal(view.forecast, null);
  assert.equal(milestone(view, 'debt-free').status, 'pending');
  const missing = buildProgressView(input({ loans: [loan({ apr: undefined })], forecast: forecast() }), 'household');
  assert.equal(missing.forecast, null);
});

test('recorded monthly activity is distinct from observed changes and missing is null', () => {
  const view = buildProgressView(input({ transactions: [{ id: 'p', accountId: 'a', date: '2026-08-01', createdAt: '2026-08-01', type: 'payment', amount: 100 }] }));
  assert.equal(view.trend[0].month, '2026-08');
  assert.equal(view.trend[0].recordedAccountChange, -100);
  assert.equal(view.trend[0].observedNetChange, null);
  assert.equal(view.trend[1].recordedAccountChange, null);
});

test('saved payoff observations survive a later increase without inventing an achievement date', () => {
  const card = buildProgressView(input({ snapshots: [snapshot('2026-08', 0)] }));
  assert.equal(milestone(card, 'first-debt').status, 'achieved');
  assert.equal(milestone(card, 'first-debt').firstObservedMonth, '2026-08');
  assert.equal(milestone(card, 'first-debt').achievedOn, null);
  const loans = buildProgressView(input({ loans: [loan({ history: [{ date: '2026-08-20', amount: 0, balanceKind: 'principal', recordedAt: '2026-08-20' }] })] }), 'loans');
  assert.equal(milestone(loans, 'first-debt').status, 'achieved');
  assert.equal(milestone(loans, 'first-debt').achievedOn, null);
});

test('a same-day loan correction does not retain a superseded payoff claim', () => {
  const view = buildProgressView(input({ loans: [loan({ history: [
    { date: '2026-08-20', amount: 0, balanceKind: 'principal', recordedAt: '2026-08-20' },
    { date: '2026-08-20', amount: 3000, balanceKind: 'principal', recordedAt: '2026-08-21' },
  ] })] }), 'loans');
  assert.equal(milestone(view, 'first-debt').status, 'pending');
});

test('conflicting same-day loan balances without recording order remain unavailable', () => {
  const view = buildProgressView(input({ loans: [loan({ history: [
    { date: '2026-08-20', amount: 0, balanceKind: 'principal' },
    { date: '2026-08-20', amount: 3000, balanceKind: 'principal', recordedAt: '2026-08-21' },
  ] })] }), 'loans');
  assert.deepEqual(view.observations, []);
  assert.equal(milestone(view, 'first-debt').status, 'pending');
});
