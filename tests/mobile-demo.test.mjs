import assert from 'node:assert/strict';
import test from 'node:test';
import { createDemoFixture } from '../mobile/demo-fixture.ts';
import { createDemoRepository, demoKey, DEMO_INITIALIZED_KEY } from '../mobile/demo-repository.ts';
import { DASHBOARD_STORAGE_KEY, DASHBOARD_BACKUP_STORAGE_KEY } from '../app/data-repository.ts';

function storage() {
  const values = new Map();
  return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
}
test('fixture is validated v6 and deterministic with an explicit baseline and history', () => {
  const fixture = createDemoFixture();
  assert.deepEqual(fixture, createDemoFixture());
  assert.equal(fixture.version, 6);
  assert.equal(fixture.payload.monthlyPlan.progressStartingBalance, 1500);
  assert.equal(fixture.payload.accounts.length, 2);
  assert.equal(fixture.payload.transactions.length, 1);
  assert.equal(fixture.payload.snapshots.length, 1);
});
test('first launch uses only scoped storage; reopening preserves changes and unknown fields', async () => {
  const store = storage();
  store.setItem(DASHBOARD_STORAGE_KEY, 'unrelated state must not be read');
  const repository = await createDemoRepository(store);
  const { contract } = await repository.loadHousehold();
  contract.futureEnvelope = { preserved: true };
  contract.payload.futureField = { nested: [1, 2] };
  contract.payload.accounts[0].name = 'Changed sample';
  await repository.saveHousehold(contract);
  const reopened = await createDemoRepository(store);
  const restored = (await reopened.loadHousehold()).contract;
  assert.equal(restored.payload.accounts[0].name, 'Changed sample');
  assert.deepEqual(restored.futureEnvelope, { preserved: true });
  assert.deepEqual(restored.payload.futureField, { nested: [1, 2] });
  assert.deepEqual(await reopened.importData(await reopened.exportData(restored)), restored);
  assert.equal(store.getItem(DASHBOARD_STORAGE_KEY), 'unrelated state must not be read');
  assert([...store.values.keys()].filter(key => key !== DASHBOARD_STORAGE_KEY).every(key => key.endsWith(':synthetic-mobile-demo-v1')));
});
test('checkpoint recovery and reset do not reseed on next launch', async () => {
  const store = storage();
  const repository = await createDemoRepository(store);
  const original = (await repository.loadHousehold()).contract;
  await repository.checkpoint(original);
  const edited = structuredClone(original);
  edited.payload.accounts[0].name = 'Edited';
  await repository.saveHousehold(edited);
  assert.deepEqual(await repository.loadCheckpoint(), original);
  await repository.saveHousehold(await repository.loadCheckpoint());
  assert.deepEqual((await repository.loadHousehold()).contract, original);
  await repository.resetHousehold();
  assert.equal(store.getItem(DEMO_INITIALIZED_KEY), 'true');
  assert.equal((await (await createDemoRepository(store)).loadHousehold()).contract, null);
});
test('corruption is visible and never overwritten, even when a valid backup exists', async () => {
  const store = storage();
  const repository = await createDemoRepository(store);
  const edited = createDemoFixture();
  edited.payload.accounts[0].name = 'Changed sample';
  await repository.saveHousehold(edited);
  assert.notEqual(store.getItem(demoKey(DASHBOARD_BACKUP_STORAGE_KEY)), null);
  store.setItem(demoKey(DASHBOARD_STORAGE_KEY), '{damaged');
  const before = [...store.values];
  await assert.rejects(createDemoRepository(store), /damaged/);
  assert.deepEqual([...store.values], before);
});
