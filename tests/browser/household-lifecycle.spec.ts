import { test, expect, type Page } from '@playwright/test';
import { build } from 'esbuild';
import { resolve } from 'node:path';

// Mount the real client component with synthetic API responses. No runtime auth
// bypass, fixture route, credentials, production session or financial records.
let script: string;
test.beforeAll(async () => {
  const result = await build({ stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import Panel from './app/household-lifecycle-panel'; createRoot(document.getElementById('lifecycle-test')).render(React.createElement(Panel, window.__lifecycleProps));`, resolveDir: resolve('.') }, bundle: true, write: false, jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' }, plugins: [{name:'test-link', setup(builder) { builder.onResolve({filter:/^next\/link$/}, () => ({path:'link',namespace:'test-link'})); builder.onLoad({filter:/.*/,namespace:'test-link'}, () => ({contents:`import React from 'react'; export default function Link(p) {return React.createElement('a',p);}`,loader:'js',resolveDir:resolve('.')})); }}] });
  script=result.outputFiles[0].text;
});
const owner = { identity:'owner@example.test', householdId:'synthetic-a', role:'owner', members:[{email:'owner@example.test',display_name:'Owner',role:'owner',status:'active'},{email:'partner@example.test',display_name:'Partner',role:'admin',status:'active'}] };
const base = { inbox:[], invitations:[], requests:[], canCreate:false, legacyInvitation:false, member:{household_id:'synthetic-a'} };

async function mount(page: Page, props: unknown) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const css = await page.evaluate(() => Array.from(document.styleSheets).map(sheet => { try { return Array.from(sheet.cssRules).map(rule => rule.cssText).join('\n'); } catch { return ''; } }).join('\n'));
  // Navigate to an intercepted standalone document. Replacing the app's body
  // allowed its original hydration root to remove our component mid-test.
  await page.route('**/__lifecycle-fixture', route => route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>' + css + '</style></head><body><main class="screen profile-screen"><div id="lifecycle-test"></div></main></body></html>'}));
  await page.goto('/__lifecycle-fixture');
  await page.evaluate(value => Object.assign(window,{__lifecycleProps:value}), props);
  await page.addScriptTag({content:script});
}

test('owner can create and revoke an invitation with accessible mobile controls', async ({page}) => {
  let data={...base}; const writes: Record<string,string>[]=[];
  await page.route('**/api/household/lifecycle', async route => {
    if(route.request().method()==='POST') { const body=route.request().postDataJSON(); writes.push(body); data={...data,invitations:body.action==='invite' ? [{id:'synthetic-invite',email:body.email,role:body.role,expires_at:Date.now()+86400000}] : []} as typeof data; await route.fulfill({json:{ok:true}}); }
    else await route.fulfill({json:data});
  });
  await mount(page,owner);
  await expect(page.getByRole('button',{name:'Create invitation'})).toBeVisible();
  await page.getByLabel('Partner email').fill('new@example.test'); await page.getByLabel('Invitation access',{exact:true}).selectOption('viewer'); await page.getByRole('button',{name:'Create invitation'}).click();
  await expect(page.getByRole('button',{name:'Revoke'})).toBeVisible(); expect(writes[0]).toEqual({action:'invite',email:'new@example.test',role:'viewer'});
  await page.getByRole('button',{name:'Revoke'}).click(); await expect(page.getByRole('button',{name:'Revoke'})).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('viewer can request and cancel deletion without owner controls', async ({page}) => {
  let data={...base}; const writes: Record<string,string>[]=[];
  await page.route('**/api/household/lifecycle',async route=>{ if(route.request().method()==='POST') { const body=route.request().postDataJSON(); writes.push(body); data={...data,requests:body.action==='request_deletion' ? [{id:'synthetic-request',kind:'delete_account'}] : []} as typeof data; await route.fulfill({json:{ok:true}}); } else await route.fulfill({json:data}); });
  await mount(page,{...owner,role:'viewer'});
  await expect(page.getByRole('button',{name:'Create invitation'})).toHaveCount(0); await expect(page.getByRole('button',{name:'Leave household'})).toBeEnabled();
  await page.getByText('Account deletion',{exact:true}).click(); page.once('dialog',dialog=>dialog.accept('DELETE')); await page.getByRole('button',{name:'Request deletion',exact:true}).click(); await expect(page.getByText('Request reference: synthetic-request')).toBeVisible(); await page.getByRole('button',{name:'Cancel deletion request'}).click(); await expect(page.getByRole('button',{name:'Request deletion',exact:true})).toBeVisible();
  expect(writes[1]).toEqual({action:'cancel_deletion',id:'synthetic-request'});
  await expect(page.getByRole('status')).toHaveText('Deletion request cancelled. Nothing has been deleted.');
});

test('setup displays only intended invitations and closed-registration state',async ({page})=>{
  await page.route('**/api/household/lifecycle',route=>route.fulfill({json:{...base,member:null}})); await mount(page,{identity:'new@example.test',setup:true});
  await expect(page.getByText('No pending invitations. New household registration is closed.')).toBeVisible(); await expect(page.getByRole('button',{name:'Create household'})).toHaveCount(0);
});


test('setup exposes every pending reference and cancels only the selected request', async ({page}) => {
  let requests = [{id:'case-a',kind:'delete_account'},{id:'case-b',kind:'delete_household'}];
  const writes: Record<string,string>[]=[];
  await page.route('**/api/household/lifecycle',async route=>{
    if (route.request().method()==='POST') {
      const body=route.request().postDataJSON(); writes.push(body);
      requests=requests.filter(request=>request.id!==body.id);
      await route.fulfill({json:{ok:true}});
    } else await route.fulfill({json:{...base,member:null,requests}});
  });
  await mount(page,{identity:'former@example.test',setup:true});
  await expect(page.getByText('Request reference: case-a')).toBeVisible();
  await expect(page.getByText('Request reference: case-b')).toBeVisible();
  await page.getByRole('button',{name:'Cancel deletion request'}).first().click();
  expect(writes).toEqual([{action:'cancel_deletion',id:'case-a'}]);
  await expect(page.getByText('Request reference: case-a')).toHaveCount(0);
  await expect(page.getByText('Request reference: case-b')).toBeVisible();
});
