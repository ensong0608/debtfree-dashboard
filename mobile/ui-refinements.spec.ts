import { test, expect, type Page } from '@playwright/test';
import { createDemoFixture } from './demo-fixture';
import { demoKey } from './demo-repository';
import { DASHBOARD_STORAGE_KEY } from '../app/data-repository';

const saved = (page: Page) => page.evaluate(key => {
  const value = JSON.parse(localStorage.getItem(key)!).payload;
  return { accounts: value.accounts, transactions: value.transactions, snapshots: value.snapshots, baseline: value.monthlyPlan.progressStartingBalance };
}, demoKey(DASHBOARD_STORAGE_KEY));

test.beforeEach(async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 1440) > 820, 'Phone refinement coverage.');
  await page.clock.setFixedTime(new Date('2026-10-18T12:00:00'));
  const fixture = createDemoFixture();
  fixture.payload.extra = 100;
  fixture.payload.monthlyPlan = { ...fixture.payload.monthlyPlan!, payoffPlanAmount: 150 };
  fixture.payload.monthlyBudgets['2026-10'] = [
    { id: 'income', name: 'Synthetic salary', kind: 'income', category: 'Salary', amount: 7800, paymentMethod: 'debit', creditAccountId: '', recurring: true, createdAt: fixture.exportedAt },
    { id: 'rent', name: 'Synthetic spending', kind: 'expense', category: 'Housing', amount: 3328.35, paymentMethod: 'debit', creditAccountId: '', recurring: true, createdAt: fixture.exportedAt },
  ];
  await page.addInitScript(({ key, fixture }) => localStorage.setItem(key, JSON.stringify(fixture)), { key: demoKey(DASHBOARD_STORAGE_KEY), fixture });
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== 'http://127.0.0.1:4179') throw new Error('Unexpected external request: ' + url.origin);
    await route.continue();
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Sample card', exact: true })).toBeVisible();
});

test('text labels retain explanations without icons or split Budget amounts', async ({ page }, info) => {
  await page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('button', { name: 'Budget', exact: true }).click();
  const summary = page.getByRole('region', { name: 'Monthly budget summary' });
  const label = summary.getByRole('button', { name: 'Explain Income', exact: true });
  await expect(label).toHaveText('Income');
  await expect(label.locator('svg')).toHaveCount(0);
  expect(await summary.locator('dd').evaluateAll(nodes => nodes.every(node => node.scrollWidth <= node.clientWidth + 1))).toBe(true);
  const before = await saved(page);
  await label.click();
  const dialog = page.getByRole('dialog', { name: 'Income', exact: true });
  await expect(dialog).toContainText('planned income');
  const close = dialog.getByRole('button', { name: 'Close explanation', exact: true });
  await expect(close).toHaveText('');
  await expect(close).toBeFocused();
  expect(await close.evaluate(node => getComputedStyle(node).borderRadius)).toBe('50%');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(label).toBeFocused();
  expect(await saved(page)).toEqual(before);
  await page.screenshot({ path: info.outputPath('budget-text-help.png') });
});

test('transaction icon and title share a row and deletion remains a secondary guarded action', async ({ page }, info) => {
  await page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('button', { name: 'Transactions', exact: true }).click();
  const cards = page.getByRole('region', { name: 'Monthly transaction summary' }).locator('article');
  await expect(cards).toHaveCount(3);
  for (const card of await cards.all()) {
    const heading = card.locator('[class*="summaryHeading"]');
    const icon = heading.locator(':scope > svg, :scope > i');
    const title = heading.locator('[class*="summaryLabel"]');
    const [a,b] = await Promise.all([icon.boundingBox(), title.boundingBox()]);
    expect(a && b && Math.abs(a.y-b.y) < 4 && a.x+a.width <= b.x+1).toBeTruthy();
    await expect(title.locator('svg')).toHaveCount(0);
  }
  await cards.first().getByRole('button').click();
  let dialog = page.getByRole('dialog', { name: 'Payments recorded', exact: true });
  const close = dialog.getByRole('button', { name: 'Close explanation', exact: true });
  const [box, closeBox] = await Promise.all([dialog.boundingBox(), close.boundingBox()]);
  expect(box && closeBox && closeBox.x > box.x + box.width / 2 && closeBox.y < box.y + 24).toBeTruthy();
  await close.click();
  await page.screenshot({ path: info.outputPath('inline-transaction-headings.png') });
  const before = await saved(page);
  await page.locator('.transaction-edit-surface').first().click();
  dialog = page.getByRole('dialog', { name: 'Edit transaction', exact: true });
  const deletion = dialog.getByRole('button', { name: 'Delete transaction', exact: true });
  const save = dialog.getByRole('button', { name: 'Save transaction', exact: true });
  const [deleteBox, saveBox] = await Promise.all([deletion.boundingBox(), save.boundingBox()]);
  expect(deleteBox && saveBox && deleteBox.y >= saveBox.y + saveBox.height).toBeTruthy();
  const style = await deletion.evaluate(node => { const s=getComputedStyle(node); const p=node.parentElement!.getBoundingClientRect(), b=node.getBoundingClientRect(); return { size:parseFloat(s.fontSize), border:s.borderTopWidth, background:s.backgroundColor, centered:Math.abs(b.x+b.width/2-(p.x+p.width/2))<3 }; });
  expect(style).toMatchObject({ size:12, border:'0px', background:'rgba(0, 0, 0, 0)', centered:true });
  await page.screenshot({ path: info.outputPath('secondary-delete.png') });
  await deletion.click();
  await expect(page.getByRole('dialog', { name: 'Delete payment?', exact: true })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await saved(page)).toEqual(before);
});

test('gear opens Settings and a second click returns to the previous screen', async ({ page }) => {
  const nav = page.getByRole('navigation', { name: 'Primary navigation' });
  await nav.getByRole('button', { name:'Transactions', exact:true }).click();
  const before = await saved(page);
  await page.getByRole('button', { name:'Open Settings', exact:true }).click();
  await expect(page.locator('.page-heading h1')).toContainText('Settings');
  const gear = page.getByRole('button', { name:'Close Settings', exact:true });
  await expect(gear).toHaveAttribute('aria-expanded','true');
  await gear.click();
  await expect(page.locator('.page-heading h1')).toContainText('Transactions');
  await expect(page.getByRole('button', { name:'Open Settings', exact:true })).toHaveAttribute('aria-expanded','false');
  expect(await saved(page)).toEqual(before);
});

test('Tools omits duplicate calculator and payoff plan displays a compact schedule table', async ({ page }, info) => {
  await page.getByRole('button', { name:'Open Tools', exact:true }).click();
  const tools = page.getByRole('dialog', { name:'Tools', exact:true });
  await expect(tools.getByRole('button', { name:'Payoff Calculator', exact:true })).toHaveCount(0);
  await tools.getByRole('button', { name:/^Payoff plan$/i }).click();
  await expect(page.locator('.payment-plan-screen')).toBeVisible();
  await expect(page.getByText('Assumptions', { exact:true })).toHaveCount(0);
  const table = page.locator('.plan-table');
  await expect(table).toBeVisible();
  await expect(table.locator('thead th')).toHaveText(['Month','Payment','Interest','Balance']);
  expect(await table.locator('tbody tr').count()).toBeGreaterThan(1);
  await expect(page.locator('.mobile-payoff-schedule,.schedule-month')).toHaveCount(0);
  const width = page.viewportSize()!.width;
  expect((await table.boundingBox())!.width).toBeLessThanOrEqual(width);
  expect(await table.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
  await table.scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('compact-payoff-table.png') });
});
