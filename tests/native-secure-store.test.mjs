import test from 'node:test';
import assert from 'node:assert/strict';
import { createCredentialVault, createEncryptedDraftStore } from '../mobile/native/secure-store.ts';

const runtime = { isNativePlatform: () => true, getPlatform: () => 'android' };
const key = kind => JSON.stringify(['debtfree-native-test-v1', 'https://synthetic-store.supabase.co/auth/v1', kind]);
const credentials = { accessToken: 'synthetic-access', refreshToken: 'synthetic-refresh', expiresAt: 2000000 };
const pending = { verifier: 'v'.repeat(43), correlation: 'c'.repeat(32), expiresAt: 1000, callbackBase: 'com.debtfree.connectedtest://auth/callback' };
const scope = { backendId: 'debtfree-mobile-test', issuer: 'https://synthetic-store.supabase.co/auth/v1', subject: 'subject-a', identity: 'a@example.test', householdId: 'household-a', role: 'owner' };
const defer = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const tick = () => new Promise(resolve => setImmediate(resolve));

// Abstract protocol fixture only. This models native acknowledgement/denial ordering,
// not encryption, fsync, AndroidKeyStore, OS backups or actual process/power failure.
function fixture() {
  const records = new Map(), denials = new Set(), events = [], writeEntered = defer();
  let tail = Promise.resolve(), failCleanup = false, failBarrier = false, hold = null;
  const serial = task => { const result = tail.then(task); tail = result.catch(() => {}); return result; };
  const bridge = () => ({
    get: ({ id }) => serial(async () => { events.push(['get', id]); return { value: denials.has(id) ? null : records.get(id) ?? null }; }),
    set: ({ id, value }) => serial(async () => { events.push(['set', id]); writeEntered.resolve(); if (hold) await hold.promise; records.set(id, value); denials.delete(id); }),
    remove: ({ id }) => serial(async () => {
      events.push(['remove', id]);
      if (failBarrier) throw { code: 'CANCELLATION_UNCONFIRMED' };
      denials.add(id);
      if (failCleanup) throw { code: 'CLEANUP_FAILED' };
      records.delete(id);
    }),
  });
  return { bridge, records, denials, events, writeEntered: writeEntered.promise, cleanupFails: value => { failCleanup = value; }, barrierFails: value => { failBarrier = value; }, holdWrites: value => { hold = value; } };
}

test('native-only guard rejects web/iOS and preserves safe native failure codes', async () => {
  for (const platform of ['web', 'ios']) {
    let calls = 0;
    const vault = createCredentialVault({ bridge: { get: async () => { calls++; return { value: null }; } }, runtime: { isNativePlatform: () => platform !== 'web', getPlatform: () => platform } });
    await assert.rejects(vault.read(key('credentials')), error => error.code === 'NATIVE_UNAVAILABLE');
    assert.equal(calls, 0); assert.equal(vault.snapshot().locked, true);
  }
  const vault = createCredentialVault({ bridge: { get: async () => { throw { code: 'WRONG_APPLICATION', message: 'synthetic-secret' }; } }, runtime });
  await assert.rejects(vault.read(key('credentials')), error => error.code === 'WRONG_APPLICATION' && !error.message.includes('synthetic-secret'));
});

test('credential writes/read/remove preserve invocation order and wait for native acknowledgement', async () => {
  const f = fixture(), bridge = f.bridge(), vault = createCredentialVault({ bridge, runtime });
  const held = defer(); f.holdWrites(held);
  let saved = false; const writing = vault.write(key('credentials'), credentials).then(() => { saved = true; });
  const reading = vault.read(key('credentials')); const removing = vault.remove(key('credentials'));
  await f.writeEntered;
  assert.equal(saved, false); assert.equal(f.events.length, 1); assert.equal(f.events[0][0], 'set');
  held.resolve(); await writing; assert.deepEqual(await reading, credentials); await removing;
  assert.deepEqual(f.events.map(event => event[0]), ['set', 'get', 'remove']);
  assert.equal(await vault.read(key('credentials')), null);
  assert.deepEqual(vault.snapshot(), { locked: false, failure: null });
  assert(!JSON.stringify(vault.snapshot()).includes('synthetic-access'));
});

test('pending transaction and credential records are distinct and validate their shapes', async () => {
  const f = fixture(), vault = createCredentialVault({ bridge: f.bridge(), runtime });
  await vault.write(key('pending'), pending); await vault.write(key('credentials'), credentials);
  assert.equal(f.records.size, 2); assert([...f.records.keys()].every(id => /^auth\.[a-f0-9]{64}$/.test(id)));
  await vault.remove(key('pending')); assert.equal(await vault.read(key('pending')), null); assert.deepEqual(await vault.read(key('credentials')), credentials);
  await assert.rejects(vault.write(key('pending'), credentials), error => error.code === 'CORRUPT_RECORD');
  assert.equal(vault.snapshot().locked, true);
});

