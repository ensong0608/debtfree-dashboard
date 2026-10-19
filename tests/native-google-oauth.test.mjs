import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createGoogleOAuth, GOOGLE_CALLBACK_BASE, GOOGLE_TEST_ORIGIN, validateGoogleLaunch } from '../mobile/native/google-oauth.ts';
import { NativeBrowserAuth } from '../mobile/native/browser-auth.ts';
import { NativeSession } from '../mobile/native/session.ts';
const config = { supabaseUrl: GOOGLE_TEST_ORIGIN, publishableKey: 'sb_publishable_synthetic_public_configuration_only' };
const sessionConfig = { environment: 'test', backendId: 'debtfree-mobile-test', apiOrigin: 'https://debtfree-mobile-test.example.test', issuer: GOOGLE_TEST_ORIGIN + '/auth/v1', productionIssuer: 'https://acpderotiyoecmwwyfsu.supabase.co/auth/v1', callbackBase: GOOGLE_CALLBACK_BASE };
const now = 1_800_000_000_000;
const response = (patch = {}) => new Response(JSON.stringify({ access_token: 'synthetic.access.signature', refresh_token: 'synthetic-refresh-token', token_type: 'bearer', expires_in: 3600, ...patch }), { headers: { 'Content-Type': 'application/json' } });
const defer = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const turn = () => new Promise(resolve => setImmediate(resolve));

test('PKCE uses independent cryptographic correlation/verifier, S256 and exact test redirect without upstream state', async () => {
  const oauth = createGoogleOAuth(config, { now: () => now, fetch: async () => { throw Error('must not fetch preparation'); } });
  const a = await oauth.prepare({ redirectBase: GOOGLE_CALLBACK_BASE }), b = await oauth.prepare({ redirectBase: GOOGLE_CALLBACK_BASE });
  assert.match(a.pending.verifier, /^[A-Za-z0-9_-]{43}$/); assert.match(a.pending.correlation, /^[a-f0-9]{64}$/);
  assert.notEqual(a.pending.verifier, a.pending.correlation); assert.notEqual(a.pending.verifier, b.pending.verifier); assert.notEqual(a.pending.correlation, b.pending.correlation);
  const url = validateGoogleLaunch(a.url, a.pending), redirect = new URL(url.searchParams.get('redirect_to'));
  assert.equal(url.searchParams.get('code_challenge'), createHash('sha256').update(a.pending.verifier).digest('base64url'));
  assert.equal(url.searchParams.get('code_challenge_method'), 's256'); assert.equal(url.searchParams.has('state'), false);
  assert.equal(redirect.href.split('#')[0], GOOGLE_CALLBACK_BASE); assert.equal(redirect.search, ''); assert.equal(redirect.hash, '#correlation=' + a.pending.correlation); assert.equal(a.pending.expiresAt, now + 300_000);
});

test('exchange/refresh/logout use actual Auth request shapes, omit cookies and reject redirects', async () => {
  const calls = []; const oauth = createGoogleOAuth(config, { now: () => now, fetch: async (url, init) => { calls.push({url,init}); return url.includes('/logout') ? new Response(null, {status:204}) : response(); } });
  const credentials = await oauth.exchange('synthetic-code', 'v'.repeat(43));
  await oauth.refresh(credentials.refreshToken); await oauth.signOut(credentials);
  assert.equal(calls[0].url, GOOGLE_TEST_ORIGIN + '/auth/v1/token?grant_type=pkce');
  assert.deepEqual(JSON.parse(calls[0].init.body), { auth_code: 'synthetic-code', code_verifier: 'v'.repeat(43) });
  assert.deepEqual(JSON.parse(calls[1].init.body), { refresh_token: 'synthetic-refresh-token' });
  assert.equal(calls[2].url, GOOGLE_TEST_ORIGIN + '/auth/v1/logout?scope=local');
  for (const {init} of calls) { assert.equal(init.credentials,'omit'); assert.equal(init.redirect,'error'); assert.equal(init.cache,'no-store'); assert.equal(init.headers.apikey,config.publishableKey); }
  assert.equal(calls[2].init.headers.Authorization,'Bearer synthetic.access.signature');
  assert.equal(credentials.expiresAt,now+3_600_000); assert.deepEqual(Object.keys(credentials).sort(),['accessToken','expiresAt','refreshToken']);
});

