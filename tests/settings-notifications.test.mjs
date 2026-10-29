import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {generateKeyPair,exportJWK,jwtVerify,importJWK} from 'jose';
import {createDemoFixture} from '../mobile/demo-fixture.ts';
import {scheduledReminders,dispatchNotifications} from '../app/notification-dispatch.ts';
import {createNotificationApi,createFeedbackApi} from '../app/notification-api.ts';
import {EMPTY_NOTIFICATIONS,pushEndpoint,webSubscription} from '../app/notification-preferences.ts';
import {encryptPush,sendWebPush} from '../app/web-push.ts';
const active={enabled:true,nextDue:true,nextBudget:true,transactions:true};
const origin='http://localhost:8787';
function database(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON');
 for(const name of ['0000_third_baron_zemo.sql','0001_household_lifecycle.sql','0002_settings_notifications.sql'])sqlite.exec(readFileSync(new URL('../drizzle/'+name,import.meta.url),'utf8'));
 sqlite.prepare('INSERT INTO households VALUES (?,?,?,?,?)').run('h','Demo','owner@example.test',0,0);
 sqlite.prepare('INSERT INTO household_members VALUES (?,?,?,?,?,?,?,?)').run('owner@example.test','h','Owner','owner','active',null,0,0);
 sqlite.prepare('INSERT INTO household_state VALUES (?,?,?,?,?)').run('h',JSON.stringify(createDemoFixture()),0,'owner@example.test',0);
 const prepare=sql=>{const wrap=(params=[])=>({bind:(...p)=>wrap(p),run:async()=>{const r=sqlite.prepare(sql).run(...params);return {meta:{changes:Number(r.changes)}};},first:async()=>sqlite.prepare(sql).get(...params)??null,all:async()=>({results:sqlite.prepare(sql).all(...params)})});return wrap();};
 return {sqlite,db:{prepare}};
}
async function subscription(){const pair=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);const key=await crypto.subtle.exportKey('raw',pair.publicKey);return {pair,subscription:{endpoint:'https://fcm.googleapis.com/fcm/send/test',keys:{p256dh:Buffer.from(key).toString('base64url'),auth:Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('base64url')}}};}
const request=(method,body,device='',headers={})=>new Request(origin+'/api/notifications?device='+device,{method,headers:{origin,'content-type':'application/json','x-debtfree-identity':'owner@example.test','x-debtfree-household':'h',...headers},...(body?{body:JSON.stringify(body)}:{})});

