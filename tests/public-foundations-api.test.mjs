import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { createHouseholdApi } from '../app/household-api.ts';
import { parseDashboardContract } from '../app/dashboard-data.ts';
import { createBrowserDataRepository } from '../app/data-repository.ts';
import { createHouseholdExport } from '../app/household-export.ts';
import { HouseholdSync } from '../app/household-sync.ts';
const fixture = () => parseDashboardContract(JSON.parse(readFileSync(new URL('fixtures/legacy-v0.json', import.meta.url), 'utf8')));
const storage = () => { const values = new Map(); return { getItem:k=>values.get(k)??null, setItem:(k,v)=>values.set(k,v), removeItem:k=>values.delete(k) }; };
function setup() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../drizzle/0000_third_baron_zemo.sql', import.meta.url),'utf8'));
  for (const id of ['a','b']) {
    sqlite.prepare('INSERT INTO households VALUES (?, ?, ?, 0, 0)').run(id,'Synthetic '+id,id+'@example.test');
    sqlite.prepare('INSERT INTO household_state VALUES (?, NULL, 0, NULL, 0)').run(id);
    sqlite.prepare("INSERT INTO household_members VALUES (?, ?, NULL, 'owner', 'active', NULL, 0, 0)").run(id+'@example.test',id);
  }
  const db = { prepare(sql) { let params=[]; return { bind(...p){params=p;return this;}, async run(){return {meta:{changes:Number(sqlite.prepare(sql).run(...params).changes)}};}, async first(){return sqlite.prepare(sql).get(...params)??null;} }; } };
  const apiFor = email => createHouseholdApi(async()=>{
    const member=sqlite.prepare("SELECT household_id, role FROM household_members WHERE email=? AND status='active'").get(email);
    return member ? {db,member,user:{email}} : null;
  },async()=>[]);
  return {sqlite,apiFor,db};
}
const request=(contract,revision=0,id="a")=>new Request('http://localhost/api/household?household_id=b',{method:'PUT',headers:{'x-debtfree-identity':id+'@example.test','x-debtfree-household':id},body:JSON.stringify({payload:contract,revision,household_id:'b'})});
test('direct API ignores forged household ID; stranger denied; read/write and export contents isolated',async()=>{
  const {sqlite,apiFor}=setup(); try {
    const a=apiFor('a@example.test'),b=apiFor('b@example.test'),stranger=apiFor('outsider@example.test');
    assert.equal((await a.PUT(request(fixture()))).status,200);
    assert.equal((await (await b.GET()).json()).payload,null);
    assert.equal((await (await a.GET()).json()).payload.payload.accounts.length,fixture().payload.accounts.length);
    assert.equal((await stranger.GET()).status,401); assert.equal((await stranger.PUT(request(fixture()))).status,401);
    sqlite.prepare("UPDATE household_members SET role='viewer' WHERE email='a@example.test'").run();
    assert.equal((await a.PUT(request(fixture(),1))).status,403);
    sqlite.prepare("DELETE FROM household_members WHERE email='a@example.test'").run();
    assert.equal((await a.GET()).status,401); assert.equal((await a.PUT(request(fixture(),1))).status,401);
  } finally {sqlite.close();}
});
test('lost response retry succeeds once; stale conflicting writes cannot erase newer history',async()=>{
 const {sqlite,apiFor}=setup(); try {
   const api=apiFor('a@example.test'); const contract=fixture(); const original=JSON.stringify(contract);
   assert.equal((await api.PUT(request(contract))).status,200);
   assert.equal((await api.PUT(request(JSON.parse(original)))).status,200);
   assert.equal((await (await api.GET()).json()).revision,1);
   const different=fixture(); different.payload.extra=43;
   assert.equal((await api.PUT(request(different))).status,409);
   assert.equal((await api.PUT(request(different,1))).status,200);
   assert.equal((await api.PUT(request(JSON.parse(original)))).status,409);
   assert.equal((await (await api.GET()).json()).payload.payload.extra,43);
 }finally{sqlite.close();}
});
test('identity and household cache scopes isolate drafts/checkpoints; legacy cache remains explicit recovery only',async()=>{
 const store=storage(); const repo=scope=>createBrowserDataRepository(()=>true,()=>store,scope);
 await repo(undefined).saveHousehold(fixture());
 assert.equal((await repo('a:a').loadHousehold()).contract,null);
 await repo('a:a').saveHousehold(fixture()); await repo('a:a').checkpoint(fixture());
 assert.equal((await repo('b:b').loadHousehold()).contract,null); assert.equal(await repo('b:b').loadCheckpoint(),null);
 assert.equal((await repo('a:b').loadHousehold()).contract,null);
 await repo('b:b').resetHousehold(); assert.ok((await repo('a:a').loadHousehold()).contract); assert.ok(await repo('a:a').loadCheckpoint());
});
test('session expiry revokes further staging and retains recovery draft',async()=>{
 let expire=false; const states=[];
 const sync=new HouseholdSync({storage:storage(),key:'test',status:s=>states.push(s),request:async()=>expire?new Response('',{status:401}):Response.json({role:'owner',payload:fixture(),revision:0,members:[],householdName:'Test'})});
 await sync.load(); expire=true; await assert.rejects(sync.refresh());
 sync.stage(fixture()); assert.equal(sync.pending,null); assert.equal(states.at(-1),'unauthorized'); sync.dispose();
});

test('persisted export preserves history and saved snapshot/date; restore into another isolated database',async()=>{
 const {sqlite,apiFor,db}=setup(); const target=setup(); try {
   const contract=fixture(); contract.payload.monthlyPlan={...contract.payload.monthlyPlan, progressStartingBalance:61871.72};
   await apiFor('a@example.test').PUT(request(contract));
   const exportA=createHouseholdExport(async()=>({db,user:{email:'a@example.test'},member:{household_id:'a'}}));
   const exportB=createHouseholdExport(async()=>({db,user:{email:'b@example.test'},member:{household_id:'b'}}));
   assert.equal((await exportB()).status,404);
   assert.equal((await createHouseholdExport(async()=>null)()).status,401);
   const response=await exportA(); assert.equal(response.status,200); assert.equal(response.headers.get('cache-control'),'private, no-store');
   const exported=parseDashboardContract(JSON.parse(await response.text()));
   assert.deepEqual(exported.payload,contract.payload);
   assert.equal((await target.apiFor('b@example.test').PUT(request(exported,0,"b"))).status,200);
   assert.deepEqual((await (await target.apiFor('b@example.test').GET()).json()).payload.payload,contract.payload);
 }finally{sqlite.close();target.sqlite.close();}
});
