import assert from 'node:assert/strict';
import test from 'node:test';
import { accrueCostcoInterest, COSTCO_ESTIMATED_APR, coveredCostcoClose, householdDate, reconcileInterest } from '../app/interest-accrual.ts';
import { createDashboardBackup, createDashboardPayload, createEmptyPlannedPayoff, parseDashboardJson, serializeDashboardBackup } from '../app/dashboard-data.ts';
import { createBalanceAdjustment, createDebtPayment } from '../app/debts-screen.ts';
import { transactionAdjustedAccounts } from '../app/progress-balances.ts';
import { confirmedPaymentTotal } from '../app/payments.ts';
const costco = { id:'costco',name:'Costco',type:'Credit card',balance:10075.60,apr:COSTCO_ESTIMATED_APR,interestFee:0,minimum:294.01,minimumMode:'manual',payoffMode:'priority',creditLimit:35500,dueDate:'2026-10-28',promoEndDate:'',postPromoApr:0,postPromoMinimum:0,createdAt:'2026-10-03',interestAutomation:{enabled:true,coveredThrough:'2026-10-02',estimatedApr:COSTCO_ESTIMATED_APR}};
const balance=(account,entries)=>transactionAdjustedAccounts([account],entries)[0].balance;
const accrue=(entries=[],today='2026-11-02')=>accrueCostcoInterest([costco],entries,today,'2026-11-03T20:00:00.000Z');
const backup=(account,entries)=>createDashboardBackup(createDashboardPayload(null,{accounts:[structuredClone(account)],monthlyBudgets:{},payees:[],transactions:entries,snapshots:[],extra:200,strategy:'avalanche',planning:createEmptyPlannedPayoff(),balanceAdjustments:[]}));

