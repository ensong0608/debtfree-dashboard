import test from 'node:test';
import assert from 'node:assert/strict';
import { associateDuePayment, buildDueReminders, duePaymentCandidates, dueReminderUrgency, loanHistorySourceId } from '../app/due-reminders.ts';
import { effectiveMinimum, estimatedMinimum } from '../app/payoff-engine.ts';
import { createDemoFixture, } from '../mobile/demo-fixture.ts';
import { createDashboardBackup, parseDashboardContract } from '../app/dashboard-data.ts';

const account = (changes = {}) => ({ ...createDemoFixture().payload.accounts[0], id: 'card', name: 'Card', balance: 5000, minimum: 350, minimumMode: 'manual', dueDate: '2026-01-28', ...changes });
const item = (changes = {}) => ({ id: 'bill', name: 'Electric', kind: 'expense', category: 'Utilities', amount: 80, paymentMethod: 'debit', creditAccountId: '', recurring: true, dueDay: 27, createdAt: '2026-10-01T12:00:00Z', ...changes });
const transaction = (changes = {}) => ({ ...createDemoFixture().payload.transactions[0], id: 'payment-1', date: '2026-10-20', amount: 224.45, type: 'payment', accountId: 'card', credit: false, ...changes });
const loan = (changes = {}) => ({ id: 'auto', name: 'Car', kind: 'car', originalAmount: 10000, remainingAmount: 5000, balanceKind: 'payoff', asOf: '2026-10-01', budgetItemId: '', budgetItemName: '', monthlyPayment: 300, dueDate: '2026-01-29', history: [], ...changes });
const settings = (changes = {}) => ({ detailedSpendingTracking: false, months: {}, ...changes });
const input = (changes = {}) => ({ accounts: [account()], loans: [], items: [], transactions: [], adjustments: [], settings: settings(), today: '2026-10-26', ...changes });

test('due reminders use visible minimum or the shared balance/APR estimate, never old monthly targets', () => {
  const debt = account({ minimum: 350, minimumMode: 'manual' });
  const hiddenPlan = settings({ months: { '2026-10': { safetyBuffer: 0, minimums: { card: 250 }, payments: { card: 250 } } } });
  assert.equal(buildDueReminders(input({ accounts: [debt], settings: hiddenPlan }))[0].requiredAmount, 350);
  const missingMinimum = account({ minimum: 0, minimumMode: 'manual' });
  assert.equal(effectiveMinimum(missingMinimum), 0);
  assert.equal(buildDueReminders(input({ accounts: [missingMinimum] }))[0].requiredAmount, estimatedMinimum(missingMinimum.balance, missingMinimum.apr));
  assert.ok(buildDueReminders(input({ accounts: [missingMinimum] }))[0].requiredAmount > 0);
});

test('a same-cycle payment changes the minimum only after explicit pairing, with partial and full amounts', () => {
  const base = input({ transactions: [transaction()] });
  const reminder = buildDueReminders(base)[0];
  assert.equal(reminder.amount, 350);
  const linked = associateDuePayment(base.settings, reminder, { type: 'transaction', id: 'payment-1' });
  const partial = buildDueReminders({ ...base, settings: linked })[0];
  assert.equal(partial.paidAmount, 224.45);
  assert.equal(partial.amount, 125.55);
  const more = associateDuePayment(linked, reminder, { type: 'transaction', id: 'payment-2' });
  assert.deepEqual(buildDueReminders({ ...base, transactions: [...base.transactions, transaction({ id: 'payment-2', amount: 244.45 })], settings: more }), []);
  const excess = associateDuePayment(base.settings, reminder, { type: 'transaction', id: 'payment-3' });
  assert.deepEqual(buildDueReminders({ ...base, transactions: [transaction({ id: 'payment-3', amount: 500 })], settings: excess }), []);
});

