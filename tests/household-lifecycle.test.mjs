import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { createLifecycleApi } from '../app/household-lifecycle.ts';

function fixture() {
  const sql = new DatabaseSync(':memory:'); sql.exec('PRAGMA foreign_keys=ON');
  for (const file of ['0000_third_baron_zemo.sql', '0001_household_lifecycle.sql']) sql.exec(readFileSync(new URL('../drizzle/' + file, import.meta.url), 'utf8'));
  sql.exec(`INSERT INTO households VALUES ('a','A','owner@example.test',0,0),('b','B','other@example.test',0,0);
    INSERT INTO household_members VALUES ('owner@example.test','a','Owner','owner','active',NULL,0,0),('admin@example.test','a','Admin','admin','active',NULL,0,0),('viewer@example.test','a','Viewer','viewer','active',NULL,0,0),('other@example.test','b','Other','owner','active',NULL,0,0);
    INSERT INTO household_state VALUES ('a','financial records unchanged',9,'owner@example.test',0),('b',NULL,0,'other@example.test',0);`);
  const db = { prepare(query) { let values = []; const statement = { bind(...args) { values=args; return statement; }, async first() { return sql.prepare(query).get(...values) ?? null; }, async all() { return { results: sql.prepare(query).all(...values) }; }, async run() { const result = sql.prepare(query).run(...values); return { meta: { changes: Number(result.changes) } }; } }; return statement; }, async batch(statements) { sql.exec('BEGIN'); try { const result=[]; for (const statement of statements) result.push(await statement.run()); sql.exec('COMMIT'); return result; } catch(error) { sql.exec('ROLLBACK'); throw error; } } };
  let email = 'owner@example.test'; let enabled = true;
  const api = createLifecycleApi({ db: () => db, user: async () => email ? { email, displayName: 'Test' } : null, settings: () => ({enabled, creationEmails: ['new@example.test']}) });
  const get = () => api.GET(new Request('https://app.test/api/household/lifecycle'));
  const post = (body, overrides = {}) => api.POST(new Request('https://app.test/api/household/lifecycle', { method:'POST', headers:{ origin:'https://app.test', 'x-debtfree-identity':email, 'x-debtfree-household':sql.prepare('SELECT household_id FROM household_members WHERE email=?').get(email)?.household_id ?? '', ...overrides }, body:JSON.stringify(body) }));
  return {sql, get, post, as(value) {email=value;}, enable(value) {enabled=value;}};
}
test('invitations require intended verified identity and explicit acceptance, not sign-in', async () => {
  const f=fixture();
  const created=await f.post({action:'invite',email:' NEW@example.test ',role:'admin'}); assert.equal(created.status,200); const {id}=await created.json();
  assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM household_members').get().n,4);
  f.as('unrelated@example.test'); assert.deepEqual((await (await f.get()).json()).inbox,[]); assert.equal((await f.post({action:'accept',id})).status,409);
  f.as('new@example.test'); assert.equal((await (await f.get()).json()).inbox.length,1); assert.equal((await f.post({action:'accept',id})).status,200);
  assert.equal(f.sql.prepare('SELECT role FROM household_members WHERE email=?').get('new@example.test').role,'admin');
  assert.equal((await f.post({action:'accept',id})).status,409);
  assert.equal(f.sql.prepare('SELECT payload FROM household_state WHERE household_id=?').get('a').payload,'financial records unchanged');
});
test('expired, revoked and reissued invitations never activate membership', async () => {
  const f=fixture(); const first=await (await f.post({action:'invite',email:'new@example.test',role:'viewer'})).json();
  const second=await (await f.post({action:'invite',email:'new@example.test',role:'admin'})).json();
  f.as('new@example.test'); assert.equal((await f.post({action:'accept',id:first.id})).status,409);
  f.sql.prepare('UPDATE household_invitations SET expires_at=0 WHERE id=?').run(second.id); assert.equal((await f.post({action:'accept',id:second.id})).status,409);
  f.as('owner@example.test'); const third=await (await f.post({action:'invite',email:'new@example.test',role:'admin'})).json();
  await f.post({action:'revoke',id:third.id}); f.as('new@example.test'); assert.equal((await f.post({action:'accept',id:third.id})).status,409);
});
test('owner-only role/removal, household scoping, and origin/account boundaries', async () => {
  const f=fixture();
  for (const email of ['admin@example.test','viewer@example.test']) {f.as(email); for(const action of ['invite','role','remove','revoke']) assert.equal((await f.post({action,email:'other@example.test',role:'admin',id:'guess'})).status,403);}
  f.as('owner@example.test'); assert.equal((await f.post({action:'remove',email:'other@example.test'})).status,200); assert.ok(f.sql.prepare('SELECT email FROM household_members WHERE email=?').get('other@example.test'));
  assert.equal((await f.post({action:'role',email:'owner@example.test',role:'viewer'})).status,400);
  assert.equal((await f.post({action:'role',email:'admin@example.test',role:'owner'})).status,400);
  assert.equal((await f.post({action:'role',email:'admin@example.test',role:'viewer'})).status,200);
  assert.equal((await f.post({action:'leave',confirmation:'LEAVE'})).status,409);
  for(const override of [{origin:'https://evil.test'},{'x-debtfree-identity':'other@example.test'},{'x-debtfree-household':'b'}]) assert.equal((await f.post({action:'remove',email:'viewer@example.test'},override)).status,403);
});
test('leave preserves finances, blocks further household actions; owner deletion is a cancellable request', async () => {
  const f=fixture(); f.as('viewer@example.test'); assert.equal((await f.post({action:'leave',confirmation:'no'})).status,400); assert.equal((await f.post({action:'leave',confirmation:'LEAVE'})).status,200); assert.equal((await f.post({action:'invite',email:'new@example.test',role:'admin'})).status,403);
  f.as('owner@example.test'); assert.equal((await f.post({action:'request_deletion',confirmation:'DELETE'})).status,200); assert.equal((await f.post({action:'request_deletion',confirmation:'DELETE'})).status,200); assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM household_requests').get().n,1);
  assert.equal(f.sql.prepare('SELECT kind FROM household_requests').get().kind,'delete_household'); assert.equal(f.sql.prepare('SELECT revision FROM household_state WHERE household_id=?').get('a').revision,9);
  await f.post({action:'cancel_deletion'}); assert.equal((await (await f.get()).json()).requests.length,0);
});
test('new household creation is explicitly allowlisted and starts with empty state', async () => {
  const f=fixture(); f.as('unknown@example.test'); assert.equal((await f.post({action:'create',name:'Test'})).status,403); f.as('new@example.test'); assert.equal((await f.post({action:'create',name:'  '})).status,400); assert.equal((await f.post({action:'create',name:'New household'})).status,200);
  const member=f.sql.prepare('SELECT * FROM household_members WHERE email=?').get('new@example.test'); const state=f.sql.prepare('SELECT * FROM household_state WHERE household_id=?').get(member.household_id); assert.equal(state.payload,null); assert.equal(state.revision,0);
  assert.equal((await f.post({action:'create',name:'Again'})).status,409);
  f.enable(false); assert.equal((await f.get()).status,404); f.enable(true); f.as(''); assert.equal((await f.get()).status,401);
});
test('invitation flood limit, oversized bodies and legacy acceptance', async () => {
  const f=fixture(); for(let i=0;i<20;i++) assert.equal((await f.post({action:'invite',email:`new${i}@example.test`,role:'viewer'})).status,200);
  assert.equal((await f.post({action:'invite',email:'last@example.test',role:'viewer'})).status,429);
  assert.equal((await f.post({action:'invite',email:'x'.repeat(9000)})).status,400);
  f.sql.exec("INSERT INTO household_members VALUES ('legacy@example.test','a',NULL,'viewer','invited','owner@example.test',0,0)"); f.as('legacy@example.test'); assert.equal((await f.post({action:'accept_legacy'})).status,200); assert.equal(f.sql.prepare('SELECT status FROM household_members WHERE email=?').get('legacy@example.test').status,'active');
});

