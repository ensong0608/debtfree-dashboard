import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {readFileSync,mkdirSync} from 'node:fs';
const output='outputs/ui-verification/redesign';

test('approved main tabs and secondary pages remain usable with synthetic data',async({page},info)=>{
 const fixture=JSON.parse(readFileSync('tests/fixtures/legacy-v0.json','utf8'));
 const now=new Date();const month=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
 fixture.accounts[0].baselineBalance=3000;fixture.monthlyPlan={...fixture.monthlyPlan,payoffPlanAmount:500,progressStartingBalance:3000};
 fixture.monthlyBudgets[month]=[{id:'salary',name:'Test household salary',kind:'income',category:'Salary',amount:4200,paymentMethod:'debit',creditAccountId:'',recurring:true,createdAt:now.toISOString()},{id:'rent',name:'Test rent',kind:'expense',category:'Housing',amount:1400,paymentMethod:'debit',creditAccountId:'',recurring:true,createdAt:now.toISOString()}];
 mkdirSync(output,{recursive:true});
 await page.goto('/');await page.locator('input[type=file]').setInputFiles({name:'synthetic.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))});
 const screenshot=async(name:string)=>{await page.screenshot({path:`${output}/${info.project.name}-${name}.png`,fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);};
 for(const width of info.project.name==='phone'?[360,390,430]:info.project.name==='tablet'?[768]:[1440]){
  await page.setViewportSize({width,height:900});
  for(const name of ['Debts','Transactions','Budget','More']){await page.getByRole('button',{name,exact:true}).click();await screenshot(`${width}-${name.toLowerCase()}`);}
 }
 for(const name of ['Payoff Calculator','Payoff Plan','Progress','Settings','Credit Utilization','Stats & Projections']){
  await page.getByRole('button',{name:'More',exact:true}).click();await page.getByRole('button',{name,exact:true}).click();
  await screenshot(name.toLowerCase().replace(/[^a-z]+/g,'-'));
  const axe=await new AxeBuilder({page}).include('.page-heading').include('.screen').withRules(['color-contrast']).analyze();expect(axe.violations).toEqual([]);
 }
 await page.getByRole('button',{name:'Debts',exact:true}).click();
 await page.getByRole('button',{name:'Activity for Sample Rewards Card',exact:true}).click();await screenshot('activity');await page.getByRole('button',{name:'Close activity',exact:true}).click();
 await page.getByRole('button',{name:'Debt +',exact:true}).click();await screenshot('debt-form');
});

test('all five setup steps share the design system, validate, normalize income and preserve loans on reload',async({page},info)=>{
 mkdirSync(output,{recursive:true});await page.goto('/');
 const screenshot=async(step:number)=>{await page.screenshot({path:`${output}/${info.project.name}-onboarding-${step}.png`,fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);};
 await screenshot(1);await page.getByRole('button',{name:'Start my payoff plan',exact:true}).click();
 await page.getByRole('button',{name:'Continue',exact:true}).click();await expect(page.getByRole('alert')).toContainText('needs a name');
 await page.getByLabel('Income source name',{exact:true}).fill('Test salary');await page.getByRole('button',{name:'Biweekly',exact:true}).click();await page.getByLabel('Take-home amount per paycheck',{exact:true}).fill('1800');await expect(page.locator('.onboarding-total')).toContainText('$3,900.00');
 await screenshot(2);await page.getByRole('button',{name:'Continue',exact:true}).click();
 await page.getByLabel('Debt name',{exact:true}).fill('Test card');await page.getByLabel('Current balance',{exact:true}).fill('2000');await page.getByLabel('APR',{exact:true}).fill('18');await page.getByLabel('Minimum monthly payment',{exact:true}).fill('60');
 await page.getByRole('button',{name:'+ Add another debt',exact:true}).click();await page.getByLabel('Debt type',{exact:true}).nth(1).selectOption('House loan');await page.getByLabel('Debt name',{exact:true}).nth(1).fill('Test mortgage');await page.getByLabel('Current balance',{exact:true}).nth(1).fill('80000');await page.getByLabel('APR',{exact:true}).nth(1).fill('4');await page.getByLabel('Minimum monthly payment',{exact:true}).nth(1).fill('700');
 await screenshot(3);await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByRole('button',{name:'Help me calculate',exact:false}).click();await page.getByLabel('Housing',{exact:true}).fill('300');await page.getByLabel('Food',{exact:true}).fill('400');await page.getByLabel('Safety buffer',{exact:true}).fill('200');await page.getByLabel('Adjusted monthly debt-payment amount',{exact:true}).fill('1200');
 await screenshot(4);await page.getByRole('button',{name:'Generate my plan',exact:true}).click();await expect(page.locator('[aria-current=step]')).toHaveText('5Plan');await screenshot(5);
 const axe=await new AxeBuilder({page}).include('.onboarding-shell').withRules(['color-contrast']).analyze();expect(axe.violations).toEqual([]);
 await page.getByRole('button',{name:'Continue into the application',exact:true}).click();await expect(page.locator('.simple-balance')).toHaveText('$2,000.00');await page.reload();await page.getByRole('tab',{name:'House & car',exact:true}).click();await expect(page.locator('.loan-progress-card')).toContainText('Test mortgage');
});
