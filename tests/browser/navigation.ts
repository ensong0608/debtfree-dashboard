import type { Page } from '@playwright/test';

export async function openMore(page: Page) {
  await page.getByRole('button', { name: (page.viewportSize()?.width ?? 1440) <= 820 ? 'Open Tools' : 'More', exact: true }).click();
}

export async function openSettings(page: Page) {
  await page.getByRole('button', { name: (page.viewportSize()?.width ?? 1440) <= 820 ? 'Open Settings' : 'Open My Account', exact: true }).click();
}

export async function openAccount(page: Page) {
  await page.getByRole('button', { name: (page.viewportSize()?.width ?? 1440) <= 820 ? 'Account' : 'Open My Account', exact: true }).click();
}

// The full desktop calculator remains responsive on resize. The actual mobile
// entry is the separate quick calculator, covered by mobile-approved-layout.
export async function openFullCalculator(page: Page) {
  const original = page.viewportSize();
  if (original && original.width <= 820) await page.setViewportSize({ width: 1024, height: original.height });
  await openMore(page);
  await page.getByRole('button', { name: 'Payoff Calculator', exact: true }).click();
  if (original && original.width <= 820) await page.setViewportSize(original);
}
