import test from 'node:test';
import assert from 'node:assert/strict';
import {createDemoFixture} from '../mobile/demo-fixture.ts';
import {permanentlyDeleteDebt} from '../app/permanent-debt-deletion.ts';
import {createDashboardBackup} from '../app/dashboard-data.ts';
import {buildActualProgress} from '../app/debt-activity.ts';
import {capitalizeWords} from '../app/display-label.ts';
import {appearanceTokens,parseAppearance,THEMES,TEXT_SIZES,textSizePoints} from '../app/appearance.ts';

test('purging a debt clears its audit, snapshot revisions, budget links and retained counts without changing another debt',()=>{
 const payload=createDemoFixture().payload;
 const id='demo-card';
 payload.snapshots[0].revisions=[structuredClone(payload.snapshots[0])];
 payload.monthlyPlan.dueReminderPaid=[{id:'account:'+id,date:'2026-10-25',markedAt:'2026-10-25T12:00:00Z'}];
 payload.monthlyPlan.months['2026-10']={safetyBuffer:0,debtPaymentTarget:0,payments:{[id]:100,'demo-travel':50},minimums:{[id]:25},settlements:[{id:'s',targetId:id,name:'Sample card',kind:'minimum',amount:25,date:'2026-10-25',createdAt:'2026-10-25T12:00:00Z',source:'debit'}]};
 payload.monthlyBudgets['2026-10']=[{id:'b',name:'Groceries',kind:'purchase',category:'Food',amount:20,paymentMethod:'credit',creditAccountId:id,createdAt:'2026-10-01T12:00:00Z'}];
 const before=structuredClone(payload);
 const next=permanentlyDeleteDebt(payload,id);
 assert.deepEqual(payload,before);
 assert.deepEqual(next.accounts,[before.accounts[1]]);
 assert.equal(next.transactions.length,0);
 assert.equal(next.snapshots[0].totalBalance,500);
 assert.equal(next.snapshots[0].activeAccountCount,1);
 assert.equal(next.snapshots[0].revisions[0].totalBalance,500);
 assert.deepEqual(next.monthlyPlan.months['2026-10'].payments,{'demo-travel':50});
 assert.equal(next.monthlyPlan.months['2026-10'].settlements.length,0);
 assert.equal(next.monthlyPlan.progressStartingBalance,500);
 assert.equal(next.monthlyBudgets['2026-10'][0].creditAccountId,'');
 assert.equal(next.monthlyBudgets['2026-10'][0].amount,20);
 assert.equal(next.monthlyPlan.dueReminderPaid.length,0);
 assert.doesNotThrow(()=>createDashboardBackup(next));
});
test('already removed debts and final debt can be purged without phantom Progress accounts',()=>{
 const payload=createDemoFixture().payload;
 const a=payload.accounts.shift();
 payload.monthlyPlan.removedProgressAccounts=[{id:a.id,name:a.name,balance:900,baselineBalance:1000,removedAt:'2026-10-27T12:00:00Z'}];
 const next=permanentlyDeleteDebt(payload,a.id);
 const actual=buildActualProgress(next.accounts,next.transactions,next.balanceAdjustments,next.snapshots,new Date('2026-10-28'),next.monthlyPlan.progressStartingBalance,next.monthlyPlan.removedProgressAccounts);
 assert.equal(actual.retainedCount,0);
 assert.equal(actual.starting,500);
 const empty=permanentlyDeleteDebt(next,'demo-travel');
 assert.equal(empty.accounts.length,0);assert.equal(empty.snapshots.length,0);assert.equal(empty.monthlyPlan.progressStartingBalance,0);
 assert.throws(()=>permanentlyDeleteDebt(empty,a.id));
});
test('loan purge clears removed tracker history and loan observations without changing card history',()=>{
 const payload=createDemoFixture().payload;
 payload.monthlyPlan.loanTrackers=[{id:'loan',name:'Test car',kind:'car',originalAmount:2000,remainingAmount:1000,balanceKind:'principal',asOf:'2026-10-01',budgetItemId:'',budgetItemName:'',history:[],removedAt:'2026-10-27'}];
 payload.snapshots[0].loanBalances=[{loanId:'loan',amount:1000,balanceKind:'principal'}];
 const next=permanentlyDeleteDebt(payload,'loan','loan');
 assert.deepEqual(next.accounts,payload.accounts);assert.deepEqual(next.transactions,payload.transactions);
 assert.equal(next.monthlyPlan.loanTrackers.length,0);assert.equal(next.snapshots[0].loanBalances.length,0);
 assert.equal(next.monthlyPlan.progressStartingBalance,1500);
});
test('dropdown capitalization preserves values, acronyms and brand casing',()=>{
 assert.equal(capitalizeWords('chase prime'),'Chase Prime');
 assert.equal(capitalizeWords('Credit card'),'Credit Card');
 assert.equal(capitalizeWords('USBConnect / minimum-only'),'USBConnect / Minimum-Only');
});
test('9–15 point sizes persist with correct scaling in both themes',()=>{
 for(const theme of Object.values(THEMES))for(const size of TEXT_SIZES){
  const saved=parseAppearance(JSON.stringify({...theme,size}));
  assert.equal(saved.size,size);assert.equal(appearanceTokens(saved)['--theme-text-scale'],String(size/12));
 }
 assert.equal(textSizePoints('standard'),12);assert.equal(textSizePoints('large'),14);assert.equal(textSizePoints('larger'),15);
});

test('purging a later test account preserves the original fixed starting total',()=>{
 const payload=createDemoFixture().payload;
 payload.accounts.push({...payload.accounts[0],id:'later',name:'Later test',baselineBalance:99,balance:99});
 const next=permanentlyDeleteDebt(payload,'later');
 assert.equal(next.monthlyPlan.progressStartingBalance,1500);
 assert.deepEqual(next.snapshots,payload.snapshots);
});
