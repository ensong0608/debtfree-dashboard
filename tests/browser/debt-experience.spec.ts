import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createDemoFixture } from '../../mobile/demo-fixture';
import { DASHBOARD_STORAGE_KEY } from '../../app/data-repository';

test.beforeEach(async ({page}) => {
 const fixture=createDemoFixture();
 fixture.payload.monthlyPlan!.payoffPlanAmount=300;
 fixture.payload.accounts[1].apr=18;
 fixture.payload.monthlyPlan!.loanTrackers=[{id:'home',name:'Sample home',kind:'house',originalAmount:10000,remainingAmount:1000,balanceKind:'principal',asOf:'2026-10-01',budgetItemId:'',budgetItemName:'',apr:12,monthlyPayment:600,escrow:100,dueDate:'2026-10-26',history:[{date:'2025-01-01',amount:1200,balanceKind:'principal',recordedAt:'2025-01-01T12:00:00Z'}]}];
 await page.addInitScript(({key,fixture})=>{if(!localStorage.getItem(key)) localStorage.setItem(key,JSON.stringify(fixture));},{key:DASHBOARD_STORAGE_KEY,fixture});
 await page.goto('/');
 await expect(page.getByRole('heading',{name:'Hi Guest!'})).toBeVisible();
});
const saved=(page:import('@playwright/test').Page)=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).payload,DASHBOARD_STORAGE_KEY);

test('five tabs, Home search/sort and unified mixed-type Debt list', async({page})=>{
 const nav=page.getByRole('navigation',{name:'Primary navigation'});
 await expect(nav.getByRole('button')).toHaveText(['Home','Debt','Progress','Budget','Settings']);
 const debts=page.getByRole('region',{name:'Your debts',exact:true});
 await expect(debts.getByRole('button',{name:/^Open /})).toHaveText([/Sample card/,/Sample home/,/Sample travel/]);
 await page.getByLabel('Sort debts').selectOption('apr');
 await expect(debts.getByRole('button',{name:/^Open /}).first()).toHaveAttribute('aria-label','Open Sample travel');
 await page.getByLabel('Sort debts').selectOption('amount');
 await expect(debts.getByRole('button',{name:/^Open /}).first()).toHaveAttribute('aria-label','Open Sample home');
 await page.getByRole('searchbox',{name:'Search debts'}).fill('TRAVEL');
 await expect(debts.getByRole('button',{name:/^Open /})).toHaveCount(1);
 await nav.getByRole('button',{name:'Debt',exact:true}).click();
 await expect(page.getByRole('region',{name:'Debt list'}).getByRole('button',{name:/^Open /})).toHaveCount(3);
 await expect(page.getByRole('tab',{name:'House & car',exact:true})).toHaveCount(0);
 for(const name of ['Progress','Budget','Settings']) {await nav.getByRole('button',{name,exact:true}).click();await expect(page.locator('.page-heading h1')).toHaveText(name);}
 await expect(page.getByRole('button',{name:'Open Settings',exact:true})).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth+1)).toBe(true);
});

