import test from 'node:test';
import assert from 'node:assert/strict';
import {currencyDigits,parseFinancialInput} from '../app/financial-input.ts';
import {regularApr,activeCreditLimit} from '../app/debt-terms.ts';
import {forecastApr,forecastMinimum} from '../app/payoff-engine.ts';
import {estimateCycleInterest,interestSettingsError,accrueCostcoInterest} from '../app/interest-accrual.ts';
import {saveCreditCardDetails} from '../app/credit-card-editor.ts';
const card={id:'card',name:'Card',type:'Credit card',balance:10000,baselineBalance:10000,apr:24,minimum:350,minimumMode:'manual',payoffMode:'priority',interestFee:188,creditLimit:20000,dueDate:'',promoEndDate:'2026-04-15',promoApr:6,promoEnabled:true,postPromoApr:0,postPromoMinimum:0,createdAt:'2026-03-01',interestAutomation:{enabled:true,closingDay:30,coveredThrough:'2026-03-31',estimatedApr:24}};
test('currency digit entry shifts cents, retains grouping and rejects excess decimals on explicit entry',()=>{
 for(const [raw,want] of [['1','0.01'],['12','0.12'],['1234','12.34'],['$1,234.567','12345.67'],['$12.3','1.23'],['','']])assert.equal(currencyDigits(raw),want);
 assert.equal(parseFinancialInput(currencyDigits('12.345')).error,'Use up to 2 decimal places.');
});
test('promo APR applies through its end date; regular account APR resumes afterward',()=>{
 assert.equal(forecastApr(card,1,new Date('2026-04-15T19:00Z')),6);
 assert.equal(forecastApr(card,1,new Date('2026-04-16T19:00Z')),24);
 assert.equal(estimateCycleInterest(card,[],'2026-03-31','2026-04-30').amount,123.29);
 assert.equal(forecastApr({...card,promoEnabled:false},1,new Date('2026-04-01T19:00Z')),24);
 const old={...card,promoApr:undefined,apr:6,postPromoApr:24};
 assert.equal(regularApr(old),24);assert.equal(forecastApr(old,1,new Date('2026-04-01T19:00Z')),6);
 assert.equal(regularApr({...old,type:'Personal loan'}),6);
 assert.equal(forecastMinimum({...card,postPromoMinimum:400},10000,1,new Date('2026-05-01T19:00Z')),400);
});
test('disabled optional details retain values, manual payment, history, and fee without new transactions',()=>{
 const saved=saveCreditCardDetails({accounts:[card],transactions:[],adjustments:[]},card.id,{...card,creditLimitEnabled:false,customNote:'Keep this note',customNoteEnabled:false},{account:card,balance:10000});
 assert.equal(saved.accounts[0].creditLimit,20000);assert.equal(activeCreditLimit(saved.accounts[0]),0);assert.equal(saved.accounts[0].customNote,'Keep this note');assert.equal(saved.accounts[0].minimum,350);assert.equal(saved.accounts[0].interestFee,188);assert.deepEqual(saved.transactions,[]);assert.deepEqual(saved.adjustments,[]);
});
test('changing closing day preserves the existing covered-through anchor and remains idempotent',()=>{
 const changed={...card,promoEnabled:false,interestAutomation:{...card.interestAutomation,closingDay:15}};
 assert.equal(interestSettingsError(changed.interestAutomation,'2026-04-30'),'');
 const rows=accrueCostcoInterest([changed],[],'2026-04-30');assert.equal(rows.length,1);assert.equal(rows[0].date,'2026-04-15');assert.equal(rows[0].interestEstimate.periodStart,'2026-03-31');
 assert.equal(changed.interestAutomation.coveredThrough,'2026-03-31');assert.equal(accrueCostcoInterest([changed],rows,'2026-04-30'),rows);
});
