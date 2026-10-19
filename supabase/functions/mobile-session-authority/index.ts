import { createAuthorityHandler, createJwtVerifier, validateDatabaseUrl, authorityReply, TEST_REF, TEST_ISSUER } from './core.ts';
// Deno deployment entry: static exact imports allow deployment bundling.
import { createRemoteJWKSet, jwtVerify } from 'npm:jose@6.2.8'; // MIT
import postgres from 'npm:postgres@3.4.7'; // Unlicense
declare const Deno: { env: { get(name: string): string | undefined }; serve(handler: (request: Request) => Promise<Response>): void };
async function main() {
  const get=(name:string)=>Deno.env.get(name)??'';
  if(get('MOBILE_TEST_PROJECT_REF')!==TEST_REF||get('MOBILE_TEST_ISSUER')!==TEST_ISSUER)throw new Error('Test config required');
  const connection=get('MOBILE_AUTHORITY_DATABASE_URL');validateDatabaseUrl(connection);
  const ca=get('MOBILE_AUTHORITY_DATABASE_CA');if(ca&&!/^-----BEGIN CERTIFICATE-----[\s\S]+-----END CERTIFICATE-----\s*$/.test(ca))throw new Error('Invalid database CA');
  const key=get('MOBILE_AUTHORITY_SERVER_KEY'), publicKey=get('MOBILE_TEST_PUBLISHABLE_KEY');if(!publicKey.startsWith('sb_publishable_'))throw new Error('Test publishable key required');
  const sql=postgres(connection,{prepare:false,max:2,connect_timeout:3,idle_timeout:15,max_lifetime:60,ssl:ca?{ca,rejectUnauthorized:true}:'verify-full',onnotice:()=>undefined,connection:{statement_timeout:2000,application_name:'mobile-session-authority'}});
  const jwks=createRemoteJWKSet(new URL(TEST_ISSUER+'/.well-known/jwks.json'),{timeoutDuration:2500});
  const check=async(subject:string,sessionId:string)=>{
      try { const rows=await sql`select mobile_session_authority.check_session(${subject}::uuid, ${sessionId}::uuid) as result`;
      if(rows.length!==1)throw new Error('Authority query failed');return rows[0].result;
      } catch (error) {
        const code=error && typeof error==='object' && 'code' in error ? String(error.code) : '';
        console.warn('mobile-authority-db', ['42501','28P01','28000','53300','57014','42P01','42703','42883','ECONNREFUSED','CONNECT_TIMEOUT','CERT_HAS_EXPIRED','UNABLE_TO_VERIFY_LEAF_SIGNATURE','SELF_SIGNED_CERT_IN_CHAIN'].includes(code)?code:'unavailable');
        throw new Error('Authority query failed');
      }
  };
  const probe=await check('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-000000000000') as {active?:unknown};
  if(probe?.active!==false)throw new Error('Authority health check failed');
  console.info('mobile-authority-startup ready');
  const handler=createAuthorityHandler(key,{
    now:Date.now,
    verify:createJwtVerifier((token,options)=>jwtVerify(token,jwks,options)),
    check,
    logout:async token=>{
      const response=await fetch(TEST_ISSUER+'/logout?scope=local',{method:'POST',headers:{authorization:'Bearer '+token,apikey:publicKey},redirect:'error',signal:AbortSignal.timeout(2500)});
      // Already-removed session may yield 401/403; DB must still confirm inactive.
      if(!response.ok&&![401,403].includes(response.status))throw new Error('Logout failed');await response.body?.cancel();
    },
  });
  Deno.serve(handler);
}
void main().catch(()=>{Deno.serve(async()=>authorityReply({error:'Session authority unavailable'},503));});