test('production config, absent/nonpublishable key, arbitrary callbacks and malformed launch URLs are rejected', async () => {
  for (const c of [{...config,supabaseUrl:'https://acpderotiyoecmwwyfsu.supabase.co'}, {...config,supabaseUrl:GOOGLE_TEST_ORIGIN+'/'}, {...config,publishableKey:''}, {...config,publishableKey:'sb_secret_not_allowed'}, {...config,publishableKey:'synthetic.jwt.key'}]) assert.throws(()=>createGoogleOAuth(c));
  const oauth = createGoogleOAuth(config); await assert.rejects(oauth.prepare({redirectBase:GOOGLE_CALLBACK_BASE+'?next=x'}));
  const prepared = await oauth.prepare({redirectBase:GOOGLE_CALLBACK_BASE});
  for (const modify of [u=>{u.hostname='acpderotiyoecmwwyfsu.supabase.co';},u=>{u.searchParams.set('provider','github');},u=>{u.searchParams.set('redirect_to','https://evil.test');},u=>{u.searchParams.set('state','ours');},u=>{u.searchParams.append('provider','google');},u=>{u.hash='access_token=synthetic';}]) { const u=new URL(prepared.url);modify(u);assert.throws(()=>validateGoogleLaunch(u.href,prepared.pending)); }
});

test('malformed, oversized, expired tokens and error/redirect responses fail without echoing provider payload', async () => {
  const bad = [()=>response({access_token:''}),()=>response({refresh_token:'white space'}),()=>response({token_type:'basic'}),()=>response({expires_in:Infinity}),()=>response({expires_in:0}),()=>response({expires_at:1}),()=>new Response('private provider details',{status:400}),()=>new Response('x'.repeat(65_537),{headers:{'Content-Type':'application/json'}}),()=>new Response('{}',{headers:{'Content-Type':'text/html'}}),()=>{const r=response();Object.defineProperty(r,'redirected',{value:true});return r;},()=>{const r=response();Object.defineProperty(r,'url',{value:'https://acpderotiyoecmwwyfsu.supabase.co/auth/v1/token'});return r;}];
  for (const make of bad) { const oauth=createGoogleOAuth(config,{now:()=>now,fetch:async()=>make()}); await assert.rejects(oauth.exchange('synthetic-code','v'.repeat(43)),error=>error.message==='Google sign-in transport failed.'); }
});

test('timeout bounds even a fetch ignoring AbortSignal and delayed body reads', async () => {
  let signal; const oauth=createGoogleOAuth(config,{timeoutMs:5,fetch:async(_url,init)=>{signal=init.signal;return new Promise(()=>{});}});
  await assert.rejects(oauth.refresh('synthetic-refresh-token'));assert.equal(signal.aborted,true);
  const stalled=createGoogleOAuth(config,{timeoutMs:5,fetch:async()=>new Response(new ReadableStream({start(){}}),{headers:{'Content-Type':'application/json'}})});
  await assert.rejects(stalled.refresh('synthetic-refresh-token'));
});

function fixture({ records = new Map(), cold, browserOpen, bootstrap } = {}) {
  let time=now, opened=0, closed=0, exchanged=0, refreshed=0, removed=0;
  const callbacks={}, tasks=new Map();let timerId=0;
  const timers={set(fn,ms){const id=++timerId;tasks.set(id,{fn,ms});return id;},clear(id){tasks.delete(id);}};
  const vault={read:async key=>structuredClone(records.get(key)??null),write:async(key,value)=>{records.set(key,structuredClone(value));},remove:async key=>{records.delete(key);}};
  const oauth=createGoogleOAuth(config,{now:()=>time,fetch:async(url)=>{if(url.includes('pkce'))exchanged++;if(url.includes('refresh_token'))refreshed++;return url.includes('/logout')?new Response(null,{status:204}):response();}});
  const scope={backendId:sessionConfig.backendId,issuer:sessionConfig.issuer,subject:'synthetic-subject',identity:'tester@example.test',householdId:'synthetic-household',role:'owner'};
  let bridge;
  const session=new NativeSession(sessionConfig,{vault,oauth,authority:{bootstrap:bootstrap??(async()=>scope),revoke:async()=>true},browser:{open:url=>bridge.open(url)},now:()=>time});
  const browser={open:async options=>{opened++;await browserOpen?.(options);},close:async()=>{closed++;},addListener:async(name,fn)=>{callbacks[name]=fn;return{remove:async()=>{delete callbacks[name];removed++;}};}};
  const app={addListener:async(name,fn)=>{callbacks[name]=fn;return{remove:async()=>{delete callbacks[name];removed++;}};},getLaunchUrl:async()=>cold?{url:cold}:undefined};
  bridge=new NativeBrowserAuth({session,vault,browser,app,isNative:true,platform:'android',now:()=>time,timers});
  const pending=()=>[...records.entries()].find(([key])=>key.endsWith('"pending"]'))?.[1];
  const callback=()=>GOOGLE_CALLBACK_BASE+'?code=synthetic-code#correlation='+pending().correlation;
  return {bridge,session,vault,records,callbacks,tasks,timers,oauth,browser,app,callback,pending,counts:()=>({opened,closed,exchanged,refreshed,removed}),advance(ms){time+=ms;},async run(ms){for(const[id,task]of [...tasks])if(task.ms===ms){tasks.delete(id);task.fn();}await turn();await turn();}};
}

