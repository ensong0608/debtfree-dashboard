import { test, expect } from '@playwright/test';
import { createDemoFixture } from '../../mobile/demo-fixture';
import { DASHBOARD_STORAGE_KEY } from '../../app/data-repository';

test('F10 schedule keeps long names and large amounts usable at narrow mobile widths', async ({ page }) => {
  const fixture = createDemoFixture();
  const names = [
    'Everyday Rewards Card with a deliberately long account name',
    'Travel and Household Purchases Account with a long label',
  ];
  fixture.payload.accounts = fixture.payload.accounts.map((account, index) => ({
    ...account,
    name: names[index],
    balance: index ? 9876543.21 : 12345678.9,
    baselineBalance: index ? 9876543.21 : 12345678.9,
    apr: 0,
    minimum: 25,
  }));
  fixture.payload.transactions=[];
  fixture.payload.monthlyPlan!.payoffExtraPayment = 30000000;
  fixture.payload.customDebtOrder = fixture.payload.accounts.map(account => account.id);
  await page.addInitScript(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), {
    key: DASHBOARD_STORAGE_KEY,
    data: fixture,
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Hi Guest!' })).toBeVisible();
  await page.getByRole('button', { name: 'Open full schedule', exact: false }).click();
  const schedule = page.getByRole('dialog', { name: 'Payoff Schedule', exact: true });
  await expect(schedule.getByRole('table')).toBeVisible();
  const firstRow = schedule.getByRole('row').nth(1);
  await expect(firstRow).toContainText('$22,222,222.11');
  await expect(firstRow).toContainText('Everyday Rewards Card with a deliberately long account name');
  await expect(firstRow).toContainText('Travel and Household Purchases Account with a long label');

  // Four CSS viewport checks. These are desktop browser emulation, not physical-device checks.
  for (const width of [320, 360, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    const dialog = await schedule.boundingBox();
    const table = await schedule.getByRole('table').boundingBox();
    expect(dialog).not.toBeNull();
    expect(table).not.toBeNull();
    expect(dialog!.x).toBeGreaterThanOrEqual(0);
    expect(dialog!.x + dialog!.width).toBeLessThanOrEqual(width + 1);
    expect(table!.x).toBeGreaterThanOrEqual(dialog!.x);
    expect(table!.x + table!.width).toBeLessThanOrEqual(dialog!.x + dialog!.width + 1);
    expect(await schedule.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);

    await schedule.locator('[class*="scheduleScroll"]').evaluate(el => { el.scrollTop = el.scrollHeight; });
    const lastRow = await schedule.getByRole('row').last().boundingBox();
    expect(lastRow).not.toBeNull();
    expect(lastRow!.y + lastRow!.height).toBeLessThanOrEqual(844);
  }

  // Desktop layout is checked at its desktop viewport, separately from the phone widths.
  await page.setViewportSize({ width: 1440, height: 1000 });
  const desktopDialog = await schedule.boundingBox();
  expect(desktopDialog!.width).toBeLessThanOrEqual(1050);
  expect(desktopDialog!.x).toBeGreaterThan(0);
});
