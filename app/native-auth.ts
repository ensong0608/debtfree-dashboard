import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
export type NativeAuthConfig = { environment: 'test'; issuer: string; productionIssuer: string; audience: 'authenticated'; algorithms: ('ES256' | 'RS256')[] };
export type NativeIdentity = { subject: string; sessionId: string; email: string; displayName: string; token: string };
export type LivenessResult = { active: boolean; subject: string; sessionId: string; confirmedEmail: string; googleIdentity: boolean; userEnabled: boolean; policyVersion: 'native-test-v1'; checkedAt: number; inactiveAt: number; absoluteExpiresAt: number };
export interface NativeLiveness { check(token: string): Promise<LivenessResult>; revoke(token: string): Promise<void> }
export class NativeAuthError extends Error { status: number; constructor(status: number) { super(status === 503 ? 'Session authority unavailable.' : 'Sign in required.'); this.status = status; } }
export function createNativeAuthenticator(config: NativeAuthConfig, liveness: NativeLiveness | undefined, key?: JWTVerifyGetKey, now: () => number = Date.now) {
  const issuer = new URL(config.issuer), production = new URL(config.productionIssuer);
  if (config.environment !== 'test' || config.audience !== 'authenticated' || issuer.protocol !== 'https:' || !/^[a-z0-9-]+\.supabase\.co$/.test(issuer.hostname) || issuer.pathname !== '/auth/v1' || issuer.search || issuer.hash || issuer.username || issuer.password || issuer.port || production.protocol !== 'https:' || production.origin === issuer.origin || !config.algorithms.length || config.algorithms.some(a => !['ES256','RS256'].includes(a))) throw new NativeAuthError(503);
  const keys = key ?? createRemoteJWKSet(new URL(config.issuer + '/.well-known/jwks.json'));
  async function authenticate(request: Request): Promise<NativeIdentity> {
    const header = request.headers.get('authorization');
    if (request.headers.has('cookie') || !header || !/^Bearer [A-Za-z0-9._~-]+$/.test(header)) throw new NativeAuthError(401);
    if (!liveness) throw new NativeAuthError(503);
    const token = header.slice(7); let claims;
    try { const result = await jwtVerify(token, keys, { issuer: config.issuer, audience: config.audience, algorithms: config.algorithms, requiredClaims: ['exp','sub','session_id','iat'], currentDate: new Date(now()) }); claims = result.payload; } catch { throw new NativeAuthError(401); }
    if (typeof claims.sub !== 'string' || !claims.sub || typeof claims.session_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(claims.session_id) || typeof claims.iat !== 'number' || claims.iat * 1000 > now() + 30_000) throw new NativeAuthError(401);
    let live: LivenessResult; try { live = await liveness.check(token); } catch { throw new NativeAuthError(503); }
    if (!live || live.policyVersion !== 'native-test-v1' || !Number.isFinite(live.checkedAt) || Math.abs(now() - live.checkedAt) > 5000) throw new NativeAuthError(503);
    if (live.active !== true || live.subject !== claims.sub || live.sessionId !== claims.session_id || live.googleIdentity !== true || live.userEnabled !== true || typeof live.confirmedEmail !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(live.confirmedEmail) || !Number.isFinite(live.inactiveAt) || live.inactiveAt <= now() || !Number.isFinite(live.absoluteExpiresAt) || live.absoluteExpiresAt <= now()) throw new NativeAuthError(401);
    const email = live.confirmedEmail.trim().toLowerCase(); return { subject: claims.sub, sessionId: claims.session_id, email, displayName: email.split('@')[0], token };
  }
  return { authenticate, async logout(identity: NativeIdentity) {
    if (!liveness) throw new NativeAuthError(503);
    try { await liveness.revoke(identity.token); const result = await liveness.check(identity.token); if (result.active !== false || result.subject !== identity.subject || result.sessionId !== identity.sessionId || result.policyVersion !== 'native-test-v1' || !Number.isFinite(result.checkedAt) || Math.abs(now() - result.checkedAt) > 5000) throw new Error('Unconfirmed'); } catch { throw new NativeAuthError(503); }
    return { serverRevoked: true };
  } };
}
