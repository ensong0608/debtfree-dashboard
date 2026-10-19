import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateKeyPair, SignJWT, jwtVerify } from 'jose';
import { createAuthorityHandler, createJwtVerifier, validateDatabaseUrl, TEST_ISSUER, TEST_REF } from '../supabase/functions/mobile-session-authority/core.ts';
import { createAuthorityProxy } from '../worker/session-authority-proxy.ts';
const secret='synthetic_server_key_'.padEnd(48,'x'), subject='11111111-1111-1111-1111-111111111111',sessionId='22222222-2222-2222-2222-222222222222';
const base='https://'+TEST_REF+'.supabase.co/functions/v1/mobile-session-authority';
async function fixture(){
  const keys=await generateKeyPair('ES256'),now=Date.now();let active=true,calls=0;
  const sign=(patch={},key=keys.privateKey)=>new SignJWT({session_id:sessionId,...patch}).setSubject(patch.sub??subject).setIssuer(patch.iss??TEST_ISSUER).setAudience(patch.aud??'authenticated').setIssuedAt().setExpirationTime(patch.exp??Math.floor(now/1000)+120).setProtectedHeader({alg:'ES256'}).sign(key);
  const deps={now:()=>now,verify:createJwtVerifier((token,options)=>jwtVerify(token,keys.publicKey,options),()=>now),check:async(sub,sid)=>{calls++;assert.equal(sub,subject);assert.equal(sid,sessionId);return{active,subject:sub,sessionId:sid,confirmedEmail:active?'synthetic@example.test':'',googleIdentity:true,userEnabled:true,policyVersion:'native-test-v1',checkedAt:now,inactiveAt:now+30_000,absoluteExpiresAt:now+60_000};},logout:async()=>{active=false;}};
  const handler=createAuthorityHandler(secret,deps),token=await sign();
  const request=(path='/check',extra={})=>new Request(base+path,{method:'POST',headers:{authorization:'Bearer '+token,'x-authority-key':secret,...extra}});
  return{handler,deps,token,sign,keys,request,now,calls:()=>calls};
}
test('signed held access token is denied as inactive after injected official logout and fresh DB check',async()=>{
  const f=await fixture();assert.equal((await (await f.handler(f.request())).json()).active,true);
  assert.equal((await (await f.handler(f.request('/revoke'))).json()).active,false);
  assert.equal((await (await f.handler(f.request())).json()).active,false);assert.equal(f.calls(),3);
});
test('JWT signature, configured issuer/audience/expiry and UUID claims gate all DB calls',async()=>{
  const f=await fixture(),other=await generateKeyPair('ES256');
  for(const token of [await f.sign({iss:'https://acpderotiyoecmwwyfsu.supabase.co/auth/v1'}),await f.sign({aud:'other'}),await f.sign({exp:1}),await f.sign({sub:'caller-identity'}),await f.sign({},other.privateKey)]){
    const response=await f.handler(new Request(base+'/check',{method:'POST',headers:{authorization:'Bearer '+token,'x-authority-key':secret}}));assert.equal(response.status,401);
  }assert.equal(f.calls(),0);
});
test('opaque server key, no browser/cookies/body, route and token bounds protect the private handler',async()=>{
  const f=await fixture();
  for(const req of [f.request('/check',{'x-authority-key':'wrong'}),f.request('/check',{origin:'https://evil.test'}),f.request('/check',{cookie:'synthetic'}),f.request('/check',{authorization:'Bearer '+'x'.repeat(9000)})])assert.equal((await f.handler(req)).status,401);
  assert.equal((await f.handler(new Request(base+'/check',{method:'POST',headers:{authorization:'Bearer '+f.token,'x-authority-key':secret},body:JSON.stringify({subject:'forged'})}))).status,400);
  assert.equal((await f.handler(f.request('/anything'))).status,404);assert.equal(f.calls(),0);
});
test('disabled/missing/not-Google sessions remain inactive; invalid policy/deadline and DB outage fail closed without details',async()=>{
  const f=await fixture(),check=f.deps.check;
  for(const patch of [{active:false,userEnabled:false},{active:false,googleIdentity:false},{active:false,confirmedEmail:''}]){
    f.deps.check=async(...args)=>({...await check(...args),...patch});assert.equal((await (await f.handler(f.request())).json()).active,false);
  }
  for(const patch of [{active:true,userEnabled:false},{inactiveAt:f.now},{absoluteExpiresAt:f.now},{checkedAt:f.now-6000},{policyVersion:'unreviewed'}]){
    f.deps.check=async(...args)=>({...await check(...args),...patch});assert.equal((await f.handler(f.request())).status,503);
  }
  f.deps.check=async()=>{throw Error('synthetic-private-connection-password');};const response=await f.handler(f.request());assert.equal(response.status,503);assert.doesNotMatch(await response.text(),/password|token|connection/);
});
test('logout never reports success while DB still active or upstream transport fails',async()=>{
  const f=await fixture();f.deps.logout=async()=>{};assert.equal((await f.handler(f.request('/revoke'))).status,503);
  f.deps.logout=async()=>{throw Error('synthetic logout failure');};assert.equal((await f.handler(f.request('/revoke'))).status,503);
});
test('bounded concurrency retains occupied slots until DB operations settle',async()=>{
  const f=await fixture(),check=f.deps.check;let release;const pending=new Promise(r=>{release=r;});f.deps.check=async(...args)=>{await pending;return check(...args);};
  const requests=Array.from({length:4},()=>f.handler(f.request()));await new Promise(r=>setImmediate(r));assert.equal((await f.handler(f.request())).status,503);release();assert.deepEqual((await Promise.all(requests)).map(r=>r.status),[200,200,200,200]);
});
test('authority deadline fails closed when a dependency never resolves',async()=>{
  const f=await fixture();f.deps.check=()=>new Promise(()=>{});const response=await f.handler(f.request());assert.equal(response.status,503);assert.equal(await response.text(),JSON.stringify({error:'Session authority unavailable'}));
});
test('restricted connection validator rejects postgres/service_role/production and insecure or option-injected URLs',()=>{
  validateDatabaseUrl('postgresql://mobile_session_authority_login:synthetic@db.'+TEST_REF+'.supabase.co:5432/postgres?sslmode=require');
  validateDatabaseUrl('postgresql://mobile_session_authority_login.'+TEST_REF+':synthetic@aws-0-us-west-1.pooler.supabase.com:6543/postgres');
  for(const url of ['postgresql://postgres:synthetic@db.'+TEST_REF+'.supabase.co/postgres','postgresql://service_role:synthetic@db.'+TEST_REF+'.supabase.co/postgres','postgresql://mobile_session_authority_login:synthetic@db.acpderotiyoecmwwyfsu.supabase.co/postgres','postgresql://mobile_session_authority_login:synthetic@db.'+TEST_REF+'.supabase.co/postgres?sslmode=disable','postgresql://mobile_session_authority_login:synthetic@db.'+TEST_REF+'.supabase.co/postgres?options=-crole%3Dpostgres'])assert.throws(()=>validateDatabaseUrl(url));
});
const env={TEST_ENVIRONMENT:'debtfree-mobile-test',TEST_SUPABASE_REF:TEST_REF,TEST_ISSUER,AUTHORITY_EDGE_URL:base,MOBILE_AUTHORITY_SERVER_KEY:secret};
test('private proxy pins destination and headers, strips debug extras, denies browser and unconfigured requests',async()=>{
  const f=await fixture(),calls=[];const proxy=createAuthorityProxy(async(url,init)=>{calls.push({url,init});return Response.json({...await f.deps.check(subject,sessionId),debug:'synthetic-secret-extra'});});
  const request=new Request('https://session-authority.internal/check',{method:'POST',headers:{authorization:'Bearer '+f.token,'x-attacker':'ignored'}});
  const response=await proxy.fetch(request,env);assert.equal(response.status,200);assert.doesNotMatch(await response.text(),/debug|synthetic-secret-extra/);assert.equal(calls[0].url,base+'/check');assert.equal(calls[0].init.redirect,'error');assert.equal(calls[0].init.headers['x-authority-key'],secret);assert.equal(calls[0].init.headers['x-attacker'],undefined);
  assert.equal((await proxy.fetch(request,{...env,AUTHORITY_EDGE_URL:'https://evil.test'})).status,503);
  assert.equal((await proxy.fetch(new Request('https://session-authority.internal/check',{method:'POST',headers:{origin:'https://evil.test'}}),env)).status,403);
  assert.equal(calls.length,1);
});
test('proxy errors, redirects and oversized responses never leak upstream details',async()=>{
  const f=await fixture(),request=new Request('https://session-authority.internal/check',{method:'POST',headers:{authorization:'Bearer '+f.token}});
  for(const response of [new Response('private debug',{status:500}),new Response(null,{status:302,headers:{location:'https://evil.test'}}),new Response('x'.repeat(5000)),Response.json({active:true,policyVersion:'wrong'})]){
    const result=await createAuthorityProxy(async()=>response).fetch(request,env);assert.equal(result.status,503);assert.doesNotMatch(await result.text(),/private debug|evil/);
  }
});
test('SQL statically isolates execute login, non-login owner/column grants and private fixed-path function',()=>{
  const sql=readFileSync(new URL('../supabase/mobile-test/session-authority.sql',import.meta.url),'utf8');
  assert.match(sql,/CREATE ROLE mobile_session_authority_owner NOLOGIN NOSUPERUSER/);assert.match(sql,/mobile_session_authority_login NOLOGIN PASSWORD NULL CONNECTION LIMIT 4/);
  assert.match(sql,/SECURITY DEFINER SET search_path = ''/);assert.match(sql,/session_user <> 'mobile_session_authority_login'/);
  assert.match(sql,/REVOKE ALL ON FUNCTION[\s\S]*FROM PUBLIC, anon, authenticated, service_role/);
  assert.match(sql,/GRANT EXECUTE ON FUNCTION[\s\S]*TO mobile_session_authority_login/);
  assert.doesNotMatch(sql,/GRANT SELECT[^;]*TO mobile_session_authority_login/);assert.doesNotMatch(sql,/GRANT .*mobile_session_authority_owner TO mobile_session_authority_login/);
  assert.match(sql,/refresh_token_counter IS NOT NULL/);assert.match(sql,/interval '30 minutes'/);assert.match(sql,/interval '12 hours'/);assert.doesNotMatch(sql,/raw_user_meta_data|public\.household|UPDATE auth|DELETE FROM/);
  assert.match(sql,/GRANT SELECT \(session_id,user_id,revoked\) ON auth\.refresh_tokens TO mobile_session_authority_owner/);
  assert.match(sql,/ELSE EXISTS \(SELECT FROM auth\.refresh_tokens AS r[\s\S]*r\.session_id = p_session AND r\.user_id = p_subject::text AND r\.revoked = false/);
  assert.match(sql,/CREATE POLICY mobile_authority_refresh_read ON auth\.refresh_tokens[\s\S]*TO mobile_session_authority_owner USING \(true\)/);
  assert.doesNotMatch(sql,/SELECT[^;]*(?:r\.token|refresh_token_hmac_key)|GRANT SELECT \(token/);
  assert.match(sql,/LANGUAGE SQL SECURITY INVOKER SET search_path = ''[\s\S]*BEGIN ATOMIC/);
  assert.match(sql,/REVOKE ALL ON FUNCTION mobile_session_authority\.session_facts[^;]*mobile_session_authority_login/);
  assert.match(sql,/SELECT \* INTO v_row FROM mobile_session_authority\.session_facts/);
  assert.match(sql,/session_policy[\s\S]*FOR UPDATE/);assert.match(sql,/SET expired=true/);assert.match(sql,/REFERENCES auth\.sessions\(id\) ON DELETE CASCADE/);
  const runtime=readFileSync(new URL('../supabase/functions/mobile-session-authority/index.ts',import.meta.url),'utf8');assert.doesNotMatch(runtime,/SUPABASE_DB_URL|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY/);assert.match(runtime,/npm:postgres@3\.4\.7/);assert.match(runtime,/npm:jose@6\.2\.8/);assert.match(runtime,/prepare:false,max:2/);assert.match(runtime,/rejectUnauthorized:true.*'verify-full'/);
});
