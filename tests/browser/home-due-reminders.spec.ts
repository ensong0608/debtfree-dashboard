import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';
import { createDemoFixture } from '../../mobile/demo-fixture';
import { DASHBOARD_STORAGE_KEY } from '../../app/data-repository';
import { APPEARANCE_KEY, APPEARANCE_EVENT, THEMES } from '../../app/appearance';

const saved = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!).payload, DASHBOARD_STORAGE_KEY);
async function seed(page: Page) {
  await page.clock.setFixedTime(new Date('2026-10-26T20:00:00Z'));
  const fixture = createDemoFixture();
  fixture.payload.transactions = [];
  fixture.payload.accounts.forEach((account, index) => { account.dueDate = `2000-01-${26 + index}`; account.displayOrder = 0; });
  fixture.payload.monthlyBudgets['2026-10'] = [{ id: 'bill', name: 'Electric', kind: 'expense', category: 'Utilities', amount: 80, paymentMethod: 'debit', creditAccountId: '', recurring: true, dueDay: 28, createdAt: '2026-10-01T12:00:00Z' }];
  fixture.payload.monthlyPlan!.loanTrackers = [{ id: 'auto', name: 'Sample auto', kind: 'car', originalAmount: 10000, remainingAmount: 9000, balanceKind: 'payoff', asOf: '2026-10-01', budgetItemId: '', budgetItemName: '', monthlyPayment: 300, dueDate: '2000-01-29', history: [] }];
  await page.addInitScript(({ key, fixture, appearanceKey, appearance }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(fixture));
    if (!localStorage.getItem(appearanceKey)) localStorage.setItem(appearanceKey, JSON.stringify(appearance));
  }, { key: DASHBOARD_STORAGE_KEY, fixture, appearanceKey: APPEARANCE_KEY, appearance: THEMES.light });
  await page.goto('/');
  await expect(page.locator('.home-welcome')).toBeVisible();
  await expect.poll(async () => (await saved(page)).snapshots.some((s: { autoCheckpoint?: string }) => Boolean(s.autoCheckpoint))).toBe(true);
}

test.beforeEach(async ({ page }, info) => {
  expect(['localhost', '127.0.0.1']).toContain(new URL(String(info.project.use.baseURL)).hostname);
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page);
});

