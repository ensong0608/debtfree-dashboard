import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';
import { createDemoFixture } from '../../mobile/demo-fixture';
import { DASHBOARD_STORAGE_KEY } from '../../app/data-repository';
import { APPEARANCE_KEY, APPEARANCE_EVENT, THEMES } from '../../app/appearance';

const saved = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!).payload, DASHBOARD_STORAGE_KEY);
const nav = (page: Page) => page.getByRole('navigation', { name: 'Primary navigation' });
const header = (page: Page) => page.locator('.shared-dashboard-header');
const form = (page: Page) => page.getByRole('dialog', { name: 'Add a debt account', exact: true });

async function seed(page: Page, date = '2026-10-26T20:00:00Z', large = false) {
  await page.clock.setFixedTime(new Date(date));
  const fixture = createDemoFixture();
  fixture.payload.accounts.forEach(account => { account.displayOrder = 0; });
  if (large) {
    fixture.payload.accounts[0].balance = 12345678901.23;
    fixture.payload.accounts[0].baselineBalance = 20000000000;
    fixture.payload.accounts[0].name = 'Sample card with a long household account name';
    fixture.payload.monthlyPlan!.progressStartingBalance = 20000000500;
    fixture.payload.snapshots[0].accounts[0].balance = 20000000000;
    fixture.payload.snapshots[0].totalBalance = 20000000500;
  }
  fixture.payload.monthlyPlan!.loanTrackers = [{id:'car',name:'Sample auto',kind:'car',originalAmount:10000,remainingAmount:9000,balanceKind:'payoff',asOf:'2026-10-01',budgetItemId:'',budgetItemName:'',monthlyPayment:300,history:[]}];
  const month = date.slice(0,7);
  if (month === '2027-02') fixture.payload.monthlyPlan!.months['2027-01'] = {safetyBuffer:0,debtPaymentTarget:0,settlements:[{id:'historical-paid',targetId:'bill',name:'Sample bill',kind:'spending',amount:30,date:'2027-01-31',createdAt:'2027-01-31T20:00:00Z',source:'debit'}]};
  fixture.payload.monthlyBudgets[month] = [{id:'bill',name:'Sample bill',kind:'expense',category:'Utilities',amount:30,paymentMethod:'debit',creditAccountId:'',recurring:true,dueDay:31,createdAt:'2026-10-01T12:00:00Z'}];
  await page.addInitScript(({key,fixture,appearanceKey,appearance}) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key,JSON.stringify(fixture));
    if (!localStorage.getItem(appearanceKey)) localStorage.setItem(appearanceKey,JSON.stringify(appearance));
  }, {key:DASHBOARD_STORAGE_KEY,fixture,appearanceKey:APPEARANCE_KEY,appearance:THEMES.light});
  await page.goto('/');
  await expect(page.locator('.home-welcome')).toBeVisible();
  await expect.poll(async () => (await saved(page)).snapshots.some((s:{autoCheckpoint?:string})=>Boolean(s.autoCheckpoint))).toBe(true);
}

test.beforeEach(async ({page}, info) => {
  const host = new URL(String(info.project.use.baseURL)).hostname;
  expect(['localhost','127.0.0.1']).toContain(host);
  await page.setViewportSize({width:390,height:844});
});

