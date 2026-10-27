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
 if(info.title.startsWith('loan balance classification'))fixture.payload.monthlyPlan!.loanTrackers!.push({id:'auto-quote',name:'Sample auto',kind:'car',originalAmount:10000,remainingAmount:1000,balanceKind:'payoff',asOf:'2026-10-01',budgetItemId:'',budgetItemName:'',apr:5,monthlyPayment:100,history:[]});
 if(info.title.startsWith('Home preview keeps')) {
  for(let i=0;i<3;i++)fixture.payload.accounts.push({...fixture.payload.accounts[0],id:'extra-'+i,name:'Additional card '+i,balance:1000+i*100,baselineBalance:1500});
  const key=new Date().toISOString().slice(0,7);
  fixture.payload.monthlyBudgets[key]=[{id:'salary',kind:'income',name:'Salary',category:'Salary',amount:5000,paymentMethod:'debit',creditAccountId:'',createdAt:key+'-01T12:00:00Z',recurring:true},{id:'insurance',kind:'expense',name:'Insurance',category:'Insurance',amount:180,paymentMethod:'debit',creditAccountId:'',createdAt:key+'-01T12:00:00Z',recurring:true},{id:'gpt',kind:'expense',name:'OpenAI GPT',category:'Subscriptions',amount:20,paymentMethod:'debit',creditAccountId:'',createdAt:key+'-01T12:00:00Z',recurring:true}];
  fixture.payload.monthlyPlan!.months[key]={safetyBuffer:0,debtPaymentTarget:0};
  if(info.title.includes('recorded activity')){
   fixture.payload.monthlyPlan!.detailedSpendingTracking=true;
   for(const [i,amount] of [40,42.68].entries())fixture.payload.transactions.push({...fixture.payload.transactions[0],id:'spend-'+i,type:'charge',amount,payeeName:'Test purchase '+i,category:'Purchases',date:key+'-02'});
  }
  await page.addInitScript(({key,theme})=>localStorage.setItem(key,JSON.stringify(theme)),{key:APPEARANCE_KEY,theme:THEMES.dark});
 }
 await page.addInitScript(({key,fixture})=>{if(!localStorage.getItem(key)) localStorage.setItem(key,JSON.stringify(fixture));},{key:DASHBOARD_STORAGE_KEY,fixture});
 await page.goto('/');
 await expect(page.getByRole('heading',{name:/Welcome,/})).toBeVisible();
 await expect.poll(async()=>(await saved(page)).snapshots.some((snapshot:{autoCheckpoint?:string})=>Boolean(snapshot.autoCheckpoint))).toBe(true);
 if (!info.title.startsWith('five tabs') && !info.title.startsWith('Home preview')) await page.getByRole('navigation',{name:'Primary navigation'}).getByRole('button',{name:/^Debts?$/,exact:true}).click();
});
const saved=(page:import('@playwright/test').Page)=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).payload,DASHBOARD_STORAGE_KEY);

