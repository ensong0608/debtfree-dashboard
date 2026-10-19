import { scopeKey, validateConfig, type TestConfig } from './contracts.ts';
import { parseDashboardContract, serializeDashboardBackup, type DashboardBackup } from '../../app/dashboard-data.ts';
import type { NativeSession } from './session.ts';
const ROUTES: Record<string, readonly string[]> = {
  '/api/native/v1/session': ['GET'], '/api/native/v1/household': ['GET'],
  '/api/native/v1/notifications/ticket': ['POST'],
};
export function createNativeApi(config: TestConfig, session: NativeSession, transport: typeof fetch) {
  const c = validateConfig(config);
  async function send(path: string, init: RequestInit): Promise<Response> {
    const before = session.snapshot();
    if (!before.scope) throw new Error('Session is not verified.');
    const key = scopeKey(before.scope), token = await session.accessToken(); session.assertCurrent(before.generation, key);
    const headers = new Headers(init.headers);
    headers.set('authorization', 'Bearer ' + token); headers.set('x-debtfree-identity', before.scope.identity); headers.set('x-debtfree-household', before.scope.householdId);
    const url = c.apiOrigin + path, controller = new AbortController();
    const abort = () => controller.abort();
    init.signal?.addEventListener('abort', abort, { once: true });
    if (init.signal?.aborted) controller.abort();
    const timer = setTimeout(abort, 15_000);
    try {
      const response = await transport(url, { ...init, headers, credentials: 'omit', cache: 'no-store', redirect: 'error', signal: controller.signal });
      session.assertCurrent(before.generation, key);
      if (response.status === 401 || response.status === 403) { session.rejectAuthorization(before.generation); throw new Error('Server denied session or household access.'); }
      if (response.redirected || response.type === 'opaqueredirect' || response.status >= 300 && response.status < 400 || response.url && response.url !== url) throw new Error('Redirected native response rejected.');
      const reader = response.body?.getReader(), chunks: Uint8Array[] = []; let size = 0;
      try {
        if (reader) while (true) {
          const { done, value } = await reader.read(); if (done) break;
          size += value.byteLength; if (size > 2 * 1024 * 1024) { await reader.cancel(); throw new Error('Household response is too large.'); }
          chunks.push(value);
        }
      } finally { reader?.releaseLock(); }
      session.assertCurrent(before.generation, key);
      const bytes = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      return new Response([204, 205, 304].includes(response.status) ? null : bytes, { status: response.status, statusText: response.statusText, headers: response.headers });
    } finally { clearTimeout(timer); init.signal?.removeEventListener('abort', abort); }
  }
  return {
    async request(path: string, init: RequestInit = {}) {
      const method = init.method ?? 'GET';
      if (!Object.hasOwn(ROUTES, path) || !ROUTES[path].includes(method)) throw new Error('Native route or method not allowed.');
      if (init.credentials && init.credentials !== 'omit' || init.redirect && init.redirect !== 'error' || init.body) throw new Error('Mixed credentials or request overrides rejected.');
      const headers = new Headers(init.headers);
      for (const key of headers.keys()) if (['authorization', 'cookie', 'origin', 'x-debtfree-identity', 'x-debtfree-household'].includes(key) || key.startsWith('proxy-') || key.startsWith('sec-')) throw new Error('Caller authentication or scope override rejected.');
      return send(path, { ...init, method, headers });
    },
    // The serialized value is captured before persistence; request bytes cannot
    // drift from the encrypted outbox while its asynchronous write completes.
    async saveHousehold(contract: DashboardBackup, revision: number, persist: (value: { contract: DashboardBackup; revision: number }) => Promise<void>) {
      const before = session.snapshot();
      if (!before.scope || before.scope.role === 'viewer' || !Number.isSafeInteger(revision) || revision < 0) throw new Error('Household is read-only.');
      const stable = parseDashboardContract(JSON.parse(serializeDashboardBackup(contract)));
      const body = JSON.stringify({ payload: stable, revision });
      await persist({ contract: stable, revision });
      session.assertCurrent(before.generation, scopeKey(before.scope));
      return send('/api/native/v1/household', { method: 'PUT', headers: { 'content-type': 'application/json' }, body });
    },
  };
}
