import test from 'node:test';
import assert from 'node:assert/strict';
import { accrueCostcoInterest, estimateCycleInterest, recordActualInterest, reconcileInterest, datedInterestSettings } from '../app/interest-accrual.ts';
import { calculatePlan, forecastMinimum, forecastMonthlyRate, round } from '../app/payoff-engine.ts';
import { transactionAdjustedAccounts } from '../app/progress-balances.ts';
import { createBalanceAdjustment } from '../app/debts-screen.ts';
import { captureMinimumCycles, currentMinimumCycle } from '../app/minimum-cycle.ts';
import { buildActivePayoffCommitment, captureAutoMinimumCommitments } from '../app/payoff-commitment.ts';
import { saveCreditCardDetails } from '../app/credit-card-editor.ts';
import { createDashboardPayload, createDashboardBackup, parseDashboardJson, createEmptyPlannedPayoff } from '../app/dashboard-data.ts';

const date = new Date('2026-04-01T19:00:00Z');
const card = { id:'card',name:'Card',type:'Credit card',balance:10000,apr:24,interestFee:188.01,minimum:350,minimumMode:'manual',payoffMode:'priority',creditLimit:20000,dueDate:'2026-04-28',promoEndDate:'',postPromoApr:0,postPromoMinimum:0,createdAt:'2026-03-31',interestAutomation:{enabled:true,closingDay:31,coveredThrough:'2026-03-31',estimatedApr:24} };
const entry = (id, day, amount, type='payment', extra={}) => ({id,date:day,amount,type,accountId:'card',payeeId:'',payeeName:'Card',category:'Debt payment',memo:'',createdAt:day+'T20:00:00Z',updatedAt:day+'T20:00:00Z',deletedAt:null,...extra});
const balance = (account,entries) => transactionAdjustedAccounts([account],entries)[0].balance;
const estimate = (account=card,entries=[]) => estimateCycleInterest(account,entries,'2026-03-31','2026-04-30');

test('dated payment acceptance: 15 days at 10000 and 15 at 8000 gives 177.53',()=>{
 const payment=entry('payment','2026-04-16',2000);
 const result=accrueCostcoInterest([card],[payment],'2026-04-30');
 assert.equal(result[1].amount,177.53);
 assert.equal(result[1].balanceBefore,8000);
 assert.equal(balance(card,result),8177.53);
 assert.equal(accrueCostcoInterest([card],result,'2026-04-30'),result);
 assert.equal(estimate(card,[...result]).amount,177.53); // The cycle cannot charge interest on itself.
});

test('same-day net changes, credits and fees count once; deleted, replaced and reporting rows do not',()=>{
 const rows=[entry('p','2026-04-16',2200),entry('purchase','2026-04-16',300,'charge'),entry('credit','2026-04-16',200,'payment',{credit:true}),entry('fee','2026-04-16',100,'fee'),entry('deleted','2026-04-16',999,'charge',{deletedAt:'2026-04-17'}),entry('superseded','2026-04-16',999,'charge',{replacedByTransactionId:'purchase'}),entry('linked','2026-04-16',999,'payment',{includedIn:{type:'transaction',id:'p'}}),entry('settlement:report','2026-04-16',999)];
 assert.equal(estimate(card,rows).amount,177.53);
 assert.equal(estimate(card,[...rows].reverse()).amount,177.53);
});

test('unknown opening history, undated offsets and within-cycle confirmations defer posting',()=>{
 const recent={...card,createdAt:'2026-04-10'};
 assert.equal(estimate(recent),null);
 assert.equal(accrueCostcoInterest([recent],[],'2026-04-30').length,0);
 assert.equal(accrueCostcoInterest([recent],[],'2026-05-31')[0].date,'2026-05-31');
 assert.equal(estimate({...card,balanceOffset:100}),null);
 const confirmed=createBalanceAdjustment({storedAccount:card,currentBalance:10000,nextBalance:11000,date:'2026-04-10',transactions:[]});
 assert.equal(estimate(confirmed.account),null);
 assert.equal(accrueCostcoInterest([confirmed.account],[],'2026-05-31')[0].date,'2026-05-31');
 const accepted=entry('interest:card:2026-04','2026-04-30',150,'fee',{interestEstimate:{cycle:'2026-04-30',periodStart:'2026-03-31',days:30,estimatedApr:24}});
 assert.equal(accrueCostcoInterest([card],[accepted],'2026-04-30')[0],accepted);
});

