import test from "node:test";
import assert from "node:assert/strict";
import { changeDebtEntry, signedEntryDraft, parseSignedAmount } from "../app/debt-transactions.ts";
import { transactionAdjustedAccounts } from "../app/progress-balances.ts";
import { confirmedPaymentTotal, paymentActivity } from "../app/payments.ts";
import { accrueCostcoInterest } from "../app/interest-accrual.ts";
import { createDashboardPayload, createDashboardBackup, createEmptyPlannedPayoff, parseDashboardJson } from "../app/dashboard-data.ts";
const account={id:"card",name:"Costco",type:"Credit card",balance:1000,apr:20,interestFee:0,minimum:50,minimumMode:"manual",payoffMode:"priority",creditLimit:2000,dueDate:"2026-10-22",promoEndDate:"",postPromoApr:0,postPromoMinimum:0,createdAt:"2026-10-01T00:00:00Z"};
const initial=()=>({accounts:[account,{...account,id:"other",name:"Other",balance:500}],transactions:[],adjustments:[]});
const draft=(kind,amount,extra={})=>({accountId:"card",kind,amount,date:"2026-10-05",note:"test",direction:"increase",...extra});
const change=(state,command,id="entry")=>changeDebtEntry(state,command,{displayName:"Partner"},"2026-10-05T12:00:00Z",id);
const balance=(state,id="card")=>transactionAdjustedAccounts(state.accounts,state.transactions).find(a=>a.id===id).balance;
test("unified entries apply signed movement once; edits and type/account corrections replace it",()=>{
 let state=change(initial(),{action:"save",draft:draft("payment",100)},"pay");
 state=change(state,{action:"save",draft:draft("purchase",60)},"buy");
 state=change(state,{action:"save",draft:draft("interest",20)},"int");
 state=change(state,{action:"save",draft:draft("fee",5)},"fee");
 const payload=createDashboardPayload(null,{...state,balanceAdjustments:state.adjustments,monthlyBudgets:{},payees:[],snapshots:[],extra:0,strategy:"avalanche",planning:createEmptyPlannedPayoff()});
 assert.equal(parseDashboardJson(JSON.stringify(createDashboardBackup(payload))).payload.transactions.length,4);
 assert.equal(balance(state),985);assert.equal(paymentActivity(state.transactions,[]).length,4);
 state=change(state,{action:"save",id:"transaction:pay",draft:draft("payment",150)});
 assert.equal(balance(state),935);assert.equal(confirmedPaymentTotal(state.transactions,[],"2026-10"),150);
 assert.equal(state.transactions[0].revisions[0].amount,100);
 state=change(state,{action:"save",id:"transaction:pay",draft:draft("purchase",50,{accountId:"other"})});
 assert.equal(balance(state),1085);assert.equal(balance(state,"other"),550);assert.equal(confirmedPaymentTotal(state.transactions,[],"2026-10"),0);
 assert.equal(state.transactions[0].debtAction,undefined);
 for(const id of ["buy","int","fee"]){const prior=balance(state); const item=state.transactions.find(t=>t.id===id);state=change(state,{action:"delete",id:"transaction:"+id});assert.equal(balance(state),prior-item.amount);const same=change(state,{action:"delete",id:"transaction:"+id});assert.equal(same,state);state=change(state,{action:"restore",id:"transaction:"+id});assert.equal(balance(state),prior);}
});
test("balance adjustment CRUD uses offsets only, retains confirmations and backup recovery",()=>{
 let state=change(initial(),{action:"save",draft:draft("adjustment",100,{direction:"decrease"})},"adj");
 assert.equal(balance(state),900);assert.equal(state.transactions.length,0);
 state.adjustments[0].confirmedPayment={confirmedAt:"2026-10-05T12:00:00Z"};
 state=change(state,{action:"save",id:"adjustment:adj",draft:draft("adjustment",150,{direction:"decrease"})});
 assert.equal(balance(state),850);assert.equal(confirmedPaymentTotal([],state.adjustments,"2026-10"),150);
 state=change(state,{action:"delete",id:"adjustment:adj"});assert.equal(balance(state),1000);assert.equal(paymentActivity([],state.adjustments).length,0);
 const payload=createDashboardPayload(null,{...state,balanceAdjustments:state.adjustments,monthlyBudgets:{},payees:[],snapshots:[],extra:0,strategy:"avalanche",planning:createEmptyPlannedPayoff()});
 const restored=parseDashboardJson(JSON.stringify(createDashboardBackup(payload))).payload;
 state={accounts:restored.accounts,transactions:restored.transactions,adjustments:restored.balanceAdjustments};
 state=change(state,{action:"restore",id:"adjustment:adj"});assert.equal(balance(state),850);
 state=change(state,{action:"save",id:"adjustment:adj",draft:draft("adjustment",25,{accountId:"other"})});
 assert.equal(balance(state),1000);assert.equal(balance(state,"other"),525);assert.equal(state.adjustments[0].confirmedPayment,undefined);
 assert.equal(state.adjustments[0].revisions.length,4);
});
test("correcting or deleting monthly interest keeps cycle ID reserved",()=>{
 let state=initial();state.accounts[0]={...account,interestAutomation:{enabled:true,coveredThrough:"2026-10-02",estimatedApr:20}};
 state.transactions=accrueCostcoInterest(state.accounts,[],"2026-11-03");const interest=state.transactions[0];
 state=change(state,{action:"save",id:"transaction:"+interest.id,draft:draft("interest",18.01,{date:interest.date})});
 assert.equal(balance(state),1018.01);assert.equal(state.transactions[0].interestEstimate.cycle,"2026-11-02");
 state=change(state,{action:"delete",id:"transaction:"+interest.id});assert.equal(balance(state),1000);
 assert.equal(accrueCostcoInterest(state.accounts,state.transactions,"2026-11-03").length,1);
 state=change(state,{action:"restore",id:"transaction:"+interest.id});assert.equal(balance(state),1018.01);
 assert.throws(()=>change(state,{action:"save",id:"transaction:"+interest.id,draft:draft("interest",10,{date:"2026-11-04"})}),/monthly cycle/);
 const payload=createDashboardPayload(null,{...state,balanceAdjustments:state.adjustments,monthlyBudgets:{},payees:[],snapshots:[],extra:0,strategy:"avalanche",planning:createEmptyPlannedPayoff()});
 assert.equal(parseDashboardJson(JSON.stringify(createDashboardBackup(payload))).payload.transactions[0].amount,18.01);
});
test("later lender offsets stay intact when earlier movements are corrected; invalid input cannot mutate",()=>{
 let state=change(initial(),{action:"save",draft:draft("payment",100)},"pay");
 state=change(state,{action:"save",draft:draft("adjustment",50,{direction:"decrease"})},"adj");
 state=change(state,{action:"delete",id:"transaction:pay"});assert.equal(balance(state),950);assert.equal(state.accounts[0].balanceOffset,-50);
 for(const value of [NaN,-1,0,1.234]) assert.throws(()=>change(state,{action:"save",draft:draft("purchase",value)}),/amount/);
 assert.throws(()=>change(state,{action:"save",draft:draft("payment",1001)}),/exceed/);
 assert.throws(()=>change(state,{action:"save",draft:draft("purchase",50,{date:"2026-02-30"})}),/date/);
 assert.equal(balance(state),950);
});