test('draft namespace captures exact issuer/subject/household tuple and cannot read a login record', async () => {
  const f = fixture(), bridge = f.bridge(), input = { ...scope };
  const a = createEncryptedDraftStore(input, { bridge, runtime }); input.householdId = 'mutated-later';
  const b = createEncryptedDraftStore({ ...scope, householdId: 'household-b' }, { bridge, runtime });
  const c = createEncryptedDraftStore({ ...scope, subject: 'subject-b' }, { bridge, runtime });
  const d = createEncryptedDraftStore({ ...scope, issuer: 'https://other-synthetic.supabase.co/auth/v1' }, { bridge, runtime });
  const value = { version: 6, accounts: [{ id: 'fake', balance: 101.25 }], future: { field: true } };
  await a.write('outbox', value); assert.deepEqual(await a.read('outbox'), value);
  for (const other of [b, c, d]) assert.equal(await other.read('outbox'), null);
  assert.equal(await a.read('snapshot'), null);
  const vault = createCredentialVault({ bridge, runtime }); await vault.write(key('credentials'), credentials);
  assert([...f.records.keys()].some(id => id.startsWith('draft.'))); assert([...f.records.keys()].some(id => id.startsWith('auth.')));
  await a.remove('outbox'); assert.equal(await a.read('outbox'), null);
  assert.deepEqual(await vault.read(key('credentials')), credentials);
  assert.throws(() => createEncryptedDraftStore({ ...scope, backendId: 'production' }, { bridge, runtime }));
  assert.throws(() => createEncryptedDraftStore({ ...scope, subject: ' subject-a' }, { bridge, runtime }));
});

test('draft type/size and corrupt envelope failures lock without silently rewriting financial fields', async () => {
  for (const value of [{ field: undefined }, { amount: NaN }, new Date(), Array(2), { [Symbol('not-json')]: 1 }, { get amount() { throw new Error('must not execute getter'); } }, { big: 'x'.repeat(1024 * 1024) }]) {
    const f = fixture(), store = createEncryptedDraftStore(scope, { bridge: f.bridge(), runtime });
    await assert.rejects(store.write('checkpoint', value)); assert.equal(store.snapshot().locked, true); assert.equal(f.records.size, 0);
  }
  const f = fixture(), store = createEncryptedDraftStore(scope, { bridge: f.bridge(), runtime });
  await store.write('snapshot', { amount: 20 }); const id = [...f.records.keys()][0];
  const saved = JSON.parse(f.records.get(id)); saved.namespace = 'other household'; f.records.set(id, JSON.stringify(saved));
  await assert.rejects(store.read('snapshot'), error => error.code === 'CORRUPT_RECORD');
  await assert.rejects(store.write('snapshot', { amount: 21 }), error => error.code === 'STORE_LOCKED');
});

test('cleanup failure after a durable native denial cannot resurrect old pending state in the protocol fixture', async () => {
  const f = fixture(), vault = createCredentialVault({ bridge: f.bridge(), runtime });
  await vault.write(key('pending'), pending); f.cleanupFails(true);
  await assert.rejects(vault.remove(key('pending')), error => error.code === 'CANCELLATION_UNCONFIRMED' && !error.cancellationConfirmed);
  assert.equal(f.records.size, 1); assert.equal(vault.snapshot().locked, true);
  // New JS adapter represents a new process, with the fixture's persisted native denial retained.
  const relaunched = createCredentialVault({ bridge: f.bridge(), runtime }); assert.equal(await relaunched.read(key('pending')), null);
});

test('retry-confirmed cancellation still reports the first cleanup failure honestly', async () => {
  const f = fixture(), base = f.bridge(); let calls = 0;
  const bridge = { ...base, remove: async options => { calls++; if (calls === 1) throw { code: 'STORAGE_FAILURE' }; return base.remove(options); } };
  const vault = createCredentialVault({ bridge, runtime }); await vault.write(key('credentials'), credentials);
  await assert.rejects(vault.remove(key('credentials')), error => error.code === 'CANCELLATION_UNCONFIRMED' && error.cancellationConfirmed);
  assert.equal(vault.snapshot().locked, true); assert.equal(f.records.size, 0);
});

test('unknown persistent cancellation failure never reports cleared and blocks process-local restoration', async () => {
  const f = fixture(), bridge = f.bridge(), vault = createCredentialVault({ bridge, runtime });
  await vault.write(key('credentials'), credentials); f.barrierFails(true);
  await assert.rejects(vault.remove(key('credentials')), error => !error.cancellationConfirmed);
  await assert.rejects(vault.read(key('credentials')), error => error.code === 'STORE_LOCKED');
  assert.equal(f.records.size, 1);
  // This deliberately does NOT claim cold-start safety when neither native denial nor key destruction can persist.
});

test('timeout locks, awaits bounded cleanup and ignores a late write acknowledgement', async () => {
  const f = fixture(), gate = defer(); f.holdWrites(gate);
  const vault = createCredentialVault({ bridge: f.bridge(), runtime, timeoutMs: 20 });
  await assert.rejects(vault.write(key('credentials'), credentials), error => error.code === 'CANCELLATION_UNCONFIRMED' && !error.cancellationConfirmed);
  assert.equal(vault.snapshot().locked, true);
  gate.resolve(); for (let i = 0; i < 10; i++) await tick();
  await assert.rejects(vault.read(key('credentials')), error => error.code === 'STORE_LOCKED');
  const relaunched = createCredentialVault({ bridge: f.bridge(), runtime }); assert.equal(await relaunched.read(key('credentials')), null);
});

test('a timed-out namespace digest cannot dispatch a later credential write after cleanup', async () => {
  const f = fixture(), gate = defer(), original = crypto.subtle.digest;
  let first = true;
  crypto.subtle.digest = async function (...args) { if (first) { first = false; await gate.promise; } return original.apply(this, args); };
  try {
    const vault = createCredentialVault({ bridge: f.bridge(), runtime, timeoutMs: 20 });
    await assert.rejects(vault.write(key('credentials'), credentials));
    gate.resolve(); for (let i = 0; i < 10; i++) await tick();
    assert.equal(f.events.filter(event => event[0] === 'set').length, 0);
    assert.equal(vault.snapshot().locked, true);
  } finally { gate.resolve(); crypto.subtle.digest = original; }
});
