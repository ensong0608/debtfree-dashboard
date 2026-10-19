import { test, expect } from '@playwright/test';
import { createDemoFixture } from '../../mobile/demo-fixture';
import { DASHBOARD_STORAGE_KEY } from '../../app/data-repository';
import { APPEARANCE_KEY, PRESETS, DEFAULT_APPEARANCE } from '../../app/appearance';
import { householdDate } from '../../app/household-date';

test.use({ viewport: { width: 390, height: 844 }, screenshot: 'off' });
test.beforeEach(async ({ page }, info) => {
  const fixture = createDemoFixture(); fixture.payload.transactions = [];
  fixture.payload.accounts[0].apr = 24;
  fixture.payload.accounts[0].name = 'A very long synthetic household account name that must remain readable';
  if (info.title.includes('large values')) for (const account of fixture.payload.accounts) { account.balance = 1_000_000_000; account.minimum = 100_000_000; account.apr = 0; }
  await page.addInitScript(({ key, fixture }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(fixture));
  }, { key: DASHBOARD_STORAGE_KEY, fixture });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Open Settings', exact: true })).toBeVisible();
});
const payload = (page: import('@playwright/test').Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!).payload, DASHBOARD_STORAGE_KEY);

test('legacy USD is not written on mount; currency confirmation/cancel preserves every amount', async ({ page }) => {
  // Capture the baseline after the existing asynchronous month initialization,
  // so this assertion isolates currency edits from normal startup writes.
  await expect.poll(async () => Boolean((await payload(page)).monthlyPlan.months[householdDate().slice(0, 7)]?.payments)).toBe(true);
  const before = await payload(page);
  expect(before.monthlyPlan).not.toHaveProperty('currency');
  await page.getByRole('button', { name: 'Open Settings', exact: true }).click();
  const settings = page.getByRole('region', { name: 'Household currency', exact: true });
  await settings.getByLabel('Household currency', { exact: true }).selectOption('PHP');
  await expect(settings).toContainText('Amounts stay the same. No conversion.');
  expect((await payload(page)).monthlyPlan).not.toHaveProperty('currency');
  await settings.getByRole('button', { name: 'Cancel currency change' }).click();
  await expect(settings.getByLabel('Household currency', { exact: true })).toHaveValue('USD');
  await settings.getByLabel('Household currency', { exact: true }).selectOption('PHP');
  await settings.getByRole('button', { name: 'Confirm currency change' }).click();
  await expect.poll(async () => (await payload(page)).monthlyPlan.currency).toBe('PHP');
  const after = await payload(page); delete after.monthlyPlan.currency;
  expect(after).toEqual(before);
  await expect(page.getByRole('button', { name: 'Back to calculator', exact: true })).toHaveCount(0);
  await page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('button', { name: 'Debts', exact: true }).click();
  await expect(page.locator('.debt-total-summary')).toContainText('₱');
  await page.getByRole('button', { name: 'Open Quick Payoff Calculator', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Quick Payoff Calculator', exact: true })).toContainText('₱');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Open Quick Payoff Calculator', exact: true })).toBeFocused();
});

for (const preset of ['mint', 'ocean', 'sand', 'custom'] as const) test(`full Compact schedule is readable with ${preset} at 320/390px`, async ({ page }) => {
  const appearance = preset === 'custom' ? { ...DEFAULT_APPEARANCE, font: 'serif', size: 'larger', accent: '#343d5c', background: '#f4f2fa', surface: '#ffffff', text: '#182036' } : PRESETS[preset];
  await page.evaluate(({ key, appearance }) => { localStorage.setItem(key, JSON.stringify(appearance)); window.dispatchEvent(new CustomEvent('debtfree-appearance-change', { detail: appearance })); }, { key: APPEARANCE_KEY, appearance });
  const before = await payload(page);
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(page.getByRole('button', { name: 'Open Quick Payoff Calculator', exact: true })).toHaveText('Payoff Calculator');
    await page.getByRole('button', { name: 'Open Quick Payoff Calculator', exact: true }).click();
    const modal = page.getByRole('dialog', { name: 'Quick Payoff Calculator', exact: true });
    await modal.getByLabel('Extra Payment', { exact: true }).fill('100');
    const rows = modal.locator('tbody tr'); const count = await rows.count();
    expect(count).toBeGreaterThan(6);
    await expect(modal.getByRole('heading', { name: `Full schedule ${count} months` })).toBeVisible();
    await expect(rows.last().locator('td').last()).toHaveText('$0.00');
    await expect(modal.getByText(/First 6 months/)).toHaveCount(0);
    await expect(modal.getByText('24% APR', { exact: true })).toBeVisible();
    const contrast = await modal.locator('tbody td').first().evaluate(cell => {
      const style = getComputedStyle(cell), rgb = (s: string) => s.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(x => { const v = x / 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
      const lum = (s: string) => { const [r, g, b] = rgb(s); return r * .2126 + g * .7152 + b * .0722; };
      const a = lum(style.color), b = lum(style.backgroundColor); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
    });
    expect(contrast).toBeGreaterThanOrEqual(4.5);
    const table = await modal.getByRole('table').boundingBox(), box = await modal.boundingBox();
    expect(table!.width).toBeLessThanOrEqual(box!.width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.keyboard.press('Escape');
  }
  expect(await payload(page)).toEqual(before);
});

test('new setup can choose PHP before entering balances', async ({ page }) => {
  await page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('button', { name: 'Account', exact: true }).click();
  await page.getByRole('button', { name: 'Reset data', exact: true }).click();
  await page.getByLabel('Type RESET to confirm').fill('RESET');
  await page.getByRole('button', { name: 'Reset dashboard', exact: true }).click();
  await page.getByRole('combobox', { name: 'Household currency', exact: true }).selectOption('PHP');
  await page.getByRole('button', { name: 'Start my payoff plan', exact: true }).click();
  await expect.poll(async () => (await payload(page)).monthlyPlan.currency).toBe('PHP');
  expect((await payload(page)).accounts).toEqual([]);
});

test('large values fit the full schedule at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.getByRole('button', { name: 'Open Quick Payoff Calculator', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Quick Payoff Calculator' });
  const table = await modal.getByRole('table').boundingBox(), box = await modal.boundingBox();
  expect(table!.width).toBeLessThanOrEqual(box!.width);
  await expect(modal.locator('tbody tr').last().locator('td').last()).toHaveText('$0.00');
});