test('correcting or deleting a linked record immediately recalculates the due amount', () => {
  const source = input({ transactions: [transaction({ amount: 350 })] });
  const reminder = buildDueReminders(source)[0];
  const linked = associateDuePayment(source.settings, reminder, { type: 'transaction', id: 'payment-1' });
  assert.deepEqual(buildDueReminders({ ...source, settings: linked }), []);
  const corrected = { ...source.transactions[0], amount: 100, replacedByTransactionId: 'replacement' };
  const replacement = transaction({ id: 'replacement', amount: 100, date: '2026-10-21', replacesTransactionId: 'payment-1' });
  const correctedReminder = buildDueReminders({ ...source, transactions: [corrected, replacement], settings: linked })[0];
  assert.equal(correctedReminder.paidAmount, 100);
  assert.equal(correctedReminder.amount, 250);
  assert.deepEqual(duePaymentCandidates(correctedReminder, { ...source, transactions: [corrected, replacement], settings: linked, loans: [] }), []);
  const restoredReminder = buildDueReminders({ ...source, transactions: [corrected, { ...replacement, deletedAt: null }], settings: linked })[0];
  assert.equal(restoredReminder.paidAmount, 100);
  const deletedReminder = buildDueReminders({ ...source, transactions: [{ ...source.transactions[0], deletedAt: '2026-10-22' }], settings: linked })[0];
  assert.equal(deletedReminder.amount, 350);
});

test('unlinked payments, extras, credits, corrections, deleted and replaced rows do not count', () => {
  const transactions = [transaction(), transaction({ id: 'extra', paymentKind: 'extra', amount: 200 }), transaction({ id: 'credit', credit: true }), transaction({ id: 'correction', reductionKind: 'adjustment' }), transaction({ id: 'deleted', deletedAt: '2026-10-21' }), transaction({ id: 'replaced', replacedByTransactionId: 'replacement' }), transaction({ id: 'future', date: '2026-10-29' })];
  const source = input({ transactions });
  assert.equal(buildDueReminders(source)[0].amount, 350);
  assert.deepEqual(duePaymentCandidates(buildDueReminders(source)[0], { ...source, loans: [] }).map(row => row.source.id), ['payment-1']);
});

test('a late payment can still be paired to its visible overdue occurrence', () => {
  const source = input({ today: '2026-10-30', accounts: [account({ dueDate: '2026-01-28' })], transactions: [transaction({ date: '2026-10-29', amount: 350 })] });
  const reminder = buildDueReminders(source)[0];
  assert.equal(reminder.daysAway, -2);
  assert.equal(duePaymentCandidates(reminder, { ...source, loans: [] }).length, 1);
  const settingsWithLink = associateDuePayment(source.settings, reminder, { type: 'transaction', id: 'payment-1' });
  assert.deepEqual(buildDueReminders({ ...source, settings: settingsWithLink }), []);
});

test('confirmed balance payment adjustments are pairable once and count only when confirmed', () => {
  const adjustment = { id: 'adj-1', accountId: 'card', date: '2026-10-21', balanceBefore: 5000, balanceAfter: 4800, difference: -200, createdAt: '2026-10-21T12:00:00Z', confirmedPayment: { confirmedAt: '2026-10-21T12:01:00Z' } };
  const unconfirmed = { ...adjustment, id: 'adj-2', confirmedPayment: undefined };
  const source = input({ adjustments: [adjustment, unconfirmed] });
  const reminder = buildDueReminders(source)[0];
  const candidate = duePaymentCandidates(reminder, { ...source, loans: [] }).find(row => row.source.id === 'adj-1');
  assert.ok(candidate);
  const linked = associateDuePayment(source.settings, reminder, candidate.source);
  const result = buildDueReminders({ ...source, settings: linked })[0];
  assert.equal(result.paidAmount, 200);
  assert.equal(result.amount, 150);
  const duplicateTxn = transaction({ id: 'adjustment-view', includedIn: { type: 'adjustment', id: 'adj-1' }, amount: 200 });
  assert.equal(buildDueReminders({ ...source, transactions: [duplicateTxn], settings: linked })[0].paidAmount, 200);
});

