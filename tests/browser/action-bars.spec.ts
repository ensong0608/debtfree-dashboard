import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('bottom action bars belong to their tabs, touch the content edges, and open the correct entry forms', async ({ page }) => {
  await page.goto('/');
  await page.locator('input[type="file"]').setInputFiles({ name:'action-bars.json', mimeType:'application/json', buffer:readFileSync('tests/fixtures/legacy-v0.json') });
  await expect(page.getByRole('button',{name:'Debt +',exact:true})).toBeVisible();
  await page.getByRole('button', {name:'Transactions',exact:true}).click();
  const checkEdges = async () => {
    const gaps = await page.locator('.bottom-action-bar').evaluate(bar => {
      const outer=bar.closest('main')!.getBoundingClientRect();
      const inner=bar.getBoundingClientRect();
      const content=bar.previousElementSibling!.getBoundingClientRect();
      return [Math.abs(outer.left-inner.left),Math.abs(outer.right-inner.right),Math.abs(outer.bottom-inner.bottom),Math.abs(content.bottom-inner.top)];
    });
    expect(gaps.every(gap=>gap<1)).toBe(true);
  };
  await checkEdges();
  await page.getByRole('button',{name:'Add record',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button',{name:'Close transaction',exact:true}).click();
  await page.getByRole('button',{name:'Budget',exact:true}).click();
  await expect(page.getByRole('button',{name:'Add record',exact:true})).toHaveCount(0);
  await expect(page.locator('.cashflow-quick-actions')).toHaveCount(0);
  await checkEdges();
  const cases=[['Income +','Add planned income'],['Spending +','Add planned spending'],['Oneoff +, one-time adjustment','Add one-time adjustment']];
  for(const [name,heading] of cases){
    await page.getByRole('button',{name,exact:true}).click();
    await expect(page.getByRole('dialog').getByRole('heading')).toHaveText(heading);
    await page.getByRole('button',{name:'Close planned entry form',exact:true}).click();
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.getByRole('button',{name:'Debts',exact:true}).click();
  await checkEdges();
  await expect(page.locator('.debts-screen>.screen-title,.transactions-heading')).toHaveCount(0);
  await page.getByRole('button',{name:'Debt +',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();
  await expect(page.getByRole('button',{name:'Debt +',exact:true})).toBeFocused();
});
