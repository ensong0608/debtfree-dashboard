import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createDemoFixture } from '../../mobile/demo-fixture';
import { DASHBOARD_STORAGE_KEY } from '../../app/data-repository';
import { APPEARANCE_KEY, APPEARANCE_EVENT, THEMES } from '../../app/appearance';

test.beforeEach(async ({page}, info) => {
 const fixture=createDemoFixture();
 fixture.payload.monthlyPlan!.payoffPlanAmount=300;
 fixture.payload.accounts[1].apr=info.title.startsWith("summary swipe")?26.49:18;
 if(info.title.startsWith("Home preview")) fixture.payload.accounts[1].name="Sample travel with a very long household debt name that wraps";
 fixture.payload.monthlyPlan!.loanTrackers=[{id:'home',name:'Sample home',kind:'house',originalAmount:10000,remainingAmount:1000,balanceKind:'principal',asOf:'2026-10-01',budgetItemId:'',budgetItemName:'',apr:12,monthlyPayment:600,escrow:100,dueDate:'2026-10-26',history:[{date:'2025-01-01',amount:1200,balanceKind:'principal',recordedAt:'2025-01-01T12:00:00Z'}]}];
 if(info.title.startsWith('schedule choices')) {
  fixture.payload.accounts[0].balance=47756.06;fixture.payload.accounts[0].baselineBalance=60000;fixture.payload.accounts[0].apr=26.49;fixture.payload.accounts[0].minimum=1500;fixture.payload.monthlyPlan!.progressStartingBalance=60500;fixture.payload.snapshots[0].accounts[0].balance=60000;fixture.payload.snapshots[0].totalBalance=60500;
  fixture.payload.monthlyPlan!.loanTrackers![0]={...fixture.payload.monthlyPlan!.loanTrackers![0],originalAmount:350000,remainingAmount:312700.58,apr:5,monthlyPayment:2500};
  fixture.payload.monthlyPlan!.loanTrackers!.push({id:'car',name:'Sample auto',kind:'car',originalAmount:40000,remainingAmount:20138.97,balanceKind:'principal',asOf:'2026-10-01',budgetItemId:'',budgetItemName:'',apr:5,monthlyPayment:587.30,history:[]});
 }
 await page.addInitScript(({key,fixture})=>{if(!localStorage.getItem(key)) localStorage.setItem(key,JSON.stringify(fixture));},{key:DASHBOARD_STORAGE_KEY,fixture});
 await page.goto('/');
 await expect(page.getByRole('heading',{name:/Welcome,/})).toBeVisible();
 if (!info.title.startsWith('five tabs') && !info.title.startsWith('Home preview')) await page.getByRole('navigation',{name:'Primary navigation'}).getByRole('button',{name:/^Debts?$/,exact:true}).click();
});
const saved=(page:import('@playwright/test').Page)=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).payload,DASHBOARD_STORAGE_KEY);

