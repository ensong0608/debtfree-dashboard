import { readFileSync } from 'node:fs';

export function assertLocalConfiguration() {
  const config = JSON.parse(readFileSync(new URL('../wrangler.local.jsonc', import.meta.url), 'utf8'));
  const [db] = config.d1_databases ?? [];
  if (config.name !== 'debtfree-dashboard-local' || config.d1_databases.length !== 1 ||
      db.binding !== 'DB' || db.database_name !== 'debtfree-dashboard-local' ||
      db.database_id !== '00000000-0000-4000-8000-000000000001' || db.remote !== false ||
      config.vars?.APP_ORIGIN !== 'http://localhost:8787' || config.vars?.AUTH_PROVIDER ||
      config.services?.length || config.kv_namespaces?.length || config.r2_buckets?.length) {
    throw new Error('Local configuration changed. Refusing to start or import until isolation is reviewed.');
  }
  return config;
}
