import { test, expect } from '@playwright/test';
import { createDemoFixture } from '../../mobile/demo-fixture';
import { DASHBOARD_STORAGE_KEY } from '../../app/data-repository';
import { APPEARANCE_KEY, THEMES } from '../../app/appearance';

test('Settings themes save immediately, preserve editor changes, reset, and follow another tab', async ({ page, context }) => {
  await page.addInitScript(({ key, fixture }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(fixture)); }, { key: DASHBOARD_STORAGE_KEY, fixture: createDemoFixture() });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Welcome,/ })).toBeVisible();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const appearance = page.getByRole('region', { name: 'Appearance settings' });
  await expect(appearance).toBeVisible();
  const light = appearance.getByRole('button', { name: /Light Bright surfaces/ });
  const dark = appearance.getByRole('button', { name: /Dark Deep surfaces/ });
  await expect(light).toHaveAttribute('aria-pressed', 'true');

  await appearance.getByLabel('Text size').selectOption('large');
  await appearance.getByText('Custom colors', { exact: true }).click();
  await appearance.getByLabel('Accent').fill('#1267d5');
  await dark.click();
  await expect(dark).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).theme, APPEARANCE_KEY)).toBe('dark');
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).size, APPEARANCE_KEY)).toBe('standard');
  await appearance.getByRole('button', { name: 'Cancel edits' }).click();
  await expect(dark).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('button', { name: /Dark Deep surfaces/ })).toHaveAttribute('aria-pressed', 'true');

  const sibling = await context.newPage();
  await sibling.goto('/');
  await sibling.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: APPEARANCE_KEY, value: THEMES.light });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.getByRole('button', { name: /Light Bright surfaces/ })).toHaveAttribute('aria-pressed', 'true');
  await sibling.close();

  await page.reload();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const settings = page.getByRole('region', { name: 'Appearance settings' });
  await settings.getByLabel('Text size').selectOption('larger');
  await settings.getByLabel('Font').selectOption('serif');
  await settings.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-text-size', 'larger');
  await expect(page.locator('body')).toHaveCSS('font-family', /Georgia/);
  await settings.getByRole('button', { name: 'Reset to Light' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('html')).toHaveAttribute('data-text-size', 'standard');
  await expect(settings.getByRole('button', { name: /Light Bright surfaces/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Notification preferences are not available yet.')).toBeVisible();
});

test('Account entry returns to the prior page on desktop and phone', async ({ page }) => {
  await page.addInitScript(({ key, fixture }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(fixture)); }, { key: DASHBOARD_STORAGE_KEY, fixture: createDemoFixture() });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Welcome,/ })).toBeVisible();
  const mobile = (page.viewportSize()?.width ?? 1440) <= 820;
  await page.getByRole('button', { name: mobile ? 'Open Account' : 'Open My Account' }).click();
  await expect(page.getByRole('heading', { name: 'Account', exact: true })).toBeVisible();
  await page.getByRole('button', { name: mobile ? 'Close Account' : 'Return to previous page' }).click();
  await expect(page.getByRole('heading', { name: /Welcome,/ })).toBeVisible();
});

test('failed theme storage write does not show success', async ({ page }) => {
  await page.addInitScript(({ key, fixture, appearanceKey }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(fixture));
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name: string, value: string) { if (name === appearanceKey) throw new DOMException('denied', 'QuotaExceededError'); original.call(this, name, value); };
  }, { key: DASHBOARD_STORAGE_KEY, fixture: createDemoFixture(), appearanceKey: APPEARANCE_KEY });
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const settings = page.getByRole('region', { name: 'Appearance settings' });
  await settings.getByRole('button', { name: /Dark Deep surfaces/ }).click();
  await expect(settings.getByRole('alert')).toContainText('Could not save the theme');
  await expect(settings.getByText(/theme saved on this device/)).toHaveCount(0);
});