test('five tabs, separate Home summary and searchable unified Debt list', async({page})=>{
 const nav=page.getByRole('navigation',{name:'Primary navigation'});
 await expect(nav.getByRole('button')).toHaveText(['Home','Debt','Progress','Budget','Settings']);
 await expect(page.getByRole('region',{name:'Total household debt',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:/^Open Sample/})).toHaveCount(0);
 await expect(page.getByRole('searchbox',{name:'Search debts'})).toHaveCount(0);
 await nav.getByRole('button',{name:/^Debts?$/,exact:true}).click();
 const debts=page.getByRole('region',{name:'Debt list',exact:true});
 await expect(page.getByRole('region',{name:'Debt summary',exact:true})).toContainText('Minimum payments');
 await expect(debts.getByRole('button',{name:/^Open /})).toHaveText([/Sample card/,/Sample travel/,/Sample home/]);
 const filters=debts.getByRole('navigation',{name:'Debt type filters'});
 await filters.getByRole('button',{name:/Credit cards/}).click();
 await expect(debts.getByRole('button',{name:/^Open /})).toHaveCount(2);
 await filters.getByRole('button',{name:/Loans & other/}).click();
 await expect(debts.getByRole('button',{name:/^Open /})).toHaveCount(1);
 await expect(debts.getByRole('button',{name:'Open Sample home'})).toBeVisible();
 await filters.getByRole('button',{name:/All/}).click();
 await debts.getByRole('navigation',{name:'Household group filters'}).getByRole('button',{name:'Travel',exact:true}).click();
 await expect(debts.getByRole('button',{name:/^Open /})).toHaveCount(1);
 await expect(debts.getByRole('button',{name:'Open Sample travel'})).toBeVisible();
 await debts.getByRole('navigation',{name:'Household group filters'}).getByRole('button',{name:'All groups',exact:true}).click();
 await page.getByLabel('Sort debts').selectOption('apr');
 await expect(debts.getByRole('button',{name:/^Open /}).first()).toHaveAttribute('aria-label','Open Sample travel');
 await page.getByLabel('Sort debts').selectOption('amount');
 await expect(debts.getByRole('button',{name:/^Open /}).first()).toHaveAttribute('aria-label','Open Sample home');
 await page.getByRole('searchbox',{name:'Search debts'}).fill('TRAVEL');
 await expect(debts.getByRole('button',{name:/^Open /})).toHaveCount(1);
 await page.getByRole('searchbox',{name:'Search debts'}).fill('');
 await nav.getByRole('button',{name:/^Debts?$/,exact:true}).click();
 await expect(page.getByRole('region',{name:'Debt list'}).getByRole('button',{name:/^Open /})).toHaveCount(3);
 await expect(page.getByRole('tab',{name:'House & car',exact:true})).toHaveCount(0);
 for(const name of ['Budget','Settings']) {await nav.getByRole('button',{name,exact:true}).click();await expect(page.locator('.page-heading h1')).toHaveText(name);}
 await expect(page.getByRole('button',{name:'Open Settings',exact:true})).toHaveCount(0);
 if((await page.viewportSize())!.width<=820) {await page.getByRole('button',{name:'Open Account',exact:true}).click();await expect(page.locator('.page-heading h1')).toHaveText('Account');await page.getByRole('button',{name:'Close Account',exact:true}).click();await nav.getByRole('button',{name:'Progress',exact:true}).click();await expect(page.locator('.page-heading h1')).toHaveText('Progress');}
 expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth+1)).toBe(true);
});

test('debt Overview, scoped lifetime Transactions, Info and Advanced preserve unrelated records',async({page})=>{
 const before=await saved(page);
 await page.getByRole('button',{name:'Open Sample card',exact:true}).click();
 const detail=page.getByRole('dialog',{name:'Sample card',exact:true});
 await expect(detail.getByRole('tab')).toHaveText(['Overview','Transactions','Info']);
 await expect(detail.getByRole('img',{name:'Card balance after recorded payments, purchases, fees and adjustments'})).toBeVisible();
 await expect(detail.getByText('Starting balance',{exact:true})).toBeVisible();
 await expect(detail.getByText('Review schedule',{exact:true})).toHaveCount(0);
 await page.screenshot({path:'outputs/redesign/card-overview-history.png'});
 await detail.getByRole('tab',{name:'Transactions',exact:true}).click();
 await expect(detail.getByLabel('Period',{exact:true})).toHaveValue('month:'+new Date().toISOString().slice(0,7));
 await expect(detail.getByLabel('Period').locator('option')).toHaveCount(3);
 await expect(detail.getByRole('button',{name:'Record Payment',exact:true})).toHaveCount(0);
 await expect(detail.getByRole('button',{name:'Add transaction',exact:true})).toHaveCount(0);
 await expect(detail.getByText('Debt history',{exact:true})).toHaveCount(0);
 await expect(detail.locator('.clean-transaction-card')).toHaveCount(1);
 await expect(detail.locator('.payment-activity')).not.toContainText('Sample travel');
 await detail.getByRole('button',{name:'+ Transaction',exact:true}).click();
 const entry=page.getByRole('dialog',{name:'New transaction',exact:true});
 await expect(entry.getByLabel('Card used')).toHaveValue('demo-card');
 await expect(entry.getByLabel('Card used')).toBeDisabled();
 await entry.getByRole('button',{name:'Back from transaction'}).click();
 await detail.getByRole('tab',{name:'Info',exact:true}).click();
 await expect(detail.getByLabel('Due day',{exact:true})).toHaveValue('2026-10-25');
 await expect(detail.getByLabel('Debt category')).toHaveCount(0);
 await expect(detail.getByText('Position in category')).toHaveCount(0);
 await expect(detail.getByLabel('Household group')).toHaveValue('Other');
 await detail.getByLabel('Household group').selectOption('group-travel');
 await detail.getByLabel('Position in group').selectOption('1');
 await expect(detail.getByText('Actual interest fee',{exact:true})).toHaveCount(0);
 await detail.getByLabel('Account name',{exact:true}).fill('Renamed card');
 await detail.getByRole('button',{name:'Advanced',exact:true}).click();
 const advanced=page.getByRole('dialog',{name:'Advanced',exact:true});
 await expect(advanced.getByRole('spinbutton',{name:/^Actual interest fee/})).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(advanced).toHaveCount(0);
 await detail.getByRole('button',{name:'Save',exact:true}).click();
 await expect.poll(async()=>(await saved(page)).accounts[0].name).toBe('Renamed card');
 await expect.poll(async()=>(await saved(page)).accounts[0].displayGroup).toBe('group-travel');
 const after=await saved(page);
 for(const key of ['transactions','balanceAdjustments','snapshots','monthlyBudgets']) expect(after[key]).toEqual(before[key]);
 expect(after.monthlyPlan.progressStartingBalance).toBe(before.monthlyPlan.progressStartingBalance);
 expect(after.monthlyPlan.loanTrackers).toEqual(before.monthlyPlan.loanTrackers);
 await page.getByRole('button',{name:'Back from Renamed card'}).click();
 await expect(page.getByRole('button',{name:'Open Renamed card',exact:true})).toBeFocused();
 await page.reload();
 await page.getByRole('navigation',{name:'Primary navigation'}).getByRole('button',{name:/^Debts?$/,exact:true}).click();
 await expect(page.getByRole('button',{name:'Open Renamed card',exact:true})).toBeVisible();
});

