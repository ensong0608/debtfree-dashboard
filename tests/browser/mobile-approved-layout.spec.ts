import { test, expect } from '@playwright/test';
import { createDemoFixture } from '../../mobile/demo-fixture';
import { DASHBOARD_STORAGE_KEY } from '../../app/data-repository';

test.use({ screenshot: 'off' });

test.beforeEach(async ({ page }, info) => {
  const fixture = createDemoFixture();
  fixture.payload.accounts[0].apr = 24;
  if (info.title.startsWith('mobile filter and saved debt position')) fixture.payload.accounts[1].displayGroup = 'Other';
  fixture.payload.accounts.push(
    { ...fixture.payload.accounts[0], id: 'archive-zero', name: 'Finished sample', balance: 0, archivedAt: '2026-10-03T12:00:00Z' },
    { ...fixture.payload.accounts[0], id: 'archive-balance', name: 'Archived sample', balance: 40, archivedAt: '2026-10-03T12:00:00Z' },
  );
  await page.addInitScript(({ key, fixture }) => { localStorage.setItem(key, JSON.stringify(fixture));  }, { key: DASHBOARD_STORAGE_KEY, fixture });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Sample card', exact: true })).toBeVisible();
});

test('mobile has four tabs, direct Settings and a separate Account with confirmed archive restore', async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 1440) > 820, 'Mobile layout only.');
  const nav = page.getByRole('navigation', { name: 'Primary navigation' });
  await expect(nav.getByRole('button')).toHaveText(['Debts', 'Transactions', 'Budget', 'Account']);
  await expect(page.locator('.account-bubble,.page-heading .save-status')).toHaveCount(0);
  await expect(page.getByText('Detailed debt view & import', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Auditable debt activity', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Open Settings', exact: true }).click();
  await expect(page.locator('.page-heading h1')).toContainText('Settings');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Debt categories', exact: true })).toBeVisible();
  await nav.getByRole('button', { name: 'Account', exact: true }).click();
  await expect(page.locator('.page-heading h1')).toContainText('Account');
  await expect(page.getByRole('region', { name: 'Debt categories', exact: true })).toHaveCount(0);
  const archives = page.getByRole('region', { name: 'Paid off & archived', exact: true });
  await expect(archives.locator('article').filter({ hasText: 'Finished sample' })).toContainText('PAID OFF');
  await expect(archives.locator('article').filter({ hasText: 'Archived sample' })).toContainText('ARCHIVED');
  page.once('dialog', dialog => dialog.dismiss());
  await archives.getByRole('button', { name: 'Restore Archived sample', exact: true }).click();
  await expect(archives.getByRole('button', { name: 'Restore Archived sample', exact: true })).toBeVisible();
  page.once('dialog', dialog => dialog.accept());
  await archives.getByRole('button', { name: 'Restore Archived sample', exact: true }).click();
  await expect(archives.getByRole('button', { name: 'Restore Archived sample', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Open Tools', exact: true }).click();
  const tools = page.getByRole('dialog', { name: 'Tools', exact: true });
  await expect(tools.getByRole('region', { name: 'Settings', exact: true })).toBeVisible();
  await tools.getByRole('button', { name: 'Progress', exact: true }).click();
  await expect(page.locator('.actual-progress-summary')).toContainText('$1,500.00');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

test('quick calculator reserves minimums and keeps the saved financial plan unchanged', async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 1440) > 820, 'Mobile calculator only.');
  await expect(page.getByRole('region', { name: 'Quick Payoff Calculator', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Open Quick Payoff Calculator', exact: true }).click();
  const calculator = page.getByRole('region', { name: 'Quick Payoff Calculator', exact: true });
  const savedPlan = () => page.evaluate(key => {
    const payload = JSON.parse(localStorage.getItem(key)!).payload;
    return { extra: payload.extra, strategy: payload.strategy, savedAmount: payload.monthlyPlan.payoffPlanAmount, baseline: payload.monthlyPlan.progressStartingBalance, transactions: payload.transactions, snapshots: payload.snapshots };
  }, DASHBOARD_STORAGE_KEY);
  const before = await savedPlan();
  await expect(calculator.getByRole('list', { name: 'Quick payoff order' }).locator('li').first()).toContainText('Sample card');
  await calculator.getByLabel('Extra Payment', { exact: true }).fill('100');
  await expect(calculator).toContainText('Minimums $50.00 included. Total: $150.00.');
  await calculator.getByRole('button', { name: 'Snowball', exact: true }).click();
  await expect(calculator.getByRole('list', { name: 'Quick payoff order' }).locator('li').first()).toContainText('Sample travel');
  await page.keyboard.press('Tab');
  await expect(calculator.getByRole('region', { name: 'Full payoff schedule', exact: true })).toBeVisible();

  await expect(calculator.getByRole('table')).toBeVisible();
  const table = calculator.getByRole('table');
  const widths = await table.locator('thead th').evaluateAll(cells => cells.map(cell => cell.getBoundingClientRect().width));
  expect(widths[0]).toBeLessThan(130);
  expect((await table.boundingBox())!.width).toBeLessThan(550);
  const firstRow = calculator.getByRole('list', { name: 'Quick payoff order' }).locator('li').first();
  const rowParts = await firstRow.locator('span,strong').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().top));
  expect(Math.abs(rowParts[0] - rowParts[1])).toBeLessThan(8);
  await calculator.getByLabel('Extra Payment', { exact: true }).fill('-1');
  await expect(calculator.getByRole('status')).toHaveText('Enter a valid extra payment.');
  expect(await savedPlan()).toEqual(before);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Quick Payoff Calculator', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Open Quick Payoff Calculator', exact: true })).toBeFocused();
});

