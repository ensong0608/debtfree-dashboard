import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoFixture } from '../mobile/demo-fixture.ts';
import { recordDueBudgetItems, captureAutomaticSnapshot, recurringDate } from '../app/automatic-activity.ts';
import { buildProgressView, buildScopedProgressViews } from '../app/progress-view.ts';
import { parseDashboardContract, serializeDashboardBackup } from '../app/dashboard-data.ts';
const now = new Date('2026-10-23T18:00:00Z');
const item = (extra={}) => ({id:'bill',name:'Power',kind:'expense',category:'Utilities',amount:100,paymentMethod:'debit',creditAccountId:'',createdAt:'2026-10-01T12:00:00Z',recurring:true,dueDay:20,...extra});
const settings = () => ({detailedSpendingTracking:false,progressStartingBalance:1500,months:{'2026-09':{safetyBuffer:5,debtPaymentTarget:90,settlements:[]},'2026-10':{safetyBuffer:10,debtPaymentTarget:200}}});
const loan = {id:'house',name:'Home',kind:'house',originalAmount:10000,remainingAmount:9000,balanceKind:'principal',asOf:'2026-10-01',budgetItemId:'bill',budgetItemName:'Power',history:[]};

test('due paid records are current-month, reporting-only, stable across reload and preserve prior months/baseline',()=>{
 const input=settings(), before=structuredClone(input);const result=recordDueBudgetItems(input,[item()],[],[],now);
 assert.deepEqual(input,before);assert.equal(result.months['2026-10'].settlements[0].amount,100);assert.equal(result.months['2026-10'].settlements[0].date,'2026-10-20');assert.equal(result.months['2026-10'].settlements[0].automatic,true);
 assert.strictEqual(recordDueBudgetItems(result,[item()],[],[],now),result);assert.deepEqual(result.months['2026-09'],before.months['2026-09']);assert.equal(result.progressStartingBalance,1500);
});
test('no due-day, future, income, one-time and explicitly undone records do not auto-post',()=>{
 for(const entry of [item({dueDay:undefined}),item({dueDay:24}),item({kind:'income'}),item({recurring:false})]) {const s=settings();assert.strictEqual(recordDueBudgetItems(s,[entry],[],[],now),s);}
 const s=settings();s.months['2026-10'].skippedRecurringPayments=['bill'];assert.strictEqual(recordDueBudgetItems(s,[item()],[],[],now),s);
 assert.equal(recurringDate('2028-02',31),'2028-02-29');assert.equal(recurringDate('2026-02',31),'2026-02-28');
});
test('real transactions and prior paid/loan records prevent duplicate automatic spending',()=>{
 const transaction={id:'real',type:'charge',plannedItemId:'bill',amount:100,date:'2026-10-20',deletedAt:null};const s=settings();assert.strictEqual(recordDueBudgetItems(s,[item()],[transaction],[],now),s);
 const automatic=recordDueBudgetItems(s,[item()],[],[],now);const reconciled=recordDueBudgetItems(automatic,[item()],[transaction],[],now);assert.deepEqual(reconciled.months['2026-10'].settlements,[]);
 const partial=recordDueBudgetItems(s,[item()],[{...transaction,amount:40}],[],now);assert.equal(partial.months['2026-10'].settlements[0].amount,60);
 const withLoan={...loan,history:[{date:'2026-10-20',payment:100,amount:8900,balanceKind:'principal',recordedAt:now.toISOString()}]};assert.strictEqual(recordDueBudgetItems(s,[item()],[],[withLoan],now),s);
});
test('automatic snapshots keep old observations and use actual dates rather than missed checkpoint dates',()=>{
 const fixture=createDemoFixture();const old=structuredClone(fixture.payload.snapshots);const accounts=fixture.payload.accounts;
 const first=captureAutomaticSnapshot(old,accounts,[loan],new Date('2026-10-03T18:00:00Z'));assert.equal(first.at(-1).autoCheckpoint,'2026-10-01');assert.equal(first.at(-1).capturedAt.slice(0,10),'2026-10-03');assert.deepEqual(first.slice(0,-1),old);
 assert.strictEqual(captureAutomaticSnapshot(first,accounts,[loan],new Date('2026-10-14T18:00:00Z')),first);
 const middle=captureAutomaticSnapshot(first,accounts,[loan],now);const end=captureAutomaticSnapshot(middle,accounts,[loan],new Date('2026-10-31T18:00:00Z'));assert.equal(end.length,old.length+3);assert.equal(end.at(-1).autoCheckpoint,'2026-10-31');
 assert.strictEqual(captureAutomaticSnapshot([],[],[],now).length,0);
});
test('intramonth account, loan and all trend points preserve genuine capture dates and saved baseline',()=>{
 const f=createDemoFixture(), accounts=f.payload.accounts;
 let snapshots=captureAutomaticSnapshot(f.payload.snapshots,accounts,[loan],new Date('2026-10-02T18:00:00Z'));snapshots=captureAutomaticSnapshot(snapshots,accounts,[loan],now);
 for(const scope of ['accounts','loans','household']) {
  const view=buildProgressView({accounts,transactions:[],adjustments:[],snapshots,loans:[loan],startingBalance:1500,date:now},scope);
  assert.ok(view.trend.some(point=>point.date==='2026-10-02'));assert.ok(view.trend.some(point=>point.date==='2026-10-23'));assert.ok(!view.trend.some(point=>point.date==='2026-10-15'));if(scope==='accounts')assert.equal(view.summary.starting,1500);
 }
});
test('new optional due/capture/paid metadata round-trips without changing financial history; invalid fields rejected',()=>{
 const f=createDemoFixture();f.payload.monthlyBudgets['2026-10']=[item()];f.payload.monthlyPlan=recordDueBudgetItems(f.payload.monthlyPlan,[item()],[],[],now);f.payload.snapshots=captureAutomaticSnapshot(f.payload.snapshots,f.payload.accounts,[loan],now);
 const parsed=parseDashboardContract(JSON.parse(serializeDashboardBackup(f)));assert.deepEqual(parsed.payload.snapshots,f.payload.snapshots);assert.deepEqual(parsed.payload.accounts,f.payload.accounts);assert.deepEqual(parsed.payload.transactions,f.payload.transactions);assert.equal(parsed.payload.monthlyBudgets['2026-10'][0].dueDay,20);
 for(const dueDay of [0,32,1.5,'12']) {const bad=structuredClone(f);bad.payload.monthlyBudgets['2026-10'][0].dueDay=dueDay;assert.throws(()=>parseDashboardContract(bad),/dueDay/);}
});

test('legacy auto-loan accounts move only in presentation; household baseline and underlying records stay intact',()=>{
 const f=createDemoFixture();f.payload.accounts[1].type='Auto loan';const before=structuredClone(f.payload);
 const views=buildScopedProgressViews({accounts:f.payload.accounts,transactions:f.payload.transactions,adjustments:[],snapshots:f.payload.snapshots,loans:[],startingBalance:1500,date:now});
 assert.equal(views.accounts.summary.current,900);assert.equal(views.loans.summary.current,500);assert.equal(views.household.summary.current,1400);assert.equal(views.household.summary.starting,1500);assert.deepEqual(f.payload,before);
});
