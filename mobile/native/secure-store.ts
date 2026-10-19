import { Capacitor, registerPlugin } from '@capacitor/core';
import { scopeKey, validCredentials, type CredentialVault, type Credentials, type Pending, type VerifiedScope } from './contracts.ts';

export interface ConnectedSecureStoreBridge {
  get(options: { id: string }): Promise<{ value: string | null }>;
  set(options: { id: string; value: string }): Promise<void>;
  remove(options: { id: string }): Promise<void>;
}
const nativeBridge = registerPlugin<ConnectedSecureStoreBridge>('ConnectedSecureStore');
export type SecureStoreOptions = {
  bridge?: ConnectedSecureStoreBridge;
  runtime?: { isNativePlatform(): boolean; getPlatform(): string };
  timeoutMs?: number;
};
const allowedCodes = new Set(['WRONG_APPLICATION', 'INVALID_IDENTIFIER', 'INVALID_VALUE', 'DEVICE_LOCKED', 'DEVICE_NOT_SECURED', 'STORE_LOCKED', 'STORE_CLOSED', 'STORE_CAPACITY', 'KEY_UNAVAILABLE', 'KEY_INVALIDATED', 'CORRUPT_RECORD', 'CRYPTO_FAILURE', 'STORAGE_FAILURE', 'CLEANUP_FAILED', 'CANCELLATION_KEY_INVALIDATED', 'CANCELLATION_UNCONFIRMED', 'TIMEOUT', 'NATIVE_UNAVAILABLE']);
export class SecureStoreError extends Error {
  readonly code: string;
  readonly cancellationConfirmed: boolean;
  constructor(code: string, cancellationConfirmed = false) { super('Secure persistence is locked.'); this.name = 'SecureStoreError'; this.code = code; this.cancellationConfirmed = cancellationConfirmed; }
}
type Lane = { tail: Promise<unknown>; locked: boolean; failure: string | null };
// Coordinates adapters sharing the same native bridge; never contains records/tokens.
const lanes = new WeakMap<ConnectedSecureStoreBridge, Lane>();
function safeError(error: unknown): SecureStoreError {
  if (error instanceof SecureStoreError && allowedCodes.has(error.code)) return new SecureStoreError(error.code, error.cancellationConfirmed);
  const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
  return new SecureStoreError(typeof code === 'string' && allowedCodes.has(code) ? code : 'STORAGE_FAILURE');
}
function deadline<T>(promise: Promise<T>, timeout: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new SecureStoreError('TIMEOUT')), timeout);
    promise.then(value => { clearTimeout(timer); resolve(value); }, () => { clearTimeout(timer); reject(new SecureStoreError('STORAGE_FAILURE')); });
  });
}
function transport(options: SecureStoreOptions) {
  const bridge = options.bridge ?? nativeBridge, runtime = options.runtime ?? Capacitor;
  const timeout = options.timeoutMs ?? 5000;
  if (!Number.isInteger(timeout) || timeout < 20 || timeout > 30000) throw new SecureStoreError('INVALID_VALUE');
  let lane = lanes.get(bridge);
  if (!lane) { lane = { tail: Promise.resolve(), locked: false, failure: null }; lanes.set(bridge, lane); }
  const state = lane;
  const fail = (error: unknown): never => { const failure = safeError(error); state.locked = true; state.failure = failure.code; throw failure; };
  const run = <T>(operation: (assertActive: () => void) => Promise<T>, cleanup = false): Promise<T> => {
    const next = state.tail.then(async () => {
      try {
        if (state.locked && !cleanup) throw new SecureStoreError('STORE_LOCKED');
        if (!runtime.isNativePlatform() || runtime.getPlatform() !== 'android') throw new SecureStoreError('NATIVE_UNAVAILABLE');
        // Native code additionally enforces the exact connected-test application ID.
        const result = await new Promise<T>((resolve, reject) => {
          let active = true;
          const timer = setTimeout(() => { active = false; reject(new SecureStoreError('TIMEOUT')); }, timeout);
          const assertActive = () => { if (!active || state.locked && !cleanup) throw new SecureStoreError('STORE_LOCKED'); };
          Promise.resolve().then(() => operation(assertActive)).then(value => { active = false; clearTimeout(timer); resolve(value); }, error => { active = false; clearTimeout(timer); reject(safeError(error)); });
        });
        return result;
      } catch (error) { return fail(error); }
    });
    state.tail = next.then(() => undefined, () => undefined); return next;
  };
  const id = async (prefix: 'auth' | 'draft', namespace: string) => {
    try {
      if (!globalThis.crypto?.subtle) throw new SecureStoreError('CRYPTO_FAILURE');
      const bytes = await deadline(crypto.subtle.digest('SHA-256', new TextEncoder().encode(namespace)), timeout);
      return prefix + '.' + [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('');
    } catch (error) { return fail(error); }
  };
  const remove = async (recordId: () => Promise<string>) => {
    const erase = async (assertActive: () => void) => { const id = await recordId(); assertActive(); return bridge.remove({ id }); };
    try { await run(erase, true); }
    catch {
      // Still locked even when this bounded retry confirms durable cancellation.
      let confirmed = false;
      try { await run(erase, true); confirmed = true; } catch { /* unknown durability, no safe success */ }
      throw new SecureStoreError('CANCELLATION_UNCONFIRMED', confirmed);
    }
  };
  return { bridge, run, id, fail, remove, snapshot: () => ({ locked: state.locked, failure: state.failure }), lock: () => { state.locked = true; state.failure = 'STORE_LOCKED'; } };
}
function issuer(value: unknown): value is string { return typeof value === 'string' && /^https:\/\/[a-z0-9-]+\.supabase\.co\/auth\/v1$/.test(value); }
function loginKey(key: string): 'credentials' | 'pending' {
  if (typeof key !== 'string' || key.length > 2048) throw new SecureStoreError('INVALID_IDENTIFIER');
  let tuple: unknown;
  try { tuple = JSON.parse(key); } catch { throw new SecureStoreError('INVALID_IDENTIFIER'); }
  if (!Array.isArray(tuple) || tuple.length !== 3 || tuple[0] !== 'debtfree-native-test-v1' || !issuer(tuple[1]) || !['credentials', 'pending'].includes(tuple[2]) || JSON.stringify(tuple) !== key) throw new SecureStoreError('INVALID_IDENTIFIER');
  return tuple[2];
}
function credentialValue(kind: string, value: unknown): Credentials | Pending {
  if (kind === 'credentials' && validCredentials(value)) return { accessToken: value.accessToken, refreshToken: value.refreshToken, expiresAt: value.expiresAt };
  const p = value as Pending | null;
  if (kind === 'pending' && p && typeof p.verifier === 'string' && /^[A-Za-z0-9._~-]{43,128}$/.test(p.verifier) && typeof p.correlation === 'string' && /^[A-Za-z0-9_-]{32,128}$/.test(p.correlation) && Number.isFinite(p.expiresAt) && p.callbackBase === 'com.debtfree.connectedtest://auth/callback') return { verifier: p.verifier, correlation: p.correlation, expiresAt: p.expiresAt, callbackBase: p.callbackBase };
  throw new SecureStoreError('CORRUPT_RECORD');
}
function parse(raw: string, limit: number): Record<string, unknown> {
  if (typeof raw !== 'string' || new TextEncoder().encode(raw).length > limit) throw new SecureStoreError('CORRUPT_RECORD');
  const result: unknown = JSON.parse(raw);
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw new SecureStoreError('CORRUPT_RECORD');
  return result as Record<string, unknown>;
}
export function createCredentialVault(options: SecureStoreOptions = {}): CredentialVault & { snapshot(): { locked: boolean; failure: string | null } } {
  const store = transport(options);
  return {
    snapshot: store.snapshot,
    async read(key) {
      try {
        const kind = loginKey(key);
        const result = await store.run(async assertActive => { const id = await store.id('auth', JSON.stringify(['login-v1', key])); assertActive(); return store.bridge.get({ id }); });
        if (result.value === null) return null;
        const envelope = parse(result.value, 65536);
        if (envelope.version !== 1 || envelope.key !== key) throw new SecureStoreError('CORRUPT_RECORD');
        return credentialValue(kind, envelope.value);
      } catch (error) { return store.fail(error); }
    },
    async write(key, value) {
      let serialized: string;
      try {
        serialized = JSON.stringify({ version: 1, key, value: credentialValue(loginKey(key), value) });
        if (new TextEncoder().encode(serialized).length > 65536) throw new SecureStoreError('INVALID_VALUE');
      } catch (error) { return store.fail(error); }
      const id = () => store.id('auth', JSON.stringify(['login-v1', key]));
      try { await store.run(async assertActive => { const recordId = await id(); assertActive(); return store.bridge.set({ id: recordId, value: serialized }); }); }
      catch {
        // Await cancellation after an uncertain/late write; do not claim clear if the bridge cannot confirm it.
        await store.remove(id);
        throw new SecureStoreError('STORAGE_FAILURE', true);
      }
    },
    async remove(key) { try { loginKey(key); await store.remove(() => store.id('auth', JSON.stringify(['login-v1', key]))); } catch (error) { return store.fail(error); } },
  };
}

export type DraftRecord = 'snapshot' | 'outbox' | 'checkpoint';
function draftKind(value: string): asserts value is DraftRecord { if (!['snapshot', 'outbox', 'checkpoint'].includes(value)) throw new SecureStoreError('INVALID_IDENTIFIER'); }
function strictJSON(value: unknown, active = new Set<object>(), depth = 0, budget = { nodes: 0, characters: 0 }): void {
  if (depth > 100 || ++budget.nodes > 100000) throw new SecureStoreError('INVALID_VALUE');
  if (typeof value === 'string') { budget.characters += value.length; if (budget.characters > 1024 * 1024) throw new SecureStoreError('INVALID_VALUE'); return; }
  if (value === null || typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value)) return;
  if (typeof value !== 'object' || active.has(value) || !Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) throw new SecureStoreError('INVALID_VALUE');
  const keys = Object.getOwnPropertyNames(value).filter(key => !Array.isArray(value) || key !== 'length');
  if (Object.getOwnPropertySymbols(value).length || keys.length > 100000 || Array.isArray(value) && (value.length > 100000 || keys.length !== value.length)) throw new SecureStoreError('INVALID_VALUE');
  active.add(value);
  for (const key of keys) {
    budget.characters += key.length;
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    if (budget.characters > 1024 * 1024 || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value') || Array.isArray(value) && !/^(0|[1-9][0-9]*)$/.test(key)) throw new SecureStoreError('INVALID_VALUE');
    strictJSON(descriptor.value, active, depth + 1, budget);
  }
  active.delete(value);
}
export function createEncryptedDraftStore(scope: VerifiedScope, options: SecureStoreOptions = {}) {
  if (scope.backendId !== 'debtfree-mobile-test' || !issuer(scope.issuer) || [scope.subject, scope.householdId].some(value => typeof value !== 'string' || !value.trim() || value !== value.trim() || value.length > 512)) throw new SecureStoreError('INVALID_IDENTIFIER');
  // Capture the exact verified tuple, never the mutable scope object or a browser cache key.
  const namespace = scopeKey(scope), store = transport(options);
  const recordId = (kind: DraftRecord) => { draftKind(kind); return store.id('draft', JSON.stringify(['financial-v1', namespace, kind])); };
  return {
    snapshot: store.snapshot, lock: store.lock,
    async read(kind: DraftRecord): Promise<unknown | null> {
      try {
        const result = await store.run(async assertActive => { const id = await recordId(kind); assertActive(); return store.bridge.get({ id }); });
        if (result.value === null) return null;
        const envelope = parse(result.value, 1024 * 1024);
        if (envelope.version !== 1 || envelope.namespace !== namespace || envelope.kind !== kind || !Object.hasOwn(envelope, 'value')) throw new SecureStoreError('CORRUPT_RECORD');
        strictJSON(envelope.value); return envelope.value;
      } catch (error) { return store.fail(error); }
    },
    async write(kind: DraftRecord, value: unknown) {
      try {
        strictJSON(value);
        const serialized = JSON.stringify({ version: 1, namespace, kind, value });
        if (new TextEncoder().encode(serialized).length > 1024 * 1024) throw new SecureStoreError('INVALID_VALUE');
        await store.run(async assertActive => { const id = await recordId(kind); assertActive(); return store.bridge.set({ id, value: serialized }); });
      } catch (error) { return store.fail(error); }
    },
    async remove(kind: DraftRecord) { try { await store.remove(() => recordId(kind)); } catch (error) { return store.fail(error); } },
  };
}
