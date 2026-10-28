import {test,expect,type Page} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import {createDemoFixture} from '../../mobile/demo-fixture';
import {DASHBOARD_STORAGE_KEY} from '../../app/data-repository';
import {APPEARANCE_KEY,THEMES} from '../../app/appearance';
const nav=(p:Page)=>p.getByRole('navigation',{name:'Primary navigation'});
const saved=(p:Page)=>p.evaluate(key=>JSON.parse(localStorage.getItem(key)!).payload,DASHBOARD_STORAGE_KEY);
async function seed(page:Page){
 await page.clock.setFixedTime(new Date('2026-10-28T01:00:00Z'));
 const fixture=createDemoFixture();
 fixture.payload.accounts[0].name='chase prime';
 const template=fixture.payload.accounts[1];
 fixture.payload.accounts.push({...template,id:'paid',name:'Paid card',balance:0},{...template,id:'archived',name:'Archived card',archivedAt:'2026-10-27T12:00:00Z'});
 fixture.payload.monthlyPlan!.removedProgressAccounts=[{id:'deleted',name:'Deleted test',balance:50,baselineBalance:100,removedAt:'2026-10-27T12:00:00Z'}];
 fixture.payload.monthlyPlan!.progressStartingBalance=2100;
 await page.addInitScript(({fixture,key,appearanceKey,theme})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(fixture));if(!localStorage.getItem(appearanceKey))localStorage.setItem(appearanceKey,JSON.stringify(theme));},{fixture,key:DASHBOARD_STORAGE_KEY,appearanceKey:APPEARANCE_KEY,theme:THEMES.dark});
 await page.goto('/');await expect(page.locator('.home-welcome')).toBeVisible();
}
async function settings(page:Page){await nav(page).getByRole('button',{name:'Debt',exact:true}).click();await page.getByRole('button',{name:'Open Settings',exact:true}).click();}
test.beforeEach(async({},info)=>expect(['localhost','127.0.0.1']).toContain(new URL(String(info.project.use.baseURL)).hostname));
test('add debt zeros are placeholders and dropdowns use capitalized display labels',async({page})=>{
 await seed(page);await nav(page).getByRole('button',{name:'Debt',exact:true}).click();await page.getByRole('button',{name:'Add debt',exact:true}).click();
 const sheet=page.getByRole('dialog',{name:'Add Debt Account',exact:true});
 for(const label of ['Current balance','APR','Estimated minimum *'])await expect(sheet.getByRole('textbox',{name:label,exact:true})).toHaveValue('');
 await expect(sheet.getByRole('combobox').locator('option').filter({hasText:'Credit Card'})).toHaveAttribute('value','Credit card');
 await sheet.getByRole('textbox',{name:'Current balance',exact:true}).fill('12.50');await expect(sheet.getByRole('textbox',{name:'Current balance',exact:true})).toHaveValue('12.50');
 mkdirSync('.wrangler/debt-cleanup',{recursive:true});await page.screenshot({path:'.wrangler/debt-cleanup/add-debt.png'});
});
test('new transaction and Progress rows exclude paid, archived and removed debts',async({page})=>{
 await seed(page);await nav(page).getByRole('button',{name:'Transactions',exact:true}).click();
 await page.getByRole('button',{name:'Add transaction',exact:true}).click();
 const sheet=page.getByRole('dialog',{name:'New transaction',exact:true});
 await expect(sheet.getByRole('combobox',{name:'Debt account'}).locator('option')).toHaveText(['Chase Prime','Sample Travel']);
 await sheet.getByRole('button',{name:'Back from transaction'}).click();
 await nav(page).getByRole('button',{name:'Progress',exact:true}).click();
 const rows=page.getByRole('region',{name:'Account balance changes'});
 await expect(rows).toContainText('chase prime');await expect(rows).not.toContainText(/Paid card|Archived card|Deleted test/);
});
test('permanent deletion cancels safely, then clears removed account records across reload',async({page})=>{
 await seed(page);await settings(page);await page.getByRole('button',{name:'Debt history',exact:true}).click();
 await page.getByRole('button',{name:'Delete Deleted test and history',exact:true}).click();
 const confirm=page.getByRole('dialog',{name:'Delete account & history?',exact:true});
 await confirm.getByRole('button',{name:'Cancel',exact:true}).click();expect((await saved(page)).monthlyPlan.removedProgressAccounts).toHaveLength(1);
 await page.getByRole('button',{name:'Delete Deleted test and history',exact:true}).click();await confirm.getByRole('button',{name:'Delete account & history',exact:true}).click();
 await expect.poll(async()=>(await saved(page)).monthlyPlan.removedProgressAccounts.length).toBe(0);
 expect((await saved(page)).monthlyPlan.progressStartingBalance).toBe(2100);
 await page.getByRole('button',{name:'Delete chase prime and history',exact:true}).click();await confirm.getByRole('button',{name:'Delete account & history',exact:true}).click();
 await expect.poll(async()=>(await saved(page)).accounts.some((a:{id:string})=>a.id==='demo-card')).toBe(false);
 expect((await saved(page)).transactions.some((t:{accountId:string})=>t.accountId==='demo-card')).toBe(false);
 await page.reload();await expect(page.locator('.home-welcome')).toBeVisible();expect((await saved(page)).accounts.some((a:{id:string})=>a.id==='demo-card')).toBe(false);
});
test('Appearance autosaves all controls, has no save/cancel, and persists 9–15 pt',async({page})=>{
 await seed(page);await settings(page);await page.getByRole('button',{name:/Text size/}).click();
 const board=page.getByRole('region',{name:'Appearance settings'});
 await expect(board.getByRole('button',{name:/Save changes|Cancel/})).toHaveCount(0);
 const size=board.getByRole('combobox',{name:'Text size',exact:true});await expect(size.locator('option')).toHaveText(['9 pt','10 pt','11 pt','12 pt','13 pt','14 pt','15 pt']);
 await size.selectOption('15');expect((await size.boundingBox())!.width).toBeGreaterThan(150);await board.getByRole('button',{name:'Purple',exact:true}).click();
 await expect.poll(()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).size,APPEARANCE_KEY)).toBe(15);
 await expect.poll(()=>page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--theme-text-scale'))).toBe('1.25');
 mkdirSync('.wrangler/debt-cleanup',{recursive:true});await page.screenshot({path:'.wrangler/debt-cleanup/appearance.png'});
 await page.reload();await expect(page.locator('.home-welcome')).toBeVisible();
 expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).accent,APPEARANCE_KEY)).toBe('#a78bfa');
 await settings(page);await page.getByRole('button',{name:/Text size/}).click();await expect(page.getByRole('combobox',{name:'Text size',exact:true})).toHaveValue('15');
});
