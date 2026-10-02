import assert from "node:assert/strict";
import test from "node:test";
import { confirmAdjustmentPayment, confirmedPaymentTotal, paymentActivity, parseMoneyInput } from "../app/payments.ts";
import { createBalanceAdjustment, createDebtPayment } from "../app/debts-screen.ts";
import { transactionAdjustedAccounts } from "../app/progress-balances.ts";
import { createDashboardBackup, createDashboardPayload, createEmptyPlannedPayoff, parseDashboardJson, serializeDashboardBackup } from "../app/dashboard-data.ts";
import { paymentContext } from "../app/payment-context.ts";

const debt={id:"card",name:"Household card",type:"Credit card",balance:1000,apr:20,interestFee:0,minimum:50,minimumMode:"manual",payoffMode:"priority",creditLimit:2000,dueDate:"2026-10-22",promoEndDate:"",postPromoApr:0,postPromoMinimum:0,createdAt:"2026-10-01T00:00:00.000Z"};
const timestamp="2026-10-02T20:00:00.000Z";
const reconciliation=()=>createBalanceAdjustment({storedAccount:debt,currentBalance:1000,nextBalance:900,date:"2026-10-02",id:"adjust",createdAt:timestamp});

test("record payment then lender update then confirm applies each monetary change only once",()=>{
 const transaction=createDebtPayment({account:debt,amount:100,date:"2026-10-02",id:"payment",createdAt:timestamp});
 const current=transactionAdjustedAccounts([debt],[transaction])[0];assert.equal(current.balance,900);
 const change=createBalanceAdjustment({storedAccount:debt,currentBalance:900,nextBalance:850,date:"2026-10-02",id:"adjust",createdAt:timestamp});
 const beforeConfirmation=transactionAdjustedAccounts([change.account],[transaction]);
 const confirmed=confirmAdjustmentPayment(change.adjustment,{displayName:"Partner"},timestamp);
 assert.deepEqual(transactionAdjustedAccounts([change.account],[transaction]),beforeConfirmation);
 assert.equal(beforeConfirmation[0].balance,850);
 assert.equal(confirmedPaymentTotal([transaction],[change.adjustment],"2026-10"),100);
 assert.equal(confirmedPaymentTotal([transaction],[confirmed],"2026-10"),150);
 assert.equal(confirmAdjustmentPayment(confirmed),confirmed);
 assert.equal(confirmedPaymentTotal([transaction],[confirmed],"2026-09"),0);
 assert.deepEqual(paymentContext([transaction],"2026-10"),{paid:{card:100},minimumPaid:{card:100},monthlyCommitment:undefined});
});

test("adjustment confirmations round-trip in backups and do not change budget or ledger records",()=>{
 const {account,adjustment}=reconciliation();const confirmed=confirmAdjustmentPayment(adjustment,undefined,timestamp);
 const monthlyBudgets={"2026-10":[{id:"salary",name:"Salary",kind:"income",category:"Salary",amount:5000,paymentMethod:"debit",creditAccountId:"",recurring:true,createdAt:timestamp}]};
 const payload=createDashboardPayload(null,{accounts:[account],monthlyBudgets,payees:[],transactions:[],snapshots:[],extra:200,strategy:"avalanche",planning:createEmptyPlannedPayoff(),balanceAdjustments:[confirmed]});
 const restored=parseDashboardJson(serializeDashboardBackup(createDashboardBackup(payload)));
 assert.deepEqual(restored.payload.balanceAdjustments,[confirmed]);assert.deepEqual(restored.payload.monthlyBudgets,monthlyBudgets);assert.deepEqual(restored.payload.transactions,[]);
 assert.equal(transactionAdjustedAccounts(restored.payload.accounts,restored.payload.transactions)[0].balance,900);
 assert.equal(confirmedPaymentTotal([],restored.payload.balanceAdjustments,"2026-10"),100);
});

test("increases cannot be payments, deleted payments stay excluded, and orphan history remains visible",()=>{
 const {adjustment}=reconciliation();assert.throws(()=>confirmAdjustmentPayment({...adjustment,difference:20}),/Only a balance decrease/);
 const payment=createDebtPayment({account:debt,amount:50,date:"2026-10-02",createdAt:timestamp});
 const deleted={...payment,deletedAt:timestamp};assert.equal(confirmedPaymentTotal([deleted],[],"2026-10"),0);
 const activity=paymentActivity([payment,deleted],[{...adjustment,accountId:"removed"}]);assert.equal(activity.length,2);assert.ok(activity.some(row=>row.accountId==="removed"));
 const backup=createDashboardBackup(createDashboardPayload(null,{accounts:[debt],monthlyBudgets:{},payees:[],transactions:[],snapshots:[],extra:0,strategy:"avalanche",planning:createEmptyPlannedPayoff(),balanceAdjustments:[adjustment]}));
 backup.payload.balanceAdjustments[0]={...adjustment,difference:20,confirmedPayment:{confirmedAt:timestamp}};
 assert.throws(()=>parseDashboardJson(JSON.stringify(backup)),/requires a balance decrease/);
});

test("money fields distinguish explicit zero from empty or invalid text",()=>{
 assert.equal(parseMoneyInput("0"),0);assert.equal(parseMoneyInput("100.25"),100.25);
 for(const value of [""," ","-1","1.234","abc","1e3"])assert.ok(Number.isNaN(parseMoneyInput(value)),value);
 assert.throws(()=>createDebtPayment({account:debt,amount:NaN,date:"2026-10-02"}),/valid payment amount/);
 assert.throws(()=>createDebtPayment({account:debt,amount:100,date:"2026-02-30"}),/valid payment date/);
});
