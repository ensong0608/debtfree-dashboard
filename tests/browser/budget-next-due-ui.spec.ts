import {mkdirSync} from 'node:fs';
import {test,expect,type Page} from '@playwright/test';
import {createDemoFixture} from '../../mobile/demo-fixture';
import {DASHBOARD_STORAGE_KEY} from '../../app/data-repository';
import type {DashboardPayload,MonthlyPlanMonth,LedgerTransaction} from '../../app/dashboard-data';
import {transactionAdjustedAccounts} from '../../app/progress-balances';
import {APPEARANCE_KEY,THEMES} from '../../app/appearance';
const saved=(page:Page):Promise<DashboardPayload>=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).payload,DASHBOARD_STORAGE_KEY);
const nav=(page:Page)=>page.getByRole('navigation',{name:'Primary navigation'});
async function seed(page:Page){
 await page.clock.setFixedTime(new Date('2026-10-10T20:00:00Z'));
 const fixture=createDemoFixture();
 fixture.payload.accounts.forEach(account=>{account.dueDate='2026-10-30';});
 fixture.payload.monthlyBudgets['2026-10']=[{id:'bill',name:'Sample bill',kind:'expense',category:'Utilities',amount:30,paymentMethod:'debit',creditAccountId:'',recurring:true,dueDay:25,createdAt:'2026-10-01T12:00:00Z'}];
 await page.addInitScript(({key,fixture,appearanceKey,appearance})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(fixture));if(!localStorage.getItem(appearanceKey))localStorage.setItem(appearanceKey,JSON.stringify(appearance));},{key:DASHBOARD_STORAGE_KEY,fixture,appearanceKey:APPEARANCE_KEY,appearance:THEMES.light});
 await page.goto('/');await expect(page.locator('.home-welcome')).toBeVisible();
}
test.beforeEach(async({},info)=>{expect(['localhost','127.0.0.1']).toContain(new URL(String(info.project.use.baseURL)).hostname);});
test('Budget replaces Transactions with all Next Due and records then pairs a bill once',async({page})=>{
 await seed(page);const before=await saved(page);
 await expect(page.getByRole('region',{name:'Dashboard content'}).getByRole('heading',{name:'Next Due',exact:true})).toHaveCount(0);
 await nav(page).getByRole('button',{name:'Budget',exact:true}).click();
 const tabs=page.getByRole('navigation',{name:'Budget sections'});await expect(tabs.getByRole('button')).toHaveText(['Planned','Next Due','Strategy']);
 await tabs.getByRole('button',{name:'Next Due',exact:true}).click();
 await expect(page.getByRole('button',{name:/View Sample bill,/})).toBeVisible();
 await expect(page.getByRole('button',{name:/View Sample card,/})).toBeVisible();
 await page.getByRole('button',{name:'Add to Budget',exact:true}).click();await page.getByRole('button',{name:'Record bill payment',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Record bill payment',exact:true});await dialog.getByRole('button',{name:'Save',exact:true}).click();
 await page.getByRole('button',{name:'Record or link payment for Sample bill',exact:true}).click();
 await page.getByRole('dialog',{name:'Pair bill transaction',exact:true}).getByRole('button',{name:/Sample bill.*Budget paid record/}).click();
 await expect.poll(async()=>Object.values((await saved(page)).monthlyPlan!.months).flatMap((month:MonthlyPlanMonth)=>month.settlements??[]).length).toBe(1);
 const after=await saved(page);expect(after.accounts).toEqual(before.accounts);expect(after.transactions).toEqual(before.transactions);
 expect(after.monthlyPlan!.duePaymentAssociations).toHaveLength(1);
 await page.reload();await nav(page).getByRole('button',{name:'Budget',exact:true}).click();await page.getByRole('button',{name:'Add to Budget',exact:true}).click();await page.getByRole('button',{name:'Income',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'Add income',exact:true}).getByText('One time',{exact:true})).toBeVisible();
 await expect(page.getByRole('dialog',{name:'Add income',exact:true}).getByText('One time purchase',{exact:true})).toHaveCount(0);
});
test('Debt transaction categories keep amounts unsigned and apply the right direction once',async({page})=>{
 await seed(page);await nav(page).getByRole('button',{name:'Debt',exact:true}).click();await page.getByRole('button',{name:'Open Sample card',exact:true}).click();
 await page.getByRole('tab',{name:'Transactions',exact:true}).click();
 const add=page.getByRole('button',{name:'Add transaction',exact:true});await expect(add).toHaveCSS('position','fixed');const box=await add.boundingBox();expect(box!.width).toBe(64);
 const before=await saved(page);
 for(const [category,amount] of [['purchase','20'],['payment','10'],['credit','5'],['interest','2'],['fee','1']] as const){
  await add.click();const dialog=page.getByRole('dialog',{name:'New transaction',exact:true});await expect(dialog.getByLabel('Increase debt')).toHaveCount(0);await expect(dialog.getByLabel('What’s it for?')).toHaveCount(0);
  await expect(dialog.getByLabel('Transaction category',{exact:true}).locator('option')).toHaveText(['Payment','Refund/Credit','Purchase','Interest','Annual fee']);await dialog.getByLabel('Transaction category',{exact:true}).selectOption(category);await dialog.getByRole('textbox',{name:'Transaction amount',exact:true}).fill(amount);await dialog.getByRole('button',{name:'Save',exact:true}).click();await expect(dialog).toHaveCount(0);
 }
 const after=await saved(page);const rows=after.transactions.slice(before.transactions.length);expect(rows.map((row:LedgerTransaction)=>row.amount)).toEqual([20,10,5,2,1]);expect(rows.map((row:LedgerTransaction)=>row.type)).toEqual(['charge','payment','payment','fee','fee']);expect(rows[2].credit).toBe(true);expect(transactionAdjustedAccounts(after.accounts,after.transactions).find(account=>account.id==='demo-card')!.balance - transactionAdjustedAccounts(before.accounts,before.transactions).find(account=>account.id==='demo-card')!.balance).toBe(8);
 await page.reload();await nav(page).getByRole('button',{name:'Debt',exact:true}).click();await page.getByRole('button',{name:'Open Sample card',exact:true}).click();await page.getByRole('tab',{name:'Transactions',exact:true}).click();await expect(page.getByText('Purchase',{exact:true}).first()).toBeVisible();
});
test('navigation, shared controls, Strategy surfaces and soft Budget colors match on phones',async({page})=>{
 await seed(page);mkdirSync('.wrangler/control-polish',{recursive:true});
 for(const theme of ['light','dark'] as const){
  await page.evaluate(({key,value})=>localStorage.setItem(key,JSON.stringify(value)),{key:APPEARANCE_KEY,value:THEMES[theme]});await page.reload();
  await expect(nav(page).getByRole('button')).toHaveText(['Home','Debt','Transactions','Budget','Progress']);
  await expect(page.getByRole('button',{name:'Open Settings',exact:true})).toHaveCount(0);
  for(const width of [320,390,430]){
   await page.setViewportSize({width,height:844});
   const controls=async(label:string)=>page.getByRole('navigation',{name:label}).evaluate(element=>{
    const style=getComputedStyle(element),selected=element.querySelector('[aria-pressed=true],[aria-current=page]')!;const active=getComputedStyle(selected);const button=getComputedStyle(element.querySelector('button')!);
    return {display:style.display,padding:style.padding,border:style.border,borderRadius:style.borderRadius,background:style.backgroundColor,gap:style.gap,font:button.fontSize,buttonHeight:button.minHeight,buttonRadius:button.borderRadius,selectedBackground:active.backgroundColor,selectedColor:active.color};
   });
   const fab=async(label:string)=>{const button=page.getByRole('button',{name:label,exact:true});await expect(button).toHaveCSS('position','fixed');const rect=await button.boundingBox();expect(rect!.width).toBe(64);expect(rect!.height).toBe(64);expect(width-rect!.x-rect!.width).toBeCloseTo(16,0);return rect;};
   await nav(page).getByRole('button',{name:'Budget',exact:true}).click();const budgetStyle=await controls('Budget sections');const budgetFab=await fab('Add to Budget');
   const navigationTop=await page.locator('.sidebar').evaluate(element=>element.getBoundingClientRect().top);expect(navigationTop-budgetFab!.y-budgetFab!.height).toBeCloseTo(16,0);
   await page.getByRole('button',{name:'Add to Budget',exact:true}).click();await expect(page.getByRole('group',{name:'Add to Budget',exact:true})).toBeVisible();await page.getByRole('button',{name:'Close Budget actions',exact:true}).click();
   if(width===390){await page.screenshot({path:`.wrangler/control-polish/${theme}-budget.png`});await page.getByRole('navigation',{name:'Budget sections'}).getByRole('button',{name:'Strategy',exact:true}).click();await expect(page.locator('.strategy-config-card')).toHaveCSS('border-top-width','0px');await expect(page.locator('.strategy-choice').first()).toHaveCSS('background-color','rgba(0, 0, 0, 0)');await page.screenshot({path:`.wrangler/control-polish/${theme}-strategy.png`});await page.getByRole('navigation',{name:'Budget sections'}).getByRole('button',{name:'Planned',exact:true}).click();}
   await nav(page).getByRole('button',{name:'Debt',exact:true}).click();expect(await controls('Debt type filters')).toEqual(budgetStyle);expect(await fab('Add debt')).toEqual(budgetFab);
   if(width===390)await page.screenshot({path:`.wrangler/control-polish/${theme}-debt.png`});
   await page.getByRole('button',{name:'Open Sample card',exact:true}).click();await page.getByRole('tab',{name:'Transactions',exact:true}).click();expect(await fab('Add transaction')).toEqual(budgetFab);
   if(width===390)await page.screenshot({path:`.wrangler/control-polish/${theme}-account-transactions.png`});
   await page.getByRole('button',{name:'Back from Sample card',exact:true}).click();await nav(page).getByRole('button',{name:'Progress',exact:true}).click();expect(await controls('Progress sections')).toEqual(budgetStyle);
   if(width===390)await page.screenshot({path:`.wrangler/control-polish/${theme}-progress.png`});
   await page.getByRole('button',{name:'Open Settings',exact:true}).click();await expect(page.getByRole('button',{name:'Close Settings',exact:true})).toBeVisible();await page.getByRole('button',{name:'Close Settings',exact:true}).click();await expect(page.getByRole('navigation',{name:'Progress sections'})).toBeVisible();
   await nav(page).getByRole('button',{name:'Transactions',exact:true}).click();await expect(page.locator('.shared-dashboard-header h1')).toBeVisible();expect(await fab('Add transaction')).toEqual(budgetFab);await expect(page.getByRole('button',{name:'Open Settings',exact:true})).toBeVisible();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
 }
});
test('Home Next Due See all opens Budget Next Due instead of expanding Home',async({page})=>{
 await seed(page);await page.clock.setFixedTime(new Date('2026-10-24T20:00:00Z'));await page.reload();
 const reminder=page.getByRole('region',{name:'Dashboard content'}).getByRole('region',{name:'Upcoming due reminders'});
 await reminder.getByRole('button',{name:/See all/}).click();await expect(page.getByRole('navigation',{name:'Budget sections'}).getByRole('button',{name:'Next Due',exact:true})).toHaveAttribute('aria-pressed','true');await expect(page.getByRole('region',{name:'Next Due',exact:true})).toBeVisible();
});
