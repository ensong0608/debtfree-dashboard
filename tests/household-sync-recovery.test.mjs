import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { createHouseholdApi } from '../app/household-api.ts';
import { HouseholdSync } from '../app/household-sync.ts';
import { parseDashboardContract, serializeDashboardBackup } from '../app/dashboard-data.ts';

const householdId = 'synthetic-sync-household';
const owner = 'owner@example.test';
const partner = 'partner@example.test';
const fixture = () => parseDashboardContract(JSON.parse(readFileSync(new URL('fixtures/legacy-v0.json', import.meta.url), 'utf8')));
function storage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
}
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
function setup(t) {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../drizzle/0000_third_baron_zemo.sql', import.meta.url), 'utf8'));
  sqlite.prepare('INSERT INTO households VALUES (?, ?, ?, 0, 0)').run(householdId, 'Synthetic recovery household', owner);
  sqlite.prepare('INSERT INTO household_state VALUES (?, ?, 0, NULL, 0)').run(householdId, serializeDashboardBackup(fixture()));
  for (const [email, role] of [[owner, 'owner'], [partner, 'admin']]) {
    sqlite.prepare("INSERT INTO household_members VALUES (?, ?, NULL, ?, 'active', NULL, 0, 0)").run(email, householdId, role);
  }
  const db = { prepare(sql) {
    let params = [];
    return {
      bind(...values) { params = values; return this; },
      async run() { return { meta: { changes: Number(sqlite.prepare(sql).run(...params).changes) } }; },
      async first() { return sqlite.prepare(sql).get(...params) ?? null; },
    };
  } };
  const requestFor = identity => {
    const api = createHouseholdApi(async () => {
      const member = sqlite.prepare("SELECT household_id, role FROM household_members WHERE email = ? AND status = 'active'").get(identity);
      return member ? { db, member, user: { email: identity } } : null;
    }, async () => sqlite.prepare('SELECT email, role, status FROM household_members WHERE household_id = ?').all(householdId));
    return async (url, init) => init?.method === 'PUT'
      ? api.PUT(new Request(new URL(url, 'http://localhost'), init))
      : api.GET(new Request(new URL(url, 'http://localhost'), init));
  };
  const controllers = [];
  t.after(() => { controllers.forEach(sync => sync.dispose()); sqlite.close(); });
  const controller = (identity, options = {}) => {
    const states = [];
    const store = options.storage ?? storage();
    const key = options.key ?? identity;
    const sync = new HouseholdSync({ storage: store, key, scope: { identity, householdId }, request: options.request ?? requestFor(identity), status: status => states.push(status) });
    controllers.push(sync);
    return { sync, states, store, key };
  };
  const saved = () => {
    const row = sqlite.prepare('SELECT payload, revision FROM household_state WHERE household_id = ?').get(householdId);
    return { revision: row.revision, contract: parseDashboardContract(JSON.parse(row.payload)) };
  };
  return { controller, requestFor, saved };
}

function edit(loaded, amount) {
  const contract = structuredClone(loaded.contract);
  contract.payload.extra = amount;
  return contract;
}

test('partner refresh reads the committed household revision without another save', async t => {
  const env = setup(t);
  const a = env.controller(owner), b = env.controller(partner);
  const initial = await a.sync.load();
  await b.sync.load();
  a.sync.stage(edit(initial, 125));
  assert.equal(a.states.at(-1), 'saving');
  await a.sync.flush();
  assert.equal(a.states.at(-1), 'synced');
  const refreshed = await b.sync.refresh();
  assert.equal(refreshed.contract.payload.extra, 125);
  assert.equal(b.sync.revision, 1);
  assert.equal(env.saved().revision, 1);
});

test('lost save response retries the actual SQLite write once without duplicating history', async t => {
  const env = setup(t);
  const request = env.requestFor(owner);
  let loseResponse = true, writes = 0;
  const a = env.controller(owner, { request: async (url, init) => {
    const response = await request(url, init);
    if (init?.method === 'PUT') {
      writes++;
      if (loseResponse) { loseResponse = false; throw new Error('Synthetic lost acknowledgment'); }
    }
    return response;
  } });
  const initial = await a.sync.load();
  const contract = edit(initial, 500);
  const history = structuredClone(contract.payload.transactions);
  a.sync.stage(contract);
  await a.sync.flush();
  assert.equal(a.states.at(-1), 'error');
  assert.ok(a.sync.pending);
  assert.ok(a.store.getItem(a.key));
  await a.sync.flush();
  assert.equal(writes, 2);
  assert.equal(a.states.at(-1), 'synced');
  assert.equal(a.sync.pending, null);
  assert.equal(env.saved().revision, 1);
  assert.deepEqual(env.saved().contract.payload.transactions, history);
});

test('partner conflict retains the stale draft and never overwrites newer saved history', async t => {
  const env = setup(t);
  const a = env.controller(owner), b = env.controller(partner);
  const [first, second] = await Promise.all([a.sync.load(), b.sync.load()]);
  a.sync.stage(edit(first, 125)); await a.sync.flush();
  b.sync.stage(edit(second, 999)); await b.sync.flush();
  assert.equal(b.states.at(-1), 'conflict');
  assert.equal(b.sync.pending.contract.payload.extra, 999);
  const durable = b.store.getItem(b.key);
  const reopened = env.controller(partner, { storage: b.store, key: b.key });
  assert.equal((await reopened.sync.load()).contract.payload.extra, 999);
  assert.equal(reopened.states.at(-1), 'conflict');
  assert.equal(b.store.getItem(b.key), durable);
  assert.equal(env.saved().revision, 1);
  assert.equal(env.saved().contract.payload.extra, 125);
  assert.deepEqual(env.saved().contract.payload.transactions, first.contract.payload.transactions);
});

