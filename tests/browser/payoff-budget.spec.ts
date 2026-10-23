import { test, expect, type Page } from '@playwright/test';
import { createDemoFixture } from '../../mobile/demo-fixture';
import { DASHBOARD_STORAGE_KEY } from '../../app/data-repository';

const saved = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!).payload, DASHBOARD_STORAGE_KEY);
const nav = (page: Page) => page.getByRole('navigation', { name: 'Primary navigation' });
const scheduleDialog = (page: Page) => page.getByRole('dialog', { name: 'Payoff Schedule', exact: true });
async function openSchedule(page: Page) {
  await nav(page).getByRole('button', { name: 'Home', exact: true }).click();
  await page.getByRole('button', { name: /Open full schedule/ }).click();
  await expect(scheduleDialog(page).getByLabel('Extra payment', { exact: true })).toBeVisible();
}
async function closeSchedule(page: Page) {
  await scheduleDialog(page).getByRole('button', { name: 'Close payoff schedule and go back', exact: true }).click();
}
async function budget(page: Page, expected: string) {
  await nav(page).getByRole('button', { name: 'Budget', exact: true }).click();
  const summary = page.getByRole('region', { name: 'Monthly budget summary' });
  await expect(summary.locator('.budget-commitment dd')).toHaveText(expected);
  return summary;
}
async function suggestion(page: Page, name: string, expected: string) {
  await nav(page).getByRole('button', { name: /^Debts?$/, exact: true }).click();
  await page.getByRole('button', { name: 'Open ' + name, exact: true }).click();
  const detail = page.getByRole('dialog', { name, exact: true });
  for (const tab of ['Overview', 'Transactions']) {
    await detail.getByRole('tab', { name: tab, exact: true }).click();
    await detail.getByRole('button', { name: 'Record Payment', exact: true }).click();
    const payment = page.getByRole('dialog', { name: 'Record payment', exact: true });
    await expect(payment.getByLabel('Payment amount', { exact: true })).toHaveValue(expected);
    await payment.getByRole('button', { name: 'Back from payment form', exact: true }).click();
  }
  await detail.getByRole('button', { name: 'Back from ' + name, exact: true }).click();
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-22T19:00:00Z'));
  const fixture = createDemoFixture();
  const base = fixture.payload.accounts[0];
  fixture.payload.accounts = [
    { ...base, id: 'small', name: 'Sample small', type: 'Student loan', balance: 500, baselineBalance: 500, minimum: 25, apr: 0 },
    { ...base, id: 'large', name: 'Sample large', type: 'Personal loan', balance: 1000, baselineBalance: 1000, minimum: 25, apr: 24 },
  ];
  fixture.payload.monthlyBudgets = {
    '2026-09': [],
    '2026-10': [
      { id: 'income', name: 'Sample salary', kind: 'income', category: 'Salary', amount: 5000, paymentMethod: 'debit', creditAccountId: '', recurring: true, createdAt: fixture.payload.accounts[0].createdAt },
      { id: 'mortgage', name: 'Sample home', kind: 'expense', category: 'Housing', amount: 600, paymentMethod: 'debit', creditAccountId: '', recurring: true, createdAt: fixture.payload.accounts[0].createdAt },
    ],
  };
  fixture.payload.monthlyPlan = {
    ...fixture.payload.monthlyPlan!,
    payoffPlanAmount: 100, payoffExtraPayment: 75, payoffPlanStrategy: 'avalanche',
    months: { '2026-09': { safetyBuffer: 20, debtPaymentTarget: 120 }, '2026-10': { safetyBuffer: 0, debtPaymentTarget: 120 } },
    loanTrackers: [{ id: 'home', name: 'Sample home', kind: 'house', originalAmount: 20000, remainingAmount: 10000, balanceKind: 'principal', asOf: '2026-10-01', budgetItemId: 'mortgage', budgetItemName: 'Sample home', monthlyPayment: 600, apr: 12, escrow: 100, history: [] }],
  };
  await page.addInitScript(({ key, fixture }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(fixture));
  }, { key: DASHBOARD_STORAGE_KEY, fixture });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Hi Guest!' })).toBeVisible();
});

