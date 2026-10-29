import {test,expect} from '@playwright/test';
import {createDemoFixture} from '../../mobile/demo-fixture';
import {DASHBOARD_STORAGE_KEY} from '../../app/data-repository';
import {accrueCostcoInterest} from '../../app/interest-accrual';
import {APPEARANCE_KEY,THEMES} from '../../app/appearance';

test('phone Advanced records dated actual interest once and preserves the manual payment and saved fee',async({page},info)=>{
 expect(['localhost','127.0.0.1']).toContain(new URL(String(info.project.use.baseURL)).hostname);
 await page.clock.setFixedTime(new Date('2026-10-29T20:00:00Z'));
 const fixture=createDemoFixture();
 const card={...fixture.payload.accounts[0],name:'Interest test',type:'Credit card' as const,balance:10000,balanceOffset:0,reconciliation:undefined,baselineBalance:10000,apr:24,interestFee:188.01,minimum:350,minimumMode:'manual' as const,promoEndDate:'',postPromoApr:0,postPromoMinimum:0,createdAt:'2026-09-01',interestAutomation:{enabled:true,closingDay:29,coveredThrough:'2026-09-29',estimatedApr:24}};
 fixture.payload.accounts=[card];
 fixture.payload.transactions=accrueCostcoInterest([card],[],'2026-10-29');
 fixture.payload.balanceAdjustments=[];
 fixture.payload.monthlyPlan!.loanTrackers=[];
 await page.addInitScript(({key,fixture,appearanceKey,appearance})=>{
   if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(fixture));
   localStorage.setItem(appearanceKey,JSON.stringify(appearance));
 },{key:DASHBOARD_STORAGE_KEY,fixture,appearanceKey:APPEARANCE_KEY,appearance:THEMES.light});
 const saved=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).payload,DASHBOARD_STORAGE_KEY);
 await page.goto('/');
 await page.getByRole('navigation',{name:'Primary navigation'}).getByRole('button',{name:'Debt',exact:true}).click();
 await page.getByRole('button',{name:'Open Interest test',exact:true}).click();
 const detail=page.getByRole('dialog',{name:'Interest test',exact:true});
 await detail.getByRole('tab',{name:'Detail',exact:true}).click();
 await detail.getByRole('button',{name:'Advanced',exact:true}).click();
 const advanced=page.getByRole('dialog',{name:'Advanced',exact:true});
 await expect(advanced.getByText(/Saved undated interest/)).toContainText('Reference only; forecasts use APR.');
 await expect(advanced.getByRole('textbox',{name:/^Actual interest fee/})).toHaveCount(0);
 await advanced.getByRole('textbox',{name:'Actual interest amount',exact:true}).fill('220');
 await expect(advanced.getByRole('group',{name:'Statement closing date',exact:true})).toBeVisible();
 await advanced.getByText('Estimate assumptions',{exact:true}).click();
 await expect(advanced.getByText(/Missing opening history/)).toBeVisible();
 await advanced.getByRole('button',{name:'Back from Advanced',exact:true}).click();
 await detail.getByRole('button',{name:'Save',exact:true}).click();
 await expect.poll(async()=> (await saved()).transactions.filter((t:{actualInterestCycle?:string;deletedAt?:string})=>t.actualInterestCycle==='2026-10'&&!t.deletedAt).length).toBe(1);
 const data=await saved();
 expect(data.accounts[0].minimum).toBe(350);
 expect(data.accounts[0].minimumMode).toBe('manual');
 expect(data.accounts[0].interestFee).toBe(188.01);
 expect(data.transactions.find((t:{interestEstimate?:unknown})=>t.interestEstimate).deletedAt).toBeTruthy();
 // A later metadata save cannot post the just-entered actual interest again.
 await detail.getByRole('textbox',{name:'Account',exact:true}).fill('Interest renamed');
 await detail.getByRole('button',{name:'Save',exact:true}).click();
 await expect.poll(async()=> (await saved()).accounts[0].name).toBe('Interest renamed');
 expect((await saved()).transactions.filter((t:{actualInterestCycle?:string})=>t.actualInterestCycle).length).toBe(1);
 await page.reload();
 expect((await saved()).transactions.filter((t:{actualInterestCycle?:string})=>t.actualInterestCycle).length).toBe(1);
});