test('number editing, nested interest settings, unsaved choices, and save/reopen preserve records', async ({page}) => {
  await seed(page);
  const before = await saved(page);
  await nav(page).getByRole('button',{name:'Debt',exact:true}).click();
  await header(page).getByRole('button',{name:'Add debt',exact:true}).click();
  const dialog = form(page);
  await dialog.getByPlaceholder('Example: Everyday Rewards').fill('New sample');
  const amount = dialog.getByRole('textbox',{name:'Current balance',exact:true});
  await amount.fill(''); await expect(amount).toHaveValue('');
  await amount.pressSequentially('1.'); await expect(amount).toHaveValue('1.');
  await amount.pressSequentially('25'); await expect(amount).toHaveValue('1.25');
  await amount.evaluate(input => {
    const field = input as HTMLInputElement;
    field.setSelectionRange(0,field.value.length);
    const data = new DataTransfer(); data.setData('text/plain','$1,234.56');
    field.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));
  });
  await expect(amount).toHaveValue('1234.56');
  await dialog.getByRole('button',{name:'Advanced',exact:true}).click();
  const advanced = page.getByRole('dialog',{name:'Advanced',exact:true});
  await advanced.getByLabel('Interest method').selectOption('estimate');
  const day = advanced.getByRole('textbox',{name:'Statement closing day',exact:true});
  await day.fill(''); await expect(day).toHaveValue('');
  await day.fill('31');
  const apr = advanced.getByRole('textbox',{name:'Estimated APR',exact:true});
  await apr.fill(''); await expect(apr).toHaveValue('');
  await apr.pressSequentially('12.'); await expect(apr).toHaveValue('12.');
  await apr.pressSequentially('50'); await expect(apr).toHaveValue('12.50');
  await advanced.getByRole('group',{name:'Interest already included through',exact:true}).getByRole('button').click();
  const picker = page.getByRole('dialog',{name:'Interest already included through',exact:true});
  await picker.getByRole('button',{name:'Previous month for Interest already included through',exact:true}).click();
  await picker.getByRole('button',{name:'2026-09-30',exact:true}).click();
  await picker.getByRole('button',{name:'Confirm date',exact:true}).click();
  const through = advanced.getByRole('group',{name:'Interest already included through',exact:true});
  const included = (await through.textContent()) ?? '';
  await advanced.getByLabel('Interest method').selectOption('manual');
  await advanced.getByLabel('Interest method').selectOption('estimate');
  await expect(through).toHaveText(included);
  await advanced.getByRole('button',{name:'Back from Advanced',exact:true}).click();
  await expect(amount).toHaveValue('1234.56');
  await dialog.getByRole('button',{name:'Advanced',exact:true}).click();
  await expect(apr).toHaveValue('12.50');
  await expect(day).toHaveValue('31');
  await advanced.getByRole('button',{name:'Back from Advanced',exact:true}).click();
  await expect(dialog.locator('footer button:visible')).toHaveText(['Save','Advanced']);
  await dialog.getByRole('button',{name:'Back from account form',exact:true}).click();
  const prompt = page.getByRole('dialog',{name:'Unsaved debt account changes',exact:true});
  await prompt.getByRole('button',{name:'Continue Editing',exact:true}).click();
  await expect(amount).toHaveValue('1234.56');
  await dialog.getByRole('button',{name:'Back from account form',exact:true}).click();
  await prompt.getByRole('button',{name:'Save',exact:true}).click();
  await expect(dialog).not.toBeVisible();
  await expect.poll(async () => (await saved(page)).accounts.length).toBe(before.accounts.length+1);
  const after = await saved(page);
  expect(after.accounts.slice(0,before.accounts.length)).toEqual(before.accounts);
  expect(after.transactions).toEqual(before.transactions);
  expect(after.snapshots).toEqual(before.snapshots);
  expect(after.monthlyPlan.progressStartingBalance).toBe(before.monthlyPlan.progressStartingBalance);
  expect(after.accounts.at(-1)).toMatchObject({balance:1234.56,baselineBalance:1234.56,interestAutomation:{closingDay:31,coveredThrough:'2026-09-30',estimatedApr:12.5}});
  await page.reload();
  await nav(page).getByRole('button',{name:'Debt',exact:true}).click();
  await page.getByRole('button',{name:'Open New sample',exact:true}).click();
  const detail = page.getByRole('dialog',{name:'New sample',exact:true});
  await detail.getByRole('tab',{name:'Info',exact:true}).click();
  await expect(detail.getByRole('textbox',{name:'Current balance',exact:true})).toHaveValue('1234.56');
});

test('confirming a February occurrence preserves recurring day 31 and paid history', async ({page}) => {
  await seed(page,'2027-02-26T20:00:00Z');
  await nav(page).getByRole('button',{name:'Budget',exact:true}).click();
  await page.getByRole('region',{name:'Planned spending by category',exact:true}).locator('summary').filter({hasText:'Utilities'}).click();
  await page.getByRole('button',{name:/Sample bill/}).click();
  const dialog = page.getByRole('dialog',{name:'Edit spending',exact:true});
  const before = await saved(page);
  await dialog.getByRole('group',{name:'Due date',exact:true}).getByRole('button').click();
  const picker = page.getByRole('dialog',{name:'Due date',exact:true});
  await expect(picker.getByRole('button',{name:'2027-02-28',exact:true})).toHaveAttribute('aria-pressed','true');
  await picker.getByRole('button',{name:'Confirm date',exact:true}).click();
  await dialog.getByRole('button',{name:'Save',exact:true}).click();
  await expect(dialog).not.toBeVisible();
  await expect.poll(async () => (await saved(page)).monthlyBudgets['2027-02'][0].dueDay).toBe(31);
  const after = await saved(page);
  expect(after.transactions).toEqual(before.transactions);
  expect(after.balanceAdjustments).toEqual(before.balanceAdjustments);
  expect(before.monthlyPlan.months['2027-01'].settlements).toHaveLength(1);
  expect(after.monthlyPlan.months['2027-01']).toEqual(before.monthlyPlan.months['2027-01']);
  expect(after.monthlyPlan.months['2027-02']?.settlements).toEqual(before.monthlyPlan.months['2027-02']?.settlements);
});

