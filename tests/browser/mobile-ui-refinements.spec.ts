import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {readFileSync,mkdirSync} from 'node:fs';

test('Progress matches the summary-first design and mobile entry choices never overlap',async({page},info)=>{
 const fixture=JSON.parse(readFileSync('tests/fixtures/legacy-v0.json','utf8'));
 const today=new Date().toISOString().slice(0,10), now=today+'T12:00:00Z';
 fixture.accounts=[{...fixture.accounts[0],id:'card',name:'Everyday Card with a long account name',balance:5000,baselineBalance:6250,balanceOffset:0,minimum:150,apr:22,interestFee:0,archivedAt:null},{...fixture.accounts[0],id:'paid',name:'Paid off card',balance:0,baselineBalance:2000,balanceOffset:0,minimum:0,apr:0,interestFee:0,archivedAt:null}];
 fixture.transactions=[{id:'purchase',accountId:'card',type:'charge',amount:66.96,date:today,createdAt:now,payeeId:'',payeeName:'Grocery store',category:'Purchases',memo:'',title:'Weekly grocery run with a long activity title'}];
 fixture.balanceAdjustments=[];fixture.monthlyPlan={progressStartingBalance:10000,months:{},detailedSpendingTracking:false};
 fixture.snapshots=['2026-07','2026-09'].map((month,i)=>({...fixture.snapshots[0],id:'snapshot-'+i,month,capturedAt:month+'-09T12:00:00Z',totalBalance:i?5500:10000,accounts:fixture.accounts.map((a:{id:string;name:string;type:string;balance:number;apr:number},j:number)=>({accountId:a.id,name:a.name,type:a.type,balance:j?0:i?5500:10000,apr:a.apr}))}));
 fixture.snapshots[1].accounts=fixture.snapshots[1].accounts.slice(0,1);
 await page.goto('/');await page.locator('input[type=file]').setInputFiles({name:'disposable-ui.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))});
 const screenshot=async(name:string)=>{mkdirSync('outputs/ui-verification/refined',{recursive:true});await page.screenshot({path:`outputs/ui-verification/refined/${info.project.name}-${name}.png`});};
 const card=page.locator('.compact-debt-card').filter({hasText:'Everyday Card with a long account name'});
 const payment=card.getByRole('button',{name:'Record payment for Everyday Card with a long account name'});
 expect(await payment.evaluate(e=>getComputedStyle(e).backgroundColor)).toBe('rgb(185, 238, 224)');await screenshot('debts');
 await card.getByRole('button',{name:'Activity for Everyday Card with a long account name'}).press('Enter');
 let dialog=page.getByRole('dialog');await expect(dialog.locator('summary')).toHaveCount(0);await expect(dialog.locator('details')).toHaveCount(0);await expect(dialog).toContainText('Weekly grocery run with a long activity title');
 if(info.project.name==='phone'){
  const box=await dialog.boundingBox(),viewport=page.viewportSize()!;
  expect(box!.x).toBe(0);expect(box!.y).toBe(0);expect(box!.width).toBe(viewport.width);expect(box!.height).toBe(viewport.height);
 }
 await screenshot('activity');await page.getByRole('button',{name:'Close activity'}).click();
 await page.getByRole('button',{name:'Transactions',exact:true}).click();await page.getByRole('button',{name:'Add record',exact:true}).click();dialog=page.getByRole('dialog');
 await dialog.getByLabel('What’s it for?',{exact:true}).fill('Statement refund');await dialog.getByLabel('Transaction amount').fill('-150');
 const plus=dialog.getByRole('button',{name:'Use positive amount'}),minus=dialog.getByRole('button',{name:'Use negative amount'});
 for(const button of [plus,minus]){
  expect(await button.evaluate(e=>{
   const b=e.getBoundingClientRect(),r=document.createRange();r.selectNodeContents(e);const t=r.getBoundingClientRect();return t.left>=b.left&&t.right<=b.right&&t.top>=b.top&&t.bottom<=b.bottom;
  })).toBe(true);
 }
 const pb=await plus.boundingBox(),mb=await minus.boundingBox();expect(pb!.x+pb!.width).toBeLessThan(mb!.x);expect(pb!.y).toBe(mb!.y);
 for(const name of ['Payment','Refund / credit','Balance correction'])await expect(dialog.getByRole('radio',{name,exact:true})).toBeVisible();
 await dialog.getByRole('radio',{name:'Refund / credit',exact:true}).check();await expect(dialog).toContainText('Debt decreases by $150.00');await expect(dialog).toContainText('$4,916.96');
 await dialog.locator('.signed-amount-controls').scrollIntoViewIfNeeded();await screenshot('transaction');await dialog.getByRole('button',{name:'Save transaction',exact:true}).click();await expect(page.locator('.simple-total>strong')).toHaveText('$0.00');
 await page.reload();await page.getByRole('button',{name:'More',exact:true}).click();await page.getByRole('button',{name:'Progress',exact:true}).filter({visible:true}).click();
 const hero=page.locator('.actual-progress-summary');await expect(hero).toContainText('$10,000.00');await expect(hero).toContainText('$4,916.96');await expect(hero.locator('.progress-snapshot-chart circle')).toHaveCount(2);await expect(page.locator('.paid-off-card')).toContainText('1');
 for(const amount of await page.locator('.snapshot-chart-labels strong').all())expect(await amount.evaluate(e=>e.scrollWidth<=e.clientWidth+1&&e.getBoundingClientRect().height<26)).toBe(true);
 await expect(page.getByRole('region',{name:'Snapshots'}).locator('.saved-check')).toHaveCount(2);await screenshot('progress');
 const axe=await new AxeBuilder({page}).include('.actual-progress-screen').withRules(['color-contrast']).analyze();expect(axe.violations).toEqual([]);
 await page.getByRole('button',{name:'More',exact:true}).click();await page.getByRole('button',{name:'Payoff Calculator',exact:true}).click();
 await page.getByLabel('Total monthly debt payment',{exact:true}).fill('600');expect(await page.getByLabel('Total monthly debt payment',{exact:true}).evaluate(e=>parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(24);await expect(page.getByRole('button',{name:'Calculate scenario',exact:true})).toBeVisible();const budgetBox=await page.locator('.extra-control>div').boundingBox(),inputBox=await page.getByLabel('Total monthly debt payment',{exact:true}).boundingBox();expect(inputBox!.y).toBeGreaterThanOrEqual(budgetBox!.y);expect(inputBox!.y+inputBox!.height).toBeLessThanOrEqual(budgetBox!.y+budgetBox!.height);await screenshot('calculator');
 await page.getByRole('button',{name:'Use this in my plan',exact:true}).click();await expect(page.locator('.plan-commitment')).toContainText('$600.00');await expect(page.getByRole('tab',{name:'Planned',exact:true})).toHaveAttribute('aria-selected','true');await screenshot('plan');
 await page.getByRole('tab',{name:'Recorded',exact:true}).click();await expect(page.locator('.allocation-total').first()).toHaveText('$0.00');await page.getByRole('tab',{name:'Planned',exact:true}).click();await expect(page.getByLabel('Minimum payment for Everyday Card with a long account name')).toHaveValue('150');
 await expect(page.getByLabel('Total monthly debt payment',{exact:true})).not.toBeVisible();await page.getByRole('button',{name:'Edit plan',exact:true}).click();await expect(page.getByLabel('Total monthly debt payment',{exact:true})).toBeVisible();

 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});

test('direction labels and decrease options fit a small phone with larger text',async({page})=>{
 await page.setViewportSize({width:320,height:740});await page.goto('/');
 const fixture=readFileSync('tests/fixtures/legacy-v0.json');await page.locator('input[type=file]').setInputFiles({name:'disposable-small-phone.json',mimeType:'application/json',buffer:fixture});
 await page.getByRole('button',{name:'Transactions',exact:true}).click();await page.getByRole('button',{name:'Add record',exact:true}).click();
 await page.addStyleTag({content:'.transaction-compose .signed-amount-controls button{font-size:18px}.transaction-compose .decrease-classification label{font-size:17px}'});
 const dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:'Use negative amount'}).click();
 for(const name of ['Payment','Refund / credit','Balance correction'])await expect(dialog.getByRole('radio',{name,exact:true})).toBeVisible();
 const box=await dialog.locator('.signed-amount-controls').boundingBox(),classBox=await dialog.locator('.decrease-classification').boundingBox();expect(box!.y+box!.height).toBeLessThan(classBox!.y);
 expect(await dialog.evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);
});
