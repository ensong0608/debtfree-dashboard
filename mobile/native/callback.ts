import type { Pending } from './contracts.ts';
export function validatePending(value: unknown, base: string, now: number): asserts value is Pending {
  const p = value as Pending | null;
  if (!p || p.callbackBase !== base || typeof p.verifier !== 'string' || !/^[A-Za-z0-9._~-]{43,128}$/.test(p.verifier) || typeof p.correlation !== 'string' || !/^[A-Za-z0-9_-]{32,128}$/.test(p.correlation) || !Number.isFinite(p.expiresAt) || p.expiresAt <= now || p.expiresAt > now + 300_000) throw new Error('Missing or expired sign-in transaction.');
}
// Shared warm/cold handler calls this same parser. Session consumes pending before exchange.
export function parseCallback(raw: string, pending: Pending, base: string, now: number): string {
  validatePending(pending, base, now);
  if (typeof raw !== 'string' || raw.length > 8192) throw new Error('Invalid sign-in callback.');
  const url = new URL(raw), expected = new URL(base);
  if (url.protocol !== expected.protocol || url.host !== expected.host || url.pathname !== expected.pathname || url.username || url.password) throw new Error('Invalid sign-in callback.');
  const keys = [...url.searchParams.keys()];
  if (keys.length !== 1 || url.searchParams.getAll('code').length !== 1 || url.hash !== '#correlation=' + pending.correlation) throw new Error('Uncorrelated sign-in callback.');
  const code = url.searchParams.get('code');
  if (!code || !/^[A-Za-z0-9_-]{1,2048}$/.test(code)) throw new Error('Invalid sign-in code.');
  return code;
}
