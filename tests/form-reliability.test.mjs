import test from 'node:test';
import assert from 'node:assert/strict';
import {parseFinancialInput, financialPaste} from '../app/financial-input.ts';
import {interestSettingsError, accrueCostcoInterest, closingDate} from '../app/interest-accrual.ts';
import {saveCreditCardDetails} from '../app/credit-card-editor.ts';
import {recurringDueDate} from '../app/recurring-due-date.ts';

const config={enabled:true,closingDay:31,coveredThrough:'2026-08-31',estimatedApr:12};
const card={id:'card',name:'Sample card',type:'Credit card',balance:1000,baselineBalance:1000,apr:12,minimum:25,minimumMode:'manual',payoffMode:'priority',interestFee:0,creditLimit:2000,dueDate:'2026-08-31',promoEndDate:'',postPromoApr:0,postPromoMinimum:0,createdAt:'2026-08-01T12:00:00Z',interestAutomation:config};

test('numeric drafts preserve zero and intermediate decimals without coercing blanks',()=>{
  assert.ok(Number.isNaN(parseFinancialInput('').value));
  assert.ok(parseFinancialInput('').error);
  for(const [raw,value] of [['0',0],['0.',0],['1.',1],['.5',.5],['0.29',.29],['1234.56',1234.56]]) {
    assert.deepEqual(parseFinancialInput(raw),{value,error:''});
  }
  assert.deepEqual(parseFinancialInput('',{emptyValue:0}),{value:0,error:''});
  for(const raw of ['.','-','1e3','Infinity','abc','-1','1.005','1,23','90071992547409.92']) assert.ok(Number.isNaN(parseFinancialInput(raw).value),raw);
});

test('currency paste accepts unambiguous grouping without repairing invalid amounts',()=>{
  assert.equal(financialPaste(' $1,234.56 '),'1234.56');
  assert.equal(financialPaste('−20.50'),'-20.50');
  assert.equal(financialPaste('$1,23.45'),'1,23.45');
  assert.ok(parseFinancialInput(financialPaste('$1,23.45')).error);
  assert.equal(parseFinancialInput(financialPaste('−20.50'),{min:-100}).value,-20.5);
});

test('closing day accepts 1–31 only and APR accepts zero only in Manual mode',()=>{
  for(const day of [1,28,29,30,31]) assert.equal(parseFinancialInput(String(day),{min:1,max:31,decimals:0}).error,'');
  for(const raw of ['', '0','32','2.5']) assert.ok(parseFinancialInput(raw,{min:1,max:31,decimals:0}).error);
  assert.equal(interestSettingsError({...config,enabled:false,estimatedApr:0},'2026-10-26'),'');
  assert.match(interestSettingsError({...config,estimatedApr:0},'2026-10-26'),/APR/);
  assert.match(interestSettingsError({...config,closingDay:15},'2026-10-26'),/Closing day changed/);
  assert.equal(config.coveredThrough,'2026-08-31');
});

test('pausing and resuming estimates catches each later cycle exactly once and preserves entries',()=>{
  const september=accrueCostcoInterest([card],[],'2026-09-30');
  const original=structuredClone(september);
  const paused={...card,interestAutomation:{...config,enabled:false}};
  assert.equal(accrueCostcoInterest([paused],september,'2026-11-30'),september);
  const resumed=accrueCostcoInterest([card],september,'2026-11-30');
  assert.deepEqual(resumed.slice(0,september.length),original);
  assert.deepEqual(resumed.map(row=>row.id),['interest:card:2026-09','interest:card:2026-10','interest:card:2026-11']);
  assert.equal(accrueCostcoInterest([card],resumed,'2026-11-30'),resumed);
  assert.deepEqual(september,original);
});

test('interest metadata saves preserve ledger, balances, anchors and stale-edit protection',()=>{
  const entries=accrueCostcoInterest([card],[],'2026-09-30');
  const state={accounts:[card],transactions:entries,adjustments:[]};
  const before=structuredClone(state);
  const paused=saveCreditCardDetails(state,'card',{...card,interestAutomation:{...config,enabled:false}},{account:card,balance:1000});
  assert.deepEqual(paused.transactions,entries);
  assert.deepEqual(paused.adjustments,[]);
  assert.equal(paused.accounts[0].balance,card.balance);
  assert.equal(paused.accounts[0].interestAutomation.coveredThrough,config.coveredThrough);
  assert.throws(()=>saveCreditCardDetails(state,'card',{...card,interestAutomation:{...config,closingDay:15}},{account:card,balance:1000}),/Closing day changed/);
  assert.throws(()=>saveCreditCardDetails(state,'card',{...card,balance:900,interestAutomation:{...config,enabled:false}},{account:card,balance:1000}),/separately/);
  assert.throws(()=>saveCreditCardDetails(paused,'card',{...card,interestAutomation:{...config,estimatedApr:24}},{account:card,balance:1000}),/Interest settings changed/);
  assert.deepEqual(state,before);
});

test('recurring due days and statement day 31 survive short months and leap years',()=>{
  for(const day of [28,29,30,31]) {
    const saved=`2000-01-${day}`;
    for(const [month,last] of [['2027-02',28],['2028-02',29],['2028-04',30],['2028-05',31]]) {
      assert.equal(recurringDueDate(saved,month),`${month}-${Math.min(day,last)}`);
      assert.equal(closingDate(month,day),`${month}-${Math.min(day,last)}`);
    }
  }
  const leap={...card,interestAutomation:{...config,coveredThrough:'2028-01-31'}};
  const result=accrueCostcoInterest([leap],[],'2028-03-31');
  assert.deepEqual(result.map(row=>row.date),['2028-02-29','2028-03-31']);
  assert.equal(result[0].interestEstimate.days,29);
  assert.equal(leap.interestAutomation.closingDay,31);
});