test('failed cloud recovery keeps the original outbox until a successful read', async t => {
  const env = setup(t);
  const request = env.requestFor(partner);
  let offline = false;
  const b = env.controller(partner, { request: (url, init) => offline ? Promise.reject(new Error('Synthetic disconnection')) : request(url, init) });
  const a = env.controller(owner);
  const [first, second] = await Promise.all([a.sync.load(), b.sync.load()]);
  a.sync.stage(edit(first, 125)); await a.sync.flush();
  b.sync.stage(edit(second, 999)); await b.sync.flush();
  const durable = b.store.getItem(b.key);
  offline = true;
  await assert.rejects(b.sync.useCloud());
  assert.equal(b.sync.pending.contract.payload.extra, 999);
  assert.equal(b.store.getItem(b.key), durable);
  offline = false;
  const latest = await b.sync.useCloud();
  assert.equal(latest.contract.payload.extra, 125);
  assert.equal(b.sync.pending, null);
  assert.equal(b.store.getItem(b.key), null);
  assert.equal(env.saved().revision, 1);
});

for (const revision of [undefined, -1, 0, 2, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
  test(`malformed save acknowledgment (${String(revision)}) retains durable pending changes`, async t => {
    const env = setup(t);
    const request = env.requestFor(owner);
    const a = env.controller(owner, { request: (url, init) => init?.method === 'PUT' ? Promise.resolve(Response.json({ revision })) : request(url, init) });
    const initial = await a.sync.load();
    a.sync.stage(edit(initial, 123));
    const durable = a.store.getItem(a.key);
    await a.sync.flush();
    assert.equal(a.states.at(-1), 'error');
    assert.equal(a.sync.revision, 0);
    assert.ok(a.sync.pending);
    assert.equal(a.store.getItem(a.key), durable);
    assert.equal(env.saved().revision, 0);
  });
}

test('disposed controller ignores an outstanding save acknowledgment and preserves recovery', async t => {
  const env = setup(t);
  const request = env.requestFor(owner);
  const started = deferred(), release = deferred();
  const a = env.controller(owner, { request: async (url, init) => {
    const response = await request(url, init);
    if (init?.method === 'PUT') { started.resolve(); await release.promise; }
    return response;
  } });
  const loaded = await a.sync.load();
  a.sync.stage(edit(loaded, 150));
  const durable = a.store.getItem(a.key);
  const writing = a.sync.flush();
  await started.promise;
  a.sync.dispose();
  const states = [...a.states];
  a.sync.stage(edit(loaded, 777));
  release.resolve(); await writing;
  assert.deepEqual(a.states, states);
  assert.equal(a.store.getItem(a.key), durable);
  assert.equal(a.sync.pending.contract.payload.extra, 150);
  assert.equal(env.saved().contract.payload.extra, 150);
});

test('disposed controller does not accept a delayed household refresh', async t => {
  const env = setup(t);
  const request = env.requestFor(owner);
  const started = deferred(), release = deferred();
  let hold = false;
  const a = env.controller(owner, { request: async (url, init) => {
    const response = await request(url, init);
    if (hold) { started.resolve(); await release.promise; }
    return response;
  } });
  await a.sync.load(); hold = true;
  const reading = a.sync.refresh();
  await started.promise; a.sync.dispose();
  const states = [...a.states];
  release.resolve();
  assert.equal(await reading, null);
  assert.deepEqual(a.states, states);
});

test('account switch during recovery rejects changed identity and keeps the previous household draft', async t => {
  const env = setup(t);
  let switched = false;
  const a = env.controller(owner, { request: (url, init) => env.requestFor(switched ? partner : owner)(url, init) });
  const loaded = await a.sync.load();
  a.sync.stage(edit(loaded, 250));
  const durable = a.store.getItem(a.key);
  switched = true;
  await assert.rejects(a.sync.useCloud());
  assert.equal(a.states.at(-1), 'unauthorized');
  assert.equal(a.store.getItem(a.key), durable);
  assert.equal(a.sync.pending.contract.payload.extra, 250);
  a.sync.stage(edit(loaded, 999));
  assert.equal(a.store.getItem(a.key), durable);
  assert.equal(env.saved().revision, 0);
});

test('changed household in a background response revokes access without accepting foreign data', async t => {
  const env = setup(t);
  const request = env.requestFor(owner);
  let changed = false;
  const a = env.controller(owner, { request: async (url, init) => {
    const response = await request(url, init);
    if (!changed) return response;
    const foreign = await response.json();
    return Response.json({ ...foreign, householdId: 'unrelated-synthetic-household' });
  } });
  const loaded = await a.sync.load(); changed = true;
  await assert.rejects(a.sync.refresh());
  assert.equal(a.states.at(-1), 'unauthorized');
  a.sync.stage(edit(loaded, 999));
  assert.equal(a.sync.pending, null);
  assert.equal(env.saved().revision, 0);
});
