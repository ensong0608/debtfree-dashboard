import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { PREVIEW_ACCOUNT, PRODUCTION_DATABASE_ID } from './provision-preview-isolation.mjs';
export const productionTables = ['households', 'household_members', 'household_state', 'household_invitations', 'household_requests'];
export const optionalProductionTables = ['notification_subscriptions', 'notification_deliveries', 'app_feedback'];
export const knownProductionTables = [...productionTables, ...optionalProductionTables];
export function checkedProductionTables(names) {
  if (productionTables.some(table => !names.includes(table))) throw new Error('Missing production table');
  if (names.some(table => !knownProductionTables.includes(table)) || new Set(names).size !== names.length) throw new Error('Unexpected production table');
  return knownProductionTables.filter(table => names.includes(table));
}
function canonical(value) {
  if(Array.isArray(value)) return value.map(canonical);
  if(value && typeof value==='object') return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));
  return value;
}
export function fingerprintRows(rows) {
  return Object.fromEntries(checkedProductionTables(Object.keys(rows)).map(table=>{
    if(!Array.isArray(rows[table])) throw new Error('Missing production table');
    const sorted=rows[table].map(row=>JSON.stringify(canonical(row))).sort();
    return [table, createHash('sha256').update(JSON.stringify(sorted)).digest('hex')];
  }));
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  try {
    if(process.env.GITHUB_REF!=='refs/heads/codex/production-release-20261015' || process.env.CLOUDFLARE_ACCOUNT_ID!==PREVIEW_ACCOUNT || !process.env.CLOUDFLARE_API_TOKEN) throw new Error('Unexpected production verification configuration');
    const baseline=JSON.parse(await readFile('outputs/private-release/state-fingerprints.json','utf8'));
    // Match exactly the tables present in this backup, including deployed Settings
    // data. Older recovery checkpoints may legitimately predate those tables.
    const tables=checkedProductionTables(Object.keys(baseline));
    const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${PREVIEW_ACCOUNT}/d1/database/${PRODUCTION_DATABASE_ID}/query`,{
      method:'POST',headers:{authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN,'content-type':'application/json'},
      body:JSON.stringify({sql:tables.map(t=>'SELECT * FROM '+t).join(';')+';'}),signal:AbortSignal.timeout(20000),
    });
    const data=await response.json();
    if(!response.ok || !data.success || data.result?.length!==tables.length || data.result.some(r=>!r.success)) throw new Error('Read-only preservation query failed');
    const actual=fingerprintRows(Object.fromEntries(tables.map((t,i)=>[t,data.result[i].results])));
    if(JSON.stringify(actual)!==JSON.stringify(baseline)) throw new Error('Stored rows changed since the backup; could be concurrent activity. Inspect privately, never automatically restore an older backup');
    console.log('Post-deployment preservation PASSED: every backed-up household, membership, financial-state, invitation, request and Settings table matches the immediate pre-release backup exactly. No values or identities logged.');
  } catch {
    console.error('Production preservation check could not establish an exact match. Review privately for concurrent activity or a verification failure; do not automatically restore/rollback financial data.');process.exitCode=1;
  }
}
