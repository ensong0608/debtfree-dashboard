import test from 'node:test';
import assert from 'node:assert/strict';
import { fingerprintRows, checkedProductionTables, optionalProductionTables } from '../scripts/production-preservation.mjs';
import { restoreProductionRows } from '../scripts/production-backup-restore.mjs';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const rows=()=>({household_invitations:[{id:'invite',outcome:null}],household_requests:[{id:'request',cancelled_at:null}],households:[{id:'synthetic-b',name:'B'},{id:'synthetic-a',name:'A'}],household_members:[{email:'synthetic@example.test',role:'owner'}],household_state:[{household_id:'synthetic-a',revision:2,payload:'{"balance":100,"savedDate":"2026-07-01"}'}]});
test('production fingerprints tolerate row and column ordering, while retaining exact stored bytes',()=>{
 const a=rows(),b=rows();b.households.reverse();b.household_state=b.household_state.map(r=>Object.fromEntries(Object.entries(r).reverse()));
 assert.deepEqual(fingerprintRows(a),fingerprintRows(b));
 b.household_state[0].payload='{"balance":100, "savedDate":"2026-07-01"}';
 assert.notDeepEqual(fingerprintRows(a),fingerprintRows(b));
});
test('production preservation detects membership, revision, row removal and financial changes',()=>{
 for(const mutate of [r=>{r.household_invitations[0].outcome='revoked';},r=>{r.household_requests[0].cancelled_at=1;},r=>{r.household_members[0].role='viewer';},r=>{r.household_state[0].revision++;},r=>{r.households.pop();},r=>{r.household_state[0].payload='{"balance":99,"savedDate":"2026-07-01"}';}]) {const changed=rows();mutate(changed);assert.notDeepEqual(fingerprintRows(rows()),fingerprintRows(changed));}
 assert.throws(()=>fingerprintRows({}),/Missing/);
});

function restore(settings, extra='') {
 const dir=mkdtempSync(join(tmpdir(),'debtfree-synthetic-recovery-'));
 try {
  const migrations=['0000_third_baron_zemo.sql','0001_household_lifecycle.sql',...(settings?['0002_settings_notifications.sql']:[])];
  const sql=migrations.map(name=>readFileSync(new URL('../drizzle/'+name,import.meta.url),'utf8')).join('\n');
  const path=join(dir,'synthetic.sql');writeFileSync(path,sql+'\n'+extra);
  return restoreProductionRows(path);
 } finally {rmSync(dir,{recursive:true,force:true});}
}

test('private restoration accepts the deployed Settings schema and preserves every Settings column',()=>{
 const restored=restore(true,`
 INSERT INTO households VALUES ('h','Synthetic','synthetic@example.test',0,0);
 INSERT INTO household_members VALUES ('synthetic@example.test','h','Synthetic','owner','active',NULL,0,0);
 INSERT INTO notification_subscriptions VALUES ('s','synthetic@example.test','h','https://push.example.test','{}','{"enabled":false}',0);
 INSERT INTO notification_deliveries VALUES ('s','reminder','sent',0);
 INSERT INTO app_feedback VALUES ('f','synthetic@example.test','h','feedback','Synthetic feedback',0);
 `);
 assert.equal(restored.app_feedback[0].message,'Synthetic feedback');
 const original=fingerprintRows(restored);
 for(const table of optionalProductionTables) {
  const changed=structuredClone(restored);changed[table][0].id='changed';
  assert.notDeepEqual(fingerprintRows(changed),original);
 }
 assert.equal(Object.keys(original).length,8);
});

test('older recovery checkpoints remain supported without silently accepting missing or unexpected tables',()=>{
 const old=restore(false);
 assert.equal(Object.keys(fingerprintRows(old)).length,5);
 assert.deepEqual(checkedProductionTables(Object.keys(fingerprintRows(old))),Object.keys(fingerprintRows(old)));
 assert.throws(()=>restore(true,'CREATE TABLE unexpected_table(id TEXT);'),/Unexpected production table/);
 assert.throws(()=>fingerprintRows({...old,unexpected_table:[]}),/Unexpected/);
 assert.throws(()=>restore(false,'DROP TABLE household_requests;'),/Missing production table/);
});

test('private restoration still rejects broken foreign keys in the added Settings tables',()=>{
 assert.throws(()=>restore(true,"INSERT INTO app_feedback VALUES ('f','missing@example.test','missing','feedback','Synthetic',0);"));
});
