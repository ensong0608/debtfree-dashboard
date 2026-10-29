import test from 'node:test';
import assert from 'node:assert/strict';
import {settlementName,settlementFilter,transactionAccountOptions} from '../app/transaction-filters.ts';
import {editPlanSettlement} from '../app/plan-settlements.ts';
const item={id:'bill',name:'House',kind:'expense',amount:100,paymentMethod:'debit',creditAccountId:'',category:'Housing'};
const paid={id:'paid',kind:'spending',targetId:'bill',name:'House',amount:100,date:'2026-09-10',createdAt:'2026-09-10',source:'debit'};
const budgets={'2026-09':[item],'2026-10':[{...item,id:'new-bill',recurringSourceId:'bill',name:'Mortgage'}]};
const loan={id:'home',name:'Home loan',kind:'house',budgetItemId:'bill',budgetItemName:'House',originalAmount:1000,remainingAmount:900,history:[]};
test('budget record names follow stable recurring identity, retaining names only for removed items',()=>{
 const before=JSON.stringify({paid,budgets});
 assert.equal(settlementName(paid,budgets),'Mortgage');
 assert.equal(settlementName(paid,{'2026-10':budgets['2026-10']}),'Mortgage');
 assert.equal(settlementName({...paid,targetId:'deleted'},budgets),'House');
 assert.equal(settlementName({...paid,kind:'minimum',targetId:'card'},budgets,[{id:'card',name:'Renamed card'}]),'Renamed card');
 assert.equal(before,JSON.stringify({paid,budgets}));
});
test('account choices cover loans, paid-off debts, removed debt history and every budget record',()=>{
 const accounts=[{id:'card',name:'Card',balance:500},{id:'paid-card',name:'Old card',balance:0,baselineBalance:100}];
 const options=transactionAccountOptions(accounts,[{accountId:'removed'}],[loan,{...loan,id:'car',name:'Car',kind:'car',remainingAmount:0}],[paid,{...paid,id:'unlinked',targetId:'deleted',name:'Old bill'}],budgets);
 assert.deepEqual(options.map(option=>option.id),['card','paid-card','removed','loan:home','loan:car','budget:deleted']);
 assert.match(options.find(option=>option.id==='paid-card').name,/Paid off/);
 assert.match(options.find(option=>option.id==='loan:car').name,/Paid off/);
 assert.equal(settlementFilter(paid,budgets,[loan]),'loan:home');
 assert.equal(settlementFilter(paid,budgets,[]),'budget:bill');
 assert.equal(settlementFilter({...paid,kind:'minimum',targetId:'card'},budgets,[]),'card');
});
test('equal names never merge unrelated budget identities and paid editing cannot rename a transaction',()=>{
 const settings={months:{'2026-09':{settlements:[paid]}}};
 const changed=editPlanSettlement(settings,{...paid,name:'Attempted rename',amount:75});
 assert.equal(changed.months['2026-09'].settlements[0].name,'House');
 assert.equal(changed.months['2026-09'].settlements[0].amount,75);
 assert.equal(settings.months['2026-09'].settlements[0].amount,100);
 assert.equal(settlementName({...paid,targetId:'other'},budgets),'House');
});

test('a fully paid account never captures an invalid zero minimum cycle or loses an established obligation',async()=>{
 const {createDemoFixture}=await import('../mobile/demo-fixture.ts');
 const {captureMinimumCycles}=await import('../app/minimum-cycle.ts');
 const f=createDemoFixture().payload;const card={...f.accounts[0],balance:100,minimum:25};
 const payment={...f.transactions[0],accountId:card.id,amount:100};
 assert.equal(captureMinimumCycles([card],'2026-10-29',[payment])[0].minimumCycles,undefined);
 const established={...card,minimumCycles:[{date:'2026-10-25',amount:25}]};
 assert.deepEqual(captureMinimumCycles([established],'2026-10-29',[payment])[0].minimumCycles,established.minimumCycles);
});
