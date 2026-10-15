import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { parseDashboardContract } from '../app/dashboard-data.ts';
import { HouseholdSync } from '../app/household-sync.ts';
import { householdRecoveryDrafts, householdOutboxPrefix } from '../app/household-recovery.ts';
const scope = {identity:'synthetic@example.test',householdId:'synthetic-household'};
const fixture = () => parseDashboardContract(JSON.parse(readFileSync(new URL('fixtures/legacy-v0.json',import.meta.url),'utf8')));
const storage = () => {const values=new Map();return {get length(){return values.size;},key:i=>[...values.keys()][i]??null,getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};};
const remote = (contract,revision) => Response.json({...scope,payload:contract,revision,role:'owner',householdName:'Synthetic',members:[]});
test('a new tab discovers only its household drafts and does not silently adopt or discard them',async()=>{
 const store=storage(),contract=fixture(),prefix=householdOutboxPrefix(scope);
 const original=JSON.stringify({revision:0,contract});store.setItem(prefix+'closed-tab',original);
 store.setItem(householdOutboxPrefix({...scope,identity:'other@example.test'})+'closed-tab',original);
 store.setItem(householdOutboxPrefix({...scope,householdId:'other-household'})+'closed-tab',original);
 store.setItem(prefix+'broken','not-json');
 const rows=householdRecoveryDrafts(store,scope,prefix+'new-tab');
 assert.equal(rows.length,1);assert.equal(rows[0].key,prefix+'closed-tab');
 assert.equal(store.getItem(prefix+'new-tab'),null);assert.equal(store.getItem(prefix+'closed-tab'),original);
 assert.equal(householdRecoveryDrafts(store,scope,prefix+'new-tab',contract).length,0);
});
test('explicit restored draft keeps stale revision and cannot erase newer partner history',async()=>{
 const store=storage(),draft=fixture(),saved=fixture();saved.payload.extra=321;
 let writes=0,status;const sync=new HouseholdSync({storage:store,key:householdOutboxPrefix(scope)+'new-tab',scope,status:s=>status=s,request:async(_url,init)=>{if(init?.method==='PUT'){writes++;return Response.json({}, {status:409});}return remote(saved,1);}});
 try {await sync.load();sync.recoverDraft({revision:0,contract:draft});await sync.flush();assert.equal(status,'conflict');assert.equal(writes,0);assert.equal(sync.pending.revision,0);assert.deepEqual(sync.pending.contract.payload,draft.payload);assert.ok(store.getItem(householdOutboxPrefix(scope)+'new-tab'));}finally{sync.dispose();}
});
for (const changedSource of [false,true]) test('successful recovery cleans only the unchanged source draft: '+changedSource,async()=>{
 const store=storage(),draft=fixture(),prefix=householdOutboxPrefix(scope),key=prefix+'closed-tab';
 const raw=JSON.stringify({revision:0,contract:draft});store.setItem(key,raw);
 const sync=new HouseholdSync({storage:store,key:prefix+'new-tab',scope,status:()=>{},request:async(_url,init)=>{
   if(init?.method==='PUT'){if(changedSource) store.setItem(key,JSON.stringify({revision:0,contract:{...draft,payload:{...draft.payload,extra:999}}}));return Response.json({revision:1});}
   return remote(null,0);
 }});
 try {await sync.load();sync.recoverDraft({key,revision:0,contract:draft});for(let i=0;i<20&&sync.pending;i++) await new Promise(resolve=>setImmediate(resolve));assert.equal(sync.pending,null);assert.equal(Boolean(store.getItem(key)),changedSource);assert.equal(store.getItem(prefix+'new-tab'),null);}finally{sync.dispose();}
});
test('an explicit recovery choice cannot load another household outbox',async()=>{
 const store=storage(),draft=fixture();const sync=new HouseholdSync({storage:store,key:householdOutboxPrefix(scope)+'new-tab',scope,status:()=>{},request:async()=>remote(draft,0)});
 try{await sync.load();assert.throws(()=>sync.recoverDraft({key:householdOutboxPrefix({...scope,householdId:'foreign'})+'tab',revision:0,contract:draft}),/another household/);assert.equal(sync.pending,null);}finally{sync.dispose();}
});
