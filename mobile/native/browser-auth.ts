import type { NativeSession } from './session.ts';
import type { CredentialVault, Pending } from './contracts.ts';
import { validatePending } from './callback.ts';
import { GOOGLE_CALLBACK_BASE, GOOGLE_TEST_ORIGIN, validateGoogleLaunch } from './google-oauth.ts';

export type ListenerHandle = { remove(): Promise<void> };
export interface SystemBrowserPort {
  open(options: { url: string; presentationStyle: 'fullscreen' }): Promise<void>;
  close(): Promise<void>;
  addListener(event: 'browserFinished', listener: () => void): Promise<ListenerHandle>;
}
export interface AppCallbackPort {
  addListener(event: 'appUrlOpen', listener: (event: { url: string }) => void): Promise<ListenerHandle>;
  getLaunchUrl(): Promise<{ url: string } | undefined>;
}
type Session = Pick<NativeSession, 'snapshot' | 'startGoogleLogin' | 'handleCallback' | 'cancelLogin'>;
type Timers = { set(task: () => void, milliseconds: number): unknown; clear(handle: unknown): void };
type Dependencies = { session: Session; vault: CredentialVault; browser: SystemBrowserPort; app: AppCallbackPort; platform: 'android' | 'ios'; isNative: boolean; now?: () => number; crypto?: Crypto; timers?: Timers; event?: (event: 'callback' | 'rejected' | 'canceled') => void };
const pendingKey = JSON.stringify(['debtfree-native-test-v1', GOOGLE_TEST_ORIGIN + '/auth/v1', 'pending']);

