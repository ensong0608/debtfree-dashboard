import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import {createDemoFixture} from '../../mobile/demo-fixture';
import {DASHBOARD_STORAGE_KEY} from '../../app/data-repository';
import {APPEARANCE_KEY,APPEARANCE_EVENT,THEMES} from '../../app/appearance';
for(const theme of ['light','dark','tomorrow'] as const)test(`separate ${theme} theme preserves controls and isolates artwork`,async({page},info)=>{
 expect(new URL(String(info.project.use.baseURL)).hostname).toBe('localhost');
 await page.clock.setFixedTime(new Date('2026-10-28T12:00:00Z'));
 const fixture=createDemoFixture();
 fixture.payload.monthlyBudgets['2026-10']=[{id:'salary',name:'Salary',category:'Salary',amount:5200,kind:'income',paymentMethod:'debit',creditAccountId:'',recurring:true,createdAt:'2026-10-01T12:00:00Z'},{id:'housing',name:'Housing',category:'Housing',amount:1850,kind:'expense',paymentMethod:'debit',creditAccountId:'',recurring:true,createdAt:'2026-10-01T12:00:00Z'}];
 await page.addInitScript(({key,fixture,lookKey,look})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(fixture));localStorage.setItem(lookKey,JSON.stringify(look));},{key:DASHBOARD_STORAGE_KEY,fixture,lookKey:APPEARANCE_KEY,look:THEMES[theme]});
 await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-theme',theme);
 const nav=page.getByRole('navigation',{name:'Primary navigation'});await expect(nav.getByRole('button')).toHaveCount(5);
 mkdirSync('.wrangler/brighter-tomorrow',{recursive:true});
 for(const name of ['Home','Debt','Transactions','Budget','Progress']){
  if(name!=='Home')await nav.getByRole('button',{name,exact:true}).click();
  await expect(page.locator('.shared-dashboard-header')).toBeVisible();
  if(theme==='tomorrow')await expect(page.locator('.brighter-header-art')).toBeVisible();
  else{await expect(page.locator('.brighter-header-art')).toBeHidden();expect(await page.locator('.brighter-card-art:visible,.brighter-encouragement:visible').count()).toBe(0);}
  if(name==='Home')await expect(page.locator('.home-welcome')).toContainText(theme==='tomorrow'?'You’re one step closer':'Your debt-free journey');
  if(name==='Transactions')expect(await page.locator('.budget-net-change').evaluate(el=>getComputedStyle(el,'::after').content)).toBe(theme==='tomorrow'?'"Every step counts."':'none');
  if(name==='Budget'){const summary=page.getByRole('region',{name:'Monthly budget summary'});await expect(summary.getByRole('button',{name:'Edit',exact:true})).toBeVisible();}
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`.wrangler/brighter-tomorrow/${theme}-${name}.png`,animations:'disabled'});
 }
 await page.getByRole('button',{name:'Open Settings',exact:true}).click();await page.getByRole('button',{name:/Accent color/}).click();
 const themes=page.getByRole('group',{name:'Choose theme'});await expect(themes.getByRole('button')).toHaveCount(3);
 for(const [id,label] of [['tomorrow','Sunshine'],['light','Light'],['dark','Dark'],['tomorrow','Sunshine']]){await themes.getByRole('button',{name:label,exact:true}).click();await expect(page.locator('html')).toHaveAttribute('data-theme',id);}
 await page.locator('.appearance-accents button').filter({hasText:'Purple'}).click();
 const beforeReload=await page.locator('.brighter-header-art path').nth(1).evaluate(el=>getComputedStyle(el).fill);
 await page.getByRole('button',{name:'Close Appearance',exact:true}).click();await page.getByRole('button',{name:'Close Settings',exact:true}).click();
 await nav.getByRole('button',{name:'Home',exact:true}).click();await expect(page.locator('.brighter-header-art')).toBeVisible();
 // Changing the third theme's accent must not replace either built-in palette.
 await page.evaluate(({key,event})=>{const current=JSON.parse(localStorage.getItem(key)!);const next={...current,primaryTomorrow:'#08766f',accent:'#08766f'};localStorage.setItem(key,JSON.stringify(next));window.dispatchEvent(new CustomEvent(event,{detail:next}));},{key:APPEARANCE_KEY,event:APPEARANCE_EVENT});
 expect(await page.locator('.brighter-header-art path').nth(1).evaluate(el=>getComputedStyle(el).fill)).not.toBe(beforeReload);
 await page.screenshot({path:`.wrangler/brighter-tomorrow/${theme}-switched-third.png`,animations:'disabled'});
});
