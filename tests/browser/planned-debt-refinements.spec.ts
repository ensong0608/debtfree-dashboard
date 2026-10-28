import {test,expect,type Page} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import {createDemoFixture} from '../../mobile/demo-fixture';
import {DASHBOARD_STORAGE_KEY} from '../../app/data-repository';
import {APPEARANCE_KEY,APPEARANCE_EVENT,THEMES} from '../../app/appearance';
const nav=(p:Page)=>p.getByRole('navigation',{name:'Primary navigation'});
async function seed(page:Page,theme:'light'|'dark'){
 await page.clock.setFixedTime(new Date('2026-10-28T01:00:00Z'));
 const f=createDemoFixture();
 f.payload.accounts[0]={...f.payload.accounts[0],baselineBalance:2000,minimum:120};
 f.payload.accounts[1]={...f.payload.accounts[1],baselineBalance:1000,minimum:80};
 f.payload.accounts[0].balanceOffset=20;
 f.payload.balanceAdjustments=[{id:"sample-adjustment",accountId:f.payload.accounts[0].id,date:"2026-10-03",balanceBefore:1000,balanceAfter:1020,difference:20,createdAt:"2026-10-03T12:00:00Z"}];
 f.payload.monthlyPlan!.payoffExtraPayment=250;
 f.payload.monthlyPlan!.progressStartingBalance=99999;
 f.payload.monthlyPlan!.loanTrackers=[{id:'home',name:'Sample mortgage',kind:'house',originalAmount:100000,remainingAmount:80000,apr:3,escrow:0,monthlyPayment:1000,balanceKind:'principal',asOf:'2026-10-01',budgetItemId:'mortgage',budgetItemName:'Mortgage',history:[]},{id:'car',name:'Sample Auto',kind:'car',originalAmount:25000,remainingAmount:18000,apr:5,monthlyPayment:300,balanceKind:'principal',asOf:'2026-10-01',budgetItemId:'car-bill',budgetItemName:'Car payment',history:[]}];
 const item=(id:string,name:string,category:string,amount:number)=>({id,name,category,amount,kind:'expense' as const,paymentMethod:'debit' as const,creditAccountId:'',recurring:true,createdAt:'2026-10-01T12:00:00Z'});
 f.payload.monthlyBudgets['2026-10']=[{...item('income','Salary','Salary',5000),kind:'income'},item('mortgage','Mortgage','Housing',1000),item('car-bill','Car payment','Transportation',300),{...item('electric','Electric bill','Utilities',75),dueDay:1}];
 f.payload.transactions.push({...f.payload.transactions[0],id:'interest',type:'fee',category:'Interest',amount:10});
 await page.addInitScript(({key,f,lookKey,look})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(f));localStorage.setItem(lookKey,JSON.stringify(look));},{key:DASHBOARD_STORAGE_KEY,f,lookKey:APPEARANCE_KEY,look:{...THEMES[theme],size:12}});
 await page.goto('/');await expect(page.locator('.home-welcome')).toBeVisible();
}
async function size(page:Page,value:number){await page.evaluate(({key,event,value})=>{const next={...JSON.parse(localStorage.getItem(key)!),size:value};localStorage.setItem(key,JSON.stringify(next));window.dispatchEvent(new CustomEvent(event,{detail:next}));},{key:APPEARANCE_KEY,event:APPEARANCE_EVENT,value});await expect(page.locator('html')).toHaveAttribute('data-text-size',String(value));}
async function screenshot(page:Page,name:string){mkdirSync('.wrangler/planned-debt-review',{recursive:true});await page.screenshot({animations:'disabled',path:`.wrangler/planned-debt-review/${name}.png`});}
async function noOverflow(page:Page){expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
test.beforeEach(async({},info)=>expect(['localhost','127.0.0.1']).toContain(new URL(String(info.project.use.baseURL)).hostname));
for(const theme of ['light','dark'] as const)for(const width of [360,390])test(`scalable details, stable amounts, and canonical progress in ${theme} ${width}`,async({page})=>{
 await page.setViewportSize({width,height:844});await seed(page,theme);
 const slide=()=>page.locator('[aria-roledescription=slide][aria-hidden=false]');
 await expect(slide()).toContainText('Paid:');await expect(slide()).toContainText('1,570.00');await expect(slide()).toContainText('1,430.00');await expect(slide()).not.toContainText('Saved start');await expect(slide()).not.toContainText('Remaining');
 const activity=page.getByRole('region',{name:'Recent financial updates'});let activityFont=0;
 for(const point of [9,16]){await size(page,point);const font=await activity.locator('article>span>b').first().evaluate(el=>parseFloat(getComputedStyle(el).fontSize));if(point===9)activityFont=font;else expect(font).toBeGreaterThan(activityFont);await noOverflow(page);}
 await nav(page).getByRole('button',{name:'Debt',exact:true}).click();
 const summary=page.getByRole('region',{name:'Debt summary',exact:true});await expect(summary).not.toContainText('across tracked');
 for(const category of ['All','Cards & Loans','Home & Auto']){
  await page.getByRole('navigation',{name:'Debt type filters'}).getByRole('button',{name:category,exact:true}).click();
  const cards=page.locator('[data-dialog-return-id]');let initial=0;let amountFont='';
  for(const point of [9,12,16]){
   await size(page,point);const f=await cards.first().locator('strong').first().evaluate(el=>parseFloat(getComputedStyle(el).fontSize));if(point===9)initial=f;else expect(f).toBeGreaterThan(initial);
   const af=await cards.first().locator('.money-value').evaluate(el=>getComputedStyle(el).fontSize);amountFont ||= af;expect(af).toBe(amountFont);
   for(const card of await cards.all()){
    const identity=(await card.locator('strong').first().boundingBox())!,amount=(await card.locator('.money-value').boundingBox())!,box=(await card.boundingBox())!;
    expect(identity.x+identity.width).toBeLessThanOrEqual(amount.x+1);expect(amount.x+amount.width).toBeLessThan(box.x+box.width-8);
   }
   await noOverflow(page);
  }
 }
 await screenshot(page,`debt-${theme}-${width}`);
 await nav(page).getByRole('button',{name:'Progress',exact:true}).click();
 for(const tab of ['Overview','Milestones']){await page.getByRole('button',{name:tab,exact:true}).click();await expect(slide()).toContainText('Paid:');await expect(slide()).toContainText('1,570.00');await expect(slide()).toContainText('1,430.00');await expect(slide()).not.toContainText('Saved start');await noOverflow(page);}
 await screenshot(page,`progress-${theme}-${width}`);
 await nav(page).getByRole('button',{name:'Home',exact:true}).click();await page.getByRole('button',{name:'Open Account',exact:true}).click();
 const back=(await page.getByRole('button',{name:'Close Account',exact:true}).boundingBox())!,title=(await page.getByRole('heading',{name:'Account',exact:true}).boundingBox())!;expect(back.x+back.width).toBeLessThanOrEqual(title.x);
});
for(const theme of ['light','dark'] as const)test(`Budget minimums and editable recurring records in ${theme}`,async({page})=>{
 await page.setViewportSize({width:360,height:844});await seed(page,theme);await size(page,16);
 await nav(page).getByRole('button',{name:'Budget',exact:true}).click();
 const details=page.locator('details').filter({has:page.locator('summary').filter({hasText:'Debt payments'})});
 await details.locator('summary').click();await expect(details).toContainText('450.00');await expect(details).toContainText('Minimums');await expect(details).toContainText('200.00');await expect(details).toContainText('Extra payments');await expect(details).toContainText('250.00');await expect(details).not.toContainText('Mortgage');await expect(details).not.toContainText('Auto');await expect(details).not.toContainText('Household payment');await screenshot(page,`budget-${theme}`);
 await nav(page).getByRole('button',{name:'Transactions',exact:true}).click();
 await expect(page.getByRole('button',{name:'Explain Balance adjustments',exact:true})).toContainText('20.00');
 await expect(page.getByRole('button',{name:'Explain Payments recorded',exact:true})).toContainText('100.00');await expect(page.getByRole('button',{name:'Explain Interest & fees',exact:true})).toContainText('10.00');await expect(page.getByRole('button',{name:'Explain Net balance change',exact:true})).toContainText('70.00');
 await expect(page.getByText('History',{exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Undo paid',exact:true})).toHaveCount(0);await expect(page.getByText('Automatic',{exact:true})).toHaveCount(0);
 const row=page.locator('[data-paid-record]').filter({hasText:'Electric bill'});await row.getByRole('button').click();const dialog=page.getByRole('dialog',{name:'Edit paid record'});await expect(dialog).toBeVisible();
 await dialog.getByRole('textbox',{name:'Paid record name'}).fill('Electric corrected');await dialog.getByRole('textbox',{name:'Paid record amount'}).fill('65');await dialog.getByRole('button',{name:'Save',exact:true}).click();await expect(dialog).toHaveCount(0);await expect(page.locator('[data-paid-record]').filter({hasText:'Electric corrected'})).toContainText('65.00');
 await screenshot(page,`transactions-${theme}`);
 await page.locator('[data-paid-record]').filter({hasText:'Electric corrected'}).getByRole('button').click();await page.getByRole('dialog').getByRole('button',{name:'Undo paid',exact:true}).click();await expect(page.locator('[data-paid-record]').filter({hasText:'Electric corrected'})).toHaveCount(0);
 await nav(page).getByRole('button',{name:'Home',exact:true}).click();await nav(page).getByRole('button',{name:'Transactions',exact:true}).click();await expect(page.locator('[data-paid-record]').filter({hasText:/Electric/})).toHaveCount(0);await noOverflow(page);
});
