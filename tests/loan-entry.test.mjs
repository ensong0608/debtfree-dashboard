import test from 'node:test';
import assert from 'node:assert/strict';
import { loanEntryErrors } from '../app/loan-entry.ts';
import { parseDashboardContract } from '../app/dashboard-data.ts';
import { readFileSync } from 'node:fs';
const today='2026-10-14';
const loan={id:'synthetic-house',name:'Test house',kind:'house',originalAmount:100000,remainingAmount:80000,balanceKind:'principal',asOf:today,budgetItemId:'',budgetItemName:'',history:[]};

test('new house and car loans can be saved without a Budget bill or optional payment terms',()=>{
 for(const kind of ['house','car']) {
  assert.deepEqual(loanEntryErrors({...loan,kind},today),{});
  const f=JSON.parse(readFileSync('tests/fixtures/legacy-v0.json','utf8'));
  f.monthlyPlan={months:{},detailedSpendingTracking:false,loanTrackers:[{...loan,kind}]};
  assert.doesNotThrow(()=>parseDashboardContract(f));
  f.monthlyPlan.loanTrackers[0].budgetItemId='incomplete-link';
  assert.throws(()=>parseDashboardContract(f), /both be set or both be empty/);
 }
});
test('empty loan submission identifies each missing field instead of disabling Save',()=>{
 const errors=loanEntryErrors({...loan,name:' ',originalAmount:0,remainingAmount:NaN,asOf:''},today);
 assert.deepEqual(Object.keys(errors),['name','originalAmount','remainingAmount','asOf']);
});
test('loan validation rejects invalid money, APR and dates; zero APR, escrow and final balance are valid',()=>{
 for(const [key,value] of [['originalAmount',-1],['originalAmount',Infinity],['remainingAmount',-1],['remainingAmount',Number.MAX_SAFE_INTEGER],['apr',101],['apr',NaN],['escrow',-1],['asOf','2026-02-30'],['asOf','2026-10-15']]) assert.ok(loanEntryErrors({...loan,[key]:value},today)[key]);
 assert.deepEqual(loanEntryErrors({...loan,remainingAmount:0,apr:0,escrow:0},today),{});
 assert.deepEqual(loanEntryErrors({...loan,remainingAmount:100001},today),{}); // Interest may increase principal.
 const original=structuredClone(loan);loanEntryErrors(loan,today);assert.deepEqual(loan,original);
});
