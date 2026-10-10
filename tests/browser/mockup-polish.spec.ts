import {test,expect} from '@playwright/test';
import {readFileSync,mkdirSync} from 'node:fs';
import AxeBuilder from '@axe-core/playwright';

test('screen title scrolls with content, account access stays available, and balance classification posts once',async({page},info)=>{
 const fixture=JSON.parse(readFileSync('tests/fixtures/legacy-v0.json','utf8'));
 fixture.accounts=[{...fixture.accounts[0],id:'card',name:'Test card',balance:1000,baselineBalance:1200,balanceOffset:0,minimum:50,minimumMode:'manual',apr:0,interestFee:0,archivedAt:null}];
 fixture.transactions=[];fixture.balanceAdjustments=[];
 const month=new Date().toISOString().slice(0,7);
 fixture.monthlyBudgets={[month]:[{id:'salary',name:'Salary',kind:'income',category:'Salary',amount:3000,paymentMethod:'debit',creditAccountId:'',recurring:true,createdAt:new Date().toISOString()},{id:'rent',name:'Rent',kind:'expense',category:'Housing',amount:1500,paymentMethod:'debit',creditAccountId:'',recurring:true,createdAt:new Date().toISOString()},{id:'bonus',name:'Bonus',kind:'income',category:'Other income',amount:200,paymentMethod:'debit',creditAccountId:'',recurring:false,createdAt:new Date().toISOString()}]};
 fixture.monthlyPlan={months:{},detailedSpendingTracking:false,payoffPlanAmount:200,payoffPlanStrategy:'avalanche',progressStartingBalance:1200};
 mkdirSync('outputs/ui-verification',{recursive:true});
 const screenshot=async(name:string)=>page.screenshot({path:`outputs/ui-verification/${info.project.name}-${name}.png`});
 await page.goto('/');await page.locator('input[type=file]').setInputFiles({name:'mockup-test.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))});
 await expect(page.locator('.topbar')).toHaveCount(0);await expect(page.getByRole('button',{name:'Refresh dashboard'})).toHaveCount(0);
 await expect(page.getByRole('heading',{name:'Debts',exact:true,level:1})).toBeVisible();
 await page.getByRole('button',{name:'Open My Account'}).click();await expect(page.locator('.profile-screen')).toBeVisible();await page.getByRole('button',{name:'Debts',exact:true}).click();
 await page.getByRole('button',{name:'Update balance for Test card'}).click();const dialog=page.getByRole('dialog');await page.getByLabel('New current balance').fill('900');await dialog.getByRole('radio',{name:'Refund / credit',exact:true}).check();
 if(info.project.name==='phone'){const box=await dialog.boundingBox();expect(box!.x).toBe(0);expect(box!.width).toBe(page.viewportSize()!.width);expect(box!.height).toBe(page.viewportSize()!.height);}
 await screenshot('balance');await dialog.getByRole('button',{name:'Save balance'}).click();await expect(page.locator('.simple-balance').first()).toHaveText('$900.00');
 await page.getByRole('button',{name:'Transactions',exact:true}).click();await expect(page.locator('.transaction-signed-total').first()).toHaveText('−$100.00');await expect(page.locator('.transaction-amount').first()).toContainText('Refund / credit');await expect(page.locator('.transaction-delete-x')).toBeVisible();
 await page.getByRole('button',{name:'Add record',exact:true}).click();await page.getByLabel('What’s it for?',{exact:true}).fill('Interest');await page.getByLabel('Transaction amount').fill('+20');await page.getByLabel('Transaction type').selectOption('interest');await page.getByRole('button',{name:'Save transaction',exact:true}).click();await expect(page.locator('.transaction-amount').first()).toContainText('Interest');
 await screenshot('transactions');await page.getByRole('button',{name:'Budget',exact:true}).click();const summary=page.getByRole('region',{name:'Monthly budget summary'});await expect(summary).toContainText('$3,200.00');await expect(summary).toContainText('$1,500.00');await expect(summary).toContainText('$1,700.00');await expect(summary).toContainText('$200.00');
 await screenshot('budget');await page.getByRole('button',{name:'More',exact:true}).click();await page.getByRole('button',{name:'Payoff Plan',exact:true}).click();await page.getByRole('tab',{name:'Recorded',exact:true}).click();await expect(page.locator('.recorded-summary')).toContainText('$0.00');await expect(page.locator('.recorded-account-values')).toContainText('$200.00');
 await screenshot('recorded');
 if(info.project.name==='phone'){await expect(page.locator('.plan-table-wrap')).not.toBeVisible();await expect(page.locator('.schedule-month')).toHaveCount(5);await page.locator('.schedule-month').last().scrollIntoViewIfNeeded();await expect(page.locator('.schedule-month').last()).toContainText('$0.00');await screenshot('schedule');}
 const axe=await new AxeBuilder({page}).include('.page-heading').include('.payment-allocation').withRules(['color-contrast']).analyze();expect(axe.violations).toEqual([]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await page.getByRole('button',{name:'Debts',exact:true}).click();await page.getByRole('button',{name:'Update balance for Test card'}).click();await page.getByLabel('New current balance').fill('820');await page.getByRole('radio',{name:'Payment',exact:true}).check();await page.getByRole('button',{name:'Save balance'}).click();await expect(page.locator('.simple-balance').first()).toHaveText('$820.00');
 await page.getByRole('button',{name:'Transactions',exact:true}).click();await expect(page.locator('.simple-total>strong')).toHaveText('$100.00');await page.reload();await expect(page.locator('.simple-balance').first()).toHaveText('$820.00');

});
