import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createDemoFixture } from '../../mobile/demo-fixture';
import { DASHBOARD_STORAGE_KEY } from '../../app/data-repository';
import { APPEARANCE_EVENT, APPEARANCE_KEY, THEMES } from '../../app/appearance';

async function openProgress(page: import('@playwright/test').Page) {
  await page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('button', { name: 'Progress', exact: true }).click();
  await expect(page.locator('.actual-progress-screen')).toBeVisible();
}

test('Progress tabs and ranges show Section 6A observations, snapshots, and accessible theme styling', async ({ page }) => {
  const fixture = createDemoFixture();
  if (!fixture.payload.monthlyPlan) throw new Error('Demo fixture needs monthly plan settings.');
  fixture.payload.monthlyPlan.loanTrackers = [{ id: 'demo-car', name: 'Demo car', kind: 'car', originalAmount: 5000, remainingAmount: 4000, balanceKind: 'principal', asOf: '2026-10-15', budgetItemId: '', budgetItemName: '', apr: 0, monthlyPayment: 200, history: [{ date: '2026-09-20', amount: 4500, balanceKind: 'principal', recordedAt: '2026-09-21T12:00:00.000Z' }] }];
  await page.addInitScript(({ key, fixture, appearanceKey, appearance }) => {
    localStorage.setItem(key, JSON.stringify(fixture));
    localStorage.setItem(appearanceKey, JSON.stringify(appearance));
  }, { key: DASHBOARD_STORAGE_KEY, fixture, appearanceKey: APPEARANCE_KEY, appearance: THEMES.light });
  await page.goto('/');
  await openProgress(page);

  const progress = page.locator('.actual-progress-screen');
  await expect(progress.getByRole('navigation', { name: 'Progress sections' })).toBeVisible();
  await expect(progress.getByRole('region', { name: 'Snapshots', exact: true })).toBeVisible();
  await expect(progress.locator('.snapshot-controls .saved-check')).toHaveCount(1);
  await expect(progress.locator('.actual-progress-summary')).toContainText('saved starting balance');
  await expect(progress.getByRole('group', { name: 'Progress scope' }).getByRole('button', { name: 'Household' })).toBeVisible();
  await progress.getByRole('group', { name: 'Progress scope' }).getByRole('button', { name: 'Household' }).click();
  await expect(progress.locator('.actual-progress-summary')).toContainText('Saved account and original loan balances');
  await progress.getByRole('group', { name: 'Progress scope' }).getByRole('button', { name: 'House & car' }).click();
  await expect(progress.locator('.actual-progress-summary')).toContainText('$5,000.00');
  await expect(progress.getByRole('button', { name: 'Save loan balance check' })).toBeVisible();
  await progress.getByRole('group', { name: 'Progress scope' }).getByRole('button', { name: 'Cards & other' }).click();

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  const lightSurface = await progress.getByRole('region', { name: 'Snapshots', exact: true }).evaluate(element => getComputedStyle(element).backgroundColor);
  expect(lightSurface).toBe('rgb(255, 255, 255)');
  const lightContrast = await new AxeBuilder({ page }).include('.actual-progress-screen').withRules(['color-contrast']).analyze();
  expect(lightContrast.violations).toEqual([]);

  await page.evaluate(({ event, dark }) => window.dispatchEvent(new CustomEvent(event, { detail: { ...dark, size: 'larger' } })), { event: APPEARANCE_EVENT, dark: THEMES.dark });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('html')).toHaveAttribute('data-text-size', 'larger');
  await expect(progress.getByRole('region', { name: 'Snapshots', exact: true })).toHaveCSS('background-color', 'rgb(19, 30, 43)');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  const contrast = await new AxeBuilder({ page }).include('.actual-progress-screen').withRules(['color-contrast']).analyze();
  expect(contrast.violations).toEqual([]);

  await progress.getByRole('navigation', { name: 'Progress sections' }).getByRole('button', { name: 'Trends' }).click();
  const trendRange = progress.getByRole('group', { name: 'Trend time range' });
  for (const range of ['3M', '6M', '1Y', 'ALL']) {
    await trendRange.getByRole('button', { name: range, exact: true }).click();
    await expect(trendRange.getByRole('button', { name: range, exact: true })).toHaveAttribute('aria-pressed', 'true');
  }
  await expect(progress.getByRole('img', { name: /Recorded saved balance observations/ })).toBeVisible();
  await expect(progress).toContainText('No month-to-month saved observations to compare.');
  await expect(progress).toContainText('Live balances are not plotted as saved observations.');

  await progress.getByRole('navigation', { name: 'Progress sections' }).getByRole('button', { name: 'Milestones' }).click();
  await expect(progress.getByRole('heading', { name: 'Your milestones' })).toBeVisible();
  await expect(progress.locator('ol').last().locator('li')).toHaveCount(7);
  await expect(progress).not.toContainText('Faster payoff');
  await expect(progress.getByRole('navigation', { name: 'Progress sections' }).getByRole('button', { name: 'Overview' })).toBeVisible();
});

test('Progress explains when saved history is missing and keeps snapshot controls on Overview', async ({ page }) => {
  const fixture = createDemoFixture();
  fixture.payload.snapshots = [];
  fixture.payload.transactions = [];
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: DASHBOARD_STORAGE_KEY, value: fixture });
  await page.goto('/');
  await openProgress(page);
  const progress = page.locator('.actual-progress-screen');
  await expect(progress.getByRole('region', { name: 'Snapshots', exact: true })).toBeVisible();
  await expect(progress).toContainText('No saved snapshots yet.');
  await progress.getByRole('navigation', { name: 'Progress sections' }).getByRole('button', { name: 'Trends' }).click();
  await expect(progress.getByRole('status').first()).toContainText('No saved balance observations in this range.');
  await expect(progress).toContainText('No recorded account changes in this range.');
});
