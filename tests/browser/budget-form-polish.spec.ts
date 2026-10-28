import {mkdirSync} from 'node:fs';
import {test,expect,type Page} from '@playwright/test';
import {createDemoFixture} from '../../mobile/demo-fixture';
import {DASHBOARD_STORAGE_KEY} from '../../app/data-repository';
import {APPEARANCE_KEY,THEMES} from '../../app/appearance';

async function seed(page:Page,theme:'light'|'dark'){
 await page.clock.setFixedTime(new Date('2026-10-27T20:00:00Z'));
 const fixture=createDemoFixture();
 fixture.payload.monthlyBudgets['2026-10']=[{id:'sample-bill',name:'Sample bill',kind:'expense',category:'Utilities',amount:40,paymentMethod:'debit',creditAccountId:'',recurring:true,createdAt:'2026-10-01T12:00:00Z'}];
 await page.addInitScript(({key,fixture,appearanceKey,appearance})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(fixture));localStorage.setItem(appearanceKey,JSON.stringify(appearance));},{key:DASHBOARD_STORAGE_KEY,fixture,appearanceKey:APPEARANCE_KEY,appearance:THEMES[theme]});
 await page.goto('/');await expect(page.locator('.home-welcome')).toBeVisible();
 await page.getByRole('navigation',{name:'Primary navigation'}).getByRole('button',{name:'Budget',exact:true}).click();
}
test.beforeEach(async({},info)=>expect(['localhost','127.0.0.1']).toContain(new URL(String(info.project.use.baseURL)).hostname));
for(const theme of ['light','dark'] as const){
 test(`Budget forms have inline fields, readable options and paired action buttons in ${theme}`,async({page})=>{
  await seed(page,theme);
  for(const action of ['Income','Recurring spending','One-time spending','Record bill payment']){
   await page.getByRole('button',{name:'Add to Budget',exact:true}).click();
   await page.getByRole('group',{name:'Add to Budget'}).getByRole('button',{name:action,exact:true}).click();
   const dialog=page.locator('.budget-entry-sheet:visible');await expect(dialog.locator(':scope > .sheet-handle')).toBeVisible();await dialog.evaluate(async el=>{await Promise.all(el.getAnimations().map(animation=>animation.finished));});
   const first=dialog.locator('.sheet-fields>label').first();const label=(await first.locator('span').first().boundingBox())!;const input=(await first.locator('input,select').first().boundingBox())!;
   expect(input.x).toBeGreaterThan(label.x);expect(Math.abs((label.y+label.height/2)-(input.y+input.height/2))).toBeLessThan(12);
   const back=(await dialog.getByRole('button',{name:'Back',exact:true}).boundingBox())!;const save=(await dialog.getByRole('button',{name:'Save',exact:true}).boundingBox())!;
   expect(Math.abs(back.y-save.y)).toBeLessThan(2);expect(save.x).toBeGreaterThan(back.x);expect(Math.abs(back.width-save.width)).toBeLessThan(2);
   const selectStyle=await dialog.locator('select').first().evaluate(el=>({arrow:getComputedStyle(el).backgroundImage,alignment:getComputedStyle(el).textAlignLast}));expect(selectStyle.arrow).toContain('linear-gradient');expect(selectStyle.alignment).toBe('right');
   const option=dialog.locator('select option').first();const colors=await option.evaluate(el=>({background:getComputedStyle(el).backgroundColor,foreground:getComputedStyle(el).color}));expect(colors.foreground).not.toBe(colors.background);if(theme==='dark')expect(colors.background).not.toBe('rgb(255, 255, 255)');
   if(action==='Record bill payment'){mkdirSync('.wrangler/control-polish',{recursive:true});await page.screenshot({animations:'disabled',path:`.wrangler/control-polish/bill-payment-${theme}.png`});}
   await dialog.locator('header [data-dialog-close]').click();await expect(dialog).toHaveCount(0);
  }
  const tabs=page.getByRole('navigation',{name:'Budget sections'});
  for(const name of ['Upcoming','Strategy']){await tabs.getByRole('button',{name,exact:true}).click();await expect(page.locator('.budget-floating-actions')).toHaveCount(0);}
  await tabs.getByRole('button',{name:'Planned',exact:true}).click();await expect(page.getByRole('button',{name:'Add to Budget',exact:true})).toBeVisible();
 });
}