test('extra, method and minimum edits update Budget and both payment entries, surviving reload and rollover', async ({ page }) => {
  const before = await saved(page);
  let summary = await budget(page, '$125.00');
  await expect(summary.locator('.budget-after strong')).toHaveText('$4,275.00');
  await openSchedule(page);
  await scheduleDialog(page).getByLabel('Extra payment', { exact: true }).fill('175');
  await scheduleDialog(page).getByRole('button', { name: 'Save extra payment', exact: true }).click();
  await closeSchedule(page);
  await budget(page, '$225.00');
  await suggestion(page, 'Sample large', '200');

  await openSchedule(page);
  await scheduleDialog(page).getByRole('button', { name: 'Edit minimums', exact: true }).click();
  const minimums = page.getByRole('dialog', { name: 'Edit minimum payments', exact: true });
  await minimums.getByLabel('Minimum for Sample large', { exact: true }).fill('75');
  await minimums.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('dialog', { name: 'Change saved minimums?', exact: true }).getByRole('button', { name: 'Save minimums', exact: true }).click();
  await closeSchedule(page);
  await budget(page, '$275.00');
  await suggestion(page, 'Sample large', '250');

  await openSchedule(page);
  await scheduleDialog(page).getByLabel('Payoff method', { exact: true }).selectOption('snowball');
  await closeSchedule(page);
  await suggestion(page, 'Sample small', '200');
  await suggestion(page, 'Sample large', '75');
  await expect.poll(async () => (await saved(page)).monthlyPlan.months['2026-10'].debtPaymentTarget).toBe(275);
  await page.reload();
  summary = await budget(page, '$275.00');
  await expect(summary.locator('.budget-after strong')).toHaveText('$4,125.00');
  const after = await saved(page);
  expect(after.monthlyPlan.payoffPlanAmount).toBe(100);
  expect(after.monthlyPlan.payoffExtraPayment).toBe(175);
  expect(after.monthlyPlan.payoffPlanStrategy).toBe('snowball');
  expect(after.monthlyPlan.months['2026-09']).toEqual(before.monthlyPlan.months['2026-09']);
  expect(after.monthlyPlan.progressStartingBalance).toBe(before.monthlyPlan.progressStartingBalance);
  expect(after.monthlyPlan.loanTrackers).toEqual(before.monthlyPlan.loanTrackers);
  for (const key of ['transactions', 'snapshots', 'monthlyBudgets', 'balanceAdjustments']) expect(after[key]).toEqual(before[key]);

  await page.clock.setFixedTime(new Date('2026-11-05T19:00:00Z'));
  await page.reload();
  await nav(page).getByRole('button', { name: 'Budget', exact: true }).click();
  await page.getByRole('button', { name: 'Previous month', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Monthly budget summary' }).locator('.budget-commitment dd')).toHaveText('$275.00');
  expect((await saved(page)).monthlyPlan.months['2026-09']).toEqual(before.monthlyPlan.months['2026-09']);
});

test('zero extra and exclusions retain household obligations, with loan suggestions and no recorded payment', async ({ page }) => {
  const before = await saved(page);
  await openSchedule(page);
  await scheduleDialog(page).getByLabel('Extra payment', { exact: true }).fill('0');
  await scheduleDialog(page).getByRole('button', { name: 'Save extra payment', exact: true }).click();
  await closeSchedule(page);
  await budget(page, '$50.00');

  await openSchedule(page);
  await scheduleDialog(page).getByLabel('Extra payment', { exact: true }).fill('175');
  await scheduleDialog(page).getByRole('button', { name: 'Save extra payment', exact: true }).click();
  await scheduleDialog(page).getByText('Included debt types', { exact: true }).click();
  await scheduleDialog(page).getByLabel('Include Student loan', { exact: true }).uncheck();
  await scheduleDialog(page).getByLabel('Include Personal loan', { exact: true }).uncheck();
  await scheduleDialog(page).getByRole('button', { name: 'Apply included debt types', exact: true }).click();
  await closeSchedule(page);
  const summary = await budget(page, '$225.00');
  await expect(summary.locator('.budget-commitment-detail')).toContainText('Schedule $775.00');
  await expect(summary.locator('.budget-commitment-detail')).toContainText('Outside schedule $50.00');
  await expect(summary.locator('.budget-commitment-detail')).toContainText('Loans in Spending $600.00');
  await suggestion(page, 'Sample large', '25');
  await nav(page).getByRole('button', { name: /^Debts?$/, exact: true }).click();
  await page.getByRole('button', { name: 'Open Sample home', exact: true }).click();
  await page.getByRole('dialog', { name: 'Sample home', exact: true }).getByRole('button', { name: 'Record Payment', exact: true }).click();
  const payment = page.getByRole('dialog', { name: 'Record Sample home payment', exact: true });
  await expect(payment.getByLabel('Regular payment', { exact: true })).toHaveValue('600');
  await expect(payment.getByLabel('Extra principal', { exact: true })).toHaveValue('175');
  const after = await saved(page);
  expect(after.transactions).toEqual(before.transactions);
  expect(after.snapshots).toEqual(before.snapshots);
  expect(after.monthlyPlan.loanTrackers).toEqual(before.monthlyPlan.loanTrackers);
  await payment.getByRole('button', { name: 'Back from payment form', exact: true }).click();
  await page.reload();
  expect((await saved(page)).monthlyPlan.payoffExcludedTypes).toEqual(['Student loan', 'Personal loan']);
});
