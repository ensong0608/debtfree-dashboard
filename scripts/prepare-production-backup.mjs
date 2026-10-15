import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createCipheriv, randomBytes, publicEncrypt, constants, createHash } from 'node:crypto';
import { parseDashboardContract } from '../app/dashboard-data.ts';
import { inspectReleaseResources } from './inspect-release-resources.mjs';
import { PREVIEW_ACCOUNT } from './provision-preview-isolation.mjs';

// Read-only production export. No migrations, imports, financial writes or deploy.
// Only encrypted backup bytes may leave the ephemeral private working directory.
let stage = 'configuration';
const dir = await mkdtemp(join(tmpdir(), 'debtfree-private-release-'));
try {
  if (process.env.GITHUB_REF !== 'refs/heads/codex/production-release-20261015') throw new Error('Unexpected release branch');
  if (process.env.CLOUDFLARE_ACCOUNT_ID !== PREVIEW_ACCOUNT || !process.env.CLOUDFLARE_API_TOKEN) throw new Error('Release account configuration unavailable');
  const api = async path => {
    const response = await fetch('https://api.cloudflare.com/client/v4' + path, {headers:{authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN},signal:AbortSignal.timeout(20000)});
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error('Read-only resource inspection failed');
    return result.result;
  };
  stage = 'resource inspection';
  const resources = await inspectReleaseResources(PREVIEW_ACCOUNT, api);
  const sqlPath = join(dir, 'production.sql');
  stage = 'consistent SQL export';
  execFileSync(process.execPath, [resolve('node_modules/wrangler/bin/wrangler.js'), 'd1','export','debtfree-dashboard-prod','--remote','--skip-confirmation','--config','wrangler.jsonc','--output',sqlPath], {stdio:'pipe',timeout:120000,maxBuffer:4*1024*1024,env:{...process.env,WRANGLER_SEND_METRICS:'false'}});
  // Standard SQLite restore of the consistent full export, never the live preview.
  // FKs are checked after all table definitions/inserts are loaded, because the
  // existing migration/export lists child tables before the parent table exists.
  stage = 'private SQLite restore';
  const restore = execFileSync('python3',['-c',`
import sqlite3,json,sys,pathlib
sql=pathlib.Path(sys.argv[1]).read_text()
db=sqlite3.connect(':memory:')
db.executescript(sql)
assert db.execute('PRAGMA integrity_check').fetchall()==[('ok',)]
assert db.execute('PRAGMA foreign_key_check').fetchall()==[]
db.row_factory=sqlite3.Row
names=[r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name != 'd1_migrations'")]
assert set(names)=={'households','household_members','household_state'}
rows={name:[dict(r) for r in db.execute('SELECT * FROM '+name)] for name in names}
print(json.dumps(rows))
`,sqlPath],{stdio:['ignore','pipe','pipe'],encoding:'utf8',timeout:30000,maxBuffer:64*1024*1024});
  stage = 'stored contract and snapshot compatibility';
  const rows = JSON.parse(restore);
  if (!rows.households.length || !rows.household_state.length) throw new Error('Production backup unexpectedly empty');
  const review=[];
  for(const state of rows.household_state) {
    if(state.payload===null) continue;
    const original=JSON.parse(state.payload);
    const contract=parseDashboardContract(original);
    const raw=original.payload ?? original;
    // Parsing may normalize old contracts; it must preserve every pinned snapshot.
    if(JSON.stringify(contract.payload.snapshots)!==JSON.stringify(raw.snapshots)) throw new Error('Snapshot compatibility review required');
    if(contract.payload.monthlyPlan.progressStartingBalance!==raw.monthlyPlan?.progressStartingBalance) throw new Error('Starting Progress compatibility review required');
    review.push({householdId:state.household_id,revision:state.revision,startingBalance:raw.monthlyPlan?.progressStartingBalance,snapshots:raw.snapshots,reconciliationAccounts:contract.payload.accounts});
  }
  stage = 'backup encryption';
  const sql=await readFile(sqlPath,'utf8');
  const envelope=Buffer.from(JSON.stringify({createdAt:new Date().toISOString(),sourceCommit:process.env.GITHUB_SHA,resources,sql,sqlSha256:createHash('sha256').update(sql).digest('hex'),rows,compatibilityReview:review}));
  const key=randomBytes(32),iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
  const encrypted=Buffer.concat([cipher.update(envelope),cipher.final()]);
  const wrapped=publicEncrypt({key:await readFile('config/recovery-release-20261015.pub.pem'),padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},key);
  await mkdir('outputs/private-release',{recursive:true});
  await writeFile('outputs/private-release/production-backup.encrypted.json',JSON.stringify({format:'debtfree-release-backup-v1',algorithm:'RSA-OAEP-SHA256+AES-256-GCM',key:wrapped.toString('base64'),iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),ciphertext:encrypted.toString('base64')}));
  key.fill(0); envelope.fill(0);
  console.log('Production full SQL export restored privately in SQLite; integrity, foreign keys, all stored contracts and original Progress snapshots passed. Encrypted backup prepared. No production writes or financial payloads logged.');
} catch {
  console.error('Private release backup failed at ' + stage + '. No production writes or deployment performed; no financial payload logged.');
  process.exitCode=1;
} finally {
  await rm(dir,{recursive:true,force:true});
}
