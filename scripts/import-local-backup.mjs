import { readFileSync, mkdirSync, copyFileSync, writeFileSync, constants } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID, createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { getPlatformProxy } from 'wrangler';
import { parseDashboardContract, serializeDashboardBackup } from '../app/dashboard-data.ts';
import { assertLocalConfiguration } from './local-config.mjs';

const source = process.argv[2] && resolve(process.argv[2]);
if (!source) throw new Error('Usage: npm run db:import:local -- C:\\path\\to\\household-backup.json');
process.chdir(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
assertLocalConfiguration();
const text = readFileSync(source, 'utf8').replace(/^\uFEFF/, '');
let contract;
try {
  contract = parseDashboardContract(JSON.parse(text));
  const rejectSecrets = value => {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (/^(access_token|refresh_token|service_role_key|client_secret|authorization|password)$/i.test(key)) throw new Error();
      rejectSecrets(child);
    }
  };
  rejectSecrets(contract);
} catch { throw new Error('Backup validation failed. No records were imported; private contents were omitted from this error.'); }
const serialized = serializeDashboardBackup(contract);
const stamp = new Date().toISOString().replaceAll(':', '-');
mkdirSync('.wrangler/private', { recursive: true });
const sourceCopy = `.wrangler/private/production-backup-${stamp}.json`;
copyFileSync(source, sourceCopy, constants.COPYFILE_EXCL);
const proxy = await getPlatformProxy({ configPath: 'wrangler.local.jsonc', persist: { path: '.wrangler/local-state/v3' }, remoteBindings: false, envFiles: [] });
try {
  const db = proxy.env.DB;
  const tables = ['households', 'household_members', 'household_state', 'household_invitations', 'household_requests'];
  const before = {};
  for (const table of tables) before[table] = (await db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()).results;
  writeFileSync(`.wrangler/private/local-before-import-${stamp}.json`, JSON.stringify(before), { flag: 'wx' });
  if (before.household_members.some(row => row.email === 'production@example.test')) {
    throw new Error('A production copy already exists. Existing local work was preserved; no overwrite was performed.');
  }
  const id = 'local-production-' + randomUUID();
  const now = Date.now();
  await db.batch([
    db.prepare('INSERT INTO households (id,name,owner_email,created_at,updated_at) VALUES (?,?,?,?,?)').bind(id, 'Production household (local copy)', 'production@example.test', now, now),
    db.prepare("INSERT INTO household_members (email,household_id,display_name,role,status,invited_by,created_at,updated_at) VALUES (?,?,?,'owner','active',NULL,?,?)").bind('production@example.test', id, 'Production copy', now, now),
    db.prepare('INSERT INTO household_state (household_id,payload,revision,updated_by,updated_at) VALUES (?,?,0,?,?)').bind(id, serialized, 'production@example.test', now),
  ]);
  const stored = await db.prepare('SELECT payload FROM household_state WHERE household_id=?').bind(id).first();
  if (!isDeepStrictEqual(JSON.parse(stored.payload), JSON.parse(serialized))) throw new Error('Local copy verification failed. Private details omitted.');
  for (const table of tables) {
    const after = (await db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()).results.filter(row => table === 'households' ? row.id !== id : row.household_id !== id);
    if (!isDeepStrictEqual(after, before[table])) throw new Error('Existing local rows changed concurrently; inspect the private checkpoint.');
  }
  const report = {
    importedAt: new Date().toISOString(), localHouseholdId: id,
    payloadSha256: createHash('sha256').update(JSON.stringify(contract.payload)).digest('hex'),
    accounts: contract.payload.accounts.length, transactions: contract.payload.transactions.length,
    snapshots: contract.payload.snapshots.length, budgetMonths: Object.keys(contract.payload.monthlyBudgets).length,
    loans: contract.payload.monthlyPlan?.loanTrackers?.length ?? 0,
    existingLocalRowsPreserved: true, productionWrites: false,
  };
  writeFileSync('.wrangler/private/production-import-report.json', JSON.stringify(report, null, 2));
  console.log('Production financial backup imported into a separate local household. Existing local rows preserved.');
  console.log(JSON.stringify({ accounts: report.accounts, transactions: report.transactions, snapshots: report.snapshots, budgetMonths: report.budgetMonths, loans: report.loans }));
  console.log('Open http://localhost:8787/__local and choose production. No authentication secrets were copied.');
} finally { await proxy.dispose(); }
