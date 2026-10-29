import {test,expect} from '@playwright/test';
import {createDemoFixture} from '../../mobile/demo-fixture';
import {DASHBOARD_STORAGE_KEY} from '../../app/data-repository';
test('section popups preserve notes and disabled limits; currency edits use cents and automatic closing day is editable',async({page},info)=>{
 expect(['localhost','127.0.0.1']).toContain(new URL(String(info.project.use.baseURL)).hostname);
 await page.clock.setFixedTime(new Date('2026-10-29T20:00Z'));
 const fixture=createDemoFixture();fixture.payload.accounts[0].apr=24;
 await page.addInitScript(({key,fixture})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(fixture));},{key:DASHBOARD_STORAGE_KEY,fixture});
 await page.goto('/');await expect(page.locator('.home-welcome')).toBeVisible({timeout:30000});
 await page.getByRole('navigation',{name:'Primary navigation'}).getByRole('button',{name:'Debt',exact:true}).click();
 await page.getByRole('button',{name:'Open Sample card',exact:true}).click();
 const detail=page.getByRole('dialog',{name:'Sample card',exact:true});await detail.getByRole('tab',{name:'Detail',exact:true}).click();
 await expect(detail.getByRole('button',{name:'Advanced',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Mark paid off',exact:true})).toHaveCount(0);
 await detail.getByRole('button',{name:/^Debt details/}).click();
 const debt=page.getByRole('dialog',{name:'Debt details',exact:true});await debt.getByRole('switch',{name:'Custom note',exact:true}).check();await debt.getByRole('textbox',{name:'Custom note',exact:true}).fill('Keep the planned payment');await debt.getByRole('button',{name:'Done',exact:true}).click();
 await detail.getByRole('button',{name:/^Payment & Terms/}).click();const terms=page.getByRole('dialog',{name:'Payment & Terms',exact:true});
 await terms.screenshot({path:'.wrangler/debt-terms-'+info.project.name+'.png'});
 const limit=terms.getByRole('textbox',{name:'Credit limit amount',exact:true});await limit.fill('');await limit.pressSequentially('1234567');await expect(limit).toHaveValue('$12,345.67');await limit.press('Backspace');await expect(limit).toHaveValue('$1,234.56');
 await terms.getByRole('switch',{name:'Credit limit',exact:true}).uncheck();await expect(limit).toHaveCount(0);
 await terms.getByRole('switch',{name:'Automatic interest estimates',exact:true}).check();await terms.getByRole('switch',{name:'Custom closing day',exact:true}).check();const closing=terms.getByRole('textbox',{name:'Statement closing day',exact:true});await closing.fill('');await closing.fill('15');await expect(closing).toHaveValue('15');await expect(terms.getByRole('alert')).toHaveCount(0);
 await terms.getByRole('button',{name:'Done',exact:true}).click();await detail.getByRole('button',{name:'Save',exact:true}).click();
 const saved=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).payload.accounts[0],DASHBOARD_STORAGE_KEY);
 await expect.poll(async()=>(await saved()).creditLimitEnabled).toBe(false);expect((await saved()).creditLimit).toBe(1234.56);expect((await saved()).customNote).toBe('Keep the planned payment');expect((await saved()).minimum).toBe(25);expect((await saved()).interestAutomation.closingDay).toBe(15);
});

test('auto loan sections save a note without changing scheduled payments or history',async({page},info)=>{
 expect(['localhost','127.0.0.1']).toContain(new URL(String(info.project.use.baseURL)).hostname);
 const fixture=createDemoFixture();
 fixture.payload.monthlyPlan!.loanTrackers=[{id:'test-car',name:'Section auto',kind:'car',originalAmount:10000,remainingAmount:9000,balanceKind:'principal',asOf:'2026-10-01',budgetItemId:'',budgetItemName:'',apr:5.85,monthlyPayment:300,dueDate:'2026-10-15',history:[]}];
 await page.addInitScript(({key,fixture})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(fixture));},{key:DASHBOARD_STORAGE_KEY,fixture});
 await page.goto('/');await expect(page.locator('.home-welcome')).toBeVisible({timeout:30000});
 await page.getByRole('navigation',{name:'Primary navigation'}).getByRole('button',{name:'Debt',exact:true}).click();await page.getByRole('button',{name:/^Home & Auto/}).click();await page.getByRole('button',{name:'Open Section auto',exact:true}).click();
 const detail=page.getByRole('dialog',{name:'Section auto',exact:true});await detail.getByRole('tab',{name:'Detail',exact:true}).click();await detail.getByRole('button',{name:/^Debt details/}).click();
 const notes=page.getByRole('dialog',{name:'Debt details',exact:true});await notes.getByRole('switch',{name:'Custom note',exact:true}).check();await notes.getByRole('textbox',{name:'Custom note',exact:true}).fill('Scheduled payment stays fixed');await notes.getByRole('button',{name:'Done',exact:true}).click();
 await detail.getByRole('button',{name:/^Payment & Terms/}).click();const terms=page.getByRole('dialog',{name:'Payment & Terms',exact:true});await expect(terms.getByRole('textbox',{name:'Minimum payment',exact:true})).toHaveValue('$300.00');await terms.getByRole('button',{name:'Done',exact:true}).click();await detail.getByRole('button',{name:'Save',exact:true}).click();
 await expect.poll(()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).payload.monthlyPlan.loanTrackers[0].customNote,DASHBOARD_STORAGE_KEY)).toBe('Scheduled payment stays fixed');
 const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).payload.monthlyPlan.loanTrackers[0],DASHBOARD_STORAGE_KEY);expect(saved.monthlyPayment).toBe(300);expect(saved.remainingAmount).toBe(9000);expect(saved.history).toEqual([]);
});