test('account drafts offer save, discard and cancel only after edits; transaction drafts guard close',async({page})=>{
 const before=await saved(page);
 await page.getByRole('button',{name:'Open Sample card',exact:true}).click();
 let detail=page.getByRole('dialog',{name:'Sample card',exact:true});
 await detail.getByRole('tab',{name:'Info',exact:true}).click();
 await expect(detail.getByRole('button',{name:'Save',exact:true})).toHaveCount(0);
 await detail.getByRole('tab',{name:'Overview',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'Unsaved debt account changes'})).toHaveCount(0);
 await page.getByRole('button',{name:'Back from Sample card'}).click();

 await page.getByRole('button',{name:'Open Sample card',exact:true}).click();
 detail=page.getByRole('dialog',{name:'Sample card',exact:true});
 await detail.getByRole('tab',{name:'Info',exact:true}).click();
 await detail.getByLabel('Account name',{exact:true}).fill('Discarded card name');
 await expect(detail.getByRole('button',{name:'Save',exact:true})).toBeVisible();
 await detail.getByRole('tab',{name:'Transactions',exact:true}).click();
 let exit=page.getByRole('dialog',{name:'Unsaved debt account changes'});
 await exit.getByRole('button',{name:'Cancel',exact:true}).click();
 await expect(detail.getByLabel('Account name',{exact:true})).toHaveValue('Discarded card name');
 await detail.getByRole('tab',{name:'Transactions',exact:true}).click();
 exit=page.getByRole('dialog',{name:'Unsaved debt account changes'});
 await exit.getByRole('button',{name:'Discard',exact:true}).click();
 await expect(detail.getByRole('tab',{name:'Transactions',exact:true})).toHaveAttribute('aria-selected','true');
 await expect(detail.getByRole('button',{name:'Save',exact:true})).toHaveCount(0);
 expect((await saved(page)).accounts[0].name).toBe('Sample card');

 await detail.getByRole('button',{name:'+ Transaction',exact:true}).click();
 const transaction=page.getByRole('dialog',{name:'New transaction',exact:true});
 await transaction.getByLabel('What’s it for?',{exact:true}).fill('Unsaved synthetic transaction');
 await transaction.getByRole('button',{name:'Back from transaction'}).click();
 const transactionExit=page.getByRole('dialog',{name:'Unsaved transaction changes'});
 await transactionExit.getByRole('button',{name:'Cancel',exact:true}).click();
 await expect(transaction).toBeVisible();
 await transaction.getByRole('button',{name:'Back from transaction'}).click();
 await page.getByRole('dialog',{name:'Unsaved transaction changes'}).getByRole('button',{name:'Discard',exact:true}).click();
 await expect(transaction).toHaveCount(0);
 expect((await saved(page)).transactions).toEqual(before.transactions);

 await detail.getByRole('tab',{name:'Info',exact:true}).click();
 await detail.getByLabel('Account name',{exact:true}).fill('Saved synthetic card');
 await page.keyboard.press('Escape');
 exit=page.getByRole('dialog',{name:'Unsaved debt account changes'});
 await exit.getByRole('button',{name:'Save',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'Saved synthetic card'})).toHaveCount(0);
 expect((await saved(page)).accounts[0].name).toBe('Saved synthetic card');
});

