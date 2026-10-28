import {test,expect,type Page} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import {createDemoFixture} from '../../mobile/demo-fixture';
import {DASHBOARD_STORAGE_KEY} from '../../app/data-repository';
import {APPEARANCE_KEY,APPEARANCE_EVENT,THEMES} from '../../app/appearance';
const nav=(page:Page)=>page.getByRole('navigation',{name:'Primary navigation'});
async function seed(page:Page,theme:'light'|'dark'){
 const fixture=createDemoFixture();
 fixture.payload.accounts[0]={...fixture.payload.accounts[0],name:'Everyday Rewards',balance:12345.67,baselineBalance:16000,apr:23.49};
 fixture.payload.accounts[1]={...fixture.payload.accounts[1],name:'Sample Travel',balance:5678.90,baselineBalance:6000,apr:25.74};
 fixture.payload.monthlyPlan!.loanTrackers=[{id:'car',name:'Sample Auto',kind:'car',originalAmount:25000,remainingAmount:18765.43,apr:5.85,monthlyPayment:400,balanceKind:'principal',asOf:'2026-10-01',budgetItemId:'',budgetItemName:'',history:[]},{id:'house',name:'Sample Mortgage',kind:'house',originalAmount:350000,remainingAmount:302345.67,apr:3.63,escrow:0,monthlyPayment:1800,balanceKind:'principal',asOf:'2026-10-01',budgetItemId:'',budgetItemName:'',history:[]}];
 await page.clock.setFixedTime(new Date('2026-10-28T01:00:00Z'));
 await page.addInitScript(({key,fixture,lookKey,look})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(fixture));localStorage.setItem(lookKey,JSON.stringify(look));},{key:DASHBOARD_STORAGE_KEY,fixture,lookKey:APPEARANCE_KEY,look:{...THEMES[theme],size:12}});
 await page.goto('/');await expect(page.locator('.home-welcome')).toBeVisible();await nav(page).getByRole('button',{name:'Debt',exact:true}).click();
}
async function size(page:Page,value:number){await page.evaluate(({key,event,value})=>{const next={...JSON.parse(localStorage.getItem(key)!),size:value};localStorage.setItem(key,JSON.stringify(next));window.dispatchEvent(new CustomEvent(event,{detail:next}));},{key:APPEARANCE_KEY,event:APPEARANCE_EVENT,value});await expect(page.locator('html')).toHaveAttribute('data-text-size',String(value));}
test.beforeEach(async({},info)=>expect(['localhost','127.0.0.1']).toContain(new URL(String(info.project.use.baseURL)).hostname));
for(const theme of ['light','dark'] as const)for(const width of [360,390])test(`Debt cards stay within their design at 9–16 pt in ${theme} at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:844});await seed(page,theme);
 for(const category of ['All','Cards & Loans','Home & Auto']){
  const filters=page.getByRole('navigation',{name:'Debt type filters'});await filters.getByRole('button',{name:new RegExp('^'+category.replace('&','&'))}).click();
  const summary=page.getByRole('region',{name:'Debt summary',exact:true});const cards=page.locator('[data-dialog-return-id]');await expect(cards.first()).toBeVisible();
  let baseline:unknown;let summaryBaseline:unknown;
  for(const point of [9,10,11,12,13,14,15,16]){
   await size(page,point);
   const summaryMetrics=await summary.evaluate(el=>({height:Math.round(el.getBoundingClientRect().height),fonts:[...el.querySelectorAll('strong,b,small')].map(n=>getComputedStyle(n).fontSize)}));
   const cardMetrics=await cards.evaluateAll(els=>els.map(el=>({height:Math.round(el.getBoundingClientRect().height),fonts:[...el.querySelectorAll('strong,small,time,[role=progressbar]')].map(n=>getComputedStyle(n).fontSize)})));
   if(!baseline){baseline=cardMetrics;summaryBaseline=summaryMetrics;}expect(cardMetrics).toEqual(baseline);expect(summaryMetrics).toEqual(summaryBaseline);
   for(const card of await cards.all()){
    const balance=card.locator('.money-value').first(),identity=card.locator('strong').first();const b=(await balance.boundingBox())!,i=(await identity.boundingBox())!,c=(await card.boundingBox())!;
    expect(i.x+i.width).toBeLessThanOrEqual(b.x+1);expect(b.x+b.width).toBeLessThan(c.x+c.width-8);
   }
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  mkdirSync('.wrangler/debt-card-text',{recursive:true});await page.screenshot({animations:'disabled',path:`.wrangler/debt-card-text/${theme}-${width}-${category.replaceAll(' ','-').replaceAll('&','and')}-16.png`});
 }
});
