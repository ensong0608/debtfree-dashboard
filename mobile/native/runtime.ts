import { createGoogleOAuth, GOOGLE_TEST_ORIGIN } from './google-oauth.ts';
import { NativeSession } from './session.ts';
import { NativeBrowserAuth } from './browser-auth.ts';
import { createCredentialVault } from './secure-store.ts';
import { CONNECTED_CONFIG } from './config.ts';
import { createNativeApi } from './api.ts';
import { SignInFailure } from './contracts.ts';
import type { Authority, SessionState, VerifiedScope } from './contracts.ts';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { App } from '@capacitor/app';

// One browser bridge, vault and session are shared by bootstrap, UI and requests.
export function createConnectedRuntime(publishableKey: string, changed: (state: SessionState) => void, join: () => Promise<boolean>) {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') throw new Error('The connected test requires its Android app.');
  const config = CONNECTED_CONFIG, vault = createCredentialVault();
  const oauth = createGoogleOAuth({ supabaseUrl: GOOGLE_TEST_ORIGIN, publishableKey });
  async function request(path: string, token: string, method = 'GET', body?: string): Promise<Response> {
    let response: Response;
    try { response = await fetch(config.apiOrigin + path, {
      method, headers: { authorization: 'Bearer ' + token, ...(body ? { 'content-type': 'application/json' } : {}) },
      body, credentials: 'omit', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15_000),
    }); } catch { throw new SignInFailure('test-network'); }
    if (response.redirected || response.url !== config.apiOrigin + path) throw new Error('Test endpoint rejected.');
    return response;
  }
  const authority: Authority = {
    async bootstrap(token) {
      const generation = session.snapshot().generation;
      const assertBootstrap = () => { if (session.snapshot().generation !== generation || session.snapshot().state !== 'verifying') throw new Error('Sign-in changed.'); };
      let response = await request('/api/native/v1/session', token);
      if (response.status === 403) {
        assertBootstrap();
        const offer = await request('/api/native/v1/enrollment', token);
        if (!offer.ok || (await offer.json() as { canJoin?: unknown } | null)?.canJoin !== true) throw new Error('Household membership is required.');
        assertBootstrap();
        if (!await join()) throw new Error('Household membership is required.');
        assertBootstrap();
        const accepted = await request('/api/native/v1/enrollment', token, 'POST', JSON.stringify({ accept: true }));
        if (!accepted.ok) throw new Error('Could not join the test household.');
        response = await request('/api/native/v1/session', token);
      }
      assertBootstrap();
      if (!response.ok) throw new SignInFailure(response.status === 503 ? 'test-authority' : response.status === 401 ? 'test-session' : 'test-membership');
      return await response.json() as VerifiedScope;
    },
    async revoke(token) {
      const response = await request('/api/native/v1/logout', token, 'POST');
      if (!response.ok) return false;
      const result = await response.json() as { serverRevoked?: unknown } | null;
      return result?.serverRevoked === true;
    },
  };
  const session: NativeSession = new NativeSession(config, { vault, oauth, authority, browser: { open: url => browser.open(url) }, now: Date.now, changed });
  const browser: NativeBrowserAuth = new NativeBrowserAuth({ session, vault, browser: Browser, app: App, platform: 'android', isNative: true });
  return {
    config, session, browser, api: createNativeApi(config, session, fetch),
    async initialize() {
      await browser.initialize();
      // A cold callback or persisted pending transaction owns restore ordering.
      const pending = await vault.read(JSON.stringify(['debtfree-native-test-v1', config.issuer, 'pending']));
      if (session.snapshot().state === 'signedOut' && pending === null) await session.restore();
      return pending !== null && session.snapshot().state === 'signedOut';
    },
  };
}
export type ConnectedRuntime = ReturnType<typeof createConnectedRuntime>;
