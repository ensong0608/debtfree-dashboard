import { validateConfig, scopeKey, type TestConfig } from './contracts.ts';
import type { NativeSession } from './session.ts';
type Connection = { addEventListener(type: 'message' | 'close' | 'error', listener: (event: { data?: unknown }) => void): void; close(): void };
type Inputs = { config: TestConfig; session: NativeSession; api: { request(path: string, init?: RequestInit): Promise<Response> }; open(url: string, protocols: string[]): Connection; revisionChanged(revision: number): Promise<void>; reconnectNeeded(): void };
/** Receives revision hints only. Caller refetches through normal authorized API,
 * retaining existing pending-draft/conflict guards; no financial state is applied here. */
export async function subscribeRevisions(input: Inputs): Promise<() => void> {
  const config=validateConfig(input.config), before=input.session.snapshot();
  if(!before.scope)throw new Error('Session is not verified.');
  const key=scopeKey(before.scope);input.session.assertCurrent(before.generation,key);
  const response=await input.api.request('/api/native/v1/notifications/ticket',{method:'POST'});
  if(!response.ok)throw new Error('Notification ticket unavailable.');
  const ticket=await response.json() as {socketUrl:string;protocols:string[];expiresIn:number};
  input.session.assertCurrent(before.generation,key);
  const expected=config.apiOrigin.replace('https:','wss:')+'/api/native/v1/notifications/socket/'+encodeURIComponent(before.scope.householdId);
  if(ticket.socketUrl!==expected||!Array.isArray(ticket.protocols)||ticket.protocols.length!==2||ticket.protocols[0]!=='debtfree-revisions'||!/^debtfree-ticket\.[0-9a-f-]{36}$/i.test(ticket.protocols[1])||ticket.expiresIn!==30)throw new Error('Invalid notification ticket.');
  const socket=input.open(ticket.socketUrl,ticket.protocols);let stopped=false,highest=-1;
  const stop=()=>{if(!stopped){stopped=true;socket.close();}};
  const failed=()=>{if(!stopped){stop();input.reconnectNeeded();}};
  socket.addEventListener('close',failed);socket.addEventListener('error',failed);
  socket.addEventListener('message',event=>{
    if(stopped)return;
    try { input.session.assertCurrent(before.generation,key); if(typeof event.data!=='string'||event.data.length>256)throw new Error('Invalid revision');
      const message=JSON.parse(event.data);if(Object.keys(message).length!==2||message.type!=='revision-changed'||!Number.isSafeInteger(message.revision)||message.revision<0)throw new Error('Invalid revision');
      if(message.revision>highest){highest=message.revision;void input.revisionChanged(message.revision).catch(failed);}
    } catch { failed(); }
  });
  return stop;
}