test('deletion request remains visible and cancellable after membership removal', async () => {
  const f=fixture(); f.as('admin@example.test'); await f.post({action:'request_deletion',confirmation:'DELETE'});
  f.as('owner@example.test'); await f.post({action:'remove',email:'admin@example.test'});
  f.as('admin@example.test'); assert.equal((await (await f.get()).json()).requests.length,1); assert.equal((await f.post({action:'cancel_deletion'})).status,200); assert.equal((await (await f.get()).json()).requests.length,0);
});

test('removal and leaving atomically revoke pending rejoin invitations', async () => {
  for (const action of ['remove','leave']) {
    const f=fixture();
    const {id}=await (await f.post({action:'invite',email:'new@example.test',role:'viewer'})).json();
    // Simulate acceptance racing an invitation reissue: an active member can
    // have an outstanding invitation created after the earlier preflight read.
    f.sql.exec("INSERT INTO household_members VALUES ('new@example.test','a','New','viewer','active','owner@example.test',0,0)");
    if(action==='leave') f.as('new@example.test');
    assert.equal((await f.post({action,email:'new@example.test',confirmation:'LEAVE'})).status,200);
    f.as('new@example.test'); assert.equal((await f.post({action:'accept',id})).status,409);
    assert.equal(f.sql.prepare('SELECT outcome FROM household_invitations WHERE id=?').get(id).outcome,'revoked');
  }
});

test('only the owner can rename the current household; identity and financial history stay intact',async()=>{
 const f=fixture(); f.as('admin@example.test'); assert.equal((await f.post({action:'rename',name:'New'})).status,403);
 f.as('owner@example.test'); assert.equal((await f.post({action:'rename',name:'  '})).status,400);
 assert.equal((await f.post({action:'rename',name:'New household'})).status,200);
 assert.equal(f.sql.prepare("SELECT name FROM households WHERE id='a'").get().name,'New household');
 assert.equal(f.sql.prepare("SELECT name FROM households WHERE id='b'").get().name,'B');
 assert.equal(f.sql.prepare("SELECT revision FROM household_state WHERE household_id='a'").get().revision,9);
});
