import { createDashboardBackup, createDashboardPayload, createEmptyPlannedPayoff, parseDashboardContract, parseDashboardJson, serializeDashboardBackup, type DashboardBackup } from '../../app/dashboard-data.ts';
import type { DataRepository } from '../../app/data-repository.ts';
import { scopeKey } from './contracts.ts';
import { createEncryptedDraftStore, type SecureStoreOptions } from './secure-store.ts';
import type { ConnectedRuntime } from './runtime.ts';

type State = 'loading' | 'synced' | 'saving' | 'offline' | 'conflict' | 'recovery' | 'locked' | 'error';
type RecordValue = { version: 1; revision: number; contract: DashboardBackup; queuedAfterPending?: true };
type View = { status: State; role: 'owner' | 'admin' | 'viewer'; householdName: string; pending: boolean };
const fingerprint = (value: DashboardBackup) => JSON.stringify(value.payload);
function record(value: unknown): RecordValue {
  const entry = value as RecordValue;
  if (!entry || entry.version !== 1 || !Number.isSafeInteger(entry.revision) || entry.revision < 0) throw new Error('Saved household draft needs recovery.');
  return { version: 1, revision: entry.revision, contract: parseDashboardContract(entry.contract), ...(entry.queuedAfterPending === true ? { queuedAfterPending: true as const } : {}) };
}
function empty() {
  return createDashboardBackup(createDashboardPayload(null, { accounts: [], monthlyBudgets: {}, payees: [], transactions: [], snapshots: [], extra: 0, strategy: 'avalanche', planning: createEmptyPlannedPayoff(), balanceAdjustments: [], monthlyPlan: { detailedSpendingTracking: false, months: {} }, customDebtOrder: [] }));
}

/** Entire financial persistence path is awaited native encryption. No Storage shim,
 * browser cache adoption, automatic draft replay or last-write-wins fallback. */
