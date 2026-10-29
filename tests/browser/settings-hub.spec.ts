import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import {createDemoFixture} from '../../mobile/demo-fixture';
import {DASHBOARD_STORAGE_KEY} from '../../app/data-repository';
import {THEMES,APPEARANCE_KEY} from '../../app/appearance';
for(const theme of ['light','dark','tomorrow'] as const)test(`${theme}: one Settings hub, notification gates, security and reset warning`,async({page},info)=>{
 expect(new URL(String(info.project.use.baseURL)).hostname).toBe('localhost');
 await page.clock.setFixedTime(new Date('2026-10-28T12:00:00Z'));
 const fixture=createDemoFixture();
 await page.addInitScript(({key,fixture,appearance,look})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(fixture));localStorage.setItem(appearance,JSON.stringify(look));},{key:DASHBOARD_STORAGE_KEY,fixture,appearance:APPEARANCE_KEY,look:THEMES[theme]});
 await page.goto('/');await page.getByRole('button',{name:'Open Settings',exact:true}).click();await expect(page.locator('.shared-dashboard-title')).toHaveText('Settings');
 await expect(page.locator('.settings-profile')).toHaveCount(0);
 for(const label of ['Theme','Accent color','Text size','Notifications','Members','Currency','Security','Backup & recovery','Archived Debts','Refer friends','Give feedback','Reset Account'])await expect(page.getByRole('button',{name:new RegExp('^'+label.replace('&','&'))})).toBeVisible();
 await page.getByRole('button',{name:/^Theme/}).click();await expect(page.getByRole('group',{name:'Choose theme'}).getByRole('button')).toHaveCount(3);await page.getByRole('button',{name:'Close Appearance',exact:true}).click();
 await page.getByRole('button',{name:/^Notifications/}).click();await expect(page.getByRole('switch',{name:'Notifications',exact:true})).toBeDisabled();
 for(const name of ['Next Due Reminder','Next Budget Reminder','Transactions Reminder'])await expect(page.getByRole('switch',{name,exact:true})).toBeDisabled();
 await expect(page.getByText(/Tuesday at 9:00 AM Pacific/)).toBeVisible();
 mkdirSync('.wrangler/settings-review',{recursive:true});await page.screenshot({path:`.wrangler/settings-review/${theme}-notifications.png`,animations:'disabled'});
 await page.getByRole('button',{name:'Close Notifications',exact:true}).click();await page.getByRole('button',{name:/^Security/}).click();await expect(page.getByRole('heading',{name:'Current device',exact:true})).toBeVisible();await expect(page.getByRole('switch')).toHaveCount(0);await page.getByRole('button',{name:'Close Security settings',exact:true}).click();
 const stored=await page.evaluate(key=>localStorage.getItem(key),DASHBOARD_STORAGE_KEY);
 await page.getByRole('button',{name:/^Reset Account/}).click();await expect(page.getByRole('dialog',{name:'Reset Account',exact:true}).getByRole('button',{name:'Reset Account',exact:true})).toBeDisabled();await expect(page.getByText(/Your sign-in account is kept/)).toBeVisible();await page.getByRole('button',{name:'Close Reset Account',exact:true}).click();
 expect(await page.evaluate(key=>localStorage.getItem(key),DASHBOARD_STORAGE_KEY)).toBe(stored);
 await page.getByRole('button',{name:/^Refer friends/}).click();await expect(page.getByRole('button',{name:'Share DebtFree',exact:true})).toBeVisible();await page.getByRole('button',{name:'Close Refer friends',exact:true}).click();
 await page.getByRole('button',{name:/^Give feedback/}).click();await expect(page.getByRole('button',{name:'Send feedback',exact:true})).toBeDisabled();await page.getByRole('button',{name:'Close Give feedback',exact:true}).click();
 for(const width of [390,320]){await page.setViewportSize({width,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
 await page.screenshot({path:`.wrangler/settings-review/${theme}-hub.png`,animations:'disabled'});
 await page.getByRole('button',{name:'Close Settings',exact:true}).click();await page.getByRole('navigation',{name:'Primary navigation'}).getByRole('button',{name:'Debt',exact:true}).click();await page.getByRole('button',{name:'Open Settings',exact:true}).click();await expect(page.locator('.shared-dashboard-title')).toHaveText('Settings');
});

test('signed-in Settings saves notification toggles, feedback and keeps Sign out last',async({page,context},info)=>{
 expect(new URL(String(info.project.use.baseURL)).hostname).toBe('localhost');
 await context.addCookies([{name:'debtfree-local-user',value:'owner@example.test',url:'http://localhost:8787'}]);
 let preferences={enabled:false,nextDue:false,nextBudget:false,transactions:false};let feedback='';
 await page.addInitScript(()=>{
  const subscription={toJSON:()=>({endpoint:'https://fcm.googleapis.com/fcm/send/test',keys:{p256dh:'B'+'A'.repeat(86),auth:'A'.repeat(22)}}),unsubscribe:async()=>true};
  const registration={pushManager:{getSubscription:async()=>null,subscribe:async()=>subscription}};
  Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:{register:async()=>registration,ready:Promise.resolve(registration)}});
  Object.defineProperty(window,'PushManager',{configurable:true,value:class{}});
  Object.defineProperty(window,'Notification',{configurable:true,value:{permission:'granted',requestPermission:async()=>'granted'}});
 });
 await page.route('**/api/notifications*',async route=>{
  if(route.request().method()==='PUT'){expect(route.request().headers()['x-debtfree-identity']).toBe('owner@example.test');preferences=route.request().postDataJSON().preferences;}
  await route.fulfill({json:{preferences,publicKey:'B'+'A'.repeat(86),deviceKnown:true,id:'00000000-0000-4000-8000-000000000002'}});
 });
 await page.route('**/api/feedback',async route=>{feedback=route.request().postDataJSON().message;await route.fulfill({json:{ok:true}});});
 await page.goto('/');await page.getByRole('button',{name:'Open Settings',exact:true}).click();
 const hub=page.locator('.settings-hub');await expect(hub.getByRole('button',{name:'Sign out',exact:true})).toBeVisible();expect(await hub.evaluate(el=>el.lastElementChild?.textContent)).toBe('Sign out');
 await page.getByRole('button',{name:/^Notifications/}).click();const master=page.getByRole('switch',{name:'Notifications',exact:true}),due=page.getByRole('switch',{name:'Next Due Reminder',exact:true});
 await expect(master).toBeEnabled();await expect(due).toBeDisabled();await master.click();await expect(master).toHaveAttribute('aria-checked','true');await expect(due).toBeEnabled();await due.click();await expect(due).toHaveAttribute('aria-checked','true');await master.click();await expect(due).toBeDisabled();expect(preferences.enabled).toBe(false);expect(preferences.nextDue).toBe(true);
 await page.getByRole('button',{name:'Close Notifications',exact:true}).click();await page.getByRole('button',{name:/^Security/}).click();await expect(page.getByRole('link',{name:'Manage Google security ↗'})).toHaveAttribute('href','https://myaccount.google.com/security');await expect(page.getByRole('button',{name:'Sign out of all devices',exact:true})).toBeVisible();await page.getByRole('button',{name:'Close Security settings',exact:true}).click();
 await page.getByRole('button',{name:/^Give feedback/}).click();await page.getByRole('textbox',{name:'Your feedback'}).fill('Please make bill reminders more customizable.');await page.getByRole('button',{name:'Send feedback',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Your feedback has been saved'})).toBeVisible();expect(feedback).toBe('Please make bill reminders more customizable.');await page.getByRole('button',{name:'Close Give feedback',exact:true}).click();
 await page.getByRole('button',{name:/^Reset Account/}).click();await expect(page.getByText('This resets the shared financial data for every household member.')).toBeVisible();await expect(page.getByRole('dialog',{name:'Reset Account',exact:true}).getByRole('button',{name:'Reset Account',exact:true})).toBeDisabled();await page.getByRole('textbox',{name:'Type RESET to confirm'}).fill('RESET');await expect(page.getByRole('dialog',{name:'Reset Account',exact:true}).getByRole('button',{name:'Reset Account',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Close Reset Account',exact:true}).click();
 await page.screenshot({path:'.wrangler/settings-review/owner-settings.png',animations:'disabled'});
});
