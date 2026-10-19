export interface RevisionSocket { send(data: string): void; close(code: number, reason: string): void }
type Subscriber = { token: string; householdId: string; socket: RevisionSocket };
export class HouseholdNotificationHub {
  private subscribers = new Map<RevisionSocket, Subscriber>();
  private tickets = new Map<string, { token: string; householdId: string; expires: number }>();
  private authorize: (token: string, householdId: string) => Promise<boolean>;
  constructor(authorize: (token: string, householdId: string) => Promise<boolean>) { this.authorize = authorize; }
  async ticket(token: string, householdId: string, now = Date.now()) {
    for (const [key,value] of this.tickets) if(value.expires<=now) this.tickets.delete(key);
    if(this.tickets.size>=256 || !await this.authorize(token,householdId)) throw new Error('Ticket denied');
    const ticket=crypto.randomUUID();this.tickets.set(ticket,{token,householdId,expires:now+30_000});return ticket;
  }
  async subscribeTicket(ticket: string, householdId: string, socket: RevisionSocket, now = Date.now()) {
    const value=this.tickets.get(ticket);this.tickets.delete(ticket); // consume before asynchronous authority check
    if(!value||value.expires<=now||value.householdId!==householdId){socket.close(1008,'Ticket denied');return false;}
    return this.subscribe(value.token,householdId,socket);
  }
  async subscribe(token: string, householdId: string, socket: RevisionSocket) {
    let allowed = false; try { allowed = await this.authorize(token, householdId); } catch { /* fail closed */ }
    if (!allowed) { socket.close(1008, 'Access denied'); return false; }
    this.subscribers.set(socket, { token, householdId, socket }); return true;
  }
  unsubscribe(socket: RevisionSocket) { this.subscribers.delete(socket); }
  get size() { return this.subscribers.size; }
  private async live(subscriber: Subscriber) {
    let allowed = false; try { allowed = await this.authorize(subscriber.token, subscriber.householdId); } catch { /* fail closed */ }
    if (!allowed) { this.unsubscribe(subscriber.socket); subscriber.socket.close(1008, 'Access expired'); }
    return allowed;
  }
  async recheck() { await Promise.all([...this.subscribers.values()].map(s => this.live(s))); }
  async publish(householdId: string, revision: number) {
    if (!Number.isSafeInteger(revision) || revision < 0) throw new Error('Invalid revision.');
    await Promise.all([...this.subscribers.values()].filter(s => s.householdId === householdId).map(async s => { if (await this.live(s) && this.subscribers.has(s.socket)) { try { s.socket.send(JSON.stringify({ type: 'revision-changed', revision })); } catch { this.unsubscribe(s.socket); s.socket.close(1011,'Reconnect'); } } }));
  }
}