export function createConnectedRepository(runtime: ConnectedRuntime, changed: (view: View) => void, storeOptions: SecureStoreOptions = {}) {
  const before = runtime.session.snapshot(); if (!before.scope) throw new Error('Session required.');
  const scope = { ...before.scope }, key = scopeKey(scope), store = createEncryptedDraftStore(scope, storeOptions);
  let editGeneration = 0;
  let closed = false, tail: Promise<unknown> = Promise.resolve(), revision = 0;
  let current: DashboardBackup | null = null, pending: RecordValue | null = null, accepted = '';
  let view: View = { status: 'loading', role: scope.role, householdName: 'Test household', pending: false };
  function assert() { if (closed) throw new Error('Household closed.'); runtime.session.assertCurrent(before.generation, key); }
  function status(value: State) { view = { ...view, status: value, pending: pending !== null }; if (!closed) changed({ ...view }); }
  function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = tail.then(async () => { assert(); return operation(); });
    tail = result.catch(() => undefined); return result;
  }
  async function remote() {
    assert(); const response = await runtime.api.request('/api/native/v1/household'); assert();
    if (!response.ok) throw new Error('Shared household unavailable.');
    const data = await response.json() as Record<string, unknown> | null; assert();
    if (!data || data.identity !== scope.identity || data.householdId !== scope.householdId || (typeof data.role !== 'string' || !['owner', 'admin', 'viewer'].includes(data.role)) || (typeof data.revision !== 'number' || !Number.isSafeInteger(data.revision) || data.revision < 0) || typeof data.householdName !== 'string') throw new Error('Household scope rejected.');
    view = { ...view, role: data.role as View['role'], householdName: data.householdName };
    return { revision: data.revision as number, contract: data.payload === null ? empty() : parseDashboardContract(data.payload) };
  }
  async function snapshot(contract: DashboardBackup, value: number) {
    assert(); await store.write('snapshot', { version: 1, revision: value, contract: JSON.parse(serializeDashboardBackup(contract)) }); assert();
  }
  async function persist(value: { contract: DashboardBackup; revision: number }) {
    assert(); const draft: RecordValue = { version: 1, ...value };
    await store.write('outbox', draft); assert(); pending = draft; current = draft.contract;
  }
  async function flush() {
    if (!pending) return;
    assert(); if (view.role === 'viewer') { status('conflict'); throw new Error('Viewer cannot save changes.'); }
    if (!navigator.onLine) { status('offline'); throw new Error('Reconnect to save retained changes.'); }
    status('saving');
    const sent = pending;
    try {
      const response = await runtime.api.saveHousehold(sent.contract, sent.revision, persist); assert();
      if (response.status === 409) { status('conflict'); throw new Error('Another phone changed this household.'); }
      if (!response.ok) throw new Error('Household save unavailable.');
      const result = await response.json() as { revision?: unknown } | null; assert();
      const acknowledgedRevision = sent.revision + 1;
      if (!result || result.revision !== acknowledgedRevision) throw new Error('Save acknowledgement rejected.');
      await snapshot(sent.contract, acknowledgedRevision);
      await store.remove('outbox'); assert();
      revision = acknowledgedRevision; accepted = fingerprint(sent.contract); current = sent.contract; pending = null; status('synced');
    } catch {
      if (view.status !== 'conflict') status(store.snapshot().locked || runtime.session.snapshot().state === 'locked' ? 'locked' : 'error');
      throw new Error('Changes are retained. Reconnect or review the latest household.');
    }
  }
  const repository: DataRepository = {
    async loadHousehold() { assert(); return { contract: current, recoveredFromBackup: false }; },
    saveHousehold(contract) {
      // Capture now: later React updates cannot alter the durable operation.
      const stable = parseDashboardJson(serializeDashboardBackup(contract)); editGeneration++;
      return enqueue(async () => {
        if (!current || view.role === 'viewer' || view.status === 'locked') throw new Error('Household is read-only.');
        if (!pending && fingerprint(stable) === accepted) return;
        // Once delivery is uncertain, freeze the existing revision/body for safe retry.
        if (pending) {
          if (fingerprint(stable) === fingerprint(pending.contract)) return;
          await store.write('checkpoint', { version: 1, revision: pending.revision, contract: JSON.parse(serializeDashboardBackup(stable)), queuedAfterPending: true }); assert();
          current = stable;
          throw new Error('Later edits are retained in the encrypted recovery checkpoint. Resolve the pending save first.');
        }
        if (['conflict', 'recovery'].includes(view.status)) throw new Error('Resolve saved changes first.');
        try { status('saving'); await persist({ contract: stable, revision }); await flush(); }
        catch { if (store.snapshot().locked) status('locked'); else if (view.status === 'saving') status('error'); throw new Error('Changes could not be confirmed.'); }
      });
    },
    async exportData(contract) { assert(); return serializeDashboardBackup(contract, true); },
    async importData() { throw new Error('Import into the connected test is disabled. Device-only records stay separate.'); },
    async resetHousehold() { throw new Error('Connected reset is disabled.'); },
    checkpoint(contract) { return enqueue(async () => { await store.write('checkpoint', { version: 1, revision, contract: parseDashboardContract(contract) }); assert(); }); },
    loadCheckpoint() { return enqueue(async () => { const value = await store.read('checkpoint'); assert(); return value === null ? null : record(value).contract; }); },
  };
  return {
    repository, snapshot: () => ({ ...view }),
    initialize: () => enqueue(async () => {
      try {
        // Validate all same-scope records before allowing financial editing.
        const saved = await store.read('snapshot'); if (saved !== null) record(saved);
        const draft = await store.read('outbox'); if (draft !== null) pending = record(draft);
        const checkpoint = await store.read('checkpoint'); if (checkpoint !== null) record(checkpoint);
        const latest = await remote(); assert(); revision = latest.revision; accepted = fingerprint(latest.contract); current = latest.contract;
        if (pending) { status('recovery'); return; }
        await snapshot(current, revision); status('synced');
      } catch { status(store.snapshot().locked ? 'locked' : 'error'); throw new Error('Could not open the test household. Existing records were kept.'); }
    }),
    retry: () => enqueue(async () => {
      const latest = await remote(); assert();
      if (!pending) { revision = latest.revision; accepted = fingerprint(latest.contract); current = latest.contract; await snapshot(current, revision); status('synced'); return; }
      // A lost acknowledgement is settled without a second mutation.
      if (latest.revision === pending.revision + 1 && fingerprint(latest.contract) === fingerprint(pending.contract)) {
        await snapshot(latest.contract, latest.revision); await store.remove('outbox'); assert();
        current = latest.contract; revision = latest.revision; accepted = fingerprint(current); pending = null; status('synced'); return;
      }
      if (latest.revision !== pending.revision || view.role === 'viewer') { status('conflict'); return; }
      current = pending.contract; await flush();
    }),
    useLatest: () => enqueue(async () => {
      const latest = await remote(); assert();
      if (pending) {
        const previous = await store.read('checkpoint'); assert();
        const newer = previous === null ? null : record(previous);
        if (!newer?.queuedAfterPending || newer.revision !== pending.revision) await store.write('checkpoint', pending);
        assert();
      }
      await snapshot(latest.contract, latest.revision);
      await store.remove('outbox'); assert();
      current = latest.contract; revision = latest.revision; accepted = fingerprint(current); pending = null; status('synced');
    }),
    refresh: (canApply: () => boolean) => enqueue(async () => {
      if (pending || view.status !== 'synced' || !canApply()) return false;
      const generation = editGeneration;
      const latest = await remote(); assert();
      if (generation !== editGeneration || !canApply()) return false;
      if (latest.revision === revision) { status('synced'); return false; }
      await snapshot(latest.contract, latest.revision);
      if (generation !== editGeneration || !canApply()) return false;
      current = latest.contract; revision = latest.revision; accepted = fingerprint(current); status('synced'); return true;
    }),
    // Stop new work immediately; already-started native writes are awaited before logout.
    async close() { closed = true; await tail; current = null; pending = null; },
  };
}
export type ConnectedRepository = ReturnType<typeof createConnectedRepository>;
