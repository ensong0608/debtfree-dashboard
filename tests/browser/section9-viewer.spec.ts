import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
import { createDemoFixture } from '../../mobile/demo-fixture';
import { DASHBOARD_STORAGE_KEY } from '../../app/data-repository';
import { APPEARANCE_KEY, APPEARANCE_EVENT, THEMES } from '../../app/appearance';
let script=''; let css='';
test.beforeAll(async()=>{
  const result=await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import Dashboard from './app/dashboard-client';import AppearanceProvider from './app/appearance-provider';import './app/globals.css';import './app/design-system.css';import './app/reference-layout.css';import './app/theme.css';createRoot(document.getElementById('viewer')).render(<><AppearanceProvider/><Dashboard user={{displayName:'Viewer',email:'viewer@example.test',fullName:null}} managedHousehold={{name:'Synthetic',role:'viewer',readOnly:true}}/></>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,jsx:'automatic',outfile:'.wrangler/viewer.js',define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'plain-global-css',setup(builder){builder.onLoad({filter:/[\\/]app[\\/]globals\.css$/},async args=>({contents:(await readFile(args.path,'utf8')).replace('@import "tailwindcss";',''),loader:'css'}));}}]});
  script=result.outputFiles.find(f=>f.path.endsWith('.js'))!.text;css=result.outputFiles.find(f=>f.path.endsWith('.css'))!.text;
});
test('viewer navigates themed screens and portals while mutation controls and writes remain blocked',async({page})=>{
  const fixture=createDemoFixture();let writes=0;
  await page.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin!=='http://section9-viewer.test'){writes++;return route.abort();}return route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style></head><body><div id="viewer"></div></body></html>'});});
  await page.addInitScript(({key,fixture})=>localStorage.setItem(key,JSON.stringify(fixture)),{key:DASHBOARD_STORAGE_KEY,fixture});
  await page.goto('http://section9-viewer.test/');await page.addScriptTag({content:script});
  await expect(page.getByRole('heading',{name:/Welcome,/})).toBeVisible();
  const nav=page.getByRole('navigation',{name:'Primary navigation'});
  for(const value of Object.values(THEMES)){
    await page.evaluate(({key,event,value})=>{localStorage.setItem(key,JSON.stringify(value));window.dispatchEvent(new CustomEvent(event,{detail:value}));},{key:APPEARANCE_KEY,event:APPEARANCE_EVENT,value});
    await nav.getByRole('button',{name:'Debt',exact:true}).click();await expect(page.getByRole('button',{name:'Debt +',exact:true})).toBeDisabled();
    await page.getByRole('button',{name:'Open Sample card',exact:true}).click();const debt=page.getByRole('dialog',{name:'Sample card',exact:true});
    await debt.getByRole('tab',{name:'Info'}).click();await expect(debt.getByLabel('Account name',{exact:true})).toBeDisabled();await expect(debt.getByLabel('Institution (optional)')).toBeDisabled();
    await debt.getByRole('button',{name:'Back from Sample card'}).click();
    await nav.getByRole('button',{name:'Progress',exact:true}).click();await expect(page.getByRole('button',{name:'Save snapshot',exact:true})).toBeDisabled();
    await nav.getByRole('button',{name:'Budget',exact:true}).click();for(const name of ['Income +','Spending +','One-off +']) await expect(page.getByRole('button',{name,exact:true})).toBeDisabled();
    await page.getByRole('navigation',{name:'Budget sections'}).getByRole('button',{name:'Schedule',exact:true}).click();await page.getByRole('button',{name:'View full Payoff Schedule'}).click();const schedule=page.getByRole('dialog',{name:'Payoff Schedule',exact:true});
    await expect(schedule.getByLabel('Extra payment',{exact:true})).toBeDisabled();await expect(schedule.getByLabel('Payoff method')).toBeDisabled();await schedule.getByRole('button',{name:'Close payoff schedule and go back'}).click();
  }
  expect(writes).toBe(0);expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).payload,DASHBOARD_STORAGE_KEY)).toEqual(fixture.payload);
});
