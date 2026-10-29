import {test,expect,type Page,type Locator,type ElementHandle} from '@playwright/test';
import {createDemoFixture} from '../../mobile/demo-fixture';
import {DASHBOARD_STORAGE_KEY} from '../../app/data-repository';
import {APPEARANCE_KEY,THEMES} from '../../app/appearance';

async function scrollBothWays(page:Page,dialog:Locator,touch:boolean) {
 await dialog.evaluate(async el=>{await Promise.all(el.getAnimations().map(a=>a.finished));});
 const header=dialog.locator(':scope > header');
 const before=(await header.boundingBox())!;
 const owner=await dialog.evaluateHandle(el=>[el,...el.querySelectorAll<HTMLElement>('*')].filter(node=>
  node instanceof HTMLElement && node.getClientRects().length>0 && node.closest('[role=dialog]')===el &&
  /auto|scroll/.test(getComputedStyle(node).overflowY) && node.scrollHeight>node.clientHeight+2
 ).sort((a,b)=>b.clientWidth*b.clientHeight-a.clientWidth*a.clientHeight)[0]??null);
 const scroll=owner.asElement() as ElementHandle<HTMLElement>|null;
 expect(scroll,'Long panel must have a usable scrolling region').not.toBeNull();
 if(!scroll) return;
 const box=(await scroll.boundingBox())!;
 await scroll.evaluate(el=>{el.scrollTop=0;});
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
 await page.mouse.wheel(0,1000);
 await expect.poll(()=>scroll.evaluate(el=>el.scrollTop)).toBeGreaterThan(0);
 await page.mouse.wheel(0,-5000);
 await expect.poll(()=>scroll.evaluate(el=>el.scrollTop)).toBe(0);
 if(touch) {
  const session=await page.context().newCDPSession(page);
  const x=box.x+12,from=box.y+box.height-35,to=box.y+35;
  for(const [start,end] of [[from,to],[to,from]]) {
   const previous=await scroll.evaluate(el=>el.scrollTop);
   await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y:start}]});
   for(let step=1;step<=10;step++)await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:start+(end-start)*step/10}]});
   await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   if(end<start)await expect.poll(()=>scroll.evaluate(el=>el.scrollTop)).toBeGreaterThan(previous);
   else await expect.poll(()=>scroll.evaluate(el=>el.scrollTop)).toBeLessThan(previous);
  }
  await session.detach();
 }
 expect(Math.abs((await header.boundingBox())!.y-before.y)).toBeLessThan(1);
 await expect(header.getByRole('button',{name:/^Close /})).toBeInViewport();
 await owner.dispose();
}

test('Advanced and Settings panels scroll in both directions while close controls stay reachable',async({page},info)=>{
 expect(['localhost','127.0.0.1']).toContain(new URL(String(info.project.use.baseURL)).hostname);
 const phone=info.project.name==='phone';
 await page.setViewportSize({width:phone?390:1280,height:phone?568:600});
 await page.clock.setFixedTime(new Date('2026-10-29T20:00:00Z'));
 const fixture=createDemoFixture();
 await page.addInitScript(({key,fixture,lookKey,look})=>{
  if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(fixture));
  localStorage.setItem(lookKey,JSON.stringify(look));
 },{key:DASHBOARD_STORAGE_KEY,fixture,lookKey:APPEARANCE_KEY,look:{...THEMES.light,size:16}});
 await page.goto('/');await expect(page.locator('.home-welcome')).toBeVisible({timeout:30_000});
 const nav=page.getByRole('navigation',{name:'Primary navigation'});
 await nav.getByRole('button',{name:'Debt',exact:true}).click();
 await page.getByRole('button',{name:'Open Sample card',exact:true}).click();
 const account=page.getByRole('dialog',{name:'Sample card',exact:true});
 await account.getByRole('tab',{name:'Detail',exact:true}).click();
 await account.getByRole('button',{name:'Advanced',exact:true}).click();
 const advanced=page.getByRole('dialog',{name:'Advanced',exact:true});
 await scrollBothWays(page,advanced,phone);
 await advanced.getByRole('button',{name:'Close Advanced',exact:true}).click();
 await scrollBothWays(page,account,phone);
 await account.getByRole('button',{name:'Close Sample card',exact:true}).click();
 await nav.getByRole('button',{name:'Home',exact:true}).click();
 await page.getByRole('button',{name:'Open Settings',exact:true}).click();
 for(const [button,title] of [[/^Theme/,'Appearance'],[/^Backup & recovery/,'Backup & recovery'],[/^Notifications/,'Notifications'] ] as const) {
  await page.locator('.settings-hub').getByRole('button',{name:button}).click();
  const panel=page.getByRole('dialog',{name:title,exact:true});
  await scrollBothWays(page,panel,phone);
  await panel.getByRole('button',{name:'Close '+title,exact:true}).click();
 }
 await expect(page.locator('html')).not.toHaveAttribute('data-dialog-open','true');
});