test("changing interest to a purchase updates its classification without adding a second movement",()=>{
 let state=change(initial(),{action:"save",draft:draft("interest",20)},"interest");
 state=change(state,{action:"save",id:"transaction:interest",draft:draft("purchase",30)});
 assert.equal(balance(state),1030);assert.equal(state.transactions[0].category,"Purchases");
 assert.equal(paymentActivity(state.transactions,[])[0].kind,"purchase");
});

test("signed input names activity, preserves magnitude backups, and applies edits once",()=>{
 assert.equal(parseSignedAmount("+66.96"),66.96);assert.equal(parseSignedAmount("-500.00"),-500);assert.equal(parseSignedAmount("−500"),-500);
 for(const text of ["","-","+","1e3","--20","1.234","$50"])assert.ok(Number.isNaN(parseSignedAmount(text)));
 const input={accountId:"card",title:"SFC Henderson grocery run",amount:"+66.96",date:"2026-10-05",note:"Groceries"};
 let state=change(initial(),{action:"save",draft:signedEntryDraft(undefined,input)},"grocery");
 assert.equal(balance(state),1066.96);assert.equal(state.transactions[0].title,input.title);assert.equal(state.transactions[0].amount,66.96);
 state=change(state,{action:"save",id:"transaction:grocery",draft:signedEntryDraft(state.transactions[0],{...input,amount:"-50",title:"Card payment"})});
 assert.equal(balance(state),950);assert.equal(confirmedPaymentTotal(state.transactions,[],"2026-10"),50);assert.equal(state.transactions[0].revisions[0].title,input.title);
 const payload=createDashboardPayload(null,{...state,balanceAdjustments:state.adjustments,monthlyBudgets:{},payees:[],snapshots:[],extra:0,strategy:"avalanche",planning:createEmptyPlannedPayoff()});
 const restored=parseDashboardJson(JSON.stringify(createDashboardBackup(payload))).payload;
 assert.equal(restored.transactions[0].title,"Card payment");assert.equal(restored.transactions[0].amount,50);
 assert.throws(()=>change(initial(),{action:"save",draft:signedEntryDraft(undefined,{...input,title:" "})}),/title/);
});
test("signed lender adjustment changes offset only; payment confirmation is explicit",()=>{
 let state=change(initial(),{action:"save",draft:draft("adjustment",66.96)},"adjust");
 const input={accountId:"card",title:"SFC Henderson grocery run",amount:"+66.96",date:"2026-10-05",note:""};
 state=change(state,{action:"save",id:"adjustment:adjust",draft:signedEntryDraft(state.adjustments[0],input)});
 assert.equal(balance(state),1066.96);assert.equal(state.transactions.length,0);
 state=change(state,{action:"save",id:"adjustment:adjust",draft:{...signedEntryDraft(state.adjustments[0],{...input,amount:"-50"}),confirmAsPayment:true}});
 assert.equal(balance(state),950);assert.equal(state.transactions.length,0);assert.equal(confirmedPaymentTotal([],state.adjustments,"2026-10"),50);
 state=change(state,{action:"save",id:"adjustment:adjust",draft:{...signedEntryDraft(state.adjustments[0],{...input,amount:"-50"}),confirmAsPayment:true}});
 assert.equal(balance(state),950);assert.equal(confirmedPaymentTotal([],state.adjustments,"2026-10"),50);
 state=change(state,{action:"save",id:"adjustment:adjust",draft:signedEntryDraft(state.adjustments[0],{...input,amount:"+20"})});
 assert.equal(balance(state),1020);assert.equal(confirmedPaymentTotal([],state.adjustments,"2026-10"),0);
 const payload=createDashboardPayload(null,{...state,balanceAdjustments:state.adjustments,monthlyBudgets:{},payees:[],snapshots:[],extra:0,strategy:"avalanche",planning:createEmptyPlannedPayoff()});
 assert.equal(parseDashboardJson(JSON.stringify(createDashboardBackup(payload))).payload.balanceAdjustments[0].title,input.title);
});

