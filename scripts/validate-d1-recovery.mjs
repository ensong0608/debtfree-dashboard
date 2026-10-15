import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { parseDashboardContract, serializeDashboardBackup } from '../app/dashboard-data.ts';

// Deliberately local-only: no caller-supplied database, config, path, or remote flag.
// Both databases and the SQL backup are disposable synthetic fixtures.
const dir = await mkdtemp(join(tmpdir(), 'debtfree-recovery-'));
try {
  const config = join(dir, 'wrangler.json');
  await writeFile(config, JSON.stringify({ name: 'synthetic-recovery', compatibility_date: '2026-08-04', d1_databases: [
    { binding: 'SOURCE', database_name: 'synthetic-recovery-source', database_id: '11111111-1111-4111-8111-111111111111' },
    { binding: 'TARGET', database_name: 'synthetic-recovery-target', database_id: '22222222-2222-4222-8222-222222222222' },
  ] }));
  const cli = (...args) => execFileSync(process.execPath, [resolve('node_modules/wrangler/bin/wrangler.js'), 'd1', ...args, '--local', '--config', config], {
    encoding: 'utf8', timeout: 60000, maxBuffer: 8 * 1024 * 1024,
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
  });
  const contract = parseDashboardContract(JSON.parse(await readFile('tests/fixtures/legacy-v0.json', 'utf8')));
  contract.payload.monthlyPlan = { ...contract.payload.monthlyPlan, months: {}, detailedSpendingTracking: false, progressStartingBalance: 9250.75, loanTrackers: [{
    id: 'synthetic-unlinked-loan', name: 'Synthetic house', kind: 'house', originalAmount: 100000, remainingAmount: 80000,
    balanceKind: 'principal', asOf: '2026-10-14', budgetItemId: '', budgetItemName: '',
    history: [{ date: '2026-10-14', amount: 80000, balanceKind: 'principal', recordedAt: '2026-10-14T12:00:00.000Z' }],
  }] };
  const serialized = serializeDashboardBackup(parseDashboardContract(contract));
  const quote = value => "'" + value.replaceAll("'", "''") + "'";
  const migrations = (await readdir('drizzle')).filter(name => name.endsWith('.sql')).sort();
  const schema = (await Promise.all(migrations.map(name => readFile(join('drizzle', name), 'utf8')))).join('\n');
  const seed = join(dir, 'seed.sql');
  await writeFile(seed, schema + `
INSERT INTO households VALUES ('synthetic-a', 'Synthetic A', 'a@example.test', 10, 20);
INSERT INTO households VALUES ('synthetic-b', 'Synthetic B', 'b@example.test', 11, 21);
INSERT INTO household_members VALUES ('a@example.test', 'synthetic-a', 'Owner A', 'owner', 'active', NULL, 10, 20);
INSERT INTO household_members VALUES ('partner@example.test', 'synthetic-a', 'Partner', 'admin', 'active', 'a@example.test', 12, 22);
INSERT INTO household_members VALUES ('viewer@example.test', 'synthetic-a', NULL, 'viewer', 'invited', 'a@example.test', 13, 23);
INSERT INTO household_members VALUES ('b@example.test', 'synthetic-b', 'Owner B', 'owner', 'active', NULL, 11, 21);
INSERT INTO household_state VALUES ('synthetic-a', ${quote(serialized)}, 7, 'partner@example.test', 20);
INSERT INTO household_state VALUES ('synthetic-b', NULL, 0, NULL, 21);
`);
  cli('execute', 'SOURCE', '--file', seed, '--yes');
  // The current migration creates child tables first. A default local D1 dump
  // interleaves CREATE/INSERT in that order; deferred FKs cannot reference a
  // parent table that does not yet exist. Export complete tables parent-first,
  // without rewriting SQL or turning off referential integrity.
  const tables = ['households', 'household_members', 'household_state'];
  const inventory = JSON.parse(cli('execute', 'SOURCE', '--json', '--command', "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name"))[0].results.map(row => row.name);
  assert.deepEqual(inventory, [...tables].sort(), 'Review recovery ordering when application schema changes');
  const parts = [];
  for (const table of tables) {
    const part = join(dir, table + '.sql');
    cli('export', 'SOURCE', '--table', table, '--output', part);
    parts.push(await readFile(part, 'utf8'));
  }
  const backup = join(dir, 'backup.sql');
  await writeFile(backup, parts.join('\n'));
  assert.ok((await readFile(backup, 'utf8')).includes('CREATE TABLE'));
  cli('execute', 'TARGET', '--file', backup, '--yes');
  const query = database => JSON.parse(cli('execute', database, '--json', '--command',
    'SELECT * FROM households ORDER BY id; SELECT * FROM household_members ORDER BY email; SELECT * FROM household_state ORDER BY household_id; PRAGMA foreign_key_check; PRAGMA quick_check;'));
  const source = query('SOURCE'), restored = query('TARGET');
  assert.equal(source.length, 5);
  // D1 metadata/timings differ. Compare every stored column in each application table.
  assert.deepEqual(restored.map(r => r.results), source.map(r => r.results));
  assert.deepEqual(restored[3].results, []);
  assert.deepEqual(Object.values(restored[4].results[0]), ['ok']);
  const saved = restored[2].results.find(row => row.household_id === 'synthetic-a');
  assert.equal(saved.revision, 7);
  assert.equal(saved.payload, serialized); // Exact bytes, including historical dates and unknown metadata.
  const payload = parseDashboardContract(JSON.parse(saved.payload)).payload;
  assert.deepEqual(payload.snapshots, contract.payload.snapshots);
  assert.equal(payload.snapshots[0].capturedAt, '2026-07-31T23:00:00.000Z');
  assert.equal(payload.monthlyPlan.progressStartingBalance, 9250.75);
  assert.deepEqual(payload.monthlyPlan.loanTrackers, contract.payload.monthlyPlan.loanTrackers);
  console.log('Local D1 SQL recovery PASSED: separate source/target, all household/member/state columns, exact payload, revision, starting Progress/snapshot dates, unlinked loan/history, quick_check and foreign keys. No remote database accessed.');
} finally {
  await rm(dir, { recursive: true, force: true });
}