test('listeners precede browser open; warm/cold duplicates exchange exactly once and readiness requires authority', async () => {
  const proof=defer(), entered=defer();const f=fixture({bootstrap:()=>{entered.resolve();return proof.promise;}});await f.bridge.startGoogleLogin();
  assert.equal(f.session.snapshot().state,'authorizing');assert.equal(typeof f.callbacks.appUrlOpen,'function');assert.equal(typeof f.callbacks.browserFinished,'function');
  const raw=f.callback(), first=f.bridge.handleUrl(raw), duplicate=f.bridge.handleUrl(raw);await entered.promise;
  assert.equal(f.session.snapshot().state,'verifying');assert.equal(f.counts().exchanged,1);
  f.callbacks.browserFinished();await f.run(250);assert.equal(f.session.snapshot().state,'verifying');
  proof.resolve({backendId:sessionConfig.backendId,issuer:sessionConfig.issuer,subject:'synthetic-subject',identity:'tester@example.test',householdId:'synthetic-household',role:'owner'});
  assert.deepEqual(await Promise.all([first,duplicate]),['callback','ignored']);assert.equal(f.session.snapshot().state,'ready');await f.bridge.dispose();assert.equal(f.counts().removed,2);
});

test('cold startup consumes persisted secure pending through same session handler and ignores warm replay', async () => {
  const a=fixture();await a.bridge.startGoogleLogin();const raw=a.callback();
  const b=fixture({records:a.records,cold:raw});await b.bridge.initialize();assert.equal(b.session.snapshot().state,'ready');assert.equal(await b.bridge.handleUrl(raw),'ignored');assert.equal(b.counts().exchanged,1);
  await b.bridge.dispose();await a.bridge.dispose();
});

test('browser finished, explicit restart cancellation and expiry invalidate verifier before late callback', async () => {
  const a=fixture();await a.bridge.startGoogleLogin();const raw=a.callback();a.callbacks.browserFinished();await a.run(250);assert.equal(a.session.snapshot().state,'signedOut');assert.equal(a.records.size,0);assert.equal(await a.bridge.handleUrl(raw),'rejected');assert.equal(a.counts().exchanged,0);await a.bridge.dispose();
  const first=fixture();await first.bridge.startGoogleLogin();const b=fixture({records:first.records});await b.bridge.initialize();await b.bridge.cancel();assert.equal(b.records.size,0);await b.bridge.dispose();await first.bridge.dispose();
  const expired=fixture();await expired.bridge.startGoogleLogin();expired.advance(300_000);await expired.run(300_000);assert.equal(expired.records.size,0);assert.equal(expired.session.snapshot().state,'signedOut');await expired.bridge.dispose();
});

test('provider-error/missing-correlation callback is rejected with no exchange or token adoption', async () => {
  for(const suffix of ['#error=access_denied','?error=access_denied','?code=synthetic-code']){const f=fixture();await f.bridge.startGoogleLogin();assert.equal(await f.bridge.handleUrl(GOOGLE_CALLBACK_BASE+suffix),'rejected');assert.equal(f.counts().exchanged,0);assert.equal(f.records.size,0);await f.bridge.dispose();}
});

