import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import {createDemoFixture} from '../../mobile/demo-fixture';
import {DASHBOARD_STORAGE_KEY} from '../../app/data-repository';
import {APPEARANCE_KEY,APPEARANCE_EVENT,THEMES} from '../../app/appearance';
for(const theme of ['light','dark','tomorrow'] as const)test(`${theme} countdown matches schedule and keeps themed artwork isolated`,async({page},info)=>{
 expect(new URL(String(info.project.use.baseURL)).hostname).toBe('localhost');
 await page.clock.setFixedTime(new Date('2026-10-28T12:00:00Z'));
 const fixture=createDemoFixture();
 await page.addInitScript(({key,fixture,lookKey,look})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(fixture));localStorage.setItem(lookKey,JSON.stringify(look));},{key:DASHBOARD_STORAGE_KEY,fixture,lookKey:APPEARANCE_KEY,look:THEMES[theme]});
 await page.goto('/');
 const card=page.getByRole('button',{name:'Debt-free countdown. Open payoff schedule',exact:true});
 await expect(card).toBeVisible();await expect(card).toContainText('Cards & Loans · includes auto');
 const date=card.locator('time');await expect(date).toHaveCount(1);
 const month=await date.getAttribute('datetime');expect(month).toMatch(/^\d{4}-\d{2}$/);
 const months=(Number(month!.slice(0,4))-2026)*12+Number(month!.slice(5,7))-10;
 await expect(card).toContainText(String(months));
 const art=card.locator('svg');if(theme==='tomorrow')await expect(art).toBeVisible();else await expect(art).toBeHidden();
 for(const width of [390,320]){
  await page.setViewportSize({width,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const d=await date.boundingBox(),r=await card.locator('[class*="remaining"]').boundingBox();
  expect(d!.x+d!.width).toBeLessThanOrEqual(r!.x);
 }
 await page.setViewportSize({width:390,height:844});
 mkdirSync('.wrangler/countdown-card',{recursive:true});await page.screenshot({path:`.wrangler/countdown-card/${theme}.png`,animations:'disabled'});
 await card.click();await expect(page.getByRole('dialog',{name:'Payoff Strategy',exact:true})).toBeVisible();
 await expect(page.locator('body')).toContainText(new Date(month+'-01T12:00:00Z').toLocaleDateString('en-US',{month:'short',year:'numeric',timeZone:'UTC'}));
 // Theme switching must remove the illustration without a reload.
 await page.getByRole('button',{name:'Close payoff strategy and go back',exact:true}).click();
 await page.evaluate(({key,event,look})=>{localStorage.setItem(key,JSON.stringify(look));window.dispatchEvent(new CustomEvent(event,{detail:look}));},{key:APPEARANCE_KEY,event:APPEARANCE_EVENT,look:THEMES[theme==='tomorrow'?'dark':'tomorrow']});
 await expect(page.locator('html')).toHaveAttribute('data-theme',theme==='tomorrow'?'dark':'tomorrow');
});

for(const state of ['paid','unavailable'] as const)test(`countdown handles ${state} without inventing a date`,async({page})=>{
 await page.clock.setFixedTime(new Date('2026-10-28T12:00:00Z'));
 const fixture=createDemoFixture();fixture.payload.transactions=[];
 fixture.payload.accounts=fixture.payload.accounts.map(account=>({...account,balance:state==='paid'?0:account.balance,apr:state==='paid'?0:100,minimum:25}));
 await page.addInitScript(({key,fixture})=>localStorage.setItem(key,JSON.stringify(fixture)),{key:DASHBOARD_STORAGE_KEY,fixture});
 await page.goto('/');const card=page.getByRole('button',{name:'Debt-free countdown. Open payoff schedule',exact:true});
 await expect(card).toBeVisible();await expect(card.locator('time')).toHaveCount(0);
 await expect(card).toContainText(state==='paid'?'Debt-free':'Review plan');
 await expect(card.locator('[class*="remaining"]')).toHaveCount(0);
});
