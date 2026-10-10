import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePayoffCalculator,calculateMinimumPayoffPlan } from '../app/payoff-calculator.ts';
const account=(id,changes={})=>({id,name:id,type:'Credit card',balance:10000,apr:0,interestFee:0,minimum:900,minimumMode:'manual',payoffMode:'priority',creditLimit:20000,dueDate:'',promoEndDate:'',postPromoApr:0,postPromoMinimum:0,createdAt:'2026-10-01',...changes});
const date=new Date('2026-10-07T12:00:00Z');
test('Calculator reserves minimums inside total, matches Plan, and does not mutate inputs',()=>{
 const accounts=[account('one'),account('two')],before=structuredClone(accounts);
 const plan=calculatePayoffCalculator(accounts,7000,'avalanche',[],date);
 assert.deepEqual(plan.months.map(m=>m.paid),[7000,7000,6000]);
 assert.deepEqual(plan.months[0].payments,{one:6100,two:900});
 assert.deepEqual(plan,calculateMinimumPayoffPlan(accounts,7000,'avalanche',[],date).plan);
 assert.deepEqual(accounts,before);
});
test('Calculator preserves promo rates and rejects a future unfunded minimum',()=>{
 const card=account('one',{balance:1000,minimum:100,apr:12,promoEndDate:'2026-10-31',postPromoApr:24,postPromoMinimum:300});
 const plan=calculatePayoffCalculator([card],500,'avalanche',[],date);
 assert.equal(plan.months[0].interest,10);assert.equal(plan.months[1].aprs.one,24);assert.equal(plan.peakMonthly,500);
 assert.throws(()=>calculatePayoffCalculator([{...card,postPromoMinimum:900}],500,'avalanche',[],date),/cover minimums.*2026-11/);
});
test('Calculator uses current balances and rejects an insufficient total honestly',()=>{
 const plan=calculatePayoffCalculator([account('remaining',{balance:850,minimum:100})],500,'snowball',[],date);
 assert.deepEqual(plan.months.map(m=>m.paid),[500,350]);
 assert.equal(calculatePayoffCalculator([account('one')],0,'avalanche',[],date).stalled,true);
 assert.equal(calculatePayoffCalculator([account('archived',{archivedAt:'2026-10-01'})],500,'avalanche',[],date).months.length,0);
});
