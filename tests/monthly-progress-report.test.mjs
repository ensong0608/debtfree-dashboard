import test from 'node:test';
import assert from 'node:assert/strict';
import {monthlyProgressReport} from '../app/monthly-progress-report.ts';
const account={id:'card',name:'Card',type:'Credit card',balance:1000,baselineBalance:1000,apr:24,minimum:200,minimumMode:'manual',payoffMode:'priority',interestFee:0,creditLimit:0,dueDate:'2026-10-25',promoEndDate:'',postPromoApr:0,postPromoMinimum:0,createdAt:'2026-01-01'};
const base={accountId:'card',date:'2026-10-10',createdAt:'2026-10-10T12:00:00Z',updatedAt:'2026-10-10T12:00:00Z',deletedAt:null,payeeId:'',payeeName:'Card',category:'Debt payment',memo:''};
const tx=(id,type,amount,extra={})=>({...base,id,type,amount,...extra});
const adjustment={id:'balance',accountId:'card',date:'2026-10-10',createdAt:'2026-10-10T12:00:00Z',difference:-50,balanceBefore:900,balanceAfter:850};
const input=(extra={})=>({scope:'accounts',today:'2026-10-29',accounts:[account],loans:[],transactions:[],adjustments:[],items:[],plannedAccountAmount:300,...extra});

test('month report counts real payment records once, keeps recorded fees separate and ignores replacements',()=>{
 const transactions=[tx('pay','payment',100),tx('linked','payment',50,{includedIn:{type:'adjustment',id:'balance'}}),tx('refund','payment',10,{credit:true}),tx('buy','charge',40,{category:'Shopping'}),tx('actual','fee',20,{category:'Interest',actualInterestCycle:'2026-10',actualInterestIncludedAt:'2026-10-12'}),tx('old-estimate','fee',20,{category:'Interest',replacedByTransactionId:'actual'}),tx('estimate','fee',30,{category:'Interest',interestEstimate:{cycle:'2026-10',periodStart:'2026-09-10',days:30,estimatedApr:24}}),tx('deleted','payment',500,{deletedAt:'2026-10-20'}),tx('future','payment',1000,{date:'2026-10-30'}),tx('settlement:checklist','payment',900)];
 const data=input({transactions,adjustments:[adjustment]});const before=JSON.stringify(data);const report=monthlyProgressReport(data);
 assert.equal(report.recorded,150);assert.equal(report.planned,300);assert.equal(report.remaining,150);assert.equal(report.percentage,50);assert.equal(report.interest,50);assert.equal(report.hasEstimate,true);assert.equal(report.netChange,null);assert.equal(JSON.stringify(data),before);
 assert.deepEqual(report.accountPayments,[{id:'card',name:'Card',paid:150}]);
});
test('without a payment plan, recorded payments remain visible without a fabricated percentage',()=>{
 const result=monthlyProgressReport(input({plannedAccountAmount:0,transactions:[tx('pay','payment',100)]}));assert.equal(result.recorded,100);assert.equal(result.planned,null);assert.equal(result.remaining,null);assert.equal(result.percentage,null);
});
test('home loan totals include a payment only once and do not invent a missing opening balance',()=>{
 const loan={id:'home',name:'Mortgage',kind:'house',originalAmount:20000,remainingAmount:9200,balanceKind:'principal',asOf:'2026-10-15',budgetItemId:'home',budgetItemName:'Mortgage',monthlyPayment:1000,history:[{date:'2026-09-01',amount:10000,balanceKind:'principal',recordedAt:'2026-09-01'},{date:'2026-10-15',amount:9200,balanceKind:'principal',recordedAt:'2026-10-15',payment:1000,principal:800,interest:100,escrow:100}]};
 const result=monthlyProgressReport(input({scope:'home',loans:[loan],items:[{id:'home',name:'Mortgage',kind:'expense',amount:1000}]}));assert.equal(result.planned,1000);assert.equal(result.recorded,1000);assert.equal(result.netChange,-800);assert.equal(result.interest,100);assert.equal(result.hasEstimate,true);
 assert.deepEqual(result.accountPayments,[{id:'home',name:'Mortgage',paid:1000}]);
 const partial=monthlyProgressReport(input({scope:'home',loans:[{...loan,history:loan.history.slice(1)}]}));assert.equal(partial.netChange,null);
 const missing=monthlyProgressReport(input({scope:'home',loans:[{...loan,monthlyPayment:undefined,history:[{...loan.history[1],interest:undefined}]}]}));assert.equal(missing.planned,null);assert.equal(missing.interest,null);
});
test('auto scope includes legacy auto ledger payments without counting the virtual tracker twice',()=>{
 const auto={...account,id:'car',name:'Car',type:'Auto loan',balance:1000,minimum:150};const virtual={id:'legacy-auto:car',kind:'car',name:'Car',originalAmount:2000,remainingAmount:1000,balanceKind:'principal',asOf:'2026-10-15',budgetItemId:'',budgetItemName:'',history:[]};
 const result=monthlyProgressReport(input({scope:'auto',accounts:[auto],loans:[virtual],transactions:[tx('car-payment','payment',150,{accountId:'car'})]}));assert.equal(result.planned,150);assert.equal(result.recorded,150);assert.equal(result.netChange,-150);
});

test('recorded balance change uses posting movements and includes classified balance-update fees',()=>{
 const fee={...adjustment,id:'fee-adjustment',difference:5,reportKind:'fee'};
 const actual=tx('actual','fee',20,{category:'Interest',actualInterestCycle:'2026-10'});
 const result=monthlyProgressReport(input({transactions:[tx('pay','payment',100),actual],adjustments:[fee]}));
 assert.equal(result.recorded,100);assert.equal(result.interest,25);assert.equal(result.netChange,-75);
});
