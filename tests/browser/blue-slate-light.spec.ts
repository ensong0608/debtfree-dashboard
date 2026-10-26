import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';
import { createDemoFixture } from '../../mobile/demo-fixture';
import { DASHBOARD_STORAGE_KEY } from '../../app/data-repository';
import { APPEARANCE_KEY, APPEARANCE_EVENT, THEMES } from '../../app/appearance';

test('Blue & Slate reaches every screen, subtab and form without changing household data', async ({page}) => {
  test.setTimeout(180000);
  await page.addInitScript(({key,fixture,appearanceKey,appearance})=>{
    if(!localStorage.getItem(key)) localStorage.setItem(key,JSON.stringify(fixture));
    if(!localStorage.getItem(appearanceKey)) localStorage.setItem(appearanceKey,JSON.stringify(appearance));
  },{key:DASHBOARD_STORAGE_KEY,fixture:createDemoFixture(),appearanceKey:APPEARANCE_KEY,appearance:{...THEMES.light,accent:'#0961d9',background:'#f3f7fd',surface:'#ffffff',primaryLight:'#cfe7fa'}});
  await page.goto('/');
  await expect(page.locator('.home-welcome')).toBeVisible();
  await expect.poll(()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).payload.snapshots.some((s:{autoCheckpoint?:string})=>Boolean(s.autoCheckpoint)),DASHBOARD_STORAGE_KEY)).toBe(true);
  const before=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).payload,DASHBOARD_STORAGE_KEY);
  const nav=page.getByRole('navigation',{name:'Primary navigation'});
  const header=page.locator('.shared-dashboard-header');
  mkdirSync('outputs/blue-slate-light',{recursive:true});
  for(const width of [320,360,390,430,1440]) {
    await page.setViewportSize({width,height:900});
    for(const tab of ['Home','Debt','Progress','Budget','Settings']) {
      await nav.getByRole('button',{name:tab,exact:true}).click();
      await expect(header).toHaveCSS('background-color','rgb(41, 94, 155)');
      await expect(page.locator('body')).toHaveCSS('background-color','rgb(228, 235, 243)');
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
      if(width===390 || width===1440) {
        const a11y=await new AxeBuilder({page}).include('.app-shell').withRules(['color-contrast','button-name']).analyze();
        expect(a11y.violations,`${width} ${tab}`).toEqual([]);
        await page.screenshot({path:`outputs/blue-slate-light/${width}-${tab}.png`});
      }
      if(tab==='Progress' || tab==='Budget') {
        for(const segment of await header.locator('.compact-segments button').all()) {
          const segmentName=await segment.innerText();
          await segment.click();
          expect(await header.locator('.compact-segments').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
          if(width===390) {
            const a11y=await new AxeBuilder({page}).include('.app-shell').withRules(['color-contrast']).analyze();
            expect(a11y.violations).toEqual([]);
            await page.screenshot({path:`outputs/blue-slate-light/390-${tab}-${segmentName}.png`});
          }
        }
      }
      if(tab==='Debt' && width===390) {
        await header.getByRole('button',{name:'Add debt',exact:true}).click();
        const dialog=page.getByRole('dialog');
        await expect(dialog).toBeVisible();
        const a11y=await new AxeBuilder({page}).include('[role=dialog]').withRules(['color-contrast','button-name']).analyze();
        expect(a11y.violations).toEqual([]);
        await page.screenshot({path:'outputs/blue-slate-light/390-Add-debt.png'});
        await dialog.getByRole('button',{name:'Back from account form',exact:true}).click();
      }
    }
  }
  await page.reload();
  await expect(header).toHaveCSS('background-color','rgb(41, 94, 155)');
  // The update must leave the existing Dark palette intact.
  await page.evaluate(({key,event,appearance})=>{
    localStorage.setItem(key,JSON.stringify(appearance));
    window.dispatchEvent(new CustomEvent(event,{detail:appearance}));
  },{key:APPEARANCE_KEY,event:APPEARANCE_EVENT,appearance:THEMES.dark});
  await expect(header).toHaveCSS('background-color','rgb(24, 43, 69)');
  await expect(page.locator('body')).toHaveCSS('background-color','rgb(8, 14, 22)');
  expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).payload,DASHBOARD_STORAGE_KEY)).toEqual(before);
});
