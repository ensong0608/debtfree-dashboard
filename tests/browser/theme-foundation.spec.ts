import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createDemoFixture } from '../../mobile/demo-fixture';
import { DASHBOARD_STORAGE_KEY } from '../../app/data-repository';
import { APPEARANCE_KEY, APPEARANCE_EVENT, THEMES } from '../../app/appearance';
import { mkdirSync } from 'node:fs';

test('semantic theme reaches shell and body portal, persists, and follows same-browser tabs', async ({ page, context }, info) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(({ key, fixture, appearanceKey, dark }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(fixture));
    if (!localStorage.getItem(appearanceKey)) localStorage.setItem(appearanceKey, JSON.stringify(dark));
  }, { key: DASHBOARD_STORAGE_KEY, fixture: createDemoFixture(), appearanceKey: APPEARANCE_KEY, dark: THEMES.dark });
  await page.goto('/');
  await expect(page.getByRole('heading', { name:/Welcome,/  })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('heading', { name:/Welcome,/  })).toBeVisible();
  const financialBefore = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).payload, DASHBOARD_STORAGE_KEY);
  await page.getByRole('button', { name:/Open full schedule/ }).click();
  const schedule = page.getByRole('dialog', { name:'Payoff Schedule', exact:true });
  await schedule.getByRole('button', { name:'Edit minimums', exact:true }).click();
  const dialog = page.getByRole('dialog', { name:'Edit minimum payments', exact:true });
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate(el => el.parentElement?.parentElement === document.body)).toBe(true);
  const sibling = await context.newPage(); await sibling.goto('/');
  mkdirSync('outputs/section1-theme', { recursive:true });
  for (const theme of ['light', 'dark'] as const) {
    await sibling.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key:APPEARANCE_KEY, value:THEMES[theme] });
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    const colors = await dialog.evaluate(el => ({ surface:getComputedStyle(el).backgroundColor, text:getComputedStyle(el).color, body:getComputedStyle(document.body).backgroundColor }));
    expect(colors.surface).toBe(theme === 'dark' ? 'rgb(19, 30, 43)' : 'rgb(255, 255, 255)');
    expect(colors.text).toBe(theme === 'dark' ? 'rgb(237, 243, 255)' : 'rgb(16, 27, 49)');
    expect(colors.body).toBe(theme === 'dark' ? 'rgb(8, 14, 22)' : 'rgb(243, 247, 253)');
    const axe = await new AxeBuilder({ page }).include('[role=dialog]').withRules(['color-contrast']).analyze();
    expect(axe.violations).toEqual([]);
    await page.screenshot({ path:`outputs/section1-theme/${info.project.name}-${theme}-dialog.png` });
    await dialog.getByRole('button', { name:'Cancel', exact:true }).click();
    await schedule.getByRole('button', { name:'Close payoff schedule and go back', exact:true }).click();
    await expect(page.getByRole('heading', { name:/Welcome,/  })).toBeVisible();
    await page.locator('.page-body').evaluate(el => { el.scrollTop=0; });
    expect(await page.locator('.page-body').evaluate(el => getComputedStyle(el).fontFamily)).toContain('Helvetica');
    const shellContrast = await new AxeBuilder({page}).include('.app-shell').withRules(['color-contrast']).analyze();
    expect(shellContrast.violations).toEqual([]);
    await page.screenshot({ path:`outputs/section1-theme/${info.project.name}-${theme}-shell.png` });
    await page.getByRole('button', { name:/Open full schedule/ }).click();
    await schedule.getByRole('button', { name:'Edit minimums', exact:true }).click();
  }
  // Typography previews share the same root contract and reach portals.
  await page.evaluate(({ event, dark }) => window.dispatchEvent(new CustomEvent(event, { detail:{...dark,font:'serif',size:'larger'} })), { event:APPEARANCE_EVENT, dark:THEMES.dark });
  await expect(page.locator('html')).toHaveAttribute('data-text-size', 'larger');
  expect(await dialog.evaluate(el => getComputedStyle(el).fontFamily)).toContain('Georgia');
  // A real removal event in another tab restores Light without touching data.
  await sibling.evaluate(key => localStorage.removeItem(key), APPEARANCE_KEY);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await sibling.close();
  await dialog.getByRole('button', { name:'Cancel', exact:true }).click();
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).payload, DASHBOARD_STORAGE_KEY)).toEqual(financialBefore);
  expect(errors).toEqual([]);
});

test('denied appearance storage leaves the web app usable in Light', async ({ page }) => {
  await page.addInitScript(({key,fixture,appearanceKey})=>{
    localStorage.setItem(key,JSON.stringify(fixture));
    const original=Storage.prototype.getItem;
    Storage.prototype.getItem=function(k:string){if(k===appearanceKey)throw new DOMException('denied','SecurityError');return original.call(this,k);};
  },{key:DASHBOARD_STORAGE_KEY,fixture:createDemoFixture(),appearanceKey:APPEARANCE_KEY});
  await page.goto('/');
  await expect(page.getByRole('heading',{name:/Welcome,/})).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme','light');
});