test('browser launch failure, production navigation and disposal clean own listeners/pending', async () => {
  const f=fixture({browserOpen:async()=>{throw Error('private native plugin error');}});await assert.rejects(f.bridge.startGoogleLogin());assert.equal(f.records.size,0);await f.bridge.dispose();assert.equal(f.counts().removed,2);
  const b=fixture();await b.bridge.initialize();await assert.rejects(b.bridge.open('https://acpderotiyoecmwwyfsu.supabase.co/auth/v1/authorize'));assert.equal(b.counts().opened,0);await b.bridge.dispose();
});

test('stale refresh result after logout cannot resurrect credentials', async () => {
  const f=fixture();await f.bridge.startGoogleLogin();await f.bridge.handleUrl(f.callback());f.advance(3_590_000);const result=defer();f.oauth.refresh=()=>result.promise;
  const refresh=f.session.accessToken();await f.session.logout();result.resolve({accessToken:'synthetic.rotated.signature',refreshToken:'synthetic-new-refresh',expiresAt:now+7_200_000});await assert.rejects(refresh);assert.equal(f.session.snapshot().state,'signedOut');assert.equal(f.records.size,0);await f.bridge.dispose();
});


test('callback finishing before Browser.open settles does not lock an authority-verified session', async () => {
  const opening=defer(), entered=defer();const f=fixture({browserOpen:()=>{entered.resolve();return opening.promise;}});
  const start=f.bridge.startGoogleLogin();await entered.promise;assert.equal(await f.bridge.handleUrl(f.callback()),'callback');opening.resolve();await start;assert.equal(f.session.snapshot().state,'ready');await f.bridge.dispose();
});

test('browser open timeout invalidates pending and late open completion cannot create a session', async () => {
  const opening=defer(), entered=defer();const f=fixture({browserOpen:()=>{entered.resolve();return opening.promise;}});
  const start=f.bridge.startGoogleLogin(), rejected=assert.rejects(start);await entered.promise;await f.run(15_000);await rejected;assert.equal(f.records.size,0);assert.notEqual(f.session.snapshot().state,'ready');opening.resolve();await turn();assert.notEqual(f.session.snapshot().state,'ready');await f.bridge.dispose();
});

test('late listener registration after initialization timeout is removed; web fallback is rejected', async () => {
  const f=fixture(), registration=defer();let removed=0;f.app.addListener=()=>registration.promise;
  const init=f.bridge.initialize(), rejected=assert.rejects(init);await f.run(15_000);await rejected;
  registration.resolve({remove:async()=>{removed++;}});await turn();await turn();assert.equal(removed,1);await f.bridge.dispose();
  assert.throws(()=>new NativeBrowserAuth({isNative:false,platform:'android'}));
});

test('expired pending after restart is canceled before any browser launch/exchange', async () => {
  const f=fixture();await f.bridge.startGoogleLogin();const b=fixture({records:f.records});b.advance(300_000);await b.bridge.initialize();assert.equal(b.records.size,0);assert.equal(b.counts().exchanged,0);assert.equal(b.counts().opened,0);await b.bridge.dispose();await f.bridge.dispose();
});

test('dispose still closes browser and removes listeners when session cancellation fails', async () => {
  const f=fixture();await f.bridge.startGoogleLogin();f.session.cancelLogin=async()=>{throw Error('synthetic vault failure');};await assert.rejects(f.bridge.dispose(),/Could not cancel sign-in/);assert.equal(f.counts().removed,2);assert.ok(f.counts().closed>=1);
});


test('a delayed initialization read cannot rearm an old pending timer after warm callback verifies', async () => {
  const a=fixture();await a.bridge.startGoogleLogin();const raw=a.callback(), saved=a.pending();
  const b=fixture({records:a.records}), entered=defer(), blocked=defer(), original=b.vault.read;let reads=0;
  b.vault.read=async key=>{if(key.endsWith('"pending"]')&&++reads===1){entered.resolve();return blocked.promise;}return original(key);};
  const initialization=b.bridge.initialize();await entered.promise;assert.equal(await b.bridge.handleUrl(raw),'callback');assert.equal(b.session.snapshot().state,'ready');blocked.resolve(saved);await initialization;
  await b.run(300_000);assert.equal(b.session.snapshot().state,'ready');await b.bridge.dispose();await a.bridge.dispose();
});
