import test from 'node:test';
import assert from 'node:assert/strict';
import { changeDebtEntry, signedEntryDraft } from '../app/debt-transactions.ts';
import { entryHistory } from '../app/entry-history.ts';
import { transactionAdjustedAccounts } from '../app/progress-balances.ts';
import { confirmedPaymentTotal, paymentActivity } from '../app/payments.ts';
import { buildActualProgress } from '../app/debt-activity.ts';
import { debtPaymentProgress, copyRecurringPlannedItems, calculateMonthlyPlan } from '../app/monthly-plan.ts';
import { paymentContext } from '../app/payment-context.ts';
import { loanPaymentSplit, recordLoanPayment, linkedLoanPayment } from '../app/loan-progress.ts';
import { createBalanceAdjustment } from '../app/debts-screen.ts';
import { createDashboardPayload, createDashboardBackup, parseDashboardContract, createEmptyPlannedPayoff } from '../app/dashboard-data.ts';
const a={id:'a',name:'Card A',type:'Credit card',balance:1000,baselineBalance:1000,apr:0,interestFee:0,minimum:50,minimumMode:'manual',payoffMode:'priority',creditLimit:2000,dueDate:'2026-08-01',promoEndDate:'',postPromoApr:0,postPromoMinimum:0,createdAt:'2026-08-01'};
const fresh=()=>({accounts:[{...a},{...a,id:'b',name:'Card B',balance:500,baselineBalance:500}],transactions:[],adjustments:[]});
const input=(amount,date='2026-10-03',accountId='a')=>({accountId,title:'Grocery',amount,date,note:''});
const mutate=(s,cmd)=>changeDebtEntry(s,cmd,undefined,'2026-10-08T00:00:00Z','entry');
const balances=s=>transactionAdjustedAccounts(s.accounts,s.transactions).map(a=>a.balance);
test('amount, sign, date, and account corrections replace movement once; event trail survives recovery',()=>{
 let s=mutate(fresh(),{action:'save',draft:signedEntryDraft(undefined,input('+66.96'))});
 assert.deepEqual(balances(s),[1066.96,500]);
 s=mutate(s,{action:'save',id:'transaction:entry',draft:signedEntryDraft(s.transactions[0],input('+66.96'))});
 assert.deepEqual(balances(s),[1066.96,500]);assert.equal(entryHistory(s.transactions[0]).before,1000);
 assert.equal(entryHistory(s.transactions[0]).events.at(-1).movement[0].after-entryHistory(s.transactions[0]).events.at(-1).movement[0].before,0);
 s=mutate(s,{action:'save',id:'transaction:entry',draft:signedEntryDraft(s.transactions[0],input('-100','2026-09-01','b'))});
 assert.deepEqual(balances(s),[1000,400]);assert.equal(confirmedPaymentTotal(s.transactions,[],'2026-09'),100);
 assert.deepEqual(entryHistory(s.transactions[0]).events.at(-1).movement.map(m=>[m.accountId,m.before,m.after]),[['b',500,400],['a',1066.96,1000]]);
 s=mutate(s,{action:'delete',id:'transaction:entry'});assert.deepEqual(balances(s),[1000,500]);
 s=mutate(s,{action:'restore',id:'transaction:entry'});assert.deepEqual(balances(s),[1000,400]);
 const payload=createDashboardPayload(null,{accounts:s.accounts,transactions:s.transactions,balanceAdjustments:s.adjustments,monthlyBudgets:{},payees:[],snapshots:[],extra:7000,strategy:'avalanche',planning:createEmptyPlannedPayoff()});
 const restored=parseDashboardContract(JSON.parse(JSON.stringify(createDashboardBackup(payload)))).payload;
 assert.equal(restored.extra,7000);assert.equal(restored.transactions[0].revisions.length,4);assert.equal(restored.transactions[0].balanceEvents.length,5);
 assert.equal(confirmedPaymentTotal(restored.transactions,[],'2026-09'),100);
});
test('legacy misleading correction balances are not presented as transaction balances',()=>{
 const old={id:'adj',accountId:'a',difference:66.96,balanceBefore:4386.55,balanceAfter:4386.55,revisions:[{difference:66.96}],date:'2026-10-03'};
 assert.equal(entryHistory(old).before,undefined);assert.match(entryHistory(old).explanation,/Original captured balances unavailable/);
 const valid={...old,revisions:[],balanceBefore:4319.59};assert.equal(entryHistory(valid).before,4319.59);
});
test('negative reconciliation stays an adjustment until explicitly identified; classification never posts twice',()=>{
 const result=createBalanceAdjustment({storedAccount:a,currentBalance:1000,nextBalance:900,date:'2026-10-03',id:'adj'});
 let s={accounts:[result.account],transactions:[],adjustments:[result.adjustment]};
 s=mutate(s,{action:'save',id:'adjustment:adj',draft:signedEntryDraft(s.adjustments[0],input('-100'))});
 assert.equal(confirmedPaymentTotal([],s.adjustments,'2026-10'),0);assert.deepEqual(balances(s),[900]);
 s=mutate(s,{action:'save',id:'adjustment:adj',draft:{...signedEntryDraft(s.adjustments[0],input('-100')),confirmAsPayment:true}});
 assert.equal(confirmedPaymentTotal([],s.adjustments,'2026-10'),100);assert.deepEqual(balances(s),[900]);
});
test('refund lowers debt but is excluded from payments, Budget minimums and payment context',()=>{
 const s=mutate(fresh(),{action:'save',draft:{...signedEntryDraft(undefined,input('-100')),credit:true}});
 assert.deepEqual(balances(s),[900,500]);assert.equal(paymentActivity(s.transactions,[])[0].kind,'credit');assert.equal(confirmedPaymentTotal(s.transactions,[],'2026-10'),0);
 assert.equal(debtPaymentProgress(s.accounts,{},s.transactions,'2026-10')[0].paid,0);
 assert.deepEqual(paymentContext(s.transactions,'2026-10',500).paid,{});
});
test('restore or correction cannot hide an overpayment behind balance clamping',()=>{
 let s=mutate(fresh(),{action:'save',draft:signedEntryDraft(undefined,input('-900'))});
 s=mutate(s,{action:'delete',id:'transaction:entry'});
 s.accounts[0].balanceOffset=-200;
 assert.throws(()=>mutate(s,{action:'restore',id:'transaction:entry'}),/exceed/);
});
test('fixed snapshot cohort ignores later debts, keeps archived debts and refuses missing accounts',()=>{
 const snapshot={id:'s',month:'2026-08',capturedAt:'2026-08-31T00:00:00Z',totalBalance:1000,accounts:[{accountId:'a',balance:1000}],note:''};
 let accounts=[{...a,balanceOffset:-200}, {...a,id:'new',balance:9999,baselineBalance:9999}];
 let r=buildActualProgress(accounts,[],[],[snapshot]);assert.equal(r.reduction,200);assert.equal(r.excludedCount,1);assert.equal(r.current,800);
 accounts[0].archivedAt='2026-10-01';r=buildActualProgress(accounts,[],[],[snapshot]);assert.equal(r.reduction,200);
 r=buildActualProgress(accounts.slice(1),[],[],[snapshot]);assert.equal(r.comparisonAvailable,false);assert.equal(r.reduction,0);assert.equal(snapshot.totalBalance,1000);
 assert.equal(buildActualProgress([{...a,baselineBalance:undefined}],[],[],[]).comparisonAvailable,false);
});
test('recurring budget copies and linked loan payments are planning only; principal excludes escrow and interest',()=>{
 const items=[{id:'bill',name:'House',kind:'expense',amount:1000,recurring:true,paymentMethod:'debit',creditAccountId:''},{id:'one',name:'One-off',kind:'purchase',amount:50,recurring:false}];
 const copied=copyRecurringPlannedItems(items,'2026-11-01',(_,i)=>'copy'+i);assert.equal(copied.length,1);
 const loan={id:'house',name:'House',kind:'house',originalAmount:100000,remainingAmount:100000,balanceKind:'principal',apr:6,escrow:200,asOf:'2026-10-01',budgetItemId:'bill',budgetItemName:'House',history:[]};
 assert.equal(linkedLoanPayment(loan,copied).id,'copy0');const split=loanPaymentSplit(loan,1000,100);assert.equal(split.interest,500);assert.equal(split.principal,300);assert.equal(split.remainingAmount,99600);
 const saved=recordLoanPayment(loan,1000,'2026-10-05',100);assert.equal(saved.remainingAmount,99600);assert.equal(loan.remainingAmount,100000);assert.equal(items[0].amount,1000);
 assert.throws(()=>recordLoanPayment(saved,1000,'2026-10-10'),/already recorded/);assert.throws(()=>loanPaymentSplit({...loan,balanceKind:'payoff'},1000),/principal/);
 assert.equal(calculateMonthlyPlan(items,[],'2026-10',{safetyBuffer:0,debtPaymentTarget:0},true).spent,0);
});
test('unchanged lender confirmation preserves balance and rejects impossible dates',()=>{
 const result=createBalanceAdjustment({storedAccount:a,currentBalance:1000,nextBalance:1000,date:'2026-10-07'});assert.equal(result.adjustment.difference,0);assert.equal(result.account.balanceOffset,0);
 assert.throws(()=>createBalanceAdjustment({storedAccount:a,currentBalance:1000,nextBalance:1000,date:'2026-02-30'}),/date/);
});

