import {test,expect,type Page,type Locator} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import {createDemoFixture} from '../../mobile/demo-fixture';
import {DASHBOARD_STORAGE_KEY} from '../../app/data-repository';
import {APPEARANCE_KEY,THEMES} from '../../app/appearance';
const nav=(page:Page)=>page.getByRole('navigation',{name:'Primary navigation'});
const settle=async(dialog:Locator)=>dialog.evaluate(async el=>{await Promise.all(el.getAnimations().map(a=>a.finished));});
async function seed(page:Page,theme:'light'|'dark',size=12){
 await page.clock.setFixedTime(new Date('2026-10-28T01:00:00Z'));
 const fixture=createDemoFixture();
 fixture.payload.monthlyBudgets['2026-10']=[{id:'bill',name:'Electric bill',kind:'expense',category:'Utilities',amount:40,paymentMethod:'debit',creditAccountId:'',recurring:true,createdAt:'2026-10-01T12:00:00Z'}];
 await page.addInitScript(({key,fixture,lookKey,look})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(fixture));localStorage.setItem(lookKey,JSON.stringify(look));},{key:DASHBOARD_STORAGE_KEY,fixture,lookKey:APPEARANCE_KEY,look:{...THEMES[theme],size}});
 await page.goto('/');await expect(page.locator('.home-welcome')).toBeVisible();
}
async function capture(page:Page,name:string){mkdirSync('.wrangler/form-layout',{recursive:true});await page.screenshot({animations:'disabled',path:`.wrangler/form-layout/${name}.png`});}
async function sameText(label:Locator,input:Locator){
 const a=await label.evaluate(el=>getComputedStyle(el).fontSize),b=await input.evaluate(el=>getComputedStyle(el).fontSize);expect(a).toBe(b);
}
async function keyboard(page:Page,height:number,offset=0){await page.evaluate(({height,offset})=>{Object.defineProperty(window.visualViewport!,'height',{configurable:true,get:()=>height});Object.defineProperty(window.visualViewport!,'offsetTop',{configurable:true,get:()=>offset});window.visualViewport!.dispatchEvent(new Event('resize'));},{height,offset});}
test.beforeEach(async({},info)=>expect(['localhost','127.0.0.1']).toContain(new URL(String(info.project.use.baseURL)).hostname));
for(const theme of ['light','dark'] as const)for(const size of [12,20]){
 test(`compact consistent forms and keyboard coverage in ${theme} at ${size} pt`,async({page})=>{
  await seed(page,theme,size);await nav(page).getByRole('button',{name:'Debt',exact:true}).click();await page.getByRole('button',{name:'Add debt',exact:true}).click();
  const debt=page.getByRole('dialog',{name:'Add Debt Account',exact:true});await settle(debt);
  const amount=debt.getByRole('textbox',{name:'Current balance',exact:true});
  const amountRow=debt.locator('.form-grid>label').filter({has:page.getByRole('textbox',{name:'Current balance',exact:true})});
  await sameText(amountRow.locator(':scope > span'),amount);
  const rowHeight=(await amountRow.boundingBox())!.height;expect(rowHeight).toBeLessThanOrEqual(size===12?60:100);
  const apr=debt.getByRole('textbox',{name:'APR',exact:true});await expect(apr).toHaveValue('');
  expect(await amount.evaluate(el=>getComputedStyle(el).fontWeight)).toBe('400');
  expect(await amountRow.locator('.field-input>b').evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThan(await amount.evaluate(el=>parseFloat(getComputedStyle(el).fontSize)));
  const dates=debt.locator('.date-calendar-field:visible').first();const dateBox=(await dates.boundingBox())!;const dateButton=(await dates.locator('button').boundingBox())!;expect(Math.abs(dateBox.x+dateBox.width-dateButton.x-dateButton.width)).toBeLessThan(2);
  const dateLabel=(await dates.locator('.date-field-label').boundingBox())!;expect(Math.abs(dateLabel.y+dateLabel.height/2-dateButton.y-dateButton.height/2)).toBeLessThan(3);
  await capture(page,`debt-${theme}-${size}`);
  await amount.focus();await keyboard(page,420,32);
  await expect(page.locator('html')).toHaveAttribute('data-dialog-keyboard','true');
  await expect.poll(async()=>Math.round((await debt.boundingBox())!.y+(await debt.boundingBox())!.height)).toBe(452);
  expect(await page.evaluate(()=>{const hit=document.elementFromPoint(195,448);return Boolean(hit?.closest('.app-sheet'));})).toBe(true);
  await capture(page,`keyboard-${theme}-${size}`);
  await keyboard(page,844);await debt.getByRole('button',{name:'Close account form',exact:true}).click();await expect(page.locator('html')).not.toHaveAttribute('data-dialog-open','true');
  await nav(page).getByRole('button',{name:'Budget',exact:true}).click();await page.getByRole('button',{name:'Add to Budget',exact:true}).click();await page.getByRole('group',{name:'Add to Budget'}).getByRole('button',{name:'Recurring spending',exact:true}).click();
  const budget=page.locator('.budget-entry-sheet:visible');await settle(budget);
  const monthly=budget.getByRole('textbox',{name:'Monthly amount',exact:true});const monthlyRow=budget.locator('.sheet-fields>label').filter({has:page.getByRole('textbox',{name:'Monthly amount',exact:true})});
  await sameText(monthlyRow.locator(':scope > span').first(),monthly);expect(Math.abs((await monthlyRow.boundingBox())!.height-rowHeight)).toBeLessThanOrEqual(4);
  await capture(page,`budget-${theme}-${size}`);await monthly.focus();await keyboard(page,420);await expect.poll(async()=>Math.round((await budget.boundingBox())!.y+(await budget.boundingBox())!.height)).toBe(420);await capture(page,`budget-keyboard-${theme}-${size}`);
  await keyboard(page,844);await budget.locator('header [data-dialog-close]').click();
  await nav(page).getByRole('button',{name:'Transactions',exact:true}).click();await page.getByRole('button',{name:'Add transaction',exact:true}).click();
  const transaction=page.getByRole('dialog',{name:'New transaction',exact:true});await settle(transaction);
  await sameText(transaction.locator('.signed-money > span').first(),transaction.getByRole('textbox',{name:'Transaction amount',exact:true}));
 });
}
for(const theme of ['light','dark'] as const)test(`Budget Summary icons and expanded items stay inset in ${theme}`,async({page})=>{
 await seed(page,theme);await nav(page).getByRole('button',{name:'Budget',exact:true}).click();
 const summary=page.getByRole('region',{name:'Budget Summary',exact:true});await expect(summary.getByRole('heading',{name:'Budget Summary',exact:true})).toBeVisible();
 const category=summary.locator('details').filter({has:page.locator('summary').filter({hasText:'Utilities'})}).first();
 const bounds=(await category.boundingBox())!;const icon=(await category.locator('summary>span').first().boundingBox())!;expect(icon.x-bounds.x).toBeGreaterThanOrEqual(12);
 await category.locator('summary').click();const bill=category.getByRole('button',{name:/Electric bill/});await expect(bill).toBeVisible();
 const child=(await bill.boundingBox())!;expect(child.x).toBeGreaterThan(bounds.x+16);expect(child.x+child.width).toBeLessThan(bounds.x+bounds.width-16);
 await capture(page,`budget-summary-${theme}`);
});
