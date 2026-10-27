import {test,expect,type Page} from '@playwright/test';
import {createDemoFixture} from '../../mobile/demo-fixture';
import {DASHBOARD_STORAGE_KEY} from '../../app/data-repository';
import type {DashboardPayload} from '../../app/dashboard-data';
const saved=(page:Page):Promise<DashboardPayload>=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).payload,DASHBOARD_STORAGE_KEY);
const nav=(page:Page)=>page.getByRole('navigation',{name:'Primary navigation'});
async function seed(page:Page,date:string,payment=false){
 await page.clock.setFixedTime(new Date(date+'T20:00:00Z'));
 const fixture=createDemoFixture();fixture.payload.accounts=[{...fixture.payload.accounts[0],minimum:300,dueDate:'2026-01-22'}];fixture.payload.transactions=payment?[{...fixture.payload.transactions[0],date:'2026-10-20',amount:300}]:[];
 await page.addInitScript(({key,fixture})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(fixture));},{key:DASHBOARD_STORAGE_KEY,fixture});await page.goto('/');await expect(page.locator('.home-welcome')).toBeVisible();await expect.poll(async()=>Boolean((await saved(page)).accounts[0].minimumCycles?.length)).toBe(true);
}
async function edit(page:Page,amount:string){
 await nav(page).getByRole('button',{name:'Debt',exact:true}).click();await page.getByRole('button',{name:'Open Sample card',exact:true}).click();await page.getByRole('tab',{name:'Info',exact:true}).click();await page.getByRole('textbox',{name:'Minimum payment',exact:true}).fill(amount);await page.getByRole('button',{name:'Save',exact:true}).click();await expect.poll(async()=>(await saved(page)).accounts[0].minimum).toBe(Number(amount));await page.getByRole('button',{name:'Back from Sample card',exact:true}).click();
}
async function upcoming(page:Page){await nav(page).getByRole('button',{name:'Budget',exact:true}).click();await page.getByRole('navigation',{name:'Budget sections'}).getByRole('button',{name:'Upcoming',exact:true}).click();}
test.beforeEach(async({},info)=>expect(['localhost','127.0.0.1']).toContain(new URL(String(info.project.use.baseURL)).hostname));
test('paid cycle stays closed after a past-due minimum edit and reload',async({page})=>{
 await seed(page,'2026-10-20',true);
 await page.getByRole('button',{name:/View Sample card,/}).click();await page.getByRole('dialog',{name:'Payment for Sample card',exact:true}).getByRole('button',{name:/300/}).click();await expect.poll(async()=>(await saved(page)).monthlyPlan!.duePaymentAssociations?.[0].completed).toBe(true);
 const transactions=(await saved(page)).transactions;
 await page.clock.setFixedTime(new Date('2026-10-27T20:00:00Z'));await page.reload();await edit(page,'350');await upcoming(page);
 const row=page.getByRole('button',{name:/View Sample card,/});await expect(row).toHaveCount(1);await expect(row).toContainText('Nov 22');await expect(row).toContainText('$350.00');await expect(row).not.toContainText('Overdue');
 await page.reload();await upcoming(page);await expect(row).toContainText('Nov 22');expect((await saved(page)).transactions).toEqual(transactions);
});
test('unrecorded payment becomes overdue and remains at the original amount across edits and month rollover',async({page})=>{
 await seed(page,'2026-10-22');await page.clock.setFixedTime(new Date('2026-10-23T20:00:00Z'));await page.reload();await edit(page,'350');await upcoming(page);
 let rows=page.getByRole('button',{name:/View Sample card,/});await expect(rows).toContainText('Overdue');await expect(rows).toContainText('$300.00');
 await page.clock.setFixedTime(new Date('2026-11-01T20:00:00Z'));await page.reload();await upcoming(page);rows=page.getByRole('button',{name:/View Sample card,/});await expect(rows).toHaveCount(2);await expect(rows.nth(0)).toContainText('Oct 22');await expect(rows.nth(0)).toContainText('$300.00');await expect(rows.nth(1)).toContainText('Nov 22');await expect(rows.nth(1)).toContainText('$350.00');expect((await saved(page)).transactions).toHaveLength(0);
});
test('pending and due-today edits apply to that cycle',async({page})=>{
 await seed(page,'2026-10-21');await edit(page,'350');await upcoming(page);let row=page.getByRole('button',{name:/View Sample card,/});await expect(row).toContainText('Oct 22');await expect(row).toContainText('$350.00');
 await page.clock.setFixedTime(new Date('2026-10-22T20:00:00Z'));await page.reload();await edit(page,'400');await upcoming(page);row=page.getByRole('button',{name:/View Sample card,/});await expect(row).toContainText('Due today');await expect(row).toContainText('$400.00');
});

test('legacy linked minimum can be explicitly corrected without posting a payment',async({page})=>{
 await page.clock.setFixedTime(new Date('2026-10-27T20:00:00Z'));const fixture=createDemoFixture();fixture.payload.accounts=[{...fixture.payload.accounts[0],minimum:350,dueDate:'2026-01-22'}];fixture.payload.transactions=[{...fixture.payload.transactions[0],date:'2026-10-22',amount:300}];fixture.payload.monthlyPlan!.duePaymentAssociations=[{reminderId:'account:demo-card',dueDate:'2026-10-22',source:{type:'transaction',id:fixture.payload.transactions[0].id}}];
 await page.addInitScript(({key,fixture})=>localStorage.setItem(key,JSON.stringify(fixture)),{key:DASHBOARD_STORAGE_KEY,fixture});await page.goto('/');await expect(page.locator('.home-welcome')).toBeVisible();const before=(await saved(page)).transactions;
 await page.getByRole('button',{name:/View Sample card,/}).click();const dialog=page.getByRole('dialog',{name:'Payment for Sample card',exact:true});await dialog.getByRole('textbox',{name:'Original minimum for this due date',exact:true}).fill('300');await dialog.getByRole('button',{name:'Save original minimum',exact:true}).click();await upcoming(page);const row=page.getByRole('button',{name:/View Sample card,/});await expect(row).toHaveCount(1);await expect(row).toContainText('Nov 22');await expect(row).toContainText('$350.00');expect((await saved(page)).transactions).toEqual(before);
});
