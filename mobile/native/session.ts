import { SignInFailure, validateConfig, validCredentials, scopeKey, type TestConfig, type Credentials, type VerifiedScope, type SessionState, type CredentialVault, type OAuthProvider, type Authority } from './contracts.ts';
import { parseCallback, validatePending } from './callback.ts';
type Dependencies = { vault: CredentialVault; oauth: OAuthProvider; authority: Authority; browser: { open(url: string): Promise<void> }; now: () => number; changed?: (state: SessionState) => void };
export class NativeSession {
  private failure = '';
  failureMessage() { return this.failure; }
  private config: Readonly<TestConfig>; private deps: Dependencies;
  private state: SessionState = 'signedOut'; private generation = 0;
  private credentials: Credentials | null = null; private scope: VerifiedScope | null = null;
  private refreshFlight: Promise<void> | null = null; private vaultQueue: Promise<unknown> = Promise.resolve();
  constructor(config: TestConfig, dependencies: Dependencies) { this.config = validateConfig(config); this.deps = dependencies; }
  private key(kind: string) { return JSON.stringify(['debtfree-native-test-v1', this.config.issuer, kind]); }
  private vault<T>(operation: () => Promise<T>): Promise<T> { const result = this.vaultQueue.then(operation); this.vaultQueue = result.catch(() => undefined); return result; }
  private setState(state: SessionState) { this.state = state; this.deps.changed?.(state); }
  private check(g: number) { if (g !== this.generation) throw new Error('Session changed.'); }
  private lock(g: number) { if (g === this.generation) { this.generation++; this.credentials = null; this.scope = null; this.setState('locked'); } }
  snapshot() { return { state: this.state, generation: this.generation, scope: this.scope ? { ...this.scope } : null }; }
  rejectAuthorization(g: number) { this.lock(g); }
  assertCurrent(g: number, key: string) { this.check(g); if (this.state !== 'ready' || !this.scope || scopeKey(this.scope) !== key) throw new Error('Session is not verified.'); }
  private async verify(credentials: Credentials, g: number, sameScope = false) {
    if (!validCredentials(credentials) || credentials.expiresAt <= this.deps.now()) throw new Error('Invalid credentials.');
    this.setState('verifying');
    const scope = await this.deps.authority.bootstrap(credentials.accessToken); this.check(g);
    if (scope.backendId !== this.config.backendId || scope.issuer !== this.config.issuer || [scope.subject, scope.identity, scope.householdId].some(v => typeof v !== 'string' || !v.trim()) || !['owner', 'admin', 'viewer'].includes(scope.role) || (sameScope && this.scope && scopeKey(scope) !== scopeKey(this.scope))) throw new Error('Invalid verified household scope.');
    await this.vault(() => { this.check(g); return this.deps.vault.write(this.key('credentials'), credentials); }); this.check(g);
    this.credentials = { ...credentials }; this.scope = { ...scope }; this.setState('ready');
  }
  async restore() {
    if (!['signedOut', 'locked'].includes(this.state)) throw new Error('Session is busy.');
    const g = ++this.generation; this.scope = null; this.setState('verifying');
    try { const value = await this.vault(() => this.deps.vault.read(this.key('credentials'))); this.check(g); if (value === null) { this.setState('signedOut'); return; } if (!validCredentials(value)) throw new Error('Invalid stored credentials.'); const credentials = value.expiresAt <= this.deps.now() ? await this.deps.oauth.refresh(value.refreshToken) : value; this.check(g); await this.verify(credentials, g); } catch { this.lock(g); throw new Error('Could not verify saved session.'); }
  }
  async startGoogleLogin() {
    if (this.state !== 'signedOut') throw new Error('Sign out before switching accounts.');
    const g = ++this.generation; this.failure = ''; this.setState('authorizing');
    try { const prepared = await this.deps.oauth.prepare({ redirectBase: this.config.callbackBase }); this.check(g); validatePending(prepared.pending, this.config.callbackBase, this.deps.now());
      const url = new URL(prepared.url), issuer = new URL(this.config.issuer);
      if (url.origin !== issuer.origin || url.pathname !== '/auth/v1/authorize' || url.username || url.password || url.hash) throw new Error('Invalid provider launch URL.');
      await this.vault(() => { this.check(g); return this.deps.vault.write(this.key('pending'), prepared.pending); }); this.check(g); await this.deps.browser.open(prepared.url); this.check(g);
    } catch { this.lock(g); throw new Error('Could not start sign-in.'); }
  }
  async handleCallback(raw: string) {
    // Flip state before the first await: duplicate warm/cold deliveries cannot exchange twice.
    if (this.state !== 'authorizing' && this.state !== 'signedOut') throw new Error('No pending sign-in.');
    const g = this.generation; this.setState('exchanging');
    try { const pending = await this.vault(() => this.deps.vault.read(this.key('pending'))); this.check(g); validatePending(pending, this.config.callbackBase, this.deps.now()); const code = parseCallback(raw, pending, this.config.callbackBase, this.deps.now());
      await this.vault(() => { this.check(g); return this.deps.vault.remove(this.key('pending')); }); this.check(g);
      const credentials = await this.deps.oauth.exchange(code, pending.verifier); this.check(g); await this.verify(credentials, g);
    } catch (error) {
      const reasons: Record<string,string> = { 'google-network':'Could not reach Google sign-in. (G1)', 'google-response':'Google sign-in response was rejected. (G2)', 'google-format':'Could not read the Google session. (G3)', 'google-expiry':'Check the phone date and time, then sign in again. (G4)', 'test-network':'Could not reach the test household server. (S1)', 'test-session':'The test server could not verify this session. (S2)', 'test-authority':'Test session verification is unavailable. (S3)', 'test-membership':'Could not join the test household. (S4)' };
      if (g === this.generation) this.failure = error instanceof SignInFailure ? reasons[error.reason] : 'Sign-in could not be completed. (C1)';
      try { await this.vault(() => { this.check(g); return this.deps.vault.remove(this.key('pending')); }); } catch { /* locked below; never exchange */ } this.lock(g); throw new Error('Sign-in callback rejected.'); }
  }
  async cancelLogin() { return this.logout(); }
  async accessToken() {
    if (this.refreshFlight) await this.refreshFlight;
    if (this.state !== 'ready' || !this.credentials || !this.scope) throw new Error('Session is not verified.');
    if (this.credentials.expiresAt <= this.deps.now() + 30_000) {
      const g = this.generation, refreshToken = this.credentials.refreshToken;
      this.refreshFlight = (async () => { try { const next = await this.deps.oauth.refresh(refreshToken); this.check(g); await this.verify(next, g, true); } catch { this.lock(g); throw new Error('Session refresh failed.'); } })();
      const flight = this.refreshFlight; try { await flight; } finally { if (this.refreshFlight === flight) this.refreshFlight = null; }
    }
    if (this.state !== 'ready' || !this.credentials) throw new Error('Session is not verified.');
    return this.credentials.accessToken;
  }
  async logout() {
    const g = ++this.generation, old = this.credentials; this.credentials = null; this.scope = null; this.refreshFlight = null; this.setState('closing'); let serverRevoked = false, cleanup = true;
    try { if (old) serverRevoked = await this.deps.authority.revoke(old.accessToken); } catch { serverRevoked = false; }
    try { if (old) await this.deps.oauth.signOut(old); } catch { /* local cleanup still required */ }
    for (const kind of ['credentials', 'pending']) { try { await this.vault(() => this.deps.vault.remove(this.key(kind))); } catch { cleanup = false; } }
    this.check(g); this.setState(cleanup ? 'signedOut' : 'locked'); return { serverRevoked, localCleared: cleanup };
  }
}
