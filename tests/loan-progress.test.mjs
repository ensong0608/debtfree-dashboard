import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { regularLoanPayment, linkedLoanPayment, loanProgress, loanPaymentSplit, recordLoanPayment } from '../app/loan-progress.ts';
import { parseDashboardContract, serializeDashboardBackup } from '../app/dashboard-data.ts';
import { mergeDashboardPayload } from '../app/data-transfer.ts';

const loan = { id: 'loan-a', name: 'Home', kind: 'house', originalAmount: 100000, remainingAmount: 80000, balanceKind: 'principal', asOf: '2026-10-06', budgetItemId: 'bill-a', budgetItemName: 'Mortgage', history: [] };
test('loan progress handles paid-off and increased balances without negative progress', () => {
  assert.deepEqual(loanProgress(loan), { reduction: 20000, percent: 20 });
  assert.equal(loanProgress({ ...loan, remainingAmount: 0 }).percent, 100);
  assert.equal(loanProgress({ ...loan, remainingAmount: 120000 }).percent, 0);
});
test('Budget payment follows edits and monthly copies without guessing ambiguous names', () => {
  const bill = { id: 'bill-a', name: 'Mortgage', kind: 'expense', amount: 2000 };
  assert.equal(linkedLoanPayment(loan, [bill]).amount, 2000);
  assert.equal(linkedLoanPayment(loan, [{ ...bill, name: 'Renamed', amount: 2100 }]).amount, 2100);
  assert.equal(linkedLoanPayment(loan, [{ ...bill, id: 'next-month' }]).amount, 2000);
  assert.equal(linkedLoanPayment(loan, [{ ...bill, id: 'a' }, { ...bill, id: 'b' }]), null);
  assert.equal(linkedLoanPayment(loan, [{ ...bill, kind: 'income' }]), null);
  assert.equal(linkedLoanPayment(loan, []), null);
});
test('loan data survives backup roundtrip; malformed balances and dates are rejected', () => {
  const contract = parseDashboardContract(JSON.parse(readFileSync('tests/fixtures/legacy-v0.json', 'utf8')));
  contract.payload.monthlyPlan.loanTrackers = [loan];
  assert.deepEqual(JSON.parse(serializeDashboardBackup(contract)).payload.monthlyPlan.loanTrackers, [loan]);
  for (const change of [{ originalAmount: 0 }, { remainingAmount: -1 }, { remainingAmount: Infinity }, { asOf: '2026-02-30' }, { kind: 'unknown' }, { history: [{ date: 'bad', amount: 1 }] }]) {
    const invalid = structuredClone(contract); invalid.payload.monthlyPlan.loanTrackers = [{ ...loan, ...change }];
    assert.throws(() => parseDashboardContract(invalid));
  }
});

test('merge preserves unrelated loan trackers', () => {
  const payload = parseDashboardContract(JSON.parse(readFileSync('tests/fixtures/legacy-v0.json', 'utf8'))).payload;
  const incoming = structuredClone(payload);
  payload.monthlyPlan.loanTrackers = [loan];
  incoming.monthlyPlan.loanTrackers = [{ ...loan, id: 'loan-b', name: 'Car' }];
  assert.deepEqual(mergeDashboardPayload(payload, incoming).monthlyPlan.loanTrackers.map(loan => loan.id), ['loan-a', 'loan-b']);
});

test('Pennymac amortization matches statements and reduces only principal', () => {
  const home = { ...loan, originalAmount: 367045, remainingAmount: 313990.56, apr: 3.625, escrow: 618.37, principalAndInterest: 1592.53, asOf: '2026-09-14' };
  assert.deepEqual(loanPaymentSplit(home, 2210.90), { interest: 948.51, principal: 644.02, escrow: 618.37, extraPrincipal: 0, total: 2210.90, remainingAmount: 313346.54 });
  const october = recordLoanPayment(home, 2210.90, '2026-10-01');
  assert.equal(october.history[0].principal, 644.02);
  assert.equal(loanPaymentSplit(october, 2210.90).interest, 946.57);
  assert.equal(loanPaymentSplit(october, 2210.90).remainingAmount, 312700.58);
  assert.equal(loanPaymentSplit(home, 2210.90, 100).remainingAmount, 313246.54);
  assert.throws(() => recordLoanPayment(october, 2210.90, '2026-10-02'), /already recorded/);
  assert.throws(() => recordLoanPayment(home, 2210.90, '2026-08-01'), /date/);
  assert.throws(() => loanPaymentSplit({ ...home, balanceKind: 'payoff' }, 2210.90));
  assert.throws(() => loanPaymentSplit(home, 100));
  assert.throws(() => loanPaymentSplit(home, NaN));
  const contract = parseDashboardContract(JSON.parse(readFileSync('tests/fixtures/legacy-v0.json', 'utf8')));
  contract.payload.monthlyPlan.loanTrackers = [october];
  assert.deepEqual(parseDashboardContract(JSON.parse(serializeDashboardBackup(contract))).payload.monthlyPlan.loanTrackers, [october]);
});

test('explicit total payments override legacy links and subtract mortgage escrow exactly once', () => {
 const home = {...loan, apr: 3.625, escrow: 600, principalAndInterest: 1400};
 const items = [{id:'bill-a', name:'Mortgage', kind:'expense', amount:2500}];
 assert.equal(regularLoanPayment(home, []), 2000);
 assert.equal(regularLoanPayment(home, items), 2500);
 assert.equal(regularLoanPayment({...home,principalAndInterest:undefined},items),2500);
 assert.equal(regularLoanPayment({...home,monthlyPayment:2200},items),2200);
 assert.equal(loanPaymentSplit({...home,monthlyPayment:2200},2200).principal,1358.33);
 assert.equal(loanPaymentSplit({...home,kind:'car',escrow:undefined},1000).escrow,0);
 assert.equal(loanPaymentSplit({...home,kind:'car',escrow:600},1000).principal,758.33);
});
test('new optional payment/date fields roundtrip alongside unchanged legacy history and snapshots', () => {
 const contract=parseDashboardContract(JSON.parse(readFileSync('tests/fixtures/legacy-v0.json','utf8')));
 const history=[{date:'2026-10-01',amount:80000,balanceKind:'payoff',recordedAt:'2026-10-01T12:00:00Z'}];
 contract.payload.monthlyPlan.loanTrackers=[{...loan,history,monthlyPayment:2210.90,dueDate:'2027-01-15'}];
 const roundtrip=parseDashboardContract(JSON.parse(serializeDashboardBackup(contract)));
 assert.deepEqual(roundtrip.payload,contract.payload);
 for(const change of [{monthlyPayment:-1},{monthlyPayment:Infinity},{dueDate:'2026-02-30'}]) {
  const invalid=structuredClone(contract); Object.assign(invalid.payload.monthlyPlan.loanTrackers[0],change);
  assert.throws(()=>parseDashboardContract(invalid));
 }
});
