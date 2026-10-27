import test from 'node:test';
import assert from 'node:assert/strict';
import {displayedStartingBalance, validatedStartingBalance, startingBalanceEdit} from '../app/debt-starting-balance.ts';
import {saveCreditCardDetails} from '../app/credit-card-editor.ts';
import {transactionAdjustedAccounts} from '../app/progress-balances.ts';
import {trackedPayoffProgress} from '../app/debt-presentation.ts';
import {buildActualProgress} from '../app/debt-activity.ts';

const card={id:'card',name:'Sample zero APR card',type:'Credit card',balance:2200,baselineBalance:3100,apr:0,minimum:25,minimumMode:'manual',payoffMode:'priority',interestFee:0,creditLimit:5000,dueDate:'',promoEndDate:'',postPromoApr:0,postPromoMinimum:0,createdAt:'2026-08-01T12:00:00Z'};
const transaction={id:'purchase',accountId:'card',type:'charge',category:'Shopping',amount:50,date:'2026-10-20',payeeId:'',payeeName:'Sample merchant',memo:'',createdAt:'2026-10-20T12:00:00Z',updatedAt:'2026-10-20T12:00:00Z',deletedAt:null};
const state=()=>({accounts:[structuredClone(card),{...card,id:'other',name:'Other'}],transactions:[structuredClone(transaction)],adjustments:[]});
const posted=s=>transactionAdjustedAccounts(s.accounts,s.transactions)[0].balance;
const snapshot={id:'start',month:'2026-08',capturedAt:'2026-08-01T12:00:00Z',accounts:[{accountId:'card',name:card.name,balance:1800,type:'Credit card',apr:0}],totalBalance:1800,monthlyInterest:0,activeAccountCount:1,projectedDebtFreeMonth:null,note:''};

test('new debt starting balance is its entered opening balance, including zero',()=>{
  for(const value of [0,1800,1800.17]) assert.equal(validatedStartingBalance(value),value);
});

test('starting-balance edit changes account comparison only, preserving posted balances and ledger',()=>{
  const before=state(), untouched=structuredClone(before);
  const saved=saveCreditCardDetails(before,'card',{...card,balance:posted(before),baselineBalance:1800},{account:card,balance:posted(before)});
  assert.equal(saved.accounts[0].baselineBalance,1800);
  assert.equal(posted(saved),2250);
  assert.equal(saved.accounts[0].balance,card.balance);
  assert.deepEqual(saved.transactions,before.transactions);
  assert.deepEqual(saved.adjustments,before.adjustments);
  assert.deepEqual(saved.accounts[1],before.accounts[1]);
  assert.deepEqual(before,untouched);
  const snapshots=[structuredClone(snapshot)], original=structuredClone(snapshots);
  assert.equal(buildActualProgress(saved.accounts,saved.transactions,saved.adjustments,snapshots,new Date('2026-10-25T12:00:00Z'),5000).starting,5000);
  assert.deepEqual(snapshots,original);
});

test('zero starting balance is retained without division by zero or a fabricated payoff percentage',()=>{
  const before=state();const saved=saveCreditCardDetails(before,'card',{...card,balance:posted(before),baselineBalance:0},{account:card,balance:posted(before)});
  assert.equal(saved.accounts[0].baselineBalance,0);
  assert.equal(displayedStartingBalance(saved.accounts[0],[snapshot]),0);
  assert.equal(trackedPayoffProgress({...saved.accounts[0],balance:posted(saved)}),null);
  assert.equal(posted(saved),posted(before));
});

test('legacy snapshot display does not silently become a saved start on unrelated edits',()=>{
  const legacy={...card};delete legacy.baselineBalance;
  const before={...state(),accounts:[legacy]};const shown=displayedStartingBalance(legacy,[snapshot]);
  assert.equal(shown,1800);
  const saved=saveCreditCardDetails(before,'card',{...legacy,name:'Renamed',balance:posted(before),baselineBalance:shown},{account:legacy,balance:posted(before),startingBalance:shown});
  assert.equal(saved.accounts[0].baselineBalance,undefined);
  assert.equal(startingBalanceEdit(shown,shown),undefined);
  const corrected=saveCreditCardDetails(before,'card',{...legacy,balance:posted(before),baselineBalance:1700},{account:legacy,balance:posted(before),startingBalance:shown});
  assert.equal(corrected.accounts[0].baselineBalance,1700);
  assert.deepEqual(corrected.transactions,before.transactions);
});

test('invalid starting balances are rejected without mutation',()=>{
  for(const value of [-1,NaN,Infinity,1.001,Number.MAX_SAFE_INTEGER]){
    const before=state(), copy=structuredClone(before);
    assert.throws(()=>saveCreditCardDetails(before,'card',{...card,balance:posted(before),baselineBalance:value},{account:card,balance:posted(before)}),/starting balance/);
    assert.deepEqual(before,copy);
  }
});

test('stale starting-balance edits reject while unrelated metadata saves preserve a newer start',()=>{
  const newer=state();newer.accounts[0].baselineBalance=1900;
  assert.throws(()=>saveCreditCardDetails(newer,'card',{...card,balance:posted(newer),baselineBalance:1700},{account:card,balance:posted(newer)}),/Starting balance changed/);
  const saved=saveCreditCardDetails(newer,'card',{...card,name:'Renamed',balance:posted(newer)},{account:card,balance:posted(newer)});
  assert.equal(saved.accounts[0].baselineBalance,1900);
});

test('independent new transactions survive a starting-balance-only save',()=>{
  const before=state(), additional={...transaction,id:'later',amount:20};before.transactions.push(additional);
  const saved=saveCreditCardDetails(before,'card',{...card,balance:2250,baselineBalance:1800},{account:card,balance:2250});
  assert.equal(posted(saved),2270);
  assert.deepEqual(saved.transactions,before.transactions);
  assert.deepEqual(saved.adjustments,[]);
});

test('combined current/starting edits reconcile current balance once and do not invent a payment',()=>{
  const before=state();const saved=saveCreditCardDetails(before,'card',{...card,balance:2100,baselineBalance:1800},{account:card,balance:posted(before)});
  assert.equal(posted(saved),2100);
  assert.equal(saved.accounts[0].baselineBalance,1800);
  assert.equal(saved.adjustments.length,1);
  assert.deepEqual(saved.transactions,before.transactions);
});
