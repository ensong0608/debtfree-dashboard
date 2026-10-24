import { test, expect } from '@playwright/test';
import { createDemoFixture } from '../../mobile/demo-fixture';
import { DASHBOARD_STORAGE_KEY } from '../../app/data-repository';
import { APPEARANCE_EVENT, APPEARANCE_KEY, THEMES } from '../../app/appearance';
import { householdDate } from '../../app/household-date';
const month=householdDate().slice(0,7);
const read=(page:import('@playwright/test').Page)=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).payload,DASHBOARD_STORAGE_KEY);
test.beforeEach(async({page})=>{
 const fixture=createDemoFixture();
 fixture.payload.monthlyBudgets[month]=[{id:'salary',name:'Salary',kind:'income',category:'Salary',amount:2000,paymentMethod:'debit',creditAccountId:'',createdAt:month+'-01T12:00:00Z',recurring:true},{id:'power',name:'Power bill',kind:'expense',category:'Utilities',amount:100,paymentMethod:'debit',creditAccountId:'',createdAt:month+'-01T12:00:00Z',recurring:true}];
 fixture.payload.monthlyPlan!.loanTrackers=[{id:'house',name:'Sample house',kind:'house',originalAmount:10000,remainingAmount:8000,balanceKind:'principal',asOf:month+'-01',budgetItemId:'',budgetItemName:'',apr:5,escrow:100,monthlyPayment:500,history:[]},{id:'auto',name:'Sample auto',kind:'car',originalAmount:5000,remainingAmount:3000,balanceKind:'principal',asOf:month+'-01',budgetItemId:'',budgetItemName:'',apr:5,monthlyPayment:200,history:[]}];
 await page.addInitScript(({key,fixture})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(fixture));},{key:DASHBOARD_STORAGE_KEY,fixture});
 await page.goto('/');await expect(page.getByRole('heading',{name:/Welcome,/})).toBeVisible();await expect.poll(async()=>(await read(page)).snapshots.some((s:{autoCheckpoint?:string})=>Boolean(s.autoCheckpoint))).toBe(true);
});
test('compact themed screens, carousel selection, fixed categories and retained data at phone and desktop widths',async({page})=>{
 const before=await read(page), nav=page.getByRole('navigation',{name:'Primary navigation'});
 for(const [theme,value] of Object.entries(THEMES)) {
  await page.evaluate(({key,event,value})=>{localStorage.setItem(key,JSON.stringify(value));window.dispatchEvent(new CustomEvent(event,{detail:value}));},{key:APPEARANCE_KEY,event:APPEARANCE_EVENT,value:{...value,size:'larger'}});
  for(const width of [320,390,430,1440]) {
   await page.setViewportSize({width,height:1000});await nav.getByRole('button',{name:'Home',exact:true}).click();
   await expect(page.getByRole('button',{name:'Open Tools',exact:true})).toHaveCount(0);
   if(width===390)await page.screenshot({path:`outputs/refinement/home-${theme}.png`,fullPage:true});
   const carousel=page.getByRole('region',{name:'Debt progress scope',exact:true});
   await carousel.getByRole('button',{name:'Show All',exact:true}).click();await expect(carousel.getByRole('button',{name:'Show All',exact:true})).toHaveAttribute('aria-current','page');
   await carousel.getByRole('button',{name:'Show Cards & Loans',exact:true}).click();
   const viewport=carousel.locator('[tabindex="0"]');await viewport.evaluate(el=>{el.scrollLeft=el.clientWidth;el.dispatchEvent(new Event('scrollend'));});await expect(carousel.getByRole('button',{name:'Show House & Auto',exact:true})).toHaveAttribute('aria-current','page');
   await nav.getByRole('button',{name:'Debt',exact:true}).click();await expect(page.getByRole('navigation',{name:'Household group filters'})).toHaveCount(0);await expect(page.getByRole('region',{name:'Debt summary'})).not.toContainText('Average APR');
   await page.getByRole('navigation',{name:'Debt type filters'}).getByRole('button',{name:/House & auto/}).click();await expect(page.getByRole('button',{name:/^Open Sample (house|auto)$/})).toHaveCount(2);
   if(width===390)await page.screenshot({path:`outputs/refinement/debt-${theme}.png`,fullPage:true});
   await nav.getByRole('button',{name:'Progress',exact:true}).click();await expect(page.getByRole('navigation',{name:'Progress sections'}).getByRole('button')).toHaveText(['Overview','Utilization','Milestones']);await expect(page.getByRole('button',{name:/Save snapshot|Update this month/})).toHaveCount(0);
   await expect(page.getByRole('heading',{name:'Progress by category'})).toBeVisible();
   if(width===390)await page.screenshot({path:`outputs/refinement/progress-${theme}.png`,fullPage:true});
   await page.getByRole('navigation',{name:'Progress sections'}).getByRole('button',{name:'Utilization',exact:true}).click();await expect(page.getByText('Used credit',{exact:true})).toBeVisible();
   await nav.getByRole('button',{name:'Budget',exact:true}).click();await expect(page.getByRole('region',{name:'Monthly budget summary'})).toContainText('$2,000.00');await expect(page.getByRole('button',{name:'Income +',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'One-off +',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Add to Utilities',exact:true}).first()).toBeVisible();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
   if(width===390)await page.screenshot({path:`outputs/refinement/budget-${theme}.png`,fullPage:true});
  }
 }
 const after=await read(page);for(const key of ['accounts','transactions','balanceAdjustments','snapshots','monthlyBudgets'])expect(after[key]).toEqual(before[key]);expect(after.monthlyPlan.progressStartingBalance).toBe(before.monthlyPlan.progressStartingBalance);
});
test('due-day editing marks current recurring Budget item Paid once, reload preserves records, Undo stays undone',async({page})=>{
 const before=await read(page),nav=page.getByRole('navigation',{name:'Primary navigation'});await nav.getByRole('button',{name:'Budget',exact:true}).click();
 await page.locator('summary').filter({hasText:'Utilities'}).click();await page.getByRole('button',{name:/Power bill/}).click();
 const form=page.getByRole('dialog',{name:'Power bill',exact:true});await form.getByLabel('Monthly due day').selectOption('1');await form.getByRole('button',{name:'Save changes',exact:true}).click();
 await expect.poll(async()=>(await read(page)).monthlyPlan.months[month].settlements?.length??0).toBe(1);
 await page.getByRole('navigation',{name:'Budget sections'}).getByRole('button',{name:'Transactions',exact:true}).click();await expect(page.getByRole('region',{name:'Budget paid activity'})).toContainText('Power bill');await expect(page.getByRole('region',{name:'Budget paid activity'})).toContainText('Paid');await expect(page.getByRole('heading',{name:'Recorded loan payments'})).toHaveCount(0);
 await page.reload();await nav.getByRole('button',{name:'Budget',exact:true}).click();await page.getByRole('navigation',{name:'Budget sections'}).getByRole('button',{name:'Transactions',exact:true}).click();await expect(page.getByRole('button',{name:'Undo paid record for Power bill',exact:true})).toHaveCount(1);await page.getByRole('button',{name:'Undo paid record for Power bill',exact:true}).click();await expect.poll(async()=>(await read(page)).monthlyPlan.months[month].settlements?.length??0).toBe(0);
 await page.reload();await expect.poll(async()=>(await read(page)).monthlyPlan.months[month].settlements?.length??0).toBe(0);const after=await read(page);for(const key of ['accounts','transactions','balanceAdjustments','snapshots'])expect(after[key]).toEqual(before[key]);expect(after.monthlyPlan.loanTrackers).toEqual(before.monthlyPlan.loanTrackers);
});