test('recording a payment within a debt persists and does not affect another debt',async({page})=>{
 const before=await saved(page);
 await page.getByRole('button',{name:'Open Sample travel',exact:true}).click();
 await page.getByRole('dialog',{name:'Sample travel',exact:true}).getByRole('button',{name:'+ Transaction',exact:true}).click();
 const payment=page.getByRole('dialog').last();
 await expect(payment.getByRole('heading',{name:'New transaction',exact:true})).toBeVisible();
 await payment.getByLabel('What’s it for?',{exact:true}).fill('Payment');
 await payment.getByLabel('Transaction amount',{exact:true}).fill('-50');
 await expect(payment.getByLabel('Transaction date')).toBeEnabled();
 await payment.getByRole('button',{name:'Save transaction',exact:true}).click();
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
 await expect(schedule.getByRole('table')).toContainText(/Sample home\s*projected paid off/) ;
 await expect(schedule.getByRole('textbox')).toHaveCount(1);
 await schedule.getByLabel('Extra payment',{exact:true}).fill('400');
 await schedule.getByRole('button',{name:'Save extra payment'}).click();
 await expect.poll(async()=>(await saved(page)).monthlyPlan.payoffExtraPayment).toBe(400);
 const after=await saved(page);
 for(const key of ['accounts','transactions','balanceAdjustments','snapshots','monthlyBudgets']) expect(after[key]).toEqual(before[key]);
 expect(after.monthlyPlan.loanTrackers).toEqual(before.monthlyPlan.loanTrackers);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth+1)).toBe(true);
 if(info.project.name==='phone') for(const width of [320,360,390,430]) {
  await page.setViewportSize({width,height:844});
  const table=await schedule.getByRole('table').boundingBox();
  expect(table!.x).toBeGreaterThanOrEqual(0); expect(table!.x+table!.width).toBeLessThanOrEqual(width);
  const headers=await schedule.locator('thead th').all(); const cells=await schedule.locator('tbody tr').first().locator('th,td').all();
  expect(headers).toHaveLength(4); expect(cells).toHaveLength(4);
  for(let i=0;i<4;i++) {const h=await headers[i].boundingBox(), c=await cells[i].boundingBox();expect(Math.abs(h!.x-c!.x)).toBeLessThan(1);expect(Math.abs(h!.width-c!.width)).toBeLessThan(1);}
  expect(await schedule.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
 }
 await page.setViewportSize(info.project.name==='phone'?{width:390,height:844}:{width:1440,height:1000});
 const scan=await new AxeBuilder({page}).include('[aria-label="Payoff Schedule"][role="dialog"]').withRules(['color-contrast','button-name','label']).analyze();expect(scan.violations).toEqual([]);
 const back=schedule.getByRole('button',{name:'Close payoff schedule and go back'});
 const beforeBack=await back.boundingBox();
 await schedule.locator('[class*="scheduleScroll"]').evaluate(el=>{el.scrollTop=el.scrollHeight;});
 expect((await back.boundingBox())!.y).toBe(beforeBack!.y);
 await schedule.locator('[class*="scheduleScroll"]').evaluate(el=>{el.scrollTop=0;});
 await page.screenshot({path:`outputs/redesign/schedule-${info.project.name}.png`,fullPage:true});
 await page.keyboard.press('Escape');
 await expect(schedule).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Open full schedule',exact:false})).toBeFocused();
 await page.getByRole('navigation',{name:'Primary navigation'}).getByRole('button',{name:'Settings',exact:true}).click();
 await page.getByRole('button',{name:'Payoff Schedule',exact:true}).click();
 await expect(schedule).toBeVisible();
 await schedule.getByRole('button',{name:'Close payoff schedule and go back'}).click();
 await page.getByRole('navigation',{name:'Primary navigation'}).getByRole('button',{name:'Home',exact:true}).click();
 await page.locator('.page-body').evaluate(el=>{el.scrollTop=0;});
 await page.screenshot({path:`outputs/redesign/home-${info.project.name}.png`,fullPage:true});
});


