export type TestConfig = { environment: 'test'; backendId: 'debtfree-mobile-test'; apiOrigin: string; issuer: string; productionIssuer: string; callbackBase: string };
export function validateConfig(c: TestConfig): Readonly<TestConfig> {
  const api = new URL(c.apiOrigin), issuer = new URL(c.issuer), callback = new URL(c.callbackBase);
  const production = new URL(c.productionIssuer);
  if (production.protocol !== 'https:' || production.origin === issuer.origin) throw new Error('Separate test issuer required.');
  if (c.environment !== 'test' || c.backendId !== 'debtfree-mobile-test' || api.protocol !== 'https:' || !api.hostname.startsWith('debtfree-mobile-test.') || api.origin !== c.apiOrigin || api.username || api.password || !c.productionIssuer || c.issuer === c.productionIssuer || issuer.protocol !== 'https:' || !/^[a-z0-9-]+\.supabase\.co$/.test(issuer.hostname) || issuer.pathname !== '/auth/v1' || issuer.search || issuer.hash || issuer.username || issuer.password || issuer.port || callback.href !== c.callbackBase || callback.protocol !== 'com.debtfree.connectedtest:' || callback.host !== 'auth' || callback.pathname !== '/callback' || callback.search || callback.hash || callback.username || callback.password) throw new Error('Explicit isolated test configuration required.');
  return Object.freeze({ ...c });
}
type SignInFailureReason = 'google-network' | 'google-response' | 'google-format' | 'google-expiry' | 'test-network' | 'test-session' | 'test-authority' | 'test-membership';
export class SignInFailure extends Error { readonly reason: SignInFailureReason; constructor(reason: SignInFailureReason) { super('Google sign-in transport failed.'); this.reason=reason; } }
export type Credentials = { accessToken: string; refreshToken: string; expiresAt: number };
export type VerifiedScope = { backendId: string; issuer: string; subject: string; identity: string; householdId: string; role: 'owner' | 'admin' | 'viewer' };
export type Pending = { verifier: string; correlation: string; expiresAt: number; callbackBase: string };
// A real adapter must be native secure storage; there is deliberately no browser fallback.
export interface CredentialVault { read(key: string): Promise<unknown>; write(key: string, value: Credentials | Pending): Promise<void>; remove(key: string): Promise<void> }
export interface OAuthProvider { prepare(input: { redirectBase: string }): Promise<{ url: string; pending: Pending }>; exchange(code: string, verifier: string): Promise<Credentials>; refresh(refreshToken: string): Promise<Credentials>; signOut(credentials: Credentials): Promise<void> }
export interface Authority { bootstrap(accessToken: string): Promise<VerifiedScope>; revoke(accessToken: string): Promise<boolean> }
export type SessionState = 'signedOut' | 'authorizing' | 'exchanging' | 'verifying' | 'ready' | 'locked' | 'closing';
export function validCredentials(value: unknown): value is Credentials { const c = value as Credentials | null; return Boolean(c && typeof c.accessToken === 'string' && c.accessToken.length > 0 && !/[\s\r\n]/.test(c.accessToken) && typeof c.refreshToken === 'string' && c.refreshToken.length > 0 && Number.isFinite(c.expiresAt)); }
export function scopeKey(scope: VerifiedScope) { return JSON.stringify([scope.backendId, scope.issuer, scope.subject, scope.householdId]); }