test('notification and feedback routes enforce sign-in, CSRF and identity/household scope',async()=>{
 const {sqlite,db}=database();let user={email:'owner@example.test'};
 const context=async()=>user?{db,user,member:{household_id:'h'}}:null;
 const api=createNotificationApi(context,()=>({origin,publicKey:'test'}));
 const feedback=createFeedbackApi(context,()=>origin);
 user=null;assert.equal((await api.GET(request('GET'))).status,401);assert.equal((await feedback(request('POST',{kind:'idea',message:'A useful suggestion.'}))).status,401);
 user={email:'owner@example.test'};
 assert.equal((await api.PUT(request('PUT',{},'',{origin:'https://evil.test'}))).status,403);
 assert.equal((await api.PUT(request('PUT',{},'',{'x-debtfree-identity':'other@example.test'}))).status,403);
 assert.equal((await feedback(request('POST',{kind:'idea',message:'A useful suggestion.'},'',{'x-debtfree-household':'other'}))).status,403);
 assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM app_feedback').get().n,0);sqlite.close();
});
test('device preferences save, survive reload, disable and cannot be transferred or read by another user',async()=>{
 const {sqlite,db}=database();let user={email:'owner@example.test'};const api=createNotificationApi(async()=>({db,user,member:{household_id:'h'}}),()=>({origin,publicKey:'test'}));
 const sub=(await subscription()).subscription;
 const saved=await (await api.PUT(request('PUT',{preferences:active,subscription:sub}))).json();assert.ok(saved.id);
 assert.deepEqual((await (await api.GET(request('GET',null,saved.id))).json()).preferences,active);
 await api.PUT(request('PUT',{preferences:{...active,enabled:false}},saved.id));assert.equal((await (await api.GET(request('GET',null,saved.id))).json()).preferences.enabled,false);
 user={email:'another@example.test'};const headers={'x-debtfree-identity':user.email};
 assert.deepEqual((await (await api.GET(request('GET',null,saved.id,headers))).json()).preferences,EMPTY_NOTIFICATIONS);
 assert.equal((await api.PUT(request('PUT',{preferences:active,subscription:sub},'',headers))).status,409);
 await api.DELETE(request('DELETE',null,saved.id,headers));assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM notification_subscriptions').get().n,1);
 sqlite.close();
});
test('push endpoints reject SSRF, redirects credentials and non-provider hosts',()=>{
 for(const endpoint of ['http://fcm.googleapis.com/x','https://127.0.0.1/x','https://fcm.googleapis.com.evil.test/x','https://evil.test/x','https://user@fcm.googleapis.com/x','https://fcm.googleapis.com:444/x'])assert.throws(()=>pushEndpoint(endpoint));
 assert.equal(pushEndpoint('https://web.push.apple.com/x'),'https://web.push.apple.com/x');assert.throws(()=>webSubscription({endpoint:'https://fcm.googleapis.com/x',keys:{p256dh:'x',auth:'x'}}));
});
test('feedback validates length, persists submissions and applies a per-user daily limit',async()=>{
 const {sqlite,db}=database();const api=createFeedbackApi(async()=>({db,user:{email:'owner@example.test'},member:{household_id:'h'}}),()=>origin);
 assert.equal((await api(request('POST',{kind:'idea',message:'small'}))).status,400);
 for(let i=0;i<10;i++)assert.equal((await api(request('POST',{kind:'idea',message:'Please add this useful feature.'}))).status,200);
 assert.equal((await api(request('POST',{kind:'idea',message:'Another useful feature.'}))).status,429);assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM app_feedback').get().n,10);sqlite.close();
});
test('reminders use unpaid due dates for cards, loans and recurring bills, never paid cycles',()=>{
 const p=createDemoFixture().payload;p.transactions=[];p.accounts=p.accounts.map(a=>({...a,dueDate:'2026-10-28'}));
 const before=JSON.stringify(p),now=new Date('2026-10-28T16:00:00Z');
 assert.equal(scheduledReminders(p,active,now)[0].key,'due:2026-10-28');assert.equal(JSON.stringify(p),before);
 assert.equal(scheduledReminders(p,{...active,nextDue:false},now).length,0);
 assert.equal(scheduledReminders(p,active,new Date('2026-10-28T15:00:00Z')).length,0);
 const bill=createDemoFixture().payload;bill.accounts=[];bill.transactions=[];bill.monthlyBudgets['2026-10']=[{id:'bill',name:'Internet',kind:'expense',category:'Utilities',amount:50,paymentMethod:'debit',creditAccountId:'',recurring:true,dueDay:28,createdAt:'2026-10-01T12:00:00Z'}];
 assert.equal(scheduledReminders(bill,active,now)[0].key,'due:2026-10-28');
 bill.monthlyPlan.loanTrackers=[{id:'loan',name:'Car',kind:'car',originalAmount:10000,remainingAmount:5000,apr:5,monthlyPayment:200,balanceKind:'principal',asOf:'2026-10-01',dueDate:'2026-10-28',budgetItemId:'',budgetItemName:'',history:[]}];bill.monthlyBudgets={};
 assert.equal(scheduledReminders(bill,active,now)[0].key,'due:2026-10-28');
 const paid=createDemoFixture().payload;paid.accounts=[{...paid.accounts[0],dueDate:'2026-10-28',minimum:25}];paid.transactions=[{...paid.transactions[0],date:'2026-10-28',amount:25}];
 paid.monthlyPlan.duePaymentAssociations=[{reminderId:'account:'+paid.accounts[0].id,dueDate:'2026-10-28',source:{type:'transaction',id:paid.transactions[0].id}}];
 assert.equal(scheduledReminders(paid,active,now).length,0);
});
test('budget month-end, Tuesday reminder and Pacific DST schedules are distinct and opt-in',()=>{
 const p=createDemoFixture().payload;p.accounts=[];p.transactions=[];
 assert.equal(scheduledReminders(p,active,new Date('2026-10-31T16:00:00Z'))[0].key,'budget:2026-10');
 assert.equal(scheduledReminders(p,active,new Date('2026-11-03T17:00:00Z'))[0].key,'transactions:2026-11-03');
 assert.equal(scheduledReminders(p,active,new Date('2026-11-03T16:00:00Z')).length,0);
 assert.equal(scheduledReminders(p,{...active,enabled:false},new Date('2026-11-03T17:00:00Z')).length,0);
});
test('encrypted Web Push decrypts with recipient HKDF and VAPID validates the push-service audience',async()=>{
 const {pair,subscription:sub}=await subscription(),message='A private reminder';
 const encrypted=await encryptPush(sub,message),salt=encrypted.slice(0,16),rs=new DataView(encrypted.buffer,encrypted.byteOffset+16,4).getUint32(0);assert.equal(rs,4096);assert.equal(encrypted[20],65);
 const server=encrypted.slice(21,86),peer=await crypto.subtle.importKey('raw',server,{name:'ECDH',namedCurve:'P-256'},false,[]);
 const shared=await crypto.subtle.deriveBits({name:'ECDH',public:peer},pair.privateKey,256);
 const hkdf=async(key,salt,info,length)=>{const k=await crypto.subtle.importKey('raw',key,'HKDF',false,['deriveBits']);return crypto.subtle.deriveBits({name:'HKDF',hash:'SHA-256',salt,info},k,length);};
 const rawClient=new Uint8Array(await crypto.subtle.exportKey('raw',pair.publicKey));
 const info=Buffer.concat([Buffer.from('WebPush: info\0'),rawClient,server]);
 const ikm=await hkdf(shared,Buffer.from(sub.keys.auth,'base64url'),info,256);
 const cek=await hkdf(ikm,salt,Buffer.from('Content-Encoding: aes128gcm\0'),128),nonce=await hkdf(ikm,salt,Buffer.from('Content-Encoding: nonce\0'),96);
 const aes=await crypto.subtle.importKey('raw',cek,'AES-GCM',false,['decrypt']);
 const plain=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:nonce},aes,encrypted.slice(86)));
 assert.equal(plain.at(-1),2);assert.equal(new TextDecoder().decode(plain.slice(0,-1)),message);
 const vapid=await generateKeyPair('ES256',{extractable:true}),pub=await exportJWK(vapid.publicKey);const keys={publicKey:Buffer.concat([Buffer.from([4]),Buffer.from(pub.x,'base64url'),Buffer.from(pub.y,'base64url')]).toString('base64url'),privateKey:await exportJWK(vapid.privateKey)};
 await sendWebPush(sub,keys,{title:'DebtFree',body:'Reminder',tag:'test',url:'/'},async(url,options)=>{assert.equal(options.redirect,'error');assert.equal(options.headers['content-encoding'],'aes128gcm');const token=options.headers.authorization.match(/t=([^,]+)/)[1];await jwtVerify(token,await importJWK(pub,'ES256'),{audience:'https://fcm.googleapis.com'});return new Response(null,{status:201});});
});
test('dispatcher deduplicates repeated cron events and excludes removed members and disabled devices',async()=>{
 const {sqlite,db}=database(),sub=(await subscription()).subscription;const p=createDemoFixture();p.payload.accounts=p.payload.accounts.map(a=>({...a,dueDate:'2026-10-28'}));p.payload.transactions=[];
 sqlite.prepare('UPDATE household_state SET payload=?').run(JSON.stringify(p));sqlite.prepare('INSERT INTO notification_subscriptions VALUES(?,?,?,?,?,?,?)').run('device','owner@example.test','h',sub.endpoint,JSON.stringify(sub),JSON.stringify(active),0);
 let sent=0;const sender=async()=>{sent++;return new Response(null,{status:201});};const env={DB:db,WEB_PUSH_KEYS:JSON.stringify({publicKey:'test',privateKey:{d:'test'}})};
 await dispatchNotifications(env,new Date('2026-10-28T16:00:00Z'),sender);await dispatchNotifications(env,new Date('2026-10-28T16:00:00Z'),sender);assert.equal(sent,1);
 sqlite.prepare('DELETE FROM notification_deliveries').run();sqlite.prepare("UPDATE household_members SET status='invited'").run();await dispatchNotifications(env,new Date('2026-10-28T16:00:00Z'),sender);assert.equal(sent,1);
 sqlite.prepare("UPDATE household_members SET status='active'").run();sqlite.prepare('UPDATE notification_subscriptions SET preferences=?').run(JSON.stringify({...active,enabled:false}));await dispatchNotifications(env,new Date('2026-10-28T16:00:00Z'),sender);assert.equal(sent,1);sqlite.close();
});
