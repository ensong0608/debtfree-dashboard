import test from 'node:test';
import assert from 'node:assert/strict';
import {createDemoFixture} from '../mobile/demo-fixture.ts';
import {buildScopedProgressViews} from '../app/progress-view.ts';
import {buildActivePayoffCommitment} from '../app/payoff-commitment.ts';
import {fixedStrategySettings} from '../app/payoff-strategy.ts';
import {buildNextPayoffs} from '../app/next-payoff.ts';
import {appearanceTokens,THEMES,contrast} from '../app/appearance.ts';
const date=new Date('2026-10-28T12:00:00Z');
const loan=(kind,id,originalAmount,remainingAmount,payment)=>({id,name:id,kind,originalAmount,remainingAmount,balanceKind:'principal',asOf:'2026-10-01',budgetItemId:'',budgetItemName:'',apr:0,escrow:0,monthlyPayment:payment,history:[]});
test('Home and Auto views partition canonical starting/current totals including legacy auto accounts without mutating records',()=>{
 const f=createDemoFixture().payload;f.accounts.push({...f.accounts[1],id:'legacy',type:'Auto loan',balance:400,baselineBalance:1000});
 const loans=[loan('house','house',20000,10000,500),loan('car','car',5000,2000,200)];
 const before=JSON.stringify({f,loans});const views=buildScopedProgressViews({...f,adjustments:[],loans,date});
 assert.equal(views.home.summary.starting,20000);assert.equal(views.home.summary.current,10000);
 assert.equal(views.auto.summary.starting,6000);assert.equal(views.auto.summary.current,2400);
 assert.equal(views.accounts.summary.current+views.home.summary.current+views.auto.summary.current,views.household.summary.current);
 assert.equal(views.accounts.summary.starting+views.home.summary.starting+views.auto.summary.starting,views.household.summary.starting);
 assert.equal(JSON.stringify({f,loans}),before);
});
test('Next payoff uses earliest forecast month within each category and a separate regular mortgage schedule',()=>{
 const f=createDemoFixture().payload;const accounts=f.accounts.map((a,i)=>({...a,balance:i?200:1000,minimum:100}));
 const loans=[loan('house','house',20000,1000,500),loan('car','car',5000,2000,200),{...loan('car','removed',1000,500,100),removedAt:'2026-10-01'}];
 const settings={...f.monthlyPlan,payoffPlanStrategy:'avalanche',payoffExtraPayment:0};const active=buildActivePayoffCommitment(accounts,loans.filter(l=>!l.removedAt),[],fixedStrategySettings(settings),date);
 const before=JSON.stringify({accounts,loans,settings});const result=buildNextPayoffs(accounts,loans,[],settings,active.schedule,date);
 assert.equal(result.accounts[0].name,accounts[1].name);assert.ok(result.accounts[0].payoffMonth<=result.accounts[1].payoffMonth);
 assert.deepEqual(result.home.map(r=>r.id),['loan:house']);assert.ok(result.home[0].payoffMonth);
 assert.deepEqual(result.auto.map(r=>r.id),['loan:car']);assert.equal(result.auto[0].payoffMonth,active.schedule.payoffMonths['loan:car']);
 assert.equal(JSON.stringify({accounts,loans,settings}),before);
});
test('accent presets tint summaries and update default header colors while retaining readable text',()=>{
 for(const theme of ['light','dark']){
  const purple=theme==='light'?'#7040b4':'#a78bfa',teal=theme==='light'?'#007458':'#79ddbb';
  const a=appearanceTokens({...THEMES[theme],accent:purple}),b=appearanceTokens({...THEMES[theme],accent:teal});
  assert.equal(a['--theme-primary'],purple);assert.notEqual(a['--theme-gradient-start'],b['--theme-gradient-start']);
  assert.ok(contrast(a['--theme-on-primary'],a['--theme-primary'])>=4.5);
  for(const key of ['--theme-gradient-start','--theme-gradient-end'])assert.ok(contrast(a['--theme-on-gradient'],a[key])>=4.5);
 }
});
