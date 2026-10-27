import { test, expect } from '@playwright/test';
import { createDemoFixture } from '../../mobile/demo-fixture';
import { DASHBOARD_STORAGE_KEY } from '../../app/data-repository';
import { APPEARANCE_EVENT, THEMES } from '../../app/appearance';

test('Budget UI supports planned category rows, searchable transactions and shared schedule in both themes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.setFixedTime(new Date('2026-10-23T19:00:00Z'));
  const fixture = createDemoFixture();
  fixture.payload.monthlyBudgets['2026-10'] = [
    { id: 'salary-test', name: 'Household salary', kind: 'income', category: 'Salary', amount: 5200, paymentMethod: 'debit', creditAccountId: '', recurring: true, createdAt: '2026-10-01T12:00:00.000Z' },
    { id: 'housing-test', name: 'Mortgage', kind: 'expense', category: 'Housing', amount: 1800, paymentMethod: 'debit', creditAccountId: '', recurring: true, createdAt: '2026-10-01T12:00:00.000Z' },
    { id: 'food-test', name: 'Groceries', kind: 'expense', category: 'Food', amount: 500, paymentMethod: 'debit', creditAccountId: '', recurring: true, createdAt: '2026-10-01T12:00:00.000Z' },
  ];
  await page.addInitScript(({ key, fixture }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(fixture)); }, { key: DASHBOARD_STORAGE_KEY, fixture });
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('button', { name: 'Budget', exact: true }).click();

  const sections = page.getByRole('navigation', { name: 'Budget sections' });
  await expect(sections.getByRole('button', { name: 'Overview', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('heading', { name: 'Monthly budget' })).toBeVisible();
  await expect(page.getByText('Planned allocations')).toBeVisible();
  await expect(page.locator('.budget-category-heading').getByText('Housing', { exact: true })).toBeVisible();
  await expect(page.locator('.budget-category-heading').getByText('Food', { exact: true })).toBeVisible();

  await page.evaluate(({event,value}) => window.dispatchEvent(new CustomEvent(event,{detail:value})), {event:APPEARANCE_EVENT,value:THEMES.dark});
  await expect(page.locator('html')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(8, 14, 22)');
  await page.evaluate(({event,value}) => window.dispatchEvent(new CustomEvent(event,{detail:value})), {event:APPEARANCE_EVENT,value:THEMES.light});
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(243, 247, 253)');

  await sections.getByRole('button', { name: 'Transactions', exact: true }).click();
  const search = page.getByRole('searchbox', { name: 'Search transactions' });
  await expect(search).toBeVisible();
  await search.fill('Sample card');
  await expect(page.getByRole('region', { name: 'Debt transaction activity' })).toContainText('Sample card');
  await expect(page.locator('.budget-transaction-search')).toContainText('1 result');
  await search.fill('not in this ledger');
  await expect(page.getByRole('region', { name: 'Debt transaction activity' })).toContainText('No activity in this period');

  await sections.getByRole('button', { name: 'Schedule', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Debt payoff' })).toBeVisible();
  await page.getByRole('button', { name: 'View full Payoff Schedule' }).click();
  await expect(page.getByRole('dialog', { name: 'Payoff Schedule', exact: true })).toBeVisible();
});