test('Home due reminders expand, open matching debt and Budget, and preserve financial records', async ({ page }) => {
  const before = await saved(page);
  let card = page.getByRole('region', { name: 'Upcoming due reminders' });
  await expect(card.getByRole('listitem')).toHaveCount(3);
  await expect(card.getByText('Critical ·', { exact: true })).toHaveCount(3);
  await expect(card.getByRole('listitem').first()).toContainText('Sample card');
  await expect(card.getByRole('listitem').first()).toContainText('Due today');
  await expect(card.getByRole('listitem').nth(1)).toContainText('Due tomorrow');
  await expect(card.getByRole('listitem').nth(2)).toContainText('Electric');
  await card.getByRole('button', { name: 'See all (4)' }).click();
  await expect(card.getByRole('listitem')).toHaveCount(4);
  await card.getByRole('button', { name: /^View Sample auto,/ }).click();
  await expect(page.getByRole('dialog', { name: 'Sample auto', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back from Sample auto', exact: true }).click();
  await expect(card.getByRole('button', { name: /^View Sample auto,/ })).toBeFocused();
  await card.getByRole('button', { name: 'Show less' }).click();
  await expect(card.getByRole('listitem')).toHaveCount(3);
  await card.getByRole('button', { name: /^View Sample card,/ }).click();
  await expect(page.getByRole('dialog', { name: 'Sample card', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back from Sample card', exact: true }).click();
  await card.getByRole('button', { name: /^View Electric,/ }).click();
  await expect(page.locator('.shared-dashboard-header h1')).toHaveText('Planned budget');
  await page.locator('summary').filter({ hasText: 'Utilities' }).click();
  await expect(page.getByRole('button', { name: /Electric/ }).first()).toBeVisible();
  await page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('button', { name: 'Home', exact: true }).click();
  card = page.getByRole('region', { name: 'Upcoming due reminders' });
  await expect(card.getByRole('listitem')).toHaveCount(3);
  const after = await saved(page);
  for (const key of ['accounts', 'transactions', 'balanceAdjustments', 'snapshots', 'monthlyBudgets']) expect(after[key]).toEqual(before[key]);
  expect(after.monthlyPlan.loanTrackers).toEqual(before.monthlyPlan.loanTrackers);
  expect(after.monthlyPlan.progressStartingBalance).toBe(before.monthlyPlan.progressStartingBalance);
});

test('Home due reminders fit both themes, narrow screens and larger text, with an empty state', async ({ page }) => {
  test.setTimeout(120000);
  mkdirSync('.wrangler/home-reminder-review', { recursive: true });
  const card = page.getByRole('region', { name: 'Upcoming due reminders' });
  for (const theme of ['light', 'dark'] as const) {
    await page.evaluate(({ key, event, value }) => { localStorage.setItem(key, JSON.stringify(value)); window.dispatchEvent(new CustomEvent(event, { detail: value })); }, { key: APPEARANCE_KEY, event: APPEARANCE_EVENT, value: { ...THEMES[theme], size: 'larger' } });
    await expect(page.locator('html')).toHaveAttribute('data-text-size', 'larger');
    for (const width of [320, 360, 390, 430, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(card).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      const box = (await card.boundingBox())!;
      for (const button of await card.getByRole('button').all()) {
        const rect = (await button.boundingBox())!;
        expect(rect.height).toBeGreaterThanOrEqual(44);
        expect(rect.x).toBeGreaterThanOrEqual(box.x);
        expect(rect.x + rect.width).toBeLessThanOrEqual(box.x + box.width + 1);
      }
      expect(await card.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
      if (width === 390) await page.screenshot({ path: `.wrangler/home-reminder-review/${theme}-home.png`, fullPage: true });
    }
    expect((await new AxeBuilder({ page }).include('[aria-label="Upcoming due reminders"]').withRules(['color-contrast', 'button-name', 'aria-valid-attr-value']).analyze()).violations).toEqual([]);
  }
  await page.evaluate(key => { const data = JSON.parse(localStorage.getItem(key)!); data.payload.accounts = []; data.payload.monthlyBudgets = {}; data.payload.monthlyPlan.loanTrackers = []; localStorage.setItem(key, JSON.stringify(data)); }, DASHBOARD_STORAGE_KEY);
  await page.reload();
  await expect(card).toHaveCount(0);
});


test('Home reminders appear at ten days, are critical at three, and hide outside the window', async ({page}) => {
  await page.evaluate(key => {
    const data=JSON.parse(localStorage.getItem(key)!);
    const source=data.payload.accounts[0];
    data.payload.accounts=[
      {...source,id:'ten',name:'Ten day card',dueDate:'2000-01-05'},
      {...source,id:'eleven',name:'Eleven day card',dueDate:'2000-01-06'},
      {...source,id:'three',name:'Three day card',dueDate:'2000-01-29'},
      {...source,id:'four',name:'Four day card',dueDate:'2000-01-30'},
    ];
    data.payload.monthlyBudgets={};data.payload.monthlyPlan.loanTrackers=[];
    localStorage.setItem(key,JSON.stringify(data));
  },DASHBOARD_STORAGE_KEY);
  await page.reload();
  const card=page.getByRole('region',{name:'Upcoming due reminders'});
  await expect(card.getByRole('listitem')).toHaveCount(3);
  await expect(card).not.toContainText('Eleven day card');
  await expect(card.getByRole('listitem').filter({hasText:'Three day card'})).toContainText('Critical');
  await expect(card.getByRole('listitem').filter({hasText:'Four day card'})).not.toContainText('Critical');
  await expect(card.getByRole('listitem').filter({hasText:'Ten day card'})).toContainText('In 10 days');
  await page.evaluate(key => {
    const data=JSON.parse(localStorage.getItem(key)!);
    data.payload.accounts=data.payload.accounts.filter((a:{id:string})=>a.id==='eleven');
    localStorage.setItem(key,JSON.stringify(data));
  },DASHBOARD_STORAGE_KEY);
  await page.reload();
  await expect(card).toHaveCount(0);
});


test('an existing account payment can be paired to the due date without another ledger entry', async ({page}) => {
  await page.evaluate(key => {
    const data = JSON.parse(localStorage.getItem(key)!);
    const account = data.payload.accounts[0];
    data.payload.transactions = [{
      id: 'paired-minimum', accountId: account.id, date: '2026-10-26', payeeId: '', payeeName: 'Sample card',
      type: 'payment', category: 'Debt payment', memo: '', title: 'Sample card payment', amount: 5,
      createdAt: '2026-10-26T12:00:00Z', updatedAt: '2026-10-26T12:00:00Z', deletedAt: null, paymentKind: 'combined',
    }];
    localStorage.setItem(key, JSON.stringify(data));
  }, DASHBOARD_STORAGE_KEY);
  await page.reload();
  const before = await saved(page);
  const card = page.getByRole('region', { name: 'Upcoming due reminders' });
  await card.getByRole('button', { name: 'Record or link payment for Sample card', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Payment for Sample card', exact: true });
  await expect(dialog).toContainText('Paid this cycle');
  await expect(dialog).toContainText('Remaining');
  await dialog.getByRole('button', { name: /Sample card payment.*payment/ }).click();
  await expect(dialog).toHaveCount(0);
  await expect(card.getByRole('listitem').filter({ hasText: 'Sample card' })).toContainText('Paid');
  await expect.poll(async () => (await saved(page)).monthlyPlan.duePaymentAssociations?.length).toBe(1);
  await page.reload();
  await expect(card.getByRole('listitem').filter({ hasText: 'Sample card' })).toContainText('Paid');
  const after = await saved(page);
  expect(after.transactions).toEqual(before.transactions);
  expect(after.accounts).toEqual(before.accounts);
  expect(after.balanceAdjustments).toEqual(before.balanceAdjustments);
  expect(after.snapshots).toEqual(before.snapshots);
  expect(after.monthlyPlan.months).toEqual(before.monthlyPlan.months);
  expect(after.monthlyPlan.duePaymentAssociations).toEqual([{ reminderId: 'account:' + before.accounts[0].id, dueDate: '2026-10-26', source: { type: 'transaction', id: 'paired-minimum' } }]);
});