test('updating a monthly check retains its original balances and preserves the starting comparison', async()=>{
 const {createPayoffSnapshot}=await import('../app/progress-balances.ts');
 const input={accounts:[a],month:'2026-10',capturedAt:'2026-10-03T00:00:00Z',totalBalance:1000,monthlyInterest:0,activeAccountCount:1,projectedDebtFreeMonth:null,note:'Original'};
 const first=createPayoffSnapshot(input);
 const revised=createPayoffSnapshot({...input,existing:first,accounts:[{...a,balance:800}],totalBalance:800,capturedAt:'2026-10-07T00:00:00Z'});
 assert.equal(revised.revisions[0].totalBalance,1000);assert.equal(first.totalBalance,1000);
 const report=buildActualProgress([{...a,balanceOffset:-200}],[],[],[revised]);assert.equal(report.starting,1000);assert.equal(report.reduction,200);
});

test('pinned first starting amount survives missing accounts and later checks',()=>{
 const original=61871.72;
 const snapshot={id:'first',month:'2026-07',capturedAt:'2026-07-31T00:00:00Z',totalBalance:57881.29,accounts:[{accountId:'removed',balance:0}],note:''};
 const r=buildActualProgress([{...a,balance:48653.77,baselineBalance:1}],[],[],[snapshot],new Date('2026-10-07'),original);
 assert.equal(r.starting,original);assert.equal(r.current,48653.77);assert.equal(r.comparisonAvailable,true);assert.equal(r.reduction,13217.95);
 snapshot.totalBalance=50000;
 assert.equal(buildActualProgress([{...a,balance:48000}],[],[],[snapshot],new Date('2026-11-01'),original).starting,original);
});
