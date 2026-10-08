import test from 'node:test';
import assert from 'node:assert/strict';
import { entryHistory } from '../app/entry-history.ts';
import { changeDebtEntry, signedEntryDraft } from '../app/debt-transactions.ts';
import { createBalanceAdjustment } from '../app/debts-screen.ts';
import { transactionAdjustedAccounts } from '../app/progress-balances.ts';
import { paymentActivity } from '../app/payments.ts';

const account = { id:'citi', name:'Citi Cash - Mama', balance:5744.28, apr:0, minimum:0, minimumMode:'manual', type:'Credit card', createdAt:'2026-09-01' };
const original = { accountId:'citi', date:'2026-10-07', amount:-224.45, before:5744.28, after:5519.83 };
function fixture() {
  const result = createBalanceAdjustment({ storedAccount:account, currentBalance:5744.28, nextBalance:5519.83, date:'2026-10-07', id:'adj' });
  return { accounts:[result.account, {...account,id:'other',balance:1000}], transactions:[], adjustments:[result.adjustment] };
}
function edit(state, fields={}) {
  return changeDebtEntry(state, { action:'save', id:'adjustment:adj', draft:signedEntryDraft(state.adjustments[0], { accountId:'citi',date:'2026-10-07',amount:'-224.45',title:'Balance update',note:'',...fields }) }, undefined, '2026-10-08T15:48:18.814Z');
}
test('renaming a lender update retains its original captured change and a separate zero-effect edit',()=>{
  const initial=fixture(); const saved=edit(initial);
  assert.deepEqual(entryHistory(saved.adjustments[0]).original, original);
  assert.equal(entryHistory(saved.adjustments[0]).before,5744.28);
  assert.equal(entryHistory(saved.adjustments[0]).after,5519.83);
  assert.deepEqual(entryHistory(saved.adjustments[0]).events[0].movement,[{accountId:'citi',before:5519.83,after:5519.83}]);
  assert.equal(transactionAdjustedAccounts(saved.accounts,[])[0].balance,5519.83);
  assert.equal(paymentActivity([],saved.adjustments)[0].before,5744.28);
  assert.equal(initial.adjustments[0].balanceBefore,5744.28);
  const again=edit(saved,{note:'A note'});
  assert.deepEqual(entryHistory(again.adjustments[0]).original, original);
  assert.equal(again.adjustments[0].revisions.length,2);
});
test('changed amount, sign, date or account keeps original history but does not attach it to the corrected row',()=>{
  for(const fields of [{amount:'-200'}, {amount:'+224.45'}, {date:'2026-09-30'}, {accountId:'other'}]) {
    const saved=edit(fixture(),fields); const history=entryHistory(saved.adjustments[0]);
    assert.deepEqual(history.original,original);
    assert.equal(history.before,undefined); assert.equal(history.after,undefined);
  }
});
test('delete and restore retain the original capture without applying an extra movement',()=>{
  let state=edit(fixture());
  state=changeDebtEntry(state,{action:'delete',id:'adjustment:adj'});
  assert.deepEqual(entryHistory(state.adjustments[0]).original,original);
  assert.equal(entryHistory(state.adjustments[0]).before,undefined);
  assert.equal(transactionAdjustedAccounts(state.accounts,[])[0].balance,5744.28);
  state=changeDebtEntry(state,{action:'restore',id:'adjustment:adj'});
  assert.equal(entryHistory(state.adjustments[0]).before,5744.28);
  assert.equal(transactionAdjustedAccounts(state.accounts,[])[0].balance,5519.83);
});
test('an invalid original pair is not reconstructed from later edits or the current amount',()=>{
  const entry={...fixture().adjustments[0],balanceBefore:5519.83,balanceAfter:5519.83,revisions:[{difference:-224.45,balanceBefore:5744.28,balanceAfter:5744.28}]};
  assert.equal(entryHistory(entry).original,undefined);
  assert.equal(entryHistory(entry).before,undefined);
});