test('debt Overview, scoped lifetime Transactions, Info and Advanced preserve unrelated records',async({page})=>{
 const before=await saved(page);
 await page.getByRole('button',{name:'Open Sample card',exact:true}).click();
 const detail=page.getByRole('dialog',{name:'Sample card',exact:true});
 await expect(detail.getByRole('tab')).toHaveText(['Overview','Transactions','Info']);
 await detail.getByRole('tab',{name:'Transactions',exact:true}).click();
 await expect(detail.getByLabel('Period',{exact:true})).toHaveValue('lifetime');
 await expect(detail.locator('.clean-transaction-card')).toHaveCount(1);
 await expect(detail.locator('.payment-activity')).not.toContainText('Sample travel');
 await detail.getByRole('button',{name:'Add transaction',exact:true}).click();
 const entry=page.getByRole('dialog',{name:'New transaction',exact:true});
 await expect(entry.getByLabel('Card used')).toHaveValue('demo-card');
 await expect(entry.getByLabel('Card used')).toBeDisabled();
 await entry.getByRole('button',{name:'Back from transaction'}).click();
 await detail.getByRole('tab',{name:'Info',exact:true}).click();
 await expect(detail.getByLabel('Debt category')).toHaveCount(0);
 await expect(detail.getByText('Position in category')).toHaveCount(0);
 await expect(detail.getByText('Actual interest fee',{exact:true})).toHaveCount(0);
 await detail.getByLabel('Account name',{exact:true}).fill('Renamed card');
 await detail.getByRole('button',{name:'Advanced',exact:true}).click();
 const advanced=page.getByRole('dialog',{name:'Advanced',exact:true});
 await expect(advanced.getByRole('spinbutton',{name:/^Actual interest fee/})).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(advanced).toHaveCount(0);
 await detail.getByRole('button',{name:'Save',exact:true}).click();
 await expect.poll(async()=>(await saved(page)).accounts[0].name).toBe('Renamed card');
 const after=await saved(page);
 for(const key of ['transactions','balanceAdjustments','snapshots','monthlyBudgets']) expect(after[key]).toEqual(before[key]);
 expect(after.monthlyPlan.progressStartingBalance).toBe(before.monthlyPlan.progressStartingBalance);
 expect(after.monthlyPlan.loanTrackers).toEqual(before.monthlyPlan.loanTrackers);
 await page.getByRole('button',{name:'Back from Renamed card'}).click();
 await expect(page.getByRole('button',{name:'Open Renamed card',exact:true})).toBeFocused();
 await page.reload();
 await expect(page.getByRole('button',{name:'Open Renamed card',exact:true})).toBeVisible();
});

test('recording a payment within a debt persists and does not affect another debt',async({page})=>{
 const before=await saved(page);
 await page.getByRole('button',{name:'Open Sample travel',exact:true}).click();
 await page.getByRole('dialog',{name:'Sample travel',exact:true}).getByRole('button',{name:'Record Payment',exact:true}).click();
 const payment=page.getByRole('dialog').last();
 await expect(payment.getByRole('heading',{name:'Record payment',exact:true})).toBeVisible();
 await payment.getByLabel('Payment amount',{exact:true}).fill('50');
 await payment.getByRole('button',{name:/Save payment|Record Payment|Confirm payment/}).click();
 await expect.poll(async()=>(await saved(page)).transactions.length).toBe(before.transactions.length+1);
 const after=await saved(page);
 expect(after.transactions.at(-1).accountId).toBe('demo-travel');
 expect(after.accounts[0]).toEqual(before.accounts[0]);
 expect(after.snapshots).toEqual(before.snapshots);
});

test('mortgage detail retains old history, edits safely and records principal once',async({page})=>{
 const before=await saved(page);
 await page.getByRole('button',{name:'Open Sample home',exact:true}).click();
 const detail=page.getByRole('dialog',{name:'Sample home',exact:true});
 await detail.getByRole('tab',{name:'Transactions',exact:true}).click();
 await expect(detail).toContainText('2025');
 await detail.getByRole('tab',{name:'Info',exact:true}).click();
 await expect(detail.getByLabel('Original balance',{exact:true})).toHaveCount(0);
 await detail.getByRole('button',{name:'Advanced',exact:true}).click();
 const advanced=page.getByRole('dialog',{name:'Advanced',exact:true});
 await expect(advanced.getByLabel('Original balance',{exact:true})).toHaveValue('10,000.00');
 await advanced.getByRole('button',{name:'Back from Advanced'}).click();
 await detail.getByLabel('Name*',{exact:true}).fill('Renamed home');
 await detail.getByRole('button',{name:'Save',exact:true}).click();
 await expect.poll(async()=>(await saved(page)).monthlyPlan.loanTrackers[0].name).toBe('Renamed home');
 const after=await saved(page);
 expect(after.monthlyPlan.loanTrackers[0]).toEqual({...before.monthlyPlan.loanTrackers[0],name:'Renamed home'});
 await page.getByRole('dialog',{name:'Renamed home',exact:true}).getByRole('button',{name:'Record Payment',exact:true}).click();
 const payment=page.getByRole('dialog',{name:'Record Renamed home payment',exact:true});
 await expect(payment).toContainText('Principal deducted: $490.00');
 await payment.getByRole('button',{name:'Confirm payment',exact:true}).click();
 await expect.poll(async()=>(await saved(page)).monthlyPlan.loanTrackers[0].remainingAmount).toBe(510);
 expect((await saved(page)).transactions).toEqual(before.transactions);
});