test('five tabs, separate Home summary and searchable unified Debt list', async({page})=>{
 const nav=page.getByRole('navigation',{name:'Primary navigation'});
 await expect(nav.getByRole('button')).toHaveText(['Home','Debt','Progress','Budget','Settings']);
 await expect(page.getByRole('region',{name:'Debt summary',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:/^Open Sample/})).toHaveCount(0);
 await expect(page.getByRole('searchbox',{name:'Search debts'})).toHaveCount(0);
 await nav.getByRole('button',{name:/^Debts?$/,exact:true}).click();
 const debts=page.getByRole('region',{name:'Debt list',exact:true});
 await expect(page.getByRole('region',{name:'Debt summary',exact:true})).not.toContainText('Minimum payments');
 await expect(debts.getByRole('button',{name:/^Open /})).toHaveText([/Sample card/,/Sample home/,/Sample travel/]);
 const filters=page.getByRole('navigation',{name:'Debt type filters'});
 await filters.getByRole('button',{name:/Cards & loans/}).click();
 await expect(debts.getByRole('button',{name:/^Open /})).toHaveCount(2);
 await filters.getByRole('button',{name:/House & auto/}).click();
 await expect(debts.getByRole('button',{name:/^Open /})).toHaveCount(1);
 await expect(debts.getByRole('button',{name:'Open Sample home'})).toBeVisible();
 await filters.getByRole('button',{name:/All/}).click();
 await expect(debts.getByRole('navigation',{name:'Household group filters'})).toHaveCount(0);
 await page.getByLabel('Sort debts').selectOption('apr');
 await expect(debts.getByRole('button',{name:/^Open /}).first()).toHaveAttribute('aria-label','Open Sample travel');
 await page.getByLabel('Sort debts').selectOption('amount');
 await expect(debts.getByRole('button',{name:/^Open /}).first()).toHaveAttribute('aria-label','Open Sample home');
 await page.getByRole('searchbox',{name:'Search debts'}).fill('TRAVEL');
 await expect(debts.getByRole('button',{name:/^Open /})).toHaveCount(1);
 await page.getByRole('searchbox',{name:'Search debts'}).fill('');
 await nav.getByRole('button',{name:/^Debts?$/,exact:true}).click();
 await expect(page.getByRole('region',{name:'Debt list'}).getByRole('button',{name:/^Open /})).toHaveCount(3);
 await expect(page.getByRole('tab',{name:'Show House & Auto',exact:true})).toHaveCount(0);
 for(const name of ['Budget','Settings']) {await nav.getByRole('button',{name,exact:true}).click();await expect(page.locator('.page-heading h1')).toHaveText(name==='Budget'?'Budget planned':name);}
 await expect(page.getByRole('button',{name:'Open Settings',exact:true})).toHaveCount(0);
 if((await page.viewportSize())!.width<=820) {await nav.getByRole('button',{name:'Home',exact:true}).click();await page.getByRole('button',{name:'Open Account',exact:true}).click();await expect(page.locator('.page-heading h1')).toHaveText('Account');await page.getByRole('button',{name:'Close Account',exact:true}).click();await nav.getByRole('button',{name:'Progress',exact:true}).click();await expect(page.locator('.page-heading h1')).toHaveText('Progress overview');}
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
 await expect(detail.getByRole('group',{name:'Due date',exact:true}).getByRole('button',{name:new Date().toISOString().slice(0,7)+'-25',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(detail.getByLabel('Debt category')).toHaveCount(0);
 await expect(detail.getByText('Position in category')).toHaveCount(0);
 await expect(detail.getByLabel('Household group')).toHaveCount(0);
 await expect(detail.getByLabel('Position in group')).toHaveCount(0);
 await expect(detail.getByText('Actual interest fee',{exact:true})).toHaveCount(0);
 await detail.getByLabel('Account name',{exact:true}).fill('Renamed card');
 await detail.getByRole('button',{name:'Advanced',exact:true}).click();
 const advanced=page.getByRole('dialog',{name:'Advanced',exact:true});
 await expect(advanced.getByRole('spinbutton',{name:/^Actual interest fee/})).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(advanced).toHaveCount(0);
 await detail.getByRole('button',{name:'Save',exact:true}).click();
 await expect.poll(async()=>(await saved(page)).accounts[0].name).toBe('Renamed card');
 await expect.poll(async()=>(await saved(page)).accounts[0].displayGroup).toBe(before.accounts[0].displayGroup);
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
 await expect(payment.getByRole('group',{name:'Transaction date',exact:true})).toBeEnabled();
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
 const preview=page.getByRole('region',{name:'Payoff Strategy preview',exact:true});
 await expect(preview.getByRole('listitem')).toHaveCount(2);
 await expect(page.getByRole('region',{name:'Payoff summary'})).toHaveCount(0);
 await preview.getByRole('button',{name:'See all'}).click();
 const strategy=page.getByRole('dialog',{name:'Payoff Strategy',exact:true});
 await expect(strategy.getByRole('table')).toHaveCount(0);
 await expect(strategy.getByRole('listitem')).toHaveCount(2);
 await expect(strategy).not.toContainText('Sample home');
 await strategy.getByLabel('Extra payment',{exact:true}).fill('400');
 await strategy.getByRole('button',{name:'Save extra payment'}).click();
 await expect.poll(async()=>(await saved(page)).monthlyPlan.payoffExtraPayment).toBe(400);
 const after=await saved(page);
 for(const key of ['accounts','transactions','balanceAdjustments','snapshots','monthlyBudgets']) expect(after[key]).toEqual(before[key]);
 expect(after.monthlyPlan.loanTrackers).toEqual(before.monthlyPlan.loanTrackers);
 for(const width of info.project.name==='phone'?[320,360,390,430]:[1440]) {
  await page.setViewportSize({width,height:900});
  expect(await strategy.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
  expect(await strategy.locator('.strategy-choices').evaluate(el=>el.children[0].getBoundingClientRect().y===el.children[1].getBoundingClientRect().y)).toBe(true);
 }
 const scan=await new AxeBuilder({page}).include('[aria-label="Payoff Strategy"][role="dialog"]').withRules(['color-contrast','button-name','label']).analyze();expect(scan.violations).toEqual([]);
 await page.keyboard.press('Escape');await expect(strategy).toHaveCount(0);
 await expect(preview.getByRole('button',{name:'See all'})).toBeFocused();
 await page.getByRole('navigation',{name:'Primary navigation'}).getByRole('button',{name:'Budget',exact:true}).click();
 await page.getByRole('navigation',{name:'Budget sections'}).getByRole('button',{name:'Strategy',exact:true}).click();
 await expect(page.getByRole('region',{name:'Payoff Strategy',exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Payoff strategy',exact:true})).toBeVisible();
 await page.getByRole('navigation',{name:'Budget sections'}).getByRole('button',{name:'Planned',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Budget planned',exact:true})).toBeVisible();
});

test('Debt + creates mortgage and car records, validates missing values and preserves the existing household', async({page})=>{
 const before=await saved(page);
 await page.getByRole('navigation',{name:'Primary navigation'}).getByRole('button',{name:/^Debts?$/,exact:true}).click();
 for(const kind of ['Mortgage','Car loan']) {
  await page.getByRole('button',{name:'Add debt',exact:true}).click();
  const creation=page.getByRole('dialog',{name:'Add a debt account',exact:true});
  await creation.getByLabel('Account name',{exact:true}).fill(`New ${kind}`);
  await creation.getByRole('combobox',{name:'Debt type',exact:true}).selectOption({label:kind});
  const loan=page.getByRole('dialog',{name:kind === 'Mortgage' ? 'Mortgage Details' : 'Car Loan Details',exact:true});
  await loan.getByRole('button',{name:'Save',exact:true}).click();
  await expect(loan.getByText('Enter an original loan amount greater than $0.',{exact:true})).toBeVisible();
  await loan.getByLabel('Original balance',{exact:true}).fill('10000');
  await loan.getByLabel('Current balance',{exact:true}).fill('8000');
  await loan.getByLabel(kind === 'Mortgage' ? 'APR*' : 'APR (optional)',{exact:true}).fill('5');
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
   await page.getByRole('button',{name:'Add debt',exact:true}).click();
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
 await summary.getByRole('button',{name:'Cards and loans balance',exact:true}).click();
 await expect(summary).toContainText('$1,400.00');await expect(summary).not.toContainText('$2,400.00');
 await page.getByLabel('Sort debts').selectOption('amount');
 await page.reload();await page.getByRole('navigation',{name:'Primary navigation'}).getByRole('button',{name:/^Debts?$/,exact:true}).click();
 await expect(summary.getByRole('button',{name:'Cards and loans balance',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(page.getByLabel('Sort debts')).toHaveValue('amount');
 const box=(await summary.boundingBox())!;
 await page.mouse.move(box.x+70,box.y+70);await page.mouse.down();await page.mouse.move(box.x+180,box.y+70,{steps:6});await page.mouse.up();
 await expect(summary.getByRole('button',{name:'Total debt balance',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(summary).toContainText('$2,400.00');
 await expect(page.getByRole('button',{name:'Open Sample card',exact:true}).getByRole('progressbar')).toHaveAttribute('aria-valuenow','10');
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
 await expect(advanced.getByRole('button',{name:/^(Mark paid off|Delete debt)$/})).toHaveText(['Mark paid off','Delete debt']);
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
 const before=await saved(page), nav=page.getByRole('navigation',{name:'Primary navigation'});
 await nav.getByRole('button',{name:'Home',exact:true}).click();
 const summary=page.getByRole('region',{name:'Debt summary',exact:true});
 const total=await summary.locator('[aria-hidden="false"] strong').first().textContent();
 await page.getByRole('region',{name:'Payoff Strategy preview'}).getByRole('button',{name:'See all'}).click();
 const strategy=page.getByRole('dialog',{name:'Payoff Strategy',exact:true});
 await expect(strategy.getByText('Included debt types',{exact:true})).toHaveCount(0);
 await expect(strategy.getByRole('listitem')).toHaveCount(3);
 await expect(strategy).toContainText('Sample auto');await expect(strategy).not.toContainText('Sample home');
 await strategy.getByLabel('Extra payment',{exact:true}).fill('1500');await strategy.getByRole('button',{name:'Save extra payment'}).click();
 await strategy.getByRole('button',{name:/Snowball/}).click();
 await expect(strategy.getByRole('button',{name:/Snowball/})).toHaveAttribute('aria-pressed','true');
 await strategy.getByRole('button',{name:'Edit minimums'}).click();
 const editor=page.getByRole('dialog',{name:'Edit minimum payments',exact:true});
 await expect(editor.getByRole('textbox')).toHaveCount(3);await expect(editor).not.toContainText('Sample home');
 await editor.getByLabel('Minimum for Sample card',{exact:true}).fill('1600');await editor.getByRole('button',{name:'Cancel',exact:true}).click();expect((await saved(page)).accounts).toEqual(before.accounts);
 await strategy.getByRole('button',{name:'Edit minimums'}).click();await editor.getByLabel('Minimum for Sample card',{exact:true}).fill('1600');await editor.getByRole('button',{name:'Save',exact:true}).click();
 const warning=page.getByRole('dialog',{name:'Change saved minimums?',exact:true});await expect(warning).toBeVisible();expect((await saved(page)).accounts).toEqual(before.accounts);await warning.getByRole('button',{name:'Cancel',exact:true}).click();
 await editor.getByRole('button',{name:'Save',exact:true}).click();await warning.getByRole('button',{name:'Save minimums',exact:true}).click();
 await expect.poll(async()=>(await saved(page)).accounts[0].minimum).toBe(1600);
 const after=await saved(page);for(const key of ['transactions','snapshots','balanceAdjustments'])expect(after[key]).toEqual(before[key]);
 expect(after.monthlyPlan.loanTrackers).toEqual(before.monthlyPlan.loanTrackers);expect(after.monthlyPlan.progressStartingBalance).toBe(before.monthlyPlan.progressStartingBalance);expect(after.monthlyPlan.payoffPlanAmount).toBe(before.monthlyPlan.payoffPlanAmount);expect(after.monthlyPlan.payoffExcludedTypes).toEqual(before.monthlyPlan.payoffExcludedTypes);
 await strategy.getByRole('button',{name:'Close payoff strategy and go back'}).click();await page.reload();
 await expect(summary.locator('[aria-hidden="false"] strong').first()).toHaveText(total!);
 await page.getByRole('region',{name:'Payoff Strategy preview'}).getByRole('button',{name:'See all'}).click();
 await expect(strategy.getByRole('button',{name:/Snowball/})).toHaveAttribute('aria-pressed','true');await expect(strategy.getByLabel('Extra payment',{exact:true})).toHaveValue('1500');
 await strategy.getByRole('button',{name:'Close payoff strategy and go back'}).click();await nav.getByRole('button',{name:'Progress',exact:true}).click();await expect(page.getByRole('button',{name:'Show House & Auto',exact:true})).toBeVisible();
 await nav.getByRole('button',{name:'Debt',exact:true}).click();await expect(page.getByRole('button',{name:'Open Sample home',exact:true})).toBeVisible();
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


test('Home preview keeps approved header alignment, dark carousels and recurring spending form',async({page},info)=>{
 const nav=page.getByRole('navigation',{name:'Primary navigation'});
 await expect(page.getByRole('region',{name:'Payoff Strategy preview'}).getByRole('listitem')).toHaveCount(4);
 const before=await saved(page);
 for(const width of info.project.name==='phone'?[320,360,390,430,1440]:[1440]){
  await page.setViewportSize({width,height:1000});
  for(const tab of ['Home','Debt','Progress','Budget','Settings']){
   await nav.getByRole('button',{name:tab,exact:true}).click();
   await page.locator('.page-body').evaluate(el=>{el.scrollTop=0;});
   const header=page.locator('.shared-dashboard-header');
   await expect(header.getByLabel('DebtFree',{exact:true})).toHaveCount(tab==='Home'?1:0);
   await expect(header.getByRole('button',{name:'Open Account',exact:true})).toHaveCount(tab==='Home'?1:0);
   expect(await header.evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgb(24, 43, 69)');
   if(['Debt','Progress','Budget'].includes(tab)) {
    const buttons=await header.locator('.compact-segments>button').all();
    for(const button of buttons)expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
   }
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
   if(width===390||width===1440)await page.screenshot({path:`outputs/redesign/approved-${tab.toLowerCase()}-${width}.png`});
  }
 }
 await page.setViewportSize({width:390,height:844});await nav.getByRole('button',{name:'Home',exact:true}).click();
 const ring=page.locator('[aria-hidden="false"] [role="img"]').first();const first=(await ring.boundingBox())!;
 expect(first.width).toBeGreaterThanOrEqual(100);
 await page.getByRole('button',{name:'Show House & Auto',exact:true}).click();
 const second=(await page.locator('[aria-hidden="false"] [role="img"]').first().boundingBox())!;expect(Math.abs(second.x-first.x)).toBeLessThan(2);
 await expect(page.getByRole('button',{name:/Previous debt progress scope|Next debt progress scope/})).toHaveCount(0);
 await nav.getByRole('button',{name:'Budget',exact:true}).click();
 await expect(page.getByRole('button',{name:'This month',exact:true})).toHaveCount(0);
 for(const name of ['Income +','Spending +','One-off +'])await expect(page.getByRole('button',{name,exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Add planned spending',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Add planned entry',exact:true});
 await expect(dialog.getByRole('radio',{name:'Recurring',exact:true})).toBeChecked();
 await expect(dialog.getByRole('group',{name:'Due date',exact:true})).toBeVisible();
 await expect(dialog.getByText('Item type',{exact:true})).toHaveCount(0);
 for(const width of [320,390]){await page.setViewportSize({width,height:900});expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);const amount=(await dialog.getByRole('spinbutton').boundingBox())!,form=(await dialog.locator('.cashflow-amount-frequency').boundingBox())!;expect(amount.width).toBeLessThan(form.width*.6);}
 await page.screenshot({path:'outputs/redesign/approved-recurring-form.png'});
 await dialog.getByRole('radio',{name:'One time purchase',exact:true}).check();await expect(dialog.getByRole('group',{name:'Due date',exact:true})).toHaveCount(0);
 await expect(dialog.getByLabel('Category')).toHaveValue('Shopping');
 await dialog.getByRole('radio',{name:'Recurring',exact:true}).check();await expect(dialog.getByRole('group',{name:'Due date',exact:true})).toBeVisible();
 await dialog.getByLabel('Name',{exact:true}).fill('Test recurring entry');await dialog.getByRole('spinbutton').fill('20');await dialog.getByRole('group',{name:'Due date',exact:true}).getByRole('button',{name:new Date().toISOString().slice(0,7)+'-28',exact:true}).click();
 await dialog.getByRole('button',{name:'Add planned entry',exact:true}).click();
 await expect(dialog).toHaveCount(0);await expect.poll(async()=>(await saved(page)).monthlyBudgets[new Date().toISOString().slice(0,7)].find((r:{name:string})=>r.name==='Test recurring entry')?.dueDay).toBe(28);
 const after=await saved(page);for(const key of ['accounts','transactions','balanceAdjustments','snapshots'])expect(after[key]).toEqual(before[key]);
});


test('loan balance classification enables auto forecast without changing balances',async({page})=>{
 const before=await saved(page),nav=page.getByRole('navigation',{name:'Primary navigation'});
 await nav.getByRole('button',{name:'Home',exact:true}).click();await page.getByRole('region',{name:'Payoff Strategy preview'}).getByRole('button',{name:'See all'}).click();
 const strategy=page.getByRole('dialog',{name:'Payoff Strategy',exact:true});await expect(strategy.getByRole('alert')).toHaveCount(0);
 await strategy.getByRole('button',{name:'Close payoff strategy and go back',exact:true}).click();
 await nav.getByRole('button',{name:'Debt',exact:true}).click();await page.getByRole('button',{name:'Open Sample auto',exact:true}).click();await page.getByRole('tab',{name:'Info',exact:true}).click();
 const loan=page.getByRole('dialog',{name:'Sample auto',exact:true});await expect(loan.getByLabel('Balance type',{exact:true})).toHaveCount(0);
 await loan.getByLabel('APR (optional)',{exact:true}).fill('');await loan.getByRole('button',{name:'Save',exact:true}).click();
 await expect.poll(async()=>(await saved(page)).monthlyPlan.loanTrackers.find((r:{id:string})=>r.id==='auto-quote')?.apr).toBeUndefined();
 await loan.getByRole('tab',{name:'Info',exact:true}).click();await expect(loan).toContainText('Assumed 6% APR for planning.');
 await expect(loan.getByLabel('Current balance',{exact:true})).toHaveValue('1,000.00');
 await expect(loan.getByLabel('Remaining principal (optional)',{exact:true})).toHaveValue('');
 await loan.getByLabel('Remaining principal (optional)',{exact:true}).fill('950');
 const calendar=loan.getByRole('group',{name:'Due date',exact:true});await expect(calendar).toBeVisible();
 for(const width of [320,390]){await page.setViewportSize({width,height:900});expect(await calendar.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);}
 await loan.getByLabel('Current balance',{exact:true}).fill('1100');
 await expect(loan.getByLabel('Remaining principal (optional)',{exact:true})).toHaveValue('');
 await loan.getByLabel('Current balance',{exact:true}).fill('1000');await loan.getByLabel('Remaining principal (optional)',{exact:true}).fill('950');
 await expect(loan.locator('input[type=date]')).toHaveCount(0);await expect(loan.getByText('Choose payment date',{exact:true})).toHaveCount(0);
 await loan.getByRole('button',{name:'Save',exact:true}).click();
 await expect.poll(async()=>(await saved(page)).monthlyPlan.loanTrackers.find((r:{id:string})=>r.id==='auto-quote')?.principalBalance).toBe(950);
 const after=await saved(page);expect(after.monthlyPlan.loanTrackers.find((r:{id:string})=>r.id==='auto-quote').remainingAmount).toBe(1000);expect(after.monthlyPlan.loanTrackers.find((r:{id:string})=>r.id==='auto-quote').balanceKind).toBe('payoff');
 for(const key of ['accounts','transactions','snapshots','balanceAdjustments','monthlyBudgets'])expect(after[key]).toEqual(before[key]);expect(after.monthlyPlan.progressStartingBalance).toBe(before.monthlyPlan.progressStartingBalance);
 await loan.getByRole('button',{name:'Back from Sample auto',exact:true}).click();await nav.getByRole('button',{name:'Home',exact:true}).click();
 await page.getByRole('region',{name:'Payoff Strategy preview'}).getByRole('button',{name:'See all'}).click();await expect(strategy.getByRole('alert')).toHaveCount(0);
 const auto=strategy.getByRole('listitem').filter({hasText:'Sample auto'});await expect(auto.locator('time')).toBeVisible();
});

test('Home preview keeps recorded activity in Transactions and a shared date calendar',async({page})=>{
 const nav=page.getByRole('navigation',{name:'Primary navigation'});await nav.getByRole('button',{name:'Budget',exact:true}).click();
 await expect(page.getByText('Recorded spending',{exact:true})).toHaveCount(0);
 const original=await saved(page);
 await page.getByRole('button',{name:'Transactions',exact:true}).click();
 await expect(page.getByRole('region',{name:'Debt transaction activity'})).toContainText('Test purchase 0');
 await expect(page.getByRole('region',{name:'Debt transaction activity'})).toContainText('Test purchase 1');
 expect((await saved(page)).transactions).toEqual(original.transactions);
 await page.getByRole('button',{name:'Planned',exact:true}).click();
 await page.getByRole('button',{name:'Add planned spending',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Add planned entry',exact:true});const calendar=dialog.getByRole('group',{name:'Due date',exact:true});
 await expect(calendar).toBeVisible();await expect(dialog.locator('input[type=date]')).toHaveCount(0);
 for(const theme of ['light','dark'] as const){await page.evaluate(({key,event,value})=>{localStorage.setItem(key,JSON.stringify(value));window.dispatchEvent(new CustomEvent(event,{detail:value}));},{key:APPEARANCE_KEY,event:APPEARANCE_EVENT,value:THEMES[theme]});for(const width of [320,360,390,430]){await page.setViewportSize({width,height:900});expect(await calendar.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);}}
 await calendar.getByRole('button',{name:new Date().toISOString().slice(0,7)+'-31',exact:true}).click();
 const before=await saved(page);await calendar.getByRole('button',{name:'Next month for Due date'}).click();await expect(calendar.getByRole('button',{pressed:true})).toHaveAttribute('aria-label','2026-11-30');
 await calendar.getByRole('button',{name:'Previous month for Due date'}).click();await page.screenshot({path:'outputs/redesign/shared-calendar-dark.png'});
 await dialog.getByRole('button',{name:'Cancel',exact:true}).click();expect((await saved(page)).monthlyBudgets).toEqual(before.monthlyBudgets);
});