test('recurring Budget bills pair their existing planned-item transaction or paid settlement', () => {
  const bill = item({ dueDay: 26, amount: 80 });
  const charge = transaction({ id: 'bill-charge', type: 'charge', plannedItemId: 'bill', accountId: '', amount: 32, date: '2026-10-25' });
  const source = input({ accounts: [], items: [bill], transactions: [charge] });
  const reminder = buildDueReminders(source)[0];
  assert.equal(reminder.amount, 80);
  const candidate = duePaymentCandidates(reminder, { ...source, loans: [] })[0];
  assert.equal(candidate.source.id, 'bill-charge');
  const linked = associateDuePayment(source.settings, reminder, candidate.source);
  assert.equal(buildDueReminders({ ...source, settings: linked })[0].amount, 48);
  const wrongBill = transaction({ id: 'wrong', type: 'charge', plannedItemId: 'another-bill', accountId: '', amount: 80 });
  assert.equal(duePaymentCandidates(reminder, { ...source, transactions: [wrongBill], loans: [] }).length, 0);
  const settlement = { id: 'settled-bill', targetId: 'bill', name: 'Electric', kind: 'spending', amount: 80, date: '2026-10-26', createdAt: '2026-10-26T12:00:00Z', source: 'debit', automatic: true };
  const settled = settings({ months: { '2026-10': { safetyBuffer: 0, settlements: [settlement] } } });
  const settledReminder = buildDueReminders({ ...source, transactions: [], settings: settled })[0];
  const paidRecord = duePaymentCandidates(settledReminder, { transactions: [], adjustments: [], loans: [], settings: settled })[0];
  assert.equal(paidRecord.source.type, 'settlement');
  assert.deepEqual(buildDueReminders({ ...source, transactions: [], settings: associateDuePayment(settled, settledReminder, paidRecord.source) }), []);
});

test('loan history payments must be paired to their due occurrence', () => {
  const entry = { date: '2026-10-20', recordedAt: '2026-10-20T12:00:00Z', amount: 5000, balanceKind: 'payoff', payment: 100 };
  const car = loan({ history: [entry] });
  const source = input({ accounts: [], loans: [car] });
  const reminder = buildDueReminders(source)[0];
  const candidate = duePaymentCandidates(reminder, { ...source, adjustments: [] })[0];
  assert.equal(candidate.source.id, loanHistorySourceId('auto', entry));
  const linked = associateDuePayment(source.settings, reminder, candidate.source);
  assert.equal(buildDueReminders({ ...source, settings: linked })[0].amount, 200);
});

test('a recurring Budget item linked to a mortgage is one due reminder and accepts either payment record', () => {
  const mortgageBill = item({ id: 'mortgage-bill', name: 'Mortgage', amount: 1800, dueDay: 28 });
  const mortgage = loan({ id: 'home', name: 'Mortgage', kind: 'house', monthlyPayment: 1800, dueDate: '2000-01-28', budgetItemId: mortgageBill.id, budgetItemName: mortgageBill.name });
  const charge = transaction({ id: 'mortgage-transaction', title: 'Mortgage payment', type: 'charge', accountId: '', plannedItemId: mortgageBill.id, amount: 600, date: '2026-10-24' });
  const source = input({ accounts: [], loans: [mortgage], items: [mortgageBill], transactions: [charge] });
  const reminders = buildDueReminders(source);
  assert.equal(reminders.length, 1);
  assert.equal(reminders[0].kind, 'loan');
  assert.equal(reminders[0].amount, 1800);

  const candidate = duePaymentCandidates(reminders[0], source).find(row => row.source.id === charge.id);
  assert.ok(candidate);
  const linkedToLoan = associateDuePayment(source.settings, reminders[0], candidate.source);
  const partiallyPaid = buildDueReminders({ ...source, settings: linkedToLoan })[0];
  assert.equal(partiallyPaid.paidAmount, 600);
  assert.equal(partiallyPaid.amount, 1200);

  const legacyBillLink = associateDuePayment(source.settings, { id: `spending:${mortgageBill.id}`, date: reminders[0].date }, candidate.source);
  const preserved = buildDueReminders({ ...source, settings: legacyBillLink })[0];
  assert.equal(preserved.paidAmount, 600);
  assert.equal(preserved.amount, 1200);
});

test('unpaid occurrences remain visible overdue; old paid acknowledgements do not erase payment requirements', () => {
  const reminder = buildDueReminders(input({ today: '2026-10-30', accounts: [account({ dueDate: '2026-01-28' })], settings: settings({ dueReminderPaid: [{ id: 'account:card', date: '2026-10-28', markedAt: '2026-10-27T12:00:00Z' }] }) }))[0];
  assert.equal(reminder.date, '2026-10-28');
  assert.equal(reminder.daysAway, -2);
  assert.equal(reminder.paymentStatus, 'unpaid');
  assert.equal(dueReminderUrgency(reminder.daysAway), 'overdue');
});