test('balance-update reporting classification changes no balances and survives backup validation',async()=>{
 const {parseDashboardContract}=await import('../app/dashboard-data.ts');
 const {readFileSync}=await import('node:fs');
 const backup=parseDashboardContract(JSON.parse(readFileSync(new URL('fixtures/legacy-v0.json',import.meta.url),'utf8')));
 const a={...backup.payload.accounts[0],id:'classify',balance:1000,balanceOffset:0};
 let state={accounts:[a],transactions:[],adjustments:[]};
 state=changeDebtEntry(state,{action:'save',draft:{accountId:a.id,kind:'adjustment',amount:66.96,direction:'increase',date:'2026-10-10',note:'',title:'Grocery',reportKind:'purchase'}},undefined,'2026-10-10T12:00:00Z','grocery');
 const before=transactionAdjustedAccounts(state.accounts,state.transactions)[0].balance;
 state=changeDebtEntry(state,{action:'save',id:'adjustment:grocery',draft:{accountId:a.id,kind:'adjustment',amount:66.96,direction:'increase',date:'2026-10-10',note:'',title:'Grocery',reportKind:'interest'}});
 assert.equal(transactionAdjustedAccounts(state.accounts,state.transactions)[0].balance,before);
 assert.equal(paymentActivity(state.transactions,state.adjustments)[0].kind,'interest');
 state=changeDebtEntry(state,{action:'save',draft:{accountId:a.id,kind:'adjustment',amount:50,direction:'decrease',date:'2026-10-10',note:'',reportKind:'credit',confirmAsPayment:false}},undefined,'2026-10-10T12:00:00Z','refund');
 assert.equal(confirmedPaymentTotal(state.transactions,state.adjustments,'2026-10'),0);
 backup.payload.accounts=state.accounts;backup.payload.transactions=state.transactions;backup.payload.balanceAdjustments=state.adjustments;
 assert.deepEqual(parseDashboardContract(backup).payload.balanceAdjustments,state.adjustments);
 assert.throws(()=>changeDebtEntry(state,{action:'save',id:'adjustment:refund',draft:{accountId:a.id,kind:'adjustment',amount:50,direction:'decrease',date:'2026-10-10',note:'',reportKind:'purchase'}}),/direction/);
});
