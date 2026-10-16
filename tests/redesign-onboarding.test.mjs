import assert from 'node:assert/strict';
import test from 'node:test';
import {normalizeIncome, createOnboardingPlanning, createPlannedDebt, buildOnboardingPlan, seedMonthlyPlan} from '../app/onboarding-plan.ts';
import {parseDashboardJson} from '../app/dashboard-data.ts';
import {readFileSync} from 'node:fs';

test('income normalization uses 26 biweekly and 52 weekly checks without rounding drift on reload',()=>{
 assert.equal(normalizeIncome(1200,'biweekly'),2600);
 assert.equal(normalizeIncome(600,'weekly'),2600);
 assert.equal(normalizeIncome(2599.99,'monthly'),2599.99);
 const fixture=JSON.parse(readFileSync('tests/fixtures/legacy-v0.json','utf8'));
 const planning=createOnboardingPlanning();
 planning.incomeSources=[{id:'salary',name:'Test salary',monthlyTakeHome:2600,payFrequency:'weekly',payAmount:600,assignment:'household'}];
 fixture.planning=planning;
 const restored=parseDashboardJson(JSON.stringify(fixture)).payload.planning.incomeSources[0];
 assert.equal(restored.monthlyTakeHome,2600);assert.equal(restored.payAmount,600);assert.equal(restored.payFrequency,'weekly');
});

test('setup house/car debts preserve loan tracker representation, reserve payments, and seed saved plan',()=>{
 const planning=createOnboardingPlanning();
 planning.incomeSources=[{id:'salary',name:'Test salary',monthlyTakeHome:4500,assignment:'household'}];
 planning.debts=[{...createPlannedDebt('card'),name:'Test card',balance:2000,minimum:60,apr:18},
 {...createPlannedDebt('home'),name:'Test mortgage',type:'Other',trackerKind:'house',balance:100000,minimum:800,apr:4},
 {...createPlannedDebt('car'),name:'Test vehicle',type:'Auto loan',trackerKind:'car',balance:15000,minimum:300,apr:5}];
 planning.capacity.monthlyAmount=1500;
 const result=buildOnboardingPlan(planning,new Date('2026-10-16T12:00:00Z'),'2026-10-16T12:00:00Z');
 assert.equal(result.accounts[0].baselineBalance,2000);
 assert.equal(seedMonthlyPlan(result,'2026-10',{}, {months:{},detailedSpendingTracking:false}).monthlyPlan.progressStartingBalance,2000);
 assert.equal(result.accounts.length,1);assert.equal(result.loanTrackers.length,2);
 assert.equal(result.loanMinimums,1100);assert.equal(result.extra,340);assert.equal(result.plan.monthly,400);
 const existing={progressStartingBalance:9876.54,months:{},loanTrackers:[],detailedSpendingTracking:false};
 const seeded=seedMonthlyPlan(result,'2026-10',{},existing);
 assert.equal(seeded.monthlyPlan.progressStartingBalance,9876.54);
 assert.equal(seeded.monthlyPlan.payoffPlanAmount,400);
 assert.equal(seeded.monthlyPlan.loanTrackers.length,2);
 assert.equal(seeded.monthlyBudgets['2026-10'].filter(i=>i.id.startsWith('setup-loan-')).reduce((sum,i)=>sum+i.amount,0),1100);
 const fixture=JSON.parse(readFileSync('tests/fixtures/legacy-v0.json','utf8'));
 Object.assign(fixture,{accounts:result.accounts,planning:result.planning,...seeded});
 const restored=parseDashboardJson(JSON.stringify(fixture)).payload;
 assert.equal(restored.monthlyPlan.loanTrackers[0].kind,'house');assert.equal(restored.monthlyPlan.progressStartingBalance,9876.54);
});