test('Debt + creates mortgage and car records, validates missing values and preserves the existing household', async({page})=>{
 const before=await saved(page);
 await page.getByRole('navigation',{name:'Primary navigation'}).getByRole('button',{name:/^Debts?$/,exact:true}).click();
 for(const kind of ['Mortgage','Car loan']) {
  await page.getByRole('button',{name:'Debt +',exact:true}).click();
  const creation=page.getByRole('dialog',{name:'Add a debt account',exact:true});
  await creation.getByLabel('Account name',{exact:true}).fill(`New ${kind}`);
  await creation.getByRole('combobox',{name:'Debt type',exact:true}).selectOption({label:kind});
  const loan=page.getByRole('dialog',{name:kind === 'Mortgage' ? 'Mortgage Details' : 'Car Loan Details',exact:true});
  await loan.getByRole('button',{name:'Save',exact:true}).click();
  await expect(loan.getByText('Enter an original loan amount greater than $0.',{exact:true})).toBeVisible();
  await loan.getByLabel('Original balance',{exact:true}).fill('10000');
  await loan.getByLabel('Current balance',{exact:true}).fill('8000');
  await loan.getByLabel('APR*',{exact:true}).fill('5');
  await loan.getByLabel(kind === 'Mortgage' ? 'Mortgage payment' : 'Minimum payment',{exact:true}).fill('500');
  if(kind === 'Mortgage') await loan.getByLabel('Escrow amount',{exact:true}).fill('100');
  await loan.getByRole('button',{name:'Save',exact:true}).click();
  await expect(loan).toHaveCount(0);
  await expect(page.getByRole('button',{name:`Open New ${kind}`,exact:true})).toBeVisible();
 }
 await expect.poll(async()=>(await saved(page)).monthlyPlan.loanTrackers.length).toBe(3);
 const after=await saved(page);
 for(const key of ['accounts','transactions','snapshots','balanceAdjustments','monthlyBudgets']) expect(after[key]).toEqual(before[key]);
 expect(after.monthlyPlan.progressStartingBalance).toBe(before.monthlyPlan.progressStartingBalance);
 await page.reload();
 await page.getByRole('navigation',{name:'Primary navigation'}).getByRole('button',{name:/^Debts?$/,exact:true}).click();
 await expect(page.getByRole('button',{name:'Open New Car loan',exact:true})).toBeVisible();
});

