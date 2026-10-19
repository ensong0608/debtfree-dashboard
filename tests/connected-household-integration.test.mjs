import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createConnectedRepository } from '../mobile/native/repository.ts';
import { createNativeApi } from '../mobile/native/api.ts';
import { scopeKey } from '../mobile/native/contracts.ts';
import { createMobileTestWorker } from '../worker/mobile-test.ts';
import { createDemoFixture } from '../mobile/demo-fixture.ts';
import { parseCallback } from '../mobile/native/callback.ts';
import { createGoogleOAuth, GOOGLE_CALLBACK_BASE, GOOGLE_TEST_ORIGIN } from '../mobile/native/google-oauth.ts';

const config = { environment: 'test', backendId: 'debtfree-mobile-test', apiOrigin: 'https://debtfree-mobile-test.example.test', issuer: 'https://synthetic-test.supabase.co/auth/v1', productionIssuer: 'https://synthetic-production.supabase.co/auth/v1', callbackBase: GOOGLE_CALLBACK_BASE };
const emails = ['a@example.test', 'b@example.test'];
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: true } });
const turn = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

// In-memory SQLite runs the actual application/enrollment SQL. Auth and the
// native bridge are synthetic adapters: these tests do not prove Google, D1,
// Android encryption/fsync, radio delivery or physical two-phone acceptance.
async function fixture(t) {
  const sqlite = new DatabaseSync(':memory:');
  for (const file of ['drizzle/0000_third_baron_zemo.sql', 'drizzle/0001_household_lifecycle.sql', 'scripts/mobile/enrollment-schema.sql']) sqlite.exec(readFileSync(new URL('../' + file, import.meta.url), 'utf8'));
  const db = {
    prepare(sql) {
      const prepared = args => ({
        first: async () => sqlite.prepare(sql).get(...args) ?? null,
        all: async () => ({ results: sqlite.prepare(sql).all(...args) }),
        run: async () => ({ meta: { changes: Number(sqlite.prepare(sql).run(...args).changes) } }),
        bind: (...values) => prepared(values),
      });
      return prepared([]);
    },
    async batch(statements) {
      sqlite.exec('BEGIN');
      try { const results = []; for (const statement of statements) results.push(await statement.run()); sqlite.exec('COMMIT'); return results; }
      catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
  };
  const env = { TEST_ENVIRONMENT: 'debtfree-mobile-test', TEST_API_ORIGIN: config.apiOrigin, TEST_ISSUER: config.issuer, PRODUCTION_ISSUER: config.productionIssuer, DB: db, TESTER_EMAILS: JSON.stringify(emails) };
  const worker = createMobileTestWorker(() => ({
    authenticate: async request => {
      const user = request.headers.get('authorization')?.replace('Bearer synthetic-', '');
      if (!['a', 'b', 'other'].includes(user)) throw new Error('Denied synthetic identity');
      return { subject: user, sessionId: 'synthetic-session', email: user + '@example.test', displayName: user, token: 'synthetic-' + user };
    },
    logout: async () => ({ serverRevoked: true }),
  }));
  const request = (user, route, method = 'GET', body) => worker.fetch(new Request(config.apiOrigin + '/api/native/v1/' + route, { method, headers: { authorization: 'Bearer synthetic-' + user, ...(body === undefined ? {} : { 'content-type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }), env);
  const handles = [];
  async function phone(user, persisted) {
    const response = await request(user, 'session'); assert.equal(response.status, 200);
    const scope = await response.json(), records = persisted ?? new Map();
    let generation = 1, puts = 0, loseAck = false, hold = null;
    const events = [];
    const session = {
      snapshot: () => ({ state: 'ready', generation, scope }),
      assertCurrent(g, key) { if (g !== generation || key !== scopeKey(scope)) throw new Error('Session changed'); },
      accessToken: async () => 'synthetic-' + user,
      rejectAuthorization() { generation++; },
    };
    const bridge = {
      get: async ({ id }) => ({ value: records.get(id) ?? null }),
      set: async ({ id, value }) => { events.push('persist'); if (hold) await hold.promise; records.set(id, value); events.push('acknowledge'); },
      remove: async ({ id }) => { records.delete(id); },
    };
    const api = createNativeApi(config, session, async (url, init) => {
      if (init.method === 'PUT') { puts++; events.push('PUT'); }
      const result = await worker.fetch(new Request(url, init), env);
      if (init.method === 'PUT' && result.ok && loseAck) { loseAck = false; throw new Error('Synthetic lost acknowledgement'); }
      return result;
    });
    const handle = createConnectedRepository({ config, session, api }, () => {}, { bridge, runtime: { isNativePlatform: () => true, getPlatform: () => 'android' } });
    handles.push(handle); await handle.initialize();
    return { handle, records, events, puts: () => puts, loseNextAck() { loseAck = true; }, holdWrites(value) { hold = value; }, switchAccount() { generation++; } };
  }
  t.after(async () => { for (const handle of handles) await handle.close(); sqlite.close(); navigator.onLine = true; });
  const join = async user => { const result = await request(user, 'enrollment', 'POST', { accept: true }); assert.equal(result.status, 200); };
  return { sqlite, request, join, phone };
}

test('testers explicitly accept one empty shared household; unrelated identity and missing acceptance are denied', async t => {
  const f = await fixture(t);
  assert.equal((await f.request('a', 'session')).status, 403);
  assert.equal((await (await f.request('a', 'enrollment')).json()).canJoin, true);
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM households').get().n, 0);
  assert.equal((await f.request('other', 'enrollment', 'POST', { accept: true })).status, 403);
  assert.equal((await f.request('a', 'enrollment', 'POST', { accept: false })).status, 400);
  await f.join('b'); await f.join('a'); // Second tester can arrive first.
  const a = await (await f.request('a', 'session')).json(), b = await (await f.request('b', 'session')).json();
  assert.equal(a.householdId, b.householdId); assert.equal(a.role, 'owner'); assert.equal(b.role, 'admin');
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM households').get().n, 1);
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM household_members').get().n, 2);
  assert.equal(f.sqlite.prepare('SELECT payload FROM household_state').get().payload, null);
});

test('removed membership and a deleted membership row cannot self-enroll again', async t => {
  const f = await fixture(t); await f.join('a'); await f.join('b');
  f.sqlite.prepare("UPDATE household_members SET status='removed' WHERE email=?").run(emails[1]);
  assert.equal((await f.request('b', 'session')).status, 403);
  assert.equal((await f.request('b', 'enrollment', 'POST', { accept: true })).status, 403);
  f.sqlite.prepare('DELETE FROM household_members WHERE email=?').run(emails[1]);
  assert.equal((await f.request('b', 'enrollment', 'POST', { accept: true })).status, 403);
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM mobile_test_enrollments').get().n, 2);
});

test('two independent repositories share payment/account/category edits through actual API SQL and revisions', async t => {
  const f = await fixture(t); await f.join('a'); await f.join('b');
  const a = await f.phone('a'), b = await f.phone('b');
  const original = createDemoFixture();
  await a.handle.repository.saveHousehold(original);
  assert.equal(await b.handle.refresh(() => true), true);
  const editing = structuredClone((await b.handle.repository.loadHousehold()).contract);
  editing.payload.accounts[0].name = 'Shared synthetic card';
  editing.payload.transactions[0].amount = 125;
  editing.payload.monthlyPlan.debtGroups[0].name = 'Shared category';
  await b.handle.repository.saveHousehold(editing);
  assert.equal(await a.handle.refresh(() => true), true);
  const shared = (await a.handle.repository.loadHousehold()).contract.payload;
  assert.equal(shared.accounts[0].name, 'Shared synthetic card');
  assert.equal(shared.transactions[0].amount, 125);
  assert.equal(shared.monthlyPlan.debtGroups[0].name, 'Shared category');
  assert.equal(f.sqlite.prepare('SELECT revision FROM household_state').get().revision, 2);
  assert.notEqual(a.records, b.records); assert.equal(a.handle.snapshot().status, 'synced');
});

test('concurrent stale save cannot overwrite; explicit latest retains the losing draft as a checkpoint', async t => {
  const f = await fixture(t); await f.join('a'); await f.join('b');
  const a = await f.phone('a'), b = await f.phone('b');
  const first = createDemoFixture(), second = createDemoFixture(); first.payload.extra = 42; second.payload.extra = 84;
  await a.handle.repository.saveHousehold(first);
  await assert.rejects(b.handle.repository.saveHousehold(second));
  assert.equal(b.handle.snapshot().status, 'conflict');
  assert.equal(JSON.parse(f.sqlite.prepare('SELECT payload FROM household_state').get().payload).payload.extra, 42);
  await b.handle.useLatest();
  assert.equal((await b.handle.repository.loadHousehold()).contract.payload.extra, 42);
  assert.equal((await b.handle.repository.loadCheckpoint()).payload.extra, 84);
  assert.equal(b.handle.snapshot().pending, false);
});

test('lost save acknowledgement survives restart; retry recognizes the commit without a second PUT', async t => {
  const f = await fixture(t); await f.join('a');
  const a = await f.phone('a'); a.loseNextAck();
  await assert.rejects(a.handle.repository.saveHousehold(createDemoFixture()));
  assert.equal(a.handle.snapshot().pending, true); assert.equal(a.puts(), 1);
  await a.handle.close();
  const restarted = await f.phone('a', a.records);
  assert.equal(restarted.handle.snapshot().status, 'recovery'); assert.equal(restarted.puts(), 0);
  await restarted.handle.retry();
  assert.equal(restarted.handle.snapshot().status, 'synced'); assert.equal(restarted.puts(), 0);
  assert.equal(f.sqlite.prepare('SELECT revision FROM household_state').get().revision, 1);
});

test('financial PUT awaits native durability; changed session during acknowledgement cannot send', async t => {
  const f = await fixture(t); await f.join('a');
  const a = await f.phone('a'), hold = deferred(); a.holdWrites(hold);
  const save = a.handle.repository.saveHousehold(createDemoFixture());
  const rejection = assert.rejects(save);
  for (let n = 0; n < 20 && !a.events.slice(2).includes('persist'); n++) await turn();
  assert.equal(a.puts(), 0);
  a.switchAccount(); hold.resolve(); await rejection;
  assert.equal(a.puts(), 0); assert.equal(f.sqlite.prepare('SELECT revision FROM household_state').get().revision, 0);
});

test('callback keeps exact allowlisted destination and independent nonce through PKCE code insertion', async () => {
  const oauth = createGoogleOAuth({ supabaseUrl: GOOGLE_TEST_ORIGIN, publishableKey: 'sb_publishable_synthetic_public_configuration_only' });
  const prepared = await oauth.prepare({ redirectBase: GOOGLE_CALLBACK_BASE });
  const redirect = new URL(new URL(prepared.url).searchParams.get('redirect_to'));
  assert.equal(redirect.href.split('#')[0], GOOGLE_CALLBACK_BASE);
  redirect.searchParams.set('code', 'synthetic-code');
  assert.equal(parseCallback(redirect.href, prepared.pending, GOOGLE_CALLBACK_BASE, Date.now()), 'synthetic-code');
  for (const mutate of [
    url => url.searchParams.append('code', 'duplicate'),
    url => url.searchParams.set('next', 'https://evil.test'),
    url => { url.hash = 'correlation=' + '0'.repeat(64); },
    url => { url.hash += '&access_token=synthetic'; },
    url => { url.hostname = 'evil'; },
  ]) {
    const bad = new URL(redirect); mutate(bad);
    assert.throws(() => parseCallback(bad.href, prepared.pending, GOOGLE_CALLBACK_BASE, Date.now()));
  }
});
