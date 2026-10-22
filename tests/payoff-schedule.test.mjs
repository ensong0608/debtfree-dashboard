import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPayoffSchedule } from '../app/payoff-schedule.ts';
import { calculateMinimumPayoffPlan } from '../app/payoff-calculator.ts';
const date = new Date('2026-10-22T12:00:00Z');
const account = {id:'card',name:'Card',type:'Credit card',balance:1000,apr:12,minimum:25,minimumMode:'manual',payoffMode:'priority',interestFee:0,creditLimit:2000,dueDate:'',promoEndDate:'',postPromoApr:0,postPromoMinimum:0,createdAt:date.toISOString()};
const loan = {id:'house',name:'Home',kind:'house',originalAmount:10000,remainingAmount:1000,balanceKind:'principal',asOf:'2026-10-01',budgetItemId:'',budgetItemName:'',apr:12,monthlyPayment:600,escrow:100,history:[]};
test('account-only schedule reuses minimum-reserving math exactly and never changes records', () => {
 const records=[structuredClone(account)], before=structuredClone(records);
 const expected=calculateMinimumPayoffPlan(records,300,'avalanche',[],date).plan;
 const schedule=buildPayoffSchedule(records,[],[],300,'avalanche',date);
 assert.equal(schedule.complete,true);
 assert.deepEqual(schedule.rows.map(row=>[row.paid,row.interest,row.remaining,row.paidOff]),expected.months.map(row=>[row.paid,row.interest,row.remaining,row.paidOff]));
 assert.deepEqual(records,before);
});
test('mixed debt schedule includes fixed loans and escrow once, caps final principal and preserves source data', () => {
 const loans=[structuredClone(loan)], before=structuredClone(loans);
 const schedule=buildPayoffSchedule([account],loans,[],300,'avalanche',date);
 assert.equal(schedule.rows[0].paid,900);
 assert.equal(schedule.rows[0].interest,20);
 assert.equal(schedule.rows[0].remaining,1220);
 assert.equal(schedule.rows[2].paidOff.includes('Home'),true);
 assert.equal(schedule.rows.at(-1).remaining,0);
 assert.equal(schedule.complete,true);
 assert.deepEqual(loans,before);
 assert.equal(schedule.rows.reduce((sum,row)=>sum+row.paid-row.interest,0),2300); // 2,000 principal + three escrow installments
});
test('missing loan terms, payoff quotes, insufficient minimums and non-amortizing payments never yield a finish date', () => {
 for(const bad of [{...loan,apr:undefined},{...loan,balanceKind:'payoff'},{...loan,monthlyPayment:105}]) {
  const result=buildPayoffSchedule([account],[bad],[],300,'avalanche',date);
  assert.equal(result.complete,false);assert.equal(result.debtFreeMonth,null);assert.ok(result.issues.length);
 }
 const insufficient=buildPayoffSchedule([account],[],[],1,'avalanche',date);
 assert.equal(insufficient.complete,false);assert.ok(insufficient.issues.length);
});
test('loan-only, linked legacy payments, zero APR and empty households remain valid', () => {
 const result=buildPayoffSchedule([],[{...loan,apr:0,monthlyPayment:undefined,budgetItemId:'mortgage'}],[{id:'mortgage',kind:'expense',amount:600}],0,'avalanche',date);
 assert.equal(result.complete,true);assert.equal(result.rows.length,2);assert.equal(result.rows[1].remaining,0);
 const empty=buildPayoffSchedule([],[],[],0,'avalanche',date);assert.deepEqual(empty.rows,[]);assert.deepEqual(empty.issues,[]);
});
