import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoFixture } from '../mobile/demo-fixture.ts';
import { fixedStrategySettings, buildPayoffStrategyRows } from '../app/payoff-strategy.ts';
import { buildActivePayoffCommitment } from '../app/payoff-commitment.ts';
const date=new Date('2026-10-24T19:00:00Z');
const account=(id,balance,apr)=>({...createDemoFixture().payload.accounts[0],id,name:'Same name',balance,apr,interestFee:0,minimum:25});
const car={id:'car',name:'Auto',kind:'car',originalAmount:10000,remainingAmount:1000,balanceKind:'principal',asOf:'2026-10-01',budgetItemId:'',budgetItemName:'',apr:5,monthlyPayment:100,history:[]};
const home={...car,id:'house',name:'Home',kind:'house',escrow:0};
const settings={months:{},payoffExtraPayment:100,payoffExcludedTypes:['Credit card','Auto loan']};
test('fixed strategy ignores legacy exclusions, includes auto, and retains mortgage as an outside obligation',()=>{
 const before=structuredClone(settings), accounts=[account('a',500,20)];
 const active=buildActivePayoffCommitment(accounts,[car,home],[],fixedStrategySettings(settings),date);
 assert.deepEqual(settings,before);assert.equal(active.scopeBalance,1500);assert.equal(active.outsideSchedulePayments,100);
 assert.ok(active.schedule.payoffMonths['account:a']);assert.ok(active.schedule.payoffMonths['loan:car']);assert.equal(active.schedule.payoffMonths['loan:house'],undefined);
 assert.equal(active.householdPayment,active.schedule.monthly+100);
});
test('both strategy orders share actual forecast dates by ID, including duplicate names and auto',()=>{
 const accounts=[account('high',800,25),account('small',200,10)];
 for(const method of ['avalanche','snowball']){
  const schedule=buildActivePayoffCommitment(accounts,[car,home],[],fixedStrategySettings({...settings,payoffPlanStrategy:method}),date).schedule;
  const rows=buildPayoffStrategyRows(accounts,[car,home],schedule,method);
  assert.equal(rows.length,3);assert.equal(rows[0].id,method==='avalanche'?'account:high':'account:small');
  for(const row of rows)assert.equal(row.payoffMonth,schedule.payoffMonths[row.id]??null);
 }
});
test('missing auto terms preserve the row without inventing a payoff date and leave all records intact',()=>{
 const invalid={...car,apr:undefined},accounts=[account('active',100,20),{...account('archived',500,30),archivedAt:'2026-10-01'},account('paid',0,30)];
 const before=structuredClone({accounts,invalid});
 const schedule=buildActivePayoffCommitment(accounts,[invalid],[],fixedStrategySettings(settings),date).schedule;
 const rows=buildPayoffStrategyRows(accounts,[invalid],schedule,'avalanche');
 assert.deepEqual(rows.map(r=>r.id),['account:active','loan:car']);assert.ok(rows[1].payoffMonth);assert.equal(rows[1].apr,6);assert.equal(rows[1].rateEstimated,true);assert.equal(rows[1].estimated,true);assert.equal(schedule.issues.length,0);
 assert.deepEqual({accounts,invalid},before);
});
