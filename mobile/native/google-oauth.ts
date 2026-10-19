import { SignInFailure } from './contracts.ts';
import type { Credentials, OAuthProvider, Pending } from './contracts.ts';

export const GOOGLE_TEST_ORIGIN = 'https://otggeztwtaklsqwtztgz.supabase.co';
export const GOOGLE_CALLBACK_BASE = 'com.debtfree.connectedtest://auth/callback';
export type GoogleOAuthConfig = { supabaseUrl: string; publishableKey: string };
type Options = { fetch?: typeof fetch; crypto?: Crypto; now?: () => number; timeoutMs?: number };
const failure = () => new Error('Google sign-in transport failed.');
const maxBytes = 65_536;
function safeUrl(raw: string): URL { try { return new URL(raw); } catch { throw failure(); } }
function base64url(bytes: Uint8Array) { return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function token(value: unknown, access = false): value is string {
  return typeof value === 'string' && value.length >= 8 && value.length <= (access ? 16_384 : 4096) && (access ? /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/ : /^[A-Za-z0-9._~-]+$/).test(value);
}
/** This validates a transport destination, not provider identity or session readiness. */
export function validateGoogleLaunch(raw: string, pending?: Pending): URL {
  if (typeof raw !== 'string' || raw.length > 8192) throw failure();
  const url = safeUrl(raw);
  const allowed = ['provider', 'redirect_to', 'code_challenge', 'code_challenge_method', 'prompt'];
  if (url.origin !== GOOGLE_TEST_ORIGIN || url.pathname !== '/auth/v1/authorize' || url.username || url.password || url.hash || url.searchParams.size !== allowed.length || allowed.some(key => url.searchParams.getAll(key).length !== 1) || url.searchParams.get('provider') !== 'google' || url.searchParams.get('code_challenge_method') !== 's256' || url.searchParams.get('prompt') !== 'select_account' || !/^[A-Za-z0-9_-]{43}$/.test(url.searchParams.get('code_challenge') ?? '')) throw failure();
  const redirect = safeUrl(url.searchParams.get('redirect_to')!);
  if (redirect.origin !== new URL(GOOGLE_CALLBACK_BASE).origin || redirect.protocol !== 'com.debtfree.connectedtest:' || redirect.host !== 'auth' || redirect.pathname !== '/callback' || redirect.username || redirect.password || redirect.search || !/^#correlation=[a-f0-9]{64}$/.test(redirect.hash) || (pending && (pending.callbackBase !== GOOGLE_CALLBACK_BASE || redirect.hash !== '#correlation=' + pending.correlation))) throw failure();
  return url;
}

export function createGoogleOAuth(config: GoogleOAuthConfig, options: Options = {}): OAuthProvider {
  if (config.supabaseUrl !== GOOGLE_TEST_ORIGIN || !/^sb_publishable_[A-Za-z0-9_-]{16,512}$/.test(config.publishableKey)) throw new Error('Explicit connected-test public configuration required.');
  const publicKey = config.publishableKey, transport = options.fetch ?? globalThis.fetch;
  const crypto = options.crypto ?? globalThis.crypto, now = options.now ?? Date.now;
  const timeoutMs = options.timeoutMs ?? 15_000;
  if (!crypto?.subtle || !Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 30_000) throw failure();
  async function request(path: string, body: object | undefined, accessToken?: string): Promise<unknown> {
    const destination = GOOGLE_TEST_ORIGIN + '/auth/v1/' + path;
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout> | undefined;
    let phase: 'google-network' | 'google-response' | 'google-format' = 'google-network';
    const operation = async () => {
      const response = await transport(destination, { method: 'POST', headers: { apikey: publicKey, ...(body ? { 'Content-Type': 'application/json' } : {}), ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), credentials: 'omit', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer', signal: controller.signal });
      phase = 'google-response';
      if (response.redirected || (response.url && response.url !== destination) || !response.ok) { void response.body?.cancel().catch(() => undefined); throw failure(); }
      if (!body) { void response.body?.cancel().catch(() => undefined); return null; }
      phase = 'google-format';
      if (!/^application\/json(?:;|$)/i.test(response.headers.get('content-type') ?? '')) throw failure();
      const length = response.headers.get('content-length');
      if (length && (!/^\d+$/.test(length) || Number(length) > maxBytes)) throw failure();
      if (!response.body) throw failure();
      const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let total = 0;
      try { while (true) { const { done, value } = await reader.read(); if (done) break; total += value.byteLength; if (total > maxBytes) { void reader.cancel().catch(() => undefined); throw failure(); } chunks.push(value); } } finally { reader.releaseLock(); }
      const bytes = new Uint8Array(total); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    };
    try { return await Promise.race([operation(), new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(failure()); }, timeoutMs); })]); }
    catch { controller.abort(); throw new SignInFailure(phase); } finally { clearTimeout(timer); }
  }
  function credentials(value: unknown, started: number): Credentials {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw failure();
    const data = value as Record<string, unknown>;
    if (!token(data.access_token, true) || !token(data.refresh_token) || data.token_type !== 'bearer' || !Number.isSafeInteger(data.expires_in) || (data.expires_in as number) < 1 || (data.expires_in as number) > 86_400) throw new SignInFailure('google-format');
    let expiresAt = started + (data.expires_in as number) * 1000;
    if (data.expires_at !== undefined) { if (!Number.isSafeInteger(data.expires_at) || (data.expires_at as number) <= 0) throw failure(); expiresAt = Math.min(expiresAt, (data.expires_at as number) * 1000); }
    if (!Number.isFinite(expiresAt) || expiresAt <= now()) throw new SignInFailure('google-expiry');
    return { accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt };
  }
  return {
    async prepare({ redirectBase }) {
      if (redirectBase !== GOOGLE_CALLBACK_BASE) throw failure();
      const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
      const correlation = [...crypto.getRandomValues(new Uint8Array(32))].map(byte => byte.toString(16).padStart(2, '0')).join('');
      const challenge = base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
      const pending = { verifier, correlation, expiresAt: now() + 300_000, callbackBase: GOOGLE_CALLBACK_BASE };
      // Auth allowlist matching includes the query but excludes the fragment.
      // PKCE adds the code query while preserving this independent correlation.
      // The destination remains the exact approved scheme/host/path.
      const redirect = new URL(redirectBase); redirect.hash = 'correlation=' + correlation;
      const url = new URL(GOOGLE_TEST_ORIGIN + '/auth/v1/authorize');
      url.search = new URLSearchParams({ provider: 'google', redirect_to: redirect.href, code_challenge: challenge, code_challenge_method: 's256', prompt: 'select_account' }).toString();
      validateGoogleLaunch(url.href, pending);
      return { url: url.href, pending };
    },
    async exchange(code, verifier) {
      if (!/^[A-Za-z0-9_-]{1,2048}$/.test(code) || !/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) throw failure();
      const started = now(); return credentials(await request('token?grant_type=pkce', { auth_code: code, code_verifier: verifier }), started);
    },
    async refresh(refreshToken) {
      if (!token(refreshToken)) throw failure();
      const started = now(); return credentials(await request('token?grant_type=refresh_token', { refresh_token: refreshToken }), started);
    },
    async signOut(value) { if (!token(value.accessToken, true)) throw failure(); await request('logout?scope=local', undefined, value.accessToken); },
  };
}
