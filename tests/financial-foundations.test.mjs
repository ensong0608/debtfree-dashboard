import test from 'node:test';
import assert from 'node:assert/strict';
import { createBalanceAdjustment, createDebtPayment } from '../app/debts-screen.ts';
import { transactionAdjustedAccounts } from '../app/progress-balances.ts';
import { changeDebtEntry } from '../app/debt-transactions.ts';
import { createDashboardBackup, createDashboardPayload, createEmptyPlannedPayoff, parseDashboardJson } from '../app/dashboard-data.ts';
const account = { id:'synthetic', name:'Synthetic card', type:'Credit card', balance:10387.59, apr:23.74, minimum:50, minimumMode:'manual', payoffMode:'priority', interestFee:0, creditLimit:20000, dueDate:'2026-10-31', promoEndDate:'', postPromoApr:0, postPromoMinimum:0, createdAt:'2026-10-01T00:00:00Z' };
const balance = s => transactionAdjustedAccounts(s.accounts,s.transactions)[0].balance;
const payment = createDebtPayment({account,amount:500,date:'2026-10-02',id:'payment',createdAt:'2026-10-02T10:00:00Z'});
const interest = {...payment,id:'actual-interest',type:'fee',amount:188.01,date:'2026-10-03',createdAt:'2026-10-03T10:00:00Z',category:'Interest'};
const initial = {accounts:[account],transactions:[payment,interest],adjustments:[]};
const reconcile = (state, amount, id='statement', date='2026-10-04') => {
 const result=createBalanceAdjustment({storedAccount:state.accounts[0],currentBalance:balance(state),nextBalance:amount,transactions:state.transactions,date,id,createdAt:date+'T12:00:00Z'});
 return {...state,accounts:[result.account],adjustments:[...state.adjustments,result.adjustment]};
};
test('payment + actual statement interest reconcile unchanged; history edits preserve later statement',()=>{
 assert.equal(balance(initial),10075.60);
 let state=reconcile(initial,10075.60);
 assert.equal(balance(state),10075.60);
 state=changeDebtEntry(state,{action:'delete',id:'transaction:payment'},undefined,'2026-10-05T12:00:00Z');
 assert.equal(balance(state),10075.60);
 state=changeDebtEntry(state,{action:'save',id:'transaction:actual-interest',draft:{accountId:account.id,kind:'interest',amount:199.99,date:'2026-10-03',direction:'increase',note:''}},undefined,'2026-10-05T12:00:00Z');
 assert.equal(balance(state),10075.60);
 state=changeDebtEntry(state,{action:'save',draft:{accountId:account.id,kind:'payment',amount:100,date:'2026-10-05',direction:'decrease',note:''}},undefined,'2026-10-05T12:00:00Z','new-payment');
 assert.equal(balance(state),9975.60);
 state=changeDebtEntry(state,{action:'delete',id:'transaction:new-payment'});
 assert.equal(balance(state),10075.60);
});
test('same-day subsequent entries apply; deletion/restoration of latest statement returns prior anchor',()=>{
 let state=reconcile(initial,10000);
 state=changeDebtEntry(state,{action:'save',draft:{accountId:account.id,kind:'purchase',amount:10,date:'2026-10-04',direction:'increase',note:''}},undefined,'2026-10-04T12:00:00Z','same-day-new');
 assert.equal(balance(state),10010);
 state=reconcile(state,9950,'second','2026-10-06');
 assert.equal(balance(state),9950);
 state=changeDebtEntry(state,{action:'delete',id:'adjustment:second'});
 assert.equal(balance(state),10010);
 state=changeDebtEntry(state,{action:'restore',id:'adjustment:second'});
 assert.equal(balance(state),9950);
});
test('covered adjustment correction leaves later anchor intact; exports preserve anchors and baseline',()=>{
 let state=changeDebtEntry(initial,{action:'save',draft:{accountId:account.id,kind:'adjustment',amount:10,date:'2026-10-03',direction:'increase',note:''}},undefined,'2026-10-03T12:00:00Z','correction');
 state=reconcile(state,10075.60);
 state=changeDebtEntry(state,{action:'delete',id:'adjustment:correction'});
 assert.equal(balance(state),10075.60);
 const payload=createDashboardPayload(null,{accounts:state.accounts,transactions:state.transactions,balanceAdjustments:state.adjustments,payees:[],snapshots:[],monthlyBudgets:{},extra:0,strategy:'avalanche',planning:createEmptyPlannedPayoff()});
 const restored=parseDashboardJson(JSON.stringify(createDashboardBackup(payload))).payload;
 assert.equal(balance(restored),10075.60);
 assert.equal(restored.accounts[0].baselineBalance,10387.59);
});
test('unsafe money and malformed reconciliation metadata fail contract validation',()=>{
 const payload=createDashboardPayload(null,{accounts:[account],transactions:[],balanceAdjustments:[],payees:[],snapshots:[],monthlyBudgets:{},extra:0,strategy:'avalanche',planning:createEmptyPlannedPayoff()});
 for (const invalid of [{balance:1.001},{balance:1e20},{apr:101},{reconciliation:{adjustmentId:'x',balance:10,date:'2026-02-30',createdAt:'invalid',offset:0}}]) assert.throws(()=>createDashboardPayload(null,{...payload,accounts:[{...account,...invalid}]}));
});
test('moving covered history to another debt preserves the old statement and applies movement to the new debt',()=>{
 let state=reconcile(initial,10075.60);
 state.accounts.push({...account,id:'other',name:'Other synthetic card',balance:1000});
 state=changeDebtEntry(state,{action:'save',id:'transaction:payment',draft:{accountId:'other',kind:'payment',amount:500,date:'2026-10-02',direction:'decrease',note:''}},undefined,'2026-10-07T12:00:00Z');
 const values=transactionAdjustedAccounts(state.accounts,state.transactions);
 assert.equal(values[0].balance,10075.60);
 assert.equal(values[1].balance,500);
});
