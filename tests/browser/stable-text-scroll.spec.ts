import {test,expect,type Page,type Locator} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import {createDemoFixture} from '../../mobile/demo-fixture';
import {DASHBOARD_STORAGE_KEY} from '../../app/data-repository';
import {APPEARANCE_KEY,APPEARANCE_EVENT,THEMES} from '../../app/appearance';
const nav=(p:Page)=>p.getByRole('navigation',{name:'Primary navigation'});
async function seed(page:Page,theme:'light'|'dark'){
 await page.clock.setFixedTime(new Date('2026-10-28T01:00:00Z'));
 const fixture=createDemoFixture();fixture.payload.accounts[0].balance=14837.33;fixture.payload.accounts[0].baselineBalance=19000;
 fixture.payload.monthlyPlan!.loanTrackers=[{id:'home',name:'Sample mortgage',kind:'house',originalAmount:389504.38,remainingAmount:332922.71,apr:3.5,escrow:0,monthlyPayment:1000,balanceKind:'principal',asOf:'2026-10-01',dueDate:'2026-10-30',budgetItemId:'',budgetItemName:'',history:[]}];
 fixture.payload.monthlyBudgets['2026-10']=[{id:'income',name:'Salary',kind:'income',category:'Salary',amount:7800,paymentMethod:'debit',creditAccountId:'',recurring:true,createdAt:'2026-10-01T12:00:00Z'},{id:'bill',name:'Electric bill',kind:'expense',category:'Utilities',amount:40,paymentMethod:'debit',creditAccountId:'',recurring:true,createdAt:'2026-10-01T12:00:00Z'}];
 await page.addInitScript(({key,fixture,lookKey,look})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(fixture));localStorage.setItem(lookKey,JSON.stringify(look));},{key:DASHBOARD_STORAGE_KEY,fixture,lookKey:APPEARANCE_KEY,look:{...THEMES[theme],size:12}});
 await page.goto('/');await expect(page.locator('.home-welcome')).toBeVisible();
}
async function size(page:Page,value:number){await page.evaluate(({key,event,value})=>{const p=JSON.parse(localStorage.getItem(key)!);p.size=value;localStorage.setItem(key,JSON.stringify(p));window.dispatchEvent(new CustomEvent(event,{detail:p}));},{key:APPEARANCE_KEY,event:APPEARANCE_EVENT,value});await expect(page.locator('html')).toHaveAttribute('data-text-size',String(value));}
async function shot(page:Page,name:string){mkdirSync('.wrangler/stable-ui',{recursive:true});await page.screenshot({animations:'disabled',path:`.wrangler/stable-ui/${name}.png`});}
const rect=(l:Locator)=>l.boundingBox().then(b=>b!);
async function keyboard(page:Page,height:number,top:number){await page.evaluate(({height,top})=>{Object.defineProperty(window.visualViewport!,'height',{configurable:true,get:()=>height});Object.defineProperty(window.visualViewport!,'offsetTop',{configurable:true,get:()=>top});window.visualViewport!.dispatchEvent(new Event('resize'));},{height,top});}
async function fieldVisible(field:Locator,region:Locator){const f=await rect(field),r=await rect(region);expect(f.y).toBeGreaterThanOrEqual(r.y-1);expect(f.y+f.height).toBeLessThanOrEqual(r.y+r.height+1);}
test.beforeEach(async({},info)=>expect(['localhost','127.0.0.1']).toContain(new URL(String(info.project.use.baseURL)).hostname));
for(const theme of ['light','dark'] as const){
 test(`stable figures and navigation across 9–16 pt in ${theme}`,async({page})=>{
  await seed(page,theme);let homeFont='',navFont='';
  for(const point of [9,10,11,12,13,14,15,16]){
   await size(page,point);const slide=page.locator('[aria-roledescription=slide][aria-hidden=false]');const value=slide.locator('strong[data-large-value]').first();const f=await value.evaluate(el=>getComputedStyle(el).fontSize);homeFont ||= f;expect(f).toBe(homeFont);
   const n=await nav(page).getByRole('button',{name:'Debt',exact:true}).locator('span').last().evaluate(el=>getComputedStyle(el).fontSize);navFont ||= n;expect(n).toBe(navFont);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await shot(page,`home-${theme}-16`);
  await nav(page).getByRole('button',{name:'Progress',exact:true}).click();await page.getByRole('button',{name:'Next debt category',exact:true}).click();
  let progressFont='',tabFont='';
  for(const point of [9,12,16]){
   await size(page,point);const slide=page.locator('[aria-roledescription=slide][aria-hidden=false]');const value=slide.locator('strong[data-large-value]').first();expect(await value.textContent()).toContain('332,922.71');
   const f=await value.evaluate(el=>getComputedStyle(el).fontSize);progressFont ||= f;expect(f).toBe(progressFont);
   const ring=await rect(slide.getByRole('img').first()),amount=await rect(value),card=await rect(slide);expect(amount.x).toBeGreaterThanOrEqual(ring.x+ring.width);expect(amount.x+amount.width).toBeLessThanOrEqual(card.x+card.width);
   const t=await page.getByRole('button',{name:'Overview',exact:true}).evaluate(el=>getComputedStyle(el).fontSize);tabFont ||= t;expect(t).toBe(tabFont);
  }
  await shot(page,`progress-${theme}-16`);
  await nav(page).getByRole('button',{name:'Budget',exact:true}).click();let amounts:string[]=[];
  for(const point of [9,12,16]){await size(page,point);const fonts=await page.getByRole('region',{name:'Monthly budget summary'}).locator('.money-value').evaluateAll(els=>els.map(el=>getComputedStyle(el).fontSize));if(!amounts.length)amounts=fonts;expect(fonts).toEqual(amounts);}
  await shot(page,`budget-${theme}-16`);
  await page.getByRole('button',{name:'Open Settings',exact:true}).click();await page.getByRole('button',{name:/Text size/}).click();await expect(page.getByRole('combobox',{name:'Text size',exact:true}).locator('option')).toHaveText(['9 pt','10 pt','11 pt','12 pt','13 pt','14 pt','15 pt','16 pt']);
 });
 for(const kind of ['debt','budget'] as const)test(`fixed header/actions and visible typing with scroll and keyboard in ${theme} ${kind}`,async({page})=>{
  await seed(page,theme);await size(page,16);
  await nav(page).getByRole('button',{name:kind==='debt'?'Debt':'Budget',exact:true}).click();
  if(kind==='debt')await page.getByRole('button',{name:'Add debt',exact:true}).click();else{await page.getByRole('button',{name:'Add to Budget',exact:true}).click();await page.getByRole('group',{name:'Add to Budget'}).getByRole('button',{name:'Recurring spending',exact:true}).click();}
  const dialog=kind==='debt'?page.getByRole('dialog',{name:'Add Debt Account',exact:true}):page.getByRole('dialog',{name:'Add recurring spending',exact:true});
  await dialog.evaluate(async el=>{await Promise.all(el.getAnimations().map(a=>a.finished));});
  const region=dialog.locator(kind==='debt'?':scope > fieldset > .debt-action-form':':scope > .sheet-fields');const field=dialog.getByPlaceholder(kind==='debt'?'Name':'Electric bill',{exact:true});
  await field.fill('Typing remains visible');await keyboard(page,390,64);await expect(page.locator('html')).toHaveAttribute('data-dialog-keyboard','true');
  await expect.poll(async()=>Math.round((await rect(dialog)).y+(await rect(dialog)).height)).toBe(454);
  await expect.poll(()=>region.evaluate(el=>el.scrollHeight>el.clientHeight)).toBe(true);
  const header=dialog.locator(':scope > header'),footer=dialog.locator('.form-action-footer:visible').first();const h=await rect(header),f=await rect(footer),r=await rect(region);
  expect(r.y).toBeGreaterThanOrEqual(h.y+h.height);expect(r.y+r.height).toBeLessThanOrEqual(f.y+1);
  await fieldVisible(field,region);await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.wheel(0,400);await expect.poll(()=>region.evaluate(el=>el.scrollTop)).toBeGreaterThan(0);
  expect(Math.abs((await rect(header)).y-h.y)).toBeLessThan(1);expect(Math.abs((await rect(footer)).y-f.y)).toBeLessThan(1);expect(await dialog.evaluate(el=>el.scrollTop)).toBe(0);
  await page.keyboard.type(' after scrolling');await expect.poll(async()=>{const a=await rect(field),b=await rect(region);return a.y>=b.y-1&&a.y+a.height<=b.y+b.height+1;}).toBe(true);await expect(field).toHaveValue('Typing remains visible after scrolling');
  await shot(page,`${kind}-${theme}-keyboard`);
  for(const top of [0,92,24]){await keyboard(page,350,top);await expect.poll(async()=>Math.round((await rect(dialog)).y+(await rect(dialog)).height)).toBe(top+350);expect(await page.evaluate(({bottom})=>Boolean(document.elementFromPoint(195,bottom-2)?.closest('.app-sheet')),{bottom:top+350})).toBe(true);}
  await expect(page.locator('meta[name=viewport]')).toHaveAttribute('content',/interactive-widget=resizes-content/);
 });
}
test('Recent activity See all navigates to Transactions',async({page})=>{
 await seed(page,'light');const recent=page.locator('section').filter({has:page.getByRole('heading',{name:'Recent activity',exact:true})}).last();await recent.getByRole('button',{name:/See all/}).click();await expect(page.locator('.shared-dashboard-header')).toContainText('Transactions');await expect(page.getByRole('dialog',{name:'Recent activity',exact:true})).toHaveCount(0);
});