test('paid occurrences advance to the next monthly due date, including month-end rules', () => {
  const source = input({ accounts: [account({ dueDate: '2000-01-31' })], today: '2028-02-27' });
  assert.equal(buildDueReminders(source)[0].date, '2028-02-29');
  const febReminder = buildDueReminders(source)[0];
  const linked = associateDuePayment(source.settings, febReminder, { type: 'transaction', id: 'feb-paid' });
  assert.equal(buildDueReminders({ ...source, today: '2028-03-25', transactions: [transaction({ id: 'feb-paid', date: '2028-02-27', amount: 350 })], settings: linked })[0].date, '2028-03-31');
});

test('cycle links are idempotent and one source cannot be assigned twice', () => {
  const reminder = buildDueReminders(input())[0];
  const once = associateDuePayment(settings(), reminder, { type: 'transaction', id: 'p1' });
  assert.equal(associateDuePayment(once, reminder, { type: 'transaction', id: 'p1' }), once);
  assert.throws(() => associateDuePayment(once, { ...reminder, date: '2026-11-28' }, { type: 'transaction', id: 'p1' }), /already assigned/);
});

test('association metadata round-trips in household backups and rejects duplicate or invalid sources', () => {
  const contract = createDemoFixture();
  const reminder = buildDueReminders({ ...input({ accounts: contract.payload.accounts }), settings: contract.payload.monthlyPlan })[0];
  const settingsWithLink = associateDuePayment(contract.payload.monthlyPlan, reminder, { type: 'transaction', id: contract.payload.transactions[0].id });
  const saved = createDashboardBackup({ ...contract.payload, monthlyPlan: settingsWithLink }, contract);
  assert.deepEqual(parseDashboardContract(saved).payload.monthlyPlan.duePaymentAssociations, settingsWithLink.duePaymentAssociations);
  const malformed = structuredClone(saved);
  malformed.payload.monthlyPlan.duePaymentAssociations.push(structuredClone(malformed.payload.monthlyPlan.duePaymentAssociations[0]));
  assert.throws(() => parseDashboardContract(malformed));
  const source = input();
  const before = structuredClone(source);
  buildDueReminders(source);
  assert.deepEqual(source, before);
});

test('editing a minimum after its due date preserves the paid cycle and uses the new amount next month', async () => {
  const {minimumCycleEdit}=await import('../app/minimum-cycle.ts');
  const original=account({dueDate:'2026-01-20',minimum:100});
  const metadata=minimumCycleEdit(original,200,'2026-10-26');
  const edited={...original,...metadata,minimum:200};
  const payment=transaction({amount:100,date:'2026-10-20'});
  const linked=settings({duePaymentAssociations:[{reminderId:'account:card',dueDate:'2026-10-20',source:{type:'transaction',id:payment.id}}]});
  const reminders=buildDueReminders(input({accounts:[edited],transactions:[payment],settings:linked,upcomingWindow:null}));
  assert.equal(reminders[0].date,'2026-11-20');assert.equal(reminders[0].requiredAmount,200);
  assert.equal(minimumCycleEdit(edited,300,'2026-10-27').minimumPriorCycle.amount,100);
  const unpaid=buildDueReminders(input({accounts:[edited],upcomingWindow:null}))[0];assert.equal(unpaid.requiredAmount,100);
  assert.equal(minimumCycleEdit(original,200,'2026-10-19').minimumCycles[0].amount,200);
});

