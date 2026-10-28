import test from 'node:test';
import assert from 'node:assert/strict';
import {createDemoFixture} from '../mobile/demo-fixture.ts';
import {buildActivePayoffCommitment} from '../app/payoff-commitment.ts';
import {buildScopedProgressViews} from '../app/progress-view.ts';
import {editPlanSettlement} from '../app/plan-settlements.ts';
import {recordDueBudgetItems} from '../app/automatic-activity.ts';
import {buildBudgetActivity} from '../app/budget-view.ts';
const date=new Date('2026-10-28T01:00:00Z');
test('planned minimums plus extra exclude legacy and tracked mortgage/auto loans independently of category links and ledger payments',()=>{
 const f=createDemoFixture().payload;
 const cards=f.accounts.map((a,i)=>({...a,minimum:i?80:120}));
 const auto={...cards[0],id:'auto',type:'Auto loan',minimum:300};
 const home={id:'home',name:'Home',kind:'house',originalAmount:50000,remainingAmount:40000,balanceKind:'principal',monthlyPayment:1000,apr:3,escrow:0,asOf:'2026-10-01',budgetItemId:'',budgetItemName:'',history:[]};
 const commitment=buildActivePayoffCommitment([...cards,auto],[home],[],{...f.monthlyPlan,payoffExtraPayment:250},date);
 assert.equal(commitment.budgetCommitment,450);
 assert.deepEqual(commitment.plannedDebtMinimums.map(row=>row.amount),[120,80]);
 assert.equal(commitment.plannedDebtExtra,250);
 assert.equal(buildActivePayoffCommitment([], [home],[],{...f.monthlyPlan,payoffExtraPayment:250},date).budgetCommitment,0);
});
test('every progress scope adds per-debt saved starts and subtracts current balances, not recorded payment totals',()=>{
 const f=createDemoFixture().payload;f.accounts[0].baselineBalance=2000;f.accounts[1].baselineBalance=1000;
 const input={...f,adjustments:f.balanceAdjustments,loans:[],startingBalance:99999,date};
 const before=JSON.stringify(f);const v=buildScopedProgressViews(input);
 assert.equal(v.accounts.summary.starting,3000);assert.equal(v.household.summary.starting,3000);
 assert.equal(v.accounts.summary.current,1400);assert.equal(v.accounts.summary.reduction,1600);
 assert.equal(v.household.summary.reduction,v.accounts.summary.reduction);
 assert.equal(JSON.stringify(f),before);
 const noPayments=buildScopedProgressViews({...input,transactions:[],accounts:f.accounts.map(a=>({...a,balance:a.id==='demo-card'?900:500}))});
 assert.equal(noPayments.accounts.summary.reduction,1600);
});
test('editing a recurring paid record preserves identity, prevents regeneration and leaves lender transactions untouched',()=>{
 const f=createDemoFixture().payload;
 const item={id:'electric',name:'Electric',kind:'expense',amount:75,recurring:true,dueDay:1,paymentMethod:'debit'};
 const auto=recordDueBudgetItems(f.monthlyPlan,[item],[],[],date);
 const original=auto.months['2026-10'].settlements[0];
 const corrected={...original,name:'Electric corrected',amount:65,date:'2026-09-28'};
 const changed=editPlanSettlement(auto,corrected);
 assert.deepEqual(auto.months['2026-10'].settlements,[original]);
 assert.equal(changed.months['2026-10'].settlements.length,0);
 assert.deepEqual(changed.months['2026-09'].settlements,[corrected]);
 const reopened=recordDueBudgetItems(changed,[item],[],[],date);
 assert.equal(reopened.months['2026-10'].settlements.length,0);
 const reports=buildBudgetActivity([],[],changed,'2026-09');assert.equal(reports.rows.length,0);assert.equal(reports.totals.netDebtChange,0);assert.equal(reports.settlements[0].amount,65);
});

test('planned minimums use saved current amounts rather than future forecast promo terms',()=>{
 const f=createDemoFixture().payload;
 const card={...f.accounts[0],minimum:100,apr:0,promoEndDate:'2026-10-30',postPromoApr:20,postPromoMinimum:200};
 const result=buildActivePayoffCommitment([card],[],[],{...f.monthlyPlan,payoffExtraPayment:50},date);
 assert.equal(result.plannedDebtMinimums[0].amount,100);
 assert.equal(result.budgetCommitment,150);
});
