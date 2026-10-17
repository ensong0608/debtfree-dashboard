import {mkdtemp, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {parseDashboardContract} from '../app/dashboard-data.ts';
import {PREVIEW_ACCOUNT, PRODUCTION_DATABASE_ID} from './provision-preview-isolation.mjs';
// This drill never writes production or any existing preview database.
const tables=['households','household_members','household_state','household_invitations','household_requests'];
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
const digest=rows=>createHash('sha256').update(JSON.stringify(rows.map(r=>JSON.stringify(canonical(r))).sort())).digest('hex');
let created, directory, stage='configuration';
const account=process.env.CLOUDFLARE_ACCOUNT_ID;
async function api(path, method='GET', body) {
 const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}${path}`,{method,headers:{authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(60000)});
 const data=await response.json();if(!response.ok||!data.success)throw new Error('Remote operation unavailable');return data.result;
}
try {
 if(account!==PREVIEW_ACCOUNT||!process.env.CLOUDFLARE_API_TOKEN||process.env.GITHUB_REF!=='refs/heads/codex/production-release-20261015')throw new Error('Unexpected configuration');
 directory=await mkdtemp(join(tmpdir(),'debtfree-remote-recovery-'));
 const sql=join(directory,'checkpoint.sql');
 const cli=(...args)=>execFileSync(process.execPath,[resolve('node_modules/wrangler/bin/wrangler.js'),...args],{stdio:'pipe',timeout:180000,maxBuffer:64*1024*1024,env:{...process.env,WRANGLER_SEND_METRICS:'false'}});
 stage='read-only production checkpoint';
 cli('d1','export','debtfree-dashboard-prod','--remote','--skip-confirmation','--config','wrangler.jsonc','--output',sql);
 // Expected rows come from that exact consistent export, not a later live read.
 const expected=JSON.parse(execFileSync('python3',['-c',`import sqlite3,json,sys,pathlib
c=sqlite3.connect(':memory:');c.executescript(pathlib.Path(sys.argv[1]).read_text());c.row_factory=sqlite3.Row
assert [tuple(r) for r in c.execute('PRAGMA integrity_check')]==[('ok',)]
assert c.execute('PRAGMA foreign_key_check').fetchall()==[]
print(json.dumps({t:[dict(r) for r in c.execute('SELECT * FROM '+t)] for t in json.loads(sys.argv[2])}))`,sql,JSON.stringify(tables)],{encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:64*1024*1024}));
 stage='isolated database creation';
 const name=`debtfree-recovery-drill-${process.env.GITHUB_RUN_ID}`;
 created=await api('/d1/database','POST',{name});
 if(!created.uuid||created.uuid===PRODUCTION_DATABASE_ID||created.name!==name)throw new Error('Isolation guard');
 const config=join(directory,'wrangler.json');await writeFile(config,JSON.stringify({name:'recovery-drill',compatibility_date:'2026-08-04',d1_databases:[{binding:'RESTORE',database_name:name,database_id:created.uuid}]}));
 stage='isolated remote D1 restore';
 cli('d1','execute','RESTORE','--remote','--config',config,'--file',sql,'--yes');
 stage='restored membership, revisions, state, baseline and snapshots';
 for(const table of tables) {
  const result=await api(`/d1/database/${created.uuid}/query`,'POST',{sql:'SELECT * FROM '+table});
  if(!result[0]?.success||digest(result[0].results)!==digest(expected[table]))throw new Error('Restore differs');
  if(table==='household_state')for(const row of result[0].results)if(row.payload)parseDashboardContract(JSON.parse(row.payload));
 }
 console.log('Restored rows and contracts PASSED: exact membership, revisions, financial state, original baseline, snapshots, invitations and requests. No values logged.');
 stage='remote D1 quick_check and foreign keys';
 const integrity=await api(`/d1/database/${created.uuid}/query`,'POST',{sql:'PRAGMA quick_check; PRAGMA foreign_key_check;'});
 if(integrity.some(r=>!r.success)||integrity[0].results[0]?.quick_check!=='ok'||integrity[1].results.length)throw new Error('Integrity failure');
 console.log('Remote isolated D1 recovery PASSED: exact membership, revisions, financial state, original Progress baseline, snapshots, invitations and requests match the consistent checkpoint. No production restore or values logged.');
} catch {
 console.error('Remote isolated recovery could not be verified at '+stage+'. This gate remains open; no production restore was attempted.');process.exitCode=1;
} finally {
 if(created?.uuid&&created.uuid!==PRODUCTION_DATABASE_ID&&created.name===`debtfree-recovery-drill-${process.env.GITHUB_RUN_ID}`) {
  try {await api('/d1/database/'+created.uuid,'DELETE');console.log('Disposable unbound recovery database removed.');}catch{console.error('Disposable recovery database cleanup requires operator attention.');process.exitCode=1;}
 }
 if(directory)await rm(directory,{recursive:true,force:true});
}
