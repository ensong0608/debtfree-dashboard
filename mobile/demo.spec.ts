import { test, expect, type Page } from '@playwright/test';
import { DASHBOARD_STORAGE_KEY, DASHBOARD_CHECKPOINT_STORAGE_KEY } from '../app/data-repository';
import { demoKey } from './demo-repository';

const observations = new WeakMap<Page, { rejected: string[]; errors: string[] }>();
test.beforeEach(async ({ page }) => {
  const rejected: string[] = [];
  const errors: string[] = [];
  observations.set(page, { rejected, errors });
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin === 'http://127.0.0.1:4179' && (url.pathname === '/' || /^\/(assets|ocr)\//.test(url.pathname) || url.pathname === '/favicon.svg')) await route.continue();
    else { rejected.push(url.href); await route.abort(); }
  });
});
test.afterEach(async ({ page }) => {
  expect(observations.get(page)?.rejected).toEqual([]);
  expect(observations.get(page)?.errors).toEqual([]);
});

test('isolated bundle preserves categories, payment, Progress baseline and removed history', async ({ page }, info) => {
  const saved = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)!).payload, demoKey(DASHBOARD_STORAGE_KEY));
  await page.goto('/');
  await expect(page.getByText('Synthetic demo', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sample card', exact: true })).toBeVisible();
  await page.getByRole('button', { name: page.viewportSize()!.width <= 820 ? 'Open Settings' : 'Open My Account', exact: true }).click();
  await expect(page.getByRole('button', { name: /Copy dashboard link|Sign out|Add member|Create invitation/ })).toHaveCount(0);
  await expect(page.locator('a[href*="/auth"],form[action*="/auth"],.lifecycle-panel')).toHaveCount(0);
  await page.getByRole('button', { name: 'Edit Everyday category', exact: true }).click();
  await page.getByLabel('Category name', { exact: true }).fill('Daily');
  await page.getByRole('button', { name: 'Save category', exact: true }).click();
  await page.getByRole('button', { name: 'Debts', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Daily debts', exact: true })).toContainText('Sample card');
  await page.getByRole('button', { name: 'Record payment for Sample card', exact: true }).click();
  await page.getByLabel('Payment amount', { exact: true }).fill('50');
  await page.getByRole('button', { name: 'Confirm payment', exact: true }).click();
  await expect.poll(async () => (await saved()).transactions.length).toBe(2);
  await page.getByRole('button', { name: page.viewportSize()!.width <= 820 ? 'Open Tools' : 'More', exact: true }).click();
  await page.getByRole('button', { name: 'Progress', exact: true }).filter({ visible: true }).click();
  await expect(page.locator('.actual-progress-summary')).toContainText('$1,500.00');
  await page.getByRole('button', { name: 'Save snapshot', exact: true }).click();
  await expect.poll(async () => (await saved()).snapshots.length).toBe(2);
  await page.screenshot({ path: info.outputPath('progress.png'), fullPage: true });
  await page.reload();
  await expect(page.getByRole('region', { name: 'Daily debts', exact: true })).toContainText('Sample card');
  expect((await saved()).monthlyPlan.progressStartingBalance).toBe(1500);
  await page.getByRole('button', { name: 'Edit debt details for Sample card', exact: true }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('dialog').getByText('Advanced destructive action', { exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Permanently delete debt account', exact: true }).click();
  await expect.poll(async () => (await saved()).accounts.length).toBe(1);
  const payload = await saved();
  expect(payload.monthlyPlan.progressStartingBalance).toBe(1500);
  expect(payload.monthlyPlan.removedProgressAccounts.some((account: { id: string }) => account.id === 'demo-card')).toBe(true);
  expect(payload.transactions).toHaveLength(2);
  expect(payload.snapshots).toHaveLength(2);
  expect(await page.evaluate(() => Object.keys(localStorage).filter(key => key !== 'debtfree-dashboard-navigation-collapsed'))).toEqual(expect.arrayContaining([demoKey(DASHBOARD_STORAGE_KEY)]));
  expect(await page.evaluate(() => Object.keys(localStorage).every(key => key === 'debtfree-dashboard-navigation-collapsed' || key.endsWith(':synthetic-mobile-demo-v1')))).toBe(true);
  await page.screenshot({ path: info.outputPath('removed-debt.png'), fullPage: true });
});

test('damaged demo data stays intact and reports a bootstrap error', async ({ page }) => {
  await page.addInitScript(key => localStorage.setItem(key, '{damaged'), demoKey(DASHBOARD_STORAGE_KEY));
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('Demo storage is damaged');
  expect(await page.evaluate(key => localStorage.getItem(key), demoKey(DASHBOARD_STORAGE_KEY))).toBe('{damaged');
  await expect(page.getByRole('heading', { name: 'Sample card' })).toHaveCount(0);
});

test('appearance preview, save, reload and reset preserve household data', async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 1440) > 820, 'Mobile preferences only.');
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Sample card', exact: true })).toBeVisible();
  const financial = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)!).payload, demoKey(DASHBOARD_STORAGE_KEY));
  const before = await financial();
  const shell = page.locator('.app-shell');
  await page.getByRole('button', { name: 'Open Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Ocean', exact: true }).click();
  await expect.poll(() => shell.evaluate(el => getComputedStyle(el).getPropertyValue('--appearance-accent').trim())).toBe('#24578a');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect.poll(() => shell.evaluate(el => getComputedStyle(el).getPropertyValue('--appearance-accent').trim())).toBe('');
  await page.getByRole('button', { name: 'Ocean', exact: true }).click();
  await page.getByLabel('Font', { exact: true }).selectOption('serif');
  await page.getByLabel('Text size', { exact: true }).selectOption('larger');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Appearance saved');
  await page.getByRole('button', { name: 'Transactions', exact: true }).click();
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
  await page.reload();
  await expect.poll(() => shell.evaluate(el => getComputedStyle(el).getPropertyValue('--appearance-accent').trim())).toBe('#24578a');
  await page.getByRole('button', { name: 'Open Settings', exact: true }).click();
  await expect(page.getByLabel('Font', { exact: true })).toHaveValue('serif');
  await expect(page.getByLabel('Text size', { exact: true })).toHaveValue('larger');
  await page.getByRole('button', { name: 'Reset to defaults', exact: true }).click();
  await expect.poll(() => shell.evaluate(el => getComputedStyle(el).getPropertyValue('--appearance-accent').trim())).toBe('');
  expect(await financial()).toEqual(before);
});

test('reset retains its checkpoint and reload never restores sample debts', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: page.viewportSize()!.width <= 820 ? 'Account' : 'Open My Account', exact: true }).click();
  await page.getByRole('button', { name: 'Reset data', exact: true }).click();
  await page.getByLabel('Type RESET to confirm').fill('RESET');
  await page.getByRole('button', { name: 'Reset dashboard', exact: true }).click();
  await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)!).payload.accounts.length, demoKey(DASHBOARD_STORAGE_KEY))).toBe(0);
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).payload.accounts.length, demoKey(DASHBOARD_CHECKPOINT_STORAGE_KEY))).toBe(2);
  await page.reload();
  await expect(page.getByText('Synthetic demo', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sample card', exact: true })).toHaveCount(0);
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).payload.accounts.length, demoKey(DASHBOARD_STORAGE_KEY))).toBe(0);
});