test('mortgage and car forms keep long names readable in Light and Dark',async({page})=>{
 for(const theme of ['light','dark'] as const){
  await page.evaluate(({key,event,value})=>{localStorage.setItem(key,JSON.stringify(value));window.dispatchEvent(new CustomEvent(event,{detail:value}));},{key:APPEARANCE_KEY,event:APPEARANCE_EVENT,value:THEMES[theme]});
  for(const kind of ['Mortgage','Car loan']){
   await page.getByRole('button',{name:'Debt +',exact:true}).click();
   const creation=page.getByRole('dialog',{name:'Add a debt account',exact:true});
   await creation.getByLabel('Account name',{exact:true}).fill('Long household account name for the vehicle or primary residence loan');
   await creation.getByRole('combobox',{name:'Debt type',exact:true}).selectOption({label:kind});
   const loan=page.getByRole('dialog',{name:kind==='Mortgage'?'Mortgage Details':'Car Loan Details',exact:true});
   await expect(loan.getByLabel('Name*',{exact:true})).toHaveValue('Long household account name for the vehicle or primary residence loan');
   expect(await loan.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
   const colors=await loan.evaluate(el=>({background:getComputedStyle(el).backgroundColor,color:getComputedStyle(el).color}));
   expect(colors.background).not.toBe('rgba(0, 0, 0, 0)');
   await loan.getByRole('button',{name:'Cancel',exact:true}).click();
  }
 }
});

test('summary swipe and remembered sort keep card totals separate from loans',async({page})=>{
 const summary=page.getByRole('region',{name:'Debt summary',exact:true});
 await expect(summary).toContainText('$2,400.00');
 await summary.getByRole('button',{name:'Card debts',exact:true}).click();
 await expect(summary).toContainText('$1,400.00');await expect(summary).not.toContainText('$2,400.00');
 await page.getByLabel('Sort debts').selectOption('amount');
 await page.reload();await page.getByRole('navigation',{name:'Primary navigation'}).getByRole('button',{name:/^Debts?$/,exact:true}).click();
 await expect(summary.getByRole('button',{name:'Card debts',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(page.getByLabel('Sort debts')).toHaveValue('amount');
 const box=(await summary.boundingBox())!;
 await page.mouse.move(box.x+70,box.y+70);await page.mouse.down();await page.mouse.move(box.x+180,box.y+70,{steps:6});await page.mouse.up();
 await expect(summary.getByRole('button',{name:'Total outstanding debt',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(summary).toContainText('$2,400.00');
 await expect(page.getByRole('button',{name:'Open Sample card',exact:true}).getByRole('progressbar')).toHaveAttribute('aria-valuenow','10');
 await expect(page.getByRole('button',{name:'Open Sample travel',exact:true}).locator('[class*=highApr]')).toHaveCSS('color', 'rgb(179, 33, 67)');
 await expect(page.getByRole('button',{name:'Open Sample card',exact:true}).locator('[class*=lowApr]')).toHaveCSS('color', 'rgb(0, 116, 88)');
 await page.screenshot({path:'outputs/redesign/debts-refined.png'});
});

test('credit card drafts survive tabs, transactions confirm independently and balance edits reconcile once',async({page})=>{
 const before=await saved(page);
 await page.getByRole('button',{name:'Open Sample card',exact:true}).click();
 let detail=page.getByRole('dialog',{name:'Sample card',exact:true});
 await expect(detail.getByRole('button',{name:'Record Payment',exact:true})).toHaveCount(0);
 await detail.getByRole('button',{name:'Sample card overview',exact:true}).click();
 await detail.getByLabel('Account name',{exact:true}).fill('Draft card');
 await detail.getByRole('button',{name:'Advanced',exact:true}).click();
 const advanced=page.getByRole('dialog',{name:'Advanced',exact:true});
 await expect(advanced.locator('fieldset').getByRole('button')).toHaveText(['Mark paid off','Delete debt']);
 await advanced.getByLabel('Credit limit (optional)',{exact:true}).fill('6000');
 await page.screenshot({path:'outputs/redesign/card-advanced-refined.png'});
 await expect((await saved(page)).accounts).toEqual(before.accounts);
 await page.keyboard.press('Escape');
 for(const width of [320,390]) {
  await page.setViewportSize({width,height:844});
  await expect(detail.locator('footer').getByRole('button')).toHaveText(['+ Transaction','Edit','Save']);
  await detail.getByRole('tab',{name:'Transactions',exact:true}).click();
  await page.getByRole('dialog',{name:'Unsaved debt account changes'}).getByRole('button',{name:'Cancel',exact:true}).click();
  await expect(detail.getByRole('tab',{name:'Info',exact:true})).toHaveAttribute('aria-selected','true');
  expect(await detail.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
 }
 await expect(detail.getByLabel('Account name',{exact:true})).toHaveValue('Draft card');
 await detail.getByRole('tab',{name:'Transactions',exact:true}).click();
 await page.getByRole('dialog',{name:'Unsaved debt account changes'}).getByRole('button',{name:'Cancel',exact:true}).click();
 await page.screenshot({path:'outputs/redesign/card-draft-preserved.png'});
 await detail.getByRole('tab',{name:'Info',exact:true}).click();
 await detail.getByRole('button',{name:'+ Transaction',exact:true}).click();
 const transaction=page.getByRole('dialog',{name:'New transaction',exact:true});
 await expect(transaction.getByLabel('Transaction type').locator('option')).toHaveText(['Purchase','Interest','Fee','Balance update']);
 await transaction.getByLabel('What’s it for?',{exact:true}).fill('Test purchase');
 await transaction.getByLabel('Transaction amount',{exact:true}).fill('10');
 await transaction.getByLabel('Transaction type',{exact:true}).selectOption('purchase');
 await transaction.getByRole('button',{name:'Save transaction',exact:true}).click();
 await expect.poll(async()=>(await saved(page)).transactions.length).toBe(before.transactions.length+1);
 expect((await saved(page)).accounts[0].name).toBe('Sample card');
 await detail.getByRole('button',{name:'Save',exact:true}).click();
 detail=page.getByRole('dialog',{name:'Draft card',exact:true});
 await expect.poll(async()=>(await saved(page)).accounts[0].name).toBe('Draft card');
 expect((await saved(page)).balanceAdjustments).toEqual(before.balanceAdjustments);
 await detail.getByLabel('Current balance',{exact:true}).fill('800');
 await detail.getByRole('button',{name:'Save',exact:true}).click();
 await expect.poll(async()=>(await saved(page)).balanceAdjustments.length).toBe(before.balanceAdjustments.length+1);
 const after=await saved(page);expect(after.balanceAdjustments.at(-1).difference).toBe(-110);expect(after.transactions.length).toBe(before.transactions.length+1);expect(after.snapshots).toEqual(before.snapshots);expect(after.monthlyPlan.loanTrackers).toEqual(before.monthlyPlan.loanTrackers);
 await page.screenshot({path:'outputs/redesign/card-info-refined.png'});
});

test('credit card deletion confirms and retains history; paid off cards archive without a payment',async({page})=>{
 const before=await saved(page);
 await page.getByRole('button',{name:'Open Sample card',exact:true}).click();
 const detail=page.getByRole('dialog',{name:'Sample card',exact:true});
 await detail.getByRole('button',{name:'Edit',exact:true}).click();await detail.getByRole('button',{name:'Advanced',exact:true}).click();
 const advanced=page.getByRole('dialog',{name:'Advanced',exact:true});
 await advanced.getByRole('button',{name:'Delete debt',exact:true}).click();
 const warning=page.getByRole('dialog',{name:'Delete debt permanently?',exact:true});
 await expect(warning).toBeVisible();await page.screenshot({path:'outputs/redesign/delete-warning.png'});
 await warning.getByRole('button',{name:'Cancel',exact:true}).click();expect((await saved(page)).accounts).toEqual(before.accounts);
 await advanced.getByRole('button',{name:'Delete debt',exact:true}).click();await warning.getByRole('button',{name:'Delete debt',exact:true}).click();
 await expect.poll(async()=>(await saved(page)).accounts.some((a:{id:string})=>a.id==='demo-card')).toBe(false);
 const removed=await saved(page);expect(removed.transactions).toEqual(before.transactions);expect(removed.snapshots).toEqual(before.snapshots);expect(removed.monthlyPlan.progressStartingBalance).toBe(before.monthlyPlan.progressStartingBalance);expect(removed.monthlyPlan.removedProgressAccounts.some((a:{id:string})=>a.id==='demo-card')).toBe(true);
 await page.getByRole('button',{name:'Open Sample travel',exact:true}).click();
 const travel=page.getByRole('dialog',{name:'Sample travel',exact:true});await travel.getByRole('button',{name:'Edit',exact:true}).click();await travel.getByRole('button',{name:'Advanced',exact:true}).click();
 page.once('dialog',dialog=>dialog.accept());await page.getByRole('dialog',{name:'Advanced',exact:true}).getByRole('button',{name:'Mark paid off',exact:true}).click();
 await expect.poll(async()=>(await saved(page)).accounts.find((a:{id:string})=>a.id==='demo-travel').archivedAt).toBeTruthy();
 const paid=await saved(page);expect(paid.transactions).toEqual(before.transactions);expect(paid.balanceAdjustments.at(-1).balanceAfter).toBe(0);expect(paid.snapshots).toEqual(before.snapshots);expect(paid.monthlyPlan.loanTrackers).toEqual(before.monthlyPlan.loanTrackers);
});

test('schedule choices, extra help and confirmed minimums persist without filtering Home, Debts or Progress',async({page})=>{
 const before=await saved(page);
 const nav=page.getByRole('navigation',{name:'Primary navigation'});
 await nav.getByRole('button',{name:'Home',exact:true}).click();
 const householdTotal=await page.getByRole('region',{name:'Total household debt',exact:true}).locator(':scope > strong').textContent();
 for(const width of [320,390,686]) {
  await page.setViewportSize({width,height:900});
  await expect(page.locator('[aria-label="Total household debt"]')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 }
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:'outputs/redesign/home-summary-fit.png'});
 await page.getByRole('button',{name:'Open full schedule',exact:false}).click();
 const schedule=page.getByRole('dialog',{name:'Payoff Schedule',exact:true});
 await schedule.getByLabel('Extra payment',{exact:true}).fill('1500');await schedule.getByRole('button',{name:'Save extra payment'}).click();
 await schedule.getByRole('button',{name:'Explain extra payment'}).click();
 await expect(page.getByRole('dialog',{name:'Extra payment',exact:true})).toContainText('on top of');await page.keyboard.press('Escape');
 await schedule.getByLabel('Payoff method').selectOption('snowball');
 for(const width of [320,390,686]) {
  await page.setViewportSize({width,height:900});
  const cell=schedule.locator('tbody tr').first().locator('td').first();expect(await cell.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
  expect(await schedule.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
 }
 await page.setViewportSize({width:390,height:844});
 await schedule.getByText('Included debt types',{exact:true}).click();await schedule.getByLabel('Include Mortgage',{exact:true}).uncheck();await schedule.getByLabel('Include Car loan',{exact:true}).uncheck();expect((await saved(page)).monthlyPlan.payoffExcludedTypes??[]).toEqual([]);await schedule.getByRole('button',{name:'Apply included debt types'}).click();
 await schedule.getByRole('button',{name:'Edit minimums'}).click();
 const editor=page.getByRole('dialog',{name:'Edit minimum payments',exact:true});
 await expect(editor.getByRole('textbox')).toHaveCount(2);await expect(editor.locator('[class*=minimumInput]>span')).toHaveText(['$','$']);await expect(editor).not.toContainText('Sample home');
 await editor.getByLabel('Minimum for Sample card',{exact:true}).fill('1600');await editor.getByRole('button',{name:'Cancel',exact:true}).click();expect((await saved(page)).accounts).toEqual(before.accounts);
 await schedule.getByRole('button',{name:'Edit minimums'}).click();await editor.getByLabel('Minimum for Sample card',{exact:true}).fill('1600');await editor.getByRole('button',{name:'Save',exact:true}).click();
 const warning=page.getByRole('dialog',{name:'Change saved minimums?',exact:true});await expect(warning).toBeVisible();expect((await saved(page)).accounts).toEqual(before.accounts);await warning.getByRole('button',{name:'Cancel',exact:true}).click();
 await editor.getByRole('button',{name:'Save',exact:true}).click();await warning.getByRole('button',{name:'Save minimums',exact:true}).click();
 await expect.poll(async()=>(await saved(page)).accounts[0].minimum).toBe(1600);
 const after=await saved(page);expect(after.transactions).toEqual(before.transactions);expect(after.snapshots).toEqual(before.snapshots);expect(after.balanceAdjustments).toEqual(before.balanceAdjustments);expect(after.monthlyPlan.loanTrackers).toEqual(before.monthlyPlan.loanTrackers);expect(after.monthlyPlan.progressStartingBalance).toBe(before.monthlyPlan.progressStartingBalance);expect(after.monthlyPlan.payoffPlanAmount).toBe(before.monthlyPlan.payoffPlanAmount);
 await schedule.getByRole('button',{name:'Close payoff schedule and go back'}).click();await page.reload();
 await expect(page.getByRole('region',{name:'Total household debt',exact:true}).locator(':scope > strong')).toHaveText(householdTotal!);
 await expect(page.getByRole('region',{name:'Payoff summary'})).toBeVisible();
 await page.getByRole('button',{name:'Open full schedule',exact:false}).click();await expect(schedule.getByLabel('Payoff method')).toHaveValue('snowball');await expect(schedule.getByLabel('Extra payment',{exact:true})).toHaveValue('1500');await schedule.getByText('Included debt types',{exact:true}).click();await expect(schedule.getByLabel('Include Mortgage',{exact:true})).not.toBeChecked();await schedule.getByText('Included debt types',{exact:true}).click();
 await page.screenshot({path:'outputs/redesign/schedule-options.png'});
 await schedule.getByRole('button',{name:'Close payoff schedule and go back'}).click();await nav.getByRole('button',{name:'Progress',exact:true}).click();await expect(page.getByRole('button',{name:'House & car',exact:true})).toBeVisible();await expect(page.getByRole('region',{name:'accounts debt progress',exact:true})).toContainText('$48,156.06');
 await nav.getByRole('button',{name:/^Debts?$/,exact:true}).click();await expect(page.getByRole('button',{name:'Open Sample home',exact:true})).toBeVisible();await expect(page.getByRole('region',{name:'Debt summary'})).toContainText('$380,995.61');
});


test('loan account edits can cancel, discard or save when leaving Info',async({page})=>{
 const before=await saved(page);
 await page.getByRole('button',{name:'Open Sample home',exact:true}).click();
 let detail=page.getByRole('dialog',{name:'Sample home',exact:true});
 await detail.getByRole('tab',{name:'Info',exact:true}).click();
 await detail.getByLabel('Name*',{exact:true}).fill('Unsaved home');
 await detail.getByRole('tab',{name:'Transactions',exact:true}).click();
 const prompt=page.getByRole('dialog',{name:'Unsaved loan changes'});
 await prompt.getByRole('button',{name:'Cancel',exact:true}).click();
 await expect(detail.getByLabel('Name*',{exact:true})).toHaveValue('Unsaved home');
 await detail.getByRole('tab',{name:'Transactions',exact:true}).click();
 await prompt.getByRole('button',{name:'Discard',exact:true}).click();
 await expect(detail.getByRole('tab',{name:'Transactions',exact:true})).toHaveAttribute('aria-selected','true');
 expect((await saved(page)).monthlyPlan.loanTrackers).toEqual(before.monthlyPlan.loanTrackers);
 await detail.getByRole('tab',{name:'Info',exact:true}).click();
 await detail.getByLabel('Name*',{exact:true}).fill('Saved home');
 await detail.getByRole('button',{name:'Back from Sample home',exact:true}).click();
 await prompt.getByRole('button',{name:'Save',exact:true}).click();
 await expect.poll(async()=>(await saved(page)).monthlyPlan.loanTrackers[0].name).toBe('Saved home');
 detail=page.getByRole('dialog',{name:'Saved home',exact:true});
 await expect(detail).toHaveCount(0);
 const after=await saved(page);expect(after.transactions).toEqual(before.transactions);expect(after.snapshots).toEqual(before.snapshots);expect(after.monthlyPlan.loanTrackers[0].history).toEqual(before.monthlyPlan.loanTrackers[0].history);
});
