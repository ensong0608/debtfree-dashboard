import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import {createDemoFixture} from '../../mobile/demo-fixture';
import {DASHBOARD_STORAGE_KEY} from '../../app/data-repository';
import {APPEARANCE_KEY,APPEARANCE_EVENT,THEMES} from '../../app/appearance';
for(const theme of ['light','dark'] as const)test(`Brighter Tomorrow preserves phone controls and follows accent in ${theme}`,async({page},info)=>{
 expect(new URL(String(info.project.use.baseURL)).hostname).toBe('localhost');
 await page.clock.setFixedTime(new Date('2026-10-28T12:00:00Z'));
 const fixture=createDemoFixture();
 fixture.payload.monthlyBudgets['2026-10']=[{id:'salary',name:'Salary',category:'Salary',amount:5200,kind:'income',paymentMethod:'debit',creditAccountId:'',recurring:true,createdAt:'2026-10-01T12:00:00Z'},{id:'housing',name:'Housing',category:'Housing',amount:1850,kind:'expense',paymentMethod:'debit',creditAccountId:'',recurring:true,createdAt:'2026-10-01T12:00:00Z'}];
 await page.addInitScript(({key,fixture,lookKey,look})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(fixture));localStorage.setItem(lookKey,JSON.stringify(look));},{key:DASHBOARD_STORAGE_KEY,fixture,lookKey:APPEARANCE_KEY,look:THEMES[theme]});
 await page.goto('/');await expect(page.locator('.home-welcome')).toContainText('You’re one step closer');
 mkdirSync('.wrangler/brighter-tomorrow',{recursive:true});
 await page.screenshot({path:`.wrangler/brighter-tomorrow/${theme}-Default.png`,animations:'disabled'});
 const nav=page.getByRole('navigation',{name:'Primary navigation'});
 await expect(nav.getByRole('button')).toHaveCount(5);
 const art=page.locator('.brighter-header-art');await expect(art).toHaveCount(1);
 const headerBox=await page.locator('.shared-dashboard-header').boundingBox();
 const before=await art.locator('path').nth(1).evaluate(el=>getComputedStyle(el).fill);
 const paid=page.locator('[aria-hidden=false] [class*=progressValue]');const paidColor=await paid.evaluate(el=>getComputedStyle(el).color);
 await page.evaluate(({key,event})=>{const current=JSON.parse(localStorage.getItem(key)!);const p={...current,accent:current.theme==='dark'?'#a78bfa':'#7040b4',primaryLight:'#7040b4',primaryDark:'#a78bfa'};localStorage.setItem(key,JSON.stringify(p));window.dispatchEvent(new CustomEvent(event,{detail:p}));},{key:APPEARANCE_KEY,event:APPEARANCE_EVENT});
 expect(await art.locator('path').nth(1).evaluate(el=>getComputedStyle(el).fill)).not.toBe(before);
 expect(await page.locator('.shared-dashboard-header').boundingBox()).toEqual(headerBox);
 expect(await paid.evaluate(el=>getComputedStyle(el).color)).toBe(paidColor);
 mkdirSync('.wrangler/brighter-tomorrow',{recursive:true});
 for(const name of ['Home','Debt','Transactions','Budget','Progress']){
  if(name!=='Home')await nav.getByRole('button',{name,exact:true}).click();
  await expect(page.locator('.shared-dashboard-header')).toBeVisible();
  if(name==='Budget'){const summary=page.getByRole('region',{name:'Monthly budget summary'});await expect(summary).toBeVisible();await expect(summary.getByRole('button',{name:'Edit',exact:true})).toBeVisible();await expect(summary).toContainText('A little plan. A little more peace.');}
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`.wrangler/brighter-tomorrow/${theme}-${name}.png`,animations:'disabled'});
 }
 await page.getByRole('button',{name:'Open Settings',exact:true}).click();
 await expect(page.getByRole('button',{name:/Accent color/})).toBeVisible();
 await page.getByRole('button',{name:/Accent color/}).click();
 await expect(page.getByRole('region',{name:'Appearance settings'})).toBeVisible();
 await page.screenshot({path:`.wrangler/brighter-tomorrow/${theme}-Appearance.png`,animations:'disabled'});
});
