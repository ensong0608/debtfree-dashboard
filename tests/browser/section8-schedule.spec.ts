import { test, expect } from '@playwright/test';
import { createDemoFixture } from '../../mobile/demo-fixture';
import { DASHBOARD_STORAGE_KEY } from '../../app/data-repository';
import { APPEARANCE_KEY, THEMES } from '../../app/appearance';

test('full Schedule keeps the monthly forecast readable in both themes at phone widths', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const fixture = createDemoFixture();
  const names = [
    'Everyday Rewards Card with a deliberately long account name',
    'Travel and Household Purchases Account with a long label',
  ];
  fixture.payload.accounts = fixture.payload.accounts.map((account, index) => ({
    ...account,
    name: names[index],
    balance: index ? 9_876_543.21 : 12_345_678.9,
    baselineBalance: index ? 9_876_543.21 : 12_345_678.9,
    apr: 0,
    minimum: 25,
  }));
  fixture.payload.transactions = [];
  fixture.payload.monthlyPlan!.payoffExtraPayment = 30_000_000;
  await page.addInitScript(({ dataKey, data, appearanceKey, appearance }) => {
    if (!localStorage.getItem(dataKey)) localStorage.setItem(dataKey, JSON.stringify(data));
    if (!localStorage.getItem(appearanceKey)) localStorage.setItem(appearanceKey, JSON.stringify(appearance));
  }, { dataKey: DASHBOARD_STORAGE_KEY, data: fixture, appearanceKey: APPEARANCE_KEY, appearance: THEMES.light });

  await page.goto('/');
  const palettes: string[] = [];
  for (const [theme, appearance] of Object.entries(THEMES)) {
    await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: APPEARANCE_KEY, value: appearance });
    await page.reload();
    await expect(page.locator(':root')).toHaveAttribute('data-theme', theme);
    await page.getByRole('region', { name: 'Payoff Schedule preview' }).getByRole('button', { name: /See all/ }).click();
    const schedule = page.getByRole('dialog', { name: 'Payoff Schedule', exact: true });
    const table = schedule.getByRole('table');
    await expect(table).toBeVisible();
    await expect(table.locator('thead th')).toHaveCount(4);
    const firstRow = table.getByRole('row').nth(1);
    await expect(firstRow).toContainText(names[0]);
    await expect(firstRow).toContainText(names[1]);
    await expect(firstRow.locator('[class*="paidOff"]')).toContainText(names[0]);
    const palette = await schedule.evaluate(el => ({ background: getComputedStyle(el).backgroundColor, text: getComputedStyle(el).color }));
    expect(palette.background).not.toBe('rgba(0, 0, 0, 0)');
    expect(palette.text).not.toBe('rgba(0, 0, 0, 0)');
    palettes.push(`${palette.background}/${palette.text}`);

    for (const width of [320, 360, 390, 430]) {
      await page.setViewportSize({ width, height: 844 });
      expect(await schedule.evaluate(el => el.scrollWidth <= el.clientWidth + 1), `${theme} at ${width}px`).toBe(true);
      expect(await table.evaluate(el => el.scrollWidth <= el.clientWidth + 1), `${theme} table at ${width}px`).toBe(true);
    }
    await page.screenshot({ path: testInfo.outputPath(`section8-${theme}-390.png`), fullPage: false });
    await schedule.getByRole('button', { name: 'Close payoff schedule and go back' }).click();
  }
  expect(palettes[0]).not.toBe(palettes[1]);
});

test('full Schedule keeps the noncalculable forecast message visible in both themes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const fixture = createDemoFixture();
  fixture.payload.monthlyPlan!.loanTrackers = [{
    id: 'synthetic-missing-apr', name: 'Sample home', kind: 'house', originalAmount: 200_000,
    remainingAmount: 180_000, balanceKind: 'principal', asOf: '2026-10-01', budgetItemId: '', budgetItemName: '',
    monthlyPayment: 1_500, escrow: 300, history: [],
  }];
  await page.addInitScript(({ dataKey, data, appearanceKey, appearance }) => {
    if (!localStorage.getItem(dataKey)) localStorage.setItem(dataKey, JSON.stringify(data));
    if (!localStorage.getItem(appearanceKey)) localStorage.setItem(appearanceKey, JSON.stringify(appearance));
  }, { dataKey: DASHBOARD_STORAGE_KEY, data: fixture, appearanceKey: APPEARANCE_KEY, appearance: THEMES.light });

  await page.goto('/');
  for (const [theme, appearance] of Object.entries(THEMES)) {
    await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: APPEARANCE_KEY, value: appearance });
    await page.reload();
    await expect(page.locator(':root')).toHaveAttribute('data-theme', theme);
    await page.getByRole('region', { name: 'Payoff Schedule preview' }).getByRole('button', { name: /See all/ }).click();
    const schedule = page.getByRole('dialog', { name: 'Payoff Schedule', exact: true });
    await expect(schedule.getByRole('alert')).toContainText('Sample home: Enter the loan APR.');
    await expect(schedule.getByText('Payoff date unavailable')).toBeVisible();
    await schedule.getByRole('button', { name: 'Close payoff schedule and go back' }).click();
  }
});
