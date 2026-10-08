import { test, expect } from '@playwright/test';
import {readFileSync} from 'node:fs';
import AxeBuilder from '@axe-core/playwright';

test('reference layout handles narrow screens, large balances, long names and larger text without covering final entries', async ({page})=>{
 const fixture=JSON.parse(readFileSync('tests/fixtures/legacy-v0.json','utf8'));
 fixture.transactions=[];fixture.accounts[0].name='Long household grocery and everyday rewards account for Mama';fixture.accounts[0].balance=1234567.89;fixture.accounts[0].baselineBalance=1500000;
 const now=new Date(),month=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
 fixture.monthlyBudgets={[month]:Array.from({length:16},(_,i)=>({id:'bill-'+i,name:i===15?'Last household expense with a longer name':'Household bill '+i,category:'Housing',kind:'expense',amount:i===15?123456.78:100,paymentMethod:'debit',creditAccountId:'',createdAt:now.toISOString(),recurring:true}))};
 await page.goto('/');await page.locator('input[type=file]').setInputFiles({name:'visual-fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))});
 for(const width of [320,360,390,430,820,1440]){
  await page.setViewportSize({width,height:900});
  await expect(page.locator('.topbar')).toContainText('Debts');
  await expect(page.locator('.debt-reduction-track').first()).toHaveAttribute('aria-valuenow','17.7');
  const check=async()=>{
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
   const overflowing=await page.locator('.compact-debt-card,.clean-transaction-card,.budget-section-card,.bottom-action-bar').evaluateAll(cards=>cards.filter(el=>el.getBoundingClientRect().width>0&&el.scrollWidth>el.clientWidth+1).map(el=>el.className));
   expect(overflowing).toEqual([]);
  };
  await check();
  await page.getByRole('button',{name:'Budget',exact:true}).click();await check();
  const last=page.getByRole('button',{name:'Edit Last household expense with a longer name',exact:true});await last.scrollIntoViewIfNeeded();
  const rect=await last.boundingBox(),bar=await page.locator('.bottom-action-bar').boundingBox();expect(rect!.y+rect!.height).toBeLessThanOrEqual(bar!.y+1);
  await last.click();await expect(page.getByRole('dialog')).toBeVisible();await expect(page.getByRole('dialog').getByRole('button',{name:/Save/})).toBeVisible();await page.getByRole('button',{name:'Close planned entry form',exact:true}).click();
  await page.getByRole('button',{name:'Debts',exact:true}).click();
 }
 await page.setViewportSize({width:390,height:844});
 await page.addStyleTag({content:'.topbar>div:first-child strong{font-size:32px}.compact-debt-identity h2{font-size:24px!important}.compact-debt-identity .simple-balance{font-size:28px!important}.compact-debt-identity{flex-wrap:wrap}.bottom-action-bar>button{font-size:22px}'});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 const axe=await new AxeBuilder({page}).include('.debts-screen').include('.bottom-action-bar').withRules(['color-contrast']).analyze();expect(axe.violations).toEqual([]);
});
