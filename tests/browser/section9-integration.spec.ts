import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createDemoFixture } from '../../mobile/demo-fixture';
import { DASHBOARD_STORAGE_KEY } from '../../app/data-repository';
import { APPEARANCE_KEY, APPEARANCE_EVENT, THEMES } from '../../app/appearance';

test('integrated screens retain history, contrast, focus and responsive clearance in both themes', async ({ page }, info) => {
  const fixture = createDemoFixture();
  fixture.payload.accounts[1].name = 'Sample travel and household purchases with a long account name';
  fixture.payload.accounts[0].institutionKey = 'other';
  fixture.payload.monthlyBudgets['2026-10'] = [
    { id:'income',name:'Household salary',kind:'income',category:'Salary',amount:25000,paymentMethod:'debit',creditAccountId:'',recurring:true,createdAt:'2026-10-01T12:00:00Z' },
    { id:'food',name:'Household groceries and supplies with a long name',kind:'expense',category:'Food',amount:12500.75,paymentMethod:'debit',creditAccountId:'',recurring:true,createdAt:'2026-10-01T12:00:00Z' },
  ];
  await page.clock.setFixedTime(new Date('2026-10-23T19:00:00Z'));
  await page.addInitScript(({key,fixture}) => {if(!localStorage.getItem(key)) localStorage.setItem(key,JSON.stringify(fixture));}, {key:DASHBOARD_STORAGE_KEY,fixture});
  await page.goto('/');
  await expect(page.getByRole('heading',{name:/Welcome,/})).toBeVisible();
  const before = await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).payload,DASHBOARD_STORAGE_KEY);
  const widths = info.project.name==='phone' ? [320,360,390,430] : [1440];
  const nav = page.getByRole('navigation',{name:'Primary navigation'});
  async function inspect(label:string, width:number, theme:string) {
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${label} document ${width} ${theme}`).toBe(true);

    expect(await page.locator('.page-body').evaluate(el=>el.scrollWidth<=el.clientWidth+1),`${label} content ${width} ${theme}`).toBe(true);
    if(width===320 || width===1440){
      const result=await new AxeBuilder({page}).include('.app-shell').withRules(['color-contrast']).analyze();
      expect(result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})),`${label} ${width} ${theme}`).toEqual([]);
    }
    if(width===390 || width===1440) await page.screenshot({path:info.outputPath(`${theme}-${width}-${label}.png`)});
    if(label==='Home') {
      const link=page.getByRole('button',{name:'Account snapshots',exact:true});
      const labels=page.locator('[class*=chartLabels]');
      expect((await link.boundingBox())!.y).toBeGreaterThanOrEqual((await labels.boundingBox())!.y+(await labels.boundingBox())!.height);
    }
    if(label==='budget-Overview' && width<821){
      const last=page.locator('.budget-section-card>summary').last();
      await last.scrollIntoViewIfNeeded();
      await page.locator('.page-body').evaluate(el=>{el.scrollTop=el.scrollHeight;});
      const bar=page.getByRole('region',{name:'Add a budget entry'});
      expect((await last.boundingBox())!.y+(await last.boundingBox())!.height).toBeLessThanOrEqual((await bar.boundingBox())!.y+1);
      for(const action of await bar.getByRole('button').all()) expect((await action.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await page.locator('.page-body').evaluate(el=>{el.scrollTop=0;});
    }
  }
  for(const [theme,appearance] of Object.entries(THEMES)) {
    await page.evaluate(({key,event,value})=>{localStorage.setItem(key,JSON.stringify(value));window.dispatchEvent(new CustomEvent(event,{detail:value}));},{key:APPEARANCE_KEY,event:APPEARANCE_EVENT,value:{...appearance,size:'larger'}});
    for(const width of widths){
      await page.setViewportSize({width,height:width===1440?1000:844});
      await expect(nav.getByRole('button')).toHaveText(['Home','Debt','Progress','Budget','Settings']);
      for(const name of ['Home','Debt','Progress','Budget','Settings']){
        await nav.getByRole('button',{name,exact:true}).click();
        if(name==='Progress'){
          for(const tab of ['Overview','Trends','Milestones']){
            await page.getByRole('navigation',{name:'Progress sections'}).getByRole('button',{name:tab,exact:true}).click();
            if(tab==='Overview') await expect(page.getByRole('region',{name:'Snapshots',exact:true})).toBeVisible();
            await inspect(`progress-${tab}`,width,theme);
          }
        }else if(name==='Budget'){
          for(const tab of ['Overview','Transactions','Schedule']){
            await page.getByRole('navigation',{name:'Budget sections'}).getByRole('button',{name:tab,exact:true}).click();
            await inspect(`budget-${tab}`,width,theme);
          }
        }else await inspect(name,width,theme);
      }
      await nav.getByRole('button',{name:'Home',exact:true}).focus();
      await page.keyboard.press('Tab');
      await expect(nav.getByRole('button',{name:'Debt',exact:true})).toBeFocused();
      expect(await nav.getByRole('button',{name:'Debt',exact:true}).evaluate(el=>getComputedStyle(el).outlineStyle)).not.toBe('none');
      if(width<821) for(const button of await nav.getByRole('button').all()) expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
  }
  const after = await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).payload,DASHBOARD_STORAGE_KEY);
  expect(after).toEqual(before);
});

test('Dark account editing and discard dialogs remain readable without changing financial history', async ({page})=>{
  await page.addInitScript(({key,fixture,appearanceKey,appearance})=>{localStorage.setItem(key,JSON.stringify(fixture));localStorage.setItem(appearanceKey,JSON.stringify(appearance));},{key:DASHBOARD_STORAGE_KEY,fixture:createDemoFixture(),appearanceKey:APPEARANCE_KEY,appearance:{...THEMES.dark,size:'larger'}});
  await page.goto('/');
  await page.getByRole('navigation',{name:'Primary navigation'}).getByRole('button',{name:'Debt',exact:true}).click();
  await page.getByRole('button',{name:'Open Sample card',exact:true}).click();
  const detail=page.getByRole('dialog',{name:'Sample card',exact:true});await detail.getByRole('tab',{name:'Info'}).click();
  const before=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).payload,DASHBOARD_STORAGE_KEY);
  await detail.getByLabel('Account name',{exact:true}).fill('Discard this synthetic change');
  await detail.getByRole('button',{name:'Back from Sample card'}).click();
  const discard=page.getByRole('dialog',{name:'Unsaved debt account changes'});await expect(discard).toBeVisible();
  expect((await new AxeBuilder({page}).include('[role=dialog]').withRules(['color-contrast']).analyze()).violations).toEqual([]);
  await discard.getByRole('button',{name:'Discard',exact:true}).click();await expect(detail).toHaveCount(0);
  expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).payload,DASHBOARD_STORAGE_KEY)).toEqual(before);
});
