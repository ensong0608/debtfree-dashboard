import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDueReminders, dueReminderUrgency, setDueReminderPaid } from '../app/due-reminders.ts';
import { createDemoFixture } from '../mobile/demo-fixture.ts';
import { createDashboardBackup, parseDashboardContract } from '../app/dashboard-data.ts';

const account = (changes = {}) => ({ ...createDemoFixture().payload.accounts[0], dueDate: '2026-01-28', ...changes });
const item = (changes = {}) => ({ id: 'bill', name: 'Electric', kind: 'expense', category: 'Utilities', amount: 80, paymentMethod: 'debit', creditAccountId: '', recurring: true, dueDay: 27, createdAt: '2026-10-01T12:00:00Z', ...changes });
const transaction = (changes = {}) => ({ ...createDemoFixture().payload.transactions[0], date: '2026-10-20', amount: 10, ...changes });
const loan = (changes = {}) => ({ id: 'auto', name: 'Car', kind: 'car', originalAmount: 10000, remainingAmount: 5000, balanceKind: 'payoff', asOf: '2026-10-01', budgetItemId: '', budgetItemName: '', monthlyPayment: 300, dueDate: '2026-01-29', history: [], ...changes });
const input = (changes = {}) => ({ accounts: [account()], loans: [], items: [], transactions: [], settings: { detailedSpendingTracking: false, months: {} }, today: '2026-10-26', ...changes });

test('reminders combine saved obligations chronologically without changing any source data', () => {
  const source = input({ accounts: [account(), account({ id: 'archived', archivedAt: '2026-10-01' }), account({ id: 'zero', balance: 0 }), account({ id: 'undated', dueDate: '' })], loans: [loan()], items: [item()] });
  const before = structuredClone(source);
  const rows = buildDueReminders(source);
  assert.deepEqual(rows.map(row => [row.kind, row.date, row.amount, row.daysAway]), [['spending', '2026-10-27', 80, 1], ['account', '2026-10-28', 25, 2], ['loan', '2026-10-29', 300, 3]]);
  assert.deepEqual(source, before);
});

test('current minimum uses partial payments while extra, refunds, corrections and duplicate links do not clear it', () => {
  const rows = [transaction(), transaction({ id: 'extra', paymentKind: 'extra', amount: 200 }), transaction({ id: 'refund', credit: true }), transaction({ id: 'correction', reductionKind: 'adjustment' }), transaction({ id: 'duplicate', includedIn: { type: 'transaction', id: 'demo-payment' } }), transaction({ id: 'replaced', replacedByTransactionId: 'replacement' }), transaction({ id: 'deleted', deletedAt: '2026-10-21' }), transaction({ id: 'future', date: '2026-10-27' })];
  const settings = { detailedSpendingTracking: false, months: { '2026-10': { safetyBuffer: 0, minimums: { 'demo-card': 30 }, settlements: [{ id: 'paid', targetId: 'demo-card', name: 'Card', kind: 'minimum', amount: 5, date: '2026-10-22', createdAt: '2026-10-22T12:00:00Z', source: 'included' }] } } };
  assert.equal(buildDueReminders(input({ transactions: rows, settings }))[0].amount, 15);
  assert.deepEqual(buildDueReminders(input({ transactions: [transaction({ amount: 30 })], settings })), []);
});

test('today remains today; past dates and fully paid occurrences roll forward to the saved day', () => {
  assert.equal(buildDueReminders(input({ accounts: [account({ dueDate: '2026-01-26' })] }))[0].daysAway, 0);
  assert.deepEqual(buildDueReminders(input({ accounts: [account({ dueDate: '2026-01-25' })] })), []);
  const paidToday = buildDueReminders(input({ accounts: [account({ dueDate: '2026-01-26' })], transactions: [transaction({ date: '2026-10-26', amount: 25 })] }));
  assert.deepEqual(paidToday, []);
});

test('a partially paid final minimum is not cleared by capping the reduced balance first', () => {
  const source = input({ accounts: [account({ balance: 10, minimum: 25 })], transactions: [transaction({ amount: 20 })] });
  assert.equal(buildDueReminders(source)[0].amount, 5);
  assert.equal(buildDueReminders(source)[0].date, '2026-10-28');
  assert.equal(buildDueReminders(input({ accounts: [account({ balance: 10, minimum: 25 })] }))[0].amount, 10);
});

test('day 31 survives February, leap years, month-end and a year boundary', () => {
  for (const [today, expected] of [['2027-02-27', '2027-02-28'], ['2028-02-28', '2028-02-29'], ['2028-04-30', '2028-04-30'], ['2028-12-31', '2028-12-31']]) {
    const source = input({ today, accounts: [account({ dueDate: '2000-01-31' })], items: [item({ dueDay: 31 })] });
    assert.ok(buildDueReminders(source).every(row => row.date === expected));
    assert.equal(source.items[0].dueDay, 31);
  }
  assert.equal(buildDueReminders(input({ today: '2026-12-31', accounts: [account({ dueDate: '2000-01-01' })] }))[0].date, '2027-01-01');
  assert.equal(buildDueReminders(input({ today: '2026-10-31', accounts: [account({ dueDate: '2000-01-01' })] }))[0].daysAway, 1);
});

