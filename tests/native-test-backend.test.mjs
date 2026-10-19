import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { generateKeyPair, SignJWT } from 'jose';
import { createNativeAuthenticator } from '../app/native-auth.ts';
import mobileWorker, { createMobileTestWorker } from '../worker/mobile-test.ts';
import { HouseholdNotificationHub } from '../worker/household-notifications.ts';
import { createDemoFixture } from '../mobile/demo-fixture.ts';
const issuer='https://synthetic-test.supabase.co/auth/v1', production='https://synthetic-prod.supabase.co/auth/v1';
const sid='12345678-1234-1234-1234-123456789abc';
const config={environment:'test',issuer,productionIssuer:production,audience:'authenticated',algorithms:['ES256']};
test('signed JWT and authoritative liveness both required, including logout confirmation',async()=>{
  const keys=await generateKeyPair('ES256'), other=await generateKeyPair('ES256'); let active=true, enabled=true, stale=false, expiry=Date.now()+60_000;
  const now=Date.now();
  const live={check:async()=>({active,subject:'a',sessionId:sid,confirmedEmail:'a@example.test',googleIdentity:true,userEnabled:enabled,policyVersion:'native-test-v1',checkedAt:stale?now-10_000:now,inactiveAt:expiry,absoluteExpiresAt:expiry}),revoke:async()=>{active=false;}};
  const auth=createNativeAuthenticator(config,live,async()=>keys.publicKey,()=>now);
  const token=(patch={},key=keys.privateKey)=>new SignJWT({session_id:sid,...patch}).setSubject('a').setIssuer(patch.iss??issuer).setAudience(patch.aud??'authenticated').setIssuedAt().setExpirationTime(patch.exp??Math.floor(now/1000)+60).setProtectedHeader({alg:'ES256'}).sign(key);
  const request=jwt=>new Request('https://test.invalid',{headers:{authorization:'Bearer '+jwt}});
  const jwt=await token(); assert.equal((await auth.authenticate(request(jwt))).email,'a@example.test');
  for(const patch of [{iss:production},{aud:'wrong'},{exp:1},{session_id:'bad'}]) await assert.rejects(auth.authenticate(request(await token(patch))));
  await assert.rejects(auth.authenticate(request(await token({},other.privateKey))));
  await assert.rejects(auth.authenticate(new Request('https://test.invalid',{headers:{authorization:'Bearer '+jwt,cookie:'fake'}})));
  await assert.rejects(createNativeAuthenticator(config,undefined,async()=>keys.publicKey).authenticate(request(jwt)),e=>e.status===503);
  enabled=false;await assert.rejects(auth.authenticate(request(jwt)));enabled=true;stale=true;await assert.rejects(auth.authenticate(request(jwt)),e=>e.status===503);stale=false;
  expiry=now;await assert.rejects(auth.authenticate(request(jwt)));expiry=now+60_000;
  const identity=await auth.authenticate(request(jwt));assert.deepEqual(await auth.logout(identity),{serverRevoked:true});await assert.rejects(auth.authenticate(request(jwt)));
});
function database(){
  const sqlite=new DatabaseSync(':memory:');sqlite.exec("CREATE TABLE households(id TEXT PRIMARY KEY,name TEXT,updated_at INTEGER); CREATE TABLE household_state(household_id TEXT PRIMARY KEY,payload TEXT,revision INTEGER,updated_by TEXT,updated_at INTEGER); CREATE TABLE household_members(email TEXT PRIMARY KEY,household_id TEXT,role TEXT,status TEXT,display_name TEXT); INSERT INTO households VALUES('a','Synthetic A',0),('b','Synthetic B',0); INSERT INTO household_state VALUES('a',NULL,0,NULL,0),('b',NULL,0,NULL,0); INSERT INTO household_members VALUES('a@example.test','a','owner','active',NULL),('b@example.test','b','viewer','active',NULL);");
  const db = { prepare(sql) { return { bind(...args) {
    const stmt = sqlite.prepare(sql);
    return { first: async () => stmt.get(...args) ?? null,
      all: async () => ({ results: stmt.all(...args) }),
      run: async () => ({ meta: { changes: Number(stmt.run(...args).changes) } }) };
  } }; } };
  return { sqlite, db };
}
test('native wrappers reuse real SQL revision/role checks and publish only accepted revisions',async()=>{
  const {sqlite,db}=database();let user='a', revoked=false, publications=[];
  const worker=createMobileTestWorker(()=>({authenticate:async()=>{if(revoked)throw Error('synthetic revocation');return{subject:user,sessionId:sid,email:user+'@example.test',displayName:user,token:'synthetic-only'};},logout:async()=>({serverRevoked:true})}));
  const env={TEST_ENVIRONMENT:'debtfree-mobile-test',TEST_API_ORIGIN:'https://debtfree-mobile-test.example.test',TEST_ISSUER:issuer,PRODUCTION_ISSUER:production,DB:db,NOTIFICATION_INTERNAL_KEY:'synthetic-internal-key',HOUSEHOLD_REVISIONS_TEST:{getByName:id=>({fetch:async request=>{publications.push({id,body:await request.json()});return Response.json({ok:true});}})}};
  const request=(path,method='GET',body,scope=user)=>new Request(env.TEST_API_ORIGIN+'/api/native/v1/'+path,{method,headers:{'content-type':'application/json','x-debtfree-identity':user+'@example.test','x-debtfree-household':scope},body:body?JSON.stringify(body):undefined});
  const fetch=(...args)=>worker.fetch(request(...args),env);
  assert.equal((await (await fetch('session')).json()).householdId,'a');
  assert.equal((await fetch('household','GET',undefined,'b')).status,403);
  assert.equal((await fetch('notifications/ticket','POST',undefined,'b')).status,403);
  assert.equal(publications.length,0); // Scope denial happens before channel access.
  const original=createDemoFixture(), changed=createDemoFixture();changed.payload.extra=42;
  assert.equal((await fetch('household','PUT',{revision:0,payload:original})).status,200);
  assert.equal((await fetch('household','PUT',{revision:0,payload:original})).status,200); // identical ack-loss retry
  const oldError=console.error;console.error=()=>{};try{assert.equal((await fetch('household','PUT',{revision:0,payload:changed})).status,409);}finally{console.error=oldError;}
  assert.equal(publications.length,2);assert.deepEqual(publications[0],{id:'a',body:{householdId:'a',revision:1}});
  user='b';assert.equal((await fetch('household','PUT',{revision:0,payload:original})).status,403);assert.equal((await (await fetch('household')).json()).revision,0);
  sqlite.prepare("UPDATE household_members SET status='removed' WHERE email=?").run('b@example.test');assert.equal((await fetch('household')).status,403);
  user='a';revoked=true;assert.equal((await fetch('household')).status,503);
  assert.equal((await worker.fetch(request('session'),{...env,TEST_ENVIRONMENT:'production'})).status,503);sqlite.close();
});
test('notification subscriptions reauthorize for each revision and heartbeat, never cross households or carry payloads',async()=>{
  const allowed=new Map([['A','a'],['B','b']]);const hub=new HouseholdNotificationHub(async(token,id)=>allowed.get(token)===id);
  const socket=()=>({messages:[],closed:[],send(data){this.messages.push(JSON.parse(data));},close(code){this.closed.push(code);}});
  const a=socket(),b=socket(),forged=socket();assert.equal(await hub.subscribe('A','a',a),true);assert.equal(await hub.subscribe('B','b',b),true);assert.equal(await hub.subscribe('A','b',forged),false);
  await hub.publish('a',2);assert.deepEqual(a.messages,[{type:'revision-changed',revision:2}]);assert.equal(b.messages.length,0);
  allowed.delete('A');await hub.publish('a',3);assert.deepEqual(a.closed,[1008]);assert.equal(a.messages.length,1);assert.equal(await hub.subscribe('A','a',socket()),false);
  allowed.delete('B');await hub.recheck();assert.deepEqual(b.closed,[1008]);assert.equal(hub.size,0);
  const outage=new HouseholdNotificationHub(async()=>{throw Error('authority down');});assert.equal(await outage.subscribe('A','a',socket()),false);
});
test('notification tickets are scope-bound, one-use, short-lived and recheck revocation before opening',async()=>{
  let allowed=true;const hub=new HouseholdNotificationHub(async(_token,id)=>allowed&&id==='a');
  const socket=()=>({send(){},close(){}});
  const first=await hub.ticket('synthetic-token','a',100);assert.equal(await hub.subscribeTicket(first,'b',socket(),101),false);assert.equal(await hub.subscribeTicket(first,'a',socket(),101),false);
  const second=await hub.ticket('synthetic-token','a',100);assert.equal(await hub.subscribeTicket(second,'a',socket(),30_101),false);
  const third=await hub.ticket('synthetic-token','a',100);allowed=false;assert.equal(await hub.subscribeTicket(third,'a',socket(),101),false);
  allowed=true;const fourth=await hub.ticket('synthetic-token','a',100);assert.equal(await hub.subscribeTicket(fourth,'a',socket(),101),true);assert.equal(await hub.subscribeTicket(fourth,'a',socket(),101),false);
});
test('deployment entry denies missing liveness binding before reading D1',async()=>{
  const env={TEST_ENVIRONMENT:'debtfree-mobile-test',TEST_API_ORIGIN:'https://debtfree-mobile-test.example.test',TEST_ISSUER:issuer,PRODUCTION_ISSUER:production,DB:{prepare(){assert.fail('No DB read before authority');}}};
  const response=await mobileWorker.fetch(new Request(env.TEST_API_ORIGIN+'/api/native/v1/session',{headers:{authorization:'Bearer synthetic-only'}}),env);
  assert.equal(response.status,503);assert.equal(response.headers.get('cache-control'),'private, no-store');
});
