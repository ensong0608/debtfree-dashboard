import test from 'node:test';
import assert from 'node:assert/strict';
import {migrateLegacyGroups, neutralGroups, validDisplayName} from '../app/debt-groups.ts';
import {debtDisplayPlacement, arrangeDebt} from '../app/debts-screen.ts';
import {parseDashboardContract,serializeDashboardBackup} from '../app/dashboard-data.ts';
import {readFileSync} from 'node:fs';
test('legacy assignments migrate once; new households and new lender names stay neutral',()=>{
 const card={id:'a',name:'Costco',balance:100};
 assert.equal(debtDisplayPlacement(card).group,'Other');
 const migrated=migrateLegacyGroups([card]); assert.equal(migrated.accounts[0].displayGroup,'Papi');
 const renamed=migrated.groups.map(group=>({...group,name:group.id==='Papi'?'Ensong':group.name}));
 assert.deepEqual(migrateLegacyGroups(migrated.accounts,renamed),{accounts:migrated.accounts,groups:renamed});
 assert.deepEqual(migrateLegacyGroups([]).groups,neutralGroups);
 const moved=arrangeDebt(migrated.accounts,'a','group-new');assert.equal(moved[0].displayGroup,'group-new');assert.equal(moved[0].id,'a');assert.equal(moved[0].balance,100);
});
test('group labels validate and survive export/import without changing debt identities',()=>{
 assert.equal(validDisplayName('  '),false);assert.equal(validDisplayName('bad\nname'),false);assert.equal(validDisplayName('A'.repeat(41)),false);
 const original=parseDashboardContract(JSON.parse(readFileSync('tests/fixtures/legacy-v0.json','utf8')));
 original.payload.monthlyPlan={...original.payload.monthlyPlan,debtGroups:[{id:'Other',name:'Shared'},{id:'group-one',name:'Ensong'}]};
 original.payload.accounts[0].displayGroup='group-one';
 const result=parseDashboardContract(JSON.parse(serializeDashboardBackup(original)));
 assert.equal(result.payload.accounts[0].id,original.payload.accounts[0].id);assert.equal(result.payload.accounts[0].displayGroup,'group-one');
 assert.equal(result.payload.monthlyPlan.debtGroups[1].name,'Ensong');
 original.payload.monthlyPlan.debtGroups.push({id:'group-two',name:'ensong'});assert.throws(()=>parseDashboardContract(original),/unique names/);
});

test('migration of an unrecognized lender remains valid for durable saving',()=>{
 const original=parseDashboardContract(JSON.parse(readFileSync('tests/fixtures/legacy-v0.json','utf8')));
 original.payload.accounts[0].name='Everyday card';
 const migrated=migrateLegacyGroups(original.payload.accounts);
 original.payload.accounts=migrated.accounts;
 original.payload.monthlyPlan={...original.payload.monthlyPlan,debtGroups:migrated.groups};
 assert.equal(parseDashboardContract(JSON.parse(serializeDashboardBackup(original))).payload.accounts[0].displayGroup,'Other');
});

test('merging a legacy backup preserves custom groups and the original household baseline',async()=>{
 const {mergeDashboardPayload}=await import('../app/data-transfer.ts');
 const current=parseDashboardContract(JSON.parse(readFileSync('tests/fixtures/legacy-v0.json','utf8'))).payload;
 current.monthlyPlan={...current.monthlyPlan,debtGroups:[{id:'Other',name:'Shared'},{id:'group-owner',name:'Ensong'}],progressStartingBalance:20000};
 current.accounts=current.accounts.map(a=>({...a,displayGroup:'group-owner'}));
 const incoming=structuredClone(current);incoming.accounts=[{...incoming.accounts[0],id:'legacy-extra',name:'Discover',displayGroup:undefined}];delete incoming.monthlyPlan.debtGroups;incoming.monthlyPlan.progressStartingBalance=1;
 const merged=mergeDashboardPayload(current,incoming);
 assert.equal(merged.monthlyPlan.progressStartingBalance,20000);
 assert.equal(merged.accounts.find(a=>a.id==='legacy-extra').displayGroup,'Mama');
 assert.equal(merged.monthlyPlan.debtGroups.find(g=>g.id==='group-owner').name,'Ensong');
 assert.equal(parseDashboardContract({format:'debtfree-dashboard-backup',version:6,exportedAt:new Date().toISOString(),payload:merged}).payload.accounts.length,current.accounts.length+1);
});
