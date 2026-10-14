import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { createHouseholdApi } from '../app/household-api.ts';
import { createHouseholdExport } from '../app/household-export.ts';
import { parseDashboardContract } from '../app/dashboard-data.ts';
import { householdSessionHeaders } from '../app/household-session-scope.ts';

const scopes = {
  a: { identity: 'a@example.test', householdId: 'a' },
  b: { identity: 'b@example.test', householdId: 'b' },
};
function contract(name) {
  const value = parseDashboardContract(JSON.parse(readFileSync(new URL('fixtures/legacy-v0.json', import.meta.url), 'utf8')));
  value.payload.accounts[0].name = name;
  return value;
}
function request(method, scope, payload, revision = 0) {
  const headers = new Headers(scope ? householdSessionHeaders(scope) : undefined);
  if (payload) headers.set('content-type', 'application/json');
  return new Request('http://localhost/api/household?household_id=a', {
    method, headers,
    ...(payload ? { body: JSON.stringify({ payload, revision, household_id: 'a' }) } : {}),
  });
}
function setup() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../drizzle/0000_third_baron_zemo.sql', import.meta.url), 'utf8'));
  for (const id of ['a', 'b']) {
    sqlite.prepare('INSERT INTO households VALUES (?, ?, ?, 0, 0)').run(id, 'Synthetic ' + id, scopes[id].identity);
    sqlite.prepare('INSERT INTO household_state VALUES (?, NULL, 0, NULL, 0)').run(id);
    sqlite.prepare("INSERT INTO household_members VALUES (?, ?, NULL, 'owner', 'active', NULL, 0, 0)").run(scopes[id].identity, id);
  }
  const db = { prepare(sql) {
    let params = [];
    return {
      bind(...values) { params = values; return this; },
      async run() { return { meta: { changes: Number(sqlite.prepare(sql).run(...params).changes) } }; },
      async first() { return sqlite.prepare(sql).get(...params) ?? null; },
    };
  } };
  let email = scopes.a.identity;
  const context = async () => {
    const member = sqlite.prepare("SELECT household_id, role FROM household_members WHERE email = ? AND status = 'active'").get(email);
    return member ? { db, member, user: { email } } : null;
  };
  return {
    sqlite, api: createHouseholdApi(context, async () => []), exportSaved: createHouseholdExport(context),
    switchTo(identity) { email = identity; },
    state(id) { return sqlite.prepare('SELECT payload, revision FROM household_state WHERE household_id = ?').get(id); },
  };
}
async function expectError(response, status, code) {
  assert.equal(response.status, status);
  assert.equal((await response.json()).code, code);
}

test('an open household A page cannot read, export or overwrite household B after account switching', async () => {
  const env = setup();
  try {
    const originalA = contract('Synthetic A account');
    const originalB = contract('Synthetic B account');
    assert.equal((await env.api.PUT(request('PUT', scopes.a, originalA))).status, 200);
    env.switchTo(scopes.b.identity);
    assert.equal((await env.api.PUT(request('PUT', scopes.b, originalB))).status, 200);
    assert.equal(env.state('a').revision, 1);
    assert.equal(env.state('b').revision, 1);
    const beforeA = env.state('a');
    const beforeB = env.state('b');

    await expectError(await env.api.GET(request('GET', scopes.a)), 403, 'session_changed');
    await expectError(await env.exportSaved(request('GET', scopes.a)), 403, 'session_changed');
    await expectError(await env.api.PUT(request('PUT', scopes.a, contract('Stale A draft'), 1)), 403, 'session_changed');
    assert.deepEqual(env.state('a'), beforeA);
    assert.deepEqual(env.state('b'), beforeB);

    const current = await env.api.GET(request('GET', scopes.b));
    assert.equal(current.status, 200);
    assert.equal((await current.json()).payload.payload.accounts[0].name, 'Synthetic B account');
    const exported = await env.exportSaved(request('GET', scopes.b));
    assert.equal(exported.status, 200);
    assert.equal(JSON.parse(await exported.text()).payload.accounts[0].name, 'Synthetic B account');
    assert.equal((await env.api.PUT(request('PUT', scopes.b, contract('B updated safely'), 1))).status, 200);
    assert.equal(env.state('b').revision, 2);
    assert.deepEqual(env.state('a'), beforeA);
  } finally { env.sqlite.close(); }
});

test('client scope is only a guard and cannot authorize choosing another household or identity', async () => {
  const env = setup();
  try {
    env.switchTo(scopes.b.identity);
    for (const forged of [scopes.a, { identity: scopes.b.identity, householdId: 'a' }, { identity: scopes.a.identity, householdId: 'b' }]) {
      await expectError(await env.api.GET(request('GET', forged)), 403, 'session_changed');
      await expectError(await env.api.PUT(request('PUT', forged, contract('Forged draft'))), 403, 'session_changed');
      await expectError(await env.exportSaved(request('GET', forged)), 403, 'session_changed');
    }
    assert.equal(env.state('a').payload, null);
    assert.equal(env.state('b').payload, null);
    assert.equal(env.state('b').revision, 0);
  } finally { env.sqlite.close(); }
});

test('a write without the page session scope cannot mutate household data', async () => {
  const env = setup();
  try {
    await expectError(await env.api.PUT(request('PUT', null, contract('Unbound draft'))), 409, 'session_required');
    assert.equal(env.state('a').payload, null);
    assert.equal(env.state('a').revision, 0);
  } finally { env.sqlite.close(); }
});

test('changing account within the same household also invalidates the old page scope', async () => {
  const env = setup();
  try {
    env.sqlite.prepare("INSERT INTO household_members VALUES (?, 'a', NULL, 'admin', 'active', NULL, 0, 0)").run('partner@example.test');
    env.switchTo('partner@example.test');
    await expectError(await env.api.PUT(request('PUT', scopes.a, contract('Old owner draft'))), 403, 'session_changed');
    const partner = { identity: 'partner@example.test', householdId: 'a' };
    assert.equal((await env.api.PUT(request('PUT', partner, contract('Partner draft')))).status, 200);
    assert.equal(env.state('a').revision, 1);
    assert.equal(env.state('b').payload, null);
  } finally { env.sqlite.close(); }
});
