import test from 'node:test';
import assert from 'node:assert/strict';
import {changeDebtEntry,undoDebtEntry} from '../app/debt-transactions.ts';
import {paymentOverlaps} from '../app/payment-overlap.ts';
import {transactionAdjustedAccounts} from '../app/progress-balances.ts';
import {confirmedPaymentTotal} from '../app/payments.ts';
import {buildActualProgress} from '../app/debt-activity.ts';
import {parseDashboardContract,serializeDashboardBackup,parseDashboardJson} from '../app/dashboard-data.ts';
import {readFileSync} from 'node:fs';
const account={id:'card',name:'Card',type:'Credit card',balance:5000,baselineBalance:5000,apr:0,interestFee:0,minimum:100,minimumMode:'manual',payoffMode:'priority',creditLimit:0,dueDate:'',promoEndDate:'',postPromoApr:0,postPromoMinimum:0,createdAt:'2026-10-01'};
const initial=()=>({accounts:[structuredClone(account)],transactions:[],adjustments:[]});
const draft=(kind,amount,extra={})=>({accountId:'card',title:kind,kind,amount,date:'2026-10-08',note:'',direction:'decrease',...extra});
const save=(s,d,id)=>changeDebtEntry(s,{action:'save',draft:d},undefined,'2026-10-08T12:00:00Z',id);
const balance=s=>transactionAdjustedAccounts(s.accounts,s.transactions)[0].balance;
const adjusted=()=>save(initial(),draft('adjustment',500),'update');
test('normal payment reduces once; linked payment does not repeat reconciliation and reports once',()=>{
 let s=adjusted();s=save(s,draft('payment',150,{includedIn:{type:'adjustment',id:'update'}}),'linked');
 assert.equal(balance(s),4500);assert.equal(confirmedPaymentTotal(s.transactions,s.adjustments,'2026-10'),150);
 assert.equal(buildActualProgress(s.accounts,s.transactions,s.adjustments,[],new Date('2026-10-08'),5000).monthlyChange,-500);
 s=save(s,draft('payment',150),'separate');assert.equal(balance(s),4350);
 assert.equal(s.accounts[0].baselineBalance,5000);
});
test('partial classifications preserve remaining amount and reject duplicate/full attribution',()=>{
 let s=save(adjusted(),draft('payment',200,{includedIn:{type:'adjustment',id:'update'}}),'partial');
 assert.equal(paymentOverlaps(s.transactions,s.adjustments,'card',300,'2026-10-09')[0].remaining,300);
 s=save(s,draft('payment',500,{includedIn:{type:'adjustment',id:'update'}}),'mixed');assert.equal(balance(s),4500);assert.equal(confirmedPaymentTotal(s.transactions,s.adjustments,'2026-10'),700);
 assert.throws(()=>changeDebtEntry(s,{action:'save',id:'adjustment:update',draft:draft('adjustment',500,{confirmAsPayment:true})}),/classification/);
});
test('linked edits deletion restore and source cascade retain correct balances',()=>{
 let s=save(adjusted(),draft('payment',150,{includedIn:{type:'adjustment',id:'update'}}),'linked');
 s=changeDebtEntry(s,{action:'save',id:'transaction:linked',draft:draft('payment',200)});assert.equal(balance(s),4500);
 s=changeDebtEntry(s,{action:'delete',id:'transaction:linked'});assert.equal(balance(s),4500);assert.equal(confirmedPaymentTotal(s.transactions,s.adjustments,'2026-10'),0);
 s=changeDebtEntry(s,{action:'restore',id:'transaction:linked'});assert.equal(balance(s),4500);
 s=changeDebtEntry(s,{action:'delete',id:'adjustment:update'});assert.equal(balance(s),5000);assert.ok(s.transactions[0].deletedAt);
 s=changeDebtEntry(s,{action:'restore',id:'adjustment:update'});assert.equal(balance(s),4500);assert.equal(confirmedPaymentTotal(s.transactions,s.adjustments,'2026-10'),200);
 s=changeDebtEntry(s,{action:'save',id:'adjustment:update',draft:draft('adjustment',100)});assert.equal(balance(s),4900);assert.equal(confirmedPaymentTotal(s.transactions,s.adjustments,'2026-10'),200);
});
test('already recorded payment can be referenced without a duplicate balance or payment total',()=>{
 let s=save(initial(),draft('payment',500),'paid');s=save(s,draft('payment',500,{includedIn:{type:'transaction',id:'paid'}}),'info');
 assert.equal(balance(s),4500);assert.equal(confirmedPaymentTotal(s.transactions,s.adjustments,'2026-10'),500);
 assert.equal(paymentOverlaps(s.transactions,s.adjustments,'card',500,'2026-10-09').length,2);
 assert.equal(paymentOverlaps(s.transactions,s.adjustments,'card',500,'2026-09-01').length,0);
});
test('Undo retains audit records and reverses only actual movement',()=>{
 const before=adjusted();const next=save(before,draft('payment',100),'payment');const undone=undoDebtEntry(before,next);
 assert.equal(balance(undone),4500);assert.ok(undone.transactions[0].deletedAt);assert.equal(undone.accounts[0].baselineBalance,5000);
 const linked=save(before,draft('payment',100,{includedIn:{type:'adjustment',id:'update'}}),'linked');assert.equal(balance(undoDebtEntry(before,linked)),4500);
});
test('new fields survive backup round trip; invalid links are rejected',()=>{
 const s=save(adjusted(),draft('payment',100,{includedIn:{type:'adjustment',id:'update'}}),'linked');
 const fixture=JSON.parse(readFileSync('tests/fixtures/legacy-v0.json','utf8'));Object.assign(fixture,{accounts:s.accounts,transactions:s.transactions,balanceAdjustments:s.adjustments,snapshots:[]});
 const backup=parseDashboardContract(fixture),loaded=parseDashboardJson(serializeDashboardBackup(backup));
 assert.deepEqual(loaded.payload.transactions[0].includedIn,{type:'adjustment',id:'update'});assert.equal(balance({accounts:loaded.payload.accounts,transactions:loaded.payload.transactions}),4500);
 fixture.transactions[0].includedIn.id='missing';assert.throws(()=>parseDashboardContract(fixture),/unavailable/);
});
test('refunds and corrections reduce debt without being reported as money paid',()=>{
 const s=save(initial(),draft('payment',100,{credit:true,reductionKind:'adjustment'}),'correction');assert.equal(balance(s),4900);assert.equal(confirmedPaymentTotal(s.transactions,s.adjustments,'2026-10'),0);
});
