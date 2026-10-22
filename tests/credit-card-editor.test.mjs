import test from 'node:test';
import assert from 'node:assert/strict';
import {saveCreditCardDetails, markCreditCardPaidOff} from '../app/credit-card-editor.ts';
import {changeDebtEntry} from '../app/debt-transactions.ts';
import {transactionAdjustedAccounts} from '../app/progress-balances.ts';
const card={id:'card',name:'Card',type:'Credit card',balance:1000,baselineBalance:1000,apr:12,minimum:25,minimumMode:'manual',payoffMode:'priority',interestFee:0,creditLimit:2000,dueDate:'',promoEndDate:'',postPromoApr:0,postPromoMinimum:0,createdAt:'2026-10-01T12:00:00Z'};
const state=()=>({accounts:[structuredClone(card),{...card,id:'other',name:'Other'}],transactions:[],adjustments:[]});
const balance=(s)=>transactionAdjustedAccounts(s.accounts,s.transactions).find(a=>a.id==='card').balance;

test('card balance edits reconcile once, preserve history and never manufacture a payment',()=>{
 const before=state();const next=saveCreditCardDetails(before,'card',{...card,name:'New card',balance:700},{account:card,balance:1000});
 assert.equal(balance(next),700);assert.equal(next.adjustments.length,1);assert.equal(next.adjustments[0].difference,-300);assert.deepEqual(next.transactions,[]);assert.deepEqual(next.accounts[1],before.accounts[1]);assert.equal(next.accounts[0].baselineBalance,1000);assert.equal(before.accounts[0].name,'Card');
 const repeated=saveCreditCardDetails(next,'card',{...next.accounts[0],balance:700},{account:next.accounts[0],balance:700});assert.equal(repeated.adjustments.length,1);assert.equal(balance(repeated),700);
});
test('independently confirmed transactions survive metadata saving; stale balance edits are rejected',()=>{
 const next=changeDebtEntry(state(),{action:'save',draft:{accountId:'card',kind:'payment',direction:'decrease',amount:100,date:'2026-10-22',title:'Payment',note:''}});
 const saved=saveCreditCardDetails(next,'card',{...card,name:'Renamed'},{account:card,balance:1000});assert.equal(balance(saved),900);assert.deepEqual(saved.transactions,next.transactions);assert.equal(saved.adjustments.length,0);
 assert.throws(()=>saveCreditCardDetails(next,'card',{...card,balance:500},{account:card,balance:1000}),/balance changed/);
});
test('changed or removed card details reject a stale save without mutation',()=>{
 const next=state();next.accounts[0].apr=24;const snapshot=structuredClone(next);assert.throws(()=>saveCreditCardDetails(next,'card',card,{account:card,balance:1000}),/details changed/);assert.deepEqual(next,snapshot);
 assert.throws(()=>saveCreditCardDetails({...state(),accounts:[]},'card',card,{account:card,balance:1000}),/no longer active/);
});
test('mark paid off records an adjustment and archives without erasing ledger or starting balance',()=>{
 const next=changeDebtEntry(state(),{action:'save',draft:{accountId:'card',kind:'payment',direction:'decrease',amount:100,date:'2026-10-22',title:'Payment',note:''}});
 const paid=markCreditCardPaidOff(next,'card');assert.equal(balance(paid),0);assert.ok(paid.accounts[0].archivedAt);assert.equal(paid.accounts[0].baselineBalance,1000);assert.deepEqual(paid.transactions,next.transactions);assert.equal(paid.adjustments.at(-1).difference,-900);assert.deepEqual(paid.accounts[1],next.accounts[1]);
});
