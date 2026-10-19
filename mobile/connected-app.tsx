import { useEffect, useRef, useState } from 'react';
import { App } from '@capacitor/app';
import DashboardClient from '../app/dashboard-client';
import { createConnectedRuntime, type ConnectedRuntime } from './native/runtime.ts';
import { createConnectedRepository, type ConnectedRepository } from './native/repository.ts';
import { subscribeRevisions } from './native/notifications.ts';
import type { NativeSession } from './native/session.ts';

declare const __MOBILE_TEST_PUBLISHABLE_KEY__: string;
type View = ReturnType<ConnectedRepository['snapshot']>;
export default function ConnectedApp() {
  const runtimeRef = useRef<ConnectedRuntime | null>(null), repositoryRef = useRef<ConnectedRepository | null>(null);
  const [session, setSession] = useState<ReturnType<NativeSession['snapshot']>>({ state: 'signedOut', generation: 0, scope: null });
  const [repository, setRepository] = useState<ConnectedRepository | null>(null);
  const [view, setView] = useState<View>({ status: 'loading', role: 'viewer', householdName: 'Test household', pending: false });
  const viewRef = useRef(view);
  const [initialized, setInitialized] = useState(false), [waiting, setWaiting] = useState(false);
  const [message, setMessage] = useState(''), [busy, setBusy] = useState(false), [version, setVersion] = useState(0);
  useEffect(() => {
    let disposed = false;
    void Promise.resolve().then(async () => {
      if (disposed) return;
      const runtime = createConnectedRuntime(__MOBILE_TEST_PUBLISHABLE_KEY__, () => {
        if (disposed) return;
        const next = runtime.session.snapshot(); setSession(next);
        if (next.state === 'locked') setMessage(runtime.session.failureMessage());
        if (next.state !== 'signedOut') setWaiting(false);
        if (['signedOut', 'closing', 'locked'].includes(next.state)) {
          const old = repositoryRef.current; repositoryRef.current = null;
          setRepository(null); if (old) void old.close();
        }
      }, async () => window.confirm('Join the isolated connected test household? Existing device-only data will stay separate.'));
      runtimeRef.current = runtime;
      const pending = await runtime.initialize();
      if (!disposed) { setWaiting(pending); setInitialized(true); }
    }).catch(() => { if (!disposed) setMessage('Secure storage or connected test configuration is unavailable. Restart the app to retry.'); });
    return () => { disposed = true; void repositoryRef.current?.close(); void runtimeRef.current?.browser.dispose().catch(() => undefined); };
  }, []);
  useEffect(() => {
    if (['signedOut', 'closing', 'locked'].includes(session.state)) return;
    if (session.state !== 'ready' || repositoryRef.current || !runtimeRef.current) return;
    const handle = createConnectedRepository(runtimeRef.current, next => { viewRef.current = next; setView(next); }); repositoryRef.current = handle;
    void handle.initialize().then(() => { if (repositoryRef.current === handle) setRepository(handle); }).catch(() => {
      if (repositoryRef.current === handle) setMessage('Could not open the test household. Saved changes were kept. Restart to retry.');
    });
  }, [session.state, session.generation]);
  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime || !repository || session.state !== 'ready') return;
    let stopped = false, connecting = false, refreshing = false, stopSocket: (() => void) | undefined;
    let foreground = document.visibilityState === 'visible';
    const canApply = () => !stopped && foreground && document.visibilityState === 'visible' && viewRef.current.status === 'synced' && !document.querySelector('[aria-modal="true"], .allocation-minimum button[type="submit"]') && !document.activeElement?.matches('input, select, textarea, [contenteditable=true]');
    const refresh = async () => {
      if (refreshing || !canApply()) return;
      refreshing = true;
      try { if (await repository.refresh(canApply) && canApply()) setVersion(value => value + 1); }
      catch { if (!stopped) setMessage('Shared updates are unavailable. Reconnect to refresh.'); }
      finally { refreshing = false; }
    };
    const connect = async () => {
      if (stopped || !foreground || stopSocket || connecting) return;
      connecting = true;
      try {
        const stop = await subscribeRevisions({ config: runtime.config, session: runtime.session, api: runtime.api, open: (url, protocols) => { const socket = new WebSocket(url, protocols); return { close: () => socket.close(), addEventListener: (type, listener) => socket.addEventListener(type, event => listener('data' in event ? { data: event.data } : {})) }; }, revisionChanged: async () => { await refresh(); }, reconnectNeeded: () => { stopSocket = undefined; } });
        if (stopped || !foreground) stop(); else stopSocket = stop;
      } catch { /* Auth rejection locks the shared session; poll only while ready. */ }
      finally { connecting = false; }
    };
    const resume = () => { if (foreground) { void refresh(); void connect(); } else { stopSocket?.(); stopSocket = undefined; } };
    const visibility = () => { foreground = document.visibilityState === 'visible'; resume(); };
    const appHandle = App.addListener('appStateChange', event => { foreground = event.isActive; resume(); });
    window.addEventListener('online', resume); window.addEventListener('focus', resume); document.addEventListener('visibilitychange', visibility);
    const timer = window.setInterval(resume, 15_000); resume();
    return () => { stopped = true; clearInterval(timer); stopSocket?.(); void appHandle.then(handle => handle.remove()).catch(() => undefined); window.removeEventListener('online', resume); window.removeEventListener('focus', resume); document.removeEventListener('visibilitychange', visibility); };
  }, [repository, session.state]);
  async function action(operation: () => Promise<void>) {
    if (busy) return; setBusy(true); setMessage('');
    try { await operation(); } catch { setMessage('The action could not be confirmed. Existing saved changes were kept.'); }
    finally { setBusy(false); }
  }
  async function logout() {
    const runtime = runtimeRef.current; if (!runtime) return;
    if (view.pending && !confirm('Sign out with retained changes? They remain encrypted for this same account and household.')) return;
    // Closing stops/awaits repository work before credential cleanup begins.
    const old = repositoryRef.current; repositoryRef.current = null; setRepository(null); await old?.close();
    const result = await runtime.session.logout();
    setMessage(!result.localCleared ? 'Local sign-out cleanup is unconfirmed. Restart before signing in again.' : !result.serverRevoked ? 'Signed out locally. Server revocation could not be confirmed.' : 'Signed out.');
  }
  const active = session.scope && ['ready', 'verifying'].includes(session.state);
  const statusText: Record<View['status'], string> = { loading: 'Opening household', synced: 'Shared household up to date', saving: 'Saving changes', offline: 'Offline — changes retained', conflict: 'Another phone changed this household', recovery: 'Saved changes need your review', locked: 'Secure access locked', error: 'Save unconfirmed — changes retained' };
  return <>
    <section className="viewer-notice" aria-label="Connected test account">
      <strong>Connected test</strong>
      <span role="status">{active ? statusText[view.status] : session.state === 'locked' ? 'Access locked' : waiting || session.state === 'authorizing' ? 'Complete Google sign-in' : session.state === 'signedOut' ? 'Sign in to your test household' : 'Verifying sign-in'}</span>
      {active && <button type="button" disabled={busy} onClick={() => void action(logout)}>Sign out</button>}
      {initialized && session.state === 'signedOut' && !waiting && <button type="button" disabled={busy} onClick={() => void action(async () => { await runtimeRef.current!.browser.startGoogleLogin(); })}>Sign in with Google</button>}
      {(waiting || session.state === 'authorizing') && <button type="button" disabled={busy} onClick={() => void action(async () => { await runtimeRef.current!.browser.cancel(); setWaiting(false); })}>Cancel sign-in</button>}
      {session.state === 'locked' && <button type="button" disabled={busy} onClick={() => void action(logout)}>Clear sign-in</button>}
      {repository && view.status === 'synced' && view.role !== 'viewer' && <button type="button" disabled={busy} onClick={() => void action(async () => { const saved = await repository.repository.loadCheckpoint(); if (!saved) { setMessage('No recovery checkpoint is available.'); return; } if (confirm('Restore the encrypted recovery checkpoint to this test household?')) { await repository.repository.saveHousehold(saved); setVersion(value => value + 1); } })}>Restore checkpoint</button>}
      {repository && ['error', 'offline', 'recovery', 'conflict'].includes(view.status) && <>
        <button type="button" disabled={busy || view.status === 'conflict'} onClick={() => void action(async () => { await repository.retry(); setVersion(value => value + 1); })}>{view.status === 'recovery' ? 'Resume saved changes' : 'Retry connection'}</button>
        <button type="button" disabled={busy} onClick={() => void action(async () => { if (confirm('Load the latest shared household? Retained changes will be kept as an encrypted recovery checkpoint.')) { await repository.useLatest(); setVersion(value => value + 1); } })}>Load latest household</button>
      </>}
    </section>
    {message && <p className="viewer-notice" role="alert">{message}</p>}
    {active && repository && <DashboardClient key={session.generation + ':' + version} user={{ email: session.scope!.identity, displayName: session.scope!.identity.split('@')[0], fullName: null }} repository={repository.repository} managedHousehold={{ name: view.householdName, role: view.role, readOnly: busy || session.state !== 'ready' || view.status !== 'synced' }} />}
  </>;
}