test('Debt and Budget reuse scoped transaction cards and preserve discard/delete/restore', async ({page}) => {
  await seed(page);
  const before = await saved(page);
  await nav(page).getByRole('button',{name:'Budget',exact:true}).click();
  await header(page).getByRole('button',{name:'Transactions',exact:true}).click();
  const board = page.locator('.budget-transactions-board');
  await board.getByLabel('Period',{exact:true}).selectOption('lifetime');
  const budgetCard = board.locator('[data-activity-id="transaction:demo-payment"]');
  await expect(budgetCard).toHaveClass('budget-record-card');
  const content = (await budgetCard.locator('.budget-record-main').textContent()) ?? '';
  await nav(page).getByRole('button',{name:'Debt',exact:true}).click();
  await page.getByRole('button',{name:'Open Sample card',exact:true}).click();
  const detail = page.getByRole('dialog',{name:'Sample card',exact:true});
  await detail.getByRole('tab',{name:'Transactions',exact:true}).click();
  await detail.getByLabel('Period',{exact:true}).selectOption('lifetime');
  const debtCard = detail.locator('[data-activity-id="transaction:demo-payment"]');
  await expect(debtCard.locator('.budget-record-main')).toHaveText(content);
  await expect(detail.getByLabel('Account',{exact:true})).toHaveCount(0);
  await expect(detail.locator('.payment-activity')).not.toContainText('Sample travel');
  await debtCard.getByRole('button',{name:/Edit /}).click();
  const entry = page.getByRole('dialog',{name:'Edit transaction',exact:true});
  await entry.getByRole('textbox',{name:'Transaction amount',exact:true}).fill('-12.34');
  await entry.getByRole('button',{name:'Back from transaction',exact:true}).click();
  await page.getByRole('dialog',{name:'Unsaved transaction changes',exact:true}).getByRole('button',{name:'Discard',exact:true}).click();
  expect((await saved(page)).transactions).toEqual(before.transactions);
  await debtCard.getByRole('button',{name:/Edit /}).click();
  if (await entry.getByRole('button',{name:'Delete transaction',exact:true}).count()) {
    await entry.getByRole('button',{name:'Delete transaction',exact:true}).click();
  } else {
    await entry.getByRole('button',{name:'Back from transaction',exact:true}).click();
    await debtCard.getByRole('button',{name:/Delete transaction/}).click();
  }
  await page.getByRole('dialog',{name:'Delete payment?',exact:true}).getByRole('button',{name:'Confirm delete',exact:true}).click();
  await detail.locator('.deleted-payments summary').click();
  await detail.getByRole('button',{name:/Restore payment of/}).click();
  await page.getByRole('dialog',{name:'Restore payment?',exact:true}).getByRole('button',{name:'Confirm restore',exact:true}).click();
  await expect(debtCard).toBeVisible();
  await expect.poll(async () => (await saved(page)).transactions[0].deletedAt).toBeNull();
});

