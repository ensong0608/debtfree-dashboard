import test from 'node:test';import assert from 'node:assert/strict';
import {createDemoFixture} from '../mobile/demo-fixture.ts';
import {parseDashboardContract} from '../app/dashboard-data.ts';
import {scheduleView,scheduleExtra,scheduleMinimums} from '../app/schedule-view.ts';
import {buildConfiguredPayoffSchedule} from '../app/payoff-schedule.ts';
import {cardBalanceHistory} from '../app/card-balance-history.ts';
const date=new Date('2026-10-22T12:00:00Z');
const card={...createDemoFixture().payload.accounts[0],id:'small',name:'Small',balance:100,apr:0,minimum:25};
const loan={id:'home',name:'Home',kind:'house',originalAmount:1000,remainingAmount:500,balanceKind:'principal',asOf:'2026-10-01',budgetItemId:'',budgetItemName:'',apr:12,monthlyPayment:150,escrow:50,history:[]};
test('extra adds to included minimums; snowball and avalanche allocate the same pool differently',()=>{
 const snowball=buildConfiguredPayoffSchedule([card],[loan],[],100,'snowball',date),avalanche=buildConfiguredPayoffSchedule([card],[loan],[],100,'avalanche',date);
 assert.equal(snowball.monthly,275);assert.equal(avalanche.monthly,275);assert.ok(snowball.rows[0].paidOff.includes('Small'));assert.ok(!avalanche.rows[0].paidOff.includes('Small'));assert.equal(snowball.rows.at(-1).remaining,0);assert.equal(snowball.rows.reduce((n,r)=>n+r.paid-r.interest,0),600+snowball.rows.filter(r=>r.month<=snowball.payoffMonths['loan:home']).length*50);
});
test('a missing loan term does not hide a scheduled card payoff date',()=>{
 const result=buildConfiguredPayoffSchedule([card],[{...loan,apr:undefined}],[],100,'avalanche',date);assert.ok(result.issues.length);assert.equal(result.payoffMonths['account:small'],'2026-10');assert.equal(result.debtFreeMonth,null);
});
test('type views filter balances and snapshot copies without replacing saved household anchors',()=>{
 const fixture=createDemoFixture(),p=fixture.payload;const original=structuredClone(p);p.monthlyPlan.payoffExcludedTypes=['Credit card'];
 const result=scheduleView(p.accounts,[loan],p.snapshots,[],p.monthlyPlan);assert.equal(result.accounts.length,0);assert.equal(result.loans.length,1);assert.equal(result.snapshots.length,0);assert.equal(result.startingBalance,undefined);assert.equal(p.monthlyPlan.progressStartingBalance,1500);assert.deepEqual(p.snapshots,original.snapshots);assert.deepEqual(p.accounts,original.accounts);
 p.monthlyPlan.payoffExcludedTypes=['Mortgage'];assert.equal(scheduleView(p.accounts,[loan],p.snapshots,[],p.monthlyPlan).startingBalance,1500);
});
test('new extra/type/method settings round trip through the existing household contract',()=>{
 const fixture=createDemoFixture();fixture.payload.monthlyPlan={...fixture.payload.monthlyPlan,payoffPlanAmount:300,payoffExtraPayment:50,payoffExcludedTypes:['Mortgage'],payoffPlanStrategy:'snowball'};const saved=parseDashboardContract(fixture);assert.equal(saved.payload.monthlyPlan.payoffExtraPayment,50);assert.deepEqual(saved.payload.monthlyPlan.payoffExcludedTypes,['Mortgage']);assert.equal(saved.payload.monthlyPlan.progressStartingBalance,1500);assert.equal(saved.payload.monthlyPlan.payoffPlanAmount,300);
 assert.equal(scheduleExtra({months:{},payoffPlanAmount:300},[card]),300-scheduleMinimums([card]));
});
test('balance history includes current, payments, purchases, fees and adjustments, excluding deleted records',()=>{
 const fixture=createDemoFixture(),p=fixture.payload;
 const transactions=[...p.transactions,{...p.transactions[0],id:'fee',type:'fee',category:'Fee',amount:20,date:'2026-10-03'},{...p.transactions[0],id:'purchase',type:'charge',category:'Shopping',amount:50,date:'2026-10-04'},{...p.transactions[0],id:'deleted',amount:400,deletedAt:date.toISOString()}];
 const adjustments=[{id:'update',accountId:'demo-card',date:'2026-10-05',difference:-10,balanceBefore:970,balanceAfter:960,createdAt:date.toISOString()}];
 const points=cardBalanceHistory('demo-card',960,transactions,adjustments,'2026-10-22');assert.equal(points.length,6);assert.deepEqual(points.map(p=>p.balance),[1000,900,920,970,960,960]);
});
