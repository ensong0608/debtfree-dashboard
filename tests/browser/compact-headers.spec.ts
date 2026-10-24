import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createDemoFixture } from '../../mobile/demo-fixture';
import { DASHBOARD_STORAGE_KEY } from '../../app/data-repository';
import { APPEARANCE_KEY, APPEARANCE_EVENT, THEMES } from '../../app/appearance';
import { mkdirSync } from 'node:fs';

test.beforeEach(async ({page}) => {
  await page.addInitScript(({key,fixture,appearanceKey,dark}) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key,JSON.stringify(fixture));
    if (!localStorage.getItem(appearanceKey)) localStorage.setItem(appearanceKey,JSON.stringify(dark));
  },{key:DASHBOARD_STORAGE_KEY,fixture:createDemoFixture(),appearanceKey:APPEARANCE_KEY,dark:THEMES.dark});
  await page.goto('/');
  await expect(page.getByRole('heading',{name:/Welcome,/})).toBeVisible();
  await expect.poll(()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).payload.snapshots.some((s:{autoCheckpoint?:string})=>Boolean(s.autoCheckpoint)),DASHBOARD_STORAGE_KEY)).toBe(true);
});

test('compact headers stay aligned, readable and pinned across themes, phone widths and desktop', async ({page}) => {
  test.setTimeout(120000);
  const nav=page.getByRole('navigation',{name:'Primary navigation'}), header=page.locator('.shared-dashboard-header');
  mkdirSync('outputs/compact-headers',{recursive:true});
  for(const theme of ['light','dark'] as const) {
    await page.evaluate(({key,event,value})=>{localStorage.setItem(key,JSON.stringify(value));window.dispatchEvent(new CustomEvent(event,{detail:value}));},{key:APPEARANCE_KEY,event:APPEARANCE_EVENT,value:THEMES[theme]});
    for(const width of [320,360,390,430,1440]) {
      await page.setViewportSize({width,height:900});
      for(const tab of ['Debt','Progress','Budget']) {
        await nav.getByRole('button',{name:tab,exact:true}).click();
        const group=header.locator('.compact-segments'), buttons=group.getByRole('button');
        await expect(buttons).toHaveCount(3);
        expect(await group.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
        const heights=await buttons.evaluateAll(nodes=>nodes.map(el=>el.getBoundingClientRect().height));
        expect(Math.max(...heights)-Math.min(...heights)).toBeLessThan(1);
        expect(Math.min(...heights)).toBeGreaterThanOrEqual(44);
        expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
        await expect(header.getByRole('button',{name:'Open Account'})).toHaveCount(0);
        const before=(await header.boundingBox())!.y;
        await page.locator('.page-body').evaluate(el=>{el.scrollTop=500;});
        expect(Math.abs((await header.boundingBox())!.y-before)).toBeLessThan(2);
        await page.locator('.page-body').evaluate(el=>{el.scrollTop=0;});
        if(width===390) await page.screenshot({path:`outputs/compact-headers/${theme}-${tab}.png`});
      }
    }
    const contrast=await new AxeBuilder({page}).include('.shared-dashboard-header').withRules(['color-contrast','button-name']).analyze();
    expect(contrast.violations).toEqual([]);
  }
  await nav.getByRole('button',{name:'Progress',exact:true}).click();
  for(const [tab,title] of [['Overview','Progress overview'],['Utilization','Credit card utilization'],['Milestones','Milestone']]) {
    await header.getByRole('button',{name:tab,exact:true}).click();
    await expect(header.getByRole('heading')).toHaveText(title);
    await expect(header.locator('.shared-header-action')).toHaveCount(0);
  }
  await nav.getByRole('button',{name:'Debt',exact:true}).click();
  await header.getByRole('button',{name:'Add debt',exact:true}).click();
  const debtDialog=page.getByRole('dialog');await expect(debtDialog.getByLabel('Institution (optional)')).toHaveCount(0);
  await debtDialog.getByRole('button',{name:'Cancel',exact:true}).click();
  await expect(page.locator('.debt-add-bar')).toHaveCount(0);
  await nav.getByRole('button',{name:'Budget',exact:true}).click();
  await expect(header.getByRole('heading')).toHaveText('Budget planned');
  await header.getByRole('button',{name:'Add planned spending',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Add planned entry',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Close planned entry form',exact:true}).click();
  await header.getByRole('button',{name:'Transactions',exact:true}).click();
  await expect(header.getByRole('heading')).toHaveText('Debt transactions');
  await header.getByRole('button',{name:'Add transaction',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('dialog').getByRole('button',{name:/Close|Cancel/}).first().click();
  await header.getByRole('button',{name:'Strategy',exact:true}).click();
  await expect(header.getByRole('heading')).toHaveText('Payoff strategy');
  await expect(header.locator('.shared-header-action')).toHaveCount(0);
  await expect(page.getByRole('region',{name:'Payoff Strategy',exact:true})).toBeVisible();
});

test('primary presets and custom colors save separately for Light and Dark, survive reopening and do not alter household data',async({page})=>{
  const nav=page.getByRole('navigation',{name:'Primary navigation'}), header=page.locator('.shared-dashboard-header');
  const before=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).payload,DASHBOARD_STORAGE_KEY);
  await nav.getByRole('button',{name:'Settings',exact:true}).click();
  const appearance=page.getByRole('region',{name:'Appearance settings'});
  await appearance.getByRole('button',{name:'Deep Teal',exact:true}).click();
  await expect(header).toHaveCSS('background-color','rgb(18, 54, 57)');
  await appearance.getByRole('button',{name:'Save changes',exact:true}).click();
  await appearance.getByRole('button',{name:/^Light/}).click();
  await appearance.getByRole('textbox',{name:'Primary color hex',exact:true}).fill('#aaccee');
  await appearance.getByRole('button',{name:'Save changes',exact:true}).click();
  await expect(header).toHaveCSS('background-color','rgb(170, 204, 238)');
  await appearance.getByRole('button',{name:/^Dark/}).click();
  await expect(header).toHaveCSS('background-color','rgb(18, 54, 57)');
  await appearance.getByRole('textbox',{name:'Primary color hex',exact:true}).fill('#ff0000');
  await appearance.getByRole('button',{name:'Cancel edits',exact:true}).click();
  await expect(header).toHaveCSS('background-color','rgb(18, 54, 57)');
  await page.reload();
  await expect(header).toHaveCSS('background-color','rgb(18, 54, 57)');
  await nav.getByRole('button',{name:'Settings',exact:true}).click();
  await appearance.getByRole('button',{name:/^Light/}).click();
  await expect(header).toHaveCSS('background-color','rgb(170, 204, 238)');
  await appearance.getByRole('textbox',{name:'Primary color hex',exact:true}).fill('bad');
  await expect(appearance.getByRole('button',{name:'Save changes',exact:true})).toBeDisabled();
  await appearance.getByRole('button',{name:'Cancel edits',exact:true}).click();
  const after=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).payload,DASHBOARD_STORAGE_KEY);
  expect(after).toEqual(before);
});