test('both themes and five tabs fit 320/360/390/430/1440, including nested forms and a short viewport', async ({page}) => {
  test.setTimeout(180000);
  await seed(page);
  const before = await saved(page);
  mkdirSync('.wrangler/form-review',{recursive:true});
  for (const theme of ['light','dark'] as const) {
    await page.evaluate(({key,event,appearance}) => {localStorage.setItem(key,JSON.stringify(appearance));window.dispatchEvent(new CustomEvent(event,{detail:appearance}));}, {key:APPEARANCE_KEY,event:APPEARANCE_EVENT,appearance:{...THEMES[theme],size:'larger'}});
    for (const width of [320,360,390,430,1440]) {
      await page.setViewportSize({width,height:900});
      for (const name of ['Home','Debt','Progress','Budget','Settings']) {
        await nav(page).getByRole('button',{name,exact:true}).click();
        expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth+1)).toBe(true);
        if (name === 'Progress') {
          const summary = page.getByRole('region',{name:/debt progress$/});
          const amountsFit = await summary.evaluate(element => {
            const bounds = element.getBoundingClientRect();
            return [...element.querySelectorAll('.money-value')].every(amount => {
              const range = document.createRange(); range.selectNodeContents(amount);
              return [...range.getClientRects()].every(rect => rect.left >= bounds.left-1 && rect.right <= bounds.right+1);
            });
          });
          expect(amountsFit,'Every displayed Progress amount must fit inside its card').toBe(true);
        }
        if (width === 390 || width === 1440) await page.screenshot({path:`.wrangler/form-review/${theme}-${width}-${name}.png`});
      }
      await nav(page).getByRole('button',{name:'Debt',exact:true}).click();
      await header(page).getByRole('button',{name:'Add debt',exact:true}).click();
      const dialog = form(page);
      const back = dialog.getByRole('button',{name:'Back from account form',exact:true});
      const bounds = await back.boundingBox(); expect(bounds!.width).toBeGreaterThanOrEqual(44); expect(bounds!.height).toBeGreaterThanOrEqual(44);
      if (width === 390) await page.screenshot({path:`.wrangler/form-review/${theme}-${width}-Add-Debt.png`});
      const buttons = dialog.locator('footer button:visible');
      await expect(buttons).toHaveText(['Save','Advanced']);
      const first = await buttons.nth(0).boundingBox(), second = await buttons.nth(1).boundingBox();
      expect(Math.abs(first!.width-second!.width)).toBeLessThanOrEqual(1);
      expect(second!.x-(first!.x+first!.width)).toBeGreaterThanOrEqual(10);
      await dialog.getByRole('button',{name:'Advanced',exact:true}).click();
      const advanced = page.getByRole('dialog',{name:'Advanced',exact:true});
      await expect(advanced.getByRole('heading',{name:'Advanced',exact:true})).toBeVisible();
      if (width === 390) {
        await advanced.getByLabel('Interest method').selectOption('estimate');
        const day = advanced.getByRole('textbox',{name:'Statement closing day',exact:true});
        await day.fill(''); await expect(day).toHaveValue(''); await day.fill('2');
        const apr = advanced.getByRole('textbox',{name:'Estimated APR',exact:true});
        await apr.fill('1.'); await expect(apr).toHaveValue('1.'); await apr.fill('12.5');
      }
      expect(await advanced.evaluate(element=>element.scrollWidth<=element.clientWidth+1)).toBe(true);
      if (width === 320 || width === 390) await page.screenshot({path:`.wrangler/form-review/${theme}-${width}-Advanced.png`});
      if (width === 390) expect((await new AxeBuilder({page}).include('[aria-label="Advanced"]').withRules(['color-contrast','button-name','label']).analyze()).violations).toEqual([]);
      await advanced.getByRole('button',{name:'Back from Advanced',exact:true}).click();
      if (width === 390) {
        await page.setViewportSize({width,height:360});
        await dialog.getByRole('button',{name:'Save',exact:true}).scrollIntoViewIfNeeded();
        const box = await dialog.getByRole('button',{name:'Save',exact:true}).boundingBox();
        expect(box!.y+box!.height).toBeLessThanOrEqual(360);
        await page.screenshot({path:`.wrangler/form-review/${theme}-${width}-short-form.png`});
        await page.setViewportSize({width,height:900});
      }
      await back.click();
      const exitPrompt = page.getByRole('dialog',{name:'Unsaved debt account changes',exact:true});
      if (await exitPrompt.count()) await exitPrompt.getByRole('button',{name:'Discard',exact:true}).click();
    }
  }
  const after = await saved(page);
  expect(after.accounts).toEqual(before.accounts);
  expect(after.transactions).toEqual(before.transactions);
  expect(after.snapshots).toEqual(before.snapshots);
  expect(after.monthlyPlan.progressStartingBalance).toBe(before.monthlyPlan.progressStartingBalance);
});

