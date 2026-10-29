import { execFileSync } from 'node:child_process';
import { knownProductionTables, productionTables } from './production-preservation.mjs';

/** Restore privately into disposable SQLite. The returned rows stay in memory;
 * callers must encrypt them before persistence and must never log their values. */
export function restoreProductionRows(sqlPath) {
  const output = execFileSync('python3', ['-c', `
import sqlite3,json,sys,pathlib
sql=pathlib.Path(sys.argv[1]).read_text()
db=sqlite3.connect(':memory:')
db.executescript(sql)
assert db.execute('PRAGMA integrity_check').fetchall()==[('ok',)]
assert db.execute('PRAGMA foreign_key_check').fetchall()==[]
db.row_factory=sqlite3.Row
names=[r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name != 'd1_migrations'")]
assert set(json.loads(sys.argv[2])).issubset(set(names)), 'Missing production table'
assert set(names).issubset(set(json.loads(sys.argv[3]))), 'Unexpected production table'
rows={name:[dict(r) for r in db.execute('SELECT * FROM '+name)] for name in names}
print(json.dumps(rows))
`, sqlPath, JSON.stringify(productionTables), JSON.stringify(knownProductionTables)], {
    stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', timeout: 30000, maxBuffer: 64 * 1024 * 1024,
  });
  return JSON.parse(output);
}
