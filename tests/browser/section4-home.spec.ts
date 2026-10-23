import { test, expect } from '@playwright/test';
import { createDemoFixture } from '../../mobile/demo-fixture';
import { DASHBOARD_STORAGE_KEY } from '../../app/data-repository';
import { APPEARANCE_KEY, THEMES } from '../../app/appearance';

test('Home routes to Account and the canonical Schedule, with a saved-history empty state in both themes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.setFixedTime(new Date('2026-10-23T19:00:00Z'));
  const fixture = createDemoFixture();
  fixture.payload.transactions = [];
  fixture.payload.snapshots = [];
  fixture.payload.balanceAdjustments = [];
  await page.addInitScript(({ key, fixture, appearanceKey, appearance }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(fixture));
    if (!localStorage.getItem(appearanceKey)) localStorage.setItem(appearanceKey, JSON.stringify(appearance));
  }, { key: DASHBOARD_STORAGE_KEY, fixture, appearanceKey: APPEARANCE_KEY, appearance: THEMES.light });
  await page.goto('/');

  const home = page.getByRole('region', { name: 'Dashboard content' });
  await expect(home.getByRole('heading', { name: /Welcome,/ })).toBeVisible();
  await expect(home.getByText('Projected payoff · Whole household')).toBeVisible();
  await expect(home.getByText('Save a Progress snapshot to start a balance trend.')).toBeVisible();
  await expect(home.getByText('Recorded payments and balance changes will appear here.')).toBeVisible();
  await expect(page.locator('[aria-label="Total household debt"]')).toHaveCSS('color', 'rgb(16, 27, 49)');
  await page.screenshot({ path: 'outputs/section4-home/light-phone.png', fullPage: true });

  await page.getByRole('button', { name: 'Open Account', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Account', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close Account', exact: true }).click();
  await expect(home.getByRole('heading', { name: /Welcome,/ })).toBeVisible();

  await page.getByRole('region', { name: 'Payoff Schedule preview' }).getByRole('button', { name: /See all/ }).click();
  const schedule = page.getByRole('dialog', { name: 'Payoff Schedule', exact: true });
  await expect(schedule).toBeVisible();
  await schedule.getByRole('button', { name: 'Close payoff schedule and go back', exact: true }).click();
  await expect(home.getByRole('heading', { name: /Welcome,/ })).toBeVisible();

  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: APPEARANCE_KEY, value: THEMES.dark });
  await page.reload();
  await expect(page.locator(':root')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('[aria-label="Total household debt"]')).toHaveCSS('color', 'rgb(237, 243, 255)');
  await expect(home.getByText('Save a Progress snapshot to start a balance trend.')).toBeVisible();
  await page.screenshot({ path: 'outputs/section4-home/dark-phone.png', fullPage: true });
});

test('Home labels a forecast with unsupported loan terms for review', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const fixture = createDemoFixture();
  fixture.payload.monthlyPlan!.loanTrackers = [{
    id: 'synthetic-unknown-terms', name: 'Synthetic loan', kind: 'car', originalAmount: 10000,
    remainingAmount: 8000, balanceKind: 'principal', asOf: '2026-10-01', budgetItemId: '',
    budgetItemName: '', history: [],
  }];
  await page.addInitScript(({ key, fixture }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(fixture)); }, { key: DASHBOARD_STORAGE_KEY, fixture });
  await page.goto('/');
  const home = page.getByRole('region', { name: 'Dashboard content' });
  await expect(home.getByText('Forecast needs review')).toBeVisible();
  await expect(home.getByRole('region', { name: 'Payoff summary' })).toContainText(/Enter the loan APR|Enter the regular payment amount/);
  await expect(home.getByText(/Projected payoff|A debt-free future/)).toHaveCount(0);
});
