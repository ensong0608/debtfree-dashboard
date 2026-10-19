import test from 'node:test';
import assert from 'node:assert/strict';
import { NativeSession } from '../mobile/native/session.ts';
import { createNativeApi } from '../mobile/native/api.ts';
import { SignInFailure, validateConfig } from '../mobile/native/contracts.ts';
import { subscribeRevisions } from '../mobile/native/notifications.ts';
const config = { environment: 'test', backendId: 'debtfree-mobile-test', apiOrigin: 'https://debtfree-mobile-test.example.test', issuer: 'https://synthetic-test.supabase.co/auth/v1', productionIssuer: 'https://synthetic-production.supabase.co/auth/v1', callbackBase: 'com.debtfree.connectedtest://auth/callback' };
const defer = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function fixture() {
  let now = 1_000_000, identity = 'a', exchanges = 0, refreshes = 0;
  const records = new Map(), states = [];
  const credentials = () => ({ accessToken: 'fake-access-' + identity, refreshToken: 'fake-refresh-' + identity, expiresAt: now + 60_000 });
  const scope = () => ({ backendId: config.backendId, issuer: config.issuer, subject: identity, identity: identity + '@example.test', householdId: 'household-' + identity, role: 'owner' });
  const deps = { vault: { read: async k => records.get(k) ?? null, write: async (k,v) => { records.set(k, structuredClone(v)); }, remove: async k => { records.delete(k); } }, oauth: { prepare: async () => ({ url: 'https://synthetic-test.supabase.co/auth/v1/authorize', pending: { verifier: 'v'.repeat(43), correlation: 'c'.repeat(32), expiresAt: now + 240_000, callbackBase: config.callbackBase } }), exchange: async () => { exchanges++; return credentials(); }, refresh: async () => { refreshes++; return credentials(); }, signOut: async () => {} }, authority: { bootstrap: async () => scope(), revoke: async () => true }, browser: { open: async () => {} }, now: () => now, changed: s => states.push(s) };
  const session = new NativeSession(config, deps);
  const callback = (extra = '') => config.callbackBase + '?code=synthetic-code' + extra + '#correlation=' + 'c'.repeat(32);
  return { session, deps, records, states, callback, credentials, scope, login: async () => { await session.startGoogleLogin(); await session.handleCallback(callback()); }, setIdentity: x => { identity = x; }, advance: x => { now += x; }, counts: () => ({ exchanges, refreshes }) };
}
test('explicit test origin/issuer/callback configuration rejects defaults and production', () => {
  for (const patch of [{ environment: 'production' }, { apiOrigin: 'https://production.example.test' }, { apiOrigin: 'http://debtfree-mobile-test.example.test' }, { issuer: config.productionIssuer }, { productionIssuer: '' }, { issuer: config.issuer + '?x=1' }, { callbackBase: 'other://auth/callback' }]) assert.throws(() => validateConfig({ ...config, ...patch }));
  assert.throws(() => validateConfig({}));
});
test('server bootstrap is required; restore never exposes stored scope', async () => {
  const f = fixture(), pending = defer(); await f.login(); await f.session.logout();
  f.records.set(JSON.stringify(['debtfree-native-test-v1', config.issuer, 'credentials']), f.credentials());
  f.deps.authority.bootstrap = async () => pending.promise;
  const restoring = f.session.restore(); await new Promise(r => setImmediate(r));
  assert.equal(f.session.snapshot().state, 'verifying'); await assert.rejects(f.session.accessToken());
  pending.resolve(f.scope()); await restoring; assert.equal(f.session.snapshot().state, 'ready');
  assert.ok(f.states.includes('authorizing') && f.states.includes('exchanging') && f.states.includes('closing'));
});
test('duplicate warm/cold callbacks exchange once and replay is denied', async () => {
  const f = fixture(); await f.session.startGoogleLogin();
  const first = f.session.handleCallback(f.callback()); await assert.rejects(f.session.handleCallback(f.callback())); await first;
  assert.equal(f.counts().exchanges, 1); await assert.rejects(f.session.handleCallback(f.callback()));
});
test('malformed, uncorrelated, expired, canceled and unsolicited callbacks fail closed', async () => {
  for (const transform of [f => f.callback('&code=duplicate'), f => f.callback('&next=https://evil.test'), f => f.callback('#access_token=fake'), f => f.callback().replace('correlation=','wrong='), f => f.callback().replace('://auth/', '://evil/'), f => f.callback().replace('synthetic-code',''), f => f.callback().replace('c'.repeat(32),'x'.repeat(32))]) {
    const f = fixture(); await f.session.startGoogleLogin(); await assert.rejects(f.session.handleCallback(transform(f))); assert.equal(f.counts().exchanges, 0); assert.equal(f.records.size, 0);
  }
  const expired = fixture(); await expired.session.startGoogleLogin(); expired.advance(250_000); await assert.rejects(expired.session.handleCallback(expired.callback()));
  const canceled = fixture(); await canceled.session.startGoogleLogin(); await canceled.session.cancelLogin(); await assert.rejects(canceled.session.handleCallback(canceled.callback()));
  const unsolicited = fixture(); await assert.rejects(unsolicited.session.handleCallback(unsolicited.callback()));
});
test('secure write failure locks and missing verifier never exchanges', async () => {
  const f = fixture(); await f.session.startGoogleLogin(); f.deps.vault.write = async () => { throw Error('synthetic storage failure'); };
  await assert.rejects(f.session.handleCallback(f.callback())); assert.equal(f.session.snapshot().state, 'locked'); await assert.rejects(f.session.accessToken());
  const m = fixture(); await m.session.startGoogleLogin(); for (const v of m.records.values()) v.verifier = ''; await assert.rejects(m.session.handleCallback(m.callback())); assert.equal(m.counts().exchanges, 0);
});
test('refresh is single-flight and verifies rotated identity before ready', async () => {
  const f = fixture(); await f.login(); f.advance(40_000); const p = defer(); let count = 0; f.deps.oauth.refresh = async () => { count++; return p.promise; };
  const a = f.session.accessToken(), b = f.session.accessToken(); p.resolve(f.credentials()); assert.deepEqual(await Promise.all([a,b]), ['fake-access-a','fake-access-a']); assert.equal(count,1);
  f.advance(40_000); f.setIdentity('b'); await assert.rejects(f.session.accessToken()); assert.equal(f.session.snapshot().state,'locked');
});
test('offline logout cleans locally and reports unconfirmed server revocation; vault remove failure stays locked', async () => {
  const f = fixture(); await f.login(); f.deps.authority.revoke = async () => { throw Error('offline'); }; f.deps.oauth.signOut = async () => { throw Error('offline'); };
  assert.deepEqual(await f.session.logout(), { serverRevoked: false, localCleared: true }); assert.equal(f.records.size,0); await assert.rejects(f.session.accessToken());
  await f.login(); f.deps.vault.remove = async () => { throw Error('blocked'); }; assert.equal((await f.session.logout()).localCleared,false); assert.equal(f.session.snapshot().state,'locked');
});
test('API uses native-only route/current bearer/scope and no traffic before ready; writes remain gated', async () => {
  const f = fixture(), calls = []; const api = createNativeApi(config,f.session,async (url,init) => { calls.push({url,init}); return new Response('{"synthetic":true}'); });
  await assert.rejects(api.request('/api/native/v1/household')); assert.equal(calls.length,0); await f.login();
  assert.deepEqual(await (await api.request('/api/native/v1/household')).json(),{synthetic:true});
  assert.equal(calls[0].init.headers.get('authorization'),'Bearer fake-access-a'); assert.equal(calls[0].init.headers.get('x-debtfree-household'),'household-a'); assert.equal(calls[0].init.credentials,'omit'); assert.equal(calls[0].init.redirect,'error'); assert.equal(calls[0].init.cache,'no-store');
  for (const path of ['https://evil.test/api/native/v1/household','/api/household','/api/native/v1/household?next=x']) await assert.rejects(api.request(path));
  for (const headers of [{Authorization:'forged'}, {Cookie:'fake'}, {'x-debtfree-household':'b'}, {Origin:config.apiOrigin}]) await assert.rejects(api.request('/api/native/v1/household',{headers}));
  await assert.rejects(api.request('/api/native/v1/household',{credentials:'include'})); await assert.rejects(api.request('/api/native/v1/household',{method:'PUT',body:'fake'})); assert.equal(calls.length,1);
});
test('redirects rejected without following; server denial locks; stale A response cannot reach B', async () => {
  const f = fixture(); await f.login(); let result = new Response(null,{status:302,headers:{location:'https://evil.test'}});
  const api = createNativeApi(config,f.session,async () => result); await assert.rejects(api.request('/api/native/v1/household'));
  const p = defer(); const delayed = createNativeApi(config,f.session,async () => p.promise); const request = delayed.request('/api/native/v1/household'); await new Promise(r => setImmediate(r));
  await f.session.logout(); f.setIdentity('b'); await f.login(); p.resolve(new Response('private synthetic A')); await assert.rejects(request,/Session changed/);
  result = new Response(null,{status:401}); await assert.rejects(api.request('/api/native/v1/household')); assert.equal(f.session.snapshot().state,'locked');
});
test('late exchange during logout cannot restore A credentials or overwrite B', async () => {
  const f=fixture(), p=defer(); f.deps.oauth.exchange=async()=>p.promise; await f.session.startGoogleLogin(); const exchange=f.session.handleCallback(f.callback()); await new Promise(r=>setImmediate(r));
  await f.session.logout(); p.resolve(f.credentials()); await assert.rejects(exchange); assert.equal(f.session.snapshot().state,'signedOut'); assert.equal(f.records.size,0);
});
test('cold delivery restores pending transaction only; denied authority never becomes ready', async () => {
  const f=fixture(); await f.session.startGoogleLogin(); const cold=new NativeSession(config,f.deps); await cold.handleCallback(f.callback()); assert.equal(cold.snapshot().scope.subject,'a');
  const denied=fixture(); denied.deps.authority.bootstrap=async()=>{throw Error('synthetic revoked session');}; await assert.rejects(denied.login()); assert.equal(denied.session.snapshot().state,'locked');
  const wrong=fixture(); wrong.deps.authority.bootstrap=async()=>({...wrong.scope(),issuer:config.productionIssuer}); await assert.rejects(wrong.login());
});
test('account switch during response-body download discards buffered financial data', async () => {
  const f=fixture(); await f.login(); const p=defer(), downloading=defer(); const response=new Response(new ReadableStream({ async start(controller) { downloading.resolve(); await p.promise; controller.enqueue(new TextEncoder().encode('synthetic A')); controller.close(); } }));
  const api=createNativeApi(config,f.session,async()=>response); const request=api.request('/api/native/v1/household'); await downloading.promise; await new Promise(r=>setImmediate(r));
  await f.session.logout(); f.setIdentity('b'); await f.login(); p.resolve(); await assert.rejects(request,/Session changed/);
});
test('vault read failure and denied refresh remain locked without transport', async () => {
  const f=fixture(); f.deps.vault.read=async()=>{throw Error('synthetic locked vault');}; await assert.rejects(f.session.restore()); assert.equal(f.session.snapshot().state,'locked');
  const r=fixture(); await r.login(); r.advance(40_000); r.deps.oauth.refresh=async()=>{throw Error('synthetic revoked refresh');}; await assert.rejects(r.session.accessToken()); assert.equal(r.session.snapshot().scope,null);
});
test('native revision client validates ticket destination, deduplicates hints and closes stale-account channel',async()=>{
  const f=fixture();await f.login();const handlers={},revisions=[];let closed=0,reconnect=0;
  const api={request:async()=>Response.json({socketUrl:'wss://debtfree-mobile-test.example.test/api/native/v1/notifications/socket/household-a',protocols:['debtfree-revisions','debtfree-ticket.12345678-1234-1234-1234-123456789abc'],expiresIn:30})};
  const input={config,session:f.session,api,open:()=>({addEventListener:(event,handler)=>{handlers[event]=handler;},close:()=>{closed++;}}),revisionChanged:async revision=>{revisions.push(revision);},reconnectNeeded:()=>{reconnect++;}};
  const stop=await subscribeRevisions(input);handlers.message({data:JSON.stringify({type:'revision-changed',revision:2})});handlers.message({data:JSON.stringify({type:'revision-changed',revision:2})});assert.deepEqual(revisions,[2]);
  await f.session.logout();handlers.message({data:JSON.stringify({type:'revision-changed',revision:3})});assert.equal(closed,1);assert.equal(reconnect,1);stop();assert.equal(closed,1);
  await f.login();await assert.rejects(subscribeRevisions({...input,api:{request:async()=>Response.json({socketUrl:'wss://evil.test',protocols:[],expiresIn:30})}}));
});

 test('sign-in reports only a fixed failure stage and never an upstream secret', async () => {
  for (const error of [new SignInFailure('test-authority'), new Error('synthetic-private-token')]) {
    const f=fixture();f.deps.authority.bootstrap=async()=>{throw error;};
    await assert.rejects(f.login());assert.equal(f.session.snapshot().state,'locked');
    assert.match(f.session.failureMessage(),error instanceof SignInFailure?/S3/:/C1/);
    assert.doesNotMatch(f.session.failureMessage(),/synthetic|private|token/);
    assert.equal(f.records.size,0);await f.session.logout();await f.session.startGoogleLogin();assert.equal(f.session.failureMessage(),'');
  }
});
