import test from 'node:test';import assert from 'node:assert/strict';
import {automaticPaymentAllocation} from '../app/payment-allocation.ts';
import {accrueCostcoInterest,interestClosingDay} from '../app/interest-accrual.ts';
import {editLoanHistory} from '../app/loan-history-edit.ts';
import {copyRecurringPlannedItems} from '../app/monthly-plan.ts';
import {linkedLoanPayment} from '../app/loan-progress.ts';
import {buildBudgetView} from '../app/budget-view.ts';
import {createDemoFixture} from '../mobile/demo-fixture.ts';
const account={...createDemoFixture().payload.accounts[0],id:'card',balance:1000,apr:24,minimum:150,minimumMode:'manual',minimumCycles:[{date:'2026-10-20',amount:150}]};
const date='2026-10-29';const pay=(amount,extra={})=>({id:'prior',accountId:'card',type:'payment',amount,date,paymentKind:'combined',...extra});
test('new payments cover the remaining current obligation before extra without changing saved history',()=>{
 assert.deepEqual(automaticPaymentAllocation(account,[],200,date),{minimum:150,extra:50,paymentKind:'combined'});
 const rows=[pay(150)];const before=structuredClone(rows);assert.deepEqual(automaticPaymentAllocation(account,rows,200,date),{minimum:0,extra:200,paymentKind:'extra'});assert.deepEqual(rows,before);
 assert.deepEqual(automaticPaymentAllocation(account,[pay(100)],200,date),{minimum:50,extra:150,paymentKind:'combined'});
 assert.equal(automaticPaymentAllocation(account,[pay(150,{deletedAt:date})],200,date).minimum,150);
 assert.equal(automaticPaymentAllocation(account,[pay(150,{replacedByTransactionId:'new'})],200,date).minimum,150);
});
test('optional closing day uses month end and preserves legacy statement schedules',()=>{
 assert.equal(interestClosingDay({closingDay:5}),5);assert.equal(interestClosingDay({closingDay:5,customClosingDay:false}),31);
 const card={...account,createdAt:'2026-09-01',interestAutomation:{enabled:true,closingDay:5,customClosingDay:false,coveredThrough:'2026-09-30',estimatedApr:24}};
 assert.equal(accrueCostcoInterest([card],[],'2026-10-30').length,0);
 const entries=accrueCostcoInterest([card],[],'2026-10-31');assert.equal(entries.length,1);assert.equal(entries[0].date,'2026-10-31');assert.equal(accrueCostcoInterest([card],entries,'2026-10-31'),entries);
});
const loan={id:'home',name:'Mortgage',kind:'house',remainingAmount:9000,originalAmount:10000,balanceKind:'principal',asOf:'2026-10-20',apr:5,escrow:100,monthlyPayment:1000,budgetItemId:'house',budgetItemName:'House',history:[{date:'2026-10-20',amount:9000,balanceKind:'principal',recordedAt:'original',payment:1000,principal:800,interest:100,escrow:100}]};
test('loan payment correction changes principal once and retains prior record',()=>{
 const saved=editLoanHistory(loan,0,1100,'2026-10-20','correction');assert.equal(saved.remainingAmount,8900);assert.equal(saved.history[0].principal,900);assert.equal(saved.history[0].interest,100);assert.equal(saved.history[0].escrow,100);assert.equal(saved.history[0].corrections[0].previous.payment,1000);assert.equal(loan.remainingAmount,9000);
});
test('loan corrections preserve subsequent lender balance anchors and later payments',()=>{
 const anchored={...loan,remainingAmount:7500,asOf:'2026-12-20',history:[...loan.history,{date:'2026-11-01',recordedAt:'confirmation',amount:8300,balanceKind:'principal'},{date:'2026-12-20',recordedAt:'later',amount:7500,balanceKind:'principal',payment:1000,principal:800,interest:100,escrow:100}]};
 const saved=editLoanHistory(anchored,0,1100,'2026-10-20');assert.equal(saved.remainingAmount,7500);assert.deepEqual(saved.history.slice(1),anchored.history.slice(1));assert.throws(()=>editLoanHistory(anchored,0,1100,'2026-12-22'),/adjacent/);
});
test('stable budget identity survives renaming and copying; loan history marks Paid without another movement',()=>{
 const original={id:'house',name:'Mortgage',amount:1000,kind:'expense',category:'Housing',paymentMethod:'debit',creditAccountId:'',recurring:true,createdAt:date};
 const items=copyRecurringPlannedItems([original],date,()=> 'copied');assert.equal(linkedLoanPayment(loan,items).id,'copied');
 const commitment={budgetCommitment:0};const view=buildBudgetView({items,loans:[loan],transactions:[],settings:{months:{}},month:'2026-10',currentMonth:'2026-10',commitment});assert.equal(view.allocations[0].recordedPaid,1000);assert.equal(view.allocations[0].linkedLoan,true);assert.equal(view.planned.spending,1000);
});