test('Home preview opens one complete schedule, supports keyboard back and fits mobile',async({page},info)=>{
 const before=await saved(page);
 await page.getByRole('button',{name:'Open full schedule',exact:false}).click();
 const schedule=page.getByRole('dialog',{name:'Payoff Schedule',exact:true});
 await expect(schedule.getByRole('table')).toBeVisible();
 await expect(schedule.getByRole('table').locator('tbody tr').last()).toContainText('$0.00');
 await expect(schedule.getByRole('table')).toContainText('Sample home paid off!');
 await schedule.getByLabel('Debt account payment budget').fill('400');
 await expect.poll(async()=>(await saved(page)).monthlyPlan.payoffPlanAmount).toBe(400);
 const after=await saved(page);
 for(const key of ['accounts','transactions','balanceAdjustments','snapshots','monthlyBudgets']) expect(after[key]).toEqual(before[key]);
 expect(after.monthlyPlan.loanTrackers).toEqual(before.monthlyPlan.loanTrackers);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth+1)).toBe(true);
 const scan=await new AxeBuilder({page}).include('[aria-label="Payoff Schedule"][role="dialog"]').withRules(['color-contrast','button-name','label']).analyze();expect(scan.violations).toEqual([]);
 await page.screenshot({path:`outputs/redesign/schedule-${info.project.name}.png`,fullPage:true});
 await page.keyboard.press('Escape');
 await expect(schedule).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Open full schedule',exact:false})).toBeFocused();
 await page.screenshot({path:`outputs/redesign/home-${info.project.name}.png`,fullPage:true});
});


test('Debt + creates mortgage and car records, validates missing values and preserves the existing household', async({page})=>{
 const before=await saved(page);
 await page.getByRole('navigation',{name:'Primary navigation'}).getByRole('button',{name:'Debt',exact:true}).click();
 for(const kind of ['House loan','Car loan']) {
  await page.getByRole('button',{name:'Debt +',exact:true}).click();
  const creation=page.getByRole('dialog',{name:'Add a debt account',exact:true});
  await creation.getByLabel('Account name',{exact:true}).fill(`New ${kind}`);
  await creation.getByRole('combobox',{name:'Debt type',exact:true}).selectOption({label:kind});
  const loan=page.getByRole('dialog',{name:kind === 'House loan' ? 'Mortgage Details' : 'Car Loan Details',exact:true});
  await loan.getByRole('button',{name:'Save',exact:true}).click();
  await expect(loan.getByText('Enter an original loan amount greater than $0.',{exact:true})).toBeVisible();
  await loan.getByLabel('Original balance',{exact:true}).fill('10000');
  await loan.getByLabel('Current balance',{exact:true}).fill('8000');
  await loan.getByLabel('APR*',{exact:true}).fill('5');
  await loan.getByLabel(kind === 'House loan' ? 'Mortgage payment' : 'Minimum payment',{exact:true}).fill('500');
  if(kind === 'House loan') await loan.getByLabel('Escrow amount',{exact:true}).fill('100');
  await loan.getByRole('button',{name:'Save',exact:true}).click();
  await expect(loan).toHaveCount(0);
  await expect(page.getByRole('button',{name:`Open New ${kind}`,exact:true})).toBeVisible();
 }
 await expect.poll(async()=>(await saved(page)).monthlyPlan.loanTrackers.length).toBe(3);
 const after=await saved(page);
 for(const key of ['accounts','transactions','snapshots','balanceAdjustments','monthlyBudgets']) expect(after[key]).toEqual(before[key]);
 expect(after.monthlyPlan.progressStartingBalance).toBe(before.monthlyPlan.progressStartingBalance);
 await page.reload();
 await page.getByRole('navigation',{name:'Primary navigation'}).getByRole('button',{name:'Debt',exact:true}).click();
 await expect(page.getByRole('button',{name:'Open New Car loan',exact:true})).toBeVisible();
});