test('pending edits update today and future cycles; overdue edits keep their original obligation across month boundaries',async()=>{
 const {captureMinimumCycles,minimumCycleEdit}=await import('../app/minimum-cycle.ts');
 const original=account({dueDate:'2026-01-22',minimum:300});
 const observed=captureMinimumCycles([original],'2026-10-21')[0];
 const pending={...observed,...minimumCycleEdit(observed,350,'2026-10-21'),minimum:350};
 assert.equal(buildDueReminders(input({accounts:[pending],today:'2026-10-21'}))[0].requiredAmount,350);
 const today={...observed,...minimumCycleEdit(observed,325,'2026-10-22'),minimum:325};
 assert.equal(buildDueReminders(input({accounts:[today],today:'2026-10-22'}))[0].requiredAmount,325);
 const late={...observed,...minimumCycleEdit(observed,350,'2026-10-27'),minimum:350};
 const reminder=buildDueReminders(input({accounts:[late],today:'2026-10-27'}))[0];
 assert.equal(reminder.date,'2026-10-22');assert.equal(reminder.requiredAmount,300);assert.equal(reminder.daysAway,-5);
 const november=captureMinimumCycles([late],'2026-11-01')[0];
 const list=buildDueReminders(input({accounts:[november],today:'2026-11-01',upcomingWindow:null}));
 assert.deepEqual(list.map(row=>[row.date,row.requiredAmount]),[['2026-10-22',300],['2026-11-22',350]]);
});

test('paired cycle requirement closes a paid cycle while a real partial payment remains due',()=>{
 const debt=account({dueDate:'2026-01-22',minimum:350});
 const paid=transaction({amount:300,date:'2026-10-22'});
 const closed=associateDuePayment(settings(),{id:'account:card',date:'2026-10-22',requiredAmount:300},{type:'transaction',id:paid.id},paid.amount);
 assert.equal(closed.duePaymentAssociations[0].requiredAmount,300);
 const list=buildDueReminders(input({accounts:[debt],transactions:[paid],settings:closed,upcomingWindow:null}));
 assert.equal(list[0].date,'2026-11-22');assert.equal(list[0].requiredAmount,350);
 const partial=associateDuePayment(settings(),{id:'account:card',date:'2026-10-22',requiredAmount:350},{type:'transaction',id:paid.id},paid.amount);
 assert.equal(buildDueReminders(input({accounts:[debt],transactions:[paid],settings:partial}))[0].amount,50);
 const deleted=buildDueReminders(input({accounts:[debt],transactions:[{...paid,deletedAt:'2026-10-26'}],settings:closed}));
 assert.equal(deleted[0].amount,300);
});

test('partial pending links do not close at the old minimum after a pending edit',async()=>{
 const {captureMinimumCycles,minimumCycleEdit}=await import('../app/minimum-cycle.ts');
 let debt=captureMinimumCycles([account({dueDate:'2026-01-28',minimum:300})],'2026-10-20')[0];
 const first=transaction({id:'first',amount:100,date:'2026-10-20'});
 let plan=associateDuePayment(settings(),{id:'account:card',date:'2026-10-28',requiredAmount:300,paidAmount:0},{type:'transaction',id:'first'},100);
 debt={...debt,...minimumCycleEdit(debt,350,'2026-10-21'),minimum:350};
 let reminder=buildDueReminders(input({accounts:[debt],transactions:[first],settings:plan,today:'2026-10-21'}))[0];assert.equal(reminder.amount,250);
 const second=transaction({id:'second',amount:200,date:'2026-10-22'});
 plan=associateDuePayment(plan,reminder,{type:'transaction',id:'second'},200);
 reminder=buildDueReminders(input({accounts:[debt],transactions:[first,second],settings:plan,today:'2026-10-29'}))[0];assert.equal(reminder.amount,50);assert.equal(reminder.date,'2026-10-28');
});

test('cycle amounts and completed pairing metadata survive backups and reject malformed history',()=>{
 const fixture=createDemoFixture();
 fixture.payload.accounts[0].minimumCycles=[{date:'2026-10-22',amount:300}];
 fixture.payload.monthlyPlan=associateDuePayment(fixture.payload.monthlyPlan,{id:'account:demo-card',date:'2026-10-22',requiredAmount:300,paidAmount:0},{type:'transaction',id:'demo-payment'},300);
 const backup=createDashboardBackup(fixture.payload,fixture);const restored=parseDashboardContract(backup).payload;
 assert.deepEqual(restored.accounts[0].minimumCycles,[{date:'2026-10-22',amount:300}]);assert.equal(restored.monthlyPlan.duePaymentAssociations[0].completed,true);
 const bad=structuredClone(backup);bad.payload.accounts[0].minimumCycles.push({...bad.payload.accounts[0].minimumCycles[0]});assert.throws(()=>parseDashboardContract(bad));
});
