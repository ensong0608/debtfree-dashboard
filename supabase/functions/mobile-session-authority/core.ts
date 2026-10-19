export const TEST_REF = 'otggeztwtaklsqwtztgz';
export const TEST_ISSUER = 'https://' + TEST_REF + '.supabase.co/auth/v1';
export type AuthorityResult = { active: boolean; subject: string; sessionId: string; confirmedEmail: string; googleIdentity: boolean; userEnabled: boolean; policyVersion: 'native-test-v1'; checkedAt: number; inactiveAt: number; absoluteExpiresAt: number };
export type AuthorityDependencies = {
  verify(token: string): Promise<{ subject: string; sessionId: string }>;
  check(subject: string, sessionId: string): Promise<unknown>;
  logout(token: string): Promise<void>;
  now(): number;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validateDatabaseUrl(connection: string) {
  const db=new URL(connection),user=decodeURIComponent(db.username);
  const direct=db.hostname==='db.'+TEST_REF+'.supabase.co'&&user==='mobile_session_authority_login';
  const pooled=/^[a-z0-9-]+\.pooler\.supabase\.com$/.test(db.hostname)&&user==='mobile_session_authority_login.'+TEST_REF;
  if(!['postgres:','postgresql:'].includes(db.protocol)||(!direct&&!pooled)||db.pathname!=='/postgres'||!db.password||db.hash||[...db.searchParams.keys()].some(k=>k!=='sslmode')||(db.searchParams.has('sslmode')&&db.searchParams.get('sslmode')!=='require'))throw new Error('Restricted test connection required');
}
type VerificationOptions={issuer:string;audience:string;algorithms:string[];requiredClaims:string[];currentDate:Date};
export function createJwtVerifier(verify: (token:string,options:VerificationOptions)=>Promise<{payload:Record<string,unknown>}>, now:()=>number=Date.now) {
  return async(token:string)=>{
    const {payload}=await verify(token,{issuer:TEST_ISSUER,audience:'authenticated',algorithms:['ES256','RS256'],requiredClaims:['exp','sub','session_id','iat'],currentDate:new Date(now())});
    if(typeof payload.sub!=='string'||!uuid.test(payload.sub)||typeof payload.session_id!=='string'||!uuid.test(payload.session_id)||typeof payload.iat!=='number'||payload.iat*1000>now()+30_000)throw new Error('Invalid token');
    return {subject:payload.sub,sessionId:payload.session_id};
  };
}
export function authorityReply(data: unknown, status = 200) { return Response.json(data, { status, headers: { 'cache-control': 'private, no-store' } }); }
export async function sameSecret(a: string, b: string) {
  const digest = (s: string) => crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  const [x,y] = await Promise.all([digest(a),digest(b)]);const left=new Uint8Array(x),right=new Uint8Array(y);let difference=0;for(let i=0;i<left.length;i++)difference|=left[i]^right[i];return difference===0;
}
export function validateResult(value: unknown, subject: string, sessionId: string, now: number): AuthorityResult {
  const result=value as AuthorityResult;
  if(!result||typeof result.active!=='boolean'||result.subject!==subject||result.sessionId!==sessionId||result.policyVersion!=='native-test-v1'||typeof result.confirmedEmail!=='string'||typeof result.googleIdentity!=='boolean'||typeof result.userEnabled!=='boolean'||![result.checkedAt,result.inactiveAt,result.absoluteExpiresAt].every(Number.isFinite)||Math.abs(now-result.checkedAt)>5000)throw new Error('Invalid authority result');
  if(result.active&&(!result.googleIdentity||!result.userEnabled||!/^\S+@\S+\.\S+$/.test(result.confirmedEmail)||result.inactiveAt<=now||result.absoluteExpiresAt<=now))throw new Error('Invalid active session');
  return {active:result.active,subject,sessionId,confirmedEmail:result.active?result.confirmedEmail:'',googleIdentity:result.googleIdentity,userEnabled:result.userEnabled,policyVersion:'native-test-v1',checkedAt:result.checkedAt,inactiveAt:result.inactiveAt,absoluteExpiresAt:result.absoluteExpiresAt};
}
export function createAuthorityHandler(serverKey: string, deps: AuthorityDependencies) {
  if(!/^[A-Za-z0-9_-]{43,128}$/.test(serverKey))throw new Error('Authority configuration required');
  let inFlight=0;
  return async (request: Request): Promise<Response> => {
    const url=new URL(request.url), action=url.pathname.endsWith('/check')?'check':url.pathname.endsWith('/revoke')?'revoke':null;
    if(!action||!['/functions/v1/mobile-session-authority/'+action,'/mobile-session-authority/'+action].includes(url.pathname)||url.search||request.method!=='POST')return authorityReply({error:'Not found'},404);
    if(request.headers.has('origin')||request.headers.has('cookie')||request.headers.get('x-authority-key')?.length!==serverKey.length||!await sameSecret(request.headers.get('x-authority-key')??'',serverKey))return authorityReply({error:'Denied'},401);
    const bearer=request.headers.get('authorization');if(!bearer||bearer.length>8192||!/^Bearer [A-Za-z0-9._~-]+$/.test(bearer))return authorityReply({error:'Denied'},401);
    // No caller subject/session/body accepted; derive both exclusively from JWT verification.
    if(request.body)return authorityReply({error:'Body not accepted'},400);
    if(inFlight>=4)return authorityReply({error:'Authority busy'},503);
    inFlight++;const token=bearer.slice(7);
    const operation=(async()=>{
      let verified;try{verified=await deps.verify(token);}catch{return authorityReply({error:'Denied'},401);}
      if(!uuid.test(verified.subject)||!uuid.test(verified.sessionId))return authorityReply({error:'Denied'},401);
      if(action==='revoke')await deps.logout(token);
      const result=validateResult(await deps.check(verified.subject,verified.sessionId),verified.subject,verified.sessionId,deps.now());
      if(action==='revoke'&&result.active)throw new Error('Revocation unconfirmed');
      return authorityReply(result);
    })().catch(()=>authorityReply({error:'Session authority unavailable'},503)).finally(()=>{inFlight--;});
    let timer: ReturnType<typeof setTimeout>|undefined;
    try{return await Promise.race([operation,new Promise<Response>(resolve=>{timer=setTimeout(()=>resolve(authorityReply({error:'Session authority unavailable'},503)),4500);})]);}
    finally{if(timer)clearTimeout(timer);}
  };
}