/** Own exactly one bridge for the same NativeSession used by API/bootstrap/UI. */
export class NativeBrowserAuth {
  private readonly deps: Dependencies;
  private readonly now: () => number;
  private readonly crypto: Crypto;
  private readonly timers: Timers;
  private initialized = false; private initialization: Promise<void> | null = null;
  private lifecycle = 0;
  private disposed = false; private active = false; private loginStarting = false;
  private handles: ListenerHandle[] = [];
  private expiryTimer: unknown; private finishedTimer: unknown;
  private deliveries: Promise<unknown> = Promise.resolve();
  private seen = new Set<string>();
  constructor(dependencies: Dependencies) {
    if (!dependencies.isNative || !['android', 'ios'].includes(dependencies.platform)) throw new Error('Native system browser required.');
    this.deps = dependencies; this.now = dependencies.now ?? Date.now; this.crypto = dependencies.crypto ?? globalThis.crypto;
    this.timers = dependencies.timers ?? { set: (task, milliseconds) => setTimeout(task, milliseconds), clear: handle => clearTimeout(handle as ReturnType<typeof setTimeout>) };
  }
  private clearTimers() { if (this.expiryTimer !== undefined) this.timers.clear(this.expiryTimer); if (this.finishedTimer !== undefined) this.timers.clear(this.finishedTimer); this.expiryTimer = undefined; this.finishedTimer = undefined; }
  private async pending(): Promise<Pending> { const value = await this.deps.vault.read(pendingKey); validatePending(value, GOOGLE_CALLBACK_BASE, this.now()); return value; }
  private arm(pending: Pending) { this.clearTimers(); this.active = true; this.expiryTimer = this.timers.set(() => { void this.cancel().catch(() => undefined); }, pending.expiresAt - this.now()); }
  private async bounded<T>(operation: Promise<T>): Promise<T> {
    let handle: unknown;
    try { return await Promise.race([operation, new Promise<never>((_, reject) => { handle = this.timers.set(() => reject(new Error('Native browser operation timed out.')), 15_000); })]); }
    finally { if (handle !== undefined) this.timers.clear(handle); }
  }
  private async listen(operation: Promise<ListenerHandle>, lifecycle: number) {
    return this.bounded(operation.then(async handle => {
      if (this.disposed || lifecycle !== this.lifecycle) { await handle.remove(); throw new Error('Stale listener registration.'); }
      return handle;
    }));
  }
  private async closeBrowser() { try { await this.bounded(this.deps.browser.close()); } catch { /* Auth invalidation never depends on browser closing. */ } }
  async initialize(): Promise<void> {
    if (this.disposed) throw new Error('Browser adapter disposed.');
    if (this.initialization) return this.initialization;
    if (this.initialized) return;
    const lifecycle = ++this.lifecycle;
    this.initialization = (async () => {
      try {
        const appHandle = await this.listen(this.deps.app.addListener('appUrlOpen', event => { void this.handleUrl(event.url).catch(() => undefined); }), lifecycle); this.handles.push(appHandle);
        const browserHandle = await this.listen(this.deps.browser.addListener('browserFinished', () => {
          if (!this.active || this.disposed || !['authorizing', 'signedOut'].includes(this.deps.session.snapshot().state)) return;
          // A redirect can race a user-close notification. Correlation/session still decide.
          if (this.finishedTimer !== undefined) this.timers.clear(this.finishedTimer);
          this.finishedTimer = this.timers.set(() => { if (this.active) void this.cancel().catch(() => undefined); }, 250);
        }), lifecycle); this.handles.push(browserHandle);
        if (this.disposed) throw new Error('Browser adapter disposed.');
        const stored = await this.deps.vault.read(pendingKey);
        if (stored !== null && ['signedOut', 'authorizing'].includes(this.deps.session.snapshot().state)) {
          try { validatePending(stored, GOOGLE_CALLBACK_BASE, this.now()); this.arm(stored); }
          catch { await this.deps.session.cancelLogin(); this.deps.event?.('canceled'); }
        }
        const launch = await this.bounded(this.deps.app.getLaunchUrl());
        if (this.disposed) throw new Error('Browser adapter disposed.');
        this.initialized = true;
        if (launch?.url) await this.handleUrl(launch.url);
      } catch {
        this.lifecycle++; this.initialized = false;
        for (const handle of this.handles.splice(0)) { try { await handle.remove(); } catch { /* Never remove other listeners. */ } }
        this.clearTimers(); this.active = false;
        await this.deps.session.cancelLogin().catch(() => undefined);
        throw new Error('Could not initialize native browser sign-in.');
      }
    })();
    try { await this.initialization; } finally { this.initialization = null; }
  }
  async startGoogleLogin(): Promise<void> {
    if (this.loginStarting) throw new Error('Sign-in is already starting.');
    this.loginStarting = true;
    try { await this.initialize(); if (this.disposed) throw new Error('Browser adapter disposed.'); await this.deps.session.startGoogleLogin(); }
    catch { if (this.active) await this.cancel(); throw new Error('Could not start browser sign-in.'); }
    finally { this.loginStarting = false; }
  }
  /** Pass this method via the NativeSession dependency browser.open(url). */
  async open(raw: string): Promise<void> {
    if (!this.initialized || this.disposed) throw new Error('Initialize callback listeners before browser launch.');
    const pending = await this.pending(); const url = validateGoogleLaunch(raw, pending);
    const digest = new Uint8Array(await this.crypto.subtle.digest('SHA-256', new TextEncoder().encode(pending.verifier)));
    const challenge = btoa(String.fromCharCode(...digest)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    if (challenge !== url.searchParams.get('code_challenge')) throw new Error('PKCE launch mismatch.');
    this.arm(pending);
    const generation = this.deps.session.snapshot().generation;
    try { await this.bounded(this.deps.browser.open({ url: url.href, presentationStyle: 'fullscreen' })); if (this.disposed || this.deps.session.snapshot().generation !== generation || (!this.active && this.deps.session.snapshot().state !== 'ready')) { await this.closeBrowser(); throw new Error('Browser sign-in ended.'); } }
    catch { await this.cancel(); throw new Error('Could not open system browser.'); }
  }
  handleUrl(raw: string): Promise<'ignored' | 'callback' | 'rejected'> {
    const operation = this.deliveries.then(async () => {
      if (this.disposed || typeof raw !== 'string' || raw.length > 8192) return 'ignored' as const;
      let url: URL; try { url = new URL(raw); } catch { return 'ignored' as const; }
      if (url.protocol !== 'com.debtfree.connectedtest:' || url.host !== 'auth' || url.pathname !== '/callback') return 'ignored' as const;
      const bytes = await this.crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
      const fingerprint = [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('');
      if (this.seen.has(fingerprint)) return 'ignored' as const;
      this.seen.add(fingerprint); if (this.seen.size > 16) this.seen.delete(this.seen.values().next().value!);
      this.clearTimers(); this.active = true;
      try { await this.deps.session.handleCallback(raw); this.deps.event?.('callback'); return 'callback' as const; }
      catch { this.deps.event?.('rejected'); return 'rejected' as const; }
      finally { this.active = false; this.clearTimers(); await this.closeBrowser(); }
    });
    this.deliveries = operation.catch(() => undefined);
    return operation;
  }
  async cancel(): Promise<void> {
    this.clearTimers(); const wasActive = this.active; this.active = false;
    // Also clears pending authorization after a process restart, through the session's vault queue.
    try {
      if (wasActive || ['authorizing', 'exchanging', 'signedOut'].includes(this.deps.session.snapshot().state)) await this.deps.session.cancelLogin();
    } catch { throw new Error('Could not cancel sign-in.'); }
    finally { await this.closeBrowser(); this.deps.event?.('canceled'); }
  }
  async dispose(): Promise<void> {
    this.disposed = true; this.lifecycle++; this.clearTimers();
    try { if (this.active || this.loginStarting) await this.cancel(); }
    finally {
      for (const handle of this.handles.splice(0)) { try { await handle.remove(); } catch { /* Never remove other listeners. */ } }
      this.seen.clear(); this.initialized = false;
    }
  }
}
