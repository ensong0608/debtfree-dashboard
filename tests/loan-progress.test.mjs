import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { linkedLoanPayment, loanProgress } from '../app/loan-progress.ts';
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
