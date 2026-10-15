import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { provisionPreviewIsolation, PREVIEW_ACCOUNT, PREVIEW_DATABASE, PRODUCTION_DATABASE_ID, ISOLATION_HOUSEHOLD_ID } from '../scripts/provision-preview-isolation.mjs';
const owner='owner@example.test',identity='isolation@example.test';
const options={accountId:PREVIEW_ACCOUNT,ownerEmail:owner,testEmail:identity};
const previewId='11111111-1111-4111-8111-111111111111';
function setup(t) {
 const sqlite=new DatabaseSync(':memory:');t.after(()=>sqlite.close());
 sqlite.exec(readFileSync(new URL('../drizzle/0000_third_baron_zemo.sql',import.meta.url),'utf8'));
 const data=JSON.stringify({accounts:[{name:'Synthetic existing card',balance:12345}],snapshots:[{date:'2026-07-03',starting:15000}]});
 sqlite.prepare('INSERT INTO households VALUES (?, ?, ?, 0, 0)').run('existing','Synthetic original household',owner);
 sqlite.prepare("INSERT INTO household_members VALUES (?, 'existing', NULL, 'owner', 'active', NULL, 0, 0)").run(owner);
 sqlite.prepare("INSERT INTO household_state VALUES ('existing', ?, 5, ?, 0)").run(data,owner);
 let batches=0,beforeBatch;
 const api=async(path,body)=>{
   if(!body) return [{name:PREVIEW_DATABASE,uuid:previewId}];
   assert.equal(path,'/d1/database/'+previewId+'/query');
   if(body.batch){batches++;beforeBatch?.();sqlite.exec('BEGIN');try{
     const results=body.batch.map(query=>{sqlite.prepare(query.sql).run(...query.params);return {success:true,results:[]};});sqlite.exec('COMMIT');return results;
   }catch(error){sqlite.exec('ROLLBACK');throw error;}}
   return [{success:true,results:sqlite.prepare(body.sql).all(...body.params)}];
 };
 const original=()=>({household:sqlite.prepare("SELECT * FROM households WHERE id='existing'").get(),member:sqlite.prepare('SELECT * FROM household_members WHERE email=?').get(owner),state:sqlite.prepare("SELECT * FROM household_state WHERE household_id='existing'").get()});
 return {sqlite,api,original,batches:()=>batches,beforeBatch(fn){beforeBatch=fn;}};
}
test('private fixture creates a separate empty household without changing original data and is retry-safe',async t=>{
 const env=setup(t),before=env.original();
 assert.equal((await provisionPreviewIsolation(options,env.api)).outcome,'created');
 assert.deepEqual(env.original(),before);
 const member=env.sqlite.prepare('SELECT household_id,role,status FROM household_members WHERE email=?').get(identity);
 assert.equal(member.household_id,ISOLATION_HOUSEHOLD_ID);assert.equal(member.role,'owner');assert.equal(member.status,'active');
 const state=env.sqlite.prepare('SELECT payload,revision FROM household_state WHERE household_id=?').get(ISOLATION_HOUSEHOLD_ID);
 assert.equal(state.payload,null);assert.equal(state.revision,0);
 assert.equal((await provisionPreviewIsolation(options,env.api)).outcome,'already_configured');assert.equal(env.batches(),1);assert.deepEqual(env.original(),before);
});
test('an existing configured test household with saved progress is never reset on retry',async t=>{
 const env=setup(t);await provisionPreviewIsolation(options,env.api);
 env.sqlite.prepare('UPDATE household_state SET payload=?,revision=42 WHERE household_id=?').run(JSON.stringify({syntheticHistory:['payment','snapshot']}),ISOLATION_HOUSEHOLD_ID);
 const before=env.sqlite.prepare('SELECT * FROM household_state WHERE household_id=?').get(ISOLATION_HOUSEHOLD_ID);
 await provisionPreviewIsolation(options,env.api);assert.deepEqual(env.sqlite.prepare('SELECT * FROM household_state WHERE household_id=?').get(ISOLATION_HOUSEHOLD_ID),before);assert.equal(env.batches(),1);
});
for(const altered of [{accountId:'wrong-account'},{testEmail:''},{testEmail:'not-email'},{testEmail:owner}])test('invalid fixture configuration fails before contacting resources: '+JSON.stringify(altered),async()=>{
 let calls=0;await assert.rejects(provisionPreviewIsolation({...options,...altered},async()=>{calls++;return [];}));assert.equal(calls,0);
});
test('production ID masquerading as preview and missing/ambiguous preview resources are rejected',async()=>{
 for(const databases of [[{name:PREVIEW_DATABASE,uuid:PRODUCTION_DATABASE_ID}],[],[{name:PREVIEW_DATABASE,uuid:previewId},{name:PREVIEW_DATABASE,uuid:previewId}]]){
 let queries=0;await assert.rejects(provisionPreviewIsolation(options,async(_path,body)=>{if(body)queries++;return databases;}),/isolation guard/);assert.equal(queries,0);
 }
});
test('existing membership in another preview household is never moved or upgraded',async t=>{
 const env=setup(t);env.sqlite.prepare("INSERT INTO household_members VALUES (?, 'existing', NULL, 'viewer', 'active', NULL, 0, 0)").run(identity);
 const before=env.original(),member=env.sqlite.prepare('SELECT * FROM household_members WHERE email=?').get(identity);
 await assert.rejects(provisionPreviewIsolation(options,env.api),/different preview membership/);assert.equal(env.batches(),0);assert.deepEqual(env.original(),before);assert.deepEqual(env.sqlite.prepare('SELECT * FROM household_members WHERE email=?').get(identity),member);
});
test('fixture household owned by another identity is left intact',async t=>{
 const env=setup(t);env.sqlite.prepare('INSERT INTO households VALUES (?, ?, ?, 0, 0)').run(ISOLATION_HOUSEHOLD_ID,'Synthetic collision','unrelated@example.test');
 await assert.rejects(provisionPreviewIsolation(options,env.api),/belongs to another identity/);assert.equal(env.batches(),0);assert.equal(env.sqlite.prepare('SELECT owner_email FROM households WHERE id=?').get(ISOLATION_HOUSEHOLD_ID).owner_email,'unrelated@example.test');
});
test('a concurrent membership collision rolls back the fixture instead of overwriting or leaving partial rows',async t=>{
 const env=setup(t),before=env.original();env.beforeBatch(()=>env.sqlite.prepare("INSERT INTO household_members VALUES (?, 'existing', NULL, 'viewer', 'active', NULL, 0, 0)").run(identity));
 await assert.rejects(provisionPreviewIsolation(options,env.api));assert.equal(env.sqlite.prepare('SELECT id FROM households WHERE id=?').get(ISOLATION_HOUSEHOLD_ID),undefined);assert.equal(env.sqlite.prepare('SELECT household_id FROM household_state WHERE household_id=?').get(ISOLATION_HOUSEHOLD_ID),undefined);assert.deepEqual(env.original(),before);assert.equal(env.sqlite.prepare('SELECT household_id FROM household_members WHERE email=?').get(identity).household_id,'existing');
});