test('compact header and Tools fit narrow widths and Escape returns focus', async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 1440) > 820, 'Mobile layout only.');
  await page.evaluate(() => localStorage.setItem('debtfree-dashboard-navigation-collapsed', 'true'));
  await page.reload();
  for (const width of [320, 390, 736]) {
    await page.setViewportSize({ width, height: 844 });
    const header = page.locator('.page-heading');
    expect((await header.boundingBox())!.height).toBeLessThanOrEqual(72);
    await page.getByRole('button', { name: 'Open Tools', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Tools', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Open Tools', exact: true })).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    const nav = await page.getByRole('navigation', { name: 'Primary navigation' }).boundingBox();
    expect(nav!.y).toBeGreaterThan(744);
    expect(nav!.y + nav!.height).toBeLessThanOrEqual(845);
  }
});

test('desktop retains More, existing header and detailed debt controls', async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 390) <= 820, 'Desktop preservation only.');
  await expect(page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('button')).toHaveText(['Debts', 'Transactions', 'Budget', 'More']);
  await expect(page.getByRole('button', { name: 'Open My Account', exact: true })).toBeVisible();
  await expect(page.getByText('Detailed debt view & import', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Quick Payoff Calculator', exact: true })).toHaveCount(0);
});

test('mobile filter and saved debt position replace category tabs and Sort', async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 1440) > 820, 'Mobile controls only.');
  const filter = page.getByRole('combobox', { name: 'Debt category filter', exact: true });
  await expect(filter).toBeVisible();
  await expect(page.getByRole('button', { name: 'Arrange debts', exact: true })).toHaveCount(0);
  await filter.selectOption('group-travel');
  await expect(page.locator('.compact-debt-card')).toHaveCount(0);
  await filter.selectOption('All');
  await expect(page.locator('.compact-debt-card')).toHaveCount(2);
  const saved = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)!).payload, DASHBOARD_STORAGE_KEY);
  const before = await saved();
  await page.getByRole('button', { name: 'Edit debt details for Sample card', exact: true }).click();
  await page.getByRole('combobox', { name: 'Position in category', exact: true }).selectOption('2');
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await saved()).toEqual(before);
  await page.getByRole('button', { name: 'Edit debt details for Sample card', exact: true }).click();
  await page.getByRole('combobox', { name: 'Position in category', exact: true }).selectOption('2');
  await page.getByRole('dialog').getByRole('button', { name: 'Save details', exact: true }).click();
  await expect(page.locator('.compact-debt-card').first()).toContainText('Sample travel');
  await expect.poll(async () => (await saved()).accounts.find((account: { id: string }) => account.id === 'demo-card').displayOrder).toBe(1);
  const after = await saved();
  expect(after.transactions).toEqual(before.transactions);
  expect(after.accounts.map((account: { balance: number }) => account.balance)).toEqual(before.accounts.map((account: { balance: number }) => account.balance));
  expect(after.accounts.some((account: object) => Object.hasOwn(account, 'displayPosition'))).toBe(false);
});
