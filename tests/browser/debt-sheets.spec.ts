import {mkdirSync} from 'node:fs';
import {test,expect,type Page} from '@playwright/test';
import {createDemoFixture} from '../../mobile/demo-fixture';
import {DASHBOARD_STORAGE_KEY} from '../../app/data-repository';
import {APPEARANCE_KEY,THEMES} from '../../app/appearance';
import type {DashboardPayload} from '../../app/dashboard-data';
const saved=(page:Page):Promise<DashboardPayload>=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).payload,DASHBOARD_STORAGE_KEY);
async function seed(page:Page){
 await page.clock.setFixedTime(new Date('2026-10-27T20:00:00Z'));
 const fixture=createDemoFixture();
 fixture.payload.monthlyPlan!.loanTrackers=[{id:'house',name:'Sample house',kind:'house',originalAmount:100000,remainingAmount:80000,apr:3.5,escrow:0,monthlyPayment:1000,balanceKind:'principal',asOf:'2026-10-01',dueDate:'2026-10-30',budgetItemId:'',budgetItemName:'',history:[{date:'2026-10-20',amount:80000,balanceKind:'principal',recordedAt:'2026-10-20T20:00:00Z',payment:1000,principal:700,interest:300}]},{id:'auto',name:'Sample auto',kind:'car',originalAmount:20000,remainingAmount:15000,apr:6,monthlyPayment:500,balanceKind:'principal',asOf:'2026-10-01',budgetItemId:'',budgetItemName:'',history:[]}];
 await page.addInitScript(({key,fixture,appearanceKey,appearance})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(fixture));localStorage.setItem(appearanceKey,JSON.stringify(appearance));},{key:DASHBOARD_STORAGE_KEY,fixture,appearanceKey:APPEARANCE_KEY,appearance:THEMES.light});
 await page.goto('/');await expect(page.locator('.home-welcome')).toBeVisible();
 await page.getByRole('navigation',{name:'Primary navigation'}).getByRole('button',{name:'Debt',exact:true}).click();
}
test.beforeEach(async({},info)=>expect(['localhost','127.0.0.1']).toContain(new URL(String(info.project.use.baseURL)).hostname));
async function screenshot(page:Page,name:string){const active=page.locator('[role=dialog]:visible').last();await expect(active.locator(':scope > .sheet-handle')).toBeVisible();expect((await active.boundingBox())!.y).toBeGreaterThanOrEqual(16);mkdirSync('.wrangler/control-polish',{recursive:true});await page.screenshot({animations:'disabled',path:`.wrangler/control-polish/${name}.png`});}
test('unified add sheet switches loan contents inline, calendar works and saves Auto loan',async({page})=>{
 await seed(page);await page.getByRole('button',{name:'Add debt',exact:true}).click();
 const sheet=page.getByRole('dialog',{name:'Add Debt Account',exact:true});await expect(sheet.locator('.sheet-handle')).toBeVisible();
 await sheet.getByPlaceholder('Name',{exact:true}).fill('New auto');await sheet.getByRole('combobox').first().selectOption('Auto loan');
 await expect(sheet).toHaveCount(1);await expect(sheet.getByRole('heading',{name:'Add Debt Account'})).toBeVisible();await expect(sheet.getByRole('textbox',{name:'Account',exact:true})).toHaveValue('New auto');
 await sheet.getByRole('combobox').selectOption('House loan');await expect(sheet.getByRole('textbox',{name:'Escrow amount',exact:true})).toBeVisible();await sheet.getByRole('combobox').selectOption('Auto loan');await expect(sheet.getByRole('textbox',{name:'Escrow amount',exact:true})).toHaveCount(0);
 await sheet.getByRole('textbox',{name:'Original balance',exact:true}).fill('20000');await sheet.getByRole('textbox',{name:'Current balance',exact:true}).fill('15000');await sheet.getByRole('textbox',{name:'APR (optional)',exact:true}).fill('6');await sheet.getByRole('textbox',{name:'Minimum payment',exact:true}).fill('500');
 await expect(sheet.locator('.date-field-trigger:visible svg')).toBeVisible();await sheet.locator('.date-field-trigger:visible').click();const calendar=page.getByRole('dialog',{name:'Due date',exact:true});await calendar.getByRole('button',{name:'2026-10-30',exact:true}).click();await calendar.getByRole('button',{name:'Confirm date',exact:true}).click();await expect(calendar).toHaveCount(0);
 await screenshot(page,'add-debt-sheet');await sheet.getByRole('button',{name:'Save',exact:true}).click();await expect(sheet).toHaveCount(0);await expect.poll(async()=>(await saved(page)).monthlyPlan?.loanTrackers?.some(loan=>loan.name==='New auto'&&loan.kind==='car'&&loan.monthlyPayment===500)).toBe(true);
});
test('account sheets use Detail, close on swipe and protect unsaved edits',async({page})=>{
 await seed(page);await page.getByRole('button',{name:'Open Sample card',exact:true}).click();const sheet=page.getByRole('dialog',{name:'Sample card',exact:true});await expect(sheet.getByRole('tab',{name:'Detail',exact:true})).toBeVisible();await screenshot(page,'debt-account-sheet');
 const handle=sheet.locator('.sheet-handle');const box=(await handle.boundingBox())!;await page.mouse.move(box.x+box.width/2,box.y+10);await page.mouse.down();await page.mouse.move(box.x+box.width/2,box.y+135,{steps:8});await page.mouse.up();await expect(sheet).toHaveCount(0);
 await page.getByRole('button',{name:'Open Sample card',exact:true}).click();await sheet.getByRole('tab',{name:'Detail',exact:true}).click();await sheet.getByRole('textbox',{name:'Minimum payment',exact:true}).fill('75');await sheet.getByRole('button',{name:'Close Sample card',exact:true}).click();await expect(page.getByRole('dialog').last()).toContainText(/unsaved|Save changes/i);await expect.poll(async()=>(await saved(page)).accounts[0].minimum).toBe(25);
});
test('mortgage and Auto loan delete require confirmation and retain payment history across reload',async({page})=>{
 await seed(page);const before=await saved(page);
 for(const name of ['Sample house','Sample auto']){
  await page.getByRole('button',{name:`Open ${name}`,exact:true}).click();const sheet=page.getByRole('dialog',{name,exact:true});await sheet.getByRole('button',{name:'Delete account',exact:true}).click();const confirm=page.getByRole('dialog',{name:'Delete debt account?',exact:true});await confirm.getByRole('button',{name:'Cancel',exact:true}).click();await expect(sheet).toBeVisible();await sheet.getByRole('button',{name:'Delete account',exact:true}).click();await confirm.getByRole('button',{name:'Delete account',exact:true}).click();await expect(sheet).toHaveCount(0);await expect(page.getByRole('button',{name:`Open ${name}`,exact:true})).toHaveCount(0);
 }
 await expect.poll(async()=>(await saved(page)).monthlyPlan!.loanTrackers!.filter(loan=>loan.removedAt).length).toBe(2);
 const after=await saved(page);expect(after.monthlyPlan!.loanTrackers![0].history).toEqual(before.monthlyPlan!.loanTrackers![0].history);expect(after.transactions).toEqual(before.transactions);expect(after.monthlyPlan!.progressStartingBalance).toBe(before.monthlyPlan!.progressStartingBalance);
 await page.reload();await expect(page.locator('.home-welcome')).toBeVisible();await page.getByRole('navigation',{name:'Primary navigation'}).getByRole('button',{name:'Transactions',exact:true}).click();await expect(page.getByText('Sample house',{exact:true}).first()).toBeVisible();
});
test('transaction composer uses the same sheet and records its selected category',async({page})=>{
 await seed(page);await page.getByRole('navigation',{name:'Primary navigation'}).getByRole('button',{name:'Transactions',exact:true}).click();await page.getByRole('button',{name:'Add transaction',exact:true}).click();const sheet=page.getByRole('dialog',{name:'New transaction',exact:true});await expect(sheet.locator('.sheet-handle')).toBeVisible();await sheet.getByRole('combobox',{name:'Transaction category',exact:true}).selectOption('purchase');await sheet.getByRole('textbox',{name:'Transaction amount',exact:true}).fill('15');await screenshot(page,'transaction-sheet');await sheet.getByRole('button',{name:'Save',exact:true}).click();await expect(sheet).toHaveCount(0);await expect.poll(async()=>(await saved(page)).transactions.some(t=>t.type==='charge'&&t.amount===15)).toBe(true);
});
