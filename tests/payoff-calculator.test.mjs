import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePayoffCalculator,calculateMinimumPayoffPlan } from '../app/payoff-calculator.ts';
const account=(id,changes={})=>({id,name:id,type:'Credit card',balance:10000,apr:0,interestFee:0,minimum:900,minimumMode:'manual',payoffMode:'priority',creditLimit:20000,dueDate:'',promoEndDate:'',postPromoApr:0,postPromoMinimum:0,createdAt:'2026-10-01',...changes});
const date=new Date('2026-10-07T12:00:00Z');
test('Calculator uses total scenario without reserving minimums, unlike Plan, and does not mutate inputs',()=>{
 const accounts=[account('one'),account('two')],before=structuredClone(accounts);
 const plan=calculatePayoffCalculator(accounts,7000,'avalanche',[],date);
 assert.deepEqual(plan.months.map(m=>m.paid),[7000,7000,6000]);
 assert.deepEqual(plan.months[0].payments,{one:7000});
 assert.deepEqual(calculateMinimumPayoffPlan(accounts,7000,'avalanche',[],date).plan.months[0].payments,{one:6100,two:900});
 assert.deepEqual(accounts,before);
});
test('Calculator preserves promo rates while Plan rejects a future unfunded minimum',()=>{
 const card=account('one',{balance:1000,minimum:100,apr:12,promoEndDate:'2026-10-31',postPromoApr:24,postPromoMinimum:300});
 const plan=calculatePayoffCalculator([card],500,'avalanche',[],date);
 assert.equal(plan.months[0].interest,10);assert.equal(plan.months[1].aprs.one,24);assert.equal(plan.peakMonthly,500);
 assert.equal(calculatePayoffCalculator([{...card,postPromoMinimum:900}],500,'avalanche',[],date).stalled,false);
 assert.match(calculateMinimumPayoffPlan([{...card,postPromoMinimum:900}],500,'avalanche',[],date).error,/cover minimums.*2026-11/);
});
test('Calculator uses current balances and rejects an insufficient total honestly',()=>{
 const plan=calculatePayoffCalculator([account('remaining',{balance:850,minimum:100})],500,'snowball',[],date);
 assert.deepEqual(plan.months.map(m=>m.paid),[500,350]);
 assert.equal(calculatePayoffCalculator([account('one')],0,'avalanche',[],date).stalled,true);
 assert.equal(calculatePayoffCalculator([account('archived',{archivedAt:'2026-10-01'})],500,'avalanche',[],date).months.length,0);
});

test('Calculator below minimums remains a scenario; Plan requires funded minimums',()=>{
 const debts=[account('a',{balance:1000,minimum:100}),account('b',{balance:500,minimum:100})];
 const scenario=calculatePayoffCalculator(debts,150,'snowball',[],date);
 assert.equal(scenario.stalled,false);
 assert.deepEqual(scenario.months[0].payments,{b:150});
 assert.match(calculateMinimumPayoffPlan(debts,150,'snowball',[],date).error,/200.00/);
 assert.match(calculateMinimumPayoffPlan(debts,0,'snowball',[],date).error,/200.00/);
});
test('negative and non-finite amounts are rejected before projection',()=>{
 for(const amount of [-1,NaN,Infinity,Number.MAX_VALUE,Number.MAX_SAFE_INTEGER]) {
  assert.throws(()=>calculatePayoffCalculator([account('a')],amount,'avalanche',[],date),/valid monthly/);
  assert.match(calculateMinimumPayoffPlan([account('a')],amount,'avalanche',[],date).error,/valid monthly/);
 }
});
test('scenario below interest reports no payoff without an invented payoff date',()=>{
 const result=calculatePayoffCalculator([account('a',{balance:1000,apr:24})],10,'avalanche',[],date);
 assert.equal(result.stalled,true);
 assert.equal(result.months[0].interest,20);
 assert.equal(result.months[0].remaining,1010);
});
test('monthly cent totals reconcile with every account and final partial payments',()=>{
 const debts=[account('a',{balance:1023.14,apr:21.99,minimum:37.50}),account('b',{balance:601.15,apr:12.75,minimum:25})];
 const result=calculateMinimumPayoffPlan(debts,137.51,'avalanche',[],date).plan;
 let previous=1624.29;
 for(const month of result.months) {
  assert.equal(Math.round((previous+month.interest-month.paid)*100),Math.round(month.remaining*100));
  assert.equal(Math.round(Object.values(month.payments).reduce((sum,x)=>sum+x,0)*100),Math.round(month.paid*100));
  assert.equal(Math.round(Object.values(month.balances).reduce((sum,x)=>sum+x,0)*100),Math.round(month.remaining*100));
  for(const value of [month.interest,month.remaining,month.paid,...Object.values(month.payments)]) assert.ok(Math.abs(value*100-Math.round(value*100))<1e-8);
  previous=month.remaining;
 }
 assert.equal(previous,0);
 assert.equal(Math.round(result.months.reduce((sum,m)=>sum+m.interest,0)*100),Math.round(result.totalInterest*100));
 assert.ok(result.months.at(-1).paid<137.51);
});
test('changing balance, APR, minimum and visual hiding affects only intended forecasts',()=>{
 const original=account('a',{balance:1000,apr:12,minimum:40});
 const baseline=calculateMinimumPayoffPlan([original],80,'avalanche',[],date).plan;
 assert.deepEqual(calculateMinimumPayoffPlan([{...original,hidden:true}],80,'avalanche',[],date).plan,baseline);
 assert.ok(calculateMinimumPayoffPlan([{...original,balance:1500}],80,'avalanche',[],date).plan.months.length>baseline.months.length);
 assert.ok(calculateMinimumPayoffPlan([{...original,apr:24}],80,'avalanche',[],date).plan.totalInterest>baseline.totalInterest);
 assert.match(calculateMinimumPayoffPlan([{...original,minimum:100}],80,'avalanche',[],date).error,/100.00/);
});

test('fractional-cent scenario inputs round consistently with monthly totals',()=>{
 const plan=calculatePayoffCalculator([account('a',{balance:10})],3.005,'avalanche',[],date);
 assert.equal(plan.monthly,3.01);
 assert.equal(plan.months[0].paid,3.01);
});