test('dated actual replaces estimate; confirmed balances and later activity survive without another fee',()=>{
 const estimated=accrueCostcoInterest([card],[entry('payment','2026-04-16',2000)],'2026-04-30');
 const actual=recordActualInterest(card,estimated,180,'2026-04-30','2026-05-01T20:00:00Z','actual');
 assert.equal(balance(card,actual),8180);
 assert.equal(actual.find(t=>t.id==='interest:card:2026-04').replacedByTransactionId,'actual');
 const check=reconcileInterest(card,estimated,'2026-05-01','2026-05-01T20:00:00Z');
 const later=[...check.transactions,entry('later-payment','2026-05-02',500),entry('later-purchase','2026-05-03',200,'charge')];
 // These later-dated rows already exist when an earlier lender balance is confirmed.
 const confirmed=createBalanceAdjustment({storedAccount:check.account,currentBalance:balance(card,later),nextBalance:8500,date:'2026-05-01',createdAt:'2026-05-04T20:00:00Z',transactions:later});
 assert.equal(balance(confirmed.account,later),8200);
 const included=recordActualInterest(confirmed.account,later,180,'2026-04-30','2026-05-04T20:00:00Z','included-actual');
 assert.equal(balance(confirmed.account,included),8200);
 assert.ok(included.find(t=>t.id==='included-actual').actualInterestIncludedAt);
 assert.equal(accrueCostcoInterest([confirmed.account],included,'2026-05-04'),included);
 assert.throws(()=>recordActualInterest(confirmed.account,included,180,'2026-04-30','2026-05-04T20:00:00Z'),/already exists/);
 const contract=createDashboardBackup(createDashboardPayload(null,{accounts:[confirmed.account],transactions:included,monthlyBudgets:{},payees:[],snapshots:[],extra:0,strategy:'avalanche',planning:createEmptyPlannedPayoff(),balanceAdjustments:[confirmed.adjustment]}));
 const restored=parseDashboardJson(JSON.stringify(contract)).payload;
 assert.equal(balance(restored.accounts[0],restored.transactions),8200);
});

test('rate edits keep elapsed-day APR and promotional end date is inclusive',()=>{
 const config=datedInterestSettings(card.interestAutomation,{...card.interestAutomation,estimatedApr:12},'2026-04-16');
 assert.equal(estimate({...card,interestAutomation:config}).amount,147.95); // 15 days at 24%, then 15 at 12%.
 assert.equal(estimate({...card,promoEndDate:'2026-04-15',postPromoApr:12}).amount,147.95);
 assert.equal(forecastMonthlyRate({...card,promoEndDate:'2026-03-31',postPromoApr:30},1,date),0.025);
 assert.equal(accrueCostcoInterest([{...card,type:'Auto loan'}],[],'2026-04-30').length,0);
});

test('automatic future minima use projected pre-interest balances once, manual and installment payments stay fixed',()=>{
 const auto={...card,minimumMode:'auto',interestFee:900};
 const result=calculatePlan([auto],100,'avalanche',{}, {},date);
 assert.equal(result.monthly,400);
 assert.equal(result.months[0].minimums.card,300);
 assert.equal(result.months[1].minimums.card,294);
 assert.equal(result.months[1].paid,400);
 assert.equal(result.months[1].interest,196);
 assert.equal(result.months[1].requiredMonthly,400);
 const manual=calculatePlan([card],50,'avalanche',{}, {},date);
 assert.equal(manual.months[0].minimums.card,350);
 assert.equal(manual.months[1].minimums.card,350);
 assert.equal(forecastMinimum({...auto,type:'Personal loan'},5000,2,date),350);
 assert.equal(forecastMinimum({...auto,promoEndDate:'2026-04-30',postPromoApr:30,postPromoMinimum:450},5000,2,date),450);
});

test('established current target survives payment and auto-mode metadata saves; remaining target declines by payments',()=>{
 const auto={...card,minimumMode:'auto',minimum:300};
 const captured=captureMinimumCycles([auto],'2026-04-01');
 const payment=entry('payment','2026-04-16',2000);
 const current=transactionAdjustedAccounts(captured,[payment])[0];
 assert.equal(currentMinimumCycle(current,'2026-04-16').amount,300);
 const result=calculatePlan([current],0,'avalanche',{}, {},date,{}, {monthlyCommitment:400,paid:{card:2000},minimumPaid:{card:2000},minimumTargets:{card:300}});
 assert.equal(result.months[0].minimums.card,0);
 const state={accounts:captured,transactions:[payment],adjustments:[]};
 const saved=saveCreditCardDetails(state,'card',{...captured[0],balance:8000,name:'Renamed'},{account:captured[0],balance:8000});
 assert.deepEqual(saved.accounts[0].minimumCycles,captured[0].minimumCycles);
 assert.deepEqual(saved.transactions,state.transactions);
 const next=captureMinimumCycles(saved.accounts,'2026-05-01',[payment]);
 assert.equal(currentMinimumCycle(next[0],'2026-05-01').amount,240);
});

test('automatic minimum reductions across refresh redirect freed money and preserve saved manual settings',()=>{
 const auto={...card,minimumMode:'auto'};
 const settings={months:{},payoffExtraPayment:100,payoffPlanAmount:999};
 const captured=captureAutoMinimumCommitments(settings,[auto],date);
 const initial=buildActivePayoffCommitment([auto],[],[],captured,date);
 const reduced=buildActivePayoffCommitment([{...auto,balance:8000}],[],[],structuredClone(captured),date);
 assert.equal(initial.schedule.monthly,400);
 assert.equal(reduced.schedule.monthly,400);
 assert.equal(reduced.extra,160);
 assert.equal(reduced.schedule.firstPayments['account:card'],400);
 assert.equal(card.minimum,350);
 assert.equal(captured.payoffPlanAmount,999);
 const legacy=captureAutoMinimumCommitments({months:{},payoffPlanAmount:400},[auto],date);
 assert.equal(buildActivePayoffCommitment([{...auto,balance:8000}],[],[],legacy,date).schedule.monthly,400);
 assert.equal(captureAutoMinimumCommitments(captured,[auto],date),captured);
 for (const month of reduced.schedule.rows.slice(0,-1)) assert.equal(month.paid,400);
});
