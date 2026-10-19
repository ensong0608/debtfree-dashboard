const TEST_REF='otggeztwtaklsqwtztgz';
const EDGE_BASE='https://'+TEST_REF+'.supabase.co/functions/v1/mobile-session-authority';
export type AuthorityProxyEnv={TEST_ENVIRONMENT:'debtfree-mobile-test';TEST_SUPABASE_REF:string;TEST_ISSUER:string;AUTHORITY_EDGE_URL:string;MOBILE_AUTHORITY_SERVER_KEY:string};
const reply=(status:number)=>Response.json({error:'Session authority unavailable'},{status,headers:{'cache-control':'private, no-store'}});
export function createAuthorityProxy(transport:typeof fetch=fetch){return{async fetch(request:Request,env:AuthorityProxyEnv):Promise<Response>{
  try{
    if(env.TEST_ENVIRONMENT!=='debtfree-mobile-test'||env.TEST_SUPABASE_REF!==TEST_REF||env.TEST_ISSUER!=='https://'+TEST_REF+'.supabase.co/auth/v1'||env.AUTHORITY_EDGE_URL!==EDGE_BASE||!/^[A-Za-z0-9_-]{43,128}$/.test(env.MOBILE_AUTHORITY_SERVER_KEY))return reply(503);
    const url=new URL(request.url);
    if(url.origin!=='https://session-authority.internal'||!['/check','/revoke'].includes(url.pathname)||url.search||request.method!=='POST'||request.headers.has('origin')||request.headers.has('cookie'))return reply(403);
    const token=request.headers.get('authorization');if(!token||token.length>8192||!/^Bearer [A-Za-z0-9._~-]+$/.test(token))return reply(401);
    if(request.body)return reply(400);
    const response=await transport(EDGE_BASE+url.pathname,{method:'POST',headers:{authorization:token,'x-authority-key':env.MOBILE_AUTHORITY_SERVER_KEY},redirect:'error',cache:'no-store',signal:AbortSignal.timeout(4800)});
    if(response.redirected||response.status>=300&&response.status<400||!response.ok)return reply(response.status===401?401:503);
    const reader=response.body?.getReader();if(!reader)return reply(503);const chunks:Uint8Array[]=[];let size=0;
    try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096){await reader.cancel();return reply(503);}chunks.push(value);}}finally{reader.releaseLock();}
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
    const data=JSON.parse(new TextDecoder().decode(bytes));
    if(!data||typeof data.active!=='boolean'||data.policyVersion!=='native-test-v1')return reply(503);
    // Explicit field allowlist prevents accidental upstream debug/credential leakage.
    const fields=['active','subject','sessionId','confirmedEmail','googleIdentity','userEnabled','policyVersion','checkedAt','inactiveAt','absoluteExpiresAt'];
    return Response.json(Object.fromEntries(fields.map(k=>[k,data[k]])),{headers:{'cache-control':'private, no-store'}});
  }catch{return reply(503);}
}};}
export default createAuthorityProxy();