test('income, one-time spending, and loan drafts clear, discard and save independently', async ({page}) => {
  await seed(page);
  const before = await saved(page);
  await nav(page).getByRole('button',{name:'Budget',exact:true}).click();
  await page.getByRole('region',{name:'Monthly budget summary',exact:true}).getByRole('button',{name:'Edit',exact:true}).click();
  await page.getByRole('button',{name:'＋ Add income',exact:true}).click();
  const income = page.getByRole('dialog',{name:'Add income',exact:true});
  await income.getByPlaceholder('Salary').fill('Sample salary');
  await income.getByRole('textbox',{name:'Monthly amount',exact:true}).fill('2500.50');
  await income.getByRole('button',{name:'Back from planned entry form',exact:true}).click();
  await page.getByRole('dialog',{name:'Unsaved planned entry changes',exact:true}).getByRole('button',{name:'Save',exact:true}).click();
  await expect(income).not.toBeVisible();
  await header(page).getByRole('button',{name:'Add planned spending',exact:true}).click();
  const spending = page.getByRole('dialog',{name:'Add recurring spending',exact:true});
  await spending.getByPlaceholder('Electric bill').fill('Sample tires');
  await spending.getByRole('radio',{name:'One time purchase',exact:true}).check();
  const oneTime = page.getByRole('dialog',{name:'Add one-time spending',exact:true});
  const amount = oneTime.getByRole('textbox',{name:'Amount',exact:true});
  await amount.fill(''); await expect(amount).toHaveValue('');
  await amount.fill('125.25');
  await oneTime.getByRole('button',{name:'Save',exact:true}).click();
  await expect(oneTime).not.toBeVisible();
  await nav(page).getByRole('button',{name:'Debt',exact:true}).click();
  await page.getByRole('button',{name:'Open Sample auto',exact:true}).click();
  const loan = page.getByRole('dialog',{name:'Sample auto',exact:true});
  await loan.getByRole('tab',{name:'Info',exact:true}).click();
  const balance = loan.getByRole('textbox',{name:'Current balance',exact:true});
  await balance.fill(''); await expect(balance).toHaveValue('');
  await balance.fill('0'); await expect(balance).toHaveValue('0');
  await loan.getByRole('button',{name:'Back from Sample auto',exact:true}).click();
  await page.getByRole('dialog',{name:'Unsaved loan changes',exact:true}).getByRole('button',{name:'Continue Editing',exact:true}).click();
  await expect(balance).toHaveValue('0');
  await loan.getByRole('button',{name:'Back from Sample auto',exact:true}).click();
  await page.getByRole('dialog',{name:'Unsaved loan changes',exact:true}).getByRole('button',{name:'Discard',exact:true}).click();
  const after = await saved(page);
  expect(after.accounts).toEqual(before.accounts);
  expect(after.transactions).toEqual(before.transactions);
  expect(after.monthlyPlan.loanTrackers).toEqual(before.monthlyPlan.loanTrackers);
  expect(after.monthlyBudgets['2026-10']).toEqual(expect.arrayContaining([
    expect.objectContaining({name:'Sample salary',kind:'income',amount:2500.5}),
    expect.objectContaining({name:'Sample tires',kind:'purchase',recurring:false,amount:125.25})
  ]));
});


test('large Progress amounts stay readable at narrow widths in both themes', async ({page}) => {
  mkdirSync('.wrangler/form-review',{recursive:true});
  await seed(page,'2026-10-26T20:00:00Z',true);
  await nav(page).getByRole('button',{name:'Progress',exact:true}).click();
  for (const theme of ['light','dark'] as const) {
    await page.evaluate(({key,event,appearance}) => {localStorage.setItem(key,JSON.stringify(appearance));window.dispatchEvent(new CustomEvent(event,{detail:appearance}));}, {key:APPEARANCE_KEY,event:APPEARANCE_EVENT,appearance:{...THEMES[theme],size:'larger'}});
    for (const width of [320,390]) {
      await page.setViewportSize({width,height:900});
      const summary = page.getByRole('region',{name:/debt progress$/});
      await expect(summary).toContainText('$12,345,679,301.23');
      expect(await summary.evaluate(element => {
        const bounds = element.getBoundingClientRect();
        return [...element.querySelectorAll('.money-value')].every(amount => {
          const range = document.createRange(); range.selectNodeContents(amount);
          return [...range.getClientRects()].every(rect=>rect.left>=bounds.left-1 && rect.right<=bounds.right+1);
        });
      })).toBe(true);
      await page.screenshot({path:`.wrangler/form-review/${theme}-${width}-large-Progress.png`});
    }
  }
});