test('Costco October is included; monthly close charges once across refresh and restore',()=>{
 const original=[];assert.equal(accrue(original,'2026-10-03'),original);assert.equal(accrue(original,'2026-11-01'),original);
 const entries=accrue();assert.equal(entries.length,1);assert.equal(entries[0].id,'interest:costco:2026-11');assert.equal(entries[0].interestEstimate.days,31);
 assert.equal(entries[0].amount,Math.round(10075.60*COSTCO_ESTIMATED_APR/100*31/365*100)/100);
 assert.equal(accrue(entries,'2026-11-30'),entries);assert.equal(confirmedPaymentTotal(entries,[],'2026-11'),0);
 const restored=parseDashboardJson(serializeDashboardBackup(backup(costco,entries))).payload;
 assert.deepEqual(restored.accounts[0].interestAutomation,costco.interestAutomation);
 assert.equal(accrueCostcoInterest(restored.accounts,restored.transactions,'2026-11-30'),restored.transactions);
});
test('each overdue month has one entry; payments lower estimates and unrelated accounts stay untouched',()=>{
 const payment=createDebtPayment({account:costco,amount:500,date:'2026-11-01',id:'paid',createdAt:'2026-11-01'});
 const entries=accrue([payment],'2026-12-02');assert.equal(entries.length,3);assert.equal(entries[1].balanceBefore,9575.60);assert.equal(entries[2].interestEstimate.days,30);
 assert.equal(accrue(entries,'2026-12-25'),entries);assert.equal(confirmedPaymentTotal(entries,[],'2026-11'),500);
 const other={...costco,id:'other',name:'Other card',interestAutomation:undefined};assert.deepEqual(accrueCostcoInterest([other],[], '2026-12-02'),[]);
});
test('lender balance replaces an estimate once and covers the cycle even before an app visit',()=>{
 const entries=accrue();const change=createBalanceAdjustment({storedAccount:costco,currentBalance:balance(costco,entries),nextBalance:10200,date:'2026-11-03'});
 const checked=reconcileInterest(change.account,entries,'2026-11-03','2026-11-03T20:00:00Z');
 assert.equal(balance(checked.account,checked.transactions),10200);assert.equal(checked.account.interestAutomation.coveredThrough,'2026-11-02');
 assert.ok(checked.transactions[0].interestEstimate.reconciledAt);assert.equal(accrueCostcoInterest([checked.account],checked.transactions,'2026-11-30'),checked.transactions);
 const withoutEstimate=reconcileInterest(costco,[],'2026-11-03','2026-11-03T20:00:00Z');assert.equal(accrueCostcoInterest([withoutEstimate.account],[],'2026-11-30').length,0);
 assert.throws(()=>reconcileInterest(checked.account,checked.transactions,'2026-10-31','2026-11-03T20:00:00Z'),/on or after/);
 assert.throws(()=>reconcileInterest(costco,entries,'2026-12-02','2026-11-03T20:00:00Z'),/today/);
});
test('deleted estimates reserve their cycle; pausing and paid-off debts do not create positive interest',()=>{
 const entries=accrue().map(t=>({...t,deletedAt:'2026-11-03'}));assert.equal(accrue(entries,'2026-11-30'),entries);assert.equal(balance(costco,entries),10075.60);
 assert.deepEqual(accrueCostcoInterest([{...costco,interestAutomation:{...costco.interestAutomation,enabled:false}}],[],'2026-12-02'),[]);
 assert.deepEqual(accrueCostcoInterest([{...costco,archivedAt:'2026-10-03'}],[],'2026-12-02'),[]);
 assert.equal(accrueCostcoInterest([{...costco,balance:0}],[],'2026-11-02')[0].amount,0);
});
test('Los Angeles date and month boundaries do not depend on the phone time zone',()=>{
 assert.equal(householdDate(new Date('2026-11-02T07:59:00Z')),'2026-11-01');assert.equal(householdDate(new Date('2026-11-02T08:01:00Z')),'2026-11-02');
 assert.equal(coveredCostcoClose('2026-01-01'),'2025-12-02');assert.equal(coveredCostcoClose('2026-02-02'),'2026-02-02');
 const entries=accrueCostcoInterest([{...costco,interestAutomation:{...costco.interestAutomation,coveredThrough:'2028-02-02'}}],[],'2028-03-02');assert.equal(entries[0].interestEstimate.days,29);
});
test('invalid interest settings and duplicate monthly IDs cannot enter a backup or household write',()=>{
 const data=backup(costco,accrue());data.payload.transactions.push({...data.payload.transactions[0]});assert.throws(()=>parseDashboardJson(JSON.stringify(data)),/duplicates/);
 const bad=backup(costco,[]);bad.payload.accounts[0].interestAutomation.coveredThrough='2026-02-30';assert.throws(()=>parseDashboardJson(JSON.stringify(bad)),/closing date/);
 bad.payload.accounts[0].interestAutomation={enabled:true,coveredThrough:'2026-10-02',estimatedApr:-1};assert.throws(()=>parseDashboardJson(JSON.stringify(bad)),/greater than 0/);
 const changed=backup(costco,accrue());changed.payload.transactions[0].type='payment';assert.throws(()=>parseDashboardJson(JSON.stringify(changed)),/monthly interest fee/);
});

test('two phones applying the same cycle converge after a revision conflict without a second fee',async()=>{
 const {HouseholdSync}=await import('../app/household-sync.ts');
 let remote=backup(costco,[]);let revision=1;let accepted=0;
 const request=async(_url,init)=>{
  if(init?.method==='PUT') {const body=JSON.parse(init.body);if(body.revision!==revision)return Response.json({error:'conflict'},{status:409});remote=body.payload;revision++;accepted++;return Response.json({revision});}
  return Response.json({householdName:'Test',role:'admin',members:[],revision,payload:remote});
 };
 const storage=()=>{const map=new Map();return{getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)}};
 const statuses=[];
 const phones=[0,1].map(i=>new HouseholdSync({storage:storage(),key:'phone'+i,request,status:s=>statuses.push(s)}));
 try {
  const loaded=await Promise.all(phones.map(p=>p.load()));
  for(let i=0;i<2;i++) {const payload=loaded[i].contract.payload;phones[i].stage(createDashboardBackup({...payload,transactions:accrueCostcoInterest(payload.accounts,payload.transactions,'2026-11-02')},loaded[i].contract));}
  await phones[0].flush();await phones[1].flush();assert.ok(statuses.includes('conflict'));
  const checked=await phones[1].load();assert.equal(phones[1].pending,null);assert.equal(accepted,1);
  assert.equal(checked.contract.payload.transactions.length,1);
  assert.equal(balance(checked.contract.payload.accounts[0],checked.contract.payload.transactions),balance(costco,accrue()));
 } finally {phones.forEach(p=>p.dispose());}
});
