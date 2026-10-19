import { openMore } from './navigation';
import { test, expect, type Page, type Locator } from '@playwright/test';
import { readFileSync } from 'node:fs';

async function load(page: Page) {
  const f=JSON.parse(readFileSync('tests/fixtures/legacy-v0.json','utf8'));
  f.accounts=[{...f.accounts[0],id:'access-card',name:'Synthetic accessibility card',balance:1000,baselineBalance:1200,interestFee:0,apr:0,promoEndDate:'',postPromoApr:0,minimum:50,minimumMode:'manual'}];
  f.transactions=[];f.snapshots=[];f.monthlyBudgets={};
  f.monthlyPlan={months:{},detailedSpendingTracking:false,progressStartingBalance:1200,payoffPlanAmount:100};
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles({name:'accessibility-synthetic.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(f))});
}
async function target(locator: Locator) {
  const box=await locator.boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
}
async function more(page: Page, name: string) {
  await openMore(page);
  await page.getByRole('button',{name,exact:true}).filter({visible:true}).click();
}
async function doubleText(page: Page) {
  // Change CSS text sizes, not CSS zoom: layout/control dimensions remain native.
  await page.evaluate(()=>{
    const rootSize=parseFloat(getComputedStyle(document.documentElement).fontSize);
    function visit(rules: CSSRuleList) {
      for(const rule of rules) {
        if('style' in rule) {
          const style=(rule as CSSStyleRule).style;
          const size=style.getPropertyValue('font-size');
          if(size) style.setProperty('font-size',size.replace(/([\d.]+)(px|vw|vh|vmin|vmax)\b/g,(_,value,unit)=>String(Number(value)*2)+unit),style.getPropertyPriority('font-size'));
        }
        if('cssRules' in rule) visit((rule as CSSGroupingRule).cssRules);
      }
    }
    for(const sheet of document.styleSheets) { try { visit(sheet.cssRules); } catch { /* external styles are not editable */ } }
    document.documentElement.style.fontSize=String(rootSize*2)+'px';
  });
}

test('tablists support arrow/Home/End selection and a single Tab stop',async({page})=>{
  await load(page);
  const cards=page.getByRole('tab',{name:'Cards & other',exact:true});
  const loans=page.getByRole('tab',{name:'House & car',exact:true});
  await cards.focus(); await page.keyboard.press('ArrowRight');
  await expect(loans).toBeFocused();await expect(loans).toHaveAttribute('aria-selected','true');
  await expect(cards).toHaveAttribute('tabindex','-1');
  await expect(page.getByRole('button',{name:'+ Track loan',exact:true})).toHaveCount(0);
  await page.keyboard.press('ArrowRight');await expect(cards).toBeFocused();
  await page.keyboard.press('End');await expect(loans).toBeFocused();
  await page.keyboard.press('Home');await expect(cards).toBeFocused();
  await more(page,'Payoff Plan');
  const planned=page.getByRole('tab',{name:'Planned',exact:true}),recorded=page.getByRole('tab',{name:'Recorded',exact:true});
  await planned.focus();await page.keyboard.press('ArrowLeft');
  await expect(recorded).toBeFocused();await expect(recorded).toHaveAttribute('aria-selected','true');
  await expect(planned).toHaveAttribute('tabindex','-1');
  await page.keyboard.press('Home');await expect(planned).toBeFocused();
  await page.keyboard.press('End');await expect(recorded).toBeFocused();
});

test('mobile targets and reverse modal focus work without the redundant loan entry',async({page})=>{
  await page.setViewportSize({width:390,height:844});await load(page);
  for(const name of ['Open Settings','Activity for Synthetic accessibility card','Record payment for Synthetic accessibility card','Update balance for Synthetic accessibility card','Debt +']) await target(page.getByRole('button',{name,exact:true}));
  const trigger=page.getByRole('button',{name:'Debt +',exact:true});
  await trigger.click();await page.getByLabel('Debt type').selectOption({label:'House loan'});
  const dialog=page.getByRole('dialog',{name:'Loan progress',exact:true});
  const close=dialog.getByRole('button',{name:'Close loan form',exact:true});
  await target(close);
  await close.focus();await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button',{name:'Save loan',exact:true})).toBeFocused();
  await page.keyboard.press('Tab');await expect(close).toBeFocused();
  await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(trigger).toBeFocused();
});

test('200 percent text reflows across debt, loan form, Plan and Progress on a narrow screen',async({page})=>{
  await page.setViewportSize({width:390,height:844});await load(page);
  const heading=page.locator('.page-heading h1');
  const before=await heading.evaluate(e=>parseFloat(getComputedStyle(e).fontSize));
  await doubleText(page);
  expect(await heading.evaluate(e=>parseFloat(getComputedStyle(e).fontSize))).toBeCloseTo(before*2);
  const fit=async()=>{
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    const clipped=await page.locator('.page-heading,.compact-debt-card,.compact-debt-actions button,.sidebar .nav-item,.plan-hero,.allocation-card,.actual-progress-summary,.loan-modal').evaluateAll(elements=>elements.filter(el=>el.getClientRects().length>0 && el.scrollWidth>el.clientWidth+1).map(el=>el.className));
    expect(clipped).toEqual([]);
  };
  await fit();
  await page.getByRole('button',{name:'Debt +',exact:true}).click();
  await page.getByLabel('Debt type').selectOption({label:'House loan'});
  const dialog=page.getByRole('dialog',{name:'Loan progress',exact:true});
  await dialog.getByRole('button',{name:'Save loan',exact:true}).click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  await expect(dialog.getByLabel('Loan name',{exact:true})).toBeFocused();
  await fit();
  const bounds=await dialog.getByRole('button',{name:'Save loan',exact:true}).boundingBox();
  expect(bounds!.y+bounds!.height).toBeLessThanOrEqual(844);
  await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
  await more(page,'Payoff Plan');await fit();
  await page.getByRole('button',{name:'Full payoff schedule →',exact:true}).click();
  await page.locator('.plan-table tbody tr').last().scrollIntoViewIfNeeded();
  await expect(page.locator('.plan-table tbody tr').last()).toBeVisible();
  const last=await page.locator('.plan-table tbody tr').last().boundingBox();
  const navigation=await page.locator('.sidebar').boundingBox();
  expect(last!.y+last!.height).toBeLessThanOrEqual(navigation!.y+1);
  await more(page,'Progress');await fit();
  await expect(page.locator('.actual-progress-summary')).toContainText('$1,200.00');
});
