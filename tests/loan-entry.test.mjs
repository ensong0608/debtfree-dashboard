import test from 'node:test';
import assert from 'node:assert/strict';
import { loanEntryErrors } from '../app/loan-entry.ts';
import { parseDashboardContract } from '../app/dashboard-data.ts';
import { readFileSync } from 'node:fs';
const today='2026-10-14';
const loan={id:'synthetic-house',name:'Test house',kind:'house',originalAmount:100000,remainingAmount:80000,balanceKind:'principal',asOf:today,budgetItemId:'',budgetItemName:'',history:[],apr:0,escrow:0,monthlyPayment:1000};

test('new house and car loans can be saved without a Budget bill using explicit payment terms',()=>{
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
 for(const [key,value] of [['originalAmount',-1],['originalAmount',Infinity],['remainingAmount',-1],['remainingAmount',Number.MAX_SAFE_INTEGER],['apr',101],['apr',NaN],['escrow',-1],['asOf','2026-02-30'],['asOf','2026-10-15'],['apr',undefined],['escrow',undefined],['monthlyPayment',undefined],['monthlyPayment',0],['monthlyPayment',-1],['dueDate','2026-02-30'],['kind','bad']]) assert.ok(loanEntryErrors({...loan,[key]:value},today)[key]);
 assert.deepEqual(loanEntryErrors({...loan,remainingAmount:0,apr:0,escrow:0},today),{});
 assert.deepEqual(loanEntryErrors({...loan,remainingAmount:100001},today),{}); // Interest may increase principal.
 const original=structuredClone(loan);loanEntryErrors(loan,today);assert.deepEqual(loan,original);
});

test('car loans do not require escrow; a due date is optional and may be in a future month',()=>{
 assert.deepEqual(loanEntryErrors({...loan,kind:'car',escrow:undefined,dueDate:'2027-01-15'},today),{});
});

test('separate quote principal is optional, validated and never substitutes the saved quote', () => {
 const quote={...loan,kind:'car',balanceKind:'payoff',remainingAmount:1000,principalBalance:950};
 assert.deepEqual(loanEntryErrors(quote,today),{});
 for(const principalBalance of [-1,Infinity,NaN,1001]) assert.ok(loanEntryErrors({...quote,principalBalance},today).principalBalance);
 assert.deepEqual(loanEntryErrors({...quote,principalBalance:undefined},today),{});
 assert.equal(quote.remainingAmount,1000);
});

test('auto APR and principal may be omitted without inventing persisted values', () => {
 const car={...loan,kind:'car',apr:undefined,principalBalance:undefined};
 assert.deepEqual(loanEntryErrors(car,today),{}); assert.equal(car.apr,undefined);
 for(const apr of [NaN,-1,101]) assert.ok(loanEntryErrors({...car,apr},today).apr);
});

test('removed loans retain full terms and payment history in backups; malformed removal metadata is rejected',()=>{
 const f=JSON.parse(readFileSync('tests/fixtures/legacy-v0.json','utf8'));
 const removed={...loan,removedAt:'2026-10-27T20:00:00Z',history:[{date:today,amount:80000,balanceKind:'principal',recordedAt:'2026-10-14T20:00:00Z',payment:1000,principal:700,interest:300}]};
 f.monthlyPlan={months:{},detailedSpendingTracking:false,loanTrackers:[removed]};
 assert.deepEqual(parseDashboardContract(f).payload.monthlyPlan.loanTrackers[0],removed);
 f.monthlyPlan.loanTrackers[0].removedAt='bad';assert.throws(()=>parseDashboardContract(f),/removedAt/);
});