test('a linked loan bill appears once and overlapping payment sources count once', () => {
  const linked = item({ id: 'car-bill', amount: 300, dueDay: 29 });
  const tracked = loan({ budgetItemId: linked.id, history: [{ date: '2026-10-20', recordedAt: '2026-10-20T12:00:00Z', amount: 5000, balanceKind: 'payoff', payment: 100 }] });
  const source = input({ accounts: [], loans: [tracked], items: [linked], transactions: [transaction({ type: 'charge', plannedItemId: linked.id, amount: 100 })] });
  const rows = buildDueReminders(source);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].amount, 200);
  assert.equal(rows[0].kind, 'loan');
  const fallback = buildDueReminders(input({ accounts: [], items: [linked], loans: [loan({ budgetItemId: linked.id, monthlyPayment: undefined, dueDate: undefined })] }));
  assert.equal(fallback.length, 1);
  assert.equal(fallback[0].date, '2026-10-29');
  assert.equal(fallback[0].amount, 300);
});

test('bill paid acknowledgements and actual spending suppress only the covered occurrence', () => {
  const settings = { detailedSpendingTracking: false, months: { '2026-10': { safetyBuffer: 0, settlements: [{ id: 'automatic', targetId: 'bill', name: 'Electric', kind: 'spending', amount: 60, date: '2026-10-26', createdAt: '2026-10-26T12:00:00Z', source: 'debit', automatic: true }] } } };
  const rows = buildDueReminders(input({ accounts: [], items: [item({ dueDay: 26 })], transactions: [transaction({ type: 'charge', plannedItemId: 'bill', amount: 20 })], settings }));
  assert.deepEqual(rows, []);
  settings.months['2026-10'].settlements[0] = { ...settings.months['2026-10'].settlements[0], automatic: false, amount: 20 };
  const overlap = buildDueReminders(input({ accounts: [], items: [item()], transactions: [transaction({ type: 'charge', plannedItemId: 'bill', amount: 20 })], settings }));
  assert.equal(overlap[0].amount, 60);
});

test('income, one-time purchases, unknown dates and zero payments do not invent reminders', () => {
  assert.deepEqual(buildDueReminders(input({ accounts: [account({ minimum: 0 })], loans: [loan({ monthlyPayment: undefined })], items: [item({ kind: 'income' }), item({ id: 'once', recurring: false }), item({ id: 'undated', dueDay: undefined }), item({ id: 'invalid', dueDay: 32 })] })), []);
});


test('reminders start at ten days, become critical at three, and exclude later occurrences', () => {
  for (const [days, urgency] of [[-1, null], [0, 'critical'], [1, 'critical'], [3, 'critical'], [4, 'upcoming'], [10, 'upcoming'], [11, null]]) assert.equal(dueReminderUrgency(days), urgency);
  const source = input({ accounts: [account({id:'ten',dueDate:'2000-01-05'}),account({id:'eleven',dueDate:'2000-01-06'}),account({id:'four',dueDate:'2000-01-30'})] });
  assert.deepEqual(buildDueReminders(source).map(row=>[row.targetId,row.daysAway]), [['four',4],['ten',10]]);
  assert.equal(source.accounts[0].dueDate,'2000-01-05');
});


test('marking paid is idempotent, occurrence-specific metadata and Undo preserves other settings', () => {
  const source=input();const before=structuredClone(source);
  const reminder=buildDueReminders(source)[0];
  const settings=setDueReminderPaid(source.settings,reminder,true,'2026-10-26T20:00:00.000Z');
  assert.deepEqual(buildDueReminders({...source,settings}),[]);
  assert.equal(settings.dueReminderPaid.length,1);
  assert.equal(setDueReminderPaid(settings,reminder,true),settings);
  assert.equal(buildDueReminders({...source,settings,today:'2026-11-26'})[0].date,'2026-11-28');
  assert.equal(buildDueReminders({...source,settings,accounts:[account({dueDate:'2000-01-29'})]})[0].date,'2026-10-29');
  const restored=setDueReminderPaid(settings,reminder,false);
  assert.deepEqual(buildDueReminders({...source,settings:restored}),buildDueReminders(source));
  assert.equal(setDueReminderPaid(restored,reminder,false),restored);
  assert.deepEqual(source,before);
});

test('an early paid acknowledgement stays tied to next month across a calendar boundary', () => {
  const source=input({accounts:[account({dueDate:'2000-01-01'})]});
  const reminder=buildDueReminders(source)[0];
  assert.equal(reminder.date,'2026-11-01');
  const settings=setDueReminderPaid(source.settings,reminder,true,'2026-10-26T20:00:00.000Z');
  assert.deepEqual(buildDueReminders({...source,settings,today:'2026-11-01'}),[]);
  assert.equal(buildDueReminders({...source,settings,today:'2026-11-26'})[0].date,'2026-12-01');
});

test('paid acknowledgements round trip in household data without changing financial records', () => {
  const contract=createDemoFixture();const before=structuredClone(contract.payload);
  const settings=setDueReminderPaid(contract.payload.monthlyPlan,{id:'loan:example',date:'2026-10-29'},true,'2026-10-26T20:00:00.000Z');
  const saved=createDashboardBackup({...contract.payload,monthlyPlan:settings},contract);
  const reopened=parseDashboardContract(saved).payload;
  assert.deepEqual(reopened.monthlyPlan.dueReminderPaid,settings.dueReminderPaid);
  for(const key of ['accounts','transactions','snapshots','monthlyBudgets','balanceAdjustments'])assert.deepEqual(reopened[key],before[key]);
  assert.equal(reopened.monthlyPlan.progressStartingBalance,before.monthlyPlan.progressStartingBalance);
  for(const date of ['2026-02-30','bad']) {
    assert.throws(()=>setDueReminderPaid(settings,{id:'account:example',date},true),/invalid/);
    const malformed=structuredClone(saved);malformed.payload.monthlyPlan.dueReminderPaid[0].date=date;
    assert.throws(()=>parseDashboardContract(malformed));
  }
});
