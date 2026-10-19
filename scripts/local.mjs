import { assertLocalConfiguration } from './local-config.mjs';
import { spawnSync } from 'node:child_process';
assertLocalConfiguration();
const mode = process.argv[2];
const run = (file, args) => {
  const result = spawnSync(process.execPath, [file, ...args], { stdio: 'inherit', env: { ...process.env, DEBTFREE_LOCAL: '1', DEBTFREE_DISABLE_INSPECTOR: '1', WRANGLER_SEND_METRICS: 'false' } });
  if (result.status !== 0) process.exit(result.status ?? 1);
};
if (mode === 'dev') run('node_modules/vinext/dist/cli.js', ['dev', '--host', 'localhost', '--port', '8787', '--strictPort']);
else if (mode === 'migrate') run('node_modules/wrangler/bin/wrangler.js', ['d1','migrations','apply','debtfree-dashboard-local','--local','--config','wrangler.local.jsonc','--persist-to','.wrangler/local-state']);
else if (mode === 'seed') {
  run('scripts/seed-local.mjs', []);
  run('node_modules/wrangler/bin/wrangler.js', ['d1','execute','debtfree-dashboard-local','--local','--config','wrangler.local.jsonc','--persist-to','.wrangler/local-state','--file','.wrangler/local-seed.sql']);
} else throw new Error('Expected dev, migrate, or seed');
