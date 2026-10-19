import { enrollTestHousehold } from '../app/native-test-enrollment.ts';
import { createNativeAuthenticator, NativeAuthError, type NativeAuthConfig, type NativeLiveness } from '../app/native-auth.ts';
import { nativeHouseholdApi, nativeMember } from '../app/native-household.ts';
import { HouseholdNotificationHub } from './household-notifications.ts';
import { readBoundedBody } from '../app/request-safety.ts';
import { checkHouseholdSession } from '../app/household-session-scope.ts';
type FetchBinding = { fetch(request: Request): Promise<Response> };
export type MobileTestEnv = { TEST_ENVIRONMENT: 'debtfree-mobile-test'; TEST_API_ORIGIN: string; TEST_ISSUER: string; PRODUCTION_ISSUER: string; DB: D1Database; SESSION_AUTHORITY?: FetchBinding; HOUSEHOLD_REVISIONS_TEST?: { getByName(name: string): FetchBinding }; NOTIFICATION_INTERNAL_KEY?: string; TEST_WEBVIEW_ORIGIN?: string; TESTER_EMAILS?: string };
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'cache-control': 'private, no-store' } });
function authority(binding?: FetchBinding): NativeLiveness | undefined {
  if (!binding) return undefined;
  const call = async (path: string, token: string) => { const response = await binding.fetch(new Request('https://session-authority.internal' + path, { method: 'POST', headers: { authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(5000) })); if (!response.ok) throw new Error('Authority unavailable'); return response; };
  return { check: async token => (await call('/check', token)).json(), revoke: async token => { await call('/revoke', token); } };
}
function checkEnvironment(env: MobileTestEnv) {
  const origin = new URL(env.TEST_API_ORIGIN);
  if (env.TEST_ENVIRONMENT !== 'debtfree-mobile-test' || origin.protocol !== 'https:' || !origin.hostname.startsWith('debtfree-mobile-test.') || origin.origin !== env.TEST_API_ORIGIN || !env.DB) throw new NativeAuthError(503);
}
function authConfig(env: MobileTestEnv): NativeAuthConfig { return { environment:'test', issuer: env.TEST_ISSUER, productionIssuer:env.PRODUCTION_ISSUER, audience:'authenticated', algorithms:['ES256','RS256'] }; }
export function createMobileTestWorker(authenticateFactory = (env: MobileTestEnv) => createNativeAuthenticator(authConfig(env), authority(env.SESSION_AUTHORITY))) {
  return { async fetch(request: Request, env: MobileTestEnv): Promise<Response> {
    try {
      checkEnvironment(env); const url = new URL(request.url);
      if (url.origin !== env.TEST_API_ORIGIN || url.search || url.hash) return json({ error:'Invalid test endpoint.' },400);
      const origin = request.headers.get('origin');
      if (origin && origin !== env.TEST_WEBVIEW_ORIGIN) return json({error:'Origin denied.'},403);
      const respond = (response: Response) => { if (origin) { response.headers.set('access-control-allow-origin',origin); response.headers.set('vary','Origin'); } response.headers.set('cache-control','private, no-store'); return response; };
      if (request.method === 'OPTIONS') { if (!origin || !env.TEST_WEBVIEW_ORIGIN) return json({error:'Origin denied.'},403); return respond(new Response(null,{status:204,headers:{'access-control-allow-methods':'GET, PUT, POST','access-control-allow-headers':'authorization, content-type, x-debtfree-identity, x-debtfree-household','access-control-max-age':'0'}})); }
      // Browser WebSocket cannot set Authorization. A one-use, 30s ticket travels
      // in the subprotocol header, never a URL, and is verified again in the DO.
      const socketMatch=/^\/api\/native\/v1\/notifications\/socket\/([A-Za-z0-9-]{1,80})$/.exec(url.pathname);
      if(socketMatch){
        if(request.method!=='GET'||request.headers.has('cookie')||request.headers.has('authorization')||request.headers.get('upgrade')?.toLowerCase()!=='websocket'||!env.HOUSEHOLD_REVISIONS_TEST)return respond(json({error:'Invalid subscription'},403));
        const protocol=request.headers.get('sec-websocket-protocol');if(!protocol||!/^debtfree-revisions,\s*debtfree-ticket\.[0-9a-f-]{36}$/i.test(protocol))return respond(json({error:'Ticket required'},401));
        return env.HOUSEHOLD_REVISIONS_TEST.getByName(socketMatch[1]).fetch(new Request('https://notifications.internal/subscribe',{headers:{upgrade:'websocket','x-debtfree-household':socketMatch[1],'sec-websocket-protocol':protocol}}));
      }
      const routes: Record<string,string[]> = { '/api/native/v1/enrollment':['GET','POST'], '/api/native/v1/session':['GET'], '/api/native/v1/logout':['POST'], '/api/native/v1/household':['GET','PUT'], '/api/native/v1/notifications/ticket':['POST'] };
      if (!Object.hasOwn(routes,url.pathname)) return respond(json({error:'Not found.'},404));
      if (!routes[url.pathname].includes(request.method)) return respond(json({error:'Method not allowed.'},405));
      const auth = authenticateFactory(env), identity = await auth.authenticate(request);
      if (url.pathname === '/api/native/v1/logout') return respond(json(await auth.logout(identity)));
      if (url.pathname === '/api/native/v1/enrollment') return respond(await enrollTestHousehold(request, env.DB, identity, env.TESTER_EMAILS));
      const member = await nativeMember(env.DB,identity);
      if (!member) return respond(json({error:'Active household membership required.'},403));
      if (url.pathname === '/api/native/v1/session') return respond(json({ backendId: 'debtfree-mobile-test', issuer:env.TEST_ISSUER, subject:identity.subject, identity:identity.email, householdId:member.household_id, role:member.role }));
      if (url.pathname === '/api/native/v1/notifications/ticket') {
        const changed = checkHouseholdSession(request, { user: { email: identity.email }, member }, true);
        if (changed) return respond(changed);
        if(!env.HOUSEHOLD_REVISIONS_TEST||!env.NOTIFICATION_INTERNAL_KEY) return respond(json({error:'Notification service unavailable.'},503));
        const issued=await env.HOUSEHOLD_REVISIONS_TEST.getByName(member.household_id).fetch(new Request('https://notifications.internal/ticket',{method:'POST',headers:{authorization:'Bearer '+identity.token,'x-debtfree-household':member.household_id,'x-notification-key':env.NOTIFICATION_INTERNAL_KEY}}));
        if(!issued.ok)return respond(json({error:'Ticket denied'},503));
        const result=await issued.json() as {ticket:string};return respond(json({socketUrl:env.TEST_API_ORIGIN.replace('https:','wss:')+'/api/native/v1/notifications/socket/'+encodeURIComponent(member.household_id),protocols:['debtfree-revisions','debtfree-ticket.'+result.ticket],expiresIn:30}));
      }
      if (request.method === 'PUT' && request.headers.get('content-type')?.split(';')[0] !== 'application/json') return respond(json({error:'JSON required.'},415));
      const api = nativeHouseholdApi(env.DB,identity,member), response = request.method === 'PUT' ? await api.PUT(request) : await api.GET(request);
      if (request.method === 'PUT' && response.ok) {
        const result = await response.clone().json() as {revision:number};
        try { if (!env.HOUSEHOLD_REVISIONS_TEST || !env.NOTIFICATION_INTERNAL_KEY) throw new Error('No notifications'); const notified = await env.HOUSEHOLD_REVISIONS_TEST.getByName(member.household_id).fetch(new Request('https://notifications.internal/publish',{method:'POST',headers:{'x-notification-key':env.NOTIFICATION_INTERNAL_KEY,'content-type':'application/json'},body:JSON.stringify({householdId:member.household_id,revision:result.revision})})); if (!notified.ok) throw new Error('Notification failed'); } catch { response.headers.set('x-debtfree-notification','refetch-required'); }
      }
      return respond(response);
    } catch (error) {
      const response = json({error: error instanceof NativeAuthError ? error.message : 'Test backend unavailable.'},error instanceof NativeAuthError ? error.status : 503);
      if (env.TEST_WEBVIEW_ORIGIN === 'https://localhost' && request.headers.get('origin') === env.TEST_WEBVIEW_ORIGIN) { response.headers.set('access-control-allow-origin', env.TEST_WEBVIEW_ORIGIN); response.headers.set('vary', 'Origin'); }
      return response;
    }
  } };
}
export default createMobileTestWorker();

// No stored bearer attachments: a DO wake closes prior sockets and requires fresh auth.
export class HouseholdNotifications {
  private ctx: DurableObjectState; private env: MobileTestEnv; private hub: HouseholdNotificationHub;
  constructor(ctx: DurableObjectState, env: MobileTestEnv) {
    this.ctx=ctx; this.env=env;
    for (const socket of ctx.getWebSockets()) socket.close(1012,'Reauthenticate');
    this.hub=new HouseholdNotificationHub(async (token,id) => { checkEnvironment(env); const user=await createNativeAuthenticator(authConfig(env),authority(env.SESSION_AUTHORITY)).authenticate(new Request('https://session.internal',{headers:{authorization:'Bearer '+token}})); return (await nativeMember(env.DB,user))?.household_id === id; });
  }
  async fetch(request: Request): Promise<Response> {
    try {
      const url=new URL(request.url);
      if(url.pathname==='/ticket'&&request.method==='POST'){
        if(!this.env.NOTIFICATION_INTERNAL_KEY||request.headers.get('x-notification-key')!==this.env.NOTIFICATION_INTERNAL_KEY)return json({error:'Denied'},403);
        const token=request.headers.get('authorization')?.replace(/^Bearer /,''),id=request.headers.get('x-debtfree-household');if(!token||!id)return json({error:'Denied'},401);
        return json({ticket:await this.hub.ticket(token,id)});
      }
      if (url.pathname==='/publish' && request.method==='POST') {
        if (!this.env.NOTIFICATION_INTERNAL_KEY || request.headers.get('x-notification-key')!==this.env.NOTIFICATION_INTERNAL_KEY) return json({error:'Denied'},403);
        const raw=await readBoundedBody(request,1024);
        const body=JSON.parse(raw) as {householdId:string;revision:number}; if(typeof body.householdId!=='string'||!body.householdId) return json({error:'Invalid scope'},400);
        await this.hub.publish(body.householdId,body.revision); return json({ok:true});
      }
      if(url.pathname!=='/subscribe'||request.headers.get('upgrade')?.toLowerCase()!=='websocket') return json({error:'Not found'},404);
      const id=request.headers.get('x-debtfree-household'), protocol=request.headers.get('sec-websocket-protocol');
      const ticket=protocol?.split(',').map(p=>p.trim()).find(p=>p.startsWith('debtfree-ticket.'))?.slice('debtfree-ticket.'.length);if(!ticket||!id)return json({error:'Denied'},401);
      const pair=new WebSocketPair(), client=pair[0], server=pair[1];
      // Standard sockets keep this object resident: credentials remain memory-only.
      // Cost/scale review is required before adopting hibernation with persisted auth.
      server.accept();
      server.addEventListener('close',()=>this.hub.unsubscribe(server));
      server.addEventListener('error',()=>this.hub.unsubscribe(server));
      server.addEventListener('message',()=>{this.hub.unsubscribe(server);server.close(1008,'Receive-only channel');});
      if(!await this.hub.subscribeTicket(ticket,id,server)) return json({error:'Denied'},403);
      await this.ctx.storage.setAlarm(Date.now()+15_000);
      return new Response(null,{status:101,headers:{'sec-websocket-protocol':'debtfree-revisions'},webSocket:client});
    } catch { return json({error:'Notification authority unavailable'},503); }
  }
  async alarm() { await this.hub.recheck(); if(this.hub.size) await this.ctx.storage.setAlarm(Date.now()+15_000); }
  webSocketClose(socket: WebSocket) { this.hub.unsubscribe(socket); }
  webSocketError(socket: WebSocket) { this.hub.unsubscribe(socket); socket.close(1011,'Reconnect'); }
  webSocketMessage(socket: WebSocket) { this.hub.unsubscribe(socket); socket.close(1008,'Receive-only channel'); }
}
